param(
    [string]$AdminName = "",
    [string]$AdminEmail = "",
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
Write-Host "  $companyName - Local Development Setup" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Checking tools (Python, Node.js, npm)..." -ForegroundColor Yellow

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Python is not installed or not in PATH." -ForegroundColor Red
    exit 1
}
$pyVersion = python --version
Write-Host "  OK: $pyVersion" -ForegroundColor Green

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js is not installed or not in PATH." -ForegroundColor Red
    exit 1
}
$nodeVersion = node --version
Write-Host "  OK: Node.js $nodeVersion" -ForegroundColor Green

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "Error: npm is not installed or not in PATH." -ForegroundColor Red
    exit 1
}
$npmVersion = npm --version
Write-Host "  OK: npm v$npmVersion" -ForegroundColor Green

Write-Host ""
Write-Host "2. Initializing Python virtual environment..." -ForegroundColor Yellow
if (-not (Test-Path ".venv")) {
    python -m venv .venv
    Write-Host "  OK: .venv created successfully." -ForegroundColor Green
}
else {
    Write-Host "  OK: .venv already exists. Reusing existing environment." -ForegroundColor Green
}

if (-not (Test-Path "company_profile.json") -and (Test-Path "company_profile.example.json")) {
    Copy-Item "company_profile.example.json" "company_profile.json"
    Write-Host "  OK: Initialized company_profile.json from company_profile.example.json" -ForegroundColor Green
}

Write-Host ""
Write-Host "3. Configuring environment and administrator..." -ForegroundColor Yellow
if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
    Copy-Item ".env.example" ".env"
    Write-Host "  OK: Created .env configuration from .env.example template." -ForegroundColor Green
    
    $genPassword = .\.venv\Scripts\python.exe -c "from scripts.provision_operator import generate_secure_password; print(generate_secure_password(14))"
    (Get-Content ".env") -replace "^INITIAL_OPERATOR_PASSWORD=.*", "INITIAL_OPERATOR_PASSWORD=$genPassword" | Set-Content ".env"
    Write-Host "  OK: Generated secure entropy-backed password for initial operator." -ForegroundColor Green
}

$activeOpName = "Cloud Administrator"
$activeOpEmail = "admin@company.internal"
$activeOpRole = "Operations_Manager"

if (Test-Path "company_profile.json") {
    try {
        $p = Get-Content "company_profile.json" -Raw | ConvertFrom-Json
        if ($p.admin_name) {
            $activeOpName = $p.admin_name
        } elseif ($p.operator_name) {
            $activeOpName = $p.operator_name
        }
        if ($p.admin_email) {
            $activeOpEmail = $p.admin_email
        } elseif ($p.operator_email) {
            $activeOpEmail = $p.operator_email
        } elseif ($p.domain) {
            $activeOpEmail = "admin@$($p.domain)"
        }
    } catch {}
}

if ($AdminName) { $activeOpName = $AdminName.Trim() }
if ($AdminEmail) { $activeOpEmail = $AdminEmail.Trim() }

$defaultAdminPrefix = "admin"
if ($activeOpEmail -match "^([^@]+)@") {
    $defaultAdminPrefix = $matches[1]
}
$companyDomain = if ($activeOpEmail -match "@(.+)$") { $matches[1] } else { "company.internal" }

if (-not $AdminName -and -not $AdminEmail -and -not $NonInteractive -and [Environment]::UserInteractive) {
    Write-Host "  Administrator account configuration:" -ForegroundColor Cyan
    $promptName = Read-Host "  Enter Admin Full Name [Press Enter for '$activeOpName']"
    if ($promptName -and $promptName.Trim() -ne "") {
        $activeOpName = $promptName.Trim()
    }
    $promptPrefix = Read-Host "  Enter Admin username prefix [Press Enter for '$defaultAdminPrefix' -> $defaultAdminPrefix@$companyDomain]"
    if ($promptPrefix -and $promptPrefix.Trim() -ne "") {
        if ($promptPrefix -match "^([^@]+)@") {
            $activeOpEmail = $promptPrefix.Trim()
        } else {
            $activeOpEmail = "$($promptPrefix.Trim())@$companyDomain"
        }
    }
}

$activeOpPassword = "ChangeMeOnFirstLogin2026!"
if (Test-Path ".env") {
    $envLines = Get-Content ".env"
    foreach ($line in $envLines) {
        if ($line -match "^INITIAL_OPERATOR_EMAIL=(.+)$" -and $matches[1].Trim() -ne "admin@company.internal" -and $matches[1].Trim() -ne "employer1@company.internal") {
            $activeOpEmail = $matches[1].Trim()
        }
        if ($line -match "^INITIAL_OPERATOR_PASSWORD=(.+)$") {
            $activeOpPassword = $matches[1].Trim()
        }
    }
}

.\.venv\Scripts\python.exe scripts/provision_operator.py --name $activeOpName --email $activeOpEmail --role $activeOpRole --password $activeOpPassword > $null
Write-Host "  OK: Created local administrator account '$activeOpEmail' ($activeOpRole)." -ForegroundColor Green

Write-Host ""
Write-Host "4. Installing backend dependencies..." -ForegroundColor Yellow
.\.venv\Scripts\python.exe -m pip install -q -r requirements.txt
Write-Host "  OK: Dependencies installed." -ForegroundColor Green

Write-Host ""
Write-Host "5. Running automated tests..." -ForegroundColor Yellow
$testOutput = .\.venv\Scripts\pytest app/tests/ -q
Write-Host "  $testOutput" -ForegroundColor Green

Write-Host ""
Write-Host "6. Installing frontend dependencies..." -ForegroundColor Yellow
Push-Location frontend
try {
    npm install --silent
    Write-Host "  OK: Frontend ready." -ForegroundColor Green
}
finally {
    Pop-Location
}
Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "  Local Setup Complete" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "  Admin User:   $activeOpEmail" -ForegroundColor Yellow
Write-Host "  Initial Pass: $activeOpPassword" -ForegroundColor Yellow
Write-Host "  TOTP Seed:    JBSWY3DPEHPK3PXP" -ForegroundColor White
Write-Host "------------------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  To start the application:" -ForegroundColor White
Write-Host "    Backend:   .\.venv\Scripts\uvicorn app.main:app --port 8000 --reload" -ForegroundColor Cyan
Write-Host "    Frontend:  cd frontend; npm run dev" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""
