data "aws_caller_identity" "current" {}

# 1. Authoritative Domain Identity in Amazon SES
resource "aws_ses_domain_identity" "main" {
  domain = var.domain_name
}

# 2. Automated DKIM Signing Tokens for Domain Deliverability & Authenticity
resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

# 3. Dedicated Encrypted S3 Inbound Email Storage (FinOps Clean Teardown: force_destroy = true)
resource "aws_s3_bucket" "ses_inbound" {
  bucket        = "${var.project_name}-ses-inbound-${var.environment}"
  force_destroy = true

  tags = {
    Name        = "${var.project_name}-ses-inbound-${var.environment}"
    Environment = var.environment
    Component   = "InboundEmailIngress"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "ses_inbound" {
  bucket = aws_s3_bucket.ses_inbound.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "ses_inbound" {
  bucket = aws_s3_bucket.ses_inbound.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 Bucket Policy: Authorize Amazon SES service principal to deliver inbound MIME payloads
data "aws_iam_policy_document" "ses_s3_policy" {
  statement {
    sid    = "AllowSESPuts"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["ses.amazonaws.com"]
    }
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.ses_inbound.arn}/*"]
    condition {
      test     = "StringEquals"
      variable = "aws:Referer"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_s3_bucket_policy" "ses_inbound" {
  bucket = aws_s3_bucket.ses_inbound.id
  policy = data.aws_iam_policy_document.ses_s3_policy.json
}

# 4. Amazon SES Inbound Receipt Rule Set & Activation
resource "aws_ses_receipt_rule_set" "main" {
  rule_set_name = "${var.project_name}-${var.environment}-inbound-ruleset"
}

resource "aws_ses_active_receipt_rule_set" "main" {
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
}

# 5. Receipt Rule: Capture Inbound Mail to Support Address & Store in S3
resource "aws_ses_receipt_rule" "support_inbound" {
  name          = "${var.project_name}-support-inbound-rule"
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
  recipients    = [var.support_email, "@${var.domain_name}"]
  enabled       = true
  scan_enabled  = true

  s3_action {
    bucket_name = aws_s3_bucket.ses_inbound.bucket
    position    = 1
  }

  depends_on = [
    aws_s3_bucket_policy.ses_inbound,
    aws_ses_active_receipt_rule_set.main
  ]
}

# 6. Automated Route 53 DNS Records (Provisioned automatically when route53_zone_id is provided)
resource "aws_route53_record" "ses_verification" {
  count   = var.route53_zone_id != null ? 1 : 0
  zone_id = var.route53_zone_id
  name    = "_amazonses.${var.domain_name}"
  type    = "TXT"
  ttl     = 300
  records = [aws_ses_domain_identity.main.verification_token]
}

resource "aws_route53_record" "ses_dkim" {
  count   = var.route53_zone_id != null ? 3 : 0
  zone_id = var.route53_zone_id
  name    = "${aws_ses_domain_dkim.main.dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = ["${aws_ses_domain_dkim.main.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

resource "aws_route53_record" "ses_mx" {
  count   = var.route53_zone_id != null ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "MX"
  ttl     = 300
  records = ["10 inbound-smtp.${var.aws_region}.amazonaws.com"]
}

resource "aws_route53_record" "ses_spf" {
  count   = var.route53_zone_id != null ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = 300
  records = ["v=spf1 include:amazonses.com ~all"]
}
