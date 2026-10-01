# Customer Inquiry Manager

Customer inquiry ingestion, AI triage and human-in-the-loop ticket resolution on AWS. FastAPI backend, React operations console, ECS Fargate, RDS PostgreSQL, Bedrock.

## Architecture

### Light Mode
![Customer Inquiry Manager Architecture - Light Mode](assets/architecture-diagram-light.svg)

### Dark Mode
![Customer Inquiry Manager Architecture - Dark Mode](assets/architecture-diagram-dark.svg)

The full 48-flow execution map lives in `docs/PROJECT_CONTEXT.md`.

## What it does

- Ingests inquiries by email (SES MX + IMAP poller), web form, Trustpilot and billing webhooks.
- Enqueues every webhook into `inquiries.fifo` (SQS FIFO) and returns `202 Accepted`, so no request waits on the LLM.
- Extracts urgency, impact, sentiment, churn risk, department and entities in a single Bedrock `Converse` call, temperature 0.
- Assigns a deterministic ITIL v4 priority (P1–P4) and computes FRT and resolution deadlines.
- Freezes the SLA clock when an operator requests more information and resumes it on customer reply.
- Drafts operator replies (`REPLY`, `REQUEST_INFO`, `INTERNAL_NOTE`) grounded in `company_profile.json`.
- Sends customer email via SES, operator alerts via SNS and Slack.
- Runs on Fargate Spot behind an ALB with no NAT Gateways, reaching AWS only through PrivateLink.

## Stack

| Layer | Technology |
| :--- | :--- |
| Backend | FastAPI, SQLAlchemy 2.0 async, Pydantic v2, Python 3.12 |
| Frontend | React 19, TypeScript (strict), Vite, vanilla CSS custom properties |
| Compute | ECS Fargate Spot, dual container (`app` + `aws-xray-daemon`) |
| Database | RDS PostgreSQL 16.10 (`db.t4g.micro`, 20 GB gp3), SQLAlchemy async |
| AI | Bedrock Converse API, `eu.anthropic.claude-haiku-4-5-20251001-v1:0` |
| Messaging | SQS FIFO + DLQ, SNS, SES (inbound MX and outbound) |
| Identity | Cognito User Pool, TOTP MFA (RFC 6238), RBAC (`Tier1_Agents`, `Operations_Managers`) |
| Network | 3-tier VPC, 10 Interface VPC Endpoints, 1 S3 Gateway Endpoint, no NAT |
| CI/CD | CodePipeline, CodeBuild, ECS rolling deploy, Conftest, KICS, Semgrep, Trivy, Syft |

## Repository structure

```text
customer-inquiry-manager/
├── app/
│   ├── api/v1/                  # endpoints: auth, inquiries, operations, webhooks,
│   │                            # attachments, metrics, router
│   ├── core/                    # config, database, security, seeder, telemetry
│   ├── models/inquiry.py        # Inquiry, InquiryMessage, AuditLog
│   ├── schemas/                 # auth, bedrock, inquiry, metrics
│   ├── services/                # bedrock, cognito, email, email_filter, email_thread,
│   │                            # inbound_email_poller, s3, sns, sqs_consumer, sqs_service,
│   │                            # sla_breach_watcher
│   ├── tests/                   # 87 pytest tests
│   ├── health.py                # /health/live and /health/ready
│   └── main.py                  # FastAPI entrypoint
├── frontend/
│   ├── src/components/          # LoadLogic queue, detail drawer, top header, widget grid,
│   │                            # Taskly hero gauges, ambient background, theme selector,
│   │                            # auth, invite, new inquiry, override modals
│   ├── src/api/client.ts        # dual-mode API client
│   ├── src/types/               # inquiry.ts, theme.ts
│   ├── public/themes/           # 9 background themes
│   └── package.json
├── terraform/
│   ├── environments/dev/        # root composition
│   ├── modules/                 # alb, cicd, cognito, ecs, iam, monitoring, rds,
│   │                            # route53, s3, security_groups, ses, sqs, vpc (13)
│   └── policy/                  # 6 Conftest Rego policies (no NAT, private DB, S3, IAM, ingress, container)
├── scripts/                     # setup-dev, deploy-infra, teardown-infra (.ps1/.sh),
│                                # package_source, provision_operator, seed_inquiries,
│                                # k6-load-test, test_concurrency_race, test_fargate_performance
├── docs/                        # PROJECT_CONTEXT.md, ARCHITECTURE_DECISIONS_AND_QA.md
├── assets/                      # architecture-diagram-light.svg, architecture-diagram-dark.svg
├── company_profile.example.json # policy template: departments, hours, refunds
├── buildspec.yml                # CodeBuild quality gate pipeline
├── Dockerfile                   # python:3.12-slim, non-root appuser
├── requirements.txt
├── pyproject.toml
└── LICENSE
```

