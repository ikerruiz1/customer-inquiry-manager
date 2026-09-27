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

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for Fargate task placement"
}

variable "ecs_tasks_sg_id" {
  type        = string
  description = "Security group ID for ECS tasks"
}

variable "target_group_blue_arn" {
  type        = string
  description = "Target group ARN for primary Blue traffic"
}

variable "execution_role_arn" {
  type        = string
  description = "ECS Task Execution Role ARN"
}

variable "task_role_arn" {
  type        = string
  description = "ECS Task Role ARN"
}

variable "db_secret_arn" {
  type        = string
  description = "ARN of RDS database secret in Secrets Manager"
}

variable "db_address" {
  type        = string
  description = "RDS database endpoint address"
}

variable "attachments_bucket_name" {
  type        = string
  description = "S3 attachments bucket name"
}

variable "user_pool_id" {
  type        = string
  description = "Cognito User Pool ID"
}

variable "app_client_id" {
  type        = string
  description = "Cognito App Client ID"
}

variable "container_image" {
  type        = string
  description = "ECR image URI for application container"
  default     = ""
}

variable "enable_alb_autoscaling" {
  type        = bool
  description = "Enable ALBRequestCountPerTarget target tracking scaling policy"
  default     = true
}

variable "alb_arn_suffix" {
  type        = string
  description = "ALB ARN suffix for ALBRequestCountPerTarget scaling policy"
  default     = ""
}

variable "target_group_blue_arn_suffix" {
  type        = string
  description = "Blue Target Group ARN suffix for ALBRequestCountPerTarget scaling policy"
  default     = ""
}

variable "sqs_inquiries_queue_url" {
  type        = string
  description = "URL of primary SQS FIFO inquiries queue"
  default     = ""
}

variable "sqs_inquiries_dlq_url" {
  type        = string
  description = "URL of SQS inquiries Dead-Letter Queue"
  default     = ""
}

variable "ses_inbound_bucket_name" {
  type        = string
  description = "S3 bucket name for inbound raw SES emails"
  default     = ""
}


