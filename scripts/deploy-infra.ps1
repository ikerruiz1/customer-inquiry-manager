# ==============================================================================
# 1-Click Production Deployment Bootstrap (Windows PowerShell)
# Customer Inquiry Manager (ExampleCorp CIM)
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "  ExampleCorp CIM: 1-Click Infrastructure & Container Bootstrap (Windows)" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Prerequisite Checks
Write-Host "Phase 1: Validating Local Toolchain & AWS Credentials..." -ForegroundColor Yellow
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "Error: AWS CLI is not installed or not in PATH." -ForegroundColor Red
    exit 1
}
if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Terraform is not installed or not in PATH." -ForegroundColor Red
    exit 1
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Docker is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

$awsAccount = (aws sts get-caller-identity --query "Account" --output text).Trim()
$awsRegion = if ($env:AWS_DEFAULT_REGION) { $env:AWS_DEFAULT_REGION } else { "eu-west-1" }
Write-Host "  OK: AWS Authentication confirmed: Account $awsAccount in $awsRegion" -ForegroundColor Green
Write-Host ""

# 2. Template / Domain Configuration Synchronization
Write-Host "Phase 2: Verifying Domain Configuration & Terraform Parameters..." -ForegroundColor Yellow
if (-not (Test-Path "company_profile.json") -and (Test-Path "company_profile.example.json")) {
    Write-Host "  ! company_profile.json not found. Creating from company_profile.example.json..." -ForegroundColor Yellow
    Copy-Item "company_profile.example.json" "company_profile.json"
}

if (-not (Test-Path "terraform/environments/dev/terraform.tfvars") -and (Test-Path "terraform/environments/dev/terraform.tfvars.example")) {
    Write-Host "  ! terraform.tfvars not found. Creating from terraform.tfvars.example..." -ForegroundColor Yellow
    Copy-Item "terraform/environments/dev/terraform.tfvars.example" "terraform/environments/dev/terraform.tfvars"
}

$profileJson = Get-Content "company_profile.json" -Raw | ConvertFrom-Json
$domainName = $profileJson.domain
$supportEmail = $profileJson.support_email
Write-Host "  OK: Configured Domain: $domainName ($supportEmail)" -ForegroundColor Green
Write-Host ""

# 3. Terraform Initialization & Application
Write-Host "Phase 3: Applying Modular Terraform Infrastructure (VPC, ECS, RDS, SES)..." -ForegroundColor Yellow
Write-Host "  [FINOPS NOTICE] This provisions full AWS infrastructure (16 PrivateLink ENIs, RDS, ALB, ECS)." -ForegroundColor Yellow
Write-Host "  Estimated active burn rate: ~$5.00 USD/day. Use .\scripts\teardown-infra.ps1 to destroy when done." -ForegroundColor Yellow
Push-Location "terraform/environments/dev"
try {
    terraform init
    terraform validate
    terraform apply -auto-approve

    $albDns = (terraform output -raw alb_dns_name).Trim()
    $ecrRepo = (terraform output -raw ecr_repository_url).Trim()
    $cognitoPool = (terraform output -raw cognito_user_pool_id).Trim()
    $sesVerif = (terraform output -raw ses_domain_verification_token).Trim()
    $sesMx = (terraform output -raw ses_mx_record).Trim()
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "  OK: Infrastructure provisioned successfully." -ForegroundColor Green
Write-Host "  - ALB Public DNS:  http://$albDns" -ForegroundColor Cyan
Write-Host "  - ECR Repository:  $ecrRepo" -ForegroundColor Cyan
Write-Host "  - Cognito Pool ID: $cognitoPool" -ForegroundColor Cyan
Write-Host ""

Write-Host "------------------------------------------------------------------------------" -ForegroundColor Yellow
Write-Host "  MANDATORY DNS RECORDS FOR REGISTRAR (get.tech, Namecheap, Route 53)" -ForegroundColor Yellow
Write-Host "------------------------------------------------------------------------------" -ForegroundColor Yellow
Write-Host "  1. MX Record:     Type: MX    | Host: [empty]  | Value: $sesMx | Priority: 10"
Write-Host "  2. SPF Record:    Type: TXT   | Host: [empty]  | Value: v=spf1 include:amazonses.com ~all"
Write-Host "  3. SES Verif:     Type: TXT   | Host: _amazonses | Value: $sesVerif"
Write-Host "  4. DKIM Tokens:   Configure 3x CNAME records with targets: <token>.dkim.amazonses.com"
Write-Host "------------------------------------------------------------------------------" -ForegroundColor Yellow
Write-Host ""

# 4. Docker Image Build & ECR Push
Write-Host "Phase 4: Building Multi-Stage Production Container & Pushing to ECR..." -ForegroundColor Yellow
aws ecr get-login-password --region $awsRegion | docker login --username AWS --password-stdin $ecrRepo

docker build -t "${ecrRepo}:latest" .
docker push "${ecrRepo}:latest"
Write-Host "  OK: Production image pushed to ECR: ${ecrRepo}:latest" -ForegroundColor Green
Write-Host ""

# 5. Trigger ECS Rolling/Canary Deployment
Write-Host "Phase 5: Restarting ECS Fargate Spot Tasks with New Container Image..." -ForegroundColor Yellow
aws ecs update-service `
  --cluster "customer-inquiry-manager-dev-cluster" `
  --service "customer-inquiry-manager-dev-service" `
  --force-new-deployment `
  --region $awsRegion > $null

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "  Access Operations Console at: http://$albDns" -ForegroundColor Green
Write-Host "  Inbound emails to $supportEmail will now route to SES!" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""
