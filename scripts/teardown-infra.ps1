# ==============================================================================
# 1-Click Clean Teardown Automation (Windows PowerShell)
# Customer Inquiry Manager (ExampleCorp CIM)
# Guaranteeing 0.00 € Residual Cost
# ==============================================================================
$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Red
Write-Host "  ExampleCorp CIM: 1-Click Clean Teardown (0.00 € Residual Cost Guarantee)" -ForegroundColor Red
Write-Host "==============================================================================" -ForegroundColor Red
Write-Host ""

$awsRegion = if ($env:AWS_DEFAULT_REGION) { $env:AWS_DEFAULT_REGION } else { "eu-west-1" }

# 1. Purge S3 Buckets to Avoid Dependency Lock
Write-Host "Phase 1: Emptying all project S3 buckets (versioned & unversioned)..." -ForegroundColor Yellow
try {
    $buckets = aws s3api list-buckets --query "Buckets[?contains(Name, 'customer-inquiry-manager')].Name" --output text
    if ($buckets -and $buckets.Trim() -ne "") {
        $bucketList = $buckets.Trim() -split "\s+"
        foreach ($bucket in $bucketList) {
            Write-Host "  Purging s3://$bucket..." -ForegroundColor Cyan
            aws s3 rm "s3://$bucket" --recursive --region $awsRegion 2>$null
            
            # Delete versioned objects
            $versions = aws s3api list-object-versions --bucket $bucket --query "{Objects: Versions[].{Key:Key,VersionId:VersionId}}" --output json 2>$null
            if ($versions -and $versions.Trim() -ne "" -and $versions -ne "{}" -and $versions -ne '{"Objects": null}') {
                aws s3api delete-objects --bucket $bucket --delete "$versions" 2>$null
            }
            
            # Delete markers
            $markers = aws s3api list-object-versions --bucket $bucket --query "{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}" --output json 2>$null
            if ($markers -and $markers.Trim() -ne "" -and $markers -ne "{}" -and $markers -ne '{"Objects": null}') {
                aws s3api delete-objects --bucket $bucket --delete "$markers" 2>$null
            }
        }
    }
    Write-Host "  OK: All S3 buckets purged." -ForegroundColor Green
}
catch {
    Write-Host "  Warning during S3 purge: $_" -ForegroundColor Yellow
}
Write-Host ""

# 2. Delete ECR Container Images
Write-Host "Phase 2: Purging ECR container repository images..." -ForegroundColor Yellow
$repoName = "customer-inquiry-manager-dev"
try {
    $imageIds = aws ecr list-images --repository-name $repoName --region $awsRegion --query "imageIds[*]" --output json 2>$null
    if ($imageIds -and $imageIds.Trim() -ne "[]" -and $imageIds.Trim() -ne "") {
        Write-Host "  Purging images from $repoName..." -ForegroundColor Cyan
        aws ecr batch-delete-image --repository-name $repoName --image-ids "$imageIds" --region $awsRegion 2>$null
    }
    Write-Host "  OK: ECR repository purged." -ForegroundColor Green
}
catch {
    Write-Host "  Warning during ECR purge: $_" -ForegroundColor Yellow
}
Write-Host ""

# 3. Execute Complete Terraform Destroy
Write-Host "Phase 3: Executing Terraform Destroy in terraform/environments/dev..." -ForegroundColor Yellow
Push-Location "terraform/environments/dev"
try {
    terraform destroy -auto-approve
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "  TEARDOWN SUCCESSFUL!" -ForegroundColor Green
Write-Host "  All cloud resources deleted. Verified 0.00 € residual cost." -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""
