import os
import random
import shutil
import yaml
import xml.etree.ElementTree as ET
import cv2
import matplotlib.pyplot as plt
import numpy as np
import torch
from pathlib import Path
from ultralytics import YOLO
from sklearn.model_selection import train_test_split
from matplotlib import patches


def print_system_info():
    """Print PyTorch and CUDA information."""
    print(f"PyTorch version: {torch.__version__}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    print(f"CUDA Device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'No GPU'}")


def setup_directories():
    """Setup working directories for YOLO training."""
    # Directory setup
    images_dir = r"D:\OCR\ongc_doc\dummy_images"
    annotations_file = r"D:\OCR\ongc_doc\annotations.xml"
    
    # Create working directories
    work_dir = r"D:\OCR\ongc_doc\yolo_document"
    os.makedirs(work_dir, exist_ok=True)
    os.chdir(work_dir)
    
    # Make dataset folders for YOLO
    for folder in ['dataset/images/train', 'dataset/images/val', 'dataset/labels/train', 'dataset/labels/val']:
        os.makedirs(folder, exist_ok=True)
    
    return images_dir, annotations_file, work_dir


class VOCToYOLOSegmentationConverter:
    """Converter class to transform VOC annotations to YOLO segmentation format."""
    
    def __init__(self, images_dir, annotations_file, output_dir):
        self.images_dir = images_dir
        self.annotations_file = annotations_file
        self.output_dir = output_dir
        self.class_names = ['title', 'header', 'table_1', 'table_2', 'footer']
        self.class_to_id = {name: idx for idx, name in enumerate(self.class_names)}

    def parse_points(self, points_str):
        """Parse points string into coordinate tuples."""
        points = []
        coords = points_str.split(';')
        for coord in coords:
            if ',' in coord:
                x, y = coord.split(',')
                points.append((float(x), float(y)))
        return points

    def box_to_polygon(self, box_elem):
        """Convert bounding box to polygon coordinates."""
        try:
            xtl = float(box_elem.get('xtl'))
            ytl = float(box_elem.get('ytl'))
            xbr = float(box_elem.get('xbr'))
            ybr = float(box_elem.get('ybr'))
            return [(xtl, ytl), (xbr, ytl), (xbr, ybr), (xtl, ybr)]
        except Exception as e:
            print(f"Error parsing box: {e}")
            return []

    def parse_xml_annotation(self):
        """Parse XML annotation file and extract image annotations."""
        tree = ET.parse(self.annotations_file)
        root = tree.getroot()
        annotations = {}

        for image_elem in root.findall('image'):
            image_name = image_elem.get('name')
            width = int(float(image_elem.get('width', 0)))
            height = int(float(image_elem.get('height', 0)))
            image_annotations = []

            # Parse polygons (likely zero as per your output)
            for polygon in image_elem.findall('polygon'):
                label = polygon.get('label')
                if label in self.class_names:
                    points_str = polygon.get('points')
                    points = self.parse_points(points_str)
                    if len(points) >= 3:
                        image_annotations.append({
                            'class': label,
                            'points': points,
                            'width': width,
                            'height': height
                        })

            # Parse bounding boxes (likely present)
            for box in image_elem.findall('box'):
                label = box.get('label')
                if label in self.class_names:
                    points = self.box_to_polygon(box)
                    if len(points) == 4:
                        image_annotations.append({
                            'class': label,
                            'points': points,
                            'width': width,
                            'height': height
                        })

            if image_annotations:
                annotations[image_name] = image_annotations

        return annotations

    def convert_to_yolo(self, points, w, h):
        """Convert polygon points to YOLO format (normalized coordinates)."""
        yolo_points = []
        for x, y in points:
            yolo_points.extend([x / w, y / h])
        return yolo_points

    def convert_annotations(self):
        """Convert all annotations to YOLO format."""
        annotations = self.parse_xml_annotation()
        label_dir = os.path.join(self.output_dir, 'labels')
        os.makedirs(label_dir, exist_ok=True)
        converted = 0

        for image_name, anns in annotations.items():
            for ext in ['.jpg', '.jpeg', '.png']:
                img_path = os.path.join(self.images_dir, image_name)
                if not img_path.lower().endswith(ext):
                    img_path = os.path.join(self.images_dir, os.path.splitext(image_name)[0] + ext)
                if os.path.exists(img_path):
                    break
            else:
                print(f"Warning: Image file for {image_name} not found, skipped.")
                continue

            label_path = os.path.join(label_dir, os.path.splitext(image_name)[0] + '.txt')
            with open(label_path, 'w') as f:
                for ann in anns:
                    class_id = self.class_to_id[ann['class']]
                    yolo_poly = self.convert_to_yolo(ann['points'], ann['width'], ann['height'])
                    if len(yolo_poly) >= 6:
                        line = f"{class_id} " + " ".join(f'{p:.6f}' for p in yolo_poly) + "\n"
                        f.write(line)
            converted += 1

        print(f"Converted annotations for {converted} images.")
        return converted


