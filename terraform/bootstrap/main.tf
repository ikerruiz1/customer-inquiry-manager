terraform {
  required_version = ">= 1.10.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Remote state bootstrap.
#
# This root module is intentionally NOT self-referential. A `backend "s3"` block is
# resolved before the module graph is loaded, so the bucket that stores state cannot be
# declared in the configuration whose state it holds. This module must therefore be applied
# once, independently, before `terraform init` in the environment directory.
#
# Locking uses S3 native locking (`use_lockfile = true`, Terraform >= 1.10) instead of the
# deprecated DynamoDB table approach. Server-side encryption uses the AWS-managed `aws/s3`
# key rather than a Customer Managed Key: a customer managed key costs 1 EUR per month
# merely for existing, which would break the 0,00 EUR residual cost mandate of this project.

resource "aws_s3_bucket" "state" {
  bucket = "${var.project_name}-${var.environment}-tfstate"

  # Never enabled. Destroying a versioned state bucket with force_destroy would delete the
  # recovery history that makes versioning worth enabling in the first place.
  force_destroy = false

  tags = {
    Name        = "${var.project_name}-${var.environment}-tfstate"
    Environment = var.environment
    ManagedBy   = "terraform-bootstrap"
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = "alias/aws/s3"
    }
    bucket_key_enabled = true
  }
}

# Non-current state versions are recovery points, not active data. Archiving them after
# 90 days keeps the working set in Standard while retaining cheap, restorable history.
resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "archive-noncurrent-state-versions"
    status = "Enabled"

    filter {
      prefix = var.state_key
    }

    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "GLACIER_IR"
    }
  }

  rule {
    id     = "abort-incomplete-multipart-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# State files contain the full inventory of provisioned infrastructure, including resource
# attributes that may identify the account owner. Denying plaintext transport makes an
# accidental `http://` backend configuration fail closed instead of leaking state.
data "aws_iam_policy_document" "state" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]

    resources = [
      aws_s3_bucket.state.arn,
      "${aws_s3_bucket.state.arn}/*",
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = data.aws_iam_policy_document.state.json

  depends_on = [aws_s3_bucket_public_access_block.state]
}