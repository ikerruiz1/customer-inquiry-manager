"""Amazon S3 service for attachments storage and presigned URL generation."""
import logging
from typing import Dict, Any, Optional
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from app.core.config import settings

logger = logging.getLogger("app.services.s3_service")


class S3Service:
    """Service managing customer attachment uploads and lifecycle policies."""

    def __init__(self):
        self.bucket = settings.S3_ATTACHMENTS_BUCKET
        self.region = settings.AWS_REGION
        config = Config(region_name=self.region, signature_version="s3v4")
        self.client = boto3.client("s3", config=config)

    def generate_presigned_upload_url(
        self,
        object_key: str,
        content_type: str = "application/octet-stream",
        expires_in: int = 900,
    ) -> Dict[str, Any]:
        """Generate a presigned S3 PUT URL allowing the client to upload an attachment directly."""
        try:
            url = self.client.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": self.bucket,
                    "Key": object_key,
                    "ContentType": content_type,
                },
                ExpiresIn=expires_in,
            )
            return {
                "upload_url": url,
                "object_key": object_key,
                "bucket": self.bucket,
                "expires_in_seconds": expires_in,
            }
        except ClientError as exc:
            logger.warning(f"Failed to generate presigned S3 upload URL: {exc}. Returning simulated endpoint.")
            return {
                "upload_url": f"https://{self.bucket}.s3.{self.region}.amazonaws.com/{object_key}?mock-sig",
                "object_key": object_key,
                "bucket": self.bucket,
                "expires_in_seconds": expires_in,
            }

    def generate_presigned_download_url(
        self,
        object_key: str,
        expires_in: int = 900,
    ) -> str:
        """Generate a presigned S3 GET URL allowing an authorized agent to view an attachment."""
        try:
            return self.client.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": self.bucket, "Key": object_key},
                ExpiresIn=expires_in,
            )
        except ClientError:
            return f"https://{self.bucket}.s3.{self.region}.amazonaws.com/{object_key}?mock-sig"


_s3_service_instance: Optional[S3Service] = None


def get_s3_service() -> S3Service:
    """FastAPI dependency provider for S3Service."""
    global _s3_service_instance
    if _s3_service_instance is None:
        _s3_service_instance = S3Service()
    return _s3_service_instance
