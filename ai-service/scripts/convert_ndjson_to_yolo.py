"""
PipeBot NDJSON to Standard YOLO Dataset Conversion Script
Follows Rules/PipeBot_Build_Rulebook.md § 13.1, 13.2, 13.3, 13.4
Stage 4 Prompt 3.1: Correct empty-label handling and final dataset integrity

Converts downloaded source images and NDJSON annotations into standard YOLO format:
- Classes: 0: Deformation, 1: Misalignment, 2: Obstacle, 3: Rupture
- Filters out exactly the confirmed invalid bounding boxes (zero-width or zero-height)
- Images with >= 1 valid box are retained in their original split
- Images with 0 valid boxes are EXCLUDED from YOLO images/labels and logged to annotation_review_required.json
- ZERO empty label files are generated (no unknown/corrupt images treated as negative/background samples)
- All 631 unannotated images remain isolated in unannotated_inventory.json with STATUS_UNKNOWN
- Produces dataset.yaml, conversion_audit.json, exclusion_audit.json, and annotation_review_required.json
"""

import os
import sys
import json
import shutil
import hashlib
from typing import Dict, Any, List, Tuple, Optional
from collections import Counter, defaultdict


EXPECTED_NDJSON_SHA256 = "fdc19af5fd805da5dd0f5dcfff1c600b5377159757bc0a865eaaecc31d11dfe7"

CLASS_MAP = {
    0: "Deformation",
    1: "Misalignment",
    2: "Obstacle",
    3: "Rupture"
}