def prepare_dataset(images_dir, labels_dir, train_ratio=0.8):
    """Prepare dataset by splitting into train and validation sets."""
    image_files = []
    for ext in ['*.jpg', '*.jpeg', '*.png']:
        image_files.extend(Path(images_dir).glob(ext))
    
    valid_images = []
    for img in image_files:
        if (Path(labels_dir) / f"{img.stem}.txt").exists():
            valid_images.append(img)

    train_imgs, val_imgs = train_test_split(valid_images, train_size=train_ratio, random_state=42)

    # Clear folders if exist (optional)
    for folder in ['dataset/images/train', 'dataset/images/val', 'dataset/labels/train', 'dataset/labels/val']:
        Path(folder).mkdir(parents=True, exist_ok=True)

    for img in train_imgs:
        shutil.copy2(img, 'dataset/images/train/')
        shutil.copy2(f"{Path(labels_dir) / (img.stem + '.txt')}", 'dataset/labels/train/')

    for img in val_imgs:
        shutil.copy2(img, 'dataset/images/val/')
        shutil.copy2(f"{Path(labels_dir) / (img.stem + '.txt')}", 'dataset/labels/val/')

    print(f"Dataset prepared: {len(train_imgs)} train images, {len(val_imgs)} val images")


def create_yaml_config(work_dir, class_names):
    """Create YAML configuration file for YOLOv8."""
    data_yaml = {
        'path': os.path.join(work_dir, 'dataset'),
        'train': 'images/train',
        'val': 'images/val',
        'nc': 5,
        'names': class_names
    }

    with open('dataset/data.yaml', 'w') as f:
        yaml.dump(data_yaml, f, sort_keys=False)

    print("YAML file created:")
    print(data_yaml)
    return data_yaml


def setup_training_environment():
    """Setup training environment and clear CUDA cache."""
    # Set environment variable to reduce fragmentation
    os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'expandable_segments:True'
    
    # Clear CUDA cache to free up memory before training
    torch.cuda.empty_cache()


def get_training_parameters():
    """Get training parameters for YOLOv8 model."""
    training_params = {
        # Dataset
        'data': 'dataset/data.yaml',
        'epochs': 150,
        'imgsz': 1024,
        'batch': 8,  
        'device': 0 if torch.cuda.is_available() else 'cpu',
        'project': 'runs/segment',
        'name': 'doc_layout_yolov8m_best',
        'save': True,
        'save_period': 10,  
        'cache': False,
        'amp': True,
        'optimizer': 'AdamW',  
        'lr0': 0.001,          
        'lrf': 0.01,          
        'momentum': 0.937,
        'weight_decay': 0.0005,
        'warmup_epochs': 3,   
        'warmup_momentum': 0.8,
        'warmup_bias_lr': 0.1,
        'box': 7.5,
        'cls': 0.5,
        'dfl': 1.5,
        'hsv_h': 0.015,
        'hsv_s': 0.4,
        'hsv_v': 0.4,
        'degrees': 5.0,       
        'translate': 0.2,
        'scale': 0.9,
        'shear': 2.0,
        'perspective': 0.0005,
        'fliplr': 0.5,        
        'flipud': 0.0,       
        'mosaic': 0.8,       
        'mixup': 0.1,
        'copy_paste': 0.3,
        'patience': 50,
        'close_mosaic': 20,   
        'val': True,
        'plots': True,
        'save_json': True,
        'conf': 0.25,
        'iou': 0.6,
        'max_det': 300,
        'workers': 0,
        'seed': 42,
        'deterministic': True,
        'single_cls': False,
        'nbs': 64,
    }
    return training_params


