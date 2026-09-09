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
│   ├── seed_inquiries.py             # Omnichannel inbound traffic generator
│   ├── k6-load-test.js               # Load and auto-scaling validation script
│   ├── deploy-infra.sh               # 1-Click deployment bootstrap
│   └── teardown-infra.sh             # 1-Click clean teardown (0.00 € residual cost)
├── requirements.txt                  # Locked Python dependencies
├── LICENSE
└── AGENTS.md                         # Persistent workspace rules & directives
```

---

## 3. Quickstart & Local Execution

### Local Python Environment Setup
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the automated Pytest test suite (26 passing tests)
pytest app/tests/ -v

# 3. Start the FastAPI application locally
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Accessing the API & Documentation
Once running, open your browser:
- **Service Metadata (Root):** [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Interactive OpenAPI Documentation:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc Technical Specification:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **Container Liveness Probe:** [http://127.0.0.1:8000/health/live](http://127.0.0.1:8000/health/live)
- **Container Readiness Probe:** [http://127.0.0.1:8000/health/ready](http://127.0.0.1:8000/health/ready)

---

## 4. Omnichannel Ingestion Simulator

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

## 5. AWS Cloud Deployment & Teardown

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

## 6. Security & Policy-as-Code Compliance

The CI/CD pipeline enforces automated security gates in AWS CodeBuild before any container image is pushed to ECR:
- **Pytest:** 100% unit and integration test pass rate across database claiming and auth flows.
- **Semgrep SAST:** Scans Python code for OWASP Top 10 vulnerabilities.
- **Conftest (OPA):** Enforces Open Policy Agent guardrails prohibiting NAT Gateways and unencrypted storage.
- **KICS (Checkmarx):** Scans Terraform HCL files for security misconfigurations.
- **Trivy Scanner:** Evaluates base image packages and application libraries for CVEs.
- **Syft SBOM:** Generates a Software Bill of Materials in SPDX format for supply chain security.
