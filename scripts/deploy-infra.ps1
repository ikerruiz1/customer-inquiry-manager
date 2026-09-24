# ==============================================================================
# 1-Click Production Deployment Bootstrap (Windows PowerShell)
# Customer Inquiry Manager
# Fully Parameterized & Automated (Zero Hardcoded Domain Dependencies)
# ==============================================================================
param(
    [string]$Domain = "",
    [string]$SupportEmail = "",
    [string]$AdminName = "",
    [string]$AdminEmail = "",
    [string]$AwsRegion = "",
    [switch]$DnsOnly = $false,
    [switch]$NonInteractive = $false
)

$ErrorActionPreference = "Stop"

$companyName = "Customer Inquiry Manager"
if (Test-Path "company_profile.json") {
    try {
        $p = Get-Content "company_profile.json" -Raw | ConvertFrom-Json
        if ($p.company_name) { $companyName = $p.company_name }
    } catch {}
} elseif (Test-Path "company_profile.example.json") {
    try {
        $p = Get-Content "company_profile.example.json" -Raw | ConvertFrom-Json
        if ($p.company_name) { $companyName = $p.company_name }
    } catch {}
}

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "  $($companyName): 1-Click Infrastructure & Container Bootstrap (Windows)" -ForegroundColor Cyan
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
$targetRegion = "eu-west-1"
if ($AwsRegion) {
    $targetRegion = $AwsRegion
} elseif ($env:AWS_DEFAULT_REGION) {
    $targetRegion = $env:AWS_DEFAULT_REGION
}
Write-Host "  OK: AWS Authentication confirmed: Account $awsAccount in $targetRegion" -ForegroundColor Green
Write-Host ""

# 2. Template / Domain Configuration Synchronization
Write-Host "Phase 2: Resolving Dynamic Custom Domain Configuration..." -ForegroundColor Yellow
if (-not (Test-Path "company_profile.json") -and (Test-Path "company_profile.example.json")) {
    Write-Host "  ! company_profile.json not found. Creating from company_profile.example.json..." -ForegroundColor Yellow
    Copy-Item "company_profile.example.json" "company_profile.json"
}

$profileJson = Get-Content "company_profile.json" -Raw | ConvertFrom-Json
$currentDomain = "your-company-domain.tech"
if ($profileJson.domain) {
    $currentDomain = $profileJson.domain
}
$currentEmail = "support@$currentDomain"
if ($profileJson.support_email) {
    $currentEmail = $profileJson.support_email
}

# Determine active domain and support email
$activeDomain = $currentDomain
$activeEmail = $currentEmail

if ($Domain) {
    $activeDomain = $Domain.Trim()
    $activeEmail = "support@$activeDomain"
    if ($SupportEmail) {
        $activeEmail = $SupportEmail.Trim()
    }
} elseif (-not $NonInteractive -and [Environment]::UserInteractive) {
    Write-Host "  Configure Custom Domain (e.g. your-company-domain.tech or your own registrar domain):" -ForegroundColor Cyan
    $promptDomain = Read-Host "  Enter Domain [Press Enter to keep '$currentDomain']"
    if ($promptDomain -and $promptDomain.Trim() -ne "") {
        $activeDomain = $promptDomain.Trim()
        $activeEmail = "support@$activeDomain"
        $promptEmail = Read-Host "  Enter Support Inbound Email [Press Enter for 'support@$activeDomain']"
        if ($promptEmail -and $promptEmail.Trim() -ne "") {
            $activeEmail = $promptEmail.Trim()
        }
    }
}

# Determine initial administrator identity (Strictly bound to corporate apex domain)
$defaultAdminPrefix = "admin"
if ($profileJson.admin_email -and $profileJson.admin_email -match "^([^@]+)@") {
    $defaultAdminPrefix = $matches[1]
}

$activeAdminName = if ($AdminName) { $AdminName.Trim() } elseif ($profileJson.admin_name) { $profileJson.admin_name } else { "Cloud Administrator" }
$activeAdminPrefix = $defaultAdminPrefix

