#!/usr/bin/env bash
# ==============================================================================
# 1-Click Production Deployment Bootstrap for Customer Inquiry Manager
# Fully Parameterized & Automated (Zero Hardcoded Domain Dependencies)
# ==============================================================================
set -euo pipefail

# ANSI color codes
C_RESET="\033[0m"
C_BOLD="\033[1m"
C_GREEN="\033[32m"
C_YELLOW="\033[33m"
C_RED="\033[31m"
C_CYAN="\033[36m"

DNS_ONLY=false
CUSTOM_DOMAIN=""
CUSTOM_EMAIL=""

# Parse command line options
while [[ $# -gt 0 ]]; do
  case $1 in
    --dns-only)
      DNS_ONLY=true
      shift
      ;;
    --domain)
      CUSTOM_DOMAIN="$2"
      shift 2
      ;;
    --email)
      CUSTOM_EMAIL="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo -e "\n${C_BOLD}${C_CYAN}==============================================================================${C_RESET}"
echo -e "${C_BOLD}${C_CYAN}  ExampleCorp CIM: 1-Click Infrastructure & Container Bootstrap${C_RESET}"
echo -e "${C_BOLD}${C_CYAN}==============================================================================${C_RESET}\n"

# 1. Prerequisite Checks
echo -e "${C_BOLD}Phase 1: Validating Local Toolchain & AWS Credentials...${C_RESET}"
command -v aws >/dev/null 2>&1 || { echo -e "${C_RED}Error: AWS CLI is not installed.${C_RESET}"; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo -e "${C_RED}Error: Terraform is not installed.${C_RESET}"; exit 1; }
if [ "$DNS_ONLY" = false ]; then
  command -v docker >/dev/null 2>&1 || { echo -e "${C_RED}Error: Docker is not installed.${C_RESET}"; exit 1; }
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
AWS_REGION=${AWS_DEFAULT_REGION:-"eu-west-1"}
echo -e "${C_GREEN}✓ AWS Authentication confirmed: Account ${AWS_ACCOUNT_ID} in ${AWS_REGION}${C_RESET}\n"

# 2. Template / Domain Configuration Synchronization
echo -e "${C_BOLD}Phase 2: Resolving Dynamic Custom Domain Configuration...${C_RESET}"
if [ ! -f "company_profile.json" ] && [ -f "company_profile.example.json" ]; then
    echo -e "${C_YELLOW}! company_profile.json not found. Creating from company_profile.example.json...${C_RESET}"
    cp company_profile.example.json company_profile.json
fi

CURRENT_DOMAIN=$(grep -o '"domain": "[^"]*' company_profile.json | head -n1 | cut -d'"' -f4 || echo "example-corp.tech")
CURRENT_EMAIL=$(grep -o '"support_email": "[^"]*' company_profile.json | head -n1 | cut -d'"' -f4 || echo "support@${CURRENT_DOMAIN}")

ACTIVE_DOMAIN="$CURRENT_DOMAIN"
ACTIVE_EMAIL="$CURRENT_EMAIL"

if [ -n "$CUSTOM_DOMAIN" ]; then
    ACTIVE_DOMAIN="$CUSTOM_DOMAIN"
    ACTIVE_EMAIL="${CUSTOM_EMAIL:-support@$ACTIVE_DOMAIN}"
elif [ -t 0 ]; then
    echo -e "${C_CYAN}  Configure Custom Domain (e.g. example-corp.tech or your own registrar domain):${C_RESET}"
    read -p "  Enter Domain [Press Enter to keep '$CURRENT_DOMAIN']: " PROMPT_DOMAIN
    if [ -n "$PROMPT_DOMAIN" ]; then
        ACTIVE_DOMAIN="$PROMPT_DOMAIN"
        read -p "  Enter Support Inbound Email [Press Enter for 'support@$ACTIVE_DOMAIN']: " PROMPT_EMAIL
        ACTIVE_EMAIL="${PROMPT_EMAIL:-support@$ACTIVE_DOMAIN}"
    fi
fi

# Update company_profile.json
python -c "
import json
with open('company_profile.json', 'r', encoding='utf-8') as f:
    d = json.load(f)
d['domain'] = '$ACTIVE_DOMAIN'
d['support_email'] = '$ACTIVE_EMAIL'
d['operations_manager_email'] = 'ops-manager@$ACTIVE_DOMAIN'
if 'inbound_channels' in d:
    d['inbound_channels']['email'] = '$ACTIVE_EMAIL'
    d['inbound_channels']['webform_url'] = 'https://portal.$ACTIVE_DOMAIN/contact'
    d['inbound_channels']['trustpilot_profile'] = 'https://www.trustpilot.com/review/$ACTIVE_DOMAIN'
with open('company_profile.json', 'w', encoding='utf-8') as f:
    json.dump(d, f, indent=2)
"
echo -e "${C_GREEN}✓ Synchronized company_profile.json with domain: ${C_CYAN}${ACTIVE_DOMAIN}${C_RESET}"

# Automatically write synchronized terraform.tfvars
cat <<EOF > terraform/environments/dev/terraform.tfvars
aws_region         = "${AWS_REGION}"
project_name       = "customer-inquiry-manager"
environment        = "dev"
vpc_cidr           = "10.0.0.0/16"
availability_zones = ["${AWS_REGION}a", "${AWS_REGION}b"]
domain_name        = "${ACTIVE_DOMAIN}"
support_email      = "${ACTIVE_EMAIL}"
EOF
echo -e "${C_GREEN}✓ Synchronized terraform/environments/dev/terraform.tfvars${C_RESET}\n"

