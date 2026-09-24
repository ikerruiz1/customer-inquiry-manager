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