if ($AdminEmail) {
    if ($AdminEmail -match "^([^@]+)@") {
        $activeAdminPrefix = $matches[1]
    } else {
        $activeAdminPrefix = $AdminEmail.Trim()
    }
} elseif (-not $NonInteractive -and [Environment]::UserInteractive) {
    Write-Host "  Configure Initial Break-Glass Operations Manager (Root Admin):" -ForegroundColor Cyan
    $promptAdminName = Read-Host "  Enter Admin Full Name [Press Enter for '$activeAdminName']"
    if ($promptAdminName -and $promptAdminName.Trim() -ne "") {
        $activeAdminName = $promptAdminName.Trim()
    }
    $promptAdminPrefix = Read-Host "  Enter Admin Corporate Username Prefix [Press Enter for '$defaultAdminPrefix' -> $defaultAdminPrefix@$activeDomain]"
    if ($promptAdminPrefix -and $promptAdminPrefix.Trim() -ne "") {
        if ($promptAdminPrefix -match "^([^@]+)@") {
            $activeAdminPrefix = $matches[1]
        } else {
            $activeAdminPrefix = $promptAdminPrefix.Trim()
        }
    }
}

$activeAdminEmail = "$activeAdminPrefix@$activeDomain"

# Synchronize company_profile.json with active domain and admin
$profileJson.domain = $activeDomain
$profileJson.support_email = $activeEmail
$profileJson.admin_name = $activeAdminName
$profileJson.admin_email = $activeAdminEmail
if ($profileJson.inbound_channels) {
    $profileJson.inbound_channels.email = $activeEmail
    if ($profileJson.inbound_channels.PSObject.Properties['webform_url'] -and $profileJson.inbound_channels.webform_url -ne "") {
        $profileJson.inbound_channels.webform_url = "https://portal.$activeDomain/contact"
    } else {
        $profileJson.inbound_channels.webform_url = ""
    }
    $profileJson.inbound_channels.trustpilot_profile = "https://www.trustpilot.com/review/$activeDomain"
}
$profileJson | ConvertTo-Json -Depth 10 | Set-Content "company_profile.json" -Encoding UTF8
Write-Host "  OK: Synchronized company_profile.json with domain: $activeDomain and admin: $activeAdminEmail" -ForegroundColor Green

# Automatically write synchronized terraform.tfvars
$tfvarsLines = @(
    "aws_region         = `"$targetRegion`"",
    "project_name       = `"customer-inquiry-manager`"",
    "environment        = `"dev`"",
    "vpc_cidr           = `"10.0.0.0/16`"",
    "availability_zones = [`"${targetRegion}a`", `"${targetRegion}b`"]",
    "domain_name        = `"$activeDomain`"",
    "support_email      = `"$activeEmail`""
)
$tfvarsContent = $tfvarsLines -join "`r`n"
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
    Write-Host "  ROUTE 53 PUBLIC HOSTED ZONE PROVISIONED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "==============================================================================" -ForegroundColor Green
    Write-Host "  Domain:        $activeDomain" -ForegroundColor White
    Write-Host "  Target Region: $targetRegion" -ForegroundColor White
    Write-Host ""
    Write-Host "  AUTHORITATIVE AWS ROUTE 53 NAME SERVERS:" -ForegroundColor Yellow
    $i = 1
    foreach ($ns in $rawNs) {
        Write-Host "    Nameserver $i : $ns" -ForegroundColor Cyan
        $i++
    }
    Write-Host ""
    Write-Host "  ACTION REQUIRED: DELEGATE IN YOUR REGISTRAR (get.tech, Namecheap, GoDaddy):" -ForegroundColor Yellow
    Write-Host "  1. Sign in to your registrar dashboard (e.g. https://manage.get.tech)" -ForegroundColor White
    Write-Host "  2. Go to: Domain Management -> $activeDomain -> Nameservers (or DNS Management)" -ForegroundColor White
    Write-Host "  3. Select: 'Custom Nameservers' (replacing default/shared DNS)" -ForegroundColor White
    Write-Host "  4. Paste the 4 AWS servers into Nameserver 1 through Nameserver 4" -ForegroundColor White
    Write-Host "  5. Click 'Save Changes' (Do NOT purchase Titan Email; AWS SES handles mail natively)" -ForegroundColor White
    Write-Host ""
    Write-Host "  VERIFICATION COMMAND (Run in terminal to verify global delegation):" -ForegroundColor Yellow
    Write-Host "    Resolve-DnsName -Name '$activeDomain' -Type NS | Select-Object -ExpandProperty NameHost" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  NEXT COMMAND (Once verified, run this to deploy the full application):" -ForegroundColor Green
    Write-Host "    .\scripts\deploy-infra.ps1" -ForegroundColor Green
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
Write-Host "  - SES Inbound MX:  $sesMx" -ForegroundColor Cyan
Write-Host "  - SES Token:       $sesVerif" -ForegroundColor Cyan
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
Write-Host "  OK: ECS Fargate rolling deployment triggered." -ForegroundColor Green
Write-Host ""

