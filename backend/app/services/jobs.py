from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, Optional, Any
from threading import Lock
from concurrent.futures import ThreadPoolExecutor
import traceback

from . import storage
from .renderer import render_with_overlays


@dataclass
class JobState:
    job_id: str
    status: str = "queued"  # queued | processing | completed | error
    progress: float = 0.0
    message: Optional[str] = None
    result_path: Optional[str] = None


class JobManager:
    def __init__(self) -> None:
        self._jobs: Dict[str, JobState] = {}
        self._lock = Lock()
        self._pool = ThreadPoolExecutor(max_workers=2)

    def start_job(self, job_id: str, *, input_path: str, meta: Dict[str, Any], job_dir, overlay_assets: Dict[str, str]) -> None:
        st = JobState(job_id=job_id, status="queued", progress=0.0)
        with self._lock:
            self._jobs[job_id] = st

        def _run():
            self._update(job_id, status="processing", progress=0.05, message="Starting render")
            try:
                out_dir = storage.OUTPUT_ROOT / job_id
                out_dir.mkdir(parents=True, exist_ok=True)
                output_path = str(out_dir / "output.mp4")
                render_with_overlays(
                    input_path=input_path,
                    output_path=output_path,
                    meta=meta,
                    assets=overlay_assets,
                    progress_cb=lambda p, msg=None: self._update(job_id, progress=p, message=msg),
                )
                self._update(job_id, status="completed", progress=1.0, message="Completed", result_path=output_path)
            except Exception as e:
                tb = traceback.format_exc()
                self._update(job_id, status="error", progress=1.0, message=f"{e}\n{tb}")

        self._pool.submit(_run)

    def _update(self, job_id: str, **changes):
        with self._lock:
            st = self._jobs.get(job_id)
            if not st:
                return
            for k, v in changes.items():
                setattr(st, k, v)

    def get_status(self, job_id: str):
        with self._lock:
            st = self._jobs.get(job_id)
            if not st:
                return None
            return {
                "job_id": st.job_id,
                "status": st.status,
                "progress": st.progress,
                "message": st.message,
            }


manager = JobManager()
