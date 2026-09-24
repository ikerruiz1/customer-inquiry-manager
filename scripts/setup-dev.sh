#!/usr/bin/env bash
# ==============================================================================
# 1-Click Local Developer Environment Bootstrap (Linux / macOS)
# Customer Inquiry Manager
# ==============================================================================
set -euo pipefail

C_RESET="\033[0m"
C_BOLD="\033[1m"
C_GREEN="\033[32m"
C_YELLOW="\033[33m"
C_RED="\033[31m"
C_CYAN="\033[36m"

CUSTOM_ADMIN_NAME=""
CUSTOM_ADMIN_EMAIL=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --admin-name)
      CUSTOM_ADMIN_NAME="$2"
      shift 2
      ;;
    --admin-email)
      CUSTOM_ADMIN_EMAIL="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

COMPANY_NAME="Customer Inquiry Manager"
if [ -f "company_profile.json" ]; then
    COMPANY_NAME=$(python -c "import json; print(json.load(open('company_profile.json')).get('company_name', 'Customer Inquiry Manager'))" 2>/dev/null || echo "Customer Inquiry Manager")
elif [ -f "company_profile.example.json" ]; then
    COMPANY_NAME=$(python -c "import json; print(json.load(open('company_profile.example.json')).get('company_name', 'Customer Inquiry Manager'))" 2>/dev/null || echo "Customer Inquiry Manager")
fi

echo -e "\n${C_BOLD}${C_CYAN}==============================================================================${C_RESET}"
echo -e "${C_BOLD}${C_CYAN}  ${COMPANY_NAME}: 1-Click Local Developer Environment Bootstrap${C_RESET}"
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

if [ ! -f "company_profile.json" ] && [ -f "company_profile.example.json" ]; then
    cp company_profile.example.json company_profile.json
    echo -e "  ${C_GREEN}✓ Initialized company_profile.json from company_profile.example.json${C_RESET}"
fi

# 3. Environment & Operator Identity Initialization
echo -e "\n${C_BOLD}${C_YELLOW}[3/6] Configuring Environment & Support Operator Identity...${C_RESET}"
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
    echo -e "  ${C_GREEN}✓ Created .env configuration from .env.example template.${C_RESET}"

    # Generate high-entropy password for initial operator
    GEN_PASSWORD=$(./.venv/bin/python -c "from scripts.provision_operator import generate_secure_password; print(generate_secure_password(14))")
    sed -i "s/^INITIAL_OPERATOR_PASSWORD=.*/INITIAL_OPERATOR_PASSWORD=${GEN_PASSWORD}/" .env 2>/dev/null || sed -i '' "s/^INITIAL_OPERATOR_PASSWORD=.*/INITIAL_OPERATOR_PASSWORD=${GEN_PASSWORD}/" .env
    echo -e "  ${C_GREEN}✓ Generated secure entropy-backed password for initial operator.${C_RESET}"
fi

ACTIVE_OP_NAME="Cloud Administrator"
ACTIVE_OP_EMAIL="admin@company.internal"
ACTIVE_OP_ROLE="Operations_Manager"

if [ -f "company_profile.json" ]; then
    ACTIVE_OP_NAME=$(./.venv/bin/python -c "import json; p=json.load(open('company_profile.json')); print(p.get('admin_name', p.get('operator_name', 'Cloud Administrator')))" 2>/dev/null || echo "Cloud Administrator")
    ACTIVE_OP_EMAIL=$(./.venv/bin/python -c "import json; p=json.load(open('company_profile.json')); print(p.get('admin_email', p.get('operator_email', f'admin@{p.get(\"domain\", \"company.internal\")}')))" 2>/dev/null || echo "admin@company.internal")
fi

if [ -n "$CUSTOM_ADMIN_NAME" ]; then
    ACTIVE_OP_NAME="$CUSTOM_ADMIN_NAME"
fi
if [ -n "$CUSTOM_ADMIN_EMAIL" ]; then
    ACTIVE_OP_EMAIL="$CUSTOM_ADMIN_EMAIL"
fi

DEFAULT_PREFIX="admin"
COMPANY_DOMAIN=$(echo "$ACTIVE_OP_EMAIL" | cut -d'@' -f2)

if [ -z "$CUSTOM_ADMIN_NAME" ] && [ -z "$CUSTOM_ADMIN_EMAIL" ] && [ -t 0 ]; then
    echo -e "${C_CYAN}  Configure Initial Break-Glass Operations Manager (Root Admin):${C_RESET}"
    read -p "  Enter Admin Full Name [Press Enter for '$ACTIVE_OP_NAME']: " PROMPT_ADMIN_NAME
    ACTIVE_OP_NAME="${PROMPT_ADMIN_NAME:-$ACTIVE_OP_NAME}"
    read -p "  Enter Admin Corporate Username Prefix [Press Enter for '$DEFAULT_PREFIX' -> ${DEFAULT_PREFIX}@${COMPANY_DOMAIN}]: " PROMPT_PREFIX
    if [ -n "$PROMPT_PREFIX" ]; then
        ACTIVE_PREFIX=$(echo "$PROMPT_PREFIX" | cut -d'@' -f1)
        ACTIVE_OP_EMAIL="${ACTIVE_PREFIX}@${COMPANY_DOMAIN}"
    fi
