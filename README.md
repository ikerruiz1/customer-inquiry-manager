# Customer Inquiry Manager (ExampleCorp CIM)
## Enterprise AI Customer Inquiry & Ticket Triage Platform

An enterprise-grade, cloud-native customer inquiry ingestion, AI triage, and Human-in-the-Loop (HITL) resolution platform built on **Amazon Web Services (AWS)** and modern DevOps/DevSecOps practices.

---

## 1. Architectural Highlights

- **Amazon Bedrock AI Triage (Single-Pass Inference):** Utilizes the **Converse API** with `eu.anthropic.claude-haiku-4-5-20251001-v1:0` to execute single-pass department classification across 6 authoritative business domains, urgency/impact rating, quantified sentiment extraction, churn risk detection, and company policy-grounded draft response generation.
- **Multi-Turn Conversation Threads & Bi-Directional Ingestion:** Complete customer inquiry lifecycle tracking with chronological message feeds (`InquiryMessage`), supporting external customer replies, operator responses, private co-pilot notes, and automated thread appending.
- **SLA Clock Freezing Engine (`PENDING_CUSTOMER`):** Automated SLA timer freezing when an operator requests additional customer information (`REQUEST_INFO`). Dynamically resumes the countdown and extends the resolution deadline (`sla_deadline_at`) upon customer reply ingestion.
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
│   │   ├── auth.py                   # Cognito login, registration & TOTP MFA verification
│   │   ├── inquiries.py              # Triage, priority queue, atomic claim, HITL resolve, messages & customer replies
│   │   ├── webhooks.py               # Inbound Email, Form, Trustpilot, Google Reviews, Billing
│   │   ├── attachments.py            # S3 presigned upload & download URLs
│   │   ├── metrics.py                # Operations KPIs, MTTR velocity, SLA compliance & operator directory
│   │   ├── router.py                 # Router aggregation
│   │   └── __init__.py               # Canonical API router export
│   ├── core/                         # Core Configurations & Security
│   │   ├── config.py                 # Pydantic Settings v2
│   │   ├── database.py               # SQLAlchemy 2.0 async engine & sessionmaker
│   │   ├── security.py               # Cognito RS256 JWKS & RBAC dependencies
│   │   ├── seeder.py                 # Canonical enterprise demo dataset initializer
│   │   └── telemetry.py              # AWS X-Ray SDK & CloudWatch EMF metrics
│   ├── models/                       # SQLAlchemy ORM Models
│   │   ├── inquiry.py                # Inquiry, InquiryMessage & AuditLog models with B-Tree and GIN indexes
│   │   └── __init__.py               # Clean model re-exports
│   ├── schemas/                      # Pydantic v2 Validation Schemas
│   │   ├── auth.py                   # Login & TOTP challenge schemas
│   │   ├── bedrock.py                # Strict Bedrock Converse extraction schema
│   │   ├── inquiry.py                # Inquiries, queues, messages & audit log schemas
│   │   ├── metrics.py                # Operational metrics & operator directory schemas
│   │   └── __init__.py               # Clean schema re-exports
│   ├── services/                     # AWS Service Adapters
│   │   ├── bedrock_service.py        # Amazon Bedrock Converse API client & Guardrails
│   │   ├── cognito_service.py        # Amazon Cognito TOTP authentication
│   │   ├── s3_service.py             # S3 presigned URL generation
│   │   ├── sns_service.py            # Outbound SNS customer receipts & Ops alerts
│   │   └── __init__.py               # Clean service re-exports
│   ├── health.py                     # Container /health/live and /health/ready probes
│   ├── main.py                       # FastAPI entrypoint, lifespan context & CORS
│   └── tests/                        # Automated Pytest Suite (34 Tests, 100% Pass Rate)
│       ├── conftest.py               # In-memory SQLite async engine & service mocks
│       ├── test_auth.py              # Cognito login & TOTP verification tests
│       ├── test_bedrock_schema.py    # Extraction bounds & Pydantic validation tests
│       ├── test_health.py            # Container health check probe tests
│       ├── test_inquiries.py         # ITIL SLA calculation, claiming, conversation threads & SLA pause/resume
│       ├── test_metrics.py           # Dashboard metrics & operator directory tests
│       └── test_webhooks.py          # HMAC-SHA256 & omnichannel ingestion tests
├── frontend/                         # Operations Console (React 19, TypeScript, Vite)
│   ├── src/                          # Application source code
│   │   ├── api/                      # Resilient Dual-Mode API client & canonical B2B datasets
│   │   ├── components/               # Taskly Hero Visualizations, Bento cards, LoadLogic Queue, Detail Drawer
│   │   ├── types/                    # Domain schemas (Inquiry, InquiryMessage, ITIL tiers, Themes)
│   │   ├── App.tsx                   # Main console root shell
│   │   └── main.tsx                  # Client entrypoint
│   ├── public/themes/                # GPU-accelerated wallpapers (Cobalt, Cloudscape, etc.)
│   └── package.json                  # Frontend dependencies
├── docs/                             # Authoritative Documentation & Decision Memory
│   ├── PROJECT_CONTEXT.md            # 3-Tier topology blueprint & 47 chronological flows
│   └── ARCHITECTURE_DECISIONS_AND_QA.md # Historical ledger of engineering debates & resolutions
├── company_profile.json              # Domain grounding document (ITIL matrix, business hours & refund policies)
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
   - **Metric Parameter Provenance:** Surfaces raw variables feeding the SLA Compliance and MTTR Velocity metrics (`In-Bounds / Total`, `Breached Count`, `Target Threshold >= 95.0%`, Bedrock P95 inference latency `~1.24s`, and FinOps unit economics `~0.00025 €/ticket`).
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
   - **Real-Time SLA Heartbeat:** Active 1000ms ticker recalculating seconds to deadline. Displays dynamic paused badges (`⏸ PAUSED`) when tickets are in `PENDING_CUSTOMER`.

