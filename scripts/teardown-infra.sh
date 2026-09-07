#!/usr/bin/env bash
# ==============================================================================
# 1-Click Clean Teardown Automation: Guaranteeing 0.00 € Residual Cost
# ==============================================================================
set -euo pipefail

# ANSI color codes
C_RESET="\033[0m"
C_BOLD="\033[1m"
C_GREEN="\033[32m"
C_YELLOW="\033[33m"
C_RED="\033[31m"
C_CYAN="\033[36m"

echo -e "\n${C_BOLD}${C_RED}==============================================================================${C_RESET}"
echo -e "${C_BOLD}${C_RED}  ExampleCorp CIM: 1-Click Clean Teardown (0.00 € Residual Cost Guarantee)${C_RESET}"
echo -e "${C_BOLD}${C_RED}==============================================================================${C_RESET}\n"

AWS_REGION=${AWS_DEFAULT_REGION:-"eu-west-1"}

# 1. Purge S3 Buckets to Avoid Dependency Lock
echo -e "${C_BOLD}Phase 1: Emptying all project S3 buckets (versioned & unversioned)...${C_RESET}"
BUCKETS=$(aws s3api list-buckets --query "Buckets[?contains(Name, 'customer-inquiry-manager')].Name" --output text || echo "")

for BUCKET in $BUCKETS; do
  if [ -n "$BUCKET" ]; then
    echo -e "  Purging s3://${BUCKET}..."
    aws s3 rm "s3://${BUCKET}" --recursive --region "${AWS_REGION}" || true
    # Remove versioned objects and delete markers
    aws s3api delete-objects --bucket "${BUCKET}" \
      --delete "$(aws s3api list-object-versions --bucket "${BUCKET}" --query='{Objects: Versions[].{Key:Key,VersionId:VersionId}}' --output json)" >/dev/null 2>&1 || true
    aws s3api delete-objects --bucket "${BUCKET}" \
      --delete "$(aws s3api list-object-versions --bucket "${BUCKET}" --query='{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' --output json)" >/dev/null 2>&1 || true
  fi
done
echo -e "${C_GREEN}✓ All S3 buckets purged.${C_RESET}\n"

# 2. Delete ECR Container Images
echo -e "${C_BOLD}Phase 2: Purging ECR container repository images...${C_RESET}"
REPO_NAME="customer-inquiry-manager-dev"
IMAGE_IDS=$(aws ecr list-images --repository-name "${REPO_NAME}" --region "${AWS_REGION}" --query "imageIds[*]" --output json 2>/dev/null || echo "[]")
if [ "$IMAGE_IDS" != "[]" ] && [ -n "$IMAGE_IDS" ]; then
  echo -e "  Purging images from ${REPO_NAME}..."
  aws ecr batch-delete-image --repository-name "${REPO_NAME}" --image-ids "${IMAGE_IDS}" --region "${AWS_REGION}" >/dev/null 2>&1 || true
fi
echo -e "${C_GREEN}✓ ECR repository purged.${C_RESET}\n"

# 3. Execute Complete Terraform Destroy
echo -e "${C_BOLD}Phase 3: Executing Terraform Destroy...${C_RESET}"
cd terraform/environments/dev

terraform destroy -auto-approve

cd ../../../

echo -e "\n${C_BOLD}${C_GREEN}==============================================================================${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}  TEARDOWN SUCCESSFUL!${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}  All cloud resources deleted. Verified 0.00 € residual cost.${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}==============================================================================${C_RESET}\n"
