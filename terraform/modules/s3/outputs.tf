output "attachments_bucket_name" {
  description = "Name of the customer attachments S3 bucket"
  value       = aws_s3_bucket.attachments.bucket
}

output "attachments_bucket_arn" {
  description = "ARN of the customer attachments S3 bucket"
  value       = aws_s3_bucket.attachments.arn
}

output "alb_logs_bucket_name" {
  description = "Name of the ALB access logs S3 bucket"
  value       = aws_s3_bucket.alb_logs.bucket
}

output "pipeline_artifacts_bucket_name" {
  description = "Name of the CI/CD pipeline artifacts S3 bucket"
  value       = aws_s3_bucket.pipeline_artifacts.bucket
}

output "pipeline_artifacts_bucket_arn" {
  description = "ARN of the CI/CD pipeline artifacts S3 bucket"
  value       = aws_s3_bucket.pipeline_artifacts.arn
}
