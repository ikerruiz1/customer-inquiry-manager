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

variable "ecs_cluster_name" {
  type        = string
  description = "Name of ECS Cluster"
}

variable "ecs_service_name" {
  type        = string
  description = "Name of ECS Service"
}

variable "alb_arn_suffix" {
  type        = string
  description = "ALB ARN suffix for CloudWatch metric dimensions"
}

variable "inquiries_queue_name" {
  type        = string
  description = "Primary SQS FIFO queue name for CloudWatch monitoring"
  default     = ""
}

variable "inquiries_dlq_name" {
  type        = string
  description = "SQS DLQ name for CloudWatch monitoring"
  default     = ""
}
