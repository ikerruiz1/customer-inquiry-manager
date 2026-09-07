variable "vpc_cidr" {
  type        = string
  description = "IPv4 CIDR block for the Virtual Private Cloud"
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  type        = list(string)
  description = "List of Availability Zones for multi-AZ high availability"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for public perimeter subnets (ALB & WAF)"
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for private compute & VPC Interface Endpoint subnets"
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "database_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for isolated RDS database subnets (Zero-Internet Egress)"
  default     = ["10.0.20.0/24", "10.0.21.0/24"]
}

variable "project_name" {
  type        = string
  description = "Project name identifier for resource tagging"
  default     = "customer-inquiry-manager"
}

variable "environment" {
  type        = string
  description = "Deployment environment tier (e.g. dev, staging, prod)"
  default     = "dev"
}