## Getting started

### 1. Prerequisites

Python 3.12, Node.js 20+, npm, AWS CLI v2 and Terraform 1.5+. Docker is optional and only used for local image builds; the cloud pipeline builds without a local daemon.

### 2. Clone

```bash
git clone https://github.com/ikerruiz1/customer-inquiry-manager.git
cd customer-inquiry-manager
```

### 3. Configure `company_profile.json`

This file is the single source of truth for the AI triage behaviour and for your public identity. `setup-dev` and `deploy-infra` both copy it from `company_profile.example.json` if it is missing, so edit it **before** you deploy.

```bash
cp company_profile.example.json company_profile.json
```

Fields you must change:

| Field | Purpose |
| :--- | :--- |
| `company_name` | Displayed in the console and in customer emails. |
| `domain` | Your apex domain. Read by `deploy-infra` to derive the support address and to sync `terraform.tfvars`. |
| `support_email` | The address customers write to. Must match the SES-verified identity. |
| `admin_name`, `admin_email` | The bootstrap administrator. `setup-dev` prompts for these and prints the password. |
| `sla_proactive_warning_minutes` | How early the SLA watcher alerts before a deadline. |
| `slack_webhook_url` | Leave empty to disable ChatOps. |
| `slack_notification_policy` | `CRITICAL_AND_SLA_ONLY` or `ALL_INQUIRIES`. Any other value is ignored and the default applies. |
| `inbound_channels.email` | Where SES should receive mail. |
| `customer_access_policy` | Whether unregistered senders are accepted or quarantined. |

The remaining blocks drive the model rather than the infrastructure, and are worth tuning if your support operation differs from the defaults:

- `departments` — the six routing targets Bedrock can classify into. `precedence_rank` breaks ties, so financial disputes land in `BILLING` (rank 1) even when caused by a technical fault.
- `precedence_rules` — natural-language overrides injected into the prompt.
- `itil_sla_matrix_hours` — resolution targets per priority. The urgency and impact thresholds are fixed in code; only the hour targets are configurable.
- `refund_and_dispute_policy` — the source the model cites when answering billing questions.
- `churn_escalation_triggers` — conditions that promote a ticket to P2.

Leaving the template untouched means the console is branded `Example Enterprises Inc.`, inbound mail arrives at `support@your-company-domain.tech`, and SES will reject outbound replies because no identity is verified for that domain.

### 4. Run locally

```bash
# Windows
.\scripts\setup-dev.ps1
# Linux / macOS
./scripts/setup-dev.sh
```

This creates the virtualenv, installs dependencies, generates the local administrator, runs the test suite and installs frontend packages. It asks for the admin name and username prefix, then prints the credentials.

Start the two services in separate terminals:

```bash
# backend :8000
.\.venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
# frontend :5173 (proxies /api to the backend)
cd frontend && npm run dev
```

Optional:

```bash
python scripts/seed_inquiries.py --scenario all   # sample tickets
pytest app/tests -q                                # 87 tests
```

Local mode uses SQLite and mock AWS adapters, so it needs no AWS credentials and costs nothing.

## Accessing the console

The console is the React frontend. In local development it is served by Vite on port 5173; in the cloud it is served by the ALB at the URL printed by `deploy-infra`.

**Sign in.** The form requires an operator email and password, then a 6-digit TOTP code.

Local mode uses the SQLite operator registry and the fixed development seed:

| | |
| :--- | :--- |
| Email | whatever you entered at the `setup-dev` prompt |
| Password | printed by `setup-dev` |
| TOTP seed | `JBSWY3DPEHPK3PXP` |