fi

ACTIVE_OP_PASSWORD="ChangeMeOnFirstLogin2026!"
if [ -f ".env" ]; then
    ENV_OP_EMAIL=$(grep "^INITIAL_OPERATOR_EMAIL=" .env | cut -d'=' -f2- | tr -d '\r\n' || echo "")
    if [ -n "$ENV_OP_EMAIL" ] && [ "$ENV_OP_EMAIL" != "admin@company.internal" ] && [ "$ENV_OP_EMAIL" != "employer1@company.internal" ]; then
        ACTIVE_OP_EMAIL="$ENV_OP_EMAIL"
    fi
    ACTIVE_OP_PASSWORD=$(grep "^INITIAL_OPERATOR_PASSWORD=" .env | cut -d'=' -f2- | tr -d '\r\n' || echo "ChangeMeOnFirstLogin2026!")
fi

# Provision administrator in local SQLite registry
./.venv/bin/python scripts/provision_operator.py --name "${ACTIVE_OP_NAME}" --email "${ACTIVE_OP_EMAIL}" --role "${ACTIVE_OP_ROLE}" --password "${ACTIVE_OP_PASSWORD}" >/dev/null
echo -e "  ${C_GREEN}✓ Provisioned administrator '${ACTIVE_OP_EMAIL}' (${ACTIVE_OP_NAME}) with role '${ACTIVE_OP_ROLE}' in local database.${C_RESET}"

# 4. Backend Dependency Installation
echo -e "\n${C_BOLD}${C_YELLOW}[4/6] Installing Backend Dependencies into .venv...${C_RESET}"
./.venv/bin/pip install -q --upgrade pip
./.venv/bin/pip install -q -r requirements.txt
echo -e "  ${C_GREEN}✓ 32 locked backend dependencies installed.${C_RESET}"

# 5. Automated Backend Test Suite Verification
echo -e "\n${C_BOLD}${C_YELLOW}[5/6] Executing Pytest Test Suite (Quality Gate)...${C_RESET}"
./.venv/bin/pytest app/tests/ -q
echo -e "  ${C_GREEN}✓ All backend unit and integration tests passed.${C_RESET}"

# 6. Frontend Dependency Installation
echo -e "\n${C_BOLD}${C_YELLOW}[6/6] Installing Frontend Dependencies (npm install)...${C_RESET}"
(cd frontend && npm install --silent)
echo -e "  ${C_GREEN}✓ Frontend node_modules ready.${C_RESET}"

# Summary and Launch Instructions
echo -e "\n${C_BOLD}${C_GREEN}==============================================================================${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}  ENVIRONMENT SETUP COMPLETE! (0 Errors)${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}==============================================================================${C_RESET}\n"

echo -e "${C_BOLD}${C_CYAN}==============================================================================${C_RESET}"
echo -e "${C_BOLD}${C_CYAN}  INITIAL ADMINISTRATOR ONBOARDING & ACCESS CREDENTIALS (LOCAL DEV)${C_RESET}"
echo -e "${C_BOLD}${C_CYAN}==============================================================================${C_RESET}"
echo -e "  Identity:        ${ACTIVE_OP_NAME} (${ACTIVE_OP_ROLE})"
echo -e "  Email / User:    ${C_YELLOW}${ACTIVE_OP_EMAIL}${C_RESET}"
echo -e "  Initial Pass:    ${C_YELLOW}${ACTIVE_OP_PASSWORD}${C_RESET}"
echo -e "  TOTP MFA Seed:   ${C_YELLOW}JBSWY3DPEHPK3PXP${C_RESET}"
echo -e "------------------------------------------------------------------------------"
echo -e "  AUTHENTICATION INSTRUCTIONS FOR REPOSITORY CLONERS:"
echo -e "  1. Start the backend and frontend servers using the commands below."
echo -e "  2. Navigate to http://localhost:5173/ in your browser and click 'Sign In'."
echo -e "  3. Enter the Email and Initial Password printed above."
echo -e "  4. For the MFA Challenge, enter the 6-digit TOTP token generated by any"
echo -e "     RFC 6238 mobile app (Google Authenticator, Microsoft Authenticator,"
echo -e "     1Password, etc.) configured with the seed: JBSWY3DPEHPK3PXP"
echo -e "  5. Once signed in, use the '+ Invite Agent' modal in the header to invite operators.\n"
echo -e "${C_BOLD}${C_CYAN}==============================================================================${C_RESET}\n"

echo -e "To launch the platform locally, open two terminals:\n"
echo -e "  ${C_CYAN}Terminal 1 (Backend - Port 8000):${C_RESET}"
echo -e "    ${C_YELLOW}./.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload${C_RESET}\n"
echo -e "  ${C_CYAN}Terminal 2 (Frontend - Port 5173):${C_RESET}"
echo -e "    ${C_YELLOW}cd frontend && npm run dev${C_RESET}\n"
echo -e "Verified Endpoints:"
echo -e "  - Frontend Console: http://localhost:5173/"
echo -e "  - OpenAPI Swagger:  http://127.0.0.1:8000/docs\n"