4. **Expansive 2-Column Ticket Inspection Modal (`LoadLogicDetailDrawer.tsx`):**
   - Centered dialog operating at `min(1160px, 94vw)` with high-blur backdrop (`backdropFilter: blur(8px)`).
   - **Resolution Plane (Left):**
     - **Multi-Turn Conversation Timeline:** Chronological message feed displaying original customer inquiry, operator replies, and private co-pilot notes with distinct visual demarcations.
     - **SLA Clock Freeze Banner:** When ticket is in `PENDING_CUSTOMER`, displays an active amber alert banner showing the exact timestamp when the clock paused and instructions for resumption.
     - **Interactive Customer Reply Simulator:** Embedded testing widget enabling operators and QA engineers to simulate customer inbound responses with 1-click, triggering SLA clock resumption, deadline extension, and status updates directly in the UI.
     - **Action Dispatcher:** 3-mode action selector (`REPLY`, `REQUEST_INFO`, `INTERNAL_NOTE`) with 1-click execution.
   - **Intelligence & Governance Plane (Right):** Amazon Bedrock Claude Haiku 4.5 XAI rationale, inference latency, confidence scores, sentiment/churn hostility meters, supervisor MLOps classification overrides with mandatory justification (>= 10 chars), and immutable audit trail history (`AuditLog`).

5. **Hardware-Accelerated Ambient Theme Engine (`AmbientBackground.tsx` & `ThemeSelector.tsx`):**
   - Isolated in a fixed compositing layer (`transform: translateZ(0)`), guaranteeing zero-lag rendering without compositor repaints during queue interaction.
   - 7 production themes: `Cobalt` (Fluid wave layers), `Cloudscape` (Daylight cumulus), `Syntra` (Cyber 3D grid), `Nebula` (Velvet purple beam), `Horizon` (Fluid contours), `Classic` (Neutral studio), and `Mono Matrix` (ASCII code stream).

6. **Top Global Navigation Header (`LoadLogicTopHeader.tsx`):**
   - Reclaims 100% of the canvas width by eliminating the persistent 260px vertical sidebar.
   - Cognito TOTP MFA operator switcher (`Carlos M.` vs `Ethan Miller`) with RBAC enforcement.
   - Compliance indicators verifying AWS PrivateLink Zero-Internet Egress and Bedrock Claude Haiku 4.5.
   - Omnibar search filter with real-time multi-attribute querying.
   - Operational audit ledger JSON exporter (`customer_inquiry_audit_*.json`).
   - Scenario injection modal with 1-click enterprise test cases (`Billing Dispute $1,450`, `P1 Outage Tech Support`, `Trustpilot 1-Star Review`).

