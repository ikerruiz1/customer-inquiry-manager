#!/usr/bin/env bash
set -euo pipefail

C_RESET="\033[0m"
C_BOLD="\033[1m"
C_GREEN="\033[32m"
C_YELLOW="\033[33m"
C_RED="\033[31m"
C_CYAN="\033[36m"

DNS_ONLY=false
CUSTOM_DOMAIN=""
CUSTOM_EMAIL=""
CUSTOM_ADMIN_NAME=""
CUSTOM_ADMIN_EMAIL=""

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
    --admin-name)
      CUSTOM_ADMIN_NAME="$2"
      shift 2
      ;;
    --admin-email)
      CUSTOM_ADMIN_EMAIL="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

COMPANY_NAME="Customer Inquiry Manager"
if [ -f "company_profile.json" ]; then
    COMPANY_NAME=$(python -c "import json; print(json.load(open('company_profile.json')).get('company_name', 'Customer Inquiry Manager'))" 2>/dev/null || echo "Customer Inquiry Manager")
elif [ -f "company_profile.example.json" ]; then
    COMPANY_NAME=$(python -c "import json; print(json.load(open('company_profile.example.json')).get('company_name', 'Customer Inquiry Manager'))" 2>/dev/null || echo "Customer Inquiry Manager")
fi

echo -e "\n${C_BOLD}${C_CYAN}==============================================================================${C_RESET}"
echo -e "${C_BOLD}${C_CYAN}  ${COMPANY_NAME} - Cloud Infrastructure Deployment${C_RESET}"
echo -e "${C_BOLD}${C_CYAN}==============================================================================${C_RESET}\n"

echo -e "${C_BOLD}1. Checking AWS credentials and tools...${C_RESET}"
command -v aws >/dev/null 2>&1 || { echo -e "${C_RED}Error: AWS CLI is not installed.${C_RESET}"; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo -e "${C_RED}Error: Terraform is not installed.${C_RESET}"; exit 1; }


AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
AWS_REGION=${AWS_DEFAULT_REGION:-"eu-west-1"}
echo -e "${C_GREEN}  OK: AWS account ${AWS_ACCOUNT_ID} (${AWS_REGION})${C_RESET}\n"

echo -e "${C_BOLD}2. Loading domain configuration...${C_RESET}"
if [ ! -f "company_profile.json" ] && [ -f "company_profile.example.json" ]; then
    echo -e "${C_YELLOW}! company_profile.json not found. Creating from company_profile.example.json...${C_RESET}"
    cp company_profile.example.json company_profile.json
fi

CURRENT_DOMAIN=$(grep -o '"domain": "[^"]*' company_profile.json | head -n1 | cut -d'"' -f4 || echo "your-company-domain.tech")
CURRENT_EMAIL=$(grep -o '"support_email": "[^"]*' company_profile.json | head -n1 | cut -d'"' -f4 || echo "support@${CURRENT_DOMAIN}")
ACTIVE_DOMAIN="$CURRENT_DOMAIN"
ACTIVE_EMAIL="$CURRENT_EMAIL"

if [ -n "$CUSTOM_DOMAIN" ]; then
    ACTIVE_DOMAIN="$CUSTOM_DOMAIN"
    ACTIVE_EMAIL="${CUSTOM_EMAIL:-support@$ACTIVE_DOMAIN}"
elif [ -t 0 ]; then
    echo -e "${C_CYAN}  Configure Custom Domain (e.g. your-company-domain.tech or your own registrar domain):${C_RESET}"
    read -p "  Enter Domain [Press Enter to keep '$CURRENT_DOMAIN']: " PROMPT_DOMAIN
    if [ -n "$PROMPT_DOMAIN" ]; then
        ACTIVE_DOMAIN="$PROMPT_DOMAIN"
        read -p "  Enter Support Inbound Email [Press Enter for 'support@$ACTIVE_DOMAIN']: " PROMPT_EMAIL
        ACTIVE_EMAIL="${PROMPT_EMAIL:-support@$ACTIVE_DOMAIN}"
    fi
fi

DEFAULT_ADMIN_PREFIX="admin"
ACTIVE_ADMIN_NAME="${CUSTOM_ADMIN_NAME:-Cloud Administrator}"
ACTIVE_ADMIN_PREFIX="$DEFAULT_ADMIN_PREFIX"

