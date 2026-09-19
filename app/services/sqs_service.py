"""Enterprise Amazon SQS FIFO Ingestion Service with AWS PrivateLink and Local Fallback Buffer."""
import asyncio
import hashlib
import json
import logging
import uuid
from typing import Dict, Any, List, Optional
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger("app.services.sqs_service")


class SQSService:
    """Enterprise wrapper for Amazon SQS FIFO message queue operations."""

    def __init__(self):
        self.region = settings.AWS_REGION
        self.queue_url = settings.SQS_INQUIRIES_QUEUE_URL
        self.dlq_url = settings.SQS_INQUIRIES_DLQ_URL
        self._local_queue: asyncio.Queue = asyncio.Queue()
        self._local_in_flight: Dict[str, Dict[str, Any]] = {}

        boto_config = Config(
            region_name=self.region,
            retries={"max_attempts": 3, "mode": "adaptive"},
            connect_timeout=5,
            read_timeout=15,
        )
        self.client = boto3.client("sqs", config=boto_config)

    def is_live_sqs_configured(self) -> bool:
        """Check if production SQS queue URL is configured."""
        return bool(self.queue_url and self.queue_url.strip())

    async def send_inquiry(
        self,
        payload: Dict[str, Any],
        deduplication_id: Optional[str] = None,
        group_id: str = "inquiries",
    ) -> str:
        """Enqueue raw customer inquiry into SQS FIFO buffer (or local async queue in dev)."""
        serialized = json.dumps(payload, default=str)

        # Generate deterministic deduplication ID if not explicitly provided
        if not deduplication_id:
            deduplication_id = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

        if self.is_live_sqs_configured():
            try:
                loop = asyncio.get_running_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: self.client.send_message(
                        QueueUrl=self.queue_url,
                        MessageBody=serialized,
                        MessageGroupId=group_id,
                        MessageDeduplicationId=deduplication_id,
                    ),
                )
                message_id = response.get("MessageId", str(uuid.uuid4()))
                logger.info(f"Enqueued inquiry into live SQS FIFO {self.queue_url}: MessageId={message_id}")
                return message_id
            except ClientError as exc:
                logger.error(f"Failed to enqueue to live SQS FIFO ({exc}). Falling back to in-memory queue.")
                # Fallback to local queue on transient AWS SQS failure
                tracking_id = f"local-{uuid.uuid4()}"
                await self._local_queue.put({"id": tracking_id, "body": serialized})
                return tracking_id
        else:
            # Zero-configuration local developer & offline test mode
            tracking_id = f"local-{uuid.uuid4()}"
            await self._local_queue.put({"id": tracking_id, "body": serialized})
            logger.debug(f"Enqueued inquiry into local in-memory FIFO buffer: tracking_id={tracking_id}")
            return tracking_id

    async def receive_inquiries(
        self, max_messages: int = 10, wait_time_seconds: int = 10
    ) -> List[Dict[str, Any]]:
        """Pull a batch of inquiries from SQS FIFO buffer (long-polling enabled)."""
        if self.is_live_sqs_configured():
            try:
                loop = asyncio.get_running_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: self.client.receive_message(
                        QueueUrl=self.queue_url,
                        MaxNumberOfMessages=min(max_messages, 10),
                        WaitTimeSeconds=min(wait_time_seconds, 20),
                        AttributeNames=["All"],
                        MessageAttributeNames=["All"],
                    ),
                )
                raw_messages = response.get("Messages", [])
                results = []
                for msg in raw_messages:
                    results.append({
                        "message_id": msg.get("MessageId"),
                        "receipt_handle": msg.get("ReceiptHandle"),
                        "body": json.loads(msg.get("Body", "{}")),
                        "attributes": msg.get("Attributes", {}),
                    })
                return results
            except ClientError as exc:
                logger.error(f"Error receiving messages from live SQS: {exc}")
                return []
        else:
            # Drain local in-memory queue
            results = []
            while not self._local_queue.empty() and len(results) < max_messages:
                item = await self._local_queue.get()
                receipt_handle = f"receipt-{item['id']}"
                self._local_in_flight[receipt_handle] = item
                results.append({
                    "message_id": item["id"],
                    "receipt_handle": receipt_handle,
                    "body": json.loads(item["body"]),
                    "attributes": {"ApproximateReceiveCount": "1"},
                })
            return results

    async def delete_inquiry(self, receipt_handle: str) -> bool:
        """Acknowledge message processing completion and remove from queue."""
        if self.is_live_sqs_configured() and not receipt_handle.startswith("receipt-local-"):
            try:
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(
                    None,
                    lambda: self.client.delete_message(
                        QueueUrl=self.queue_url,
                        ReceiptHandle=receipt_handle,
                    ),
                )
                logger.debug(f"Successfully deleted message from live SQS: {receipt_handle[:20]}...")
                return True
            except ClientError as exc:
                logger.error(f"Failed to delete message from live SQS: {exc}")
                return False
        else:
            self._local_in_flight.pop(receipt_handle, None)
            return True

    async def get_queue_depth(self) -> int:
        """Query count of visible messages waiting in queue."""
        if self.is_live_sqs_configured():
            try:
                loop = asyncio.get_running_loop()
                attrs = await loop.run_in_executor(
                    None,
                    lambda: self.client.get_queue_attributes(
                        QueueUrl=self.queue_url,
                        AttributeNames=["ApproximateNumberOfMessages"],
                    ),
                )
                return int(attrs.get("Attributes", {}).get("ApproximateNumberOfMessages", 0))
            except Exception:
                return 0
        return self._local_queue.qsize()


_sqs_service_instance: Optional[SQSService] = None


def get_sqs_service() -> SQSService:
    """Dependency provider returning singleton SQSService instance."""
    global _sqs_service_instance
    if _sqs_service_instance is None:
        _sqs_service_instance = SQSService()
    return _sqs_service_instance
