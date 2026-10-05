variable "domain_name" {
  type        = string
  description = "Authoritative apex domain name for the Route 53 public hosted zone"
  default     = "your-company-domain.tech"
}

variable "project_name" {
  type        = string
  description = "Project identifier"
  default     = "customer-inquiry-manager"
}

variable "environment" {
  type        = string
  description = "Deployment tier"
  default     = "dev"
}

variable "alb_dns_name" {
  type        = string
  description = "Public DNS name of the Application Load Balancer monitored by the health check"

  validation {
    condition     = can(regex("\\.\\w+(-?\\w+)?\\.amazonaws\\.com\\.?$", var.alb_dns_name))
    error_message = "alb_dns_name must be an AWS load balancer DNS name."
  }
}

variable "alb_zone_id" {
  type        = string
  description = "Hosted zone ID of the Application Load Balancer, required for an alias record"

  validation {
    condition     = can(regex("^Z[A-Z0-9]+$", var.alb_zone_id))
    error_message = "alb_zone_id must be an AWS Route 53 hosted zone ID such as Z35SXDOTRQ7X7K."
  }
}

variable "app_record_name" {
  type        = string
  description = "Fully qualified application record name mapped to the load balancer"

  validation {
    condition     = endswith(var.app_record_name, ".")
    error_message = "app_record_name must be fully qualified and end with a trailing dot."
  }
}

variable "manage_app_record" {
  type        = bool
  description = <<-EOT
    Create the application alias record inside Terraform. Set to false when the same record
    is managed outside Terraform, otherwise the apply fails with a record-already-exists error.
  EOT
  default     = true
}
