# ==============================================================================
# Amazon SQS FIFO Decoupled Ingestion Queue & Dead-Letter Queue (DLQ)
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Dead-Letter Queue (DLQ) for Poisoned or Corrupted Inquiry Payloads
# ------------------------------------------------------------------------------
resource "aws_sqs_queue" "inquiries_dlq" {
  name                        = "${var.project_name}-${var.environment}-inquiries-dlq.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  message_retention_seconds   = 1209600 # 14 days retention for operator inspection and replay

  tags = {
    Name        = "${var.project_name}-${var.environment}-inquiries-dlq"
    Environment = var.environment
    Tier        = "Ingress-Buffer"
    Type        = "DeadLetterQueue"
  }
}

# ------------------------------------------------------------------------------
# 2. Primary SQS FIFO Ingestion Buffer (Leaky-Bucket Shock Absorber)
# ------------------------------------------------------------------------------
resource "aws_sqs_queue" "inquiries_fifo" {
  name                        = "${var.project_name}-${var.environment}-inquiries.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  visibility_timeout_seconds  = 120     # Allows 2 minutes for Bedrock Converse API + retries
  message_retention_seconds   = 1209600 # 14 days maximum durability
  receive_wait_time_seconds   = 20      # Enforces long-polling to minimize empty receives & API costs

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.inquiries_dlq.arn
    maxReceiveCount     = 3 # Routes to DLQ after 3 failed processing attempts
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-inquiries-queue"
    Environment = var.environment
    Tier        = "Ingress-Buffer"
    Type        = "PrimaryFIFOQueue"
  }
}
