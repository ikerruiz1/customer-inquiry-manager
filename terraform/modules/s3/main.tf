# ==============================================================================
# S3 Multi-Tier FinOps Lifecycle Architecture & Clean Teardown
# ==============================================================================

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# ------------------------------------------------------------------------------
# 1. Customer Attachments Bucket (Standard -> Glacier IR)
# ------------------------------------------------------------------------------
resource "aws_s3_bucket" "attachments" {
  bucket        = "${var.project_name}-${var.environment}-attachments-${random_id.bucket_suffix.hex}"
  force_destroy = true # 1-Click Clean Teardown

  tags = {
    Name        = "${var.project_name}-${var.environment}-attachments"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_public_access_block" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "attachments" {
  bucket = aws_s3_bucket.attachments.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  rule {
    id     = "archive-inactive-attachments"
    status = "Enabled"

    filter {
      prefix = "inquiry-attachments/"
    }

    # Transition to Glacier Instant Retrieval at 60 days (68% cost reduction)
    transition {
      days          = 60
      storage_class = "GLACIER_IR"
    }
  }
}

# ------------------------------------------------------------------------------
# 2. ALB Access Logs Bucket (Standard -> Glacier Flexible -> Expiration)
# ------------------------------------------------------------------------------
resource "aws_s3_bucket" "alb_logs" {
  bucket        = "${var.project_name}-${var.environment}-alb-logs-${random_id.bucket_suffix.hex}"
  force_destroy = true

  tags = {
    Name = "${var.project_name}-${var.environment}-alb-logs"
  }
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    id     = "alb-logs-lifecycle"
    status = "Enabled"

    filter {}

    # Transition to cold Glacier storage at 30 days
    transition {
      days          = 30
      storage_class = "GLACIER"
    }

    # Automatic expiration and permanent purge at 90 days
    expiration {
      days = 90
    }
  }
}

# ------------------------------------------------------------------------------
# 3. CI/CD Pipeline Artifacts Bucket (Expiration after 3 days)
# ------------------------------------------------------------------------------
resource "aws_s3_bucket" "pipeline_artifacts" {
  bucket        = "${var.project_name}-${var.environment}-pipeline-${random_id.bucket_suffix.hex}"
  force_destroy = true

  tags = {
    Name = "${var.project_name}-${var.environment}-pipeline-artifacts"
  }
}

resource "aws_s3_bucket_public_access_block" "pipeline_artifacts" {
  bucket = aws_s3_bucket.pipeline_artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "pipeline_artifacts" {
  bucket = aws_s3_bucket.pipeline_artifacts.id

  rule {
    id     = "purge-ephemeral-build-artifacts"
    status = "Enabled"

    filter {}

    # Ephemeral build artifacts expire and purge after 3 days
    expiration {
      days = 3
    }
  }
}
