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

output "ses_domain_verification_token" {
  description = "DNS TXT record value for SES domain ownership verification"
  value       = module.ses.ses_domain_verification_token
}

output "ses_dkim_tokens" {
  description = "DNS CNAME tokens for SES DKIM signing"
  value       = module.ses.ses_dkim_tokens
}

output "ses_mx_record" {
  description = "DNS MX record value for inbound mail receipt"
  value       = module.ses.mx_record_value
}

output "ses_inbound_bucket_name" {
  description = "S3 bucket name for raw inbound email storage"
  value       = module.ses.inbound_bucket_name
}

output "route53_name_servers" {
  description = "Authoritative Route 53 Name Servers to configure in get.tech"
  value       = module.route53.name_servers
}


