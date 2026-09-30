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

variable "pipeline_artifacts_bucket_name" {
  type        = string
  description = "S3 bucket name for pipeline artifacts"
}

variable "pipeline_artifacts_bucket_arn" {
  type        = string
  description = "S3 bucket ARN for pipeline artifacts"
}

variable "ecr_repository_url" {
  type        = string
  description = "ECR Repository URL"
}

variable "xray_daemon_repository_url" {
  type        = string
  description = "ECR Repository URL for the AWS X-Ray Daemon sidecar image"
}

variable "ecs_cluster_name" {
  type        = string
  description = "ECS cluster name"
}

variable "ecs_service_name" {
  type        = string
  description = "ECS service name"
}
