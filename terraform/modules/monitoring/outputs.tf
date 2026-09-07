output "ticket_events_topic_arn" {
  description = "ARN of ticket events SNS topic"
  value       = aws_sns_topic.ticket_events.arn
}

output "ops_alerts_topic_arn" {
  description = "ARN of ops critical alerts SNS topic"
  value       = aws_sns_topic.ops_alerts.arn
}

output "dashboard_name" {
  description = "Name of CloudWatch Operations Dashboard"
  value       = aws_cloudwatch_dashboard.operations.dashboard_name
}
