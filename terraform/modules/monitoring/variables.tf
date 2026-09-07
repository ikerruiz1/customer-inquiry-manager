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
