output "endpoint" {
  description = "Connection endpoint for RDS instance"
  value       = aws_db_instance.main.endpoint
}

output "address" {
  description = "Hostname address of RDS instance"
  value       = aws_db_instance.main.address
}

output "port" {
  description = "Listening port of RDS instance"
  value       = aws_db_instance.main.port
}

output "db_name" {
  description = "Name of database"
  value       = aws_db_instance.main.db_name
}

output "secret_arn" {
  description = "Secrets Manager secret ARN containing connection credentials"
  value       = aws_secretsmanager_secret.db_credentials.arn
}
