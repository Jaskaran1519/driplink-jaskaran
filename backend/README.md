# DripLink Render Backend (FastAPI + FFmpeg)

A minimal, scalable FastAPI backend that accepts a video and overlay metadata (matching your frontend Redux schema), renders the final video with overlays using ffmpeg, and exposes status/result endpoints.

## Project Structure

```
backend/
  app/
    main.py                # FastAPI app, CORS, static mount, router include
    routes/
      __init__.py
      videos.py            # /api/upload, /api/status/{job_id}, /api/result/{job_id}
    schemas/
      models.py            # Pydantic schemas for metadata & responses
    services/
      __init__.py
      storage.py           # File/dir management for jobs, inputs, outputs
      jobs.py              # In-memory job manager using ThreadPoolExecutor
      renderer.py          # ffmpeg command builder & runner
  requirements.txt
  README.md
```

Data will be stored under `backend/app/data/`:
- `inputs/`, `outputs/`, and `jobs/{job_id}` with assets and metadata.
- Completed videos are served as static files at `/results/{job_id}/output.mp4`.

## Requirements

- Python 3.10+
- FFmpeg installed and available on PATH (verify with `ffmpeg -version`).
- pip install requirements:

```bash
pip install -r requirements.txt
```

## Run

From the `backend/` directory:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check:
- GET http://localhost:8000/health

Static results:
- GET http://localhost:8000/results/<job_id>/output.mp4

## API

### POST /api/upload
Multipart form-data. Fields:
- `video`: the base video file (mp4 recommended)
- `metadata`: stringified JSON matching the Redux overlay schema
- `assets` (optional): one or more files for image/video overlays. If you send an asset file named exactly as `content` for that overlay (e.g., `overlay_<id>.png`), it will be resolved to that path during rendering.

Example `metadata` JSON (percent-based positions/sizes, seconds for timing):
```json
{
  "overlays": [
    {
      "id": "t1",
      "type": "text",
      "content": "Hello World",
      "position": { "x": 10, "y": 10 },
      "size": { "width": 40, "height": 10 },
      "timing": { "start": 0, "end": 5 }
    },
    {
      "id": "img1",
      "type": "image",
      "content": "my_logo.png",
      "position": { "x": 60, "y": 70 },
      "size": { "width": 20, "height": 15 },
      "timing": { "start": 1, "end": 10 }
    }
  ]
}
```

Response:
```json
{
  "job_id": "<uuid>",
  "status_url": "/api/status/<uuid>",
  "result_url": "/api/result/<uuid>"
}
```

### GET /api/status/{job_id}
Returns current state of the job.

Response:
```json
{
  "job_id": "<uuid>",
  "status": "queued | processing | completed | error",
  "progress": 0.42,
  "message": "Starting render"
}
```

### GET /api/result/{job_id}
Returns a URL for the output video (served under `/results`) when the job is completed.

Response (completed):
```json
{
  "job_id": "<uuid>",
  "url": "/results/<uuid>/output.mp4"
}
```
If the job is not completed, returns HTTP 409.

## Notes

- Text overlays are rendered with `drawtext` (white with light border). The overlay `size.height` influences the font size (approx 60% of the box height).
- Image/video overlays are scaled to percentage-based width/height relative to the base video. Positioning uses percentage-based `x`,`y`.
- The backend currently stores jobs and results on disk and keeps job statuses in-memory. For production, consider:
  - Persistent job store (e.g., Redis, DB)
  - Distributed workers (e.g., Celery, RQ)
  - Signed URLs for results

## Example cURL

```bash
curl -X POST http://localhost:8000/api/upload \
  -F "video=@/path/to/input.mp4" \
  -F "metadata=$(cat metadata.json)" \
  -F "assets=@/path/to/my_logo.png"

curl http://localhost:8000/api/status/<job_id>

curl -L http://localhost:8000/api/result/<job_id>
```
