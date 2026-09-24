# ==============================================================================
# Isolated Amazon RDS PostgreSQL 16 with Secrets Manager
# ==============================================================================

resource "random_password" "master_password" {
  length           = 24
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "${var.project_name}-${var.environment}-db-credentials"
  description             = "PostgreSQL master credentials for ${var.project_name}"
  recovery_window_in_days = 0 # Immediate purge upon destroy for clean teardown

  tags = {
    Name = "${var.project_name}-${var.environment}-db-credentials"
  }
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    engine   = "postgres"
    host     = aws_db_instance.main.address
    port     = aws_db_instance.main.port
    username = "postgres"
    password = random_password.master_password.result
    database = var.db_name
  })
}

resource "aws_db_parameter_group" "main" {
  name        = "${var.project_name}-${var.environment}-pg16-params"
  family      = "postgres16"
  description = "Custom parameter group enforcing SSL TLS connections"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-pg16-params"
  }
}

resource "aws_db_instance" "main" {
  identifier            = "${var.project_name}-${var.environment}-db"
  engine                = "postgres"
  engine_version        = "16.4"
  instance_class        = var.instance_class
  allocated_storage     = 20
  max_allocated_storage = 50
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = "postgres"
  password = random_password.master_password.result

  db_subnet_group_name   = var.db_subnet_group_name
  vpc_security_group_ids = [var.rds_sg_id]
  parameter_group_name   = aws_db_parameter_group.main.name

  publicly_accessible = false
  multi_az            = false

  auto_minor_version_upgrade = true
  copy_tags_to_snapshot      = true

  # Automated Backups & Continuous Point-in-Time Recovery (PITR)
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Sun:04:30-Sun:05:30"

  # 1-Click Clean Teardown
  skip_final_snapshot = true
  deletion_protection = false

  tags = {
    Name        = "${var.project_name}-${var.environment}-db"
    Environment = var.environment
  }
}
