# ==============================================================================
# Strict IAM Separation: Task Execution Role vs Task Role
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. ECS Task Execution Role (Container Agent Infrastructure Boundary)
# ------------------------------------------------------------------------------
data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_execution_role" {
  name               = "${var.project_name}-${var.environment}-execution-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json

  tags = {
    Name = "${var.project_name}-${var.environment}-execution-role"
  }
}

# Standard managed policy for ECR pull and CloudWatch logs streaming
resource "aws_iam_role_policy_attachment" "task_execution_standard" {
  role       = aws_iam_role.task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Dedicated Secrets Manager access for bootstrapping database connection string
resource "aws_iam_policy" "task_execution_secrets" {
  name        = "${var.project_name}-${var.environment}-exec-secrets-policy"
  description = "Allows ECS agent to fetch database connection parameters at container bootstrap"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [var.db_secret_arn]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "task_execution_secrets" {
  role       = aws_iam_role.task_execution_role.name
  policy_arn = aws_iam_policy.task_execution_secrets.arn
}

# ------------------------------------------------------------------------------
# 2. ECS Task Role (Application Runtime Boundary)
# ------------------------------------------------------------------------------
resource "aws_iam_role" "task_role" {
  name               = "${var.project_name}-${var.environment}-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json

  tags = {
    Name = "${var.project_name}-${var.environment}-task-role"
  }
}

resource "aws_iam_policy" "task_app_permissions" {
  name        = "${var.project_name}-${var.environment}-app-policy"
  description = "Application runtime permissions for Amazon Bedrock, S3, SNS, and Telemetry"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Amazon Bedrock Foundation Models (Converse API) & Guardrails
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:ApplyGuardrail",
        ]
        Resource = [
          "arn:aws:bedrock:*::foundation-model/*",
          "arn:aws:bedrock:*:*:guardrail/*",
        ]
      },
      # S3 Attachments Storage
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
        ]
        Resource = ["${var.attachments_bucket_arn}/*"]
      },
      # Amazon SNS Fan-out Dispatch
      {
        Effect = "Allow"
        Action = [
          "sns:Publish",
        ]
        Resource = ["arn:aws:sns:*:*:*"]
      },
      # CloudWatch Embedded Metric Format (EMF)
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
        ]
        Resource = ["*"]
      },
      # AWS X-Ray Tracing Segments
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets",
        ]
        Resource = ["*"]
      },
      # Amazon SQS FIFO Ingestion Buffer & Dead-Letter Queue
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility",
        ]
        Resource = ["arn:aws:sqs:*:*:${var.project_name}-${var.environment}-*"]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "task_app_permissions" {
  role       = aws_iam_role.task_role.name
  policy_arn = aws_iam_policy.task_app_permissions.arn
}
