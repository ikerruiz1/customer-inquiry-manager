output "ses_domain_identity_arn" {
  description = "ARN of the SES domain identity"
  value       = aws_ses_domain_identity.main.arn
}

output "ses_domain_verification_token" {
  description = "TXT verification token to configure in domain DNS records"
  value       = aws_ses_domain_identity.main.verification_token
}

output "ses_dkim_tokens" {
  description = "DKIM tokens for CNAME records to configure in domain DNS records"
  value       = aws_ses_domain_dkim.main.dkim_tokens
}

output "mx_record_value" {
  description = "Inbound MX record value to configure in domain DNS records"
  value       = "10 inbound-smtp.${var.aws_region}.amazonaws.com"
}

output "inbound_bucket_name" {
  description = "S3 bucket storing raw inbound email MIME messages"
  value       = aws_s3_bucket.ses_inbound.bucket
}

output "inbound_bucket_arn" {
  description = "ARN of S3 bucket storing raw inbound email MIME messages"
  value       = aws_s3_bucket.ses_inbound.arn
}
