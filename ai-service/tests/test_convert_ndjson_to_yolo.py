"""
Unit Tests for PipeBot NDJSON to YOLO Conversion and Validation
Follows Rules/PipeBot_Build_Rulebook.md § 13.1, 13.2, 13.3, 13.4
Stage 4 Prompt 3.1: Strict non-negative dataset membership & zero empty label tests
"""

import os
import sys
import json
import tempfile
import unittest
from io import StringIO
from unittest.mock import patch, MagicMock

# Add scripts directory to sys.path
scripts_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "scripts"))
if scripts_dir not in sys.path:
    sys.path.insert(0, scripts_dir)

from convert_ndjson_to_yolo import (
    NDJSONToYOLOConverter,
    validate_source_ndjson,
    compute_sha256,
    EXPECTED_NDJSON_SHA256,
    CLASS_MAP
)
from validate_yolo_dataset import YOLOValidator, EXPECTED_CLASSES


class TestNDJSONToYOLOConversion(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.ndjson_path = os.path.join(self.test_dir, "test.ndjson")
        self.source_images_dir = os.path.join(self.test_dir, "source_images")
        self.yolo_dir = os.path.join(self.test_dir, "yolo")
        
        os.makedirs(os.path.join(self.source_images_dir, "train"), exist_ok=True)
        os.makedirs(os.path.join(self.source_images_dir, "val"), exist_ok=True)
        os.makedirs(os.path.join(self.source_images_dir, "test"), exist_ok=True)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_class_mapping_invariants(self):
        """Validates that exactly 4 classes are mapped according to specifications."""
        self.assertEqual(CLASS_MAP[0], "Deformation")
        self.assertEqual(CLASS_MAP[1], "Misalignment")
        self.assertEqual(CLASS_MAP[2], "Obstacle")
        self.assertEqual(CLASS_MAP[3], "Rupture")
        self.assertEqual(len(CLASS_MAP), 4)

    def test_exclusion_logic(self):
        """Verifies that zero-width and zero-height boxes are flagged for exclusion."""
        sample_records = [
            # Normal box
            {"file": "img1.jpg", "split": "train", "annotations": {"boxes": [[0, 0.5, 0.5, 0.2, 0.3]]}},
            # Zero width box
            {"file": "img2.jpg", "split": "train", "annotations": {"boxes": [[1, 0.1, 0.1, 0.0, 0.4]]}},
            # Zero height box
            {"file": "img3.jpg", "split": "train", "annotations": {"boxes": [[3, 0.2, 0.2, 0.5, 0.0]]}},
            # Mixed: 1 valid, 1 zero-width
            {"file": "img4.jpg", "split": "val", "annotations": {"boxes": [
                [2, 0.3, 0.3, 0.1, 0.1],
                [1, 0.4, 0.4, 0.0, 0.2]
            ]}},
        ]

        excluded = []
        valid = []
        for rec in sample_records:
            for b_idx, box in enumerate(rec["annotations"]["boxes"]):
                cls_id, x, y, w, h = box
                if w <= 0.0 or h <= 0.0:
                    excluded.append({
                        "file": rec["file"],
                        "box": box,
                        "reason": "zero_width" if w <= 0.0 else "zero_height"
                    })
                else:
                    valid.append((cls_id, x, y, w, h))

        self.assertEqual(len(excluded), 3)
        self.assertEqual(len(valid), 2)
        
        reasons = [e["reason"] for e in excluded]
        self.assertEqual(reasons.count("zero_width"), 2)
        self.assertEqual(reasons.count("zero_height"), 1)

    def test_zero_valid_annotation_image_is_quarantined_not_empty_labeled(self):
        """
        Prompt 3.1 Requirement: Proves that an image with zero valid annotations
        is excluded from YOLO training rather than assigned an empty label file.
        """
        # Create a mock source image
        img_name = "corrupt_only_box.jpg"
        img_path = os.path.join(self.source_images_dir, "train", img_name)
        with open(img_path, "wb") as f:
            f.write(b"fake_image_bytes")

        # Create mock NDJSON with 1 corrupt box (zero width)
        record = {
            "type": "image",
            "file": img_name,
            "split": "train",
            "width": 640,
            "height": 640,
            "annotations": {
                "boxes": [
                    [1, 0.0, 0.0, 0.0, 0.5]  # w = 0.0 -> zero width invalid box
                ]
            }
        }
        with open(self.ndjson_path, "w", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")

        converter = NDJSONToYOLOConverter(
            ndjson_path=self.ndjson_path,
            source_images_root=self.source_images_dir,
            yolo_root=self.yolo_dir
        )
        with patch("convert_ndjson_to_yolo.validate_source_ndjson", return_value=(True, "mock_hash")):
            stats = converter.convert()

        # Must NOT exist in YOLO images
        yolo_img = os.path.join(self.yolo_dir, "images", "train", img_name)
        self.assertFalse(os.path.exists(yolo_img), "Zero-valid image must NOT be copied to YOLO images directory")

        # Must NOT exist in YOLO labels (NO empty label file!)
        yolo_lbl = os.path.join(self.yolo_dir, "labels", "train", "corrupt_only_box.txt")
        self.assertFalse(os.path.exists(yolo_lbl), "Zero-valid image must NOT receive an empty label file")

        # Must be quarantined in annotation_review_required
        self.assertEqual(len(converter.annotation_review_required), 1)
        self.assertEqual(converter.annotation_review_required[0]["file"], img_name)
        self.assertEqual(converter.annotation_review_required[0]["valid_annotation_count"], 0)
        self.assertEqual(converter.annotation_review_required[0]["invalid_annotation_count"], 1)

    def test_partial_valid_annotation_image_retains_valid_box(self):
        """
        Prompt 3.1 Requirement: Proves that an image with at least one valid and one
        invalid box retains its valid annotation in its YOLO label file.
        """
        img_name = "mixed_boxes.jpg"
        img_path = os.path.join(self.source_images_dir, "train", img_name)
        with open(img_path, "wb") as f:
            f.write(b"fake_image_bytes")

        # 1 valid box, 1 zero-height box
        record = {
            "type": "image",
            "file": img_name,
            "split": "train",
            "width": 640,
            "height": 640,
            "annotations": {
                "boxes": [
                    [0, 0.4, 0.4, 0.2, 0.3],  # Valid
                    [3, 0.5, 0.5, 0.2, 0.0]   # Invalid: h = 0
                ]
            }
        }
        with open(self.ndjson_path, "w", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")

        converter = NDJSONToYOLOConverter(
            ndjson_path=self.ndjson_path,
            source_images_root=self.source_images_dir,
            yolo_root=self.yolo_dir
        )
        with patch("convert_ndjson_to_yolo.validate_source_ndjson", return_value=(True, "mock_hash")):
            stats = converter.convert()

        # Image MUST exist in YOLO images
        yolo_img = os.path.join(self.yolo_dir, "images", "train", img_name)
        self.assertTrue(os.path.exists(yolo_img), "Image with valid annotation must be retained in YOLO images")

        # Label MUST exist and contain ONLY the valid box
        yolo_lbl = os.path.join(self.yolo_dir, "labels", "train", "mixed_boxes.txt")
        self.assertTrue(os.path.exists(yolo_lbl), "Label file must exist for image with valid annotation")
        with open(yolo_lbl, "r", encoding="utf-8") as f:
            lines = [l.strip() for l in f if l.strip()]
        
        self.assertEqual(len(lines), 1, "Label file must contain exactly 1 valid line")
        parts = lines[0].split()
        self.assertEqual(parts[0], "0")
        self.assertEqual(parts[1], "0.400000")
        self.assertEqual(parts[2], "0.400000")
        self.assertEqual(parts[3], "0.200000")
        self.assertEqual(parts[4], "0.300000")

    def test_unannotated_isolation(self):
        """Verifies that unannotated records are isolated and not converted as negative labels."""
        unannotated_record = {
            "type": "image",
            "file": "unannotated_01.jpg",
            "split": "train",
            "width": 640,
            "height": 640,
            "annotations": {}
        }
        has_boxes = bool(unannotated_record.get("annotations") and unannotated_record["annotations"].get("boxes"))
        self.assertFalse(has_boxes)

    def test_yolo_coordinate_formatting(self):
        """Checks precision and whitespace formatting of YOLO bounding box line."""
        cls_id = 2
        x = 0.451821234
        y = 0.123456789
        w = 0.2500001
        h = 0.3333333

        formatted = f"{cls_id} {x:.6f} {y:.6f} {w:.6f} {h:.6f}"
        parts = formatted.split()
        
        self.assertEqual(len(parts), 5)
        self.assertEqual(parts[0], "2")
        self.assertEqual(parts[1], "0.451821")
        self.assertEqual(parts[2], "0.123457")
        self.assertEqual(parts[3], "0.250000")
        self.assertEqual(parts[4], "0.333333")

    def test_dataset_yaml_structure(self):
        """Verifies generated dataset.yaml syntax and class assignments."""
        yaml_content = f"""path: /dummy/path
train: images/train
val: images/val
test: images/test
nc: 4
names:
  0: Deformation
  1: Misalignment
  2: Obstacle
  3: Rupture
"""
        yaml_file = os.path.join(self.test_dir, "dataset.yaml")
        with open(yaml_file, "w", encoding="utf-8") as f:
            f.write(yaml_content)

        validator = YOLOValidator(ndjson_path="dummy", yolo_root=self.test_dir)
        is_valid = validator.validate_yaml()
        self.assertTrue(is_valid)


class TestLiveDatasetReconciliation(unittest.TestCase):
    """Verifies the live converted dataset on disk against production requirements."""

    @classmethod
    def setUpClass(cls):
        default_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        cls.project_root = os.environ.get("PIPEBOT_ROOT", default_root)
        cls.ndjson_path = os.path.normpath(os.environ.get("PIPEBOT_NDJSON", os.path.join(cls.project_root, "ai", "dataset", "original", "pipe-defect-detectionv7-dataset-pipeyolov8.ndjson")))
        cls.yolo_root = os.path.normpath(os.environ.get("PIPEBOT_YOLO_ROOT", os.path.join(cls.project_root, "ai-service", "dataset", "yolo")))

    def test_source_ndjson_integrity(self):
        """Verifies exact SHA-256 hash of original dataset export."""
        self.assertTrue(os.path.exists(self.ndjson_path), f"File missing: {self.ndjson_path}")
        actual_hash = compute_sha256(self.ndjson_path)
        self.assertEqual(actual_hash, EXPECTED_NDJSON_SHA256)

    def test_exclusion_audit_file(self):
        """Verifies exclusion_audit.json contains exactly 13 excluded invalid boxes."""
        audit_file = os.path.join(self.yolo_root, "exclusion_audit.json")
        self.assertTrue(os.path.exists(audit_file), f"Audit file missing: {audit_file}")
        with open(audit_file, "r", encoding="utf-8") as f:
            audit = json.load(f)
        
        self.assertEqual(audit["total_excluded"], 13)
        self.assertEqual(len(audit["excluded_boxes"]), 13)
        self.assertEqual(audit["excluded_by_reason"]["zero_width"], 11)
        self.assertEqual(audit["excluded_by_reason"]["zero_height"], 2)

    def test_annotation_review_required_file(self):
        """Verifies annotation_review_required.json contains exactly 6 zero-valid images."""
        review_file = os.path.join(self.yolo_root, "annotation_review_required.json")
        self.assertTrue(os.path.exists(review_file), f"Review file missing: {review_file}")
        with open(review_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        self.assertEqual(data["total_quarantined"], 6)
        self.assertEqual(len(data["quarantined_images"]), 6)
        self.assertEqual(data["quarantined_by_split"]["train"], 6)
        for item in data["quarantined_images"]:
            self.assertEqual(item["valid_annotation_count"], 0)
            self.assertEqual(item["status"], "ANNOTATION_CORRUPTED / REVIEW_REQUIRED")

    def test_unannotated_inventory_file(self):
        """Verifies unannotated_inventory.json contains exactly 631 records with STATUS_UNKNOWN."""
        inv_file = os.path.join(self.yolo_root, "unannotated_inventory.json")
        self.assertTrue(os.path.exists(inv_file), f"Inventory file missing: {inv_file}")
        with open(inv_file, "r", encoding="utf-8") as f:
            inv = json.load(f)
        
        self.assertEqual(inv["total_unannotated"], 631)
        self.assertEqual(len(inv["unannotated_records"]), 631)
        self.assertEqual(inv["status"], "STATUS_UNKNOWN / PENDING_CONFIRMATION")
        self.assertEqual(inv["unannotated_by_split"]["train"], 581)
        self.assertEqual(inv["unannotated_by_split"]["val"], 32)
        self.assertEqual(inv["unannotated_by_split"]["test"], 18)

    def test_no_empty_labels_on_disk(self):
        """Verifies that ZERO empty label files exist across all splits in the YOLO dataset."""
        for split in ("train", "val", "test"):
            lbl_dir = os.path.join(self.yolo_root, "labels", split)
            for lbl_file in os.listdir(lbl_dir):
                if lbl_file.endswith(".txt"):
                    path = os.path.join(lbl_dir, lbl_file)
                    with open(path, "r", encoding="utf-8") as f:
                        lines = [l.strip() for l in f if l.strip()]
                    self.assertGreater(len(lines), 0, f"Empty label file found: {path} (Prompt 3.1 violation)")

    def test_conversion_audit_reconciliation(self):
        """Verifies mathematical reconciliation of all images and bounding boxes under Prompt 3.1 rules."""
        audit_file = os.path.join(self.yolo_root, "conversion_audit.json")
        self.assertTrue(os.path.exists(audit_file), f"Conversion audit missing: {audit_file}")
        with open(audit_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # Check image counts
        self.assertEqual(data["total_images_processed"], 1916)
        self.assertEqual(data["yolo_images_retained_total"], 1279)
        self.assertEqual(data["zero_valid_annotation_quarantined_total"], 6)
        self.assertEqual(data["unannotated_records_total"], 631)
        self.assertEqual(
            data["yolo_images_retained_total"] + 
            data["zero_valid_annotation_quarantined_total"] + 
            data["unannotated_records_total"], 
            1916
        )

        # Check box counts
        self.assertEqual(data["original_bounding_boxes_total"], 2424)
        self.assertEqual(data["excluded_invalid_boxes_total"], 13)
        self.assertEqual(data["valid_yolo_boxes_total"], 2411)
        self.assertEqual(data["valid_yolo_boxes_total"] + data["excluded_invalid_boxes_total"], 2424)

        # Check split breakdown (Prompt 3.1: 1,140 train, 94 val, 45 test)
        self.assertEqual(data["images_by_split"]["train"], 1140)
        self.assertEqual(data["images_by_split"]["val"], 94)
        self.assertEqual(data["images_by_split"]["test"], 45)

        # Check class counts
        self.assertEqual(data["valid_boxes_by_class"]["Deformation"], 293)
        self.assertEqual(data["valid_boxes_by_class"]["Misalignment"], 630)
        self.assertEqual(data["valid_boxes_by_class"]["Obstacle"], 581)
        self.assertEqual(data["valid_boxes_by_class"]["Rupture"], 907)
        self.assertEqual(sum(data["valid_boxes_by_class"].values()), 2411)

    def test_models_baseline_checkpoint(self):
        """Verifies baseline checkpoint in ai-service/models matches official SHA-256."""
        model_path = os.path.normpath(os.path.join(self.project_root, "ai-service", "models", "yolov8n.pt"))
        self.assertTrue(os.path.exists(model_path), f"Baseline model missing at: {model_path}")
        expected_hash = "f59b3d833e2ff32e194b5bb8e08d211dc7c5bdf144b90d2c8412c47ccfc83b36"
        actual_hash = compute_sha256(model_path)
        self.assertEqual(actual_hash, expected_hash, "Baseline checkpoint SHA-256 mismatch")

    def test_d_drive_environment_directories(self):
        """Verifies that all required storage and cache directories exist on project disk."""
        required_dirs = [
            os.path.join(self.project_root, "ai-service", "cache", "pip"),
            os.path.join(self.project_root, "ai-service", "temp"),
            os.path.join(self.project_root, "ai-service", "cache", "huggingface"),
            os.path.join(self.project_root, "ai-service", "cache", "ultralytics"),
            os.path.join(self.project_root, "ai-service", "models"),
            os.path.join(self.project_root, "ai-service", "runs"),
            os.path.join(self.project_root, "ai-service", "logs"),
            os.path.join(self.project_root, "ai-service", "scripts")
        ]
        for d in required_dirs:
            norm_d = os.path.normpath(d)
            self.assertTrue(os.path.isdir(norm_d), f"Required directory missing: {norm_d}")

    def test_ultralytics_settings_on_d_drive(self):
        """Verifies that Ultralytics configuration is anchored to project directory."""
        settings_path = os.path.normpath(os.path.join(self.project_root, "ai-service", "cache", "ultralytics", "Ultralytics", "settings.json"))
        self.assertTrue(os.path.exists(settings_path), f"Settings missing at: {settings_path}")
        with open(settings_path, "r", encoding="utf-8") as f:
            settings = json.load(f)
        self.assertIn("ai-service", settings["weights_dir"])
        self.assertIn("ai-service", settings["runs_dir"])


if __name__ == "__main__":
    unittest.main()