if [ -n "$CUSTOM_ADMIN_EMAIL" ]; then
    ACTIVE_ADMIN_PREFIX=$(echo "$CUSTOM_ADMIN_EMAIL" | cut -d'@' -f1)
elif [ -t 0 ] && [ -z "$CUSTOM_ADMIN_NAME" ] && [ -z "$CUSTOM_ADMIN_EMAIL" ]; then
    echo -e "${C_CYAN}  Administrator account configuration:${C_RESET}"
    read -p "  Enter Admin Full Name [Press Enter for '$ACTIVE_ADMIN_NAME']: " PROMPT_ADMIN_NAME
    ACTIVE_ADMIN_NAME="${PROMPT_ADMIN_NAME:-$ACTIVE_ADMIN_NAME}"
    read -p "  Enter Admin username prefix [Press Enter for '$DEFAULT_ADMIN_PREFIX' -> ${DEFAULT_ADMIN_PREFIX}@${ACTIVE_DOMAIN}]: " PROMPT_ADMIN_PREFIX
    if [ -n "$PROMPT_ADMIN_PREFIX" ]; then
        ACTIVE_ADMIN_PREFIX=$(echo "$PROMPT_ADMIN_PREFIX" | cut -d'@' -f1)
    fi
fi

ACTIVE_ADMIN_EMAIL="${ACTIVE_ADMIN_PREFIX}@${ACTIVE_DOMAIN}"

python -c "
import json
with open('company_profile.json', 'r', encoding='utf-8') as f:
    d = json.load(f)
d['domain'] = '$ACTIVE_DOMAIN'
d['support_email'] = '$ACTIVE_EMAIL'
d['admin_name'] = '$ACTIVE_ADMIN_NAME'
d['admin_email'] = '$ACTIVE_ADMIN_EMAIL'
if 'inbound_channels' in d:
    d['inbound_channels']['email'] = '$ACTIVE_EMAIL'
    if d['inbound_channels'].get('webform_url'):
        d['inbound_channels']['webform_url'] = 'https://portal.$ACTIVE_DOMAIN/contact'
    else:
        d['inbound_channels']['webform_url'] = ''
    d['inbound_channels']['trustpilot_profile'] = 'https://www.trustpilot.com/review/$ACTIVE_DOMAIN'
with open('company_profile.json', 'w', encoding='utf-8') as f:
    json.dump(d, f, indent=2)
"
echo -e "${C_GREEN}✓ Synchronized company_profile.json with domain: ${C_CYAN}${ACTIVE_DOMAIN}${C_RESET}"

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

# Pre-provisioning Route 53 breaks circular dependency between registrar delegation and ACM/SES validation timeouts
if [ "$DNS_ONLY" = true ]; then
    echo -e "${C_BOLD}${C_CYAN}==============================================================================${C_RESET}"
    echo -e "${C_BOLD}${C_CYAN}  Route 53 DNS Setup: Provisioning Public Hosted Zone...${C_RESET}"
    echo -e "${C_BOLD}${C_CYAN}==============================================================================${C_RESET}"
    cd terraform/environments/dev
    terraform init
    terraform apply "-target=module.route53" "-target=module.ses" -auto-approve -var="domain_name=${ACTIVE_DOMAIN}" -var="support_email=${ACTIVE_EMAIL}"
    RAW_NS=$(terraform output -json route53_name_servers)
    cd ../../../

    echo -e "\n${C_BOLD}${C_GREEN}==============================================================================${C_RESET}"
    echo -e "${C_BOLD}${C_GREEN}  Route 53 Hosted Zone Created${C_RESET}"
    echo -e "${C_BOLD}${C_GREEN}==============================================================================${C_RESET}"
    echo -e "  Domain: ${C_CYAN}${ACTIVE_DOMAIN}${C_RESET} (${AWS_REGION})\n"
    echo -e "${C_BOLD}${C_YELLOW}  AWS Name Servers:${C_RESET}"
    python -c "
import json
ns = json.loads('''$RAW_NS''')
for i, s in enumerate(ns, 1):
    print(f'    {i}. {s}')
"
    echo -e "\n  Next steps:"
    echo -e "  1. Update nameservers in your registrar for ${ACTIVE_DOMAIN} with the servers above."
    echo -e "  2. Verify resolution with: nslookup -type=NS ${ACTIVE_DOMAIN}"
    echo -e "  3. Run ./scripts/deploy-infra.sh to deploy the application.\n"
    echo -e "${C_BOLD}${C_GREEN}==============================================================================${C_RESET}\n"
    exit 0
