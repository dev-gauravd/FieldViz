# improved_document_extractor.py
# Improved solution with accurate section coordinates for operational log documents

import cv2
import numpy as np
from PIL import Image
import json
import os
from typing import List, Dict, Tuple, Optional
import pytesseract

class ImprovedDocumentExtractor:
    """
    Improved document section extraction with accurate coordinates
    based on the actual marked sections in your document.
    """
    
    def __init__(self, use_original_dimensions: bool = True):
        print("🔧 Initializing Improved Document Section Extractor...")
        
        # Setup Tesseract OCR
        self.setup_tesseract()
        
        # Option to use original dimensions or scale
        self.use_original_dimensions = use_original_dimensions
        self.standard_width = 1200
        self.standard_height = 900
        
        # CORRECTED section coordinates based on your marked.png
        # These are relative coordinates (0.0 to 1.0) measured from the marked sections
        self.sections_template = {
            'package_info': {
                'bbox_ratio': (0.815, 0.045, 0.165, 0.025),  # Top right - Package C
                'description': 'Package information (top right)'
            },
            'date_section': {
                'bbox_ratio': (0.815, 0.075, 0.165, 0.025),  # Date below package
                'description': 'Date information'
            },
            'main_data_table': {
                'bbox_ratio': (0.025, 0.125, 0.950, 0.580),  # Large central table
                'description': 'Main operational data table'
            },
            'daily_running_hours': {
                'bbox_ratio': (0.025, 0.720, 0.280, 0.120),  # Bottom left
                'description': 'Daily running hours and cumulative hours'
            },
            'petroleum_status': {
                'bbox_ratio': (0.025, 0.850, 0.280, 0.100),  # Bottom left corner
                'description': 'Petroleum oil lubricants daily status'
            },
            'pkg_trip_details': {
                'bbox_ratio': (0.320, 0.720, 0.340, 0.120),  # Bottom center
                'description': 'PKG Trip & Change over details'
            },
            'shift_incharge': {
                'bbox_ratio': (0.680, 0.720, 0.295, 0.055),  # Bottom right - shifts
                'description': 'Day/Night shift incharge'
            },
            'remarks_section': {
                'bbox_ratio': (0.320, 0.850, 0.655, 0.100),  # Bottom center - remarks
                'description': 'Remarks section'
            },
            'signatures': {
                'bbox_ratio': (0.680, 0.785, 0.295, 0.165),  # Bottom right corner
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
        print("Please install Tesseract or set path manually")
    
    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """
        Preprocess image to improve boundary detection
        """
        # Convert to grayscale if needed
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()
        
        # Apply CLAHE for better contrast
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(gray)
        
        return enhanced
    
    def detect_document_boundary_improved(self, image: np.ndarray) -> Optional[np.ndarray]:
        """
        Improved document boundary detection with multiple methods
        """
        print("🔍 Detecting document boundary (improved method)...")
        
        # Preprocess
        preprocessed = self.preprocess_image(image)
        
        # Method 1: Adaptive threshold
        adaptive_thresh = cv2.adaptiveThreshold(
            preprocessed, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 11, 2
        )
        
        # Method 2: Canny edge detection
        edges = cv2.Canny(preprocessed, 50, 150)
        
        # Combine methods
        combined = cv2.bitwise_or(adaptive_thresh, edges)
        
        # Morphological operations
        kernel = np.ones((5, 5), np.uint8)
        closed = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel)
        
        # Find contours
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Find the largest rectangular contour
        min_area = image.shape[0] * image.shape[1] * 0.3  # At least 30% of image
        best_contour = None
        max_area = 0
        
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < min_area:
                continue
                
            # Approximate to polygon
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
            
            # Check if it's a quadrilateral
            if len(approx) == 4 and area > max_area:
                max_area = area
                best_contour = approx
        
        if best_contour is not None:
            print("✓ Document boundary detected")
            return self.order_corner_points(best_contour.reshape(4, 2))
        
        # Fallback: use image edges
        print("⚠️ Using image boundaries as fallback")
        h, w = image.shape[:2]
        return np.array([
            [0, 0], [w, 0], [w, h], [0, h]
        ], dtype=np.float32)
    
    def order_corner_points(self, pts: np.ndarray) -> np.ndarray:
        """Order points: top-left, top-right, bottom-right, bottom-left"""
        rect = np.zeros((4, 2), dtype="float32")
        
        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)]     # top-left
        rect[2] = pts[np.argmax(s)]     # bottom-right
        
        diff = np.diff(pts, axis=1)
        rect[1] = pts[np.argmin(diff)]  # top-right
        rect[3] = pts[np.argmax(diff)]  # bottom-left
        
        return rect
    
    def align_document(self, image: np.ndarray) -> Tuple[np.ndarray, bool]:
        """
        Align document with option to keep original dimensions
        """
        # Detect boundary
        corners = self.detect_document_boundary_improved(image)
        
        if corners is None:
            return image, False
        
        # Calculate output dimensions
        if self.use_original_dimensions:
            # Calculate actual document dimensions from corners
            width = int(max(
                np.linalg.norm(corners[1] - corners[0]),
                np.linalg.norm(corners[2] - corners[3])
            ))
            height = int(max(
                np.linalg.norm(corners[3] - corners[0]),
                np.linalg.norm(corners[2] - corners[1])
            ))
        else:
            width = self.standard_width
            height = self.standard_height
        
        # Define destination points
        dst_points = np.array([
            [0, 0], [width, 0], 
            [width, height], [0, height]
        ], dtype="float32")
        
        # Apply perspective transform
        M = cv2.getPerspectiveTransform(corners, dst_points)
        aligned = cv2.warpPerspective(image, M, (width, height))
        
        print(f"✓ Document aligned to {width}x{height}")
        return aligned, True
    
    def extract_sections_accurate(self, image: np.ndarray) -> List[Dict]:
        """
        Extract sections with accurate coordinates
        """
        print("📋 Extracting sections with corrected coordinates...")
        
        height, width = image.shape[:2]
        extracted_sections = []
        
        for section_name, section_info in self.sections_template.items():
            # Convert relative to absolute coordinates
            x_ratio, y_ratio, w_ratio, h_ratio = section_info['bbox_ratio']
            
            x = int(x_ratio * width)
            y = int(y_ratio * height)
            w = int(w_ratio * width)
            h = int(h_ratio * height)
            
            # Add small padding for better extraction (optional)
            padding = 2
            x = max(0, x - padding)
            y = max(0, y - padding)
            w = min(width - x, w + 2 * padding)
            h = min(height - y, h + 2 * padding)
            
            # Extract section
            if w > 10 and h > 10:  # Minimum size check
                section_image = image[y:y+h, x:x+w].copy()
                
                # Enhance section for better OCR
                if len(section_image.shape) == 3:
                    section_gray = cv2.cvtColor(section_image, cv2.COLOR_BGR2GRAY)
                else:
                    section_gray = section_image
                
                # Apply denoising
                section_denoised = cv2.fastNlMeansDenoising(section_gray)
                
                extracted_sections.append({
                    'id': section_name,
                    'description': section_info['description'],
                    'bbox': (x, y, w, h),
                    'image': section_image,
                    'processed_image': section_denoised,
                    'relative_coords': section_info['bbox_ratio']
                })
                
                print(f"  ✓ {section_name}: {w}x{h} at ({x},{y})")
        
        return extracted_sections
    
    def perform_ocr_enhanced(self, sections: List[Dict]) -> List[Dict]:
        """
        Enhanced OCR with preprocessing for each section type
        """
        print("🔍 Performing enhanced OCR...")
        
        for section in sections:
            try:
                # Use processed image for OCR
                img_for_ocr = section.get('processed_image', section['image'])
                
                # Section-specific preprocessing
                if 'table' in section['id']:
                    # For tables, increase contrast
                    img_for_ocr = cv2.convertScaleAbs(img_for_ocr, alpha=1.5, beta=0)
                elif 'signature' in section['id']:
                    # For signatures, apply threshold
                    _, img_for_ocr = cv2.threshold(img_for_ocr, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                
                # Convert to PIL
                pil_image = Image.fromarray(img_for_ocr)
                
                # Perform OCR with appropriate config
                config = self.get_ocr_config(section['id'])
                text = pytesseract.image_to_string(pil_image, config=config)
                
                section['ocr_text'] = text.strip()
                section['ocr_length'] = len(section['ocr_text'])
                section['has_text'] = section['ocr_length'] > 0
                
                if section['has_text']:
                    print(f"  ✓ {section['id']}: {section['ocr_length']} chars extracted")
                
            except Exception as e:
                print(f"  ⚠️ OCR failed for {section['id']}: {e}")
                section['ocr_text'] = ""
                section['ocr_length'] = 0
                section['has_text'] = False
        
        return sections
    
    def get_ocr_config(self, section_name: str) -> str:
        """OCR configuration optimized for each section type"""
        configs = {
            'main_data_table': '--psm 6 --oem 3',  # Uniform block
            'date_section': '--psm 8 --oem 3',     # Single word/line
            'package_info': '--psm 8 --oem 3',     # Single word/line
            'signatures': '--psm 11 --oem 3',      # Sparse text
            'default': '--psm 6 --oem 3'           # Default
        }
        return configs.get(section_name, configs['default'])
    
    def visualize_extraction(self, image: np.ndarray, sections: List[Dict], save_path: str):
        """
        Create visualization with section overlays
        """
        vis_image = image.copy()
        
        # Define colors for each section
        colors = [
            (255, 0, 0), (0, 255, 0), (0, 0, 255), 
            (255, 255, 0), (255, 0, 255), (0, 255, 255),
            (128, 0, 128), (255, 128, 0), (0, 128, 255)
        ]
        
        for i, section in enumerate(sections):
            x, y, w, h = section['bbox']
            color = colors[i % len(colors)]
            
            # Draw rectangle
            cv2.rectangle(vis_image, (x, y), (x+w, y+h), color, 2)
            
            # Add label
            label = f"{i+1}. {section['id']}"
            cv2.putText(vis_image, label, (x, y-5), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
        cv2.imwrite(save_path, vis_image)
        print(f"✓ Visualization saved: {save_path}")
    
    def process_document(self, input_path: str, output_dir: str) -> Dict:
        """
        Main processing pipeline with improved extraction
        """
        print(f"🚀 Processing document: {input_path}")
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Load image
        image = cv2.imread(input_path)
        if image is None:
            raise ValueError(f"Could not load image: {input_path}")
        
        print(f"✓ Image loaded: {image.shape[1]}x{image.shape[0]}")
        
        # Align document
        aligned, success = self.align_document(image)
        
        # Extract sections with corrected coordinates
        sections = self.extract_sections_accurate(aligned)
        
        # Perform OCR
        sections = self.perform_ocr_enhanced(sections)
        
        # Save aligned image
        aligned_path = os.path.join(output_dir, "aligned.jpg")
        cv2.imwrite(aligned_path, aligned)
        
        # Save individual sections
        for section in sections:
            # Save section image
            section_path = os.path.join(output_dir, f"{section['id']}.jpg")
            cv2.imwrite(section_path, section['image'])
            
            # Save OCR text
            text_path = os.path.join(output_dir, f"{section['id']}.txt")
            with open(text_path, 'w', encoding='utf-8') as f:
                f.write(section['ocr_text'])
        
        # Create visualization
        vis_path = os.path.join(output_dir, "visualization.jpg")
        self.visualize_extraction(aligned, sections, vis_path)
        
        # Create summary
        summary = {
            'input': input_path,
            'alignment_success': success,
            'sections_extracted': len(sections),
            'output_directory': output_dir,
            'sections': [
                {
                    'id': s['id'],
                    'description': s['description'],
                    'has_text': s['has_text'],
                    'text_length': s['ocr_length']
                }
                for s in sections
            ]
        }
        
        # Save summary
        summary_path = os.path.join(output_dir, "summary.json")
        with open(summary_path, 'w') as f:
            json.dump(summary, f, indent=2)
        
        print(f"✅ Processing complete! Results in: {output_dir}")
        return summary

def main():
    """
    Main function to process the document
    """
    # Configuration
    INPUT_FILE = "../sample_input/doc1.jpg"  # Update path as needed
    OUTPUT_DIR = "extracted_sections_03"
    
    # Create extractor with original dimensions (better for accuracy)
    extractor = ImprovedDocumentExtractor(use_original_dimensions=True)
    
    try:
        # Process document
        results = extractor.process_document(INPUT_FILE, OUTPUT_DIR)
        
        print("\n📊 RESULTS SUMMARY:")
        print(f"Sections extracted: {results['sections_extracted']}")
        for section in results['sections']:
            status = "✓" if section['has_text'] else "✗"
            print(f"  {status} {section['id']}: {section['text_length']} chars")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()