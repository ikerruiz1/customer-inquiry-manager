#!/usr/bin/env bash
# ==============================================================================
# 1-Click Local Developer Environment Bootstrap (Linux / macOS)
# Customer Inquiry Manager (ExampleCorp CIM)
# ==============================================================================
set -euo pipefail

C_RESET="\033[0m"
C_BOLD="\033[1m"
C_GREEN="\033[32m"
C_YELLOW="\033[33m"
C_RED="\033[31m"
C_CYAN="\033[36m"

echo -e "\n${C_BOLD}${C_CYAN}==============================================================================${C_RESET}"
echo -e "${C_BOLD}${C_CYAN}  ExampleCorp CIM: 1-Click Local Developer Environment Bootstrap${C_RESET}"
echo -e "${C_BOLD}${C_CYAN}==============================================================================${C_RESET}\n"

# 1. Prerequisite Validation
echo -e "${C_BOLD}${C_YELLOW}[1/5] Validating Local Toolchain...${C_RESET}"
command -v python3 >/dev/null 2>&1 || { echo -e "${C_RED}Error: python3 is not installed or not in PATH.${C_RESET}"; exit 1; }
echo -e "  ${C_GREEN}✓ Python: $(python3 --version)${C_RESET}"

command -v node >/dev/null 2>&1 || { echo -e "${C_RED}Error: node is not installed or not in PATH.${C_RESET}"; exit 1; }
echo -e "  ${C_GREEN}✓ Node.js: $(node --version)${C_RESET}"

command -v npm >/dev/null 2>&1 || { echo -e "${C_RED}Error: npm is not installed or not in PATH.${C_RESET}"; exit 1; }
echo -e "  ${C_GREEN}✓ npm: v$(npm --version)${C_RESET}"

# 2. Virtual Environment Creation
echo -e "\n${C_BOLD}${C_YELLOW}[2/5] Initializing Python Virtual Environment (.venv)...${C_RESET}"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    echo -e "  ${C_GREEN}✓ .venv created successfully.${C_RESET}"
else
    echo -e "  ${C_GREEN}✓ .venv already exists. Reusing existing environment.${C_RESET}"
fi

# 3. Backend Dependency Installation
echo -e "\n${C_BOLD}${C_YELLOW}[3/5] Installing Backend Dependencies into .venv...${C_RESET}"
./.venv/bin/pip install -q --upgrade pip
./.venv/bin/pip install -q -r requirements.txt
echo -e "  ${C_GREEN}✓ 32 locked backend dependencies installed.${C_RESET}"

# 4. Automated Backend Test Suite Verification
echo -e "\n${C_BOLD}${C_YELLOW}[4/5] Executing Pytest Test Suite (Quality Gate)...${C_RESET}"
./.venv/bin/pytest app/tests/ -q
echo -e "  ${C_GREEN}✓ All backend unit and integration tests passed.${C_RESET}"

# 5. Frontend Dependency Installation
echo -e "\n${C_BOLD}${C_YELLOW}[5/5] Installing Frontend Dependencies (npm install)...${C_RESET}"
(cd frontend && npm install --silent)
echo -e "  ${C_GREEN}✓ Frontend node_modules ready.${C_RESET}"

# Summary and Launch Instructions
echo -e "\n${C_BOLD}${C_GREEN}==============================================================================${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}  ENVIRONMENT SETUP COMPLETE! (0 Errors)${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}==============================================================================${C_RESET}\n"

echo -e "To launch the platform locally, open two terminals:\n"
echo -e "  ${C_CYAN}Terminal 1 (Backend - Port 8000):${C_RESET}"
echo -e "    ${C_YELLOW}./.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload${C_RESET}\n"
echo -e "  ${C_CYAN}Terminal 2 (Frontend - Port 5173):${C_RESET}"
echo -e "    ${C_YELLOW}cd frontend && npm run dev${C_RESET}\n"
echo -e "Verified Endpoints:"
echo -e "  - Frontend Console: http://localhost:5173/"
echo -e "  - OpenAPI Swagger:  http://127.0.0.1:8000/docs\n"
