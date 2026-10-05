#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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
PROJECT_TAG="customer-inquiry-manager"
FAILURES=()

record_failure() {
    FAILURES+=("$1")
    echo -e "  ${C_RED}! $1${C_RESET}"
}

# Remove every image from a repository, tagged and untagged.
# batch-delete-image requires imageDigest or imageTag keys, so the list must come from
# describe-images; list-images emits an imageId key that the API rejects, and it accepts at
# most 100 identifiers per call, so the deletion repeats until the repository reports empty.
purge_ecr_repository() {
    local repository=$1
    local deleted=0
    local ids_file
    ids_file=$(mktemp)

    while true; do
        if ! aws ecr describe-images --repository-name "${repository}" --region "${AWS_REGION}" \
            --output json > "${ids_file}" 2>/dev/null; then
            echo -e "  Cannot read images from ${repository}, skipping."
            rm -f "${ids_file}"
            echo 0
            return
        fi

        python3 - "${ids_file}" <<'PY' > "${ids_file}.ids"
import json, sys
details = json.load(open(sys.argv[1])).get("imageDetails", [])
identifiers = []
for image in details:
    tags = image.get("imageTags")
    if tags:
        identifiers.append({"imageTag": tags[0]})
    else:
        identifiers.append({"imageDigest": image["imageDigest"]})
json.dump(identifiers, open(sys.argv[1] + ".ids", "w"))
PY

        local count
        count=$(python3 -c "import json,sys; print(len(json.load(open(sys.argv[1]))))" "${ids_file}.ids")
        if [ "${count}" -eq 0 ]; then
            break
        fi

        if ! response=$(aws ecr batch-delete-image --repository-name "${repository}" \
            --region "${AWS_REGION}" --image-ids "file://${ids_file}.ids" --output json 2>&1); then
            record_failure "ECR ${repository}: ${response}"
            rm -f "${ids_file}" "${ids_file}.ids"
            echo "${deleted}"
            return
        fi
        local image_failures
        image_failures=$(python3 -c "import json,sys; print(len(json.loads(sys.argv[1]).get('failures', [])))" "${response}" 2>/dev/null || echo 0)
        if [ "${image_failures}" -ne 0 ]; then
            record_failure "ECR ${repository}: ${image_failures} images could not be deleted"
        fi

        deleted=$((deleted + count))
        if [ "${count}" -lt 100 ]; then
            sleep 2
        fi
    done

    rm -f "${ids_file}" "${ids_file}.ids"
    echo "${deleted}"
}

# S3 rejects bucket deletion while objects, object versions or delete markers remain.
purge_bucket() {
    local bucket=$1
    aws s3 rm "s3://${bucket}" --recursive --region "${AWS_REGION}" >/dev/null 2>&1 || true

    local versions_file
    versions_file=$(mktemp)
    if aws s3api list-object-versions --bucket "${bucket}" --region "${AWS_REGION}" \
        --output json > "${versions_file}" 2>/dev/null; then
        local payload
        payload=$(python3 - "${versions_file}" <<'PY'
import json, sys
parsed = json.load(open(sys.argv[1]))
objects = [{"Key": v["Key"], "VersionId": v["VersionId"]} for v in parsed.get("Versions", [])]
objects += [{"Key": d["Key"], "VersionId": d["VersionId"]} for d in parsed.get("DeleteMarkers", [])]
json.dump({"Objects": objects}, open(sys.argv[1] + ".payload", "w"))
PY
)
        aws s3api delete-objects --bucket "${bucket}" --delete "file://${versions_file}.payload" \
            --region "${AWS_REGION}" >/dev/null 2>&1 || true
        rm -f "${versions_file}.payload"
    fi
    rm -f "${versions_file}"

    local left
    left=$(aws s3api list-object-versions --bucket "${bucket}" --region "${AWS_REGION}" \
        --query 'length(Versions)' --output text 2>/dev/null || echo 0)
    if [ "${left}" != "0" ]; then
        record_failure "S3 ${bucket}: ${left} object versions still present"
    fi
}

# Resources Terraform can no longer plan, because a module they depend on was already
# destroyed and its outputs are unknown, abort the whole graph. Falling back to a targeted
# destroy of whatever the state still holds keeps the teardown finishable.
managed_resource_addresses() {
    # terraform state list resolves through whichever backend is configured. Parsing the local
    # terraform.tfstate returns nothing once the state is remote.
    (cd "${REPO_ROOT}/terraform/environments/dev" && terraform state list 2>/dev/null) || true
}