---

## 4. ITIL v4 SLA Calculation Engine & Temporal Mathematics

The platform implements a deterministic ITIL v4 Service Level Agreement (SLA) calculation and temporal lifecycle engine. Time limits are not arbitrary; they are derived from structured parameter extraction, evaluated against formal decision matrices, and governed by state machine pausing logic.

```
                  +--------------------------------------------------+
                  | Inbound Customer Inquiry (Omnichannel Ingestion) |
                  +--------------------------------------------------+
                                           |
                                           v
                  +--------------------------------------------------+
                  | Amazon Bedrock Converse API (Claude 3.5 Haiku)   |
                  | Zero-Temperature (0.0) In-Context Grounding      |
                  +--------------------------------------------------+
                                           |
                     +---------------------+---------------------+
                     |                     |                     |
                     v                     v                     v
              Urgency (1 to 5)      Impact (1 to 3)      Churn Risk (Bool)
                     |                     |                     |
                     +---------------------+---------------------+
                                           |
                                           v
                  +--------------------------------------------------+
                  | ITIL v4 Deterministic Priority Matrix Engine     |
                  +--------------------------------------------------+
                                           |
                    +----------------------+----------------------+
                    |                                             |
            Churn Risk = False                             Churn Risk = True
                    |                                             |
                    v                                             v
        P1 (1h Res / 15m FRT)                       If P3 or P4 -> Escalate to P2
        P2 (4h Res / 1h FRT)                         (4h Resolution / 1h FRT)
        P3 (12h Res / 4h FRT)                                     |
        P4 (24h Res / 8h FRT)                                     |
                    |                                             |
                    +----------------------+----------------------+
                                           |
                                           v
                  +--------------------------------------------------+
                  | Dynamic SLA Clock Lifecycle                      |
                  | - 24/7 Continuous: P1 and P2                     |
                  | - Business Hours (09:00 - 18:00): P3 and P4      |
                  | - Clock Freeze on REQUEST_INFO (PENDING_CUSTOMER)|
                  | - Clock Resume & Deadline Extension on Reply     |
                  +--------------------------------------------------+
```

### 4.1 Inbound AI Parameter Provenance & Bedrock Grounding

When an inquiry enters the system via webhook or email, `app/services/bedrock_service.py` calls the **Amazon Bedrock Converse API** (`eu.anthropic.claude-haiku-4-5-20251001-v1:0`).

#### Extraction Provenance:
- **Temperature: 0.0:** Eliminates non-deterministic variability, ensuring identical input payloads yield identical numeric ratings.
- **In-Context Grounding:** The model prompt incorporates `company_profile.json` as an authoritative ground truth, declaring department definitions, escalation protocols, and SLA contracts. No fine-tuning or training compute is executed, incurring zero training costs.
- **Structured Tool Schema:** Extraction is strictly enforced through `InquiryBedrockOutput` (`app/schemas/bedrock.py`):

| Extracted Parameter | Data Type | Range / Domain | Extraction Criteria & Semantic Meaning |
| :--- | :--- | :--- | :--- |
| `urgency_rating` | Integer | `1` to `5` | Evaluates business blockage, downtime severity, financial exposure, or hard customer deadlines. |
| `impact_rating` | Integer | `1` to `3` | Evaluates user blast radius: `1` (Single user / cosmetic), `2` (Department / multiple workflows disrupted), `3` (Enterprise-wide / core infrastructure down). |
| `sentiment_score` | Float | `-1.0` to `1.0` | Quantifies emotional hostility, frustration, neutrality, or satisfaction. |
| `churn_risk` | Boolean | `True` / `False` | Detects explicit cancellation threats, dispute filings, legal claims, or competitor migration declarations. |
| `suggested_department` | Enum (String) | 6 Business Domains | Categorizes inquiry into authorized operational departments. |
| `key_entities` | Key-Value Dict | Free-form Dict | Named Entity Recognition (NER) extracting structured artifacts: `order_id`, `invoice_id`, `monetary_amount`, `error_code`, `affected_product`. |
| `suggested_strategy` | Enum (String) | 4 Strategies | Recommended course of action: `DIRECT_RESOLUTION`, `CLARIFICATION_REQUEST`, `ESCALATION`, `EMPATHETIC_DEFUSING`. |
| `suggested_response` | String | Formatted Text | Generative draft response grounded directly in corporate policy. |
| `confidence_score` | Float | `0.0` to `1.0` | Model self-evaluated confidence in categorization. |

