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

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Public subnet IDs for ALB placement"
}

variable "alb_sg_id" {
  type        = string
  description = "ALB security group ID"
}
