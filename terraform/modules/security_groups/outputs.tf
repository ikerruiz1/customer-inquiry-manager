output "alb_sg_id" {
  description = "Security group ID for Application Load Balancer"
  value       = aws_security_group.alb.id
}

output "ecs_tasks_sg_id" {
  description = "Security group ID for ECS Fargate compute tasks"
  value       = aws_security_group.ecs_tasks.id
}

output "rds_sg_id" {
  description = "Security group ID for RDS PostgreSQL instance"
  value       = aws_security_group.rds.id
}
