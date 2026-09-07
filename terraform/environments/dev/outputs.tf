output "alb_dns_name" {
  description = "Public DNS hostname of Application Load Balancer"
  value       = module.alb.dns_name
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "cognito_app_client_id" {
  description = "Cognito App Client ID"
  value       = module.cognito.client_id
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = module.rds.endpoint
}

output "attachments_bucket_name" {
  description = "S3 customer attachments bucket name"
  value       = module.s3.attachments_bucket_name
}

output "ecr_repository_url" {
  description = "ECR Repository URL for container image pushes"
  value       = module.ecs.ecr_repository_url
}

output "codepipeline_name" {
  description = "AWS Native CodePipeline Name"
  value       = module.cicd.pipeline_name
}
