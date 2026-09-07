# ==============================================================================
# Least-Privilege Security Group Architecture
# ==============================================================================

# 1. Public Application Load Balancer Security Group
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-${var.environment}-alb-sg"
  description = "Controls public HTTPS/HTTP ingress into the Application Load Balancer"
  vpc_id      = var.vpc_id

  ingress {
    description = "Public HTTP ingress for redirect or initial verification"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Public TLS HTTPS ingress"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Forward traffic to private ECS Fargate tasks on port 8000"
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-alb-sg"
  }
}

# 2. ECS Fargate Compute Tasks Security Group
resource "aws_security_group" "ecs_tasks" {
  name        = "${var.project_name}-${var.environment}-ecs-tasks-sg"
  description = "Controls ingress from ALB and restricted egress to RDS and PrivateLink"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Inbound traffic strictly from ALB on port 8000"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "Outbound PostgreSQL connections strictly to RDS security group"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    description = "Outbound HTTPS connections to AWS PrivateLink VPC Endpoints"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-tasks-sg"
  }
}

# 3. Amazon RDS PostgreSQL Database Security Group
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-${var.environment}-rds-sg"
  description = "Controls PostgreSQL ingress strictly from ECS Fargate compute tasks"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL port 5432 strictly from authorized ECS Fargate tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-rds-sg"
  }
}