# Returns the -backend-config arguments for the environment state bucket, or prints nothing when
# terraform/bootstrap has never been applied and no remote backend exists yet.
remote_state_backend_args() {
    local region="$1"
    local bucket key

    [ -d "${REPO_ROOT}/terraform/bootstrap" ] || return 0

    (cd "${REPO_ROOT}/terraform/bootstrap" && terraform init -input=false -reconfigure >/dev/null 2>&1) || return 0

    bucket=$(cd "${REPO_ROOT}/terraform/bootstrap" && terraform output -raw bucket_name 2>/dev/null || echo "")
    key=$(cd "${REPO_ROOT}/terraform/bootstrap" && terraform output -raw state_key 2>/dev/null || echo "")

    if [ -z "${bucket}" ] || [ -z "${key}" ]; then
        return 0
    fi

    printf '%s\n' \
        "-backend-config=bucket=${bucket}" \
        "-backend-config=key=${key}" \
        "-backend-config=region=${region}"
}

echo -e "${C_BOLD}1. Emptying project S3 buckets...${C_RESET}"
BUCKETS=$(aws s3api list-buckets --query "Buckets[?contains(Name, '${PROJECT_TAG}')].Name" --output text 2>/dev/null || echo "")
for BUCKET in $BUCKETS; do
    if [ -n "${BUCKET}" ]; then
        echo -e "  Purging s3://${BUCKET}..."
        purge_bucket "${BUCKET}"
    fi
done
echo -e "  ${C_GREEN}S3 purge finished.${C_RESET}\n"

echo -e "${C_BOLD}2. Deleting ECR container images...${C_RESET}"
REPOSITORIES=$(aws ecr describe-repositories --region "${AWS_REGION}" \
    --query "repositories[?contains(repositoryName, '${PROJECT_TAG}')].repositoryName" --output text 2>/dev/null || echo "")
if [ -n "${REPOSITORIES// /}" ]; then
    for REPOSITORY in $REPOSITORIES; do
        echo -e "  Purging images from ${REPOSITORY}..."
        deleted=$(purge_ecr_repository "${REPOSITORY}")
        left=$(aws ecr describe-images --repository-name "${REPOSITORY}" --region "${AWS_REGION}" \
            --query 'length(imageDetails)' --output text 2>/dev/null || echo 0)
        if [ "${left}" != "0" ]; then
            record_failure "ECR ${REPOSITORY}: ${left} images remain after purge"
        else
            echo -e "  ${REPOSITORY} emptied (${deleted} images deleted)."
        fi
    done
else
    echo -e "  ${C_GREEN}No ECR repositories match the project.${C_RESET}"
fi
echo ""

echo -e "${C_BOLD}3. Running terraform destroy...${C_RESET}"
EXTRA_VARS=()
if [ -f "company_profile.json" ]; then
    D_NAME=$(grep -o '"domain": "[^"]*' company_profile.json | head -n1 | cut -d'"' -f4)
    S_MAIL=$(grep -o '"support_email": "[^"]*' company_profile.json | head -n1 | cut -d'"' -f4)
    if [ -n "$D_NAME" ]; then EXTRA_VARS+=("-var=domain_name=$D_NAME"); fi
    if [ -n "$S_MAIL" ]; then EXTRA_VARS+=("-var=support_email=$S_MAIL"); fi
fi

cd "${REPO_ROOT}/terraform/environments/dev"

# The environment state lives in the remote S3 backend, so teardown must attach to that backend
# before destroying. A destroy run against an unconfigured local backend would report success
# without touching the real resources.
mapfile -t BACKEND_CONFIG < <(remote_state_backend_args "${AWS_REGION}")
if [ "${#BACKEND_CONFIG[@]}" -gt 0 ]; then
    terraform init -reconfigure -input=false "${BACKEND_CONFIG[@]}"
fi

if terraform destroy -auto-approve "${EXTRA_VARS[@]}"; then
    echo -e "  ${C_GREEN}terraform destroy completed.${C_RESET}"
else
    echo -e "\n  ${C_YELLOW}terraform destroy failed, retrying the remaining resources individually.${C_RESET}"
    while read -r ADDRESS; do
        [ -z "${ADDRESS}" ] && continue
        echo -e "    Targeting ${ADDRESS}"
        if ! terraform destroy -auto-approve -refresh=false -input=false -target="${ADDRESS}" "${EXTRA_VARS[@]}"; then
            record_failure "Terraform targeted destroy failed for ${ADDRESS}"
        fi
    done < <(managed_resource_addresses)
fi
cd "${REPO_ROOT}"

