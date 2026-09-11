# Customer Inquiry Manager (ExampleCorp CIM)
## Enterprise AI Customer Inquiry & Ticket Triage Platform

An enterprise-grade, cloud-native customer inquiry ingestion, AI triage, and Human-in-the-Loop (HITL) resolution platform built on **Amazon Web Services (AWS)** and modern DevOps/DevSecOps practices.

---

## 1. Architectural Highlights

- **Amazon Bedrock AI Triage (Single-Pass Inference):** Utilizes the **Converse API** with `eu.anthropic.claude-haiku-4-5-20251001-v1:0` to execute single-pass department classification across 6 authoritative business domains, urgency/impact rating, quantified sentiment extraction, churn risk detection, and company policy-grounded draft response generation.
- **Zero-Internet Egress (PrivateLink Architecture):** Eliminates NAT Gateways, reducing cloud costs by ~$65/month per AZ. All ECS Fargate tasks communicate with AWS services exclusively via **8 Interface VPC Endpoints** (`ecr.api`, `ecr.dkr`, `logs`, `secretsmanager`, `bedrock-runtime`, `cognito-idp`, `sns`, `xray`) and an **Amazon S3 Gateway Endpoint**.
- **3-Tier Network Isolation:** Dedicated public subnets for the Application Load Balancer, private subnets for ECS Fargate compute and VPC Endpoints, and isolated database subnets for Amazon RDS PostgreSQL 16 with local-only routing (`10.0.0.0/16 -> local`).
- **Amazon Cognito Zero-Trust Authentication:** Enforces RFC 6238 Software Token Multi-Factor Authentication (TOTP) without SMS telecom dependencies. Features granular Role-Based Access Control (RBAC) separating `Tier1_Agents` and `Operations_Managers`.
- **ECS Fargate Spot Dual-Container Topology:** High-availability container architecture utilizing Fargate Spot (`capacity_provider_strategy`) for ~70% compute cost reduction, coupled with an official `aws-xray-daemon` sidecar for distributed tracing.
- **FinOps S3 Multi-Tier Lifecycle:** Automated transitions for customer attachments (`Standard` -> `Glacier Instant Retrieval` at Day 60) and ALB access logs (`Standard` -> `Glacier` at Day 30 -> Expiration at Day 90).
- **Clean Teardown Guarantee (0.00 € Residual Cost):** Built with `force_destroy = true` across all S3 buckets and `skip_final_snapshot = true` / `deletion_protection = false` on RDS to guarantee clean destruction without orphaned resources.
- **100% Native AWS Developer Tools CI/CD:** Unified under **AWS CodePipeline, AWS CodeBuild, and AWS CodeDeploy** with Canary traffic shifting (`Canary10Percent5Minutes`) for zero-downtime Blue/Green deployments.

---

## 2. Master Repository Structure

