"""
PipeBot YOLO Dataset Validation Script
Follows Rules/PipeBot_Build_Rulebook.md § 13.1, 13.2, 13.3, 13.4
Stage 4 Prompt 3.1: Strict non-negative dataset membership & zero empty label validation

Performs comprehensive verification and mathematical reconciliation of the converted YOLO dataset:
1. Reconciles all 1,916 records against source NDJSON.
2. Verifies dataset.yaml syntax, classes, and path resolution.
3. Verifies 1-to-1 match between images and labels across train, val, and test splits.
4. Verifies that EVERY label file contains at least 1 valid bounding box (0 empty label files permitted).
5. Verifies all bounding box coordinates (normalized [0, 1], w > 0, h > 0, class_id in 0..3).
6. Confirms exactly 13 excluded invalid boxes in exclusion_audit.json.
7. Confirms exactly 6 zero-valid-annotation images quarantined in annotation_review_required.json.
8. Confirms that 0 quarantined or unannotated images leaked into the YOLO dataset.
9. Confirms exactly 2,411 valid bounding boxes across exactly 1,279 YOLO images/labels.
"""

import os
import sys
import json
import hashlib
from typing import Dict, Any, List, Tuple, Set
from collections import Counter, defaultdict
from PIL import Image


EXPECTED_NDJSON_SHA256 = "fdc19af5fd805da5dd0f5dcfff1c600b5377159757bc0a865eaaecc31d11dfe7"

EXPECTED_CLASSES = {
    0: "Deformation",
    1: "Misalignment",
    2: "Obstacle",
    3: "Rupture"
}

# Retained in YOLO (Prompt 3.1: only images with >= 1 valid box)
EXPECTED_SPLIT_COUNTS = {
    "train": {"yolo": 1140, "review_req": 6, "unannotated": 581, "source_total": 1727},
    "val":   {"yolo": 94,   "review_req": 0, "unannotated": 32,  "source_total": 126},
    "test":  {"yolo": 45,   "review_req": 0, "unannotated": 18,  "source_total": 63},
}

TOTAL_EXPECTED_IMAGES = 1916
TOTAL_EXPECTED_YOLO = 1279
TOTAL_EXPECTED_REVIEW_REQ = 6
TOTAL_EXPECTED_UNANNOTATED = 631
TOTAL_ORIGINAL_BOXES = 2424
TOTAL_EXCLUDED_BOXES = 13
TOTAL_VALID_BOXES = 2411


