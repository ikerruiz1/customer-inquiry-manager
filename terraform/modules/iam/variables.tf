variable "project_name" {
  type        = string
  description = "Project identifier"
  default     = "customer-inquiry-manager"
}

variable "environment" {
  type        = string
  description = "Deployment environment"
  default     = "dev"
}

variable "attachments_bucket_arn" {
  type        = string
  description = "ARN of customer attachments S3 bucket"
}

variable "db_secret_arn" {
  type        = string
  description = "ARN of RDS database secret in Secrets Manager"
}

variable "ses_inbound_bucket_arn" {
  type        = string
  description = "ARN of Amazon SES inbound S3 bucket"
  default     = ""
}
