variable "aws_region" {
  type        = string
  description = "AWS Region hosting the Terraform state bucket."

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]$", var.aws_region))
    error_message = "aws_region must be a valid AWS Region identifier, for example eu-west-1."
  }
}

variable "project_name" {
  type        = string
  description = "Project identifier used to name the Terraform state bucket."
}

variable "environment" {
  type        = string
  description = "Deployment environment identifier used to name the Terraform state bucket."
}

variable "state_key" {
  type        = string
  description = "Object key of the environment state file inside the state bucket."

  validation {
    condition     = can(regex("^[A-Za-z0-9._/-]+\\.tfstate$", var.state_key))
    error_message = "state_key must be a relative object key ending in .tfstate, without a leading slash."
  }
}