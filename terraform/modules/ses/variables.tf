variable "project_name" {
  type        = string
  description = "Project identifier"
  default     = "customer-inquiry-manager"
}

variable "environment" {
  type        = string
  description = "Deployment environment"
  default     = "dev"
}

variable "domain_name" {
  type        = string
  description = "Authoritative apex or subdomain for inbound SES mail receipt"
  default     = "your-company-domain.tech"
}

variable "support_email" {
  type        = string
  description = "Inbound support mailbox address"
  default     = "support@your-company-domain.tech"
}

variable "aws_region" {
  type        = string
  description = "Target AWS region for SES inbound receiving"
  default     = "eu-west-1"
}

variable "route53_zone_id" {
  type        = string
  description = "Optional Route 53 Hosted Zone ID for automated DNS record creation"
  default     = null
}

variable "manage_dns_records" {
  type        = bool
  description = "Whether to manage the SES DNS records (SPF, MX, DKIM and verification). Must stay a plan-time-known boolean: the zone id itself comes from the route53 module output and is unknown on the first apply, so deriving count from it makes Terraform fail to plan."
  default     = true
}

variable "verified_sender_email" {
  type        = string
  description = "SES-verified email identity used as the outbound From address for customer notifications"
  default     = ""
}
