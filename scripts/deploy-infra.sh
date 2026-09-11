#!/usr/bin/env bash
# ==============================================================================
# 1-Click Production Deployment Bootstrap for Customer Inquiry Manager
# ==============================================================================
set -euo pipefail

# ANSI color codes
C_RESET="\033[0m"
C_BOLD="\033[1m"
C_GREEN="\033[32m"
C_YELLOW="\033[33m"
C_RED="\033[31m"
C_CYAN="\033[36m"

echo -e "\n${C_BOLD}${C_CYAN}==============================================================================${C_RESET}"
echo -e "${C_BOLD}${C_CYAN}  ExampleCorp CIM: 1-Click Infrastructure & Container Bootstrap${C_RESET}"
echo -e "${C_BOLD}${C_CYAN}==============================================================================${C_RESET}\n"

# 1. Prerequisite Checks
echo -e "${C_BOLD}Phase 1: Validating Local Toolchain & AWS Credentials...${C_RESET}"
command -v aws >/dev/null 2>&1 || { echo -e "${C_RED}Error: AWS CLI is not installed.${C_RESET}"; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo -e "${C_RED}Error: Terraform is not installed.${C_RESET}"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo -e "${C_RED}Error: Docker is not installed.${C_RESET}"; exit 1; }

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
AWS_REGION=${AWS_DEFAULT_REGION:-"eu-west-1"}
echo -e "${C_GREEN}✓ AWS Authentication confirmed: Account ${AWS_ACCOUNT_ID} in ${AWS_REGION}${C_RESET}\n"

# 2. Template / Domain Configuration Synchronization
echo -e "${C_BOLD}Phase 2: Verifying Domain Configuration & Terraform Parameters...${C_RESET}"
if [ ! -f "company_profile.json" ] && [ -f "company_profile.example.json" ]; then
    echo -e "${C_YELLOW}! company_profile.json not found. Creating from company_profile.example.json...${C_RESET}"
    cp company_profile.example.json company_profile.json
fi

if [ ! -f "terraform/environments/dev/terraform.tfvars" ] && [ -f "terraform/environments/dev/terraform.tfvars.example" ]; then
    echo -e "${C_YELLOW}! terraform.tfvars not found. Creating from terraform.tfvars.example...${C_RESET}"
    cp terraform/environments/dev/terraform.tfvars.example terraform/environments/dev/terraform.tfvars
fi

DOMAIN_NAME=$(grep -o '"domain": "[^"]*' company_profile.json | head -n1 | cut -d'"' -f4)
SUPPORT_EMAIL=$(grep -o '"support_email": "[^"]*' company_profile.json | head -n1 | cut -d'"' -f4)
echo -e "${C_GREEN}✓ Configured Domain: ${C_CYAN}${DOMAIN_NAME}${C_RESET} (${SUPPORT_EMAIL})\n"

# 3. Terraform Initialization & Application
echo -e "${C_BOLD}Phase 3: Applying Modular Terraform Infrastructure (VPC, ECS, RDS, SES)...${C_RESET}"
cd terraform/environments/dev

terraform init
terraform validate
terraform apply -auto-approve

ALB_DNS=$(terraform output -raw alb_dns_name)
ECR_REPO=$(terraform output -raw ecr_repository_url)
COGNITO_POOL=$(terraform output -raw cognito_user_pool_id)
SES_VERIF_TOKEN=$(terraform output -raw ses_domain_verification_token)
SES_MX=$(terraform output -raw ses_mx_record)
SES_DKIM=$(terraform output -json ses_dkim_tokens)

cd ../../../

echo -e "\n${C_GREEN}✓ Infrastructure provisioned successfully.${C_RESET}"
echo -e "  - ALB Public DNS:  ${C_CYAN}http://${ALB_DNS}${C_RESET}"
echo -e "  - ECR Repository:  ${C_CYAN}${ECR_REPO}${C_RESET}"
echo -e "  - Cognito Pool ID: ${C_CYAN}${COGNITO_POOL}${C_RESET}\n"

echo -e "${C_BOLD}${C_YELLOW}------------------------------------------------------------------------------${C_RESET}"
echo -e "${C_BOLD}${C_YELLOW}  MANDATORY DNS RECORDS FOR REGISTRAR (get.tech, Namecheap, Route 53)${C_RESET}"
echo -e "${C_BOLD}${C_YELLOW}------------------------------------------------------------------------------${C_RESET}"
echo -e "  1. MX Record:     Type: MX    | Host: [empty]  | Value: ${SES_MX} | Priority: 10"
echo -e "  2. SPF Record:    Type: TXT   | Host: [empty]  | Value: v=spf1 include:amazonses.com ~all"
echo -e "  3. SES Verif:     Type: TXT   | Host: _amazonses | Value: ${SES_VERIF_TOKEN}"
echo -e "  4. DKIM Tokens:   Configure 3x CNAME records with targets: <token>.dkim.amazonses.com"
echo -e "${C_BOLD}${C_YELLOW}------------------------------------------------------------------------------${C_RESET}\n"

# 4. Docker Image Build & ECR Push
echo -e "${C_BOLD}Phase 4: Building Multi-Stage Production Container & Pushing to ECR...${C_RESET}"
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_REPO}"

docker build -t "${ECR_REPO}:latest" .
docker push "${ECR_REPO}:latest"
echo -e "${C_GREEN}✓ Production image pushed to ECR: ${ECR_REPO}:latest${C_RESET}\n"

# 5. Trigger ECS Rolling/Canary Deployment
echo -e "${C_BOLD}Phase 5: Restarting ECS Fargate Spot Tasks with New Container Image...${C_RESET}"
aws ecs update-service \
  --cluster "customer-inquiry-manager-dev-cluster" \
  --service "customer-inquiry-manager-dev-service" \
  --force-new-deployment \
  --region "${AWS_REGION}" >/dev/null

echo -e "${C_BOLD}${C_GREEN}==============================================================================${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}  DEPLOYMENT COMPLETE!${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}  Access Operations Console at: http://${ALB_DNS}${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}  Inbound emails to ${SUPPORT_EMAIL} will now route to SES!${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}==============================================================================${C_RESET}\n"
