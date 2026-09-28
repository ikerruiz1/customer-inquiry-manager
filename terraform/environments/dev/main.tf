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

module "vpc" {
  source             = "../../modules/vpc"
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  project_name       = var.project_name
  environment        = var.environment
}

module "security_groups" {
  source       = "../../modules/security_groups"
  vpc_id       = module.vpc.vpc_id
  project_name = var.project_name
  environment  = var.environment
}

module "cognito" {
  source       = "../../modules/cognito"
  project_name = var.project_name
  environment  = var.environment
}

module "rds" {
  source               = "../../modules/rds"
  project_name         = var.project_name
  environment          = var.environment
  db_subnet_group_name = module.vpc.db_subnet_group_name
  rds_sg_id            = module.security_groups.rds_sg_id
}

module "s3" {
  source       = "../../modules/s3"
  project_name = var.project_name
  environment  = var.environment
}

module "iam" {
  source                 = "../../modules/iam"
  project_name           = var.project_name
  environment            = var.environment
  attachments_bucket_arn = module.s3.attachments_bucket_arn
  db_secret_arn          = module.rds.secret_arn
  ses_inbound_bucket_arn = module.ses.inbound_bucket_arn
  user_pool_arn          = module.cognito.user_pool_arn
}

module "alb" {
  source            = "../../modules/alb"
  project_name      = var.project_name
  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  alb_sg_id         = module.security_groups.alb_sg_id
}

module "sqs" {
  source       = "../../modules/sqs"
  project_name = var.project_name
  environment  = var.environment
}

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
  sqs_inquiries_queue_url      = module.sqs.queue_url
  sqs_inquiries_dlq_url        = module.sqs.dlq_url
  ses_inbound_bucket_name      = module.ses.inbound_bucket_name
  ses_verified_sender_email    = module.ses.verified_sender_email
}

module "monitoring" {
  source               = "../../modules/monitoring"
  project_name         = var.project_name
  environment          = var.environment
  ecs_cluster_name     = module.ecs.cluster_name
  ecs_service_name     = module.ecs.service_name
  alb_arn_suffix       = module.alb.alb_arn_suffix
  inquiries_queue_name = module.sqs.queue_name
  inquiries_dlq_name   = module.sqs.dlq_name
}

module "cicd" {
  source                         = "../../modules/cicd"
  project_name                   = var.project_name
  environment                    = var.environment
  pipeline_artifacts_bucket_name = module.s3.pipeline_artifacts_bucket_name
  pipeline_artifacts_bucket_arn  = module.s3.pipeline_artifacts_bucket_arn
  ecr_repository_url             = module.ecs.ecr_repository_url
  ecs_cluster_name               = module.ecs.cluster_name
  ecs_service_name               = module.ecs.service_name
}


module "route53" {
  source       = "../../modules/route53"
  project_name = var.project_name
  environment  = var.environment
  domain_name  = var.domain_name
}

module "ses" {
  source          = "../../modules/ses"
  project_name    = var.project_name
  environment     = var.environment
  domain_name     = var.domain_name
  support_email   = var.support_email
  aws_region      = var.aws_region
  route53_zone_id = module.route53.zone_id
}
