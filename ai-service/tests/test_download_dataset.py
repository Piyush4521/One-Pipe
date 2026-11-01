"""
Unit Tests for PipeBot Dataset Acquisition Script
Covers URL sanitization, image verification, dimension checking,
resumption, retry backoff, failure handling, and manifest generation.
"""

import os
import sys
import json
import tempfile
import unittest
from unittest.mock import patch, MagicMock
import urllib.error
from PIL import Image

# Ensure ai-service/scripts is on sys.path
SCRIPT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "scripts"))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from download_dataset import (
    sanitize_url,
    compute_sha256,
    verify_image_file,
    DatasetDownloader,
    EXPECTED_NDJSON_SHA256,
)


class TestDatasetAcquisition(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.test_root = self.temp_dir.name
        self.output_root = os.path.join(self.test_root, "source_images")
        self.inventories_dir = os.path.join(self.test_root, "inventories")

    def tearDown(self):
        self.temp_dir.cleanup()

    def create_dummy_jpeg(self, path: str, width: int = 640, height: int = 640):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        img = Image.new("RGB", (width, height), color=(100, 150, 200))
        img.save(path, "JPEG")

    def test_sanitize_url(self):
        url = "https://cdn.example.com/images/sample.jpg?Expires=1793957400&Signature=secretToken123&Key=key1"
        sanitized = sanitize_url(url)
        self.assertEqual(sanitized, "https://cdn.example.com/images/sample.jpg")
        self.assertNotIn("secretToken", sanitized)
        self.assertNotIn("Expires", sanitized)

    def test_verify_image_file_valid(self):
        img_path = os.path.join(self.test_root, "test.jpg")
        self.create_dummy_jpeg(img_path, 640, 640)
        is_valid, dims, err = verify_image_file(img_path, 640, 640)
        self.assertTrue(is_valid)
        self.assertEqual(dims, (640, 640))
        self.assertIsNone(err)

    def test_verify_image_file_dimension_mismatch(self):
        img_path = os.path.join(self.test_root, "mismatch.jpg")
        self.create_dummy_jpeg(img_path, 800, 600)
        is_valid, dims, err = verify_image_file(img_path, 640, 640)
        self.assertFalse(is_valid)
        self.assertEqual(dims, (800, 600))
        self.assertIn("Dimension mismatch", err)

    def test_verify_image_file_corrupt(self):
        img_path = os.path.join(self.test_root, "corrupt.jpg")
        with open(img_path, "wb") as f:
            f.write(b"NOT_A_JPEG_FILE_HEADER_CORRUPTED_BYTES")
        is_valid, dims, err = verify_image_file(img_path, 640, 640)
        self.assertFalse(is_valid)
        self.assertIsNone(dims)
        self.assertIn("Image decode failure", err)

    def test_verify_image_file_nonexistent(self):
        is_valid, dims, err = verify_image_file(os.path.join(self.test_root, "none.jpg"), 640, 640)
        self.assertFalse(is_valid)
        self.assertIn("File does not exist", err)

    def test_resumption_reuses_existing_valid_file(self):
        downloader = DatasetDownloader(
            ndjson_path="dummy.ndjson",
            output_root=self.output_root,
            inventories_dir=self.inventories_dir,
        )

        record = {
            "file": "resumed_sample.jpg",
            "split": "train",
            "width": 640,
            "height": 640,
            "url": "https://cdn.example.com/sample.jpg?Signature=xyz",
            "annotations": {"boxes": [[0, 0.5, 0.5, 0.2, 0.2]]},
        }

        # Create valid image on disk in target split
        target_path = os.path.join(self.output_root, "train", "resumed_sample.jpg")
        self.create_dummy_jpeg(target_path, 640, 640)
        expected_hash = compute_sha256(target_path)

        # Execute download_single_image without network (mocking urllib to fail if called)
        with patch("urllib.request.urlopen", side_effect=Exception("Network should not be called")):
            result = downloader.download_single_image(record)

        self.assertEqual(result["verification_status"], "VERIFIED")
        self.assertEqual(result["source"], "REUSED_EXISTING")
        self.assertEqual(result["sha256"], expected_hash)
        self.assertEqual(result["annotation_status"], "ANNOTATED")
        self.assertEqual(result["annotation_count"], 1)

    @patch("urllib.request.urlopen")
    def test_retry_on_transient_failure_then_success(self, mock_urlopen):
        downloader = DatasetDownloader(
            ndjson_path="dummy.ndjson",
            output_root=self.output_root,
            inventories_dir=self.inventories_dir,
            max_retries=3,
            backoff_factor=0.01,
        )

        record = {
            "file": "retry_sample.jpg",
            "split": "val",
            "width": 640,
            "height": 640,
            "url": "https://cdn.example.com/retry.jpg?Signature=xyz",
        }

        # Create a valid JPEG in memory to return
        tmp_img = os.path.join(self.test_root, "dummy_src.jpg")
        self.create_dummy_jpeg(tmp_img, 640, 640)
        with open(tmp_img, "rb") as f:
            jpeg_bytes = f.read()

        # Mock first call raises URLError (transient), second call returns HTTP 200 with bytes
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.side_effect = [jpeg_bytes, b""]
        mock_resp.__enter__.return_value = mock_resp

        mock_urlopen.side_effect = [
            urllib.error.URLError("Temporary connection reset"),
            mock_resp,
        ]

        result = downloader.download_single_image(record)
        self.assertEqual(result["verification_status"], "VERIFIED")
        self.assertEqual(result["source"], "DOWNLOADED")
        self.assertEqual(result["annotation_status"], "STATUS_UNKNOWN / PENDING_CONFIRMATION")
        self.assertEqual(mock_urlopen.call_count, 2)

    @patch("urllib.request.urlopen")
    def test_permanent_http_error_handling(self, mock_urlopen):
        downloader = DatasetDownloader(
            ndjson_path="dummy.ndjson",
            output_root=self.output_root,
            inventories_dir=self.inventories_dir,
            max_retries=3,
            backoff_factor=0.01,
        )

        record = {
            "file": "missing.jpg",
            "split": "test",
            "width": 640,
            "height": 640,
            "url": "https://cdn.example.com/missing.jpg?Signature=expired",
        }

        # Mock HTTP 403 Forbidden
        mock_urlopen.side_effect = urllib.error.HTTPError(
            "https://cdn.example.com/missing.jpg", 403, "Forbidden", {}, None
        )

        result = downloader.download_single_image(record)
        self.assertEqual(result["verification_status"], "FAILED")
        self.assertIn("HTTP 403", result["error"])
        self.assertEqual(result["sanitized_url"], "https://cdn.example.com/missing.jpg")
        # 403 is non-retryable, should only attempt once
        self.assertEqual(mock_urlopen.call_count, 1)

    def test_manifest_generation(self):
        downloader = DatasetDownloader(
            ndjson_path="dummy.ndjson",
            output_root=self.output_root,
            inventories_dir=self.inventories_dir,
        )

        results = [
            {
                "file": "img1.jpg",
                "split": "train",
                "annotation_status": "ANNOTATED",
                "annotation_count": 2,
                "expected_dimensions": [640, 640],
                "actual_dimensions": [640, 640],
                "byte_count": 35000,
                "sha256": "hash_1",
                "verification_status": "VERIFIED",
                "source": "DOWNLOADED",
            },
            {
                "file": "img2.jpg",
                "split": "val",
                "annotation_status": "STATUS_UNKNOWN / PENDING_CONFIRMATION",
                "annotation_count": 0,
                "expected_dimensions": [640, 640],
                "actual_dimensions": [640, 640],
                "byte_count": 32000,
                "sha256": "hash_2",
                "verification_status": "VERIFIED",
                "source": "REUSED_EXISTING",
            },
            {
                "file": "img3.jpg",
                "split": "test",
                "annotation_status": "ANNOTATED",
                "annotation_count": 1,
                "expected_dimensions": [640, 640],
                "actual_dimensions": None,
                "byte_count": 0,
                "sha256": None,
                "verification_status": "FAILED",
                "source": "ATTEMPTED_DOWNLOAD",
                "sanitized_url": "https://cdn.example.com/img3.jpg",
                "error": "HTTP 404: Not Found",
            },
        ]

        summary = downloader.generate_manifests(results, total_records=3, duration=1.25)
        self.assertEqual(summary["total_expected_records"], 3)
        self.assertEqual(summary["total_verified_images"], 2)
        self.assertEqual(summary["successful_downloads"], 1)
        self.assertEqual(summary["already_verified_reused"], 1)
        self.assertEqual(summary["failed_downloads"], 1)

        # Check manifest files exist and are valid JSON
        with open(os.path.join(self.inventories_dir, "download_verification_manifest.json")) as f:
            manifest = json.load(f)
            self.assertEqual(len(manifest), 2)

        with open(os.path.join(self.inventories_dir, "download_failures.json")) as f:
            failures = json.load(f)
            self.assertEqual(len(failures), 1)

        with open(os.path.join(self.inventories_dir, "download_summary.json")) as f:
            saved_summary = json.load(f)
            self.assertEqual(saved_summary["total_verified_images"], 2)


if __name__ == "__main__":
    unittest.main()