echo ""
echo -e "${C_BOLD}4. Verifying no billable residue...${C_RESET}"
REMAINING=$(managed_resource_addresses)
if [ -n "${REMAINING// /}" ]; then
    echo -e "  ${C_RED}$(echo "${REMAINING}" | wc -l | tr -d ' ') managed resources still tracked:${C_RESET}"
    echo "${REMAINING}" | sed 's/^/    /'
    record_failure "Terraform state still tracks managed resources"
else
    echo -e "  ${C_GREEN}Terraform state tracks 0 managed resources.${C_RESET}"
fi

# The state bucket is destroyed only after the environment is empty, because deleting it first
# would orphan the state that still describes the resources. Object versions and delete markers
# are purged beforehand so the bucket destroy is not blocked by its own noncurrent versions.
if [ -d "${REPO_ROOT}/terraform/bootstrap" ]; then
    if (cd "${REPO_ROOT}/terraform/bootstrap" && terraform init -input=false -reconfigure >/dev/null 2>&1); then
        STATE_BUCKET=$(cd "${REPO_ROOT}/terraform/bootstrap" && terraform output -raw bucket_name 2>/dev/null || echo "")
        if [ -n "${STATE_BUCKET}" ]; then
            echo -e "  Removing Terraform state bucket '${STATE_BUCKET}'..."
            purge_bucket "${STATE_BUCKET}"
        fi

        if (cd "${REPO_ROOT}/terraform/bootstrap" && terraform destroy -auto-approve -input=false); then
            echo -e "  ${C_GREEN}Remote state backend destroyed.${C_RESET}"
        else
            record_failure "terraform bootstrap destroy failed, the state bucket may still exist"
        fi
    else
        record_failure "terraform bootstrap init failed, the state bucket may still exist"
    fi
fi

# Log groups created implicitly by CodeBuild and Container Insights are not tracked by
# Terraform, so they survive the destroy and keep accruing storage cost.
aws logs delete-log-group --log-group-name "/aws/codebuild/${PROJECT_TAG}-dev-build" --region "${AWS_REGION}" >/dev/null 2>&1 || true
aws logs delete-log-group --log-group-name "/aws/ecs/containerinsights/${PROJECT_TAG}-dev-cluster/performance" --region "${AWS_REGION}" >/dev/null 2>&1 || true
echo -e "  Implicit log groups removed."

echo ""
echo -e "  ${C_BOLD}${C_CYAN}Account-wide totals (other projects included, for reference):${C_RESET}"
for CHECK in \
    "VPC endpoints:$(aws ec2 describe-vpc-endpoints --region "${AWS_REGION}" --query 'length(VpcEndpoints)' --output text 2>/dev/null || echo '?')" \
    "NAT gateways:$(aws ec2 describe-nat-gateways --region "${AWS_REGION}" --query 'length(NatGateways)' --output text 2>/dev/null || echo '?')" \
    "Network ifaces:$(aws ec2 describe-network-interfaces --region "${AWS_REGION}" --query 'length(NetworkInterfaces)' --output text 2>/dev/null || echo '?')" \
    "Volumes:$(aws ec2 describe-volumes --region "${AWS_REGION}" --query 'length(Volumes)' --output text 2>/dev/null || echo '?')" \
    "RDS instances:$(aws rds describe-db-instances --region "${AWS_REGION}" --query 'length(DBInstances)' --output text 2>/dev/null || echo '?')" \
    "ECR repositories:$(aws ecr describe-repositories --region "${AWS_REGION}" --query 'length(repositories)' --output text 2>/dev/null || echo '?')" \
    "Load balancers:$(aws elbv2 describe-load-balancers --region "${AWS_REGION}" --query 'length(LoadBalancers)' --output text 2>/dev/null || echo '?')"
do
    echo -e "    ${CHECK}"
done
echo ""

if [ ${#FAILURES[@]} -gt 0 ]; then
    echo -e "${C_BOLD}${C_RED}==============================================================================${C_RESET}"
    echo -e "${C_BOLD}${C_RED}  Teardown Finished With Problems${C_RESET}"
    echo -e "${C_BOLD}${C_RED}==============================================================================${C_RESET}"
    for FAILURE in "${FAILURES[@]}"; do
        echo -e "  ${C_RED}! ${FAILURE}${C_RESET}"
    done
    echo ""
    exit 1
fi

echo -e "\n${C_BOLD}${C_GREEN}==============================================================================${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}  Teardown Complete${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}  All cloud resources deleted successfully.${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}==============================================================================${C_RESET}\n"