---

### 4.2 Deterministic ITIL v4 Priority Decision Matrix

Once parameters are extracted, the backend executes `calculate_sla()` in `app/api/v1/inquiries.py`. The classification is completely deterministic:

```python
if urgency >= 4 and impact >= 3:
    priority = "P1"  # Resolution: 1 hour,  FRT: 15 minutes
elif urgency >= 3 and impact >= 2:
    priority = "P2"  # Resolution: 4 hours, FRT: 60 minutes
elif urgency >= 2 and impact >= 1:
    priority = "P3"  # Resolution: 12 hours, FRT: 4 hours
else:
    priority = "P4"  # Resolution: 24 hours, FRT: 8 hours
```

#### Complete 15-Permutation Decision Table:

| Urgency (1-5) | Impact (1-3) | Base Priority | Resolution Target | First Response (FRT) | Calendar Type |
| :---: | :---: | :---: | :---: | :---: | :--- |
| **5** | **3** | **P1** | **1 Hour** | **15 Minutes** | 24/7/365 Continuous |
| **5** | **2** | **P2** | **4 Hours** | **60 Minutes** | 24/7/365 Continuous |
| **5** | **1** | **P3** | **12 Hours** | **4 Hours** | Business Hours (09:00 - 18:00) |
| **4** | **3** | **P1** | **1 Hour** | **15 Minutes** | 24/7/365 Continuous |
| **4** | **2** | **P2** | **4 Hours** | **60 Minutes** | 24/7/365 Continuous |
| **4** | **1** | **P3** | **12 Hours** | **4 Hours** | Business Hours (09:00 - 18:00) |
| **3** | **3** | **P2** | **4 Hours** | **60 Minutes** | 24/7/365 Continuous |
| **3** | **2** | **P2** | **4 Hours** | **60 Minutes** | 24/7/365 Continuous |
| **3** | **1** | **P3** | **12 Hours** | **4 Hours** | Business Hours (09:00 - 18:00) |
| **2** | **3** | **P3** | **12 Hours** | **4 Hours** | Business Hours (09:00 - 18:00) |
| **2** | **2** | **P3** | **12 Hours** | **4 Hours** | Business Hours (09:00 - 18:00) |
| **2** | **1** | **P3** | **12 Hours** | **4 Hours** | Business Hours (09:00 - 18:00) |
| **1** | **3** | **P4** | **24 Hours** | **8 Hours** | Business Hours (09:00 - 18:00) |
| **1** | **2** | **P4** | **24 Hours** | **8 Hours** | Business Hours (09:00 - 18:00) |
| **1** | **1** | **P4** | **24 Hours** | **8 Hours** | Business Hours (09:00 - 18:00) |

---

### 4.3 Dual-Clock SLA Architecture: FRT vs. MTTR

Enterprise customer contracts measure two distinct operational clocks:
1. **First Response Time (FRT):** The duration between ticket arrival (`created_at`) and the timestamp of the first outbound communication delivered by a support agent (`first_responded_at`). Automated bot receipts do not satisfy FRT.
2. **Mean Time to Resolution (MTTR / Resolution SLA):** The duration between ticket arrival and final resolution (`resolved_at`).

| Metric | Target Calculation | Stop Condition | Business Objective |
| :--- | :--- | :--- | :--- |
| **First Response Time (FRT)** | `created_at + frt_minutes` | Agent sends message (`action: REPLY` or `REQUEST_INFO`) | Confirms to the customer that an engineer has actively engaged with their problem. |
| **Resolution SLA** | `created_at + resolution_hours + total_paused_seconds` | Ticket marked `RESOLVED` | Restores full service operation or delivers completed inquiry response. |

---

### 4.4 Operating Calendars: 24/7 Continuous vs. Business Hours

Real-world operations differentiate between mission-critical incidents and non-critical requests:

