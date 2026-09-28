variable "aws_region" {
  type        = string
  description = "AWS deployment region"
  default     = "eu-west-1"
}

variable "project_name" {
  type        = string
  description = "Project name identifier"
  default     = "customer-inquiry-manager"
}

variable "environment" {
  type        = string
  description = "Environment tier"
  default     = "dev"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC"
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  type        = list(string)
  description = "Availability Zones"
  default     = ["eu-west-1a", "eu-west-1b"]
}

variable "domain_name" {
  type        = string
  description = "Authoritative apex domain for inbound Amazon SES mail receipt"
  default     = "your-company-domain.tech"
}

variable "support_email" {
  type        = string
  description = "Support inbound email mailbox"
  default     = "support@your-company-domain.tech"
}

variable "ses_verified_sender_email" {
  type        = string
  description = "SES-verified email address or identity used for outbound customer notifications. Defaults to support_email if not overridden."
  default     = ""
}
