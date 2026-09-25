resource "aws_route53_zone" "primary" {
  name          = var.domain_name
  force_destroy = true

  tags = {
    Name        = "${var.project_name}-zone-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}
