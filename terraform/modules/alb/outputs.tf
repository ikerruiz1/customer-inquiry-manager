output "alb_arn" {
  description = "Application Load Balancer ARN"
  value       = aws_lb.main.arn
}

output "dns_name" {
  description = "Public DNS name of the ALB"
  value       = aws_lb.main.dns_name
}

output "target_group_blue_name" {
  description = "Name of Blue Target Group"
  value       = aws_lb_target_group.blue.name
}

output "target_group_blue_arn" {
  description = "ARN of Blue Target Group"
  value       = aws_lb_target_group.blue.arn
}

output "target_group_green_name" {
  description = "Name of Green Target Group"
  value       = aws_lb_target_group.green.name
}

output "target_group_green_arn" {
  description = "ARN of Green Target Group"
  value       = aws_lb_target_group.green.arn
}

output "production_listener_arn" {
  description = "ARN of Production Listener (Port 80)"
  value       = aws_lb_listener.production.arn
}

output "test_listener_arn" {
  description = "ARN of Test Listener (Port 8080)"
  value       = aws_lb_listener.test.arn
}

output "alb_arn_suffix" {
  description = "ARN suffix of the Application Load Balancer for CloudWatch / AutoScaling dimensions"
  value       = aws_lb.main.arn_suffix
}

output "target_group_blue_arn_suffix" {
  description = "ARN suffix of the Blue Target Group for ALB RequestCountPerTarget auto-scaling"
  value       = aws_lb_target_group.blue.arn_suffix
}