```text
customer-inquiry-manager/
├── app/                              # FastAPI Backend Application
│   ├── api/v1/                       # API v1 Versioned Endpoints
│   │   ├── auth.py                   # Cognito login & TOTP MFA verification
│   │   ├── inquiries.py              # Triage, priority queue, atomic claim, HITL resolve
│   │   ├── webhooks.py               # Inbound Email, Form, Trustpilot, Google Reviews, Billing
│   │   ├── attachments.py            # S3 presigned upload & download URLs
│   │   ├── router.py                 # Router aggregation
│   │   └── __init__.py               # Canonical API router export
│   ├── core/                         # Core Configurations & Security
│   │   ├── config.py                 # Pydantic Settings v2
│   │   ├── database.py               # SQLAlchemy 2.0 async engine & sessionmaker
│   │   ├── security.py               # Cognito RS256 JWKS & RBAC dependencies
│   │   └── telemetry.py              # AWS X-Ray SDK & CloudWatch EMF metrics
│   ├── models/                       # SQLAlchemy ORM Models
│   │   ├── inquiry.py                # Inquiry & AuditLog models with B-Tree and GIN indexes
│   │   └── __init__.py               # Clean model re-exports
│   ├── schemas/                      # Pydantic v2 Validation Schemas
│   │   ├── auth.py                   # Login & TOTP challenge schemas
│   │   ├── bedrock.py                # Strict Bedrock Converse extraction schema
│   │   ├── inquiry.py                # Inquiries, queues, and audit log schemas
│   │   └── __init__.py               # Clean schema re-exports
│   ├── services/                     # AWS Service Adapters
│   │   ├── bedrock_service.py        # Amazon Bedrock Converse API client & Guardrails
│   │   ├── cognito_service.py        # Amazon Cognito TOTP authentication
│   │   ├── s3_service.py             # S3 presigned URL generation
│   │   ├── sns_service.py            # Outbound SNS customer receipts & Ops alerts
│   │   └── __init__.py               # Clean service re-exports
│   ├── health.py                     # Container /health/live and /health/ready probes
│   ├── main.py                       # FastAPI entrypoint, lifespan context & CORS
│   └── tests/                        # Automated Pytest Suite (100% Pass Rate)
│       ├── conftest.py               # In-memory SQLite async engine & service mocks
│       ├── test_auth.py              # Cognito login & TOTP verification tests
│       ├── test_bedrock_schema.py    # Extraction bounds & Pydantic validation tests
│       ├── test_health.py            # Container health check probe tests
│       ├── test_inquiries.py         # ITIL SLA calculation, claiming & HITL resolve tests
│       └── test_webhooks.py          # HMAC-SHA256 & omnichannel ingestion tests
├── frontend/                         # Operations Console (React 19, TypeScript, Vite)
│   ├── src/                          # Application source code
│   │   ├── api/                      # Resilient Dual-Mode API client & canonical B2B datasets
│   │   ├── components/               # Taskly Hero Visualizations, Bento cards, LoadLogic Queue
│   │   ├── types/                    # Domain schemas (Inquiry, ITIL tiers, Themes)
│   │   ├── App.tsx                   # Main console root shell
│   │   └── main.tsx                  # Client entrypoint
│   ├── public/themes/                # GPU-accelerated wallpapers (Cobalt, Cloudscape, etc.)
│   └── package.json                  # Frontend dependencies
├── docs/                             # Authoritative Documentation & Decision Memory
│   ├── PROJECT_CONTEXT.md            # 3-Tier topology blueprint & 47 chronological flows
│   └── ARCHITECTURE_DECISIONS_AND_QA.md # Historical ledger of engineering debates & resolutions
├── company_profile.json              # Domain grounding document (ITIL matrix & refund policies)
├── Dockerfile                        # Production Python 3.12-slim runtime container (Non-root security)
├── buildspec.yml                     # AWS CodeBuild spec (Pytest, Semgrep SAST, KICS, Trivy, Syft)
├── appspec.yaml                      # AWS CodeDeploy spec (ECS Fargate Blue/Green Canary)
├── terraform/                        # Modular Infrastructure as Code
│   ├── environments/dev/             # Root dev composition
│   └── modules/                      # vpc, security_groups, cognito, rds, s3, iam, alb, ecs, monitoring, cicd
├── scripts/                          # Automation & Test Harness Scripts
│   ├── setup-dev.ps1                 # 1-Click Windows PowerShell local developer bootstrap
│   ├── setup-dev.sh                  # 1-Click Linux / macOS local developer bootstrap
│   ├── seed_inquiries.py             # Omnichannel inbound traffic generator
│   ├── k6-load-test.js               # Load and auto-scaling validation script
│   ├── deploy-infra.sh               # 1-Click AWS infrastructure deployment bootstrap
│   └── teardown-infra.sh             # 1-Click clean cloud teardown (0.00 € residual cost)
├── requirements.txt                  # Locked Python dependencies
├── pyproject.toml                    # Standard Python project metadata & tool configurations (PEP 518/621)
├── LICENSE
└── AGENTS.md                         # Persistent workspace rules & directives
```

---

## 3. Frontend Operations Console Architecture (LoadLogic & Taskly Design System)

The presentation tier is engineered as an enterprise-grade, high-density operations command center built with **React 19, TypeScript (strict mode), and Vite 8**. It utilizes Vanilla CSS with custom property tokens (`:root`), adhering strictly to zero-bloat architectural principles without runtime UI framework dependencies.

### Key Visual & Ergonomic Subsystems:

1. **Taskly Hero Analytics & Semicircular Arc Gauges (`TasklyHeroVisualizations.tsx`):**
   - **180° Semicircular Arc Gauges (`SemiCircleGauge`):** Mathematical SVG arc rendering (`r=44`, trajectory `M 21 58 A 44 44 0 0 1 109 58`). The active segment sweeps clockwise from the left origin with stroke-dash calculation, while the remaining path is textured with a blueprint-grade diagonal hatch pattern (`<pattern id="hatch_...">`). Displays real-time delta badges (`+10% ↑`, `+15% ↑`).
   - **Metric Parameter Provenance:** Surfaces raw variables feeding the SLA Compliance and MTTR Velocity metrics (`In-Bounds / Total`, `Breached Count`, `Target Threshold ≥ 95.0%`, Bedrock P95 inference latency `~1.24s`, and FinOps unit economics `~0.00025 €/ticket`).
   - **Categorical Hatched Pill Bar Charts:** Multi-color diagonal striped bars (`rx="9999"`) visualizing inquiry distributions across 6 Departments, 4 ITIL Priority tiers, 4 Ingestion channels, and 5 Sentiment brackets. Features dynamic Y-axis scaling (`Math.max(...counts)`), floating tooltip capsules, and interactive temporal query selectors (`Current Shift`, `Last 24 Hours`, `Last 7 Days`, `Last 8 Weeks`).

