data "aws_region" "current" {}

resource "aws_ecr_repository" "app" {
  name                 = "${var.project_name}-${var.environment}"
  image_tag_mutability = "MUTABLE"

  # Mandatory for the zero-residual-cost teardown: without force_delete the
  # repository cannot be destroyed while any image tag or digest remains,
  # which leaves the ECR repository and all its image storage billing.
  force_delete = true

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-ecr"
  }
}

resource "aws_ecr_repository" "xray_daemon" {
  name                 = "${var.project_name}-${var.environment}-xray-daemon"
  image_tag_mutability = "MUTABLE"

  # Mandatory for the zero-residual-cost teardown: without force_delete the
  # repository cannot be destroyed while any image tag or digest remains.
  force_delete = true

  image_scanning_configuration {
    scan_on_push = false
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-xray-daemon-ecr"
  }
}

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cluster"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE_SPOT", "FARGATE"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 3
    base              = 0
  }
}

resource "aws_cloudwatch_log_group" "ecs_app" {
  name              = "/ecs/${var.project_name}-${var.environment}/app"
  retention_in_days = 14

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-logs"
  }
}

resource "aws_cloudwatch_log_group" "ecs_xray" {
  name              = "/ecs/${var.project_name}-${var.environment}/xray"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-${var.environment}-xray-logs"
  }
}

# AWS provisions an implicit "Default" sampling rule at priority 10000 with a 5 percent fixed rate,
# which discards 19 of every 20 requests and leaves the service map and trace views empty.
# This rule is evaluated first (lower priority number wins) and records every request, so latency
# evidence is always retrievable. X-Ray includes 10 million trace segments per month at no charge.
resource "aws_xray_sampling_rule" "full_fidelity" {
  rule_name      = "cim-${var.environment}-full-trace"
  priority       = 5000
  fixed_rate     = 1.0
  reservoir_size = 100
  resource_arn   = "*"

  service_name = "*"
  service_type = "*"
  host         = "*"
  http_method  = "*"
  url_path     = "*"
  version      = 1
}

resource "aws_ecs_task_definition" "main" {
  family                   = "${var.project_name}-${var.environment}-task"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"

  execution_role_arn = var.execution_role_arn
  task_role_arn      = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "customer-inquiry-manager"
      image     = coalesce(var.container_image, "${aws_ecr_repository.app.repository_url}:latest")
      essential = true

      portMappings = [
        {
          containerPort = 8000
          hostPort      = 8000
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "ENVIRONMENT", value = var.environment },
        { name = "AWS_REGION", value = data.aws_region.current.name },
        { name = "DATABASE_HOST", value = var.db_address },
        { name = "DATABASE_PORT", value = "5432" },
        { name = "DATABASE_NAME", value = "inquirydb" },
        { name = "S3_ATTACHMENTS_BUCKET", value = var.attachments_bucket_name },
        { name = "COGNITO_USER_POOL_ID", value = var.user_pool_id },
        { name = "COGNITO_APP_CLIENT_ID", value = var.app_client_id },
        { name = "BEDROCK_MODEL_ID", value = "eu.anthropic.claude-haiku-4-5-20251001-v1:0" },
        { name = "BEDROCK_OFFLINE_MODE", value = "false" },
        { name = "AWS_XRAY_DAEMON_ADDRESS", value = "127.0.0.1:2000" },
        { name = "XRAY_ENABLED", value = "true" },
        { name = "SQS_INQUIRIES_QUEUE_URL", value = var.sqs_inquiries_queue_url },
        { name = "SQS_INQUIRIES_DLQ_URL", value = var.sqs_inquiries_dlq_url },
        { name = "SES_INBOUND_BUCKET_NAME", value = var.ses_inbound_bucket_name },
        { name = "SMTP_FROM_EMAIL", value = var.ses_verified_sender_email }
      ]

      secrets = [
        {
          name      = "DB_CREDENTIALS"
          valueFrom = var.db_secret_arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs_app.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "app"
        }
      }
    },
    {
      name      = "aws-xray-daemon"
      image     = "${aws_ecr_repository.xray_daemon.repository_url}:latest"
      essential = false

      portMappings = [
        {
          containerPort = 2000
          hostPort      = 2000
          protocol      = "udp"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs_xray.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "xray"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-${var.environment}-task-def"
  }
}

resource "aws_ecs_service" "main" {
  name            = "${var.project_name}-${var.environment}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.main.arn
  desired_count   = 2

  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }

  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 3
    base              = 0
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_tasks_sg_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_blue_arn
    container_name   = "customer-inquiry-manager"
    container_port   = 8000
  }

  deployment_controller {
    type = "ECS"
  }

  health_check_grace_period_seconds = 60

  lifecycle {
    ignore_changes = [
      task_definition,
      load_balancer,
    ]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-service"
  }
}

resource "aws_appautoscaling_target" "ecs" {
  max_capacity       = 6
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.main.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "ecs_alb_requests" {
  count              = var.enable_alb_autoscaling ? 1 : 0
  name               = "${var.project_name}-${var.environment}-alb-requests-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${var.alb_arn_suffix}/${var.target_group_blue_arn_suffix}"
    }
    target_value       = 500.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 30
  }
}

resource "aws_appautoscaling_policy" "ecs_cpu" {
  name               = "${var.project_name}-${var.environment}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_policy" "ecs_memory" {
  name               = "${var.project_name}-${var.environment}-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 80.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
