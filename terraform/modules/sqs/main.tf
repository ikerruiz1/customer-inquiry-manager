resource "aws_sqs_queue" "inquiries_dlq" {
  name                        = "${var.project_name}-${var.environment}-inquiries-dlq.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  message_retention_seconds   = 1209600

  tags = {
    Name        = "${var.project_name}-${var.environment}-inquiries-dlq"
    Environment = var.environment
    Tier        = "Ingress-Buffer"
    Type        = "DeadLetterQueue"
  }
}

resource "aws_sqs_queue" "inquiries_fifo" {
  name                        = "${var.project_name}-${var.environment}-inquiries.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  visibility_timeout_seconds  = 120
  message_retention_seconds   = 1209600
  receive_wait_time_seconds   = 20

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.inquiries_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-inquiries-queue"
    Environment = var.environment
    Tier        = "Ingress-Buffer"
    Type        = "PrimaryFIFOQueue"
  }
}
