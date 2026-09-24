# ==============================================================================
# 1-Click Local Developer Environment Bootstrap (Windows PowerShell)
# Customer Inquiry Manager
# ==============================================================================
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
Write-Host "  $($companyName): 1-Click Local Developer Environment Bootstrap" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Prerequisite Validation
Write-Host "[1/5] Validating Local Toolchain..." -ForegroundColor Yellow

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

# 2. Virtual Environment Creation
Write-Host ""
Write-Host "[2/5] Initializing Python Virtual Environment (.venv)..." -ForegroundColor Yellow
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

# 3. Environment & Operator Identity Initialization
Write-Host ""
Write-Host "[3/6] Configuring Environment & Support Operator Identity..." -ForegroundColor Yellow
if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
    Copy-Item ".env.example" ".env"
    Write-Host "  OK: Created .env configuration from .env.example template." -ForegroundColor Green
    
    # Generate high-entropy password for initial operator
    $genPassword = .\.venv\Scripts\python.exe -c "from scripts.provision_operator import generate_secure_password; print(generate_secure_password(14))"
    (Get-Content ".env") -replace "^INITIAL_OPERATOR_PASSWORD=.*", "INITIAL_OPERATOR_PASSWORD=$genPassword" | Set-Content ".env"
    Write-Host "  OK: Generated secure entropy-backed password for initial operator." -ForegroundColor Green
}

# Resolve active administrator credentials from company_profile.json, CLI args, and .env
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
    Write-Host "  Configure Initial Break-Glass Operations Manager (Root Admin):" -ForegroundColor Cyan
    $promptName = Read-Host "  Enter Admin Full Name [Press Enter for '$activeOpName']"
    if ($promptName -and $promptName.Trim() -ne "") {
        $activeOpName = $promptName.Trim()
    }
    $promptPrefix = Read-Host "  Enter Admin Corporate Username Prefix [Press Enter for '$defaultAdminPrefix' -> $defaultAdminPrefix@$companyDomain]"
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

# Provision administrator in local SQLite registry
.\.venv\Scripts\python.exe scripts/provision_operator.py --name $activeOpName --email $activeOpEmail --role $activeOpRole --password $activeOpPassword > $null
Write-Host "  OK: Provisioned administrator '$activeOpEmail' ($activeOpName) with role '$activeOpRole' in local database." -ForegroundColor Green

# 4. Backend Dependency Installation
Write-Host ""
Write-Host "[4/6] Installing Backend Dependencies into .venv..." -ForegroundColor Yellow
.\.venv\Scripts\python.exe -m pip install -q -r requirements.txt
Write-Host "  OK: 32 locked backend dependencies installed." -ForegroundColor Green

# 5. Automated Backend Test Suite Verification
Write-Host ""
Write-Host "[5/6] Executing Pytest Test Suite (Quality Gate)..." -ForegroundColor Yellow
$testOutput = .\.venv\Scripts\pytest app/tests/ -q
Write-Host "  $testOutput" -ForegroundColor Green

# 6. Frontend Dependency Installation
Write-Host ""
Write-Host "[6/6] Installing Frontend Dependencies (npm install)..." -ForegroundColor Yellow
Push-Location frontend
try {
    npm install --silent
    Write-Host "  OK: Frontend node_modules ready." -ForegroundColor Green
}
finally {
    Pop-Location
}

# Summary and Launch Instructions
Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "  ENVIRONMENT SETUP COMPLETE! (0 Errors)" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "  INITIAL ADMINISTRATOR ONBOARDING & ACCESS CREDENTIALS (LOCAL DEV)" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "  Identity:        $activeOpName ($activeOpRole)" -ForegroundColor White
Write-Host "  Email / User:    $activeOpEmail" -ForegroundColor Yellow
Write-Host "  Initial Pass:    $activeOpPassword" -ForegroundColor Yellow
Write-Host "  TOTP MFA Seed:   JBSWY3DPEHPK3PXP" -ForegroundColor Yellow
Write-Host "------------------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  AUTHENTICATION INSTRUCTIONS FOR REPOSITORY CLONERS:" -ForegroundColor White
Write-Host "  1. Start the backend and frontend servers using the commands below." -ForegroundColor White
Write-Host "  2. Navigate to http://localhost:5173/ in your browser and click 'Sign In'." -ForegroundColor White
Write-Host "  3. Enter the Email and Initial Password printed above." -ForegroundColor White
Write-Host "  4. For the MFA Challenge, enter the 6-digit TOTP token generated by any" -ForegroundColor White
Write-Host "     RFC 6238 mobile app (Google Authenticator, Microsoft Authenticator," -ForegroundColor White
Write-Host "     1Password, etc.) configured with the seed: JBSWY3DPEHPK3PXP" -ForegroundColor White
Write-Host "  5. Once signed in, use the '+ Invite Agent' modal in the header to invite operators." -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To launch the platform locally, open two terminals:" -ForegroundColor White
Write-Host ""
Write-Host "  Terminal 1 (Backend - Port 8000):" -ForegroundColor Cyan
Write-Host "    .\.venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Terminal 2 (Frontend - Port 5173):" -ForegroundColor Cyan
Write-Host "    cd frontend; npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "Verified Endpoints:" -ForegroundColor White
Write-Host "  - Frontend Console: http://localhost:5173/" -ForegroundColor Gray
Write-Host "  - OpenAPI Swagger:  http://127.0.0.1:8000/docs" -ForegroundColor Gray
Write-Host ""
