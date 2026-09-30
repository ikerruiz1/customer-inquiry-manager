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

$projectTag = "customer-inquiry-manager"
$failures = New-Object System.Collections.Generic.List[string]

# Remove every image from a repository, tagged and untagged.
# batch-delete-image requires imageDigest or imageTag keys, so the list must come from
# describe-images; list-images emits an imageId key that the API rejects, and it accepts at
# most 100 identifiers per call, so the deletion repeats until the repository reports empty.
function Remove-ECRRepositoryImages {
    param([string]$RepositoryName, [string]$Region)

    $deleted = 0
    while ($true) {
        $raw = aws ecr describe-images --repository-name $RepositoryName --region $Region --output json 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $raw) {
            Write-Host "  Cannot read images from ${RepositoryName}, skipping." -ForegroundColor Yellow
            return 0
        }

        $details = ($raw | ConvertFrom-Json).imageDetails
        if (-not $details -or $details.Count -eq 0) { break }

        $identifiers = @()
        foreach ($image in $details) {
            if ($image.imageTags -and $image.imageTags.Count -gt 0) {
                $identifiers += @{ imageTag = $image.imageTags[0] }
            } else {
                $identifiers += @{ imageDigest = $image.imageDigest }
            }
        }

        for ($i = 0; $i -lt $identifiers.Count; $i += 100) {
            $end = [Math]::Min($i + 99, $identifiers.Count - 1)
            $batch = @($identifiers[$i..$end])
            $payload = "[" + (($batch | ForEach-Object { $_ | ConvertTo-Json -Compress }) -join ",") + "]"
            $tempFile = [System.IO.Path]::GetTempFileName()
            Set-Content -LiteralPath $tempFile -Value $payload -Encoding UTF8 -NoNewline
            $response = aws ecr batch-delete-image --repository-name $RepositoryName --region $Region --image-ids "file://$tempFile" --output json 2>&1
            Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
            if ($LASTEXITCODE -ne 0) {
                $script:failures.Add("ECR ${RepositoryName}: $response")
                return $deleted
            }
            $result = ($response | ConvertFrom-Json)
            if ($result.failures) {
                $script:failures.Add("ECR ${RepositoryName}: $($result.failures | ConvertTo-Json -Compress)")
            }
        }
        $deleted += $identifiers.Count
        if ($identifiers.Count -lt 100) { Start-Sleep -Seconds 2 }
    }
    return $deleted
}

# S3 rejects bucket deletion while objects, object versions or delete markers remain.
function Remove-BucketContents {
    param([string]$Bucket, [string]$Region)

    aws s3 rm "s3://$Bucket" --recursive --region $Region 2>$null | Out-Null
    $versions = aws s3api list-object-versions --bucket $Bucket --region $Region --output json 2>$null
    if ($versions) {
        $parsed = $versions | ConvertFrom-Json
        if ($parsed.Versions) {
            $delete = @{ Objects = @($parsed.Versions | ForEach-Object { @{ Key = $_.Key; VersionId = $_.VersionId } }) }
            $tempFile = [System.IO.Path]::GetTempFileName()
            Set-Content -LiteralPath $tempFile -Value ($delete | ConvertTo-Json -Depth 5 -Compress) -Encoding UTF8 -NoNewline
            aws s3api delete-objects --bucket $Bucket --delete "file://$tempFile" --region $Region 2>$null | Out-Null
            Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
        }
        if ($parsed.DeleteMarkers) {
            $delete = @{ Objects = @($parsed.DeleteMarkers | ForEach-Object { @{ Key = $_.Key; VersionId = $_.VersionId } }) }
            $tempFile = [System.IO.Path]::GetTempFileName()
            Set-Content -LiteralPath $tempFile -Value ($delete | ConvertTo-Json -Depth 5 -Compress) -Encoding UTF8 -NoNewline
            aws s3api delete-objects --bucket $Bucket --delete "file://$tempFile" --region $Region 2>$null | Out-Null
            Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
        }
    }

    $listing = aws s3api list-object-versions --bucket $Bucket --region $Region --output json 2>$null
    $left = 0
    if ($listing) {
        $current = $listing | ConvertFrom-Json
        if ($current.Versions) { $left += @($current.Versions).Count }
        if ($current.DeleteMarkers) { $left += @($current.DeleteMarkers).Count }
    }
    if ($left -gt 0) {
        $script:failures.Add("S3 ${Bucket}: $left object versions still present")
    }
}

