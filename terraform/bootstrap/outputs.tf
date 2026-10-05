output "bucket_name" {
  description = "Name of the S3 bucket holding Terraform remote state."
  value       = aws_s3_bucket.state.id
}

output "bucket_arn" {
  description = "ARN of the S3 bucket holding Terraform remote state."
  value       = aws_s3_bucket.state.arn
}

output "bucket_domain_name" {
  description = "Regional domain name of the state bucket, required by the S3 backend."
  value       = aws_s3_bucket.state.bucket_regional_domain_name
}

output "aws_region" {
  description = "Region the state bucket was created in, required by the S3 backend."
  value       = var.aws_region
}

output "state_key" {
  description = "Object key of the environment state file inside the bucket."
  value       = var.state_key
}

output "backend_config" {
  description = "Arguments to pass to terraform init -backend-config when wiring the environment to this bucket."
  value = {
    bucket = aws_s3_bucket.state.id
    key    = var.state_key
    region = var.aws_region
  }
}