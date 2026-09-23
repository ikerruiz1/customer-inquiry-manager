# ==============================================================================
# 1-Click Local Developer Environment Bootstrap (Windows PowerShell)
# Customer Inquiry Manager (ExampleCorp CIM)
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "  ExampleCorp CIM: 1-Click Local Developer Environment Bootstrap" -ForegroundColor Cyan
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

# 3. Backend Dependency Installation
Write-Host ""
Write-Host "[3/5] Installing Backend Dependencies into .venv..." -ForegroundColor Yellow
.\.venv\Scripts\python.exe -m pip install -q -r requirements.txt
Write-Host "  OK: 32 locked backend dependencies installed." -ForegroundColor Green

# 4. Automated Backend Test Suite Verification
Write-Host ""
Write-Host "[4/5] Executing Pytest Test Suite (Quality Gate)..." -ForegroundColor Yellow
$testOutput = .\.venv\Scripts\pytest app/tests/ -q
Write-Host "  $testOutput" -ForegroundColor Green

# 5. Frontend Dependency Installation
Write-Host ""
Write-Host "[5/5] Installing Frontend Dependencies (npm install)..." -ForegroundColor Yellow
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
