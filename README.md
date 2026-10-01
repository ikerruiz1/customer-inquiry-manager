# Customer Inquiry Manager

Customer inquiry ingestion, AI triage and human-in-the-loop ticket resolution on AWS. FastAPI backend, React operations console, ECS Fargate, RDS PostgreSQL, Bedrock.

## Architecture

### Light Mode
![Customer Inquiry Manager Architecture - Light Mode](assets/architecture-diagram-light.svg)

### Dark Mode
![Customer Inquiry Manager Architecture - Dark Mode](assets/architecture-diagram-dark.svg)

The full 48-flow execution map is documented in [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md).

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

## Local development

Requires Python 3.12, Node.js 20+, AWS CLI v2 and Terraform 1.5+. Docker is optional and only needed for local image builds; the cloud pipeline builds without it.

```bash
git clone https://github.com/ikerruiz1/customer-inquiry-manager.git
cd customer-inquiry-manager

# Windows
.\scripts\setup-dev.ps1
# Linux / macOS
./scripts/setup-dev.sh
```

The setup script creates the virtualenv, installs dependencies, writes `company_profile.json` from the template, generates the local administrator, runs the test suite and installs frontend packages. Administrator credentials and the TOTP seed are printed to the terminal.

Run the two services:

```bash
# backend :8000
.\.venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# frontend :5173
cd frontend && npm run dev
```

Generate sample traffic:

```bash
python scripts/seed_inquiries.py --scenario all
```

Run tests:

```bash
pytest app/tests -q
```

Local mode uses SQLite and mock AWS adapters, so it needs no credentials and costs nothing.

## Deploy to AWS

```bash
# 1. DNS pre-flight: provisions the Route 53 zone and prints the 4 nameservers
.\scripts\deploy-infra.ps1 -DnsOnly        # ./scripts/deploy-infra.sh --dns-only

# 2. Delegate those nameservers at your registrar, then verify
Resolve-DnsName -Name "your-company.tech" -Type NS -Server 8.8.8.8

# 3. Full deployment
.\scripts\deploy-infra.ps1                 # ./scripts/deploy-infra.sh
```

The deployment applies the 13 Terraform modules, packages the source into `source.zip`, uploads it to S3 and triggers CodePipeline. CodeBuild runs the quality gates, builds the image and pushes to ECR, then CodePipeline performs the ECS rolling update.

ACM and SES both validate DNS records, so the pre-flight step must complete before step 3 or certificate issuance will time out.

Open the printed ALB URL, sign in, rotate the temporary password and enroll TOTP MFA.

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

## Documentation

- [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) — topology blueprint and the 48-flow execution map.
- [docs/ARCHITECTURE_DECISIONS_AND_QA.md](docs/ARCHITECTURE_DECISIONS_AND_QA.md) — engineering decision ledger.

## License

MIT. See [LICENSE](LICENSE).
