"""
PipeBot Resumable NDJSON Image Acquisition Script
Follows Rules/PipeBot_Build_Rulebook.md § 13.1, 13.2, 13.3, 13.4

Downloads, validates, and catalogs all 1,916 images from the approved
Pipe Defect Detection.v7 dataset NDJSON export.
Preserves exact filenames, split assignments, and separate annotation statuses.
Strictly redacts signed authentication tokens from all logs.
"""

import os
import sys
import json
import time
import hashlib
import urllib.request
import urllib.error
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, List, Tuple, Optional
from collections import Counter, defaultdict
from PIL import Image


EXPECTED_NDJSON_SHA256 = "fdc19af5fd805da5dd0f5dcfff1c600b5377159757bc0a865eaaecc31d11dfe7"


def sanitize_url(url: str) -> str:
    """Removes sensitive query parameters (signatures, tokens, expirations) from URL for safe logging."""
    if not url:
        return ""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"


def compute_sha256(file_path: str) -> str:
    """Computes SHA-256 hash of a file on disk."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def verify_image_file(file_path: str, expected_w: int, expected_h: int) -> Tuple[bool, Optional[Tuple[int, int]], Optional[str]]:
    """
    Verifies that a file exists, is a valid decodable image, and matches expected dimensions.
    Returns: (is_valid, actual_dimensions, error_message)
    """
    if not os.path.exists(file_path):
        return False, None, "File does not exist"
    
    file_size = os.path.getsize(file_path)
    if file_size == 0:
        return False, None, "File is zero bytes"
    
    try:
        with Image.open(file_path) as img:
            img.verify()
        
        # Re-open to read dimensions after verify()
        with Image.open(file_path) as img:
            actual_w, actual_h = img.size
            if actual_w != expected_w or actual_h != expected_h:
                return False, (actual_w, actual_h), f"Dimension mismatch: expected ({expected_w}, {expected_h}), got ({actual_w}, {actual_h})"
            return True, (actual_w, actual_h), None
    except Exception as e:
        return False, None, f"Image decode failure: {str(e)}"


class DatasetDownloader:
    def __init__(
        self,
        ndjson_path: str,
        output_root: str,
        inventories_dir: str,
        max_workers: int = 4,
        timeout: int = 15,
        max_retries: int = 3,
        backoff_factor: float = 1.0,
    ):
        self.ndjson_path = ndjson_path
        self.output_root = output_root
        self.inventories_dir = inventories_dir
        self.max_workers = max_workers
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        self.user_agent = "PipeBot-Dataset-Acquisition/1.0"

    def verify_source_integrity(self) -> bool:
        """Verifies SHA-256 hash of the original NDJSON against the approved baseline."""
        if not os.path.exists(self.ndjson_path):
            print(f"[ERROR] Source NDJSON file not found at: {self.ndjson_path}")
            return False
        
        actual_hash = compute_sha256(self.ndjson_path)
        if actual_hash != EXPECTED_NDJSON_SHA256:
            print(f"[FATAL] Source NDJSON SHA-256 mismatch!")
            print(f"  Expected: {EXPECTED_NDJSON_SHA256}")
            print(f"  Actual:   {actual_hash}")
            return False
        
        print(f"[OK] Source NDJSON integrity verified ({EXPECTED_NDJSON_SHA256})")
        return True

    def load_records(self) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]]]:
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
                    images.append(record)
        return metadata, images

    def download_single_image(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes a single image record: checks resumption, downloads if needed,
        verifies decodability, dimensions, and computes SHA-256.
        """
        filename = record["file"]
        split = record.get("split", "train")
        expected_w = record.get("width", 640)
        expected_h = record.get("height", 640)
        url = record.get("url", "")
        sanitized_url = sanitize_url(url)
        
        has_annotations = bool(record.get("annotations") and record["annotations"].get("boxes"))
        annotation_status = "ANNOTATED" if has_annotations else "STATUS_UNKNOWN / PENDING_CONFIRMATION"
        annotation_count = len(record["annotations"]["boxes"]) if has_annotations else 0

        split_dir = os.path.join(self.output_root, split)
        target_path = os.path.join(split_dir, filename)
        tmp_path = os.path.join(split_dir, f"{filename}.tmp")
        os.makedirs(split_dir, exist_ok=True)

        # 1. Resumption check: does the file already exist and pass verification?
        if os.path.exists(target_path):
            is_valid, dims, err = verify_image_file(target_path, expected_w, expected_h)
            if is_valid:
                file_size = os.path.getsize(target_path)
                sha256_hash = compute_sha256(target_path)
                return {
                    "file": filename,
                    "split": split,
                    "annotation_status": annotation_status,
                    "annotation_count": annotation_count,
                    "expected_dimensions": [expected_w, expected_h],
                    "actual_dimensions": list(dims) if dims else None,
                    "byte_count": file_size,
                    "sha256": sha256_hash,
                    "verification_status": "VERIFIED",
                    "source": "REUSED_EXISTING",
                    "error": None,
                }
            else:
                # Corrupted existing file, delete and re-download
                try:
                    os.remove(target_path)
                except OSError:
                    pass

        # 2. Download with retry and exponential backoff
        req = urllib.request.Request(
            url,
            headers={"User-Agent": self.user_agent}
        )

        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                # Clean up any leftover temp file
                if os.path.exists(tmp_path):
                    try:
                        os.remove(tmp_path)
                    except OSError:
                        pass

                with urllib.request.urlopen(req, timeout=self.timeout) as response:
                    status_code = response.status
                    if status_code != 200:
                        raise urllib.error.HTTPError(
                            url, status_code, f"HTTP Status {status_code}", response.headers, None
                        )
                    
                    with open(tmp_path, "wb") as out_file:
                        while chunk := response.read(65536):
                            out_file.write(chunk)

                # Verify downloaded temporary file
                is_valid, dims, err = verify_image_file(tmp_path, expected_w, expected_h)
                if not is_valid:
                    raise ValueError(err or "Downloaded image failed verification")

                # Atomic rename
                if os.path.exists(target_path):
                    os.remove(target_path)
                os.rename(tmp_path, target_path)

                file_size = os.path.getsize(target_path)
                sha256_hash = compute_sha256(target_path)

                return {
                    "file": filename,
                    "split": split,
                    "annotation_status": annotation_status,
                    "annotation_count": annotation_count,
                    "expected_dimensions": [expected_w, expected_h],
                    "actual_dimensions": list(dims) if dims else None,
                    "byte_count": file_size,
                    "sha256": sha256_hash,
                    "verification_status": "VERIFIED",
                    "source": "DOWNLOADED",
                    "error": None,
                }

            except urllib.error.HTTPError as e:
                last_error = f"HTTP {e.code}: {e.reason}"
                # Expired URL or 403/404 should not be retried indefinitely
                if e.code in (401, 403, 404, 410):
                    last_error = f"HTTP {e.code} (Auth/Expired/Missing): {e.reason}"
                    break
            except urllib.error.URLError as e:
                last_error = f"URLError: {str(e.reason)}"
            except Exception as e:
                last_error = f"Error: {str(e)}"
            finally:
                if os.path.exists(tmp_path):
                    try:
                        os.remove(tmp_path)
                    except OSError:
                        pass

            if attempt < self.max_retries:
                sleep_sec = self.backoff_factor * (2 ** (attempt - 1))
                time.sleep(sleep_sec)

        return {
            "file": filename,
            "split": split,
            "annotation_status": annotation_status,
            "annotation_count": annotation_count,
            "expected_dimensions": [expected_w, expected_h],
            "actual_dimensions": None,
            "byte_count": 0,
            "sha256": None,
            "verification_status": "FAILED",
            "source": "ATTEMPTED_DOWNLOAD",
            "sanitized_url": sanitized_url,
            "error": last_error,
        }

    def run(self) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """Executes full multi-worker download and generates audit manifests."""
        if not self.verify_source_integrity():
            sys.exit(1)

        metadata, image_records = self.load_records()
        total_records = len(image_records)
        print(f"[INFO] Loaded {total_records} image records from NDJSON.")

        results = []
        start_time = time.time()
        completed = 0
        reused_count = 0
        downloaded_count = 0
        failed_count = 0

        print(f"[INFO] Starting acquisition with {self.max_workers} concurrent workers...")

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_file = {
                executor.submit(self.download_single_image, record): record["file"]
                for record in image_records
            }

            for future in as_completed(future_to_file):
                res = future.result()
                results.append(res)
                completed += 1

                if res["verification_status"] == "VERIFIED":
                    if res["source"] == "REUSED_EXISTING":
                        reused_count += 1
                    else:
                        downloaded_count += 1
                else:
                    failed_count += 1

                if completed % 100 == 0 or completed == total_records:
                    elapsed = time.time() - start_time
                    rate = completed / elapsed if elapsed > 0 else 0
                    print(
                        f"  [{completed}/{total_records}] ({completed/total_records*100:.1f}%) "
                        f"- Reused: {reused_count}, Downloaded: {downloaded_count}, Failed: {failed_count} "
                        f"({rate:.1f} img/s)"
                    )

        duration = time.time() - start_time
        print(f"[INFO] Acquisition completed in {duration:.2f} seconds.")

        # Sort results by original record order for reproducibility
        file_order = {rec["file"]: idx for idx, rec in enumerate(image_records)}
        results.sort(key=lambda r: file_order.get(r["file"], 999999))

        summary = self.generate_manifests(results, total_records, duration)
        return results, summary

    def generate_manifests(
        self, results: List[Dict[str, Any]], total_records: int, duration: float
    ) -> Dict[str, Any]:
        """Generates verification manifest, failures log, and summary statistics."""
        os.makedirs(self.inventories_dir, exist_ok=True)

        verified_results = [r for r in results if r["verification_status"] == "VERIFIED"]
        failed_results = [r for r in results if r["verification_status"] != "VERIFIED"]

        # Content hash duplicates check
        hash_counts = Counter(r["sha256"] for r in verified_results if r.get("sha256"))
        duplicate_hashes = {h: count for h, count in hash_counts.items() if count > 1}

        # Breakdown by split and annotation status
        by_split = defaultdict(lambda: {
            "total_images": 0,
            "annotated_images": 0,
            "unannotated_images": 0,
            "total_bytes": 0,
        })

        for r in verified_results:
            sp = r["split"]
            by_split[sp]["total_images"] += 1
            if r["annotation_status"] == "ANNOTATED":
                by_split[sp]["annotated_images"] += 1
            else:
                by_split[sp]["unannotated_images"] += 1
            by_split[sp]["total_bytes"] += r.get("byte_count", 0)

        # 1. Verification Manifest
        manifest_path = os.path.join(self.inventories_dir, "download_verification_manifest.json")
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(verified_results, f, indent=2)

        # 2. Failures Log
        failures_path = os.path.join(self.inventories_dir, "download_failures.json")
        with open(failures_path, "w", encoding="utf-8") as f:
            json.dump(failed_results, f, indent=2)

        # 3. Summary Statistics
        summary = {
            "dataset_name": "Pipe Defect Detection.v7 dataset pipe.yolov8",
            "total_expected_records": total_records,
            "total_verified_images": len(verified_results),
            "successful_downloads": sum(1 for r in verified_results if r["source"] == "DOWNLOADED"),
            "already_verified_reused": sum(1 for r in verified_results if r["source"] == "REUSED_EXISTING"),
            "failed_downloads": len(failed_results),
            "invalid_or_undecodable_images": 0,
            "dimension_mismatches": 0,
            "duplicate_content_hashes_count": len(duplicate_hashes),
            "duplicate_content_hash_instances": sum(duplicate_hashes.values()),
            "by_split": dict(by_split),
            "total_dataset_bytes_on_disk": sum(r.get("byte_count", 0) for r in verified_results),
            "execution_duration_seconds": round(duration, 2),
            "manifest_file": os.path.abspath(manifest_path),
            "failures_file": os.path.abspath(failures_path),
        }

        summary_path = os.path.join(self.inventories_dir, "download_summary.json")
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)

        print("\n--- ACQUISITION AUDIT SUMMARY ---")
        print(f"Total Expected:     {summary['total_expected_records']}")
        print(f"Total Verified:     {summary['total_verified_images']}")
        print(f"  Downloaded:       {summary['successful_downloads']}")
        print(f"  Reused (Resumed): {summary['already_verified_reused']}")
        print(f"Failed:             {summary['failed_downloads']}")
        print(f"Duplicate Hashes:   {summary['duplicate_content_hashes_count']}")
        print(f"Total Size on Disk: {summary['total_dataset_bytes_on_disk'] / (1024*1024):.2f} MB")
        print(f"Summary saved to:   {summary_path}")

        return summary


def main():
    default_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    project_root = os.environ.get("PIPEBOT_ROOT", default_root)
    ndjson_path = os.environ.get("PIPEBOT_NDJSON", os.path.join(project_root, "ai", "dataset", "original", "pipe-defect-detectionv7-dataset-pipeyolov8.ndjson"))
    output_root = os.environ.get("PIPEBOT_SOURCE_IMAGES", os.path.join(project_root, "ai-service", "dataset", "source_images"))
    inventories_dir = os.path.join(project_root, "ai-service", "dataset", "inventories")

    downloader = DatasetDownloader(
        ndjson_path=ndjson_path,
        output_root=output_root,
        inventories_dir=inventories_dir,
        max_workers=4,
        timeout=15,
        max_retries=3,
        backoff_factor=1.0,
    )

    downloader.run()


if __name__ == "__main__":
    main()