def train_model():
    """Train the YOLOv8 segmentation model."""
    print("🚀 Starting YOLOv8 segmentation model training...")
    
    # Load YOLOv8 medium segmentation model
    model = YOLO('yolov8m-seg.pt')
    
    training_params = get_training_parameters()
    results = model.train(**training_params)
    
    print("✅ Training completed!")
    print(f"Model weights and logs are saved in: {results.save_dir}")
    
    return model


def predict_and_visualize(model, image_path):
    """
    Run prediction on an image using the YOLOv8 segmentation model and visualize results.
    """
    # Run prediction (confidence threshold 0.25)
    results = model(image_path, conf=0.25)
    result = results[0]

    # Load image and convert BGR to RGB for plotting
    img = cv2.imread(str(image_path))
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    # Create figure with 2 subplots side-by-side
    fig, axes = plt.subplots(1, 2, figsize=(20, 10))

    # Show original image on first subplot
    axes[0].imshow(img_rgb)
    axes.set_title("Original Image")
    axes.axis('off')

    # Show image again on second subplot for overlaying predictions
    axes.imshow(img_rgb)
    axes.set_title("Segmentation Results")
    axes.axis('off')

    colors = ['red', 'green', 'blue', 'yellow', 'magenta', 'cyan', 'orange']

    # Extract detection results: masks, boxes, classes, confidences
    if result.masks is not None:
        masks = result.masks.data.cpu().numpy()
    else:
        masks = []

    boxes = result.boxes.xyxy.cpu().numpy() if result.boxes is not None else []
    classes = result.boxes.cls.cpu().numpy().astype(int) if result.boxes is not None else []
    confidences = result.boxes.conf.cpu().numpy() if result.boxes is not None else []

    # Overlay masks, bounding boxes, and labels
    for mask, box, cls, conf in zip(masks, boxes, classes, confidences):
        # Resize mask to original image size (width, height)
        mask_resized = cv2.resize(mask, (img.shape[1], img.shape))
        mask_bin = (mask_resized > 0.5).astype(np.uint8)

        # Find contours for the mask polygon
        contours, _ = cv2.findContours(mask_bin, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for contour in contours:
            if len(contour) > 2:
                polygon = contour.reshape(-1, 2)
                axes[1].plot(polygon[:, 0], polygon[:, 1], 'o-', 
                             color=colors[cls % len(colors)], linewidth=2, markersize=2)
                axes[1].fill(polygon[:, 0], polygon[:, 1], 
                             color=colors[cls % len(colors)], alpha=0.3)

        # Draw bounding box
        x1, y1, x2, y2 = box
        rect = patches.Rectangle((x1, y1), x2 - x1, y2 - y1,
                                 linewidth=2, edgecolor=colors[cls % len(colors)], facecolor='none')
        axes[1].add_patch(rect)

        # Add label and confidence
        axes.text(x1, y1 - 10, f"{cls}: {conf:.2f}",
                     bbox=dict(facecolor='white', alpha=0.7),
                     fontsize=12,
                     color=colors[cls % len(colors)])

    plt.show()


def run_validation_predictions(model):
    """Run predictions on validation images."""
    val_images = list(Path('dataset/images/val').glob('*'))[:3]
    for img_path in val_images:
        print(f"Predicting: {img_path.name}")
        predict_and_visualize(model, img_path)


def main():
    """Main function to run the complete training pipeline."""
    # Print system information
    print_system_info()
    
    # Setup directories
    images_dir, annotations_file, work_dir = setup_directories()
    
    # Convert annotations
    converter = VOCToYOLOSegmentationConverter(images_dir, annotations_file, 'dataset')
    converted_count = converter.convert_annotations()
    print(f"Annotation conversion done. {converted_count} label files created.")
    
    # Prepare dataset
    prepare_dataset(images_dir, 'dataset/labels')
    
    # Create YAML configuration
    create_yaml_config(work_dir, converter.class_names)
    
    # Setup training environment
    setup_training_environment()
    
    # Train model
    model = train_model()
    
    # Run validation predictions
    run_validation_predictions(model)


if __name__ == "__main__":
    main()
