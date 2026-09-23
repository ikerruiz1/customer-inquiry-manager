# ==============================================================================
# 1-Click Production Deployment Bootstrap (Windows PowerShell)
# Customer Inquiry Manager (ExampleCorp CIM)
# Fully Parameterized & Automated (Zero Hardcoded Domain Dependencies)
# ==============================================================================
param(
    [string]$Domain = "",
    [string]$SupportEmail = "",
    [string]$AwsRegion = "",
    [switch]$DnsOnly = $false,
    [switch]$NonInteractive = $false
)

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
if (-not (Get-Command docker -ErrorAction SilentlyContinue) -and -not $DnsOnly) {
    Write-Host "Error: Docker is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

$awsAccount = (aws sts get-caller-identity --query "Account" --output text).Trim()
$targetRegion = if ($AwsRegion) { $AwsRegion } elseif ($env:AWS_DEFAULT_REGION) { $env:AWS_DEFAULT_REGION } else { "eu-west-1" }
Write-Host "  OK: AWS Authentication confirmed: Account $awsAccount in $targetRegion" -ForegroundColor Green
Write-Host ""

# 2. Template / Domain Configuration Synchronization
Write-Host "Phase 2: Resolving Dynamic Custom Domain Configuration..." -ForegroundColor Yellow
if (-not (Test-Path "company_profile.json") -and (Test-Path "company_profile.example.json")) {
    Write-Host "  ! company_profile.json not found. Creating from company_profile.example.json..." -ForegroundColor Yellow
    Copy-Item "company_profile.example.json" "company_profile.json"
}

$profileJson = Get-Content "company_profile.json" -Raw | ConvertFrom-Json
$currentDomain = if ($profileJson.domain) { $profileJson.domain } else { "example-corp.tech" }
$currentEmail = if ($profileJson.support_email) { $profileJson.support_email } else { "support@$currentDomain" }

# Determine active domain and support email
$activeDomain = $currentDomain
$activeEmail = $currentEmail

if ($Domain) {
    $activeDomain = $Domain.Trim()
    $activeEmail = if ($SupportEmail) { $SupportEmail.Trim() } else { "support@$activeDomain" }
} elseif (-not $NonInteractive -and [Environment]::UserInteractive) {
    Write-Host "  Configure Custom Domain (e.g. example-corp.tech or your own registrar domain):" -ForegroundColor Cyan
    $promptDomain = Read-Host "  Enter Domain [Press Enter to keep '$currentDomain']"
    if ($promptDomain -and $promptDomain.Trim() -ne "") {
        $activeDomain = $promptDomain.Trim()
        $promptEmail = Read-Host "  Enter Support Inbound Email [Press Enter for 'support@$activeDomain']"
        $activeEmail = if ($promptEmail -and $promptEmail.Trim() -ne "") { $promptEmail.Trim() } else { "support@$activeDomain" }
    }
}

# Synchronize company_profile.json with active domain
$profileJson.domain = $activeDomain
$profileJson.support_email = $activeEmail
$profileJson.operations_manager_email = "ops-manager@$activeDomain"
if ($profileJson.inbound_channels) {
    $profileJson.inbound_channels.email = $activeEmail
    $profileJson.inbound_channels.webform_url = "https://portal.$activeDomain/contact"
    $profileJson.inbound_channels.trustpilot_profile = "https://www.trustpilot.com/review/$activeDomain"
}
$profileJson | ConvertTo-Json -Depth 10 | Set-Content "company_profile.json" -Encoding UTF8
Write-Host "  OK: Synchronized company_profile.json with domain: $activeDomain" -ForegroundColor Green

# Automatically write synchronized terraform.tfvars
$tfvarsContent = @"
aws_region         = "$targetRegion"
project_name       = "customer-inquiry-manager"
environment        = "dev"
vpc_cidr           = "10.0.0.0/16"
availability_zones = ["${targetRegion}a", "${targetRegion}b"]
domain_name        = "$activeDomain"
support_email      = "$activeEmail"
"@
Set-Content "terraform/environments/dev/terraform.tfvars" $tfvarsContent -Encoding UTF8
Write-Host "  OK: Synchronized terraform/environments/dev/terraform.tfvars" -ForegroundColor Green
Write-Host ""

# ------------------------------------------------------------------------------
# Targeted DNS Mode (-DnsOnly)
# Provisions Route 53 Public Hosted Zone in AWS and prints Registrar Nameservers
# ------------------------------------------------------------------------------
if ($DnsOnly) {
    Write-Host "==============================================================================" -ForegroundColor Cyan
    Write-Host "  TARGETED DNS MODE (-DnsOnly): Provisioning Route 53 Public Hosted Zone..." -ForegroundColor Cyan
    Write-Host "==============================================================================" -ForegroundColor Cyan
    Push-Location "terraform/environments/dev"
    try {
        terraform init
        terraform apply -target=module.route53 -auto-approve -var="domain_name=$activeDomain" -var="support_email=$activeEmail"
        $rawNs = (terraform output -json route53_name_servers | ConvertFrom-Json)
    }
    finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "==============================================================================" -ForegroundColor Green
    Write-Host "  ROUTE 53 PUBLIC HOSTED ZONE DEPLOYED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "==============================================================================" -ForegroundColor Green
    Write-Host "  Domain: $activeDomain" -ForegroundColor White
    Write-Host "  Target Region: $targetRegion" -ForegroundColor White
    Write-Host ""
    Write-Host "  ACTION REQUIRED IN YOUR REGISTRAR (get.tech, Namecheap, GoDaddy, etc.):" -ForegroundColor Yellow
    Write-Host "  Go to your domain dashboard -> DNS -> Nameservers -> Edit Nameservers" -ForegroundColor Yellow
    Write-Host "  Replace existing nameservers with these 4 authoritative AWS Route 53 servers:" -ForegroundColor Yellow
    Write-Host ""
    $i = 1
    foreach ($ns in $rawNs) {
        Write-Host "    $i. $ns" -ForegroundColor Cyan
        $i++
    }
    Write-Host ""
    Write-Host "  Once updated, AWS Route 53 manages all MX, SPF, DKIM, and ALB records automatically." -ForegroundColor Green
    Write-Host "  When ready, run .\scripts\deploy-infra.ps1 to deploy the full application stack." -ForegroundColor White
    Write-Host "==============================================================================" -ForegroundColor Green
    exit 0
}

# ------------------------------------------------------------------------------
# Full Infrastructure Deployment Mode
# ------------------------------------------------------------------------------
Write-Host "Phase 3: Applying Modular Terraform Infrastructure (VPC, ECS, RDS, SES, Route53)..." -ForegroundColor Yellow
Write-Host "  [FINOPS NOTICE] This provisions full AWS infrastructure (16 PrivateLink ENIs, RDS, ALB, ECS)." -ForegroundColor Yellow
Write-Host "  Estimated active burn rate: ~$5.00 USD/day. Use .\scripts\teardown-infra.ps1 to destroy when done." -ForegroundColor Yellow
Push-Location "terraform/environments/dev"
try {
    terraform init
    terraform validate
    terraform apply -auto-approve -var="domain_name=$activeDomain" -var="support_email=$activeEmail"

    $albDns = (terraform output -raw alb_dns_name).Trim()
    $ecrRepo = (terraform output -raw ecr_repository_url).Trim()
    $cognitoPool = (terraform output -raw cognito_user_pool_id).Trim()
    $sesVerif = (terraform output -raw ses_domain_verification_token).Trim()
    $sesMx = (terraform output -raw ses_mx_record).Trim()
    $nameServers = (terraform output -json route53_name_servers | ConvertFrom-Json)
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

Write-Host "==============================================================================" -ForegroundColor Yellow
Write-Host "  DELEGATE DOMAIN NAMESERVERS IN REGISTRAR (get.tech, Namecheap, GoDaddy)" -ForegroundColor Yellow
Write-Host "==============================================================================" -ForegroundColor Yellow
Write-Host "  In your registrar dashboard ($activeDomain -> DNS -> Nameservers -> Edit):" -ForegroundColor White
$idx = 1
foreach ($ns in $nameServers) {
    Write-Host "    $idx. $ns" -ForegroundColor Cyan
    $idx++
}
Write-Host "  AWS Route 53 automatically publishes MX, SPF, DKIM, and ALB records." -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Yellow
Write-Host ""

# 4. Docker Image Build & ECR Push
Write-Host "Phase 4: Building Multi-Stage Production Container & Pushing to ECR..." -ForegroundColor Yellow
aws ecr get-login-password --region $targetRegion | docker login --username AWS --password-stdin $ecrRepo

docker build -t "${ecrRepo}:latest" .
docker push "${ecrRepo}:latest"
Write-Host "  OK: Production image pushed to ECR: ${ecrRepo}:latest" -ForegroundColor Green
Write-Host ""

# 5. Trigger ECS Rolling Deployment
Write-Host "Phase 5: Restarting ECS Fargate Spot Tasks with New Container Image..." -ForegroundColor Yellow
aws ecs update-service `
  --cluster "customer-inquiry-manager-dev-cluster" `
  --service "customer-inquiry-manager-dev-service" `
  --force-new-deployment `
  --region $targetRegion > $null

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "  Access Operations Console at: http://$albDns" -ForegroundColor Green
Write-Host "  Inbound emails to $activeEmail will route natively to Amazon SES!" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""
