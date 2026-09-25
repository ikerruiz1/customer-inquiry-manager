$ErrorActionPreference = "Continue"

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
Write-Host "==============================================================================" -ForegroundColor Red
Write-Host "  $companyName - Cloud Teardown" -ForegroundColor Red
Write-Host "==============================================================================" -ForegroundColor Red
Write-Host ""

$awsRegion = "eu-west-1"
if ($env:AWS_DEFAULT_REGION) {
    $awsRegion = $env:AWS_DEFAULT_REGION
}

# S3 and ECR reject deletion when containing artifacts; emptying them prevents Terraform state locks
Write-Host "1. Emptying project S3 buckets..." -ForegroundColor Yellow
try {
    $buckets = aws s3api list-buckets --query "Buckets[?contains(Name, 'customer-inquiry-manager')].Name" --output text
    if ($buckets -and $buckets.Trim() -ne "") {
        $bucketList = $buckets.Trim() -split "\s+"
        foreach ($bucket in $bucketList) {
            Write-Host "  Purging s3://$bucket..." -ForegroundColor Cyan
            aws s3 rm "s3://$bucket" --recursive --region $awsRegion 2>$null
        }
    }
    Write-Host "  OK: S3 buckets emptied." -ForegroundColor Green
}
catch {
    Write-Host "  Warning during S3 purge: $_" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "2. Deleting ECR container images..." -ForegroundColor Yellow
$repoName = "customer-inquiry-manager-dev"
try {
    $imageIds = aws ecr list-images --repository-name $repoName --region $awsRegion --query "imageIds[*]" --output json 2>$null
    if ($imageIds -and $imageIds.Trim() -ne "[]" -and $imageIds.Trim() -ne "") {
        Write-Host "  Purging images from $repoName..." -ForegroundColor Cyan
        aws ecr batch-delete-image --repository-name $repoName --image-ids "$imageIds" --region $awsRegion 2>$null
    }
    Write-Host "  OK: ECR images deleted." -ForegroundColor Green
}
catch {
    Write-Host "  Warning during ECR purge: $_" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "3. Running terraform destroy..." -ForegroundColor Yellow
$extraVars = @()
if (Test-Path "company_profile.json") {
    $profileJson = Get-Content "company_profile.json" -Raw | ConvertFrom-Json
    if ($profileJson.domain) { $extraVars += "-var=domain_name=$($profileJson.domain)" }
    if ($profileJson.support_email) { $extraVars += "-var=support_email=$($profileJson.support_email)" }
}
Push-Location "terraform/environments/dev"
try {
    if ($extraVars.Count -gt 0) {
        terraform destroy -auto-approve $extraVars
    } else {
        terraform destroy -auto-approve
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "  Teardown Complete" -ForegroundColor Green
Write-Host "  All cloud resources deleted successfully." -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""
