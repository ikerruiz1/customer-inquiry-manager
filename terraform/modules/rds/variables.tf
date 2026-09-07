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

variable "db_subnet_group_name" {
  type        = string
  description = "Isolated RDS DB subnet group name"
}

variable "rds_sg_id" {
  type        = string
  description = "Security group ID for RDS PostgreSQL"
}

variable "instance_class" {
  type        = string
  description = "RDS instance compute class"
  default     = "db.t4g.micro"
}

variable "db_name" {
  type        = string
  description = "Default PostgreSQL database name"
  default     = "inquirydb"
}
