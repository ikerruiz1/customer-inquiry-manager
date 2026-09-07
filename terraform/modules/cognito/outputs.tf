output "user_pool_id" {
  description = "Amazon Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  description = "Amazon Cognito User Pool ARN"
  value       = aws_cognito_user_pool.main.arn
}

output "user_pool_endpoint" {
  description = "Amazon Cognito User Pool Issuer Endpoint"
  value       = aws_cognito_user_pool.main.endpoint
}

output "client_id" {
  description = "Amazon Cognito App Client ID"
  value       = aws_cognito_user_pool_client.client.id
}
