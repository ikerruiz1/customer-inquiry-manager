#!/usr/bin/env bash
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
echo -e "${C_BOLD}${C_CYAN}  ${COMPANY_NAME} - Local Development Setup${C_RESET}"
echo -e "${C_BOLD}${C_CYAN}==============================================================================${C_RESET}\n"

echo -e "${C_BOLD}1. Checking tools (Python, Node.js, npm)...${C_RESET}"
command -v python3 >/dev/null 2>&1 || { echo -e "${C_RED}Error: python3 is not installed or not in PATH.${C_RESET}"; exit 1; }
echo -e "  ${C_GREEN}✓ Python: $(python3 --version)${C_RESET}"

command -v node >/dev/null 2>&1 || { echo -e "${C_RED}Error: node is not installed or not in PATH.${C_RESET}"; exit 1; }
echo -e "  ${C_GREEN}✓ Node.js: $(node --version)${C_RESET}"

command -v npm >/dev/null 2>&1 || { echo -e "${C_RED}Error: npm is not installed or not in PATH.${C_RESET}"; exit 1; }
echo -e "  ${C_GREEN}✓ npm: v$(npm --version)${C_RESET}"

echo -e "\n${C_BOLD}${C_YELLOW}2. Initializing Python virtual environment...${C_RESET}"
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

echo -e "\n${C_BOLD}${C_YELLOW}3. Installing backend dependencies...${C_RESET}"
./.venv/bin/pip install -q --upgrade pip
./.venv/bin/pip install -q -r requirements.txt
echo -e "  ${C_GREEN}  OK: Dependencies installed.${C_RESET}"

echo -e "\n${C_BOLD}${C_YELLOW}4. Configuring environment and administrator...${C_RESET}"
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
    echo -e "  ${C_GREEN}✓ Created .env configuration from .env.example template.${C_RESET}"

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
    echo -e "${C_CYAN}  Administrator account configuration:${C_RESET}"
    read -p "  Enter Admin Full Name [Press Enter for '$ACTIVE_OP_NAME']: " PROMPT_ADMIN_NAME
    ACTIVE_OP_NAME="${PROMPT_ADMIN_NAME:-$ACTIVE_OP_NAME}"
    read -p "  Enter Admin username prefix [Press Enter for '$DEFAULT_PREFIX' -> ${DEFAULT_PREFIX}@${COMPANY_DOMAIN}]: " PROMPT_PREFIX
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

./.venv/bin/python scripts/provision_operator.py --name "${ACTIVE_OP_NAME}" --email "${ACTIVE_OP_EMAIL}" --role "${ACTIVE_OP_ROLE}" --password "${ACTIVE_OP_PASSWORD}" >/dev/null
echo -e "  ${C_GREEN}  OK: Created local administrator account '${ACTIVE_OP_EMAIL}' (${ACTIVE_OP_ROLE}).${C_RESET}"

echo -e "\n${C_BOLD}${C_YELLOW}5. Running automated tests...${C_RESET}"
./.venv/bin/pytest app/tests/ -q
echo -e "  ${C_GREEN}  OK: All tests passed.${C_RESET}"

echo -e "\n${C_BOLD}${C_YELLOW}6. Installing frontend dependencies...${C_RESET}"
(cd frontend && npm install --silent)
echo -e "  ${C_GREEN}  OK: Frontend ready.${C_RESET}"
echo -e "\n${C_BOLD}${C_GREEN}==============================================================================${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}  Local Setup Complete${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}==============================================================================${C_RESET}"
echo -e "  Admin User:   ${C_YELLOW}${ACTIVE_OP_EMAIL}${C_RESET}"
echo -e "  Initial Pass: ${C_YELLOW}${ACTIVE_OP_PASSWORD}${C_RESET}"
echo -e "  TOTP Seed:    JBSWY3DPEHPK3PXP"
echo -e "------------------------------------------------------------------------------"
echo -e "  To start the application:"
echo -e "    Backend:   ./.venv/bin/uvicorn app.main:app --port 8000 --reload"
echo -e "    Frontend:  cd frontend && npm run dev"
echo -e "${C_BOLD}${C_GREEN}==============================================================================${C_RESET}\n"
