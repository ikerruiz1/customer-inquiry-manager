"""Customer attachment presigned S3 upload and download endpoints."""
import uuid
from typing import Dict, Any
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

from app.core.security import require_tier1_agent
from app.services.s3_service import S3Service, get_s3_service

router = APIRouter()


class PresignedUploadRequest(BaseModel):
    """Attachment presigned upload request payload."""

    filename: str = Field(..., description="Original client filename")
    content_type: str = Field(default="application/octet-stream", description="MIME content type")


@router.post("/presigned-url", status_code=status.HTTP_200_OK)
async def create_presigned_upload_url(
    payload: PresignedUploadRequest,
    s3_service: S3Service = Depends(get_s3_service),
) -> Dict[str, Any]:
    """Generate a presigned S3 PUT URL for uploading customer screenshots or PDF invoices."""
    extension = payload.filename.split(".")[-1] if "." in payload.filename else "bin"
    unique_key = f"inquiry-attachments/{uuid.uuid4()}.{extension}"

    result = s3_service.generate_presigned_upload_url(
        object_key=unique_key,
        content_type=payload.content_type,
    )
    return result


@router.get("/presigned-download/{object_key:path}")
async def get_presigned_download_url(
    object_key: str,
    s3_service: S3Service = Depends(get_s3_service),
    current_user: dict = Depends(require_tier1_agent),
) -> Dict[str, str]:
    """Generate a presigned S3 GET URL allowing an authorized agent to view an attachment."""
    url = s3_service.generate_presigned_download_url(object_key)
    return {"download_url": url, "object_key": object_key}
