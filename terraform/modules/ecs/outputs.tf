output "cluster_name" {
  description = "Name of the ECS Cluster"
  value       = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  description = "ARN of the ECS Cluster"
  value       = aws_ecs_cluster.main.arn
}

output "service_name" {
  description = "Name of the ECS Service"
  value       = aws_ecs_service.main.name
}

output "task_definition_arn" {
  description = "ARN of the ECS Task Definition"
  value       = aws_ecs_task_definition.main.arn
}

output "ecr_repository_url" {
  description = "URL of the ECR Repository"
  value       = aws_ecr_repository.app.repository_url
}

output "xray_daemon_repository_url" {
  description = "URL of the ECR Repository holding the AWS X-Ray Daemon sidecar image"
  value       = aws_ecr_repository.xray_daemon.repository_url
}