# ------------------------------------------------------------------------------
# Targeted DNS Mode (--dns-only)
# ------------------------------------------------------------------------------
if [ "$DNS_ONLY" = true ]; then
    echo -e "${C_BOLD}${C_CYAN}==============================================================================${C_RESET}"
    echo -e "${C_BOLD}${C_CYAN}  TARGETED DNS MODE (--dns-only): Provisioning Route 53 Public Hosted Zone...${C_RESET}"
    echo -e "${C_BOLD}${C_CYAN}==============================================================================${C_RESET}"
    cd terraform/environments/dev
    terraform init
    terraform apply -target=module.route53 -auto-approve -var="domain_name=${ACTIVE_DOMAIN}" -var="support_email=${ACTIVE_EMAIL}"
    RAW_NS=$(terraform output -json route53_name_servers)
    cd ../../../

    echo -e "\n${C_BOLD}${C_GREEN}==============================================================================${C_RESET}"
    echo -e "${C_BOLD}${C_GREEN}  ROUTE 53 PUBLIC HOSTED ZONE DEPLOYED SUCCESSFULLY!${C_RESET}"
    echo -e "${C_BOLD}${C_GREEN}==============================================================================${C_RESET}"
    echo -e "  Domain:        ${C_CYAN}${ACTIVE_DOMAIN}${C_RESET}"
    echo -e "  Target Region: ${C_CYAN}${AWS_REGION}${C_RESET}\n"
    echo -e "${C_BOLD}${C_YELLOW}  ACTION REQUIRED IN YOUR REGISTRAR (get.tech, Namecheap, GoDaddy, etc.):${C_RESET}"
    echo -e "${C_BOLD}${C_YELLOW}  Go to your domain dashboard -> DNS -> Nameservers -> Edit Nameservers${C_RESET}"
    echo -e "${C_BOLD}${C_YELLOW}  Replace existing nameservers with these 4 authoritative AWS Route 53 servers:${C_RESET}\n"
    
    python -c "
import json
ns = json.loads('''$RAW_NS''')
for i, s in enumerate(ns, 1):
    print(f'    {i}. {s}')
"
    echo -e "\n${C_GREEN}  Once updated, AWS Route 53 manages all MX, SPF, DKIM, and ALB records automatically.${C_RESET}"
    echo -e "  When ready, run ./scripts/deploy-infra.sh to deploy the full application stack.\n"
    exit 0
fi

# ------------------------------------------------------------------------------
# Full Infrastructure Deployment
# ------------------------------------------------------------------------------
echo -e "${C_BOLD}Phase 3: Applying Modular Terraform Infrastructure (VPC, ECS, RDS, SES, Route53)...${C_RESET}"
cd terraform/environments/dev

terraform init
terraform validate
terraform apply -auto-approve -var="domain_name=${ACTIVE_DOMAIN}" -var="support_email=${ACTIVE_EMAIL}"

ALB_DNS=$(terraform output -raw alb_dns_name)
ECR_REPO=$(terraform output -raw ecr_repository_url)
COGNITO_POOL=$(terraform output -raw cognito_user_pool_id)
RAW_NS=$(terraform output -json route53_name_servers)

cd ../../../

echo -e "\n${C_GREEN}✓ Infrastructure provisioned successfully.${C_RESET}"
echo -e "  - ALB Public DNS:  ${C_CYAN}http://${ALB_DNS}${C_RESET}"
echo -e "  - ECR Repository:  ${C_CYAN}${ECR_REPO}${C_RESET}"
echo -e "  - Cognito Pool ID: ${C_CYAN}${COGNITO_POOL}${C_RESET}\n"

echo -e "${C_BOLD}${C_YELLOW}==============================================================================${C_RESET}"
echo -e "${C_BOLD}${C_YELLOW}  DELEGATE DOMAIN NAMESERVERS IN REGISTRAR (get.tech, Namecheap, GoDaddy)${C_RESET}"
echo -e "${C_BOLD}${C_YELLOW}==============================================================================${C_RESET}"
python -c "
import json
ns = json.loads('''$RAW_NS''')
for i, s in enumerate(ns, 1):
    print(f'    {i}. {s}')
"
echo -e "${C_GREEN}  AWS Route 53 automatically publishes MX, SPF, DKIM, and ALB records.${C_RESET}\n"

# 4. Docker Image Build & ECR Push
echo -e "${C_BOLD}Phase 4: Building Multi-Stage Production Container & Pushing to ECR...${C_RESET}"
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_REPO}"

docker build -t "${ECR_REPO}:latest" .
docker push "${ECR_REPO}:latest"
echo -e "${C_GREEN}✓ Production image pushed to ECR: ${ECR_REPO}:latest${C_RESET}\n"

# 5. Trigger ECS Rolling Deployment
echo -e "${C_BOLD}Phase 5: Restarting ECS Fargate Spot Tasks with New Container Image...${C_RESET}"
aws ecs update-service \
  --cluster "customer-inquiry-manager-dev-cluster" \
  --service "customer-inquiry-manager-dev-service" \
  --force-new-deployment \
  --region "${AWS_REGION}" >/dev/null

echo -e "${C_BOLD}${C_GREEN}==============================================================================${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}  DEPLOYMENT COMPLETE!${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}  Access Operations Console at: http://${ALB_DNS}${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}  Inbound emails to ${ACTIVE_EMAIL} will route natively to Amazon SES!${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}==============================================================================${C_RESET}\n"
