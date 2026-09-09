import os
import sys
import json
import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sixth_sense.perception.road_damage_detector import RoadDamageDetector
from sixth_sense.schemas.urban_event import EventType
from sixth_sense.events.severity_scorer import SeverityScorer

def main():
    target_images = [
        "India_008899.jpg",  # POTHOLE (D40)
        "India_007941.jpg",  # ROAD_CRACK (D00, D20)
        "India_001950.jpg",  # ROAD_CRACK (D20)
    ]
    
    base_in_dir = "outputs/road_damage_validation/01_rdd2022_samples"
    out_dir = "outputs/presentation_demo"
    os.makedirs(out_dir, exist_ok=True)
    out_json_path = os.path.join(out_dir, "demo_result.json")
    
    print("Loading underlying YOLO12s model...")
    yolo_model = YOLO("models/yolo12s_RDD2022_best.pt")
    yolo_model.to("cuda")
    
    print("Initializing RoadDamageDetector...")
    detector = RoadDamageDetector(
        model=yolo_model,
        conf_threshold=0.15,
        device="cuda"
    )
    
    scorer = SeverityScorer()
    all_demo_results = {}
    
    for img_name in target_images:
        image_path = os.path.join(base_in_dir, img_name)
        out_image_path = os.path.join(out_dir, f"{img_name.split('.')[0]}_annotated_demo.jpg")
        
        print(f"\n--- Processing: {img_name} ---")
        img_bgr = cv2.imread(image_path)
        if img_bgr is None:
            print(f"ERROR: Could not read image at {image_path}")
            continue
        
        h, w = img_bgr.shape[:2]
        
        detections = detector.detect(
            frame=img_bgr, 
            frame_idx=1, 
            timestamp=0.0, 
            quality=None, 
            gps=None
        )
        print(f"Found {len(detections)} detections.")
        
        ann_img = img_bgr.copy()
        
        # Add a subtle dark gradient/rectangle at the bottom for text readability
        overlay = ann_img.copy()
        cv2.rectangle(overlay, (0, h - 80), (w, h), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.6, ann_img, 0.4, 0, ann_img)
        
        # Overlay Texts
        cv2.putText(ann_img, f"IMAGE: {img_name}", (15, h - 50), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
        cv2.putText(ann_img, "LOCATION: Dataset Image / GPS Unavailable", (15, h - 20), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 100, 255), 2)
        
        img_results = []
        for det in detections:
            severity = scorer.score(
                event_type=det.event_type,
                relative_area=det.relative_area,
                detection_count=1,
                confidence=det.confidence
            )
            
            x1, y1, x2, y2 = det.bbox
            
            label_text = f"{det.event_type.name} / {det.class_name} ({det.confidence:.2f})"
            
            # Potholes are Red, Cracks are Yellow
            color = (0, 0, 255) if det.event_type == EventType.POTHOLE else (0, 220, 255)
            cv2.rectangle(ann_img, (x1, y1), (x2, y2), color, 3)
            
            (tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
            
            # Ensure text box doesn't go off right side of image
            if x1 + tw + 4 > w:
                x1 = max(0, w - tw - 4)
                
            # Ensure text box doesn't go off top of image
            text_y = y1 - 10 if y1 - 10 > th else y1 + th + 10
            
            cv2.rectangle(ann_img, (x1, text_y - th - 5), (x1 + tw + 4, text_y + 5), color, -1)
            
            # Use black text on yellow, white on red for contrast
            text_color = (0, 0, 0) if color == (0, 220, 255) else (255, 255, 255)
            cv2.putText(ann_img, label_text, (x1 + 2, text_y), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, text_color, 2)
            
            img_results.append({
                "event_type": det.event_type.name,
                "raw_class": det.class_name,
                "confidence": round(det.confidence, 4),
                "bbox": det.bbox,
                "severity": severity.name,
                "location": "dataset image / GPS unavailable"
            })
            print(f" -> {det.event_type.name} ({det.class_name}) | Conf: {det.confidence:.2f} | Sev: {severity.name}")
            
        cv2.imwrite(out_image_path, ann_img)
        print(f"Saved: {out_image_path}")
        all_demo_results[img_name] = img_results
        
    with open(out_json_path, 'w') as f:
        json.dump({
            "model": "models/yolo12s_RDD2022_best.pt",
            "results": all_demo_results
        }, f, indent=2)
    print(f"\nSaved metadata to: {out_json_path}")
    
if __name__ == "__main__":
    main()