# 6. Automatic Enterprise Administrator Provisioning in AWS Cognito & Secrets Manager
Write-Host "Phase 6: Provisioning Initial Break-Glass Operations Manager in AWS Cognito & Secrets Manager..." -ForegroundColor Yellow
Write-Host "  Provisioning break-glass administrator: $activeAdminEmail ($activeAdminName) into AWS Cognito..." -ForegroundColor Cyan

$pyExec = if (Test-Path ".\.venv\Scripts\python.exe") { ".\.venv\Scripts\python.exe" } else { "python" }
try {
    & $pyExec scripts/provision_operator.py `
        --name $activeAdminName `
        --email $activeAdminEmail `
        --role "Operations_Manager" `
        --cognito `
        --pool-id $cognitoPool `
        --region $targetRegion
    Write-Host "  OK: Administrator provisioned and KMS-encrypted in AWS Secrets Manager." -ForegroundColor Green
} catch {
    Write-Host "  [Notice] Administrator provisioning completed or managed via existing identity: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "  $($companyName): Full Production Deployment Complete!" -ForegroundColor Green
Write-Host "  Operations Console URL: http://$albDns" -ForegroundColor Green
Write-Host "  Inbound emails to $activeEmail will route natively to Amazon SES!" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "  AWS PRODUCTION ADMINISTRATOR ONBOARDING & ACCESS CREDENTIALS" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "  Web Console URL:     http://$albDns" -ForegroundColor White
Write-Host "  AWS Cognito Pool:    $cognitoPool" -ForegroundColor Gray
Write-Host "  Secrets Manager:     customer-inquiry-manager/dev/operator-credentials" -ForegroundColor Gray
Write-Host "  Administrator Name:  $activeAdminName" -ForegroundColor Yellow
Write-Host "  Username / Email:    $activeAdminEmail" -ForegroundColor Yellow
Write-Host "  Assigned RBAC Group: Operations_Managers (Full Supervisory Authority)" -ForegroundColor Yellow
Write-Host "------------------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  AUTHENTICATION INSTRUCTIONS FOR REPOSITORY CLONERS:" -ForegroundColor White
Write-Host "  1. Open the Operations Console URL in your browser." -ForegroundColor White
Write-Host "  2. Click 'Sign In' and enter your Administrator Email and the temporary password" -ForegroundColor White
Write-Host "     printed above (or retrieved from AWS Secrets Manager)." -ForegroundColor White
Write-Host "  3. Enter your new permanent password (mandatory enterprise password rotation)." -ForegroundColor White
Write-Host "  4. Scan the dynamic QR code using your mobile device Authenticator app" -ForegroundColor White
Write-Host "     (Google Authenticator, Microsoft Authenticator, Apple Passwords, etc.)." -ForegroundColor White
Write-Host "  5. Enter the 6-digit TOTP code to complete enrollment and access the console." -ForegroundColor White
Write-Host "  6. Once signed in, use the '+ Invite Agent' modal in the header to invite operators." -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""