- **24/7/365 Continuous Clock (P1 and P2):**
  - **Rationale:** Core infrastructure outages, active payment gateway failures, and enterprise churn threats impact revenue continuously. The SLA clock runs non-stop, including nights, weekends, and statutory holidays.
- **Business Hours Schedule (P3 and P4):**
  - **Rationale:** Routine inquiries (e.g. documentation questions, minor formatting anomalies, invoice copy requests) do not justify round-the-clock shift staffing. In real-world enterprise deployments, the SLA clock automatically pauses at 18:00 on Friday and resumes at 09:00 on Monday, ensuring agents are not penalized during off-shift hours.

---

### 4.5 Churn Risk Priority Escalation Guardrail

If a customer indicates intent to terminate their subscription, cancel their contract, or file a chargeback, the AI extractor flags `churn_risk = True`.

Even if the technical problem is minor (low urgency or low impact, which would normally evaluate to P3 or P4), the system automatically enforces an escalation guardrail:

```python
if churn_risk and priority in ["P3", "P4"]:
    priority = "P2"
    resolution_hours = 4
    frt_minutes = 60
```

- **Operational Effect:** A routine billing question that would normally take 12 or 24 hours is promoted to **P2 (4 Hours Resolution / 1 Hour FRT)**, forcing immediate retention triage by senior agents.

---

### 4.6 SLA Clock Freezing Mechanics (`PENDING_CUSTOMER`)

When a support engineer needs diagnostic logs, error screenshots, or confirmation from the customer before work can proceed, running the SLA clock unfairly penalizes the support organization for customer delays.

#### Lifecycle State Transitions:

```
[CLAIMED / UNASSIGNED]
         |
         | Operator dispatches message with action = REQUEST_INFO
         v
[PENDING_CUSTOMER]  <---- Clock Freezes (sla_paused_at = now())
         |
         | Customer replies via POST /api/v1/inquiries/{id}/customer-reply
         v
[CLAIMED / UNASSIGNED]  <---- Clock Resumes:
                              pause_delta = now() - sla_paused_at
                              sla_deadline_at = sla_deadline_at + pause_delta
                              total_paused_seconds += pause_delta
                              sla_paused_at = None
```

#### Mathematical Dynamic Deadline Extension:
1. **Clock Freeze Trigger:**
   - Agent triggers `action = REQUEST_INFO`.
   - `status = "PENDING_CUSTOMER"`.
   - `sla_paused_at = now()`.
   - Remaining SLA duration calculation while paused:
     `sla_remaining_seconds = max(0, int((sla_deadline_at - sla_paused_at).total_seconds()))`.
2. **Clock Resumption Trigger:**
   - Inbound reply arrives via `POST /api/v1/inquiries/{id}/customer-reply`.
   - Elapsed pause calculation:
     `pause_delta = max(0, int((now() - sla_paused_at).total_seconds()))`.
   - Dynamic deadline adjustment:
     `sla_deadline_at = sla_deadline_at + timedelta(seconds=pause_delta)`.
   - Accumulator update:
     `total_paused_seconds = total_paused_seconds + pause_delta`.
   - Status restoration:
     `sla_paused_at = None`, `status = "CLAIMED" if assigned_agent_id else "UNASSIGNED"`.

---

### 4.7 Concrete Real-World Combinations & Mathematical Progression Walkthroughs

#### Scenario A: Enterprise Production Outage (P1 Emergency)
- **Customer Inquiry:** *"Our core payment checkout cluster has been returning HTTP 500 across all EU regions for 12 minutes. Transactions are completely blocked."*
- **Bedrock Extraction:**
  - `urgency_rating`: `5` (Complete payment flow blockage, revenue loss)
  - `impact_rating`: `3` (Enterprise-wide EU customer base affected)
  - `sentiment_score`: `-0.82` (Severe distress)
  - `churn_risk`: `False`
- **Matrix Evaluation:**
  - `urgency (5) >= 4` AND `impact (3) >= 3` -> **Priority: P1**
- **Resulting Deadlines (Inquiry Arrived at 10:00:00 UTC):**
  - **First Response Target (FRT):** `10:15:00 UTC` (15 Minutes)
  - **Resolution Target (MTTR):** `11:00:00 UTC` (1 Hour)
  - **Calendar:** 24/7 Continuous (Zero pause)

