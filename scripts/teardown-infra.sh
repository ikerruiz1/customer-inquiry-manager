#!/usr/bin/env bash
set -euo pipefail

C_RESET="\033[0m"
C_BOLD="\033[1m"
C_GREEN="\033[32m"
C_YELLOW="\033[33m"
C_RED="\033[31m"
C_CYAN="\033[36m"

COMPANY_NAME="Customer Inquiry Manager"
if [ -f "company_profile.json" ]; then
    COMPANY_NAME=$(python -c "import json; print(json.load(open('company_profile.json')).get('company_name', 'Customer Inquiry Manager'))" 2>/dev/null || echo "Customer Inquiry Manager")
elif [ -f "company_profile.example.json" ]; then
    COMPANY_NAME=$(python -c "import json; print(json.load(open('company_profile.example.json')).get('company_name', 'Customer Inquiry Manager'))" 2>/dev/null || echo "Customer Inquiry Manager")
fi

echo -e "\n${C_BOLD}${C_RED}==============================================================================${C_RESET}"
echo -e "${C_BOLD}${C_RED}  ${COMPANY_NAME} - Cloud Teardown${C_RESET}"
echo -e "${C_BOLD}${C_RED}==============================================================================${C_RESET}\n"

AWS_REGION=${AWS_DEFAULT_REGION:-"eu-west-1"}

# S3 and ECR reject deletion when containing artifacts; emptying them prevents Terraform state locks
echo -e "${C_BOLD}1. Emptying project S3 buckets...${C_RESET}"
BUCKETS=$(aws s3api list-buckets --query "Buckets[?contains(Name, 'customer-inquiry-manager')].Name" --output text || echo "")

for BUCKET in $BUCKETS; do
  if [ -n "$BUCKET" ]; then
    echo -e "  Purging s3://${BUCKET}..."
    aws s3 rm "s3://${BUCKET}" --recursive --region "${AWS_REGION}" || true
    aws s3api delete-objects --bucket "${BUCKET}" \
      --delete "$(aws s3api list-object-versions --bucket "${BUCKET}" --query='{Objects: Versions[].{Key:Key,VersionId:VersionId}}' --output json)" >/dev/null 2>&1 || true
    aws s3api delete-objects --bucket "${BUCKET}" \
      --delete "$(aws s3api list-object-versions --bucket "${BUCKET}" --query='{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' --output json)" >/dev/null 2>&1 || true
  fi
done
echo -e "${C_GREEN}  OK: S3 buckets emptied.${C_RESET}\n"

echo -e "${C_BOLD}2. Deleting ECR container images...${C_RESET}"
REPO_NAME="customer-inquiry-manager-dev"
IMAGE_IDS=$(aws ecr list-images --repository-name "${REPO_NAME}" --region "${AWS_REGION}" --query "imageIds[*]" --output json 2>/dev/null || echo "[]")
if [ "$IMAGE_IDS" != "[]" ] && [ -n "$IMAGE_IDS" ]; then
  echo -e "  Purging images from ${REPO_NAME}..."
  aws ecr batch-delete-image --repository-name "${REPO_NAME}" --image-ids "${IMAGE_IDS}" --region "${AWS_REGION}" >/dev/null 2>&1 || true
fi
echo -e "${C_GREEN}  OK: ECR images deleted.${C_RESET}\n"

echo -e "${C_BOLD}3. Running terraform destroy...${C_RESET}"
EXTRA_VARS=""
if [ -f "company_profile.json" ]; then
    D_NAME=$(grep -o '"domain": "[^"]*' company_profile.json | head -n1 | cut -d'"' -f4)
    S_MAIL=$(grep -o '"support_email": "[^"]*' company_profile.json | head -n1 | cut -d'"' -f4)
    if [ -n "$D_NAME" ]; then EXTRA_VARS="$EXTRA_VARS -var=domain_name=$D_NAME"; fi
    if [ -n "$S_MAIL" ]; then EXTRA_VARS="$EXTRA_VARS -var=support_email=$S_MAIL"; fi
fi

cd terraform/environments/dev

terraform destroy -auto-approve $EXTRA_VARS

cd ../../../

echo -e "\n${C_BOLD}${C_GREEN}==============================================================================${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}  Teardown Complete${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}  All cloud resources deleted successfully.${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}==============================================================================${C_RESET}\n"
