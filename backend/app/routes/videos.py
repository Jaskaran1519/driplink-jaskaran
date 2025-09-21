from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List, Optional
import json
import uuid
from ..schemas.models import UploadResponse, StatusResponse, ResultResponse, Metadata
from ..services import storage, jobs

router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
async def upload_video(
    video: UploadFile = File(...),
    metadata: str = Form(...),
    assets: Optional[List[UploadFile]] = File(None),
):
    try:
        meta_dict = json.loads(metadata)
        meta = Metadata(**meta_dict)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid metadata JSON: {e}")

    job_id = str(uuid.uuid4())

    # Prepare storage
    job_dir = storage.prepare_job_dir(job_id)
    input_path = await storage.save_upload_file(job_dir, video, filename="input.mp4")
    meta_path = storage.write_metadata(job_dir, meta_dict)

    # Save overlay asset files if provided (match by overlay id in filename: overlay_<id>.*)
    overlay_assets = {}
    if assets:
        for f in assets:
            overlay_assets[f.filename] = await storage.save_upload_file(job_dir, f)

    # Start background render job
    jobs.manager.start_job(job_id, input_path=input_path, meta=meta_dict, job_dir=job_dir, overlay_assets=overlay_assets)

    return UploadResponse(job_id=job_id, status_url=f"/api/status/{job_id}", result_url=f"/api/result/{job_id}")


@router.get("/status/{job_id}", response_model=StatusResponse)
async def get_status(job_id: str):
    st = jobs.manager.get_status(job_id)
    if not st:
        raise HTTPException(status_code=404, detail="job not found")
    return st


@router.get("/result/{job_id}", response_model=ResultResponse)
async def get_result(job_id: str):
    st = jobs.manager.get_status(job_id)
    if not st:
        raise HTTPException(status_code=404, detail="job not found")
    if st.get("status") != "completed":
        raise HTTPException(status_code=409, detail="job not completed")
    # Expose static file path mounted at /results
    rel_url = storage.get_result_rel_url(job_id)
    return ResultResponse(job_id=job_id, url=rel_url)
