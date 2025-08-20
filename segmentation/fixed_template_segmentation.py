# final_document_extractor.py
# Complete solution for extracting 9 sections from operational log documents
# Handles rotation, scaling, and perspective correction automatically

import cv2
import numpy as np
from PIL import Image
import json
import os
from typing import List, Dict, Tuple, Optional
import pytesseract

class DocumentSectionExtractor:
    """
    Complete document section extraction system that automatically:
    - Detects document boundary
    - Corrects rotation and perspective
    - Scales to standard size
    - Extracts 9 predefined sections
    - Performs OCR on each section
    """
    
    def __init__(self, standard_width: int = 1200, standard_height: int = 900):
        print("🔧 Initializing Document Section Extractor...")
        
        # Setup Tesseract OCR
        self.setup_tesseract()
        
        # Standard document dimensions for normalization
        self.standard_width = standard_width
        self.standard_height = standard_height
        
        # Define the 9 sections using relative coordinates (0.0 to 1.0)
        # These ratios work for any document size after alignment
        self.sections_template = {
            'package_info': {
                'bbox_ratio': (0.85, 0.055, 0.15, 0.067),
                'description': 'Package information (top right)'
            },
            'date_section': {
                'bbox_ratio': (0.85, 0.128, 0.15, 0.044),
                'description': 'Date information'
            },
            'main_data_table': {
                'bbox_ratio': (0.042, 0.167, 0.916, 0.611),
                'description': 'Main operational data table'
            },
            'daily_running_hours': {
                'bbox_ratio': (0.042, 0.8, 0.317, 0.133),
                'description': 'Daily running hours and cumulative hours'
            },
            'petroleum_status': {
                'bbox_ratio': (0.042, 0.944, 0.317, 0.111),
                'description': 'Petroleum oil lubricants daily status'
            },
            'pkg_trip_details': {
                'bbox_ratio': (0.375, 0.8, 0.292, 0.089),
                'description': 'PKG Trip & Change over details'
            },
            'shift_incharge': {
                'bbox_ratio': (0.683, 0.8, 0.317, 0.089),
                'description': 'Day/Night shift incharge'
            },
            'remarks_section': {
                'bbox_ratio': (0.375, 0.9, 0.458, 0.089),
                'description': 'Remarks section'
            },
            'signatures': {
                'bbox_ratio': (0.683, 0.9, 0.317, 0.156),
                'description': 'Signatures and approvals'
            }
        }
        
        print(f"✓ Template loaded with {len(self.sections_template)} sections")
    
    def setup_tesseract(self):
        """Setup Tesseract OCR path for Windows"""
        possible_paths = [
            r'C:\Program Files\Tesseract-OCR\tesseract.exe',
            r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
            r'C:\Users\{}\AppData\Local\Programs\Tesseract-OCR\tesseract.exe'.format(os.getenv('USERNAME', '')),
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                pytesseract.pytesseract.tesseract_cmd = path
                print(f"✓ Tesseract found at: {path}")
                return
        
        print("⚠️ Tesseract auto-detection failed")
        print("Please install Tesseract or set path manually:")
        print("pytesseract.pytesseract.tesseract_cmd = r'C:\\Program Files\\Tesseract-OCR\\tesseract.exe'")
    
    def detect_document_boundary(self, image: np.ndarray) -> Optional[np.ndarray]:
        """
        Detect the outer boundary of the document.
        Returns the four corner points of the document boundary.
        """
        print("🔍 Detecting document boundary...")
        
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        
        # Apply Gaussian blur
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Edge detection with adaptive thresholds
        edges = cv2.Canny(blurred, 50, 150)
        
        # Morphological operations to close gaps
        kernel = np.ones((3, 3), np.uint8)
        edges = cv2.dilate(edges, kernel, iterations=2)
        edges = cv2.erode(edges, kernel, iterations=1)
        
        # Find contours
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Find the largest rectangular contour
        document_contour = None
        max_area = 0
        min_area = image.shape[0] * image.shape[1] * 0.1  # At least 10% of image
        
        for contour in contours:
            # Approximate contour to polygon
            epsilon = 0.02 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)
            
            # Check if it's roughly rectangular (4 corners) and large enough
            if len(approx) == 4:
                area = cv2.contourArea(contour)
                if area > max_area and area > min_area:
                    max_area = area
                    document_contour = approx
        
        if document_contour is not None:
            print("✓ Document boundary detected automatically")
            return self.order_corner_points(document_contour.reshape(4, 2))
        
        # Fallback: use image boundaries with margin
        print("⚠️ Auto-detection failed, using image boundaries")
        h, w = image.shape[:2]
        margin = min(w, h) * 0.02
        
        return np.array([
            [margin, margin],                    # top-left
            [w - margin, margin],                # top-right  
            [w - margin, h - margin],            # bottom-right
            [margin, h - margin]                 # bottom-left
        ], dtype=np.float32)
    
    def order_corner_points(self, pts: np.ndarray) -> np.ndarray:
        """Order points: top-left, top-right, bottom-right, bottom-left"""
        rect = np.zeros((4, 2), dtype="float32")
        
        # Sum and difference method to find corners
        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)]     # top-left (smallest sum)
        rect[2] = pts[np.argmax(s)]     # bottom-right (largest sum)
        
        diff = np.diff(pts, axis=1)
        rect[1] = pts[np.argmin(diff)]  # top-right (smallest difference)
        rect[3] = pts[np.argmax(diff)]  # bottom-left (largest difference)
        
        return rect
    
    def align_and_normalize_document(self, image: np.ndarray) -> Tuple[np.ndarray, bool]:
        """
        Detect document boundary, correct perspective, and scale to standard size.
        """
        # Detect document corners
        corners = self.detect_document_boundary(image)
        
        if corners is None:
            print("❌ Could not detect document boundary")
            return image, False
        
        # Define destination points (standard document size)
        dst_points = np.array([
            [0, 0],                                      # top-left
            [self.standard_width, 0],                    # top-right
            [self.standard_width, self.standard_height], # bottom-right
            [0, self.standard_height]                    # bottom-left
        ], dtype="float32")
        
        # Calculate perspective transformation matrix
        transformation_matrix = cv2.getPerspectiveTransform(corners, dst_points)
        
        # Apply perspective transformation
        aligned_image = cv2.warpPerspective(
            image, 
            transformation_matrix, 
            (self.standard_width, self.standard_height),
            flags=cv2.INTER_LINEAR
        )
        
        print(f"✓ Document aligned and scaled to {self.standard_width}x{self.standard_height}")
        return aligned_image, True
    
    def extract_sections(self, aligned_image: np.ndarray) -> List[Dict]:
        """
        Extract all 9 sections from the aligned document using relative coordinates.
        """
        print("📋 Extracting sections using template...")
        
        height, width = aligned_image.shape[:2]
        extracted_sections = []
        
        for section_name, section_info in self.sections_template.items():
            # Convert relative coordinates to absolute pixels
            x_ratio, y_ratio, w_ratio, h_ratio = section_info['bbox_ratio']
            
            x = int(x_ratio * width)
            y = int(y_ratio * height)
            w = int(w_ratio * width)
            h = int(h_ratio * height)
            
            # Ensure coordinates are within image bounds
            x = max(0, min(x, width - 1))
            y = max(0, min(y, height - 1))
            w = min(w, width - x)
            h = min(h, height - y)
            
            # Extract section image
            if w > 0 and h > 0:
                section_image = aligned_image[y:y+h, x:x+w]
                
                extracted_sections.append({
                    'id': section_name,
                    'description': section_info['description'],
                    'bbox': (x, y, w, h),
                    'image': section_image,
                    'relative_coords': section_info['bbox_ratio']
                })
        
        print(f"✓ Extracted {len(extracted_sections)} sections")
        return extracted_sections
    
    def perform_ocr_on_sections(self, sections: List[Dict]) -> List[Dict]:
        """
        Perform OCR on all extracted sections.
        """
        print("🔍 Performing OCR on extracted sections...")
        
        for i, section in enumerate(sections):
            print(f"  Processing {section['id']} ({i+1}/{len(sections)})...")
            
            try:
                # Convert image for OCR
                section_img = section['image']
                if len(section_img.shape) == 3:
                    section_img = cv2.cvtColor(section_img, cv2.COLOR_BGR2RGB)
                
                pil_image = Image.fromarray(section_img)
                
                # Perform OCR with appropriate settings
                ocr_config = self.get_ocr_config(section['id'])
                text = pytesseract.image_to_string(pil_image, config=ocr_config)
                
                # Store results
                section['ocr_text'] = text.strip()
                section['ocr_length'] = len(section['ocr_text'])
                section['has_text'] = section['ocr_length'] > 0
                
            except Exception as e:
                print(f"    ⚠️ OCR failed for {section['id']}: {e}")
                section['ocr_text'] = ""
                section['ocr_length'] = 0
                section['has_text'] = False
        
        print("✓ OCR processing completed")
        return sections
    
    def get_ocr_config(self, section_name: str) -> str:
        """Get appropriate OCR configuration based on section type."""
        if 'table' in section_name.lower():
            return '--psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,-:/ '
        elif 'date' in section_name.lower() or 'package' in section_name.lower():
            return '--psm 7'  # Single text line
        elif 'signature' in section_name.lower():
            return '--psm 11'  # Sparse text
        else:
            return '--psm 6'   # Uniform block of text
    
    def save_results(self, sections: List[Dict], aligned_image: np.ndarray, original_path: str, output_dir: str):
        """
        Save all extracted sections and create summary.
        """
        os.makedirs(output_dir, exist_ok=True)
        print(f"💾 Saving results to: {output_dir}")
        
        # Save aligned document image
        aligned_path = os.path.join(output_dir, "aligned_document.jpg")
        cv2.imwrite(aligned_path, aligned_image)
        
        # Save each section
        for section in sections:
            section_id = section['id']
            
            # Save section image
            img_path = os.path.join(output_dir, f"{section_id}.png")
            cv2.imwrite(img_path, section['image'])
            
            # Save OCR text
            txt_path = os.path.join(output_dir, f"{section_id}.txt")
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(f"Section: {section['description']}\n")
                f.write(f"Position: {section['bbox']}\n")
                f.write(f"Relative coordinates: {section['relative_coords']}\n")
                f.write(f"Text length: {section['ocr_length']} characters\n")
                f.write(f"Has text: {section['has_text']}\n")
                f.write("-" * 50 + "\n")
                f.write("Extracted Text:\n")
                f.write(section['ocr_text'])
        
        # Create summary report
        summary = {
            'input_file': original_path,
            'processing_timestamp': str(cv2.getTickCount()),
            'total_sections': len(sections),
            'sections_summary': [
                {
                    'id': s['id'],
                    'description': s['description'],
                    'bbox': s['bbox'],
                    'text_length': s['ocr_length'],
                    'has_text': s['has_text']
                }
                for s in sections
            ]
        }
        
        summary_path = os.path.join(output_dir, "extraction_summary.json")
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2)
        
        print("✓ All results saved successfully")
        return summary
    
    def create_visualization(self, aligned_image: np.ndarray, sections: List[Dict], output_path: str):
        """
        Create visualization showing extracted sections.
        """
        try:
            import matplotlib.pyplot as plt
            import matplotlib.patches as patches
        except ImportError:
            print("⚠️ Matplotlib not available for visualization")
            return
        
        # Convert image for matplotlib
        if len(aligned_image.shape) == 3:
            display_img = cv2.cvtColor(aligned_image, cv2.COLOR_BGR2RGB)
        else:
            display_img = aligned_image
        
        # Create figure
        fig, ax = plt.subplots(1, 1, figsize=(16, 12))
        ax.imshow(display_img)
        
        # Define colors for different sections
        colors = [
            'red', 'blue', 'green', 'orange', 'purple', 
            'cyan', 'magenta', 'yellow', 'pink'
        ]
        
        # Draw bounding boxes for each section
        for i, section in enumerate(sections):
            x, y, w, h = section['bbox']
            color = colors[i % len(colors)]
            
            # Draw rectangle
            rect = patches.Rectangle((x, y), w, h, linewidth=2, 
                                   edgecolor=color, facecolor='none')
            ax.add_patch(rect)
            
            # Add label
            ax.text(x, y-5, f"{i+1}. {section['id']}", 
                   color=color, fontsize=10, fontweight='bold',
                   bbox=dict(boxstyle="round,pad=0.3", facecolor='white', alpha=0.8))
        
        ax.set_title(f"Document Sections Extraction - {len(sections)} sections found")
        ax.axis('off')
        
        plt.tight_layout()
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"✓ Visualization saved: {output_path}")
    
    def print_summary(self, sections: List[Dict]):
        """Print extraction summary to console."""
        print(f"\n📊 EXTRACTION SUMMARY")
        print("=" * 60)
        print(f"Total sections extracted: {len(sections)}")
        print("-" * 60)
        
        for i, section in enumerate(sections, 1):
            status = "✓" if section['has_text'] else "⚠️ (no text)"
            name = section['description']
            chars = section['ocr_length']
            
            print(f"{i:2d}. {status} {name}")
            print(f"     Position: {section['bbox']}")
            print(f"     Text length: {chars} characters")
            
            if section['has_text'] and chars > 0:
                # Show preview of extracted text
                preview = section['ocr_text'][:80].replace('\n', ' ').strip()
                if len(preview) > 0:
                    print(f"     Preview: {preview}...")
            print()
    
    def process_document(self, input_file: str, output_dir: str = "extracted_sections") -> Dict:
        """
        Main processing function - processes doc1.jpg and extracts all sections.
        """
        print(f"🚀 Starting document processing...")
        print(f"📁 Input file: {input_file}")
        print(f"📁 Output directory: {output_dir}")
        print("=" * 60)
        
        # Check if input file exists
        if not os.path.exists(input_file):
            raise FileNotFoundError(f"Input file not found: {input_file}")
        
        # Load image
        print("📷 Loading image...")
        original_image = cv2.imread(input_file)
        if original_image is None:
            raise ValueError(f"Could not load image: {input_file}")
        
        h, w = original_image.shape[:2]
        print(f"✓ Image loaded: {w}x{h} pixels")
        
        # Step 1: Detect boundary and align document
        aligned_image, alignment_success = self.align_and_normalize_document(original_image)
        
        if not alignment_success:
            print("⚠️ Using original image without alignment")
            aligned_image = original_image
        
        # Step 2: Extract sections
        sections = self.extract_sections(aligned_image)
        
        # Step 3: Perform OCR
        sections = self.perform_ocr_on_sections(sections)
        
        # Step 4: Save results
        summary = self.save_results(sections, aligned_image, input_file, output_dir)
        
        # Step 5: Create visualization
        viz_path = os.path.join(output_dir, "sections_visualization.png")
        self.create_visualization(aligned_image, sections, viz_path)
        
        # Step 6: Print summary
        self.print_summary(sections)
        
        print("=" * 60)
        print("✅ PROCESSING COMPLETED SUCCESSFULLY!")
        print(f"📁 All results saved in: {output_dir}/")
        print(f"🖼️ Visualization: {viz_path}")
        
        return {
            'input_file': input_file,
            'output_directory': output_dir,
            'alignment_success': alignment_success,
            'total_sections': len(sections),
            'sections': sections,
            'summary': summary
        }

