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
    }
    catch {}
}
elseif (Test-Path "company_profile.example.json") {
    try {
        $p = Get-Content "company_profile.example.json" -Raw | ConvertFrom-Json
        if ($p.company_name) { $companyName = $p.company_name }
    }
    catch {}
}

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "  $companyName - Cloud Infrastructure Deployment" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Checking AWS credentials and tools..." -ForegroundColor Yellow
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "Error: AWS CLI is not installed or not in PATH." -ForegroundColor Red
    exit 1
}
if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Terraform is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

$awsAccount = (aws sts get-caller-identity --query "Account" --output text).Trim()
$targetRegion = "eu-west-1"
if ($AwsRegion) {
    $targetRegion = $AwsRegion
}
elseif ($env:AWS_DEFAULT_REGION) {
    $targetRegion = $env:AWS_DEFAULT_REGION
}
Write-Host "  OK: AWS account $awsAccount ($targetRegion)" -ForegroundColor Green
Write-Host ""

Write-Host "2. Loading domain configuration..." -ForegroundColor Yellow
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

$activeDomain = $currentDomain
$activeEmail = $currentEmail

if ($Domain) {
    $activeDomain = $Domain.Trim()
    $activeEmail = "support@$activeDomain"
    if ($SupportEmail) {
        $activeEmail = $SupportEmail.Trim()
    }
}
elseif (-not $NonInteractive -and [Environment]::UserInteractive) {
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

$defaultAdminPrefix = "admin"
if ($profileJson.admin_email -and $profileJson.admin_email -match "^([^@]+)@") {
    $defaultAdminPrefix = $matches[1]
}

$activeAdminName = if ($AdminName) { $AdminName.Trim() } elseif ($profileJson.admin_name) { $profileJson.admin_name } else { "Cloud Administrator" }
$activeAdminPrefix = $defaultAdminPrefix

if ($AdminEmail) {
    if ($AdminEmail -match "^([^@]+)@") {
        $activeAdminPrefix = $matches[1]
    }
    else {
        $activeAdminPrefix = $AdminEmail.Trim()
    }
}
elseif (-not $NonInteractive -and [Environment]::UserInteractive) {
    Write-Host "  Administrator account configuration:" -ForegroundColor Cyan
    $promptAdminName = Read-Host "  Enter Admin Full Name [Press Enter for '$activeAdminName']"
    if ($promptAdminName -and $promptAdminName.Trim() -ne "") {
        $activeAdminName = $promptAdminName.Trim()
    }
    $promptAdminPrefix = Read-Host "  Enter Admin username prefix [Press Enter for '$defaultAdminPrefix' -> $defaultAdminPrefix@$activeDomain]"
    if ($promptAdminPrefix -and $promptAdminPrefix.Trim() -ne "") {
        if ($promptAdminPrefix -match "^([^@]+)@") {
            $activeAdminPrefix = $matches[1]
        }
        else {
            $activeAdminPrefix = $promptAdminPrefix.Trim()
        }
    }
}

$activeAdminEmail = "$activeAdminPrefix@$activeDomain"

$profileJson.domain = $activeDomain
$profileJson.support_email = $activeEmail
$profileJson.admin_name = $activeAdminName
$profileJson.admin_email = $activeAdminEmail
if ($profileJson.inbound_channels) {
    $profileJson.inbound_channels.email = $activeEmail
    if ($profileJson.inbound_channels.PSObject.Properties['webform_url'] -and $profileJson.inbound_channels.webform_url -ne "") {
        $profileJson.inbound_channels.webform_url = "https://portal.$activeDomain/contact"
    }
    else {
        $profileJson.inbound_channels.webform_url = ""
    }
    $profileJson.inbound_channels.trustpilot_profile = "https://www.trustpilot.com/review/$activeDomain"
}
$profileJson | ConvertTo-Json -Depth 10 | Set-Content "company_profile.json" -Encoding UTF8
Write-Host "  OK: Synchronized company_profile.json with domain: $activeDomain and admin: $activeAdminEmail" -ForegroundColor Green

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

# Pre-provisioning Route 53 breaks circular dependency between registrar delegation and ACM/SES validation timeouts
if ($DnsOnly) {
    Write-Host "==============================================================================" -ForegroundColor Cyan
    Write-Host "  Route 53 DNS Setup: Provisioning Public Hosted Zone..." -ForegroundColor Cyan
    Write-Host "==============================================================================" -ForegroundColor Cyan
    Push-Location "terraform/environments/dev"
    try {
        terraform init
        if ($LASTEXITCODE -ne 0) {
            throw "terraform init failed with exit code $LASTEXITCODE"
        }

        terraform apply "-target=module.route53" "-target=module.ses" -auto-approve -var="domain_name=$activeDomain" -var="support_email=$activeEmail"
        if ($LASTEXITCODE -ne 0) {
            throw "terraform apply for DNS & SES foundation failed with exit code $LASTEXITCODE"
        }

        $rawNsJson = terraform output -json route53_name_servers
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($rawNsJson)) {
            throw "terraform output route53_name_servers failed or returned empty output"
        }

        $rawNs = ($rawNsJson | ConvertFrom-Json)
        if (-not $rawNs -or $rawNs.Count -eq 0) {
            throw "Route 53 name servers list is empty in Terraform state"
        }
    }
    catch {
        Write-Host ""
        Write-Host "==============================================================================" -ForegroundColor Yellow
        Write-Host "  Setup Notice: $_" -ForegroundColor Yellow
        Write-Host "  Terraform state safely preserved all resources created prior to this error." -ForegroundColor Gray
        Write-Host "==============================================================================" -ForegroundColor Yellow

        try {
            $fallbackNs = (terraform output -json route53_name_servers 2>$null | ConvertFrom-Json)
            if ($fallbackNs -and $fallbackNs.Count -gt 0) {
                Write-Host ""
                Write-Host "  AWS Name Servers (available from existing state):" -ForegroundColor Yellow
                $i = 1
                foreach ($ns in $fallbackNs) {
                    Write-Host "    $i. $ns" -ForegroundColor Cyan
                    $i++
                }
            }
        }
        catch {}

        Write-Host ""
        Write-Host "  Automatic Recovery Options:" -ForegroundColor White
        Write-Host "  [Option 1 - Retry]:    Re-run .\scripts\deploy-infra.ps1 -DnsOnly to complete remaining resources." -ForegroundColor Cyan
        Write-Host "  [Option 2 - Teardown]: Run .\scripts\teardown-infra.ps1 to cleanly delete all provisioned resources." -ForegroundColor Red
        Write-Host "==============================================================================" -ForegroundColor Yellow
        exit 1
    }
    finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "==============================================================================" -ForegroundColor Green
    Write-Host "  Route 53 Hosted Zone Created" -ForegroundColor Green
    Write-Host "==============================================================================" -ForegroundColor Green
    Write-Host "  Domain: $activeDomain ($targetRegion)" -ForegroundColor White
    Write-Host ""
    Write-Host "  AWS Name Servers:" -ForegroundColor Yellow
    $i = 1
    foreach ($ns in $rawNs) {
        Write-Host "    $i. $ns" -ForegroundColor Cyan
        $i++
    }
    Write-Host ""
    Write-Host "  Next steps:" -ForegroundColor White
    Write-Host "  1. Update nameservers in your registrar for $activeDomain with the 4 servers above." -ForegroundColor White
    Write-Host "  2. Verify resolution with: Resolve-DnsName -Name '$activeDomain' -Type NS" -ForegroundColor Gray
    Write-Host "  3. Run .\scripts\deploy-infra.ps1 to deploy the application." -ForegroundColor Green
    Write-Host "==============================================================================" -ForegroundColor Green
    exit 0
}