2. **Modular Draggable Widget Engine (`DashboardWidgetGrid.tsx`):**
   - **7 Atomic Draggable Subcharts:** Operators can independently reorder `kpi_sla`, `kpi_mttr`, `domain_distribution`, `priority_distribution`, `sources_distribution`, `sentiment_distribution`, and `queue_table`.
   - **HTML5 Drag-and-Drop Stabilization:** Eliminates layout thrashing and 60 FPS stuttering by delegating drag initiation strictly to `.widget-drag-handle` (`⠿ Move`) and rendering drop target previews via an absolute overlay (`position: absolute; inset: 0; pointer-events: none; border: 3px dashed #047857;`) with directional motion vectors (`dropSlotArrow`).
   - **Persistent Layout State:** Layout configurations serialize to `localStorage` (`cloudscale_widget_order_v7`), accompanied by a 1-click `Reset Layout` trigger.

3. **High-Density Prioritized ITIL Queue Table (`LoadLogicQueueTable.tsx`):**
   - **Immutable CSS Grid Layout:** Uniform column geometry (`100px 165px 1fr 190px 115px 110px`) guaranteeing that real-time SLA tickers and status indicators remain horizontally anchored across every row.
   - **Deterministic ITIL Q38 Urgency Hierarchy Algorithm:** Default queue state is sorted automatically across a 5-tier mathematical tie-breaking hierarchy:
     1. `is_sla_breached DESC` (Immediate contractual breach mitigation)
     2. `priority (P1 > P2 > P3 > P4) ASC` (Critical incident precedence)
     3. `churn_risk DESC` (Hostile customer retention de-escalation)
     4. `sla_deadline_at ASC` (Proximity to SLA window expiration)
     5. `created_at ASC` (FIFO tie-breaker)
   - **Quick Facet Filtering Ribbon:** 1-click filter chips for `🔥 P1`, `P2`, `P3`, `P4`, `⚠ Churn Risk`, and Ingestion Channels (`Stripe`, `Email`, `Trustpilot`, `Web Form`).
   - **Real-Time Heartbeat:** Active 1000ms ticker recalculating seconds to deadline.

4. **Expansive Centered 2-Column Inspection Modal (`LoadLogicDetailDrawer.tsx`):**
   - Centered dialog operating at `min(1160px, 94vw)` with high-blur backdrop (`backdropFilter: blur(8px)`), eliminating peripheral distraction.
   - **Resolution Plane (Left):** Raw customer payload with arrival timestamps, structured NER data chips (Order ID, Amount, Error Code) with 1-click clipboard copying, confidential copilot notes, and response draft editor with 1-click approve & dispatch.
   - **Intelligence & Governance Plane (Right):** Amazon Bedrock Claude Haiku 4.5 XAI rationale, inference latency, confidence scores, sentiment/churn hostility meters, supervisor MLOps classification overrides with mandatory justification ($\ge 10$ chars), and immutable audit trail history (`AuditLog`).

5. **Hardware-Accelerated Ambient Theme Engine (`AmbientBackground.tsx` & `ThemeSelector.tsx`):**
   - Isolated in a fixed compositing layer (`transform: translateZ(0)`), guaranteeing zero-lag rendering without compositor repaints during queue interaction.
   - 7 production themes: `Cobalt` (Fluid wave layers), `Cloudscape` (Daylight cumulus), `Syntra` (Cyber 3D grid), `Nebula` (Velvet purple beam), `Horizon` (Fluid contours), `Classic` (Neutral studio), and `Mono Matrix` (ASCII code stream).
   - In-memory wallpaper preloading and transparent legacy `localStorage` migration (`aura` ➔ `cobalt`).

