variable "vpc_id" {
  type        = string
  description = "Target VPC ID"
}

variable "project_name" {
  type        = string
  description = "Project name identifier"
  default     = "customer-inquiry-manager"
}

variable "environment" {
  type        = string
  description = "Deployment environment"
  default     = "dev"
}
