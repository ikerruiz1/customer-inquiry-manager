output "queue_url" {
  description = "Primary SQS FIFO Ingestion Queue URL"
  value       = aws_sqs_queue.inquiries_fifo.url
}

output "queue_arn" {
  description = "Primary SQS FIFO Ingestion Queue ARN"
  value       = aws_sqs_queue.inquiries_fifo.arn
}

output "queue_name" {
  description = "Primary SQS FIFO Ingestion Queue Name"
  value       = aws_sqs_queue.inquiries_fifo.name
}

output "dlq_url" {
  description = "Dead-Letter Queue (DLQ) URL"
  value       = aws_sqs_queue.inquiries_dlq.url
}

output "dlq_arn" {
  description = "Dead-Letter Queue (DLQ) ARN"
  value       = aws_sqs_queue.inquiries_dlq.arn
}

output "dlq_name" {
  description = "Dead-Letter Queue (DLQ) Name"
  value       = aws_sqs_queue.inquiries_dlq.name
}