Enter the seed in Google Authenticator, 1Password or Authy, then type the 6-digit code it shows.

Cloud mode uses Cognito. `deploy-infra` provisions the break-glass administrator in the user pool and stores a temporary password in Secrets Manager at `customer-inquiry-manager/dev/operator-credentials`. First login forces password rotation, then TOTP enrollment against an on-screen QR code.

**Roles.** Two exist, and the difference is enforced server-side:

- `Operations_Manager` — full access, including inviting operators and overriding AI classifications.
- `Tier1_Agent` — works the queue: claim, draft, reply, request info, resolve.

**Adding operators.** As a manager, use *Invite Support Operator* in the top header and the console returns a single-use temporary password to hand over out of band. From the CLI:

```bash
python scripts/provision_operator.py --name "Name" --email "user@domain" --role Tier1_Agent
```

Accepted roles are `Operations_Manager` and `Tier1_Agent`. In cloud mode this maps to the Cognito groups `Operations_Managers` and `Tier1_Agents`.

## Deploy to AWS

```bash
# 1. DNS pre-flight: provisions the Route 53 zone and prints the 4 nameservers
.\scripts\deploy-infra.ps1 -DnsOnly        # ./scripts/deploy-infra.sh --dns-only

# 2. Delegate those nameservers at your registrar, then verify
Resolve-DnsName -Name "your-company.tech" -Type NS -Server 8.8.8.8

# 3. Full deployment
.\scripts\deploy-infra.ps1                 # ./scripts/deploy-infra.sh
```

The deployment reads `company_profile.json` for the domain and support address, so edit that file before running this step. It applies the 13 Terraform modules, packages the source into `source.zip`, uploads it to S3 and triggers CodePipeline. CodeBuild runs the quality gates, builds the image and pushes to ECR, then CodePipeline performs the ECS rolling update.

ACM and SES both validate DNS records, so the pre-flight step must complete before the full deploy or certificate issuance will time out.

## Teardown

```bash
.\scripts\teardown-infra.ps1               # ./scripts/teardown-infra.sh
```

The script empties S3 buckets and ECR repositories, drains running tasks and destroys the stack in dependency order. Teardown leaves no billable residue: no NAT gateways, no EC2, no ECR, no RDS, no S3, no Cognito, no Lambda, and an empty Terraform state.

Verify:

```bash
aws ecr describe-repositories --region eu-west-1 --query "repositories[?starts_with(repositoryName,'customer-inquiry-manager')].repositoryName"
aws ec2 describe-vpcs --filters "Name=tag:Project,Values=customer-inquiry-manager" --region eu-west-1 --query "Vpcs[].VpcId"
aws ec2 describe-nat-gateways --region eu-west-1 --query "NatGateways[].NatGatewayId"
aws s3api list-buckets --region eu-west-1 --query "Buckets[?starts_with(Name,'customer-inquiry-manager')].Name"
aws rds describe-db-instances --region eu-west-1 --query "DBInstances[?contains(DBInstanceIdentifier,'customer-inquiry')].DBInstanceIdentifier"
terraform -chdir=terraform/environments/dev state list
```

## SLA engine

Priority is deterministic, with no model involvement in the decision:

```python
if urgency >= 4 and impact >= 3:
    priority = "P1"          # resolution 1h,  FRT 15m
elif urgency >= 3 and impact >= 2:
    priority = "P2"          # resolution 4h,  FRT 60m
elif urgency >= 2 and impact >= 1:
    priority = "P3"          # resolution 12h, FRT 4h
else:
    priority = "P4"          # resolution 24h, FRT 8h

if churn_risk and priority in ["P3", "P4"]:
    priority = "P2"          # retention guardrail
```

P1 and P2 run on a 24/7 calendar. P3 and P4 follow business hours.

**Clock freezing.** When an operator sends `REQUEST_INFO` the ticket moves to `PENDING_CUSTOMER` and `sla_paused_at` is set. On customer reply:

```python
pause_delta = max(0, int((now() - inquiry.sla_paused_at).total_seconds()))
inquiry.sla_deadline_at += timedelta(seconds=pause_delta)
inquiry.total_paused_seconds += pause_delta
inquiry.sla_paused_at = None
```

The deadline shifts by the pause duration, so time spent waiting on the customer is never charged against the support team.

Bedrock extraction is validated by the `InquiryBedrockOutput` schema in `app/schemas/bedrock.py`: `urgency_rating` (1–5), `impact_rating` (1–3), `sentiment_score` (−1.0–1.0), `churn_risk`, `suggested_department`, `suggested_strategy`, `key_entities`, `suggested_response` and `confidence_score`.

## Omnichannel ingestion

| Source | Endpoint | Verification |
| :--- | :--- | :--- |
| Email | SES MX inbound, IMAP poller, `POST /api/v1/webhooks/email` | SPF, DKIM, DMARC |
| Web form | `POST /api/v1/webhooks/webform` | CORS origin validation |
| Trustpilot | `POST /api/v1/webhooks/trustpilot` | HMAC-SHA256 in `X-Trustpilot-Signature` |
| Google Reviews | `POST /api/v1/webhooks/google-reviews` | `X-Google-Webhook-Secret` |
| Billing | `POST /api/v1/webhooks/billing` | Stripe signature |

Email threads correlate on the `[Ticket #<ID>]` tag in the subject. A customer reply unfreezes the clock and extends the deadline.

## CI/CD

```text
source.zip -> S3 -> CodePipeline -> CodeBuild (Pytest, Semgrep, Conftest,
KICS, Trivy, Syft, Docker build, ECR push) -> ECS rolling deploy
```

Local Docker builds are deliberately avoided so image architecture always matches the runtime. `scripts/package_source.py` produces a ~5 MB archive excluding `.venv`, `node_modules` and `.terraform`. Rolling updates use `minimum_healthy_percent = 100` with ALB health verification and automatic rollback on failure.

The 6 Rego policies in `terraform/policy/` fail the build on NAT Gateways, unrestricted ingress, non-private database subnets, unencrypted S3, over-permissive IAM and weak container security.

## Operations console

React 19 + TypeScript strict, no UI framework. Draggable KPI widgets persisted to `localStorage`, an ITIL queue sorted by breach, priority, churn risk, deadline and arrival time, a two-pane ticket drawer with conversation history and AI drafts, and eight selectable background themes.

## FAQ

**Why deploy DNS before infrastructure?**
ACM and SES validate records through DNS. Running the pre-flight first gives the hosted zone time to propagate and avoids certificate timeouts.

**Inbound email works but outbound does not.**
New SES accounts start in the sandbox, where you can only send to verified addresses. Request production access in the SES console.

**Why are operators in Cognito instead of mailboxes?**
Agents authenticate against Cognito with TOTP MFA; customer mail is handled by SES at the DNS level. You do not need a paid mailbox seat per agent, and you avoid MX conflicts with registrar mailbox upsells.

**Do I need an AWS account to try it?**
No. `setup-dev.ps1` gives you SQLite, mock adapters and the full console locally with no credentials.

**Images fail to pull with `CannotPullContainerError`.**
PrivateLink only proxies registries inside the account. Third-party sidecar images such as `public.ecr.aws/xray/aws-xray-daemon` must be mirrored into a private ECR repository. ECR also serves layers from S3, so the ECS security group needs an egress rule on port 443 to the S3 prefix list.

## Commands

| Action | PowerShell | Bash |
| :--- | :--- | :--- |
| Local setup | `.\scripts\setup-dev.ps1` | `./scripts/setup-dev.sh` |
| DNS only | `.\scripts\deploy-infra.ps1 -DnsOnly` | `./scripts/deploy-infra.sh --dns-only` |
| Deploy | `.\scripts\deploy-infra.ps1` | `./scripts/deploy-infra.sh` |
| Teardown | `.\scripts\teardown-infra.ps1` | `./scripts/teardown-infra.sh` |
| Add operator | `python scripts/provision_operator.py --name "Name" --email "user@domain" --role Tier1_Agent` | same |
| Backend | `.\.venv\Scripts\uvicorn app.main:app --reload` | `./.venv/bin/uvicorn app.main:app --reload` |
| Frontend | `cd frontend && npm run dev` | same |
| Seed data | `python scripts/seed_inquiries.py --scenario all` | same |
| Edit policy | open `company_profile.json` | same |

## License

MIT. See [LICENSE](LICENSE).
