# MASTER CONTEXT & ARCHITECTURAL SPECIFICATION
## Project: Customer Inquiry Manager (Enterprise AI Customer Inquiry & Ticket Triage Platform)

---

### 1. Purpose & Portfolio Strategy

> **Architectural Ledger & Q&A Memory:** For the exhaustive chronological ledger of design debates, technical inquiries, and architectural justifications, refer to [ARCHITECTURE_DECISIONS_AND_QA.md](file:///c:/Dev/Cloud/customer-inquiry-manager/customer-inquiry-manager/ARCHITECTURE_DECISIONS_AND_QA.md).

- **Objective:** Architect, deploy, and operate an enterprise-grade customer inquiry ingestion, AI-powered intelligent triage, and automated SLA calculation platform on AWS.
- **Positioning:** Project 3 of 5 within the Cloud, DevOps, and SRE Professional Portfolio:
  - *Project 1 (AI Inventory Tracker):* EKS, Go, DynamoDB Streams, ArgoCD GitOps, GitLab CI. (Demonstrates CNCF standards, multi-tenant Kubernetes platform engineering, and declarative GitOps reconciliation).
  - *Project 2 (Automated Backup System):* AWS Backup Vault Lock (WORM compliance), RDS, S3, EventBridge, GitHub Actions. (Demonstrates automated disaster recovery, compliance auditing, and event-driven serverless maintenance).
  - *Project 3 (Customer Inquiry Manager):* ECS Fargate Spot, RDS PostgreSQL, Amazon Bedrock (Converse API), Amazon Cognito (Enforced TOTP MFA & RBAC), S3 Multi-Tier Lifecycle, AWS PrivateLink (Zero-Internet Egress), AWS X-Ray, CloudWatch SLI/SLO, AWS CodePipeline/CodeBuild/CodeDeploy, and Modular Terraform. (Demonstrates serverless container orchestration, strict network isolation, generative AI engineering, and FinOps lifecycle optimization).

---

### 2. Architectural Decisions & Technical Rationales (Interview Defenses)

#### A. Compute Orchestration: Why AWS ECS Fargate Spot over Amazon EKS?
1. **Avoiding Kubernetes Monoculture in the Portfolio:**
   - Presenting Kubernetes across all portfolio projects signals a "one-trick pony" anti-pattern where a candidate forces Kubernetes onto workloads regardless of business fit.
   - Project 1 proves deep expertise in CNCF Kubernetes, Helm, and ArgoCD. Project 3 demonstrates mastery over AWS-native serverless containers (ECS Fargate), which represent 70–80% of microservice architectures in AWS production environments.
2. **Total Cost of Ownership (TCO) & FinOps:**
   - Amazon EKS incurs a fixed control plane fee of **~$73/month** (`$0.10/hour`) plus dedicated EC2 worker node baseline compute (~$60/month), totaling >$130/month in fixed idle costs.
   - Amazon ECS provides a **100% free control plane** ($0.00/month). Cómputo is billed strictly per vCPU/RAM second consumed.
   - Leveraging **FARGATE_SPOT** (`capacity_provider_strategy`) provides a **70% discount** over standard on-demand compute, reducing test and staging environments to single-digit monthly costs.
3. **Operational Overhead & SRE Maintenance:**
   - EKS mandates version upgrades every 4 months (e.g., v1.28 → v1.29 → v1.30) with mandatory API deprecation audits, add-on patching (`vpc-cni`, `coredns`, `kube-proxy`), and Linux AMI vulnerability management.
   - ECS Fargate offloads all underlying hypervisor patching, Linux kernel CVE mitigation, and hardware maintenance to AWS. Blue/Green deployments are natively orchestrated via AWS CodeDeploy with zero controller overhead.
4. **Native AWS Service Integration:**
   - ECS Fargate tasks assume IAM Task Roles and Task Execution Roles natively at the hypervisor level without requiring external OIDC providers, mutating webhooks, or complex IRSA/Pod Identity controllers.

#### B. Telemetry & Observability: Why the Sidecar Pattern for AWS X-Ray?
1. **The Shared Namespace Mechanism:**
   - In ECS Fargate, a Task is an atomic unit running inside an isolated Firecracker MicroVM. All containers in the task definition share the same **Network Namespace (`netns`)** and loopback interface (`127.0.0.1`).
2. **Eliminating Synchronous Latency in FastAPI:**
   - Calling the AWS X-Ray API (`PutTraceSegments`) directly over HTTPS/TLS from FastAPI worker threads would introduce 15–40 ms of synchronous latency per request due to TLS handshakes, JSON serialization, and SigV4 cryptographic request signing.
   - With the sidecar container (`public.ecr.aws/xray/aws-xray-daemon:latest`), FastAPI emits asynchronous **UDP datagrams to `127.0.0.1:2000`** in nanoseconds (*fire-and-forget*).
3. **Batching & Buffer Management:**
   - The X-Ray daemon sidecar buffers subsegments in an internal circular memory queue, compresses trace batches, and flushes them over persistent HTTPS connections via the Interface VPC Endpoint to AWS X-Ray without impacting API response times.
4. **Comparison with Project 1 (EKS):**
   - In Project 1, Fluent Bit and Prometheus operated as cluster-wide **DaemonSets** across shared EC2 worker nodes. In ECS Fargate, because there is no access to the underlying EC2 host, the **Sidecar Pattern** is the only architectural mechanism to deploy local daemons.
5. **Rejection of Other Sidecars (Preventing Overengineering):**
   - *Fluent Bit / FireLens:* Rejected because Fargate natively supports the `awslogs` log driver, routing stdout/stderr directly to CloudWatch Logs at the hypervisor layer with 0 MB of container RAM overhead.
   - *Commercial APM Agents (Datadog/Dynatrace):* Rejected to avoid third-party SaaS subscription licensing costs.
   - *Envoy Service Mesh:* Rejected because service mesh sidecars add 50+ MB of RAM overhead and proxy hops, which is unjustified for a single decoupled backend service.

#### C. Identity & Role Attribution: "Support Agent" vs. Generic "User"
- External customers never access the React web console or hold credentials in Amazon Cognito. Customers interact exclusively via inbound communication channels (Webhooks, Email, Customer Forms).
- The identity previously referenced as `User` is explicitly designated as **`Support Agent`** (or `Operator`).
- Support Agents are authenticated internal operators (`Tier1_Agents` and `Operations_Managers`) who log into the React 18/19 SPA through Amazon Cognito with enforced Software Token MFA (TOTP).
- Support Agents perform **Human-in-the-Loop (HITL)** governance: auditing, modifying, and approving AI-generated response drafts and closing tickets (`PATCH /api/v1/inquiries/{id}/resolve`).

#### D. Omnichannel Ingestion: The 4 Inbound Webhook Sources
Inbound customer communications are normalized into a canonical Pydantic model (`InquiryCreate`) at the Application Load Balancer boundary (`POST /api/v1/webhooks/*`):
1. **Corporate Email Parsing Webhook:** Handled via AWS SES Inbound Rules / SendGrid Inbound Parse (`POST /api/v1/webhooks/email`).
2. **Customer Portal Web Form Webhook:** Direct web inquiry intake from customer applications (`POST /api/v1/webhooks/webform`).
3. **Public Reviews & Reputation Webhook:** Real-time customer dissatisfaction intake from Trustpilot / Google Reviews API (`POST /api/v1/webhooks/reviews`).
4. **Billing & Dispute Webhook:** High-priority financial failure events from Stripe (`POST /api/v1/webhooks/billing`).

#### E. Decoupled Outbound Event Notification
Amazon SNS handles outbound asynchronous fan-out strictly to two designated targets:
- **`SNS -> Mail`:** Dispatches automated email receipts with assigned SLA deadlines to the customer.
- **`SNS -> Slack`:** Dispatches real-time ChatOps alerts to the `#ops-critical` engineering channel for P1/P2 tickets.
- Outbound third-party webhooks were removed to maintain strict alignment with required project capabilities.

---

### 3. Cardinal Implementation Rules (Non-Negotiable Engineering Standards)

1. **Strict Absence of Analogies:** All documentation, comments, commit messages, and architectural explanations must use formal systems, networking, and software engineering terminology.
2. **Zero-Internet Egress (PrivateLink Architecture):**
   - No NAT Gateways are provisioned, saving ~$65/month per AZ.
   - Fargate tasks communicate with all AWS dependencies strictly through **AWS PrivateLink (Interface VPC Endpoints)** and an **S3 Gateway Endpoint**.
3. **3-Tier Network Topology:**
   - `public_subnets`: Application Load Balancer and AWS WAF connected to Internet Gateway.
   - `private_subnets`: ECS Fargate compute tasks and Interface VPC Endpoints.
   - `database_subnets`: Isolated Amazon RDS PostgreSQL subnets (`aws_db_subnet_group`). Route table contains **only the local route** (`10.0.0.0/16 -> local`), prohibiting any direct or indirect route to Internet or NAT.
4. **Clean Teardown Guarantee (0.00 € Residual Cost):**
   - S3: `force_destroy = true` on all buckets.
   - RDS: `skip_final_snapshot = true` and `deletion_protection = false`.
   - `terraform destroy` must execute cleanly without orphaned resources or manual intervention.
5. **Strict IAM Role Separation:**
   - *Task Execution Role:* Used exclusively by the ECS container agent to pull images from ECR, fetch parameters/secrets, and initialize logging.
   - *Task Role:* Used by the FastAPI application runtime to call Amazon Bedrock, read/write S3 objects, publish SNS messages, and write custom CloudWatch EMF metrics.
6. **Zero-Trust Enterprise Authentication (Cognito TOTP MFA):**
   - Enforced MFA (`mfa_configuration = "ON"`) using RFC 6238 Software Tokens (TOTP). Zero SMS telecommunication fees or SIM-swapping vulnerabilities.
   - Role-Based Access Control (RBAC): `Tier1_Agents` and `Operations_Managers`.
   - JWT tokens (RS256) validated in-memory by FastAPI against Cognito JWKS for sub-millisecond authentication latency.
7. **Continuous Knowledge Ledger Synchronization:**
   - Whenever an architectural question, technical inquiry, or design trade-off is discussed, the assistant MUST automatically append the question, evaluated alternatives, and final engineering resolution to `ARCHITECTURE_DECISIONS_AND_QA.md` in Strict English.
   - If the resolution impacts the active topology, endpoints, or data models, `PROJECT_CONTEXT.md` MUST be synchronized simultaneously.

---

### 4. Storage FinOps: S3 Multi-Tier Lifecycle Configuration

1. **Customer Attachments (`s3-attachments-*`):**
   - **Days 1 to 60:** `S3 Standard` (immediate sub-millisecond retrieval during active ticket processing).
   - **Day 60+:** Automated transition to `S3 Glacier Instant Retrieval` (68% cost reduction while preserving millisecond retrieval for compliance audits).
2. **Application Load Balancer Access Logs (`s3-alb-logs-*`):**
   - **Days 1 to 30:** `S3 Standard` (Athena querying for operational troubleshooting).
   - **Days 30 to 90:** Automated transition to `S3 Glacier Flexible Retrieval` (cost optimization for cold historical access).
   - **Day 90:** Automatic expiration and permanent purge.
3. **CI/CD Pipeline Artifacts (`s3-pipeline-artifacts-*`):**
   - `S3 Standard` with automatic object expiration after 3 days.

---

### 5. Master Architecture Execution Map (47 Chronological Flows)

Every flow connects exactly one origin node to one destination node. Each block is allocated a **single, unified color** in Excalidraw. Cryptographic, policy, and background storage transitions are distinguished using **dashed lines**.

| Block | Functional Domain | Unified Color | Excalidraw Hex | Flow Range |
| :--- | :--- | :--- | :---: | :---: |
| **Block 1** | IaC, Policy-as-Code Governance & Remote State | **Brown / Copper** | `#9A3412` | 1 – 5 |
| **Block 2** | CI/CD & DevSecOps (SAST, SCA, SBOM) | **Orange** | `#EA580C` | 6 – 15 |
| **Block 3** | Fargate Bootstrapping, Private Connectivity & DB | **Purple** | `#7C3AED` | 16 – 20 |
| **Block 4** | Perimeter Ingress, DNS, WAF & Authentication | **Royal Blue** | `#2563EB` | 21 – 29 |
| **Block 5** | AI Inference with Guardrails, Attachments & KMS | **Emerald Green** | `#059669` | 30 – 33 |
| **Block 6** | Asynchronous Dispatch & ChatOps | **Magenta / Pink** | `#DB2777` | 34 – 36 |
| **Block 7** | Human-in-the-Loop Operations & Audited Closure | **Teal / Turquoise** | `#0D9488` | 37 – 38 |
| **Block 8** | Distributed Telemetry & Observability | **Salmon** | `#FA8072` | 39 – 43 |
| **Block 9** | Storage FinOps & S3/Glacier Lifecycle | **White** | `#FFFFFF` | 44 – 46 |
| **Block 10**| Resilience & Load Testing | **Light Brown** | `#D97706` | 47 |

---

#### Block 1: IaC, Policy-as-Code Governance & Remote State (Color: Brown / Copper `#9A3412`)

##### Flow 1: `Developer` ➔ `Conftest (OPA Rego)` *(Brown - Solid)*
* **Action:** Developer (or automated PR gate) executes `conftest test` against Terraform code evaluating organizational policies written in **Rego**.
* **Rationale:** Enforces Policy-as-Code guardrails: verifies 3-tier subnet isolation, prohibits 0.0.0.0/0 ingress on non-ALB security groups, enforces KMS CMK encryption, and mandates FinOps tags.
* **Precedence:** Absolute first validation gate (*fail-fast*). Blocks invalid architecture before static analysis or cloud mutation.

##### Flow 2: `Developer` ➔ `KICS (Checkmarx)` *(Brown - Solid)*
* **Action:** Developer executes `kics scan -p terraform/` to scan HCL code against 2,000+ security queries.
* **Rationale:** Scans for CIS AWS Foundations Benchmark, SOC 2, and PCI-DSS compliance misconfigurations.
* **Precedence:** Executes alongside Policy-as-Code validation before any cloud mutation commands are permitted.

##### Flow 3: `Developer` ➔ `Terraform` *(Brown - Solid)*
* **Action:** Developer executes Terraform CLI commands (`terraform init`, `terraform plan`, `terraform apply`) authenticated via IAM federated credentials.
* **Rationale:** Guarantees cloud topology immutability and repeatability across VPCs, subnets, ECS clusters, and security policies.
* **Precedence:** Permitted only after Conftest (1) and KICS (2) pass with exit-code 0.

##### Flow 4: `Terraform` ➔ `S3 (Remote Backend)` *(Brown - Solid)*
* **Action:** Terraform establishes HTTPS 443 connection to synchronize and lock state via DynamoDB.
* **Rationale:** Prevents race conditions and state corruption across concurrent runs.
* **Precedence:** Executes immediately upon CLI invocation before executing cloud mutations.

##### Flow 5: `Terraform` ➔ `KMS` *(Brown - Dashed)*
* **Action:** Terraform invokes KMS API (`kms:GenerateDataKey` / `kms:Encrypt`) to encrypt `terraform.tfstate` at rest using a Customer Managed Key (CMK).
* **Rationale:** Protects sensitive infrastructure secrets and credentials stored within state files.
* **Precedence:** Applied synchronously whenever state data is serialized and written to the backend bucket.

---

#### Block 2: Continuous Integration & Delivery / DevSecOps (Color: Orange `#EA580C`)

##### Flow 6: `Developer` ➔ `Github Repository` *(Orange - Solid)*
* **Action:** Developer executes `git push origin main` over SSH (port 22) or HTTPS (port 443).
* **Rationale:** Commits source code to the authoritative version control repository.
* **Precedence:** Precedes all automated CI/CD triggers.

##### Flow 7: `Github Repository` ➔ `CodePipeline` *(Orange - Solid)*
* **Action:** GitHub emits an HTTPS webhook to AWS CodeStar Connections / EventBridge upon detecting commits on branch `main`.
* **Rationale:** Initiates the automated software delivery lifecycle.
* **Precedence:** Direct consequence of Flow 6.

##### Flow 8: `CodePipeline` ➔ `CodeBuild` *(Orange - Solid)*
* **Action:** CodePipeline spins up an ephemeral CodeBuild runner and injects environment variables and `buildspec.yml`.
* **Rationale:** Isolates compute-intensive build and test execution from pipeline orchestration.
* **Precedence:** Executes after source stage artifact acquisition succeeds.

##### Flow 9: `CodeBuild` ➔ `Pytest` *(Orange - Solid)*
* **Action:** CodeBuild executes `pytest tests/` in the Python virtual environment.
* **Rationale:** Validates Pydantic schemas, business logic, and API endpoints (*fail-fast* gate).
* **Precedence:** First quality gate. Halts the build immediately upon test failure.

##### Flow 10: `CodeBuild` ➔ `Semgrep` *(Orange - Solid)*
* **Action:** CodeBuild runs `semgrep --config p/security-audit` across Python and React codebases.
* **Rationale:** Static Application Security Testing (SAST) for SQL injection, hardcoded credentials, and cryptographic weaknesses (OWASP Top 10).
* **Precedence:** Runs against source code prior to container packaging.

##### Flow 11: `CodeBuild` ➔ `Trivy` *(Orange - Solid)*
* **Action:** CodeBuild executes `trivy image --exit-code 1 <image_id>` on the locally built Docker image (`python:3.12-slim`).
* **Rationale:** Scans container filesystem and dependencies (`pip`, `npm`) for known CVEs.
* **Precedence:** Evaluates built container layers before pushing to the container registry.

##### Flow 12: `CodeBuild` ➔ `ECR` *(Orange - Solid)*
* **Action:** CodeBuild generates CycloneDX SBOM via **Syft**, authenticates via `aws ecr get-login-password` and executes `docker push <account>.dkr.ecr.<region>.amazonaws.com/customer-inquiry-manager:latest`.
* **Rationale:** Stores immutable container image layers in the regional private registry with complete supply chain transparency.
* **Precedence:** Executes only after passing Pytest (9), Semgrep (10), and Trivy (11).

##### Flow 13: `CodeBuild` ➔ `S3 (Pipeline Artifacts)` *(Orange - Solid)*
* **Action:** CodeBuild uploads `imagedefinitions.json` linking container name to ECR image digest.
* **Rationale:** Provides the deployment manifest required by CodePipeline and CodeDeploy.
* **Precedence:** Generated only after the ECR push completes and the image digest is established.

##### Flow 14: `CodePipeline` ➔ `CodeDeploy` *(Orange - Solid)*
* **Action:** CodePipeline triggers CodeDeploy using the generated image definitions artifact.
* **Rationale:** Manages progressive Blue/Green traffic shifting between ALB Target Groups.
* **Precedence:** Follows successful completion of the build and packaging stage.

##### Flow 15: `CodeDeploy` ➔ `ECS Cluster` *(Orange - Solid)*
* **Action:** CodeDeploy invokes ECS APIs (`RegisterTaskDefinition`, `UpdateService`) to instantiate new Fargate tasks with `capacity_provider_strategy = FARGATE_SPOT` and the `aws-xray-daemon` sidecar.
* **Rationale:** Triggers container lifecycle in the ECS Fargate compute plane.
* **Precedence:** Final deployment instruction transferring execution to the container runtime.

---

#### Block 3: Fargate Bootstrapping, Private Connectivity & DB Encryption (Color: Purple `#7C3AED`)

##### Flow 16: `ECS Cluster` ➔ `VPC Endpoint: ECR` *(Purple - Solid)*
* **Action:** ECS agent establishes TLS connection to ECR Interface Endpoints (`ecr.api`, `ecr.dkr`) to pull manifests and layers.
* **Rationale:** Enables private image retrieval in subnets lacking Internet or NAT Gateway routes.
* **Precedence:** Container cannot start until image layers are retrieved and unpacked.

##### Flow 17: `App (FastAPI)` ➔ `VPC Endpoint: Secrets Manager` *(Purple - Solid)*
* **Action:** During application startup (`lifespan`), FastAPI retrieves database credentials and JWT secrets over HTTPS via PrivateLink.
* **Rationale:** Eliminates plaintext credentials in environment variables or configuration files.
* **Precedence:** Mandatory prerequisite to initializing database connection pools.

##### Flow 18: `App (FastAPI)` ➔ `VPC Endpoint: S3 (Gateway)` *(Purple - Solid)*
* **Action:** FastAPI executes `s3:GetObject` via the S3 Gateway Endpoint to download `company_profile.json`.
* **Rationale:** Loads grounding context into RAM to enrich Bedrock system prompts with zero runtime per-request latency.
* **Precedence:** Must load during startup before declaring readiness probes healthy.

##### Flow 19: `App (FastAPI)` ➔ `RDS` *(Purple - Solid)*
* **Action:** SQLAlchemy (`asyncpg`) opens a TCP 5432 connection pool with mandatory TLS (`sslmode=require`) to PostgreSQL in the isolated subnet.
* **Rationale:** Establishes database session pooling for CRUD and audit transactions.
* **Precedence:** Enables `/health/ready` probe to return HTTP 200, signalling target group readiness.

##### Flow 20: `RDS` ➔ `KMS` *(Purple - Dashed)*
* **Action:** RDS storage engine requests KMS CMK (`kms:GenerateDataKey` / `kms:Decrypt`) to encrypt underlying EBS storage volumes.
* **Rationale:** Enforces encryption at rest for all database tables, indexes, and write-ahead logs.
* **Precedence:** Operates continuously from database initialization and throughout all read/write I/O operations.

---

#### Block 4: Perimeter Ingress, DNS, Inspection & Authentication (Color: Royal Blue `#2563EB`)

##### Flow 21: `Support Agent` ➔ `Route 53` *(Royal Blue - Solid)*
* **Action:** Operator browser issues DNS query (UDP/TCP 53) for the application FQDN.
* **Rationale:** Resolves domain name to routable endpoint IPs.
* **Precedence:** Required initial step before assembling any client TCP packet.

##### Flow 22: `Route 53` ➔ `ALB` *(Royal Blue - Solid)*
* **Action:** Route 53 resolves DNS Alias record to Application Load Balancer public IPs.
* **Rationale:** Handles dynamic ALB scaling and IP changes transparently.
* **Precedence:** Directly answers client DNS query from Flow 21.

##### Flow 23: `ALB` ➔ `ACM` *(Royal Blue - Solid)*
* **Action:** ALB validates and terminates TLS certificate X.509 via AWS Certificate Manager.
* **Rationale:** Offloads asymmetric cryptographic handshake overhead from Fargate compute tasks.
* **Precedence:** Negotiated during client HTTPS handshake on listener port 443.

##### Flow 24: `WAF` ➔ `ALB` *(Royal Blue - Dashed)*
* **Action:** AWS WAF inspects inbound Layer 7 HTTP requests against OWASP Core Rule Sets, SQLi, XSS, and rate limits.
* **Rationale:** Drops malicious payloads before reaching compute infrastructure.
* **Precedence:** Evaluated synchronously at the ALB boundary prior to target routing.

##### Flow 25: `Support Agent` ➔ `ALB` *(Royal Blue - Solid)*
* **Action:** Operator establishes TLS session over port 443 to load the React SPA or execute API calls.
* **Rationale:** Primary ingress pipe for authenticated administrative operations.
* **Precedence:** Occurs once DNS resolution, TLS termination, and WAF inspection pass.

##### Flow 26: `ALB` ➔ `Cognito` *(Royal Blue - Solid)*
* **Action:** ALB listener evaluates authentication rule, redirecting unauthenticated requests to Cognito OAuth2/OIDC endpoint with enforced **RFC 6238 Software Token TOTP MFA**.
* **Rationale:** Enforces centralized identity management and TOTP MFA challenge before granting UI access.
* **Precedence:** Triggered immediately when accessing protected web console routes.

##### Flow 27: `ALB` ➔ `App (FastAPI)` *(Royal Blue - Solid)*
* **Action:** ALB forwards inspected, authenticated HTTP traffic to private Fargate tasks on TCP 8000 with `X-Forwarded-For` and `X-Amzn-Oidc-Data` headers.
* **Rationale:** Distributes traffic evenly across private backend replicas.
* **Precedence:** Forwards only after WAF approval and valid identity claims.

##### Flow 28: `App (FastAPI)` ➔ `VPC Endpoint: Cognito` *(Royal Blue - Solid)*
* **Action:** FastAPI security middleware validates JWT token signature against Cognito JWKS over PrivateLink and extracts RBAC groups (`Tier1_Agents`, `Operations_Managers`).
* **Rationale:** Verifies token authenticity and extracts RBAC claims without internet access.
* **Precedence:** First processing stage inside FastAPI upon receiving forwarded requests.

##### Flow 29: `Webhooks` *(4 Sources)* ➔ `ALB` *(Royal Blue - Solid)*
* **Action:** Inbound programmatic inquiries (SES email parse, web form, Trustpilot review, Stripe billing) send signed POST requests to `/api/v1/webhooks/*`.
* **Rationale:** Ingests external customer events into the unified processing pipeline.
* **Precedence:** Shares the same inspected perimeter entry as web console users.

---

#### Block 5: AI Inference, Attachments & KMS Encryption (Color: Emerald Green `#059669`)

##### Flow 30: `App (FastAPI)` ➔ `VPC Endpoint: Bedrock` *(Emerald Green - Solid)*
* **Action:** FastAPI invokes `bedrock-runtime:Converse` passing `guardrailConfig` via Interface Endpoint to Claude 3.5 Sonnet / Haiku. **Amazon Bedrock Guardrails** evaluates Prompt Attack filters (Prompt Injection / Jailbreak) and PII redaction rules (DLP) before foundation model execution.
* **Rationale:** Executes intent classification, sentiment analysis, urgency rating (1–5), churn detection, and response drafting in a single sub-second call while mitigating OWASP Top 10 for LLMs risks.
* **Precedence:** Executes once input payload is validated in memory, before database persistence.

##### Flow 31: `App (FastAPI)` ➔ `S3 (Attachments)` *(Emerald Green - Solid)*
* **Action:** FastAPI uploads inquiry attachments (PDFs, screenshots) to S3 bucket via S3 Endpoint.
* **Rationale:** Offloads binary object storage from PostgreSQL to scalable object store.
* **Precedence:** Executes upon verifying payload validity and extracting file metadata.

##### Flow 32: `S3 (Attachments)` ➔ `KMS` *(Emerald Green - Dashed)*
* **Action:** S3 invokes KMS API to encrypt uploaded object using Customer Managed Key (SSE-KMS).
* **Rationale:** Enforces envelope encryption and IAM dual-authorization controls over customer attachments.
* **Precedence:** Executed synchronously by S3 storage engine upon receiving `s3:PutObject`.

##### Flow 33: `App (FastAPI)` ➔ `VPC Endpoint: SNS` *(Emerald Green - Solid)*
* **Action:** FastAPI invokes `sns:Publish` to publish classified ticket event (`ticket.created`, `ticket.triaged`).
* **Rationale:** Decouples synchronous API response from downstream asynchronous notification consumers.
* **Precedence:** Fires immediately after Bedrock classification and attachment storage succeed.

---

#### Block 6: Asynchronous Dispatch & ChatOps (Color: Magenta / Pink `#DB2777`)

##### Flow 34: `VPC Endpoint: SNS` ➔ `SNS` *(Regional)* *(Magenta - Solid)*
* **Action:** VPC Endpoint ENI routes the published message to the regional Amazon SNS service over the private AWS network backbone.
* **Rationale:** Transports event payloads out of isolated subnets without public IPs.
* **Precedence:** Intermediate transport hop following Flow 33.

##### Flow 35: `SNS` ➔ `Mail` *(Magenta - Solid)*
* **Action:** SNS triggers email subscription (or forwards to Amazon SES) to send automated receipt and SLA deadline to customer.
* **Rationale:** Confirms ticket registration and establishes customer SLA expectations.
* **Precedence:** Asynchronous reaction to the published SNS domain event.

##### Flow 36: `SNS` ➔ `Slack` *(Magenta - Solid)*
* **Action:** SNS dispatches HTTPS webhook to Slack `#ops-critical` channel for tickets classified as `HIGH` or `CRITICAL` (P1/P2).
* **Rationale:** Provides real-time ChatOps alerting to on-call support engineers.
* **Precedence:** Evaluated concurrently with email notification based on SNS subscription filter policies.

---

#### Block 7: Human-in-the-Loop Operations (Color: Teal / Turquoise `#0D9488`)

##### Flow 37: `Support Agent` ➔ `App (FastAPI)` *(Teal - Solid)*
* **Action:** Authenticated operator reviews AI-suggested draft in React console, edits content if necessary, and submits resolution via `PATCH /api/v1/inquiries/{id}/resolve`.
* **Rationale:** Implements Human-in-the-Loop governance to prevent LLM hallucinations on critical customer interactions.
* **Precedence:** Occurs after ticket is classified, notified, and listed in the active operational queue.

##### Flow 38: `App (FastAPI)` ➔ `RDS` *(Teal - Solid)*
* **Action:** FastAPI executes SQL `UPDATE inquiries SET status='RESOLVED', human_reviewed=true, resolution_text=... WHERE id=...`.
* **Rationale:** Persists final ticket state and auditor identity (`cognito_sub`) in PostgreSQL.
* **Precedence:** Direct consequence of operator approval in Flow 37.

---

#### Block 8: Distributed Telemetry & Observability (Color: Salmon `#FA8072`)

##### Flow 39: `App (FastAPI)` ➔ `Sidecar (xray-daemon)` *(Salmon - Solid)*
* **Action:** FastAPI X-Ray SDK middleware emits non-blocking UDP packets to `127.0.0.1:2000` containing subsegment timings (PostgreSQL queries, Bedrock inference, S3 uploads).
* **Rationale:** Collects distributed traces with zero synchronous latency penalty on HTTP worker threads.
* **Precedence:** Emitted continuously throughout request execution stages.

##### Flow 40: `Sidecar (xray-daemon)` ➔ `VPC Endpoint: X-Ray` *(Salmon - Solid)*
* **Action:** Daemon batches buffered trace segments and flushes them via HTTPS `PutTraceSegments` over PrivateLink to AWS X-Ray.
* **Rationale:** Isolates trace transmission from application lifecycle and maintains private VPC transit.
* **Precedence:** Flushed asynchronously upon buffer capacity or time window thresholds.

##### Flow 41: `App (FastAPI)` ➔ `VPC Endpoint: CloudWatch` *(Salmon - Solid)*
* **Action:** Docker `awslogs` driver and FastAPI stream structured JSON logs and Embedded Metric Format (EMF) metrics to CloudWatch.
* **Rationale:** Centralizes operational logs, SLI indicators, and audit trails without public egress.
* **Precedence:** Continuous streaming throughout application lifecycle.

##### Flow 42: `ALB` ➔ `S3 (ALB Access Logs)` *(Salmon - Dashed)*
* **Action:** ALB writes compressed `.gz` access log files every 5 minutes directly to designated S3 bucket.
* **Rationale:** Provides raw connection logs for forensic inspection and Athena SQL queries.
* **Precedence:** Periodic automated control plane operation independent of application code.

##### Flow 43: `RDS` ➔ `VPC Endpoint: CloudWatch` *(Salmon - Solid)*
* **Action:** RDS database engine streams Enhanced Monitoring, Performance Insights, CPU, and connection metrics to CloudWatch.
* **Rationale:** Powers database saturation alarms and slow query identification.
* **Precedence:** Continuous managed engine metric streaming.

---

#### Block 9: Storage FinOps & S3/Glacier Lifecycle (Color: White `#FFFFFF`)

##### Flow 44: `S3 (Attachments)` ➔ `Glacier Instant Retrieval` *(White - Dashed)*
* **Action:** S3 Lifecycle rule transitions attachment objects older than 60 days to `GLACIER_IR`.
* **Rationale:** Reduces storage costs by 68% while preserving millisecond retrieval capabilities for historical ticket reopening.
* **Precedence:** Evaluated daily against object creation metadata.

##### Flow 45: `S3 (ALB Access Logs)` ➔ `Glacier Flexible Retrieval` *(White - Dashed)*
* **Action:** S3 Lifecycle rule transitions ALB access logs older than 30 days to `GLACIER`.
* **Rationale:** Optimizes storage expenditure for cold diagnostic data infrequently queried after active incident analysis.
* **Precedence:** Evaluated daily on logs generated in Flow 42.

##### Flow 46: `Glacier Flexible Retrieval` ➔ `Purge / Delete` *(White - Dashed)*
* **Action:** S3 Lifecycle expiration action permanently deletes access log objects older than 90 days.
* **Rationale:** Enforces data minimization compliance (GDPR) and prevents indefinite storage cost accumulation.
* **Precedence:** Terminal lifecycle stage following archival in Flow 45.

---

#### Block 10: Resilience & Load Testing (Color: Light Brown `#D97706`)

##### Flow 47: `Load Generator (k6)` ➔ `ALB` *(Light Brown - Solid)*
* **Action:** Distributed k6 execution script injects concurrent HTTPS traffic spikes against ALB endpoints.
* **Rationale:** Experimentally validates ECS Fargate Spot auto-scaling policies and proves p95 latency stability under heavy load.
* **Precedence:** Final verification milestone. Executed only when entire infrastructure, security boundaries, and telemetry collectors are active.

---

### 6. Repository Directory Structure

```text
customer-inquiry-manager/
├── .github/
│   └── workflows/
│       └── pr-verify.yml             # Pull Request linter and validation checks
├── app/                              # FastAPI Backend
│   ├── api/
│   │   ├── v1/
│   │   │   ├── endpoints/
│   │   │   │   ├── auth.py           # Login, TOTP MFA challenge, verify, and refresh
│   │   │   │   ├── inquiries.py      # POST /inquiries, GET /inquiries, PATCH claim/resolve
│   │   │   │   ├── webhooks.py       # Inbound 4-channel webhooks (Email, Web, Reviews, Billing)
│   │   │   │   └── attachments.py    # Presigned URLs and S3 upload handling
│   │   │   └── router.py
│   │   └── health.py                 # /health/live, /health/ready probes
│   ├── core/
│   │   ├── config.py                 # Pydantic BaseSettings environment parsing
│   │   ├── database.py               # SQLAlchemy async engine & sessionmaker (asyncpg)
│   │   ├── security.py               # Cognito JWT validation (JWKS RS256) & RBAC dependencies
│   │   └── telemetry.py              # AWS X-Ray SDK & CloudWatch EMF setup
│   ├── models/                       # SQLAlchemy ORM Models (PostgreSQL JSONB + GIN indexes)
│   │   ├── inquiry.py
│   │   └── audit.py
│   ├── schemas/                      # Pydantic v2 validation schemas
│   │   ├── auth.py                   # Login, TOTP, and token schemas
│   │   ├── inquiry.py                # Canonical InquiryCreate model
│   │   └── bedrock.py                # Strict extraction schema for Bedrock Converse output
│   ├── services/                     # Business Logic & AWS SDK integrations
│   │   ├── bedrock_service.py        # Boto3 Bedrock Converse integration + Grounding
│   │   ├── cognito_service.py        # Boto3 Cognito Admin & Auth client
│   │   ├── s3_service.py             # Boto3 S3 upload & presigned URL generator
│   │   └── sns_service.py            # Boto3 SNS notification publisher
│   ├── tests/
│   │   ├── test_inquiries.py
│   │   ├── test_bedrock_schema.py
│   │   └── test_auth.py
│   ├── buildspec.yml                 # AWS CodeBuild spec (pytest + semgrep + trivy + sbom + docker build)
│   └── requirements.txt
├── frontend/                         # React 18/19 Operations Console (Vite SPA)
│   ├── src/
│   │   ├── components/               # TicketQueue, TicketDetail, TOTPModal, SLATimer
│   │   ├── services/                 # API client, Cognito authentication
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── company_profile.json              # Domain grounding context document
├── Dockerfile                        # Multi-stage: Stage 1 Node.js build -> Stage 2 Python 3.12-slim
├── terraform/
│   ├── environments/
│   │   └── dev/
│   │       ├── main.tf
│   │       ├── variables.tf
│   │       ├── outputs.tf
│   │       └── terraform.tfvars
│   └── modules/
│       ├── vpc/                      # 3-tier subnets + 8 PrivateLink Interface Endpoints
│       ├── security_groups/          # Least-privilege ingress/egress rules
│       ├── cognito/                  # User Pool, TOTP MFA enforced, Client & RBAC Groups
│       ├── rds/                      # RDS PostgreSQL 16 + native Secrets Manager rotation
│       ├── s3/                       # Multi-Tier Buckets + Lifecycle + KMS SSE
│       ├── ecs/                      # Fargate Spot Cluster, Task Def (App + X-Ray sidecar)
│       ├── alb/                      # Public ALB, Target Groups, ACM TLS, Health Checks
│       ├── iam/                      # Task Execution Role vs Task Role
│       ├── monitoring/               # CloudWatch Dashboards, Alarms & X-Ray
│       └── cicd/                     # CodePipeline, CodeBuild, CodeDeploy
├── scripts/
│   ├── seed_inquiries.py             # Test harness simulating the 4 inbound omnichannel webhooks
│   ├── k6-load-test.js               # Load and auto-scaling validation script (15-50 VUs)
│   ├── deploy-infra.sh               # 1-Click Terraform & infrastructure deployment bootstrap
│   └── teardown-infra.sh             # 1-Click Clean teardown script verified to 0.00 € residual cost
├── .github/
│   └── workflows/
│       └── pr-verify.yml             # PR gate: terraform validate, Conftest (OPA) & KICS (Checkmarx) IaC security scan
├── LICENSE
├── README.md
├── AGENTS.md                         # Antigravity persistent workspace rules & directives
├── ARCHITECTURE_DECISIONS_AND_QA.md  # Exhaustive design decisions and Q&A history ledger
└── PROJECT_CONTEXT.md
```

---

### 7. Commit & Code Quality Standards

1. **Language Standard:** 100% of all codebase artifacts (code, inline comments, docstrings, schema field descriptions, configuration keys, commit messages, and documentation) MUST be in **Strict English**.
2. **Conventional Commits:**
   - `feat:` New business capability or endpoint implementation.
   - `fix:` Bug fix or schema correction.
   - `infra:` Terraform module modification or infrastructure policy update.
   - `refactor:` Code restructuring without functional behavior changes.
   - `test:` Unit, integration, or load test suite additions.
   - `docs:` Architectural documentation or specification updates.
3. **Rationale-Only Comments:** Write comments strictly to document non-obvious engineering rationales (the "WHY"). Do not restate what the code visibly performs.