def compute_sha256(file_path: str) -> str:
    """Computes the SHA-256 hash of a file on disk."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def validate_source_ndjson(ndjson_path: str) -> Tuple[bool, str]:
    """Verifies existence and SHA-256 integrity of the source NDJSON file."""
    if not os.path.exists(ndjson_path):
        return False, f"Source NDJSON file not found: {ndjson_path}"
    
    actual_hash = compute_sha256(ndjson_path)
    if actual_hash != EXPECTED_NDJSON_SHA256:
        return False, f"Source NDJSON hash mismatch: expected {EXPECTED_NDJSON_SHA256}, got {actual_hash}"
    
    return True, actual_hash


class NDJSONToYOLOConverter:
    def __init__(
        self,
        ndjson_path: str,
        source_images_root: str,
        yolo_root: str,
    ):
        self.ndjson_path = ndjson_path
        self.source_images_root = source_images_root
        self.yolo_root = yolo_root
        
        # Directories
        self.images_dir = os.path.join(self.yolo_root, "images")
        self.labels_dir = os.path.join(self.yolo_root, "labels")
        
        # Tracking structures
        self.excluded_boxes: List[Dict[str, Any]] = []
        self.unannotated_inventory: List[Dict[str, Any]] = []
        self.annotation_review_required: List[Dict[str, Any]] = []
        self.conversion_stats: Dict[str, Any] = {}

    def parse_ndjson(self) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]]]:
        """Parses the NDJSON file into dataset metadata and image records."""
        metadata = None
        images = []
        with open(self.ndjson_path, "r", encoding="utf-8") as f:
            for line_idx, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                record = json.loads(line)
                if record.get("type") == "dataset":
                    metadata = record
                elif record.get("type") == "image":
                    record["_line_number"] = line_idx
                    images.append(record)
        return metadata, images

    def convert(self) -> Dict[str, Any]:
        """Performs the full conversion process with strict validation."""
        print(f"[*] Starting NDJSON to YOLO conversion (Stage 4 Prompt 3.1)...")
        print(f"    Source NDJSON: {self.ndjson_path}")
        print(f"    Source Images: {self.source_images_root}")
        print(f"    YOLO Root:     {self.yolo_root}")
        
        # 1. Verify source NDJSON integrity
        is_valid, msg_or_hash = validate_source_ndjson(self.ndjson_path)
        if not is_valid:
            raise ValueError(f"Integrity check failed: {msg_or_hash}")
        print(f"[OK] Source NDJSON verified (SHA-256: {msg_or_hash})")

        # 2. Parse NDJSON records
        metadata, records = self.parse_ndjson()
        print(f"[OK] Parsed {len(records)} image records from NDJSON")

        # 3. Clean and prepare target directories to prevent orphaned files
        for split in ("train", "val", "test"):
            img_split = os.path.join(self.images_dir, split)
            lbl_split = os.path.join(self.labels_dir, split)
            if os.path.exists(img_split):
                shutil.rmtree(img_split)
            if os.path.exists(lbl_split):
                shutil.rmtree(lbl_split)
            os.makedirs(img_split, exist_ok=True)
            os.makedirs(lbl_split, exist_ok=True)

        # 4. Counters
        split_image_counts = Counter()
        split_label_counts = Counter()
        split_valid_box_counts = Counter()
        split_excluded_box_counts = Counter()
        class_box_counts = Counter()
        class_split_box_counts = defaultdict(Counter)

        annotated_records = []
        unannotated_records = []

        for record in records:
            has_boxes = bool(record.get("annotations") and record["annotations"].get("boxes"))
            if has_boxes:
                annotated_records.append(record)
            else:
                unannotated_records.append(record)

        print(f"[*] Categorization: {len(annotated_records)} annotated, {len(unannotated_records)} unannotated")

        # 5. Process unannotated records (isolate them, catalog into inventory)
        for record in unannotated_records:
            filename = record["file"]
            split = record.get("split", "train")
            src_path = os.path.join(self.source_images_root, split, filename)
            self.unannotated_inventory.append({
                "file": filename,
                "split": split,
                "source_path": os.path.relpath(src_path, self.yolo_root) if os.path.exists(src_path) else None,
                "status": "STATUS_UNKNOWN / PENDING_CONFIRMATION",
                "reason": "NDJSON record contains no bounding box annotations; excluded from YOLO training/validation/test sets",
                "ndjson_line": record.get("_line_number")
            })

        # 6. Process annotated records
        for record in annotated_records:
            filename = record["file"]
            split = record.get("split", "train")
            raw_boxes = record["annotations"]["boxes"]
            line_no = record.get("_line_number")
            
            src_img_path = os.path.join(self.source_images_root, split, filename)
            dst_img_path = os.path.join(self.images_dir, split, filename)
            
            if not os.path.exists(src_img_path):
                raise FileNotFoundError(f"Source image missing on disk: {src_img_path}")

            # Process bounding boxes
            valid_boxes_for_image = []
            excluded_for_this_image = []

            for b_idx, box in enumerate(raw_boxes):
                if len(box) != 5:
                    raise ValueError(f"Malformed bounding box in {filename}: {box}")
                
                cls_id_raw, x, y, w, h = box
                cls_id = int(cls_id_raw)
                
                # Validation checks
                if cls_id not in CLASS_MAP:
                    raise ValueError(f"Unrecognized class_id {cls_id} in {filename} (must be 0, 1, 2, or 3)")

                # Check for zero width or zero height
                if w <= 0.0 or h <= 0.0:
                    reason = "zero_width" if w <= 0.0 else "zero_height"
                    exclusion_record = {
                        "file": filename,
                        "split": split,
                        "box_index": b_idx,
                        "class_id": cls_id,
                        "class_name": CLASS_MAP[cls_id],
                        "box": [cls_id, x, y, w, h],
                        "reason": reason,
                        "ndjson_line": line_no
                    }
                    self.excluded_boxes.append(exclusion_record)
                    excluded_for_this_image.append(exclusion_record)
                    split_excluded_box_counts[split] += 1
                    continue

                # Ensure coordinates are within valid range [0, 1]
                if not (0.0 <= x <= 1.0 and 0.0 <= y <= 1.0):
                    raise ValueError(f"Center coordinates out of range [0, 1] in {filename}: ({x}, {y})")
                if not (0.0 < w <= 1.0 and 0.0 < h <= 1.0):
                    raise ValueError(f"Dimensions out of range (0, 1] in {filename}: ({w}, {h})")

                valid_boxes_for_image.append((cls_id, x, y, w, h))

            # CRITICAL DECISION POINT (Stage 4 Prompt 3.1):
            # If an image has ZERO valid bounding boxes after exclusion, it MUST NOT receive
            # an empty label file (which signals a negative/background image). It must be
            # quarantined in annotation_review_required.json.
            if len(valid_boxes_for_image) == 0:
                self.annotation_review_required.append({
                    "file": filename,
                    "split": split,
                    "original_annotation_count": len(raw_boxes),
                    "valid_annotation_count": 0,
                    "invalid_annotation_count": len(excluded_for_this_image),
                    "exclusion_reasons": [e["reason"] for e in excluded_for_this_image],
                    "status": "ANNOTATION_CORRUPTED / REVIEW_REQUIRED",
                    "reason": "All bounding boxes in record were degenerate (zero width or zero height). Excluded from YOLO dataset; not treated as negative background.",
                    "ndjson_line": line_no,
                    "original_record": {
                        "type": record.get("type"),
                        "file": record.get("file"),
                        "width": record.get("width"),
                        "height": record.get("height"),
                        "split": record.get("split"),
                        "annotations": record.get("annotations")
                    }
                })
                # Do NOT copy image to YOLO directory
                # Do NOT write empty label file to YOLO directory
                continue

            # Copy image to YOLO directory
            shutil.copy2(src_img_path, dst_img_path)
            split_image_counts[split] += 1

            # Update valid box statistics
            for cls_id, x, y, w, h in valid_boxes_for_image:
                class_box_counts[cls_id] += 1
                class_split_box_counts[split][cls_id] += 1
                split_valid_box_counts[split] += 1

            # Write YOLO label file with valid boxes
            base_name, _ = os.path.splitext(filename)
            label_filename = f"{base_name}.txt"
            dst_label_path = os.path.join(self.labels_dir, split, label_filename)
            
            with open(dst_label_path, "w", encoding="utf-8") as lf:
                for cls_id, x, y, w, h in valid_boxes_for_image:
                    lf.write(f"{cls_id} {x:.6f} {y:.6f} {w:.6f} {h:.6f}\n")
            
            split_label_counts[split] += 1

        # 7. Write dataset.yaml
        yaml_content = f"""# PipeBot YOLOv8 Object Detection Dataset Configuration