---

#### Scenario B: Departmental Workflow Failure (P2 High)
- **Customer Inquiry:** *"The bulk CSV invoice export tool generates a syntax error for our 15 accounting team members. Month-end closing is delayed."*
- **Bedrock Extraction:**
  - `urgency_rating`: `4` (Operational delay, but core systems running)
  - `impact_rating`: `2` (Departmental blast radius: accounting department)
  - `sentiment_score`: `-0.45` (Frustrated)
  - `churn_risk`: `False`
- **Matrix Evaluation:**
  - `urgency (4) >= 3` AND `impact (2) >= 2` -> **Priority: P2**
- **Resulting Deadlines (Inquiry Arrived at 14:00:00 UTC):**
  - **First Response Target (FRT):** `15:00:00 UTC` (1 Hour)
  - **Resolution Target (MTTR):** `18:00:00 UTC` (4 Hours)
  - **Calendar:** 24/7 Continuous

---

#### Scenario C: Churn Risk Escalation (P2 Promotion from P3/P4)
- **Customer Inquiry:** *"I was billed $1,450 twice this morning. If this duplicate charge is not refunded immediately, I am canceling all 200 corporate seats and disputing the charges with American Express."*
- **Bedrock Extraction:**
  - `urgency_rating`: `2` (Standard billing correction, no infrastructure down)
  - `impact_rating`: `1` (Single corporate account)
  - `sentiment_score`: `-0.95` (Extremely hostile)
  - `churn_risk`: `True` (Explicit cancellation threat & legal chargeback)
- **Matrix Evaluation:**
  - Base Rule: `urgency (2) >= 2` AND `impact (1) >= 1` -> Base Priority: `P3` (12 Hours)
  - Escalation Guardrail: `churn_risk == True` AND `priority in ["P3", "P4"]` -> **Escalated Priority: P2**
- **Resulting Deadlines (Inquiry Arrived at 09:30:00 UTC):**
  - **First Response Target (FRT):** `10:30:00 UTC` (1 Hour, promoted from 4 Hours)
  - **Resolution Target (MTTR):** `13:30:00 UTC` (4 Hours, promoted from 12 Hours)
  - **Calendar:** Promoted to 24/7 Continuous

---

#### Scenario D: Low Priority with Clock Pausing (`PENDING_CUSTOMER`)
- **Customer Inquiry:** *"Could you send me an updated copy of the W-9 tax form for our vendor file?"*
- **Inquiry Arrival:** `Monday 09:00:00 UTC`.
- **Bedrock Extraction:** `urgency = 1`, `impact = 1`, `churn_risk = False` -> **Priority: P4**.
- **Initial Deadlines:**
  - FRT: `17:00:00 UTC` (8 Hours)
  - Initial Resolution Deadline: `Tuesday 09:00:00 UTC` (24 Hours)
- **Clock Freeze Execution:**
  - At `10:00:00 UTC` (1 hour after arrival), agent claims ticket and sends message requesting customer company tax ID (`action: REQUEST_INFO`).
  - Status changes to `PENDING_CUSTOMER`.
  - `sla_paused_at = Monday 10:00:00 UTC`.
  - Remaining SLA time at pause: `23 Hours`.
- **Customer Response Resumption:**
  - Customer provides their tax ID on `Monday 14:00:00 UTC` (4 hours later).
  - Elapsed pause: `pause_delta = 14:00:00 - 10:00:00 = 4 Hours (14,400 seconds)`.
  - Dynamic deadline shift:
    `new_deadline = Tuesday 09:00:00 UTC + 4 Hours = Tuesday 13:00:00 UTC`.
  - Remaining SLA time: Exactly `23 Hours` remaining from `Monday 14:00:00 UTC`.
  - Support team is penalized 0 seconds for the 4-hour customer delay.

---

## 5. Quickstart: Clone & Run (Zero-Touch Local Setup)

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

To guarantee zero workstation drift across any environment, the repository includes an automated onboarding bootstrap script. It validates your local toolchain, initializes the isolated `.venv`, installs 32 locked backend dependencies, verifies all 34 Pytest tests (Quality Gate in ~1.0s), and installs the frontend dependencies:

