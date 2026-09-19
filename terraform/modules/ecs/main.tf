# ==============================================================================
# ECS Fargate Spot Cluster & Dual-Container Task Definition (with X-Ray Sidecar)
# ==============================================================================

data "aws_region" "current" {}

# ECR Container Repository with Native Vulnerability Scanning
resource "aws_ecr_repository" "app" {
  name                 = "${var.project_name}-${var.environment}"
  image_tag_mutability = "MUTABLE"

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

# ECS Cluster
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

# Fargate Spot Capacity Provider (FinOps Optimization: ~70% Cost Reduction)
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

# CloudWatch Log Group for Application Container
resource "aws_cloudwatch_log_group" "ecs_app" {
  name              = "/ecs/${var.project_name}-${var.environment}/app"
  retention_in_days = 14

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-logs"
  }
}

# CloudWatch Log Group for AWS X-Ray Sidecar
resource "aws_cloudwatch_log_group" "ecs_xray" {
  name              = "/ecs/${var.project_name}-${var.environment}/xray"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-${var.environment}-xray-logs"
  }
}

# Dual-Container Task Definition
resource "aws_ecs_task_definition" "main" {
  family                   = "${var.project_name}-${var.environment}-task"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"

  execution_role_arn = var.execution_role_arn
  task_role_arn      = var.task_role_arn

  container_definitions = jsonencode([
    # Primary FastAPI Application Container
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
        { name = "AWS_XRAY_DAEMON_ADDRESS", value = "127.0.0.1:2000" }
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
    # Secondary AWS X-Ray Daemon Sidecar (Listens on UDP 127.0.0.1:2000)
    {
      name      = "aws-xray-daemon"
      image     = "public.ecr.aws/xray/aws-xray-daemon:latest"
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

# ECS Service with CodeDeploy Blue/Green Deployment Controller
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
    type = "CODE_DEPLOY" # AWS native Blue/Green traffic routing
  }

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

# ------------------------------------------------------------------------------
# ECS Application Auto Scaling: Multi-Metric Proactive + Defensive Policies
# ------------------------------------------------------------------------------
resource "aws_appautoscaling_target" "ecs" {
  max_capacity       = 6
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.main.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# 1. Leading Indicator: ALB Request Count Per Target (Proactive Traffic Ingress Scaling)
resource "aws_appautoscaling_policy" "ecs_alb_requests" {
  count              = var.alb_arn_suffix != "" && var.target_group_blue_arn_suffix != "" ? 1 : 0
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
    target_value       = 500.0 # Scales out when inquiries exceed 500 req/target/min
    scale_in_cooldown  = 300
    scale_out_cooldown = 30 # Aggressive scale-out for inbound traffic bursts
  }
}

# 2. Reactive Compute Safeguard: Average CPU Utilization
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

# 3. OOM Safeguard: Average Memory Utilization (Protects against Python heap bloat)
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
