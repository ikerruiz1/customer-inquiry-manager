# ==============================================================================
# CloudWatch Monitoring, Alarms, Dashboards, and Outbound SNS Topics
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Outbound SNS Topics
# ------------------------------------------------------------------------------
resource "aws_sns_topic" "ticket_events" {
  name = "${var.project_name}-${var.environment}-ticket-events"

  tags = {
    Name = "${var.project_name}-${var.environment}-ticket-events"
  }
}

resource "aws_sns_topic" "ops_alerts" {
  name = "${var.project_name}-${var.environment}-ops-critical-alerts"

  tags = {
    Name = "${var.project_name}-${var.environment}-ops-alerts"
  }
}

# ------------------------------------------------------------------------------
# 2. CloudWatch Alarms
# ------------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors" {
  alarm_name          = "${var.project_name}-${var.environment}-alb-high-5xx"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Triggered when ALB returns more than 10 5XX errors across 2 evaluation periods"
  alarm_actions       = [aws_sns_topic.ops_alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  alarm_name          = "${var.project_name}-${var.environment}-ecs-cpu-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Triggers scaling or investigation when CPU utilization exceeds 80%"
  alarm_actions       = [aws_sns_topic.ops_alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }
}

# ------------------------------------------------------------------------------
# 3. CloudWatch Central Operations Dashboard
# ------------------------------------------------------------------------------
resource "aws_cloudwatch_dashboard" "operations" {
  dashboard_name = "${var.project_name}-${var.environment}-operations-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["CustomerInquiryManager", "TicketsTriaged", "Priority", "P1"],
            [".", ".", "Priority", "P2"],
            [".", ".", "Priority", "P3"],
            [".", ".", "Priority", "P4"]
          ]
          view    = "timeSeries"
          stacked = true
          region  = "eu-west-1"
          title   = "Inquiries Triaged by ITIL Priority (CloudWatch EMF)"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ServiceName", var.ecs_service_name, "ClusterName", var.ecs_cluster_name],
            [".", "MemoryUtilization", ".", ".", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = "eu-west-1"
          title   = "ECS Fargate Spot Resource Utilization"
          period  = 60
        }
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# 4. EventBridge Scheduler for Decoupled SLA Audit & Compliance
# ------------------------------------------------------------------------------
resource "aws_cloudwatch_event_rule" "sla_audit_schedule" {
  name                = "${var.project_name}-${var.environment}-sla-audit-schedule"
  description         = "Triggers 1-minute cloud-native SLA breach audit and executive compliance evaluation"
  schedule_expression = "rate(1 minute)"

  tags = {
    Name = "${var.project_name}-${var.environment}-sla-audit-schedule"
  }
}

# ------------------------------------------------------------------------------
# 5. Production SRE Ingress Alarms: SQS Dead-Letter Queue & Queue Latency
# ------------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "sqs_dlq_messages" {
  count               = var.inquiries_dlq_name != "" ? 1 : 0
  alarm_name          = "${var.project_name}-${var.environment}-sqs-dlq-messages"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1
  alarm_description   = "Critical SRE Alert: Messages present in Dead-Letter Queue (DLQ). Triage failure after 3 attempts."
  alarm_actions       = [aws_sns_topic.ops_alerts.arn]

  dimensions = {
    QueueName = var.inquiries_dlq_name
  }
}

resource "aws_cloudwatch_metric_alarm" "sqs_queue_depth" {
  count               = var.inquiries_queue_name != "" ? 1 : 0
  alarm_name          = "${var.project_name}-${var.environment}-sqs-queue-latency"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "ApproximateAgeOfOldestMessage"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 300 # 5 minutes message latency alert
  alarm_description   = "Warning: Oldest message in SQS queue exceeds 300 seconds. Worker consumer fleet falling behind."
  alarm_actions       = [aws_sns_topic.ops_alerts.arn]

  dimensions = {
    QueueName = var.inquiries_queue_name
  }
}