Write-Host "1. Emptying project S3 buckets..." -ForegroundColor Yellow
$buckets = aws s3api list-buckets --query "Buckets[?contains(Name, '$projectTag')].Name" --output text 2>$null
if ($buckets -and $buckets.Trim() -ne "") {
    foreach ($bucket in $buckets.Trim() -split "\s+") {
        if ($bucket) {
            Write-Host "  Purging s3://$bucket..." -ForegroundColor Cyan
            Remove-BucketContents -Bucket $bucket -Region $awsRegion
        }
    }
}
Write-Host "  S3 purge finished." -ForegroundColor Green
Write-Host ""

Write-Host "2. Deleting ECR container images..." -ForegroundColor Yellow
$repositories = aws ecr describe-repositories --region $awsRegion --query "repositories[?contains(repositoryName, '$projectTag')].repositoryName" --output text 2>$null
if ($repositories -and $repositories.Trim() -ne "") {
    foreach ($repository in $repositories.Trim() -split "\s+") {
        if ($repository) {
            Write-Host "  Purging images from $repository..." -ForegroundColor Cyan
            $count = Remove-ECRRepositoryImages -RepositoryName $repository -Region $awsRegion
            $left = aws ecr describe-images --repository-name $repository --region $awsRegion --query "length(imageDetails)" --output text 2>$null
            if ($left -and $left.Trim() -ne "" -and $left.Trim() -ne "0") {
                $failures.Add("ECR ${repository}: $left images remain after purge")
                Write-Host "  FAILED: $repository still holds $left images" -ForegroundColor Red
            } else {
                Write-Host "  $repository emptied ($count images deleted)." -ForegroundColor Green
            }
        }
    }
} else {
    Write-Host "  No ECR repositories match the project." -ForegroundColor Green
}
Write-Host ""

Write-Host "3. Running terraform destroy..." -ForegroundColor Yellow
$extraVars = @()
if (Test-Path "company_profile.json") {
    $profileJson = Get-Content "company_profile.json" -Raw | ConvertFrom-Json
    if ($profileJson.domain) { $extraVars += "-var=domain_name=$($profileJson.domain)" }
    if ($profileJson.support_email) { $extraVars += "-var=support_email=$($profileJson.support_email)" }
}

