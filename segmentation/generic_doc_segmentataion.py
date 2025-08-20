import cv2
import numpy as np
from PIL import Image
import json
import os
from typing import List, Dict, Tuple
import matplotlib.pyplot as plt
import pytesseract


# Windows-specific Tesseract path fix
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Test if it works
try:
    version = pytesseract.get_tesseract_version()
    print(f"✓ Tesseract working: {version}")
except:
    print("✗ Still not working - try alternative path")
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe'


# Make matplotlib optional
try:
    import matplotlib.pyplot as plt
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False
    print("Warning: matplotlib not available. Visualization functions will be disabled.")

class DocumentSegmentationSystem:
    """
    A comprehensive document segmentation system for operational logs and forms.
    Supports template-based, contour-based, and table detection methods.
    """
    
    def __init__(self, config_path: str = None):
        self.config = self.load_config(config_path) if config_path else self.default_config()
        self.templates = {}
        
    def default_config(self) -> Dict:
        """Default configuration for the segmentation system."""
        return {
            'preprocessing': {
                'denoise': True,
                'enhance_contrast': True,
                'binarize': True
            },
            'detection': {
                'min_contour_area': 1000,
                'table_min_width': 100,
                'table_min_height': 50,
                'line_thickness_threshold': 2
            },
            'ocr': {
                'engine': 'tesseract',
                'config': '--psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,-:/ '
            }
        }
    
    def load_config(self, config_path: str) -> Dict:
        """Load configuration from JSON file."""
        with open(config_path, 'r') as f:
            return json.load(f)
    
    def preprocess_image(self, image_path: str) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Preprocess the input image for better segmentation results.
        
        Returns:
            tuple: (binary_image, enhanced_image, original_image)
        """
        # Load image
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Could not load image from {image_path}")
        
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Optional denoising
        if self.config['preprocessing']['denoise']:
            denoised = cv2.fastNlMeansDenoising(gray)
        else:
            denoised = gray
        
        # Optional contrast enhancement
        if self.config['preprocessing']['enhance_contrast']:
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
            enhanced = clahe.apply(denoised)
        else:
            enhanced = denoised
        
        # Optional binarization
        if self.config['preprocessing']['binarize']:
            _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        else:
            binary = enhanced
        
        return binary, enhanced, img
    
    def detect_tables(self, binary_image: np.ndarray) -> List[Dict]:
        """
        Detect table structures in the image using morphological operations.
        """
        # Create kernels for line detection
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
        vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
        
        # Detect horizontal and vertical lines
        horizontal_lines = cv2.morphologyEx(binary_image, cv2.MORPH_OPEN, horizontal_kernel)
        vertical_lines = cv2.morphologyEx(binary_image, cv2.MORPH_OPEN, vertical_kernel)
        
        # Combine lines
        table_mask = cv2.add(horizontal_lines, vertical_lines)
        
        # Find contours of table structures
        contours, _ = cv2.findContours(table_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        tables = []
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            if (w > self.config['detection']['table_min_width'] and 
                h > self.config['detection']['table_min_height']):
                tables.append({
                    'type': 'table',
                    'bbox': (x, y, w, h),
                    'area': w * h,
                    'confidence': 0.8
                })
        
        return tables
    
    def detect_text_regions(self, binary_image: np.ndarray) -> List[Dict]:
        """
        Detect text regions using contour analysis.
        """
        # Find contours
        contours, hierarchy = cv2.findContours(binary_image, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        text_regions = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > self.config['detection']['min_contour_area']:
                x, y, w, h = cv2.boundingRect(contour)
                
                # Filter based on aspect ratio (typical for text regions)
                aspect_ratio = w / h if h > 0 else 0
                if 0.1 < aspect_ratio < 20:  # Reasonable aspect ratio for text
                    text_regions.append({
                        'type': 'text_region',
                        'bbox': (x, y, w, h),
                        'area': area,
                        'aspect_ratio': aspect_ratio,
                        'confidence': 0.6
                    })
        
        return text_regions
    
    def detect_form_fields(self, binary_image: np.ndarray) -> List[Dict]:
        """
        Detect form fields and input areas.
        """
        # Detect rectangular regions that might be form fields
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        closed = cv2.morphologyEx(binary_image, cv2.MORPH_CLOSE, kernel)
        
        # Find contours
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        form_fields = []
        for contour in contours:
            # Approximate contour to polygon
            epsilon = 0.02 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)
            
            # If it's roughly rectangular (4 corners)
            if len(approx) == 4:
                x, y, w, h = cv2.boundingRect(contour)
                area = w * h
                
                # Filter by size and aspect ratio
                if 100 < area < 10000 and 0.2 < w/h < 10:
                    form_fields.append({
                        'type': 'form_field',
                        'bbox': (x, y, w, h),
                        'area': area,
                        'confidence': 0.7
                    })
        
        return form_fields
    
    def create_template(self, image_path: str, template_name: str, manual_regions: List[Dict]) -> None:
        """
        Create a template for consistent document layouts.
        
        Args:
            image_path: Path to template image
            template_name: Name for the template
            manual_regions: List of manually defined regions with types and bboxes
        """
        self.templates[template_name] = {
            'image_path': image_path,
            'regions': manual_regions
        }
    
    def apply_template(self, image: np.ndarray, template_name: str) -> List[Dict]:
        """
        Apply a predefined template to extract sections.
        """
        if template_name not in self.templates:
            return []
        
        template = self.templates[template_name]
        sections = []
        
        for region in template['regions']:
            sections.append({
                'type': region['type'],
                'bbox': region['bbox'],
                'confidence': 0.9,
                'source': 'template'
            })
        
        return sections
    
    def remove_overlapping_sections(self, sections: List[Dict], overlap_threshold: float = 0.5) -> List[Dict]:
        """
        Remove overlapping sections, keeping the one with higher confidence.
        """
        def calculate_iou(box1, box2):
            x1, y1, w1, h1 = box1
            x2, y2, w2, h2 = box2
            
            # Calculate intersection
            left = max(x1, x2)
            top = max(y1, y2)
            right = min(x1 + w1, x2 + w2)
            bottom = min(y1 + h1, y2 + h2)
            
            if left < right and top < bottom:
                intersection = (right - left) * (bottom - top)
                union = w1 * h1 + w2 * h2 - intersection
                return intersection / union if union > 0 else 0
            return 0
        
        # Sort by confidence
        sections.sort(key=lambda x: x.get('confidence', 0), reverse=True)
        
        filtered_sections = []
        for section in sections:
            is_overlapping = False
            for existing in filtered_sections:
                if calculate_iou(section['bbox'], existing['bbox']) > overlap_threshold:
                    is_overlapping = True
                    break
            
            if not is_overlapping:
                filtered_sections.append(section)
        
        return filtered_sections
    
    def extract_section_images(self, original_image: np.ndarray, sections: List[Dict]) -> List[Dict]:
        """
        Extract individual section images for OCR processing.
        """
        extracted_sections = []
        
        for i, section in enumerate(sections):
            x, y, w, h = section['bbox']
            
            # Ensure coordinates are within image bounds
            x = max(0, x)
            y = max(0, y)
            w = min(w, original_image.shape[1] - x)
            h = min(h, original_image.shape[0] - y)
            
            # Extract section image
            section_img = original_image[y:y+h, x:x+w]
            
            extracted_sections.append({
                'id': f"section_{i}",
                'type': section['type'],
                'bbox': (x, y, w, h),
                'image': section_img,
                'confidence': section.get('confidence', 0.5),
                'ready_for_ocr': True
            })
        
        return extracted_sections
    
    def perform_ocr(self, section_image: np.ndarray) -> str:
        """
        Perform OCR on a section image.
        """
        try:
            # Convert to PIL Image if needed
            if isinstance(section_image, np.ndarray):
                if len(section_image.shape) == 3:
                    section_image = cv2.cvtColor(section_image, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(section_image)
            else:
                pil_image = section_image
            
            # Perform OCR
            text = pytesseract.image_to_string(pil_image, config=self.config['ocr']['config'])
            return text.strip()
        
        except Exception as e:
            print(f"OCR failed: {e}")
            return ""
    
    def process_document(self, image_path: str, template_name: str = None) -> Dict:
        """
        Main processing pipeline for document segmentation.
        
        Args:
            image_path: Path to the document image
            template_name: Optional template to apply
            
        Returns:
            Dictionary containing all extracted sections and their OCR results
        """
        # Preprocess image
        binary, enhanced, original = self.preprocess_image(image_path)
        
        # Detect sections using multiple methods
        all_sections = []
        
        # Method 1: Apply template if available
        if template_name and template_name in self.templates:
            template_sections = self.apply_template(enhanced, template_name)
            all_sections.extend(template_sections)
        
        # Method 2: Detect tables
        table_sections = self.detect_tables(binary)
        all_sections.extend(table_sections)
        
        # Method 3: Detect text regions
        text_sections = self.detect_text_regions(binary)
        all_sections.extend(text_sections)
        
        # Method 4: Detect form fields
        form_sections = self.detect_form_fields(binary)
        all_sections.extend(form_sections)
        
        # Remove overlapping sections
        filtered_sections = self.remove_overlapping_sections(all_sections)
        
        # Extract section images
        extracted_sections = self.extract_section_images(original, filtered_sections)
        
        # Perform OCR on each section
        for section in extracted_sections:
            section['ocr_text'] = self.perform_ocr(section['image'])
            section['ocr_confidence'] = len(section['ocr_text']) > 0  # Simple confidence metric
        
        return {
            'image_path': image_path,
            'total_sections': len(extracted_sections),
            'sections': extracted_sections,
            'processing_methods': ['template', 'table_detection', 'text_regions', 'form_fields']
        }
    
    def visualize_results(self, image_path: str, results: Dict, output_path: str = None):
        """
        Visualize the segmentation results.
        """
        if not MATPLOTLIB_AVAILABLE:
            print("Visualization not available - matplotlib not installed")
            print("Install matplotlib with: pip install matplotlib>=3.3.0")
            return

        # Load original image
        img = cv2.imread(image_path)
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Create figure
        fig, ax = plt.subplots(1, 1, figsize=(15, 10))
        ax.imshow(img_rgb)
        
        # Draw bounding boxes for each section
        colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'cyan', 'magenta']
        
        for i, section in enumerate(results['sections']):
            x, y, w, h = section['bbox']
            color = colors[i % len(colors)]
            
            # Draw rectangle
            rect = plt.Rectangle((x, y), w, h, linewidth=2, edgecolor=color, facecolor='none')
            ax.add_patch(rect)
            
            # Add label
            ax.text(x, y-5, f"{section['type']} ({section['id']})", 
                   color=color, fontsize=10, fontweight='bold')
        
        ax.set_title(f"Document Segmentation Results - {len(results['sections'])} sections found")
        ax.axis('off')
        
        if output_path:
            plt.savefig(output_path, dpi=300, bbox_inches='tight')
        else:
            plt.show()
        
        plt.close()
    
    def save_extracted_sections(self, results: Dict, output_dir: str):
        """
        Save extracted section images and OCR results.
        """
        os.makedirs(output_dir, exist_ok=True)
        
        # Save section images
        for section in results['sections']:
            # Save image
            img_path = os.path.join(output_dir, f"{section['id']}.png")
            cv2.imwrite(img_path, section['image'])
            
            # Save OCR text
            txt_path = os.path.join(output_dir, f"{section['id']}.txt")
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(section['ocr_text'])
        
        # Save summary
        summary_path = os.path.join(output_dir, 'summary.json')
        summary_data = {
            'total_sections': results['total_sections'],
            'sections': [
                {
                    'id': s['id'],
                    'type': s['type'],
                    'bbox': s['bbox'],
                    'confidence': s['confidence'],
                    'ocr_text_length': len(s['ocr_text'])
                }
                for s in results['sections']
            ]
        }
        
        with open(summary_path, 'w') as f:
            json.dump(summary_data, f, indent=2)

# Example usage and demonstration
def main():
    """
    Example usage of the DocumentSegmentationSystem
    """
    # Initialize the system
    segmentation_system = DocumentSegmentationSystem()
    
    # Example: Create a template for operational logs (like your images)
    operational_log_template = [
        {'type': 'header', 'bbox': (0, 0, 1200, 100)},
        {'type': 'main_data_table', 'bbox': (50, 150, 1100, 500)},
        {'type': 'petroleum_status', 'bbox': (50, 700, 400, 150)},
        {'type': 'remarks_section', 'bbox': (500, 700, 600, 150)},
        {'type': 'signatures', 'bbox': (50, 900, 1100, 100)}
    ]
    
    segmentation_system.create_template(
        image_path="sample_operational_log.jpg",
        template_name="operational_log",
        manual_regions=operational_log_template
    )
    
    # Process a document
    image_path = "../sample_input/doc1.jpg"  # Replace with your image path
    
    try:
        # Process the document
        results = segmentation_system.process_document(
            image_path=image_path,
            template_name="operational_log"  # Optional: use template
        )
        
        # Print results summary
        print(f"Found {results['total_sections']} sections:")
        for section in results['sections']:
            print(f"- {section['id']}: {section['type']} (confidence: {section['confidence']:.2f})")
            print(f"  OCR text preview: {section['ocr_text'][:100]}...")
            print()
        
        # Visualize results
        segmentation_system.visualize_results(image_path, results, "segmentation_results_01.png")
        
        # Save extracted sections
        segmentation_system.save_extracted_sections(results, "extracted_sections_01/")
        
        print("Processing complete! Check the output files.")
        
    except Exception as e:
        print(f"Error processing document: {e}")

if __name__ == "__main__":
    main()