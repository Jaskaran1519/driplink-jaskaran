from typing import List, Literal, Optional, Dict, Any
from pydantic import BaseModel, Field

OverlayType = Literal["text", "image", "sticker", "video"]


class Position(BaseModel):
    x: float = Field(..., description="left position in percentage (0-100)")
    y: float = Field(..., description="top position in percentage (0-100)")


class Size(BaseModel):
    width: float = Field(..., description="width in percentage (0-100)")
    height: float = Field(..., description="height in percentage (0-100)")


class Timing(BaseModel):
    start: float = Field(..., description="start in seconds")
    end: float = Field(..., description="end in seconds")


class Overlay(BaseModel):
    id: str
    type: OverlayType
    content: str  # text content or image/video URL/path; for assets, we will map filenames
    position: Position
    size: Size
    timing: Timing


class Metadata(BaseModel):
    overlays: List[Overlay]
    # optionally: canvas info (duration, width/height) if needed later


class UploadResponse(BaseModel):
    job_id: str
    status_url: str
    result_url: str


class StatusResponse(BaseModel):
    job_id: str
    status: Literal["queued", "processing", "completed", "error"]
    progress: float = 0.0
    message: Optional[str] = None


class ResultResponse(BaseModel):
    job_id: str
    url: Optional[str]