# Generated by ai-service/scripts/convert_ndjson_to_yolo.py
# Reference: Rules/PipeBot_Build_Rulebook.md § 13.1
# Stage 4 Prompt 3.1: Strict non-negative dataset membership

path: {os.path.abspath(self.yolo_root).replace(os.sep, '/')}
train: images/train
val: images/val
test: images/test

# Number of classes
nc: 4

# Class names
names:
  0: Deformation
  1: Misalignment
  2: Obstacle
  3: Rupture
"""
        yaml_path = os.path.join(self.yolo_root, "dataset.yaml")
        with open(yaml_path, "w", encoding="utf-8") as yf:
            yf.write(yaml_content)
        print(f"[OK] Written {yaml_path}")

        # 8. Save excluded boxes audit log
        exclusion_audit_path = os.path.join(self.yolo_root, "exclusion_audit.json")
        with open(exclusion_audit_path, "w", encoding="utf-8") as ef:
            json.dump({
                "description": "PipeBot Dataset Conversion - Excluded Invalid Bounding Boxes Audit",
                "total_excluded": len(self.excluded_boxes),
                "excluded_by_reason": dict(Counter(b["reason"] for b in self.excluded_boxes)),
                "excluded_by_split": dict(Counter(b["split"] for b in self.excluded_boxes)),
                "excluded_by_class": dict(Counter(b["class_name"] for b in self.excluded_boxes)),
                "excluded_boxes": self.excluded_boxes
            }, ef, indent=2)
        print(f"[OK] Written {exclusion_audit_path} ({len(self.excluded_boxes)} excluded boxes logged)")

        # 9. Save annotation review required log (NEW in Prompt 3.1)
        review_req_path = os.path.join(self.yolo_root, "annotation_review_required.json")
        with open(review_req_path, "w", encoding="utf-8") as rf:
            json.dump({
                "description": "PipeBot Dataset - Zero Valid Annotations Quarantine (Annotation Review Required)",
                "total_quarantined": len(self.annotation_review_required),
                "quarantined_by_split": dict(Counter(r["split"] for r in self.annotation_review_required)),
                "status": "ANNOTATION_CORRUPTED / REVIEW_REQUIRED",
                "policy": "Excluded from YOLO images and labels; not assigned empty/negative labels; original source images and NDJSON preserved.",
                "quarantined_images": self.annotation_review_required
            }, rf, indent=2)
        print(f"[OK] Written {review_req_path} ({len(self.annotation_review_required)} zero-valid images quarantined)")

        # 10. Save unannotated images inventory
        unannotated_inv_path = os.path.join(self.yolo_root, "unannotated_inventory.json")
        with open(unannotated_inv_path, "w", encoding="utf-8") as uf:
            json.dump({
                "description": "PipeBot Dataset Conversion - Unannotated Images Inventory",
                "total_unannotated": len(self.unannotated_inventory),
                "unannotated_by_split": dict(Counter(u["split"] for u in self.unannotated_inventory)),
                "status": "STATUS_UNKNOWN / PENDING_CONFIRMATION",
                "unannotated_records": self.unannotated_inventory
            }, uf, indent=2)
        print(f"[OK] Written {unannotated_inv_path} ({len(self.unannotated_inventory)} records)")

        # 11. Generate and save conversion summary audit
        total_images = len(records)
        total_annotated = len(annotated_records)
        total_unannotated = len(unannotated_records)
        total_yolo_images = sum(split_image_counts.values())
        total_yolo_labels = sum(split_label_counts.values())
        total_quarantined = len(self.annotation_review_required)
        total_original_boxes = sum(len(r["annotations"]["boxes"]) for r in annotated_records)
        total_valid_boxes = sum(split_valid_box_counts.values())
        total_excluded_boxes = len(self.excluded_boxes)

        self.conversion_stats = {
            "source_ndjson_sha256": EXPECTED_NDJSON_SHA256,
            "total_images_processed": total_images,
            "annotated_records_total": total_annotated,
            "unannotated_records_total": total_unannotated,
            "zero_valid_annotation_quarantined_total": total_quarantined,
            "yolo_images_retained_total": total_yolo_images,
            "yolo_labels_retained_total": total_yolo_labels,
            "original_bounding_boxes_total": total_original_boxes,
            "excluded_invalid_boxes_total": total_excluded_boxes,
            "valid_yolo_boxes_total": total_valid_boxes,
            "images_by_split": dict(split_image_counts),
            "labels_by_split": dict(split_label_counts),
            "valid_boxes_by_split": dict(split_valid_box_counts),
            "excluded_boxes_by_split": dict(split_excluded_box_counts),
            "quarantined_by_split": dict(Counter(r["split"] for r in self.annotation_review_required)),
            "valid_boxes_by_class": {
                CLASS_MAP[c]: class_box_counts[c] for c in sorted(CLASS_MAP.keys())
            },
            "valid_boxes_by_class_and_split": {
                split: {CLASS_MAP[c]: class_split_box_counts[split][c] for c in sorted(CLASS_MAP.keys())}
                for split in ("train", "val", "test")
            }
        }

        conversion_audit_path = os.path.join(self.yolo_root, "conversion_audit.json")
        with open(conversion_audit_path, "w", encoding="utf-8") as cf:
            json.dump(self.conversion_stats, cf, indent=2)
        print(f"[OK] Written {conversion_audit_path}")

        print("\n" + "=" * 70)
        print("PIPEBOT YOLO DATASET CONVERSION COMPLETED (PROMPT 3.1)")
        print("=" * 70)
        print(f"Total Source Images:               {total_images}")
        print(f"YOLO Retained Images (>=1 valid):  {total_yolo_images} (train: {split_image_counts['train']}, val: {split_image_counts['val']}, test: {split_image_counts['test']})")
        print(f"YOLO Retained Labels (>=1 valid):  {total_yolo_labels} (train: {split_label_counts['train']}, val: {split_label_counts['val']}, test: {split_label_counts['test']})")
        print(f"Empty Labels Generated:            0 (Strictly 0; no negative/background pseudo-labels)")
        print(f"Zero-Valid Quarantined:            {total_quarantined} (all logged to annotation_review_required.json)")
        print(f"Unannotated Isolated:              {total_unannotated} (all logged to unannotated_inventory.json)")
        print(f"Original Bounding Boxes:           {total_original_boxes}")
        print(f"Excluded Invalid Boxes:            {total_excluded_boxes} (zero_width: {sum(1 for b in self.excluded_boxes if b['reason'] == 'zero_width')}, zero_height: {sum(1 for b in self.excluded_boxes if b['reason'] == 'zero_height')})")
        print(f"Valid YOLO Boxes Retained:         {total_valid_boxes}")
        for cls_id, cls_name in CLASS_MAP.items():
            print(f"  Class {cls_id} ({cls_name:12s}): {class_box_counts[cls_id]:4d} boxes")
        print("=" * 70)

        return self.conversion_stats


def main():
    default_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    project_root = os.environ.get("PIPEBOT_ROOT", default_root)
    ndjson_path = os.path.normpath(os.environ.get("PIPEBOT_NDJSON", os.path.join(project_root, "ai", "dataset", "original", "pipe-defect-detectionv7-dataset-pipeyolov8.ndjson")))
    source_images_root = os.path.normpath(os.environ.get("PIPEBOT_SOURCE_IMAGES", os.path.join(project_root, "ai-service", "dataset", "source_images")))
    yolo_root = os.path.normpath(os.environ.get("PIPEBOT_YOLO_ROOT", os.path.join(project_root, "ai-service", "dataset", "yolo")))
    
    converter = NDJSONToYOLOConverter(
        ndjson_path=ndjson_path,
        source_images_root=source_images_root,
        yolo_root=yolo_root,
    )
    converter.convert()


if __name__ == "__main__":
    main()
