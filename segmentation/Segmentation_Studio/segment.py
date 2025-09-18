import argparse
import json
import sys
import cv2
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from ultralytics import YOLO
import os

# Suppress YOLO verbose output
os.environ['YOLO_VERBOSE'] = 'False'

# ----------------- Predefined Colors -----------------
CLASS_COLORS = {
    "title": (255, 0, 0),
    "header_1": (0, 165, 255),
    "header_2": (0, 200, 255),
    "table_1": (0, 0, 255),
    "table_2": (255, 0, 255),
    "footer_1": (0, 255, 0),
    "footer_2": (0, 255, 128),
    "footer_3": (0, 128, 255),
    "footer_4": (128, 0, 255),
    "footer_5": (128, 128, 255),
    "footer_6": (128, 255, 0),
    "footer_7": (255, 128, 0)
}

def get_color_for_class(class_name: str):
    return CLASS_COLORS.get(class_name, (255, 255, 255))

def draw_segmentation_preview(image_path, results, output_path, confidence_threshold=0.1):
    """Draw boxes + labels on preview image"""
    image = cv2.imread(str(image_path))
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    pil_image = Image.fromarray(image_rgb)
    draw = ImageDraw.Draw(pil_image)

    try:
        font = ImageFont.truetype("arial.ttf", 20)
    except:
        font = ImageFont.load_default()

    detected_objects = []

    for r in results:
        if not hasattr(r, "boxes") or r.boxes is None:
            continue
        for box in r.boxes:
            conf = float(box.conf[0].item())
            if conf < confidence_threshold:
                continue

            cls_id = int(box.cls[0].item())
            label = r.names[cls_id]
            xyxy = box.xyxy[0].cpu().numpy().astype(int)

            color = get_color_for_class(label)

            # Draw box
            draw.rectangle([(xyxy[0], xyxy[1]), (xyxy[2], xyxy[3])],
                           outline=color, width=3)

            # Draw label
            text = f""
            bbox = draw.textbbox((xyxy[0], xyxy[1] - 25), text, font=font)
            draw.rectangle(bbox, fill=color)
            draw.text((xyxy[0], xyxy[1] - 25), text, fill="white", font=font)

            detected_objects.append({
                "label": label,
                "confidence": conf,
                "bbox": xyxy.tolist()
            })

    pil_image.save(str(output_path), "JPEG", quality=90)
    return detected_objects

def segment_image(model_path, image_path, output_dir, confidence_threshold=0.1, generate_preview=True, url_prefix="/segments/"):
    try:
        model = YOLO(str(model_path), verbose=False)
        results = model(str(image_path), conf=confidence_threshold, verbose=False)

        Path(output_dir).mkdir(parents=True, exist_ok=True)

        preview_path = None
        detected_objects = []
        segments = []

        # ----------------- Preview -----------------
        if generate_preview and results:
            preview_filename = f"preview_{Path(image_path).stem}.jpg"
            preview_path = Path(output_dir) / preview_filename
            detected_objects = draw_segmentation_preview(image_path, results, preview_path)

        # ----------------- Segments -----------------
        img = cv2.imread(str(image_path))
        for i, r in enumerate(results):
            if not hasattr(r, "boxes") or r.boxes is None:
                continue

            for j, box in enumerate(r.boxes):
                conf = float(box.conf[0].item())
                if conf < confidence_threshold:
                    continue

                cls_id = int(box.cls[0].item())
                label = r.names[cls_id]
                xyxy = box.xyxy[0].cpu().numpy().astype(int)

                print(f"➡️ Detected {label} ({conf:.2f}) at {xyxy.tolist()} "
                      f"| Mask: {'Yes' if r.masks is not None else 'No'}", file=sys.stderr)

                if xyxy[2] <= xyxy[0] or xyxy[3] <= xyxy[1]:
                    continue

                if r.masks is not None and len(r.masks.data) > j:
                    mask = r.masks.data[j].cpu().numpy().astype("uint8") * 255
                    mask_resized = cv2.resize(mask, (img.shape[1], img.shape[0]))
                    segmented = cv2.bitwise_and(img, img, mask=mask_resized)
                    cropped = segmented[xyxy[1]:xyxy[3], xyxy[0]:xyxy[2]]
                else:
                    cropped = img[xyxy[1]:xyxy[3], xyxy[0]:xyxy[2]]

                if cropped.size == 0:
                    continue

                segment_filename = f"{label}_{i}_{j}_{conf:.2f}.jpg"
                segment_path = Path(output_dir) / segment_filename
                cv2.imwrite(str(segment_path), cropped)

                segments.append({
                    "id": f"{label}_{i}_{j}",
                    "label": label,
                    "confidence": conf,
                    "bbox": xyxy.tolist(),
                    # ✅ return relative URL, not full path
                    "url": f"{url_prefix}{segment_filename}",
                    "filename": segment_filename
                })

        return {
            "segments": segments,
            "preview": {
                "url": f"{url_prefix}{preview_path.name}" if preview_path else None,
                "filename": preview_path.name if preview_path else None,
                "detected_objects": detected_objects
            }
        }

    except Exception as e:
        print(f"❌ Error: {str(e)}", file=sys.stderr)
        return {
            "segments": [],
            "preview": {
                "url": None,
                "filename": None,
                "detected_objects": []
            }
        }

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="Path to YOLOv8 model (.pt)")
    parser.add_argument("--image", required=True, help="Path to input image")
    parser.add_argument("--output", default="output", help="Directory to save results")
    parser.add_argument("--no-preview", action="store_true", help="Skip preview")
    args = parser.parse_args()

    Path(args.output).mkdir(parents=True, exist_ok=True)
    result = segment_image(
        args.model,
        args.image,
        args.output,
        generate_preview=not args.no_preview
    )

    # ✅ Clean JSON only
    print(json.dumps(result, indent=2))