6. **Top Global Navigation Header (`LoadLogicTopHeader.tsx`):**
   - Reclaims 100% of the canvas width by eliminating the persistent 260px vertical sidebar.
   - Cognito TOTP MFA operator switcher (`Carlos M.` vs `Ethan Miller`) with RBAC enforcement.
   - Compliance indicators verifying AWS PrivateLink Zero-Internet Egress and Bedrock Claude Haiku 4.5.
   - Omnibar search filter with real-time multi-attribute querying.
   - Operational audit ledger JSON exporter (`customer_inquiry_audit_*.json`).
   - Scenario injection modal with 1-click enterprise test cases (`Billing Dispute $1,450`, `P1 Outage Tech Support`, `Trustpilot 1-Star Review`).

---

## 4. Quickstart: Clone & Run (Zero-Touch Local Setup)

Follow these step-by-step instructions to clone, verify, and run both the Backend API and the Frontend Operations Console locally on any machine (Windows, macOS, or Linux).

### Prerequisites
- **Git:** 2.30+
- **Python:** 3.12+
- **Node.js:** 18.0+ (LTS recommended) and **npm**

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/ikerruiz1/customer-inquiry-manager.git
cd customer-inquiry-manager
```

---

### Step 2: 1-Click Automated Developer Environment Bootstrap (Recommended)

To guarantee zero workstation drift across any environment, the repository includes an automated onboarding bootstrap script. It validates your local toolchain, initializes the isolated `.venv`, installs 32 locked backend dependencies, verifies all 26 Pytest tests (Quality Gate in ~0.5s), and installs the frontend dependencies:

- **Windows (PowerShell):**
  ```powershell
  .\scripts\setup-dev.ps1
  ```
- **macOS / Linux (Bash):**
  ```bash
  chmod +x scripts/*.sh
  ./scripts/setup-dev.sh
  ```

> **Zero-Touch Tooling Integration:** The repository includes a standardized [`pyproject.toml`](pyproject.toml) (PEP 518 / PEP 621) declaring `[tool.pyright] venvPath = "."` and `venv = ".venv"`. Language servers (Pyright, Pyrefly, Pylance) and IDEs automatically bind to the project's virtual environment upon bootstrap with zero manual configuration or editor overrides.

---

### Step 3: Launch Local Services (Dual-Terminal Workflow)

Once the bootstrap script outputs `ENVIRONMENT SETUP COMPLETE! (0 Errors)`, launch the backend and frontend in two dedicated terminal tabs:

#### Terminal 1 — FastAPI Backend Service (Port 8000)
- **Windows (PowerShell):**
  ```powershell
  .\.venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
  ```
- **macOS / Linux (Bash):**
  ```bash
  ./.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
  ```

#### Terminal 2 — React Operations Console (Port 5173)
```bash
cd frontend
npm run dev
```

---

### Step 4: Accessing the Application & Verified Endpoints

Once both services are running, access the following endpoints:

| Service / Interface | Local URL | Description |
| :--- | :--- | :--- |
| **Operations Console (Frontend)** | [http://localhost:5173/](http://localhost:5173/) | Real-time triage console with Taskly hero visualizations, ITIL queue table, theme selector, and centered ticket inspection modal. |
| **Interactive API Documentation (Swagger)** | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) | OpenAPI interactive explorer for triage, claiming, overrides, and webhooks. |
| **ReDoc Technical Specification** | [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc) | Clean formal API documentation schema. |
| **Container Liveness Probe** | [http://127.0.0.1:8000/health/live](http://127.0.0.1:8000/health/live) | Kubernetes/ECS container orchestrator liveness probe. |
| **Container Readiness Probe** | [http://127.0.0.1:8000/health/ready](http://127.0.0.1:8000/health/ready) | Verifies database connectivity and readiness for traffic ingress. |

> **Resilient Dual-Mode Architecture:** If local AWS credentials or cloud RDS instances are not provisioned, the frontend client automatically detects backend connectivity and activates **resilient offline fallback**, populating the complete canonical enterprise dataset so all 20 business features (SLA tickers, sentiment analysis, NER entity copying, MLOps overrides) can be evaluated instantly with zero cloud dependencies.

---

### Step 5: Testing Personas & Role-Based Access Control (RBAC)

In the top navigation header of the frontend console, use the **Operator Switcher** to toggle between personas enforcing Cognito RFC 6238 TOTP MFA policies:
- **`Carlos M.` (`Tier1_Agents`):** Standard customer support engineer authorized to claim inquiries, compose response drafts, and resolve tickets.
- **`Ethan Miller` (`Operations_Managers`):** Support supervisor authorized to execute MLOps category overrides with mandatory engineering justification and inspect full audit ledgers.

---

## 5. Omnichannel Ingestion Simulator

You can inject realistic customer communications across all 5 inbound channels using the included test harness:

```bash
# Test all omnichannel scenarios (Email, Web Form, Trustpilot, Google Reviews, Billing)
python scripts/seed_inquiries.py --host http://127.0.0.1:8000 --scenario all

# Test specific scenarios
python scripts/seed_inquiries.py --scenario p1_outage       # Triggers P1 Critical SLA (1h)
python scripts/seed_inquiries.py --scenario churn_threat    # Triggers Churn Risk Escalation to P2 (4h)
python scripts/seed_inquiries.py --scenario billing_dispute # Triggers Stripe Chargeback Ingestion
```

---

## 6. Production Inbound Email Ingestion (Custom Domain & Amazon SES)

Customer Inquiry Manager features an authentic, enterprise-grade inbound email pipeline powered by **Amazon SES (Simple Email Service)** and modular Terraform infrastructure. No third-party middleware (e.g. Zapier, Pipedream) is used.

### Unified Infrastructure & Domain Deployment
To deploy the entire production stack (VPC, ECS, RDS, SES, and ECR containers) with your custom domain:

```bash
# Linux / macOS
chmod +x scripts/*.sh
./scripts/deploy-infra.sh

# Windows (PowerShell)
.\scripts\deploy-infra.ps1
```

> **How Domain Configuration Works for Cloners:**
> - The deployment script reads `domain` and `support_email` directly from `company_profile.json` (or copies from `company_profile.example.json` if initializing for the first time).
> - You can also customize `terraform/environments/dev/terraform.tfvars` (or copy from `terraform.tfvars.example`).
> - The script automatically provisions SES, outputs the exact DNS records to enter in your registrar, and restarts the ECS tasks.

### Registrar DNS Records Contract
Configure the following records in your DNS manager (e.g. `manage.get.tech`, Namecheap, Route 53):

| Record Type | Host / Name | Target / Points To | Priority / TTL | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **MX** | `@` | `inbound-smtp.eu-west-1.amazonaws.com` | `10` (TTL 300) | Routes all inbound SMTP traffic directly to Amazon SES |
| **TXT** (SPF) | `@` | `"v=spf1 include:amazonses.com ~all"` | TTL 300 | Authorizes Amazon SES mail servers |
| **TXT** (SES) | `_amazonses` | `<ses_domain_verification_token>` | TTL 300 | Proves domain ownership (from `terraform apply` output) |
| **CNAME** (x3) | `<token>._domainkey` | `<token>.dkim.amazonses.com` | TTL 300 | Easy DKIM signing tokens (from `terraform apply` output) |

### Automated Provisioning with Terraform
The SES inbound rule set, encrypted S3 storage, and DKIM tokens are provisioned automatically as part of `./scripts/deploy-infra.sh` / `.\scripts\deploy-infra.ps1` (or standalone via `cd terraform/environments/dev && terraform apply`):
1. Provisions the SES Domain Identity and DKIM tokens.
2. Creates the encrypted S3 storage bucket (`customer-inquiry-manager-ses-inbound-dev`) with `force_destroy = true` (0.00 € residual cost).
3. Creates and activates the inbound Receipt Rule Set for `support@<your-domain>`.
4. Outputs the exact DNS verification tokens in the console.

### End-to-End Live Verification
Send an email from your personal email client (e.g. Gmail mobile app) to `support@<your-domain>`. The email arrives natively at Amazon SES, is stored encrypted in S3, and is ingested into the platform for Bedrock Claude Haiku 4.5 triage in real time.

---

## 7. AWS Cloud Deployment & Teardown

### 1-Click Infrastructure Deployment
```bash
chmod +x scripts/*.sh
./scripts/deploy-infra.sh
```

### 1-Click Clean Teardown Guarantee (0.00 € Residual Cost)
```bash
./scripts/teardown-infra.sh
```

---

## 8. Security & Policy-as-Code Compliance

The CI/CD pipeline enforces automated security gates in AWS CodeBuild before any container image is pushed to ECR:
- **Pytest:** 100% unit and integration test pass rate across database claiming and auth flows.
- **Semgrep SAST:** Scans Python code for OWASP Top 10 vulnerabilities.
- **Conftest (OPA):** Enforces Open Policy Agent guardrails prohibiting NAT Gateways and unencrypted storage.
- **KICS (Checkmarx):** Scans Terraform HCL files for security misconfigurations.
- **Trivy Scanner:** Evaluates base image packages and application libraries for CVEs.
- **Syft SBOM:** Generates a Software Bill of Materials in SPDX format for supply chain security.
