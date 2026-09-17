import sys

q178_text = '''

---

### Q178: Metric Provenance & Mathematical Derivation of Operations Console Hero KPIs: FinOps Unit Economics, P95 Inference Latency, Zero-Touch Automation, and Queue Dwell Telemetry

#### Question:
> *"Where do the 8 specific metrics displayed in the Taskly Hero Analytics cards originate (Active Operational Queue, In-Bounds / Total Ratio, Breached Overdue Count, Target Threshold >= 95.0%, P95 Bedrock Inference Latency, Queue Dwell Average, Autonomous Routing Zero-Touch Rate, and FinOps Unit Cost per Ticket), what exact database schemas and documents produce them, how is synthetic simulation distinguished from live cloud telemetry, and why are these specific indicators mandatory in real-world enterprise operations?"*

#### Evaluated Alternatives:
- **Alternative A: Hardcoding Static Marketing Placeholders in the Presentation Tier:**
  - *Evaluation:* Common front-end shortcut. Renders static numbers (`~1.24s`, `98.5%`) that never reflect real database transactions or cloud executions.
- **Alternative B: Pure Client-Side Estimation Without Backend SQL Aggregation:**
  - *Evaluation:* Inefficient for large datasets. Calculating all aggregations in the browser degrades rendering performance when ticket volume exceeds several thousand rows.
- **Alternative C: Hybrid Live SQL Aggregation (`app/api/v1/metrics.py`) + Runtime Entity Extraction + Declarative Contract Benchmarks (Adopted):**
  - *Evaluation:* **Adopted**. 
    1. Volumetric parameters (`in_bounds_count`, `active_count`, `p1_count`, `total_inquiries`) are queried directly from the PostgreSQL `inquiries` table.
    2. Operational timings (`sla_remaining_seconds`, `avg_mttr`, `queue_dwell_seconds`) are computed by subtracting timestamps (`created_at`, `claimed_at`, `resolved_at`, `sla_deadline_at`).
    3. AI telemetry (`bedrock_latency_ms`, `cost_eur`, `zero_touch_pct`) is populated directly from the AWS Bedrock Converse API response (`usage.inputTokens`, `usage.outputTokens`, `time.perf_counter()`).
    4. Compliance thresholds (`Target Threshold >= 95.0%`) are grounded in the contractual ITIL SLA matrix declared in `company_profile.json`.

#### Answer & Technical Defense:

##### 1. Parameter-by-Parameter Provenance Matrix:

| Metric Displayed | Value Type | Primary Origin & Calculation Formula | Source Documents & Database Columns | Enterprise Operational Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`Active Operational Queue`** | Percentage (`0 - 100%`) | `(in_bounds_count / total_inquiries) * 100` computed in `app/api/v1/metrics.py`. | PostgreSQL: `inquiries.sla_deadline_at`, `inquiries.status`. | Core SRE Service Level Indicator (SLI) measuring overall contract health. |
| **`In-Bounds / Total`** | Ratio (`x / 7 tkts`) | `COUNT(status == 'RESOLVED' OR sla_deadline_at >= now())` over `COUNT(*)`. | PostgreSQL: `inquiries.sla_deadline_at`, `inquiries.status`. | Volumetric reality behind the percentage; prevents percentage distortion during low traffic. |
| **`Breached (Overdue)`** | Integer Count | `COUNT(status != 'RESOLVED' AND sla_deadline_at < now())`. | PostgreSQL: `inquiries.sla_deadline_at`, `inquiries.status`. | Immediate incident escalation signal; every breached ticket represents an active contract penalty. |
| **`Target Threshold`** | Constant (`>= 95.0%`) | Contractual ITIL Tier-1 benchmark declared in `company_profile.json` under `itil_sla_matrix_hours`. | File: `company_profile.json`, Component: `TasklyHeroVisualizations.tsx`. | Establishes the baseline Service Level Objective (SLO); triggers alarms when compliance drops below target. |
| **`Inference Latency`** | Seconds (`~0.48s - 1.24s`) | P95 runtime measurement via `time.perf_counter()` wrapping `self.client.converse()`. | Database: `inquiries.entities['bedrock_latency_ms']`, Service: `bedrock_service.py`. | Telemetry protecting ingestion queues against LLM latency degradation during API traffic spikes. |
| **`Queue Dwell Avg`** | Seconds (`claimed_at - created_at`) | Average delta between ticket creation and first operator claim. | PostgreSQL: `inquiries.created_at`, `inquiries.claimed_at`. | Diagnoses staffing bottlenecks vs. technical delays. Isolates how long tickets idle in queue. |
| **`Autonomous Routing`** | Percentage (`0 - 100%`) | Percentage of resolved tickets where operator approved AI resolution verbatim (`was_edited == False`). | PostgreSQL: `inquiries.suggested_response == inquiries.resolution_text`. | MLOps quality indicator measuring labor savings and model classification accuracy. |
| **`Unit Cost (€/tkt)`** | Currency (`0.00025 €/tkt`) | `(input_tokens * 0.0008 / 1000) + (output_tokens * 0.004 / 1000) * 0.92` (USD to EUR). | Database: `inquiries.entities['cost_eur']`, Service: `bedrock_service.py`. | FinOps unit economics governance proving predictable cloud spend under scale. |

##### 2. How the System Distinguishes Simulation from Live Telemetry:
- **In AWS Production (`ENVIRONMENT = "prod"`):**
  - `bedrock_service.py` invokes the regional AWS Bedrock endpoint over PrivateLink.
  - Latency is measured live via high-resolution monotonic clocks (`time.perf_counter()`).
  - Token counts (`inputTokens`, `outputTokens`) are returned directly by the AWS Bedrock response header.
  - Costs are calculated to six decimal places using published AWS pricing.
- **In Local Developer Offline Mode (`ENVIRONMENT = "dev"`):**
  - `bedrock_service.py` executes the deterministic local semantic generator.
  - Ingestion cost defaults to standard Claude Haiku 4.5 baseline unit economics (`0.00025 €/ticket`).
  - Latency represents local Python in-memory execution (`~0.48s` benchmark).
'''

with open("docs/ARCHITECTURE_DECISIONS_AND_QA.md", "a", encoding="utf-8") as f:
    f.write(q178_text)

print("Successfully appended Q178 to docs/ARCHITECTURE_DECISIONS_AND_QA.md")
