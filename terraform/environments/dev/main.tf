terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# 1. 3-Tier Network & AWS PrivateLink Interface Endpoints (Zero-Internet Egress)
module "vpc" {
  source             = "../../modules/vpc"
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  project_name       = var.project_name
  environment        = var.environment
}

# 2. Least-Privilege Security Groups
module "security_groups" {
  source       = "../../modules/security_groups"
  vpc_id       = module.vpc.vpc_id
  project_name = var.project_name
  environment  = var.environment
}

# 3. Amazon Cognito Zero-Trust TOTP MFA Authentication
module "cognito" {
  source       = "../../modules/cognito"
  project_name = var.project_name
  environment  = var.environment
}

# 4. Isolated Amazon RDS PostgreSQL 16
module "rds" {
  source               = "../../modules/rds"
  project_name         = var.project_name
  environment          = var.environment
  db_subnet_group_name = module.vpc.db_subnet_group_name
  rds_sg_id            = module.security_groups.rds_sg_id
}

# 5. S3 Multi-Tier Lifecycle & Clean Teardown Buckets
module "s3" {
  source       = "../../modules/s3"
  project_name = var.project_name
  environment  = var.environment
}

# 6. IAM Task Execution Role vs Task Role
module "iam" {
  source                 = "../../modules/iam"
  project_name           = var.project_name
  environment            = var.environment
  attachments_bucket_arn = module.s3.attachments_bucket_arn
  db_secret_arn          = module.rds.secret_arn
}

# 7. Application Load Balancer with Blue/Green Target Groups
module "alb" {
  source            = "../../modules/alb"
  project_name      = var.project_name
  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  alb_sg_id         = module.security_groups.alb_sg_id
}

# 8. ECS Fargate Spot Dual-Container Cluster & Tasks
module "ecs" {
  source                       = "../../modules/ecs"
  project_name                 = var.project_name
  environment                  = var.environment
  private_subnet_ids           = module.vpc.private_subnet_ids
  ecs_tasks_sg_id              = module.security_groups.ecs_tasks_sg_id
  target_group_blue_arn        = module.alb.target_group_blue_arn
  execution_role_arn           = module.iam.execution_role_arn
  task_role_arn                = module.iam.task_role_arn
  db_secret_arn                = module.rds.secret_arn
  db_address                   = module.rds.address
  attachments_bucket_name      = module.s3.attachments_bucket_name
  user_pool_id                 = module.cognito.user_pool_id
  app_client_id                = module.cognito.client_id
  alb_arn_suffix               = module.alb.alb_arn_suffix
  target_group_blue_arn_suffix = module.alb.target_group_blue_arn_suffix
}

# 9. CloudWatch Metrics, Alarms, Dashboard & Outbound SNS Topics
module "monitoring" {
  source           = "../../modules/monitoring"
  project_name     = var.project_name
  environment      = var.environment
  ecs_cluster_name = module.ecs.cluster_name
  ecs_service_name = module.ecs.service_name
  alb_arn_suffix   = module.alb.alb_arn
}

# 10. 100% AWS Developer Tools CI/CD Suite (CodePipeline, CodeBuild, CodeDeploy)
module "cicd" {
  source                         = "../../modules/cicd"
  project_name                   = var.project_name
  environment                    = var.environment
  pipeline_artifacts_bucket_name = module.s3.pipeline_artifacts_bucket_name
  pipeline_artifacts_bucket_arn  = module.s3.pipeline_artifacts_bucket_arn
  ecr_repository_url             = module.ecs.ecr_repository_url
  ecs_cluster_name               = module.ecs.cluster_name
  ecs_service_name               = module.ecs.service_name
  target_group_blue_name         = module.alb.target_group_blue_name
  target_group_green_name        = module.alb.target_group_green_name
  production_listener_arn        = module.alb.production_listener_arn
  test_listener_arn              = module.alb.test_listener_arn
}

# 11. Amazon Route 53 Authoritative Public Hosted Zone
module "route53" {
  source       = "../../modules/route53"
  project_name = var.project_name
  environment  = var.environment
  domain_name  = var.domain_name
}

# 12. Amazon SES Native Inbound Email Ingestion & S3 Encrypted Storage
module "ses" {
  source          = "../../modules/ses"
  project_name    = var.project_name
  environment     = var.environment
  domain_name     = var.domain_name
  support_email   = var.support_email
  aws_region      = var.aws_region
  route53_zone_id = module.route53.zone_id
}