# Resources Terraform can no longer plan, because a module they depend on was already
# destroyed and its outputs are unknown, abort the whole graph. Falling back to a targeted
# destroy of whatever the state still holds keeps the teardown finishable.
function Get-ManagedResourceAddresses {
    param([string]$StatePath)

    if (-not (Test-Path $StatePath)) { return @() }
    $state = Get-Content $StatePath -Raw | ConvertFrom-Json
    $addresses = @()
    foreach ($resource in $state.resources) {
        if ($resource.mode -ne "managed") { continue }
        foreach ($instance in $resource.instances) {
            $address = "$($resource.module).$($resource.type).$($resource.name)"
            if ($null -ne $instance.index_key) {
                # count instances address as [0], for_each instances require the quoted ["key"] form.
                $key = $instance.index_key
                if ($key -is [int] -or $key -is [long] -or $key -is [double]) {
                    $address += "[$key]"
                } else {
                    $address += "[`"$key`"]"
                }
            }
            $addresses += $address
        }
    }
    return $addresses
}

Push-Location "terraform/environments/dev"
try {
    terraform destroy -auto-approve @extraVars
    $destroyExitCode = $LASTEXITCODE

    if ($destroyExitCode -ne 0) {
        Write-Host ""
        Write-Host "  terraform destroy failed, retrying the remaining resources individually." -ForegroundColor Yellow
        $statePath = Join-Path (Get-Location) "terraform.tfstate"
        $pending = Get-ManagedResourceAddresses -StatePath $statePath
        foreach ($address in $pending) {
            Write-Host "    Targeting $address" -ForegroundColor Cyan
            terraform destroy -auto-approve -refresh=false -input=false -target="$address" @extraVars 2>&1 |
                Select-String -Pattern "Destroy complete|Error|Still exists" | ForEach-Object { $_.Line }
            if ($LASTEXITCODE -ne 0) { $failures.Add("Terraform targeted destroy failed for ${address}") }
        }
    }
}
finally {
    Pop-Location
}
Write-Host ""

Write-Host "4. Verifying no billable residue..." -ForegroundColor Yellow
Push-Location "terraform/environments/dev"
try {
    $remaining = Get-ManagedResourceAddresses -StatePath (Join-Path (Get-Location) "terraform.tfstate")
    if ($remaining.Count -gt 0) {
        Write-Host "  $($remaining.Count) managed resources still tracked:" -ForegroundColor Red
        foreach ($address in $remaining) { Write-Host "    $address" -ForegroundColor Red }
        $failures.Add("Terraform state still tracks $($remaining.Count) managed resources")
    } else {
        Write-Host "  Terraform state tracks 0 managed resources." -ForegroundColor Green
    }
}
finally {
    Pop-Location
}

# Log groups created implicitly by CodeBuild and Container Insights are not tracked by
# Terraform, so they survive the destroy and keep accruing storage cost.
foreach ($logGroup in @(
    "/aws/codebuild/$projectTag-dev-build",
    "/aws/ecs/containerinsights/$projectTag-dev-cluster/performance"
)) {
    aws logs delete-log-group --log-group-name $logGroup --region $awsRegion 2>$null | Out-Null
}
Write-Host "  Implicit log groups removed." -ForegroundColor Green

$residuals = [ordered]@{
    "VPC endpoints"   = (aws ec2 describe-vpc-endpoints --region $awsRegion --query "length(VpcEndpoints)" --output text 2>$null)
    "NAT gateways"    = (aws ec2 describe-nat-gateways --region $awsRegion --query "length(NatGateways)" --output text 2>$null)
    "Network ifaces"  = (aws ec2 describe-network-interfaces --region $awsRegion --query "length(NetworkInterfaces)" --output text 2>$null)
    "Volumes"         = (aws ec2 describe-volumes --region $awsRegion --query "length(Volumes)" --output text 2>$null)
    "RDS instances"   = (aws rds describe-db-instances --region $awsRegion --query "length(DBInstances)" --output text 2>$null)
    "ECR repositories" = (aws ecr describe-repositories --region $awsRegion --query "length(repositories)" --output text 2>$null)
    "Load balancers"  = (aws elbv2 describe-load-balancers --region $awsRegion --query "length(LoadBalancers)" --output text 2>$null)
}
Write-Host ""
Write-Host "  Account-wide totals (other projects included, for reference):" -ForegroundColor Cyan
foreach ($entry in $residuals.GetEnumerator()) {
    Write-Host ("    {0,-18}: {1}" -f $entry.Key, $entry.Value)
}
Write-Host ""

if ($failures.Count -gt 0) {
    Write-Host "==============================================================================" -ForegroundColor Red
    Write-Host "  Teardown Finished With Problems" -ForegroundColor Red
    Write-Host "==============================================================================" -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host "  ! $failure" -ForegroundColor Red }
    Write-Host ""
    exit 1
}

Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "  Teardown Complete" -ForegroundColor Green
Write-Host "  All cloud resources deleted successfully." -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""