fi

echo -e "${C_BOLD}3. Provisioning AWS infrastructure with Terraform...${C_RESET}"
cd terraform/environments/dev

terraform init
terraform validate
terraform apply -auto-approve -var="domain_name=${ACTIVE_DOMAIN}" -var="support_email=${ACTIVE_EMAIL}"

ALB_DNS=$(terraform output -raw alb_dns_name)
ECR_REPO=$(terraform output -raw ecr_repository_url)
COGNITO_POOL=$(terraform output -raw cognito_user_pool_id)
PIPELINE_BUCKET=$(terraform output -raw pipeline_artifacts_bucket_name)
PIPELINE_NAME=$(terraform output -raw codepipeline_name)
RAW_NS=$(terraform output -json route53_name_servers)

cd ../../../

echo -e "\n${C_GREEN}✓ Infrastructure provisioned successfully.${C_RESET}"
echo -e "  - ALB Public DNS:  ${C_CYAN}http://${ALB_DNS}${C_RESET}"
echo -e "  - ECR Repository:  ${C_CYAN}${ECR_REPO}${C_RESET}"
echo -e "  - Cognito Pool ID: ${C_CYAN}${COGNITO_POOL}${C_RESET}"
echo -e "  - CodePipeline:    ${C_CYAN}${PIPELINE_NAME}${C_RESET}"
echo -e "  - Pipeline Bucket: ${C_CYAN}s3://${PIPELINE_BUCKET}${C_RESET}\n"

echo -e "${C_BOLD}4. Packaging source code and triggering AWS CodePipeline...${C_RESET}"
PY_EXEC="python3"
if [ -f ".venv/bin/python" ]; then
  PY_EXEC=".venv/bin/python"
elif command -v python &>/dev/null; then
  PY_EXEC="python"
fi

$PY_EXEC scripts/package_source.py source.zip
aws s3 cp source.zip "s3://${PIPELINE_BUCKET}/source.zip" --region "${AWS_REGION}"
rm -f source.zip
echo -e "${C_GREEN}  OK: Source archive uploaded to s3://${PIPELINE_BUCKET}/source.zip${C_RESET}"
echo -e "${C_GREEN}  OK: AWS CodePipeline (${PIPELINE_NAME}) triggered for cloud build & DevSecOps.${C_RESET}\n"

echo -e "${C_BOLD}5. Setting up initial administrator in Cognito...${C_RESET}"
echo -e "  ${C_CYAN}Admin: ${ACTIVE_ADMIN_EMAIL} (${ACTIVE_ADMIN_NAME})${C_RESET}"

PY_EXEC="python3"
if [ -f ".venv/bin/python" ]; then
  PY_EXEC=".venv/bin/python"
elif command -v python &>/dev/null; then
  PY_EXEC="python"
fi

$PY_EXEC scripts/provision_operator.py \
  --name "${ACTIVE_ADMIN_NAME}" \
  --email "${ACTIVE_ADMIN_EMAIL}" \
  --role "Operations_Manager" \
  --cognito \
  --pool-id "${COGNITO_POOL}" \
  --region "${AWS_REGION}" || echo -e "${C_YELLOW}  [Notice] Administrator account managed via existing identity.${C_RESET}"

echo -e "\n${C_BOLD}${C_GREEN}==============================================================================${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}  Deployment Complete${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}==============================================================================${C_RESET}"
echo -e "  Console URL:     http://${ALB_DNS}"
echo -e "  Admin Username:  ${C_YELLOW}${ACTIVE_ADMIN_EMAIL}${C_RESET}"
echo -e "  Admin Role:      Operations_Manager"
echo -e "  Cognito Pool:    ${COGNITO_POOL}"
echo -e "  Secrets Manager: customer-inquiry-manager/dev/operator-credentials"
echo -e "------------------------------------------------------------------------------"
echo -e "  Sign in at http://${ALB_DNS} with ${ACTIVE_ADMIN_EMAIL} and the temporary password"
echo -e "  printed above. First login will prompt for a permanent password and TOTP MFA."
echo -e "${C_BOLD}${C_GREEN}==============================================================================${C_RESET}\n"