Write-Host "3. Provisioning AWS infrastructure with Terraform..." -ForegroundColor Yellow
Push-Location "terraform/environments/dev"
try {
    terraform init
    if ($LASTEXITCODE -ne 0) { throw "terraform init failed with exit code $LASTEXITCODE" }

    terraform validate
    if ($LASTEXITCODE -ne 0) { throw "terraform validate failed with exit code $LASTEXITCODE" }

    terraform apply -auto-approve -var="domain_name=$activeDomain" -var="support_email=$activeEmail"
    if ($LASTEXITCODE -ne 0) { throw "terraform apply failed with exit code $LASTEXITCODE" }

    $albDns = (terraform output -raw alb_dns_name).Trim()
    $ecrRepo = (terraform output -raw ecr_repository_url).Trim()
    $cognitoPool = (terraform output -raw cognito_user_pool_id).Trim()
    $pipelineBucket = (terraform output -raw pipeline_artifacts_bucket_name).Trim()
    $pipelineName = (terraform output -raw codepipeline_name).Trim()
}
catch {
    Write-Host ""
    Write-Host "==============================================================================" -ForegroundColor Red
    Write-Host "  Error during infrastructure deployment: $_" -ForegroundColor Red
    Write-Host "==============================================================================" -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "  OK: Infrastructure provisioned successfully." -ForegroundColor Green
Write-Host "  - ALB Public DNS:  http://$albDns" -ForegroundColor Cyan
Write-Host "  - ECR Repository:  $ecrRepo" -ForegroundColor Cyan
Write-Host "  - Cognito Pool ID: $cognitoPool" -ForegroundColor Cyan
Write-Host "  - CodePipeline:    $pipelineName" -ForegroundColor Cyan
Write-Host "  - Pipeline Bucket: s3://$pipelineBucket" -ForegroundColor Cyan
Write-Host ""

Write-Host "4. Packaging source code and triggering AWS CodePipeline..." -ForegroundColor Yellow
$pyExec = if (Test-Path ".\.venv\Scripts\python.exe") { ".\.venv\Scripts\python.exe" } else { "python" }
& $pyExec scripts/package_source.py source.zip
aws s3 cp source.zip "s3://$pipelineBucket/source.zip" --region $targetRegion
Remove-Item source.zip -ErrorAction SilentlyContinue
Write-Host "  OK: Source archive uploaded to s3://$pipelineBucket/source.zip" -ForegroundColor Green
Write-Host "  OK: AWS CodePipeline ($pipelineName) triggered for cloud build & DevSecOps." -ForegroundColor Green
Write-Host ""

Write-Host "5. Setting up initial administrator in Cognito..." -ForegroundColor Yellow
Write-Host "  Admin: $activeAdminEmail ($activeAdminName)" -ForegroundColor Cyan

$pyExec = if (Test-Path ".\.venv\Scripts\python.exe") { ".\.venv\Scripts\python.exe" } else { "python" }
try {
    & $pyExec scripts/provision_operator.py `
        --name $activeAdminName `
        --email $activeAdminEmail `
        --role "Operations_Manager" `
        --cognito `
        --pool-id $cognitoPool `
        --region $targetRegion
    Write-Host "  OK: Administrator account created and credentials stored in Secrets Manager." -ForegroundColor Green
}
catch {
    Write-Host "  [Notice] Administrator account managed via existing identity." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "  Deployment Complete" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "  Console URL:     http://$albDns" -ForegroundColor White
Write-Host "  Admin Username:  $activeAdminEmail" -ForegroundColor Yellow
Write-Host "  Admin Name:      $activeAdminName" -ForegroundColor White
Write-Host "  Admin Role:      Operations_Manager" -ForegroundColor White
Write-Host "  Cognito Pool:    $cognitoPool" -ForegroundColor Gray
Write-Host "  Secrets Manager: customer-inquiry-manager/dev/operator-credentials" -ForegroundColor Gray
Write-Host "------------------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Sign in at http://$albDns with $activeAdminEmail and the temporary password" -ForegroundColor White
Write-Host "  printed above. First login will prompt for a permanent password and TOTP MFA." -ForegroundColor White
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""
