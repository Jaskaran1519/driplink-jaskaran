import os
import json
from pathlib import Path
from typing import Dict, Any
from fastapi import UploadFile

BASE_DIR = Path(__file__).resolve().parent.parent  # app/
DATA_ROOT = BASE_DIR / "data"
INPUT_ROOT = DATA_ROOT / "inputs"
OUTPUT_ROOT = DATA_ROOT / "outputs"
JOBS_ROOT = DATA_ROOT / "jobs"


def ensure_data_dirs() -> None:
    for p in [DATA_ROOT, INPUT_ROOT, OUTPUT_ROOT, JOBS_ROOT]:
        p.mkdir(parents=True, exist_ok=True)


def prepare_job_dir(job_id: str) -> Path:
    job_dir = JOBS_ROOT / job_id
    (job_dir / "assets").mkdir(parents=True, exist_ok=True)
    return job_dir


def write_metadata(job_dir: Path, metadata: Dict[str, Any]) -> Path:
    meta_path = job_dir / "metadata.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    return meta_path


async def save_upload_file(job_dir: Path, file: UploadFile, filename: str | None = None) -> str:
    dest_dir = job_dir / "assets"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_name = filename or file.filename or "upload.bin"
    dest_path = dest_dir / dest_name
    # stream write
    with open(dest_path, "wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
    await file.close()
    return str(dest_path)


def get_result_path(job_id: str) -> str:
    return str(OUTPUT_ROOT / job_id / "output.mp4")


def get_result_rel_url(job_id: str) -> str:
    # exposed via StaticFiles at /results
    return f"/results/{job_id}/output.mp4"