def main():
    """
    Main function - processes doc1.jpg and extracts sections.
    """
    print("📄 Document Section Extractor")
    print("Automatically extracts 9 sections from operational log documents")
    print("Handles rotation, scaling, and perspective correction")
    print("=" * 70)
    
    # Input and output configuration
    INPUT_FILE = "../sample_input/doc1.jpg"  # Your input file
    OUTPUT_DIR = "extracted_sections_02"  # Output directory
    
    try:
        # Initialize extractor
        extractor = DocumentSectionExtractor(
            standard_width=1200, 
            standard_height=900
        )
        
        # Process the document
        results = extractor.process_document(INPUT_FILE, OUTPUT_DIR)
        
        print(f"\n🎯 FINAL RESULTS:")
        print(f"✓ Input processed: {INPUT_FILE}")
        print(f"✓ Output saved to: {OUTPUT_DIR}/")
        print(f"✓ Sections extracted: {results['total_sections']}")
        print(f"✓ Alignment successful: {results['alignment_success']}")
        
        # List output files
        print(f"\n📋 Output Files:")
        if os.path.exists(OUTPUT_DIR):
            files = sorted(os.listdir(OUTPUT_DIR))
            for file in files:
                print(f"  - {file}")
        
    except FileNotFoundError:
        print(f"❌ ERROR: Input file '{INPUT_FILE}' not found!")
        print(f"Please ensure {INPUT_FILE} is in the same directory as this script.")
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()