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

resource "aws_iam_role_policy_attachment" "task_execution_standard" {
  role       = aws_iam_role.task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

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
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:ApplyGuardrail",
        ]
        Resource = [
          "arn:aws:bedrock:*::foundation-model/*",
          "arn:aws:bedrock:*:*:inference-profile/*",
          "arn:aws:bedrock:*:*:guardrail/*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket",
          "s3:DeleteObject",
        ]
        Resource = compact([
          "${var.attachments_bucket_arn}/*",
          var.attachments_bucket_arn,
          var.ses_inbound_bucket_arn != "" ? "${var.ses_inbound_bucket_arn}/*" : "",
          var.ses_inbound_bucket_arn != "" ? var.ses_inbound_bucket_arn : "",
        ])
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish",
        ]
        Resource = ["arn:aws:sns:*:*:${var.project_name}-${var.environment}-*"]
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail",
          # Required by email_service._resolve_verified_sender() to discover the
          # verified domain identity. Without it the lookup raises AccessDenied,
          # the resolver silently falls back to SMTP_FROM_EMAIL and outbound mail
          # is sent from the personal address, signed by amazonses.com instead of
          # the corporate domain, which Gmail treats as spam.
          "ses:ListEmailIdentities",
        ]
        Resource = ["*"]
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
        ]
        Resource = ["*"]
      },
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
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminSetUserPassword",
        ]
        Resource = [var.user_pool_arn != "" ? var.user_pool_arn : "*"]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "task_app_permissions" {
  role       = aws_iam_role.task_role.name
  policy_arn = aws_iam_policy.task_app_permissions.arn
}