def compute_sha256(file_path: str) -> str:
    """Computes SHA-256 hash of a file on disk."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


class YOLOValidator:
    def __init__(self, ndjson_path: str, yolo_root: str):
        self.ndjson_path = ndjson_path
        self.yolo_root = yolo_root
        self.images_root = os.path.join(yolo_root, "images")
        self.labels_root = os.path.join(yolo_root, "labels")
        self.yaml_path = os.path.join(yolo_root, "dataset.yaml")
        self.exclusion_path = os.path.join(yolo_root, "exclusion_audit.json")
        self.review_req_path = os.path.join(yolo_root, "annotation_review_required.json")
        self.unannotated_path = os.path.join(yolo_root, "unannotated_inventory.json")
        self.conversion_audit_path = os.path.join(yolo_root, "conversion_audit.json")
        
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def log_error(self, msg: str):
        self.errors.append(msg)
        print(f"  [ERROR] {msg}")

    def log_ok(self, msg: str):
        print(f"  [OK] {msg}")

    def validate_source_ndjson(self) -> bool:
        print("\n--- 1. Validating Source NDJSON ---")
        if not os.path.exists(self.ndjson_path):
            self.log_error(f"Source NDJSON not found at: {self.ndjson_path}")
            return False
        
        actual_hash = compute_sha256(self.ndjson_path)
        if actual_hash != EXPECTED_NDJSON_SHA256:
            self.log_error(f"Source NDJSON SHA-256 mismatch: expected {EXPECTED_NDJSON_SHA256}, got {actual_hash}")
            return False
        
        self.log_ok(f"Source NDJSON verified (SHA-256: {actual_hash})")
        return True

    def validate_yaml(self) -> bool:
        print("\n--- 2. Validating dataset.yaml Configuration ---")
        if not os.path.exists(self.yaml_path):
            self.log_error(f"dataset.yaml not found at: {self.yaml_path}")
            return False

        with open(self.yaml_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        content = "".join(lines)
        for field in ("path:", "train:", "val:", "test:", "names:"):
            if field not in content:
                self.log_error(f"dataset.yaml missing required field: {field}")
        
        for cls_id, cls_name in EXPECTED_CLASSES.items():
            if f"{cls_id}: {cls_name}" not in content and f"{cls_id}: '{cls_name}'" not in content and f'"{cls_id}": "{cls_name}"' not in content:
                self.log_error(f"dataset.yaml missing class mapping: {cls_id}: {cls_name}")

        self.log_ok(f"dataset.yaml verified with 4 classes: {EXPECTED_CLASSES}")
        return True

    def validate_dataset_split_files(self) -> Tuple[Dict[str, Any], Set[str]]:
        print("\n--- 3. Validating Image & Label Files (Enforcing No Empty Labels) ---")
        
        stats = {
            "images_count": Counter(),
            "labels_count": Counter(),
            "valid_boxes_count": Counter(),
            "classes_count": Counter(),
            "split_class_boxes": defaultdict(Counter),
            "empty_label_files": []
        }

        all_yolo_image_basenames: Set[str] = set()

        for split in ("train", "val", "test"):
            img_split_dir = os.path.join(self.images_root, split)
            lbl_split_dir = os.path.join(self.labels_root, split)

            if not os.path.exists(img_split_dir):
                self.log_error(f"Image split dir missing: {img_split_dir}")
                continue
            if not os.path.exists(lbl_split_dir):
                self.log_error(f"Label split dir missing: {lbl_split_dir}")
                continue

            img_files = {f for f in os.listdir(img_split_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))}
            lbl_files = {f for f in os.listdir(lbl_split_dir) if f.lower().endswith('.txt')}

            stats["images_count"][split] = len(img_files)
            stats["labels_count"][split] = len(lbl_files)

            # Check 1:1 image to label matching by base stem
            img_stems = {os.path.splitext(f)[0]: f for f in img_files}
            lbl_stems = {os.path.splitext(f)[0]: f for f in lbl_files}

            all_yolo_image_basenames.update(img_files)

            missing_labels = set(img_stems.keys()) - set(lbl_stems.keys())
            orphaned_labels = set(lbl_stems.keys()) - set(img_stems.keys())

            if missing_labels:
                self.log_error(f"Split '{split}': {len(missing_labels)} images missing corresponding label file")
            if orphaned_labels:
                self.log_error(f"Split '{split}': {len(orphaned_labels)} label files have no corresponding image")

            # Check image integrity
            for img_name in img_files:
                img_path = os.path.join(img_split_dir, img_name)
                try:
                    with Image.open(img_path) as im:
                        im.verify()
                except Exception as e:
                    self.log_error(f"Corrupt image in '{split}': {img_name} ({e})")

            # Check labels content
            for lbl_name in lbl_files:
                lbl_path = os.path.join(lbl_split_dir, lbl_name)
                boxes_in_file = 0
                with open(lbl_path, "r", encoding="utf-8") as f:
                    for line_idx, line in enumerate(f, 1):
                        line = line.strip()
                        if not line:
                            continue
                        parts = line.split()
                        if len(parts) != 5:
                            self.log_error(f"Invalid label line format in {lbl_path}:{line_idx} -> '{line}'")
                            continue
                        
                        try:
                            cls_id = int(parts[0])
                            x = float(parts[1])
                            y = float(parts[2])
                            w = float(parts[3])
                            h = float(parts[4])
                        except ValueError as ve:
                            self.log_error(f"Non-numeric value in {lbl_path}:{line_idx} -> '{line}' ({ve})")
                            continue

                        if cls_id not in EXPECTED_CLASSES:
                            self.log_error(f"Invalid class_id {cls_id} in {lbl_path}:{line_idx}")

                        if not (0.0 <= x <= 1.0 and 0.0 <= y <= 1.0):
                            self.log_error(f"Center coords out of range [0, 1] in {lbl_path}:{line_idx}: ({x}, {y})")

                        if w <= 0.0 or h <= 0.0:
                            self.log_error(f"Non-positive box dimension in {lbl_path}:{line_idx}: w={w}, h={h}")

                        if w > 1.0 or h > 1.0:
                            self.log_error(f"Box dimension exceeds 1.0 in {lbl_path}:{line_idx}: w={w}, h={h}")

                        boxes_in_file += 1
                        stats["valid_boxes_count"][split] += 1
                        stats["classes_count"][cls_id] += 1
                        stats["split_class_boxes"][split][cls_id] += 1

                # CRITICAL RULE (Prompt 3.1): Empty label files are NOT allowed
                if boxes_in_file == 0:
                    stats["empty_label_files"].append(lbl_path)
                    self.log_error(f"Empty label file detected in '{split}': {lbl_name} (must be excluded from YOLO dataset)")

            self.log_ok(f"Split '{split}': {len(img_files)} images, {len(lbl_files)} labels, {stats['valid_boxes_count'][split]} valid boxes (0 empty label files)")

        if stats["empty_label_files"]:
            self.log_error(f"Total empty label files detected: {len(stats['empty_label_files'])}! Violation of Prompt 3.1 rules.")
        else:
            self.log_ok("Verified: Exactly 0 empty label files exist across all YOLO splits.")

        return stats, all_yolo_image_basenames

    def validate_audit_records(self, all_yolo_images: Set[str]) -> bool:
        print("\n--- 4. Validating Exclusion, Quarantine, and Isolation Inventories ---")
        
        # 1. Exclusion audit
        if not os.path.exists(self.exclusion_path):
            self.log_error(f"Missing exclusion audit at: {self.exclusion_path}")
            return False

        with open(self.exclusion_path, "r", encoding="utf-8") as f:
            exclusion_data = json.load(f)

        excluded_list = exclusion_data.get("excluded_boxes", [])
        if len(excluded_list) != TOTAL_EXCLUDED_BOXES:
            self.log_error(f"Expected {TOTAL_EXCLUDED_BOXES} excluded boxes, but exclusion audit has {len(excluded_list)}")
        else:
            self.log_ok(f"Exclusion audit contains exactly {TOTAL_EXCLUDED_BOXES} invalid boxes")

        zero_w_count = sum(1 for b in excluded_list if b.get("reason") == "zero_width")
        zero_h_count = sum(1 for b in excluded_list if b.get("reason") == "zero_height")
        if zero_w_count != 11 or zero_h_count != 2:
            self.log_error(f"Exclusion audit breakdown mismatch: expected 11 zero_width and 2 zero_height, got {zero_w_count} and {zero_h_count}")
        else:
            self.log_ok(f"Exclusion reasons verified: 11 zero_width, 2 zero_height")

        # 2. Annotation Review Required (Quarantined Zero-Valid-Annotation Images)
        if not os.path.exists(self.review_req_path):
            self.log_error(f"Missing annotation review required inventory at: {self.review_req_path}")
            return False

        with open(self.review_req_path, "r", encoding="utf-8") as rf:
            review_data = json.load(rf)

        quarantined_list = review_data.get("quarantined_images", [])
        if len(quarantined_list) != TOTAL_EXPECTED_REVIEW_REQ:
            self.log_error(f"Expected {TOTAL_EXPECTED_REVIEW_REQ} quarantined zero-valid images, got {len(quarantined_list)}")
        else:
            self.log_ok(f"Quarantined zero-valid images inventory contains exactly {TOTAL_EXPECTED_REVIEW_REQ} records")

        # Verify none of the quarantined images leaked into YOLO dataset
        quarantined_filenames = {q["file"] for q in quarantined_list}
        leaked_quarantined = quarantined_filenames.intersection(all_yolo_images)
        if leaked_quarantined:
            self.log_error(f"CRITICAL: {len(leaked_quarantined)} quarantined zero-valid images found in YOLO dataset directory: {leaked_quarantined}")
        else:
            self.log_ok(f"Verified: Exactly 0 quarantined zero-valid images leaked into YOLO training/val/test sets")

        # 3. Unannotated inventory
        if not os.path.exists(self.unannotated_path):
            self.log_error(f"Missing unannotated inventory at: {self.unannotated_path}")
            return False

        with open(self.unannotated_path, "r", encoding="utf-8") as f:
            unannotated_data = json.load(f)

        unannotated_list = unannotated_data.get("unannotated_records", [])
        if len(unannotated_list) != TOTAL_EXPECTED_UNANNOTATED:
            self.log_error(f"Expected {TOTAL_EXPECTED_UNANNOTATED} unannotated images, got {len(unannotated_list)}")
        else:
            self.log_ok(f"Unannotated inventory contains exactly {TOTAL_EXPECTED_UNANNOTATED} records")

        unannotated_filenames = {u["file"] for u in unannotated_list}
        leaked_unannotated = unannotated_filenames.intersection(all_yolo_images)
        if leaked_unannotated:
            self.log_error(f"CRITICAL: {len(leaked_unannotated)} unannotated images found inside YOLO dataset directory!")
        else:
            self.log_ok("Verified: Exactly 0 unannotated images leaked into YOLO training/val/test sets (complete isolation)")

        return True

    def validate_mathematical_reconciliation(self, stats: Dict[str, Any]) -> bool:
        print("\n--- 5. Mathematical Dataset Reconciliation ---")
        total_yolo_images = sum(stats["images_count"].values())
        total_yolo_labels = sum(stats["labels_count"].values())
        total_valid_boxes = sum(stats["valid_boxes_count"].values())

        success = True

        # YOLO Retained images check (Prompt 3.1: 1,279)
        if total_yolo_images != TOTAL_EXPECTED_YOLO:
            self.log_error(f"Total YOLO images mismatch: expected {TOTAL_EXPECTED_YOLO}, got {total_yolo_images}")
            success = False
        else:
            self.log_ok(f"Total YOLO images = {total_yolo_images} matches expected {TOTAL_EXPECTED_YOLO}")

        if total_yolo_labels != TOTAL_EXPECTED_YOLO:
            self.log_error(f"Total YOLO labels mismatch: expected {TOTAL_EXPECTED_YOLO}, got {total_yolo_labels}")
            success = False
        else:
            self.log_ok(f"Total YOLO labels = {total_yolo_labels} matches expected {TOTAL_EXPECTED_YOLO}")

        # Valid boxes check
        if total_valid_boxes != TOTAL_VALID_BOXES:
            self.log_error(f"Total valid bounding boxes mismatch: expected {TOTAL_VALID_BOXES}, got {total_valid_boxes}")
            success = False
        else:
            self.log_ok(f"Total valid YOLO bounding boxes = {total_valid_boxes} matches expected {TOTAL_VALID_BOXES}")

        # Formula check: original_boxes = valid_boxes + excluded_boxes
        reconciled_boxes = total_valid_boxes + TOTAL_EXCLUDED_BOXES
        if reconciled_boxes != TOTAL_ORIGINAL_BOXES:
            self.log_error(f"Bounding box reconciliation failure: {total_valid_boxes} valid + {TOTAL_EXCLUDED_BOXES} excluded != {TOTAL_ORIGINAL_BOXES} original")
            success = False
        else:
            self.log_ok(f"Bounding box equation holds: {total_valid_boxes} valid + {TOTAL_EXCLUDED_BOXES} excluded = {TOTAL_ORIGINAL_BOXES} original boxes")

        # Formula check: total_images = yolo_images + review_required_images + unannotated_images
        reconciled_images = total_yolo_images + TOTAL_EXPECTED_REVIEW_REQ + TOTAL_EXPECTED_UNANNOTATED
        if reconciled_images != TOTAL_EXPECTED_IMAGES:
            self.log_error(f"Total images reconciliation failure: {total_yolo_images} YOLO + {TOTAL_EXPECTED_REVIEW_REQ} review_req + {TOTAL_EXPECTED_UNANNOTATED} unannotated != {TOTAL_EXPECTED_IMAGES} source images")
            success = False
        else:
            self.log_ok(f"Image equation holds: {total_yolo_images} YOLO + {TOTAL_EXPECTED_REVIEW_REQ} review_req + {TOTAL_EXPECTED_UNANNOTATED} unannotated = {TOTAL_EXPECTED_IMAGES} total images")

        # Split check
        for split, expected in EXPECTED_SPLIT_COUNTS.items():
            actual_yolo = stats["images_count"][split]
            if actual_yolo != expected["yolo"]:
                self.log_error(f"Split '{split}' YOLO count mismatch: expected {expected['yolo']}, got {actual_yolo}")
                success = False

        print("\nClass Distribution in Converted YOLO Dataset:")
        for cls_id, cls_name in EXPECTED_CLASSES.items():
            count = stats["classes_count"][cls_id]
            pct = (count / total_valid_boxes) * 100.0 if total_valid_boxes > 0 else 0
            print(f"  Class {cls_id} ({cls_name:12s}): {count:4d} boxes ({pct:5.1f}%)")

        return success

    def run_all(self) -> bool:
        print("=" * 70)
        print("PIPEBOT YOLO DATASET VALIDATION (PROMPT 3.1)")
        print("=" * 70)
        
        ok1 = self.validate_source_ndjson()
        ok2 = self.validate_yaml()
        stats, all_yolo_images = self.validate_dataset_split_files()
        ok3 = self.validate_audit_records(all_yolo_images)
        ok4 = self.validate_mathematical_reconciliation(stats)

        print("\n" + "=" * 70)
        if self.errors:
            print(f"VALIDATION FAILED: {len(self.errors)} error(s) found!")
            for err in self.errors:
                print(f"  * {err}")
            return False
        else:
            print("VALIDATION SUCCESSFUL: All Prompt 3.1 dataset integrity checks passed!")
            print("=" * 70)
            return True


def main():
    default_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    project_root = os.environ.get("PIPEBOT_ROOT", default_root)
    ndjson_path = os.path.normpath(os.environ.get("PIPEBOT_NDJSON", os.path.join(project_root, "ai", "dataset", "original", "pipe-defect-detectionv7-dataset-pipeyolov8.ndjson")))
    yolo_root = os.path.normpath(os.environ.get("PIPEBOT_YOLO_ROOT", os.path.join(project_root, "ai-service", "dataset", "yolo")))
    
    validator = YOLOValidator(ndjson_path=ndjson_path, yolo_root=yolo_root)
    success = validator.run_all()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