- **Windows (PowerShell):**
  ```powershell
  .\scripts\setup-dev.ps1
  ```
- **macOS / Linux (Bash):**
  ```bash
  chmod +x scripts/*.sh
  ./scripts/setup-dev.sh
  ```

> **Zero-Touch Tooling Integration:** The repository includes a standardized [`pyproject.toml`](pyproject.toml) (PEP 518 / PEP 621) declaring `[tool.pyright] venvPath = "."` and `venv = ".venv"`. Language servers (Pyright, Pyrefly, Pylance) and IDEs automatically bind to the project's virtual virtual environment upon bootstrap with zero manual configuration or editor overrides.

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
| **Operations Console (Frontend)** | [http://localhost:5173/](http://localhost:5173/) | Real-time triage console with Taskly hero visualizations, ITIL queue table, theme selector, conversation thread timeline, and SLA paused state banners. |
| **Interactive API Documentation (Swagger)** | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) | OpenAPI interactive explorer for triage, claiming, overrides, messages, customer replies, and webhooks. |
| **ReDoc Technical Specification** | [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc) | Clean formal API documentation schema. |
| **Container Liveness Probe** | [http://127.0.0.1:8000/health/live](http://127.0.0.1:8000/health/live) | Kubernetes/ECS container orchestrator liveness probe. |
| **Container Readiness Probe** | [http://127.0.0.1:8000/health/ready](http://127.0.0.1:8000/health/ready) | Verifies database connectivity and readiness for traffic ingress. |

> **Resilient Dual-Mode Architecture:** If local AWS credentials or cloud RDS instances are not provisioned, the frontend client automatically detects backend connectivity and activates **resilient offline fallback**, populating the complete canonical enterprise dataset so all 20 business features (SLA tickers, sentiment analysis, NER entity copying, conversation threads, customer replies, MLOps overrides) can be evaluated instantly with zero cloud dependencies.

---

### Step 5: Testing Personas & Role-Based Access Control (RBAC)

In the top navigation header of the frontend console, use the **Operator Switcher** to toggle between personas enforcing Cognito RFC 6238 TOTP MFA policies:
- **`Carlos M.` (`Tier1_Agents`):** Standard customer support engineer authorized to claim inquiries, dispatch customer messages, request information (pausing SLA), and resolve tickets.
- **`Ethan Miller` (`Operations_Managers`):** Support supervisor authorized to execute MLOps category overrides with mandatory engineering justification and inspect full audit ledgers.

---

## 6. Omnichannel Ingestion Simulator

You can inject realistic customer communications across all 5 inbound channels using the included test harness:

```bash
# Test all omnichannel scenarios (Email, Web Form, Trustpilot, Google Reviews, Billing)
python scripts/seed_inquiries.py --host http://127.0.0.1:8000 --scenario all

# Test specific scenarios
python scripts/seed_inquiries.py --scenario p1_outage       # Triggers P1 Critical SLA (1h MTTR, 15m FRT)
python scripts/seed_inquiries.py --scenario churn_threat    # Triggers Churn Risk Escalation to P2 (4h MTTR, 1h FRT)
python scripts/seed_inquiries.py --scenario billing_dispute # Triggers Stripe Chargeback Ingestion
```

---

## 7. Production Inbound Email Ingestion (Custom Domain & Amazon SES)

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

## 8. AWS Cloud Deployment & Teardown

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

## 9. Security & Policy-as-Code Compliance

The CI/CD pipeline enforces automated security gates in AWS CodeBuild before any container image is pushed to ECR:
- **Pytest:** 100% unit and integration test pass rate (34 automated tests) across database claiming, conversation threads, SLA pause/resume, and auth flows.
- **Semgrep SAST:** Scans Python code for OWASP Top 10 vulnerabilities.
- **Conftest (OPA):** Enforces Open Policy Agent guardrails prohibiting NAT Gateways and unencrypted storage.
- **KICS (Checkmarx):** Scans Terraform HCL files for security misconfigurations.
- **Trivy Scanner:** Evaluates base image packages and application libraries for CVEs.
- **Syft SBOM:** Generates a Software Bill of Materials in SPDX format for supply chain security.
