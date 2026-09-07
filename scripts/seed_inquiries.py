#!/usr/bin/env python3
"""CLI Omnichannel Ingestion Test Harness for Customer Inquiry Manager.

Simulates incoming customer communications across all 5 inbound webhooks:
1. Corporate Email (AWS SES / SendGrid)
2. Customer Web Form
3. Trustpilot Review (with HMAC-SHA256 cryptographic signature)
4. Google Review (with X-Google-Webhook-Secret authentication header)
5. Stripe Billing Dispute (charge.dispute.created)
"""
import argparse
import hashlib
import hmac
import json
import random
import sys
import time
from typing import Dict, Any, List
import urllib.request
import urllib.error

# ANSI Terminal Colors
C_RESET = "\033[0m"
C_BOLD = "\033[1m"
C_RED = "\033[31m"
C_GREEN = "\033[32m"
C_YELLOW = "\033[33m"
C_BLUE = "\033[34m"
C_PURPLE = "\033[35m"
C_CYAN = "\033[36m"

SCENARIOS = {
    "p1_outage": {
        "channel": "email",
        "subject": "CRITICAL OUTAGE: All database connections dropped in eu-central-1",
        "body": "Our financial core API is throwing 504 gateway timeouts. All transaction queries are timing out at the database pool layer. 50,000 customers currently impacted. Immediate failover required under Gold P1 SLA.",
        "customer_email": "cto@global-payments-corp.de",
        "customer_name": "Dr. Heinrich Weber",
    },
    "churn_threat": {
        "channel": "trustpilot",
        "stars": 1,
        "title": "Terrible downtime and unresponsive enterprise support",
        "text": "We signed an annual Enterprise agreement for 200 seats. Service was down 4 times this month. If this is not escalated to management within 2 hours, our legal counsel will initiate breach-of-contract termination and chargeback all invoices.",
        "customer_email": "vp.engineering@saas-scale.io",
        "customer_name": "Sarah Jenkins",
    },
    "security_incident": {
        "channel": "webform",
        "subject": "SECURITY ESCALATION: Exposed access credentials identified on public endpoint",
        "body": "Our red team discovered an unauthenticated telemetry endpoint returning internal IAM role session tokens in headers. Potential unauthorized privilege escalation vulnerability. Report attached.",
        "customer_email": "sec-response@cyberguard-audit.com",
        "customer_name": "Elena Rostova",
    },
    "billing_dispute": {
        "channel": "billing",
        "amount": 2499.00,
        "reason": "duplicate",
        "customer_email": "accounts-payable@logistics-eu.com",
    },
    "general_inquiry": {
        "channel": "webform",
        "subject": "Inquiry regarding SOC 2 Type II compliance reports for Q3",
        "body": "Hello support team, could you provide our compliance auditors with the latest AWS SOC 2 Type II compliance package and pen test executive summary?",
        "customer_email": "compliance.lead@healthtech-secure.org",
        "customer_name": "Liam O'Connor",
    },
    "google_review_complaint": {
        "channel": "google-reviews",
        "starRating": 1,
        "comment": "Complete silence from customer service after our subscription auto-renewed unexpectedly. Impossible to reach a human agent.",
        "customer_email": "reviewer@munich-consulting.de",
        "customer_name": "Maximilian Becker",
    }
}


def make_request(url: str, method: str = "POST", headers: Dict[str, str] = None, data: Dict[str, Any] = None) -> Dict[str, Any]:
    """Execute HTTP request using standard library urllib."""
    headers = headers or {}
    json_bytes = json.dumps(data).encode("utf-8") if data is not None else None

    req = urllib.request.Request(url, data=json_bytes, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body) if res_body else {}
    except urllib.error.HTTPError as err:
        err_body = err.read().decode("utf-8")
        raise RuntimeError(f"HTTP {err.code}: {err_body}")
    except Exception as exc:
        raise RuntimeError(f"Connection failure: {exc}")


def dispatch_inquiry(host: str, scenario_key: str, trustpilot_secret: str = "", google_secret: str = ""):
    """Send individual inquiry based on predefined scenario."""
    scenario = SCENARIOS.get(scenario_key)
    if not scenario:
        print(f"{C_RED}Unknown scenario: {scenario_key}{C_RESET}")
        return

    channel = scenario["channel"]
    url = f"{host.rstrip('/')}/api/v1/webhooks/{channel}"
    headers = {"Content-Type": "application/json"}
    payload = {}

    if channel == "email":
        payload = {
            "from": scenario["customer_email"],
            "name": scenario["customer_name"],
            "subject": scenario["subject"],
            "text": scenario["body"],
        }
    elif channel == "webform":
        payload = {
            "channel": "WEB_FORM",
            "customer_email": scenario["customer_email"],
            "customer_name": scenario["customer_name"],
            "subject": scenario["subject"],
            "body": scenario["body"],
        }
    elif channel == "trustpilot":
        payload = {
            "stars": scenario["stars"],
            "title": scenario["title"],
            "text": scenario["text"],
            "consumer": {
                "email": scenario["customer_email"],
                "name": scenario["customer_name"],
            },
        }
        if trustpilot_secret:
            raw_bytes = json.dumps(payload).encode("utf-8")
            sig = hmac.new(trustpilot_secret.encode("utf-8"), raw_bytes, hashlib.sha256).hexdigest()
            headers["X-Trustpilot-Signature"] = sig
    elif channel == "google-reviews":
        payload = {
            "starRating": scenario["starRating"],
            "comment": scenario["comment"],
            "reviewer": {
                "email": scenario["customer_email"],
                "displayName": scenario["customer_name"],
            },
        }
        if google_secret:
            headers["X-Google-Webhook-Secret"] = google_secret
    elif channel == "billing":
        payload = {
            "type": "charge.dispute.created",
            "data": {
                "object": {
                    "id": f"dp_sim_{random.randint(10000, 99999)}",
                    "amount": int(scenario["amount"] * 100),
                    "currency": "eur",
                    "reason": scenario["reason"],
                    "billing_details": {"email": scenario["customer_email"]},
                }
            }
        }

    start_time = time.time()
    try:
        res = make_request(url, method="POST", headers=headers, data=payload)
        elapsed = time.time() - start_time

        priority = res.get("priority", "N/A")
        prio_color = C_RED if priority == "P1" else C_YELLOW if priority == "P2" else C_CYAN if priority == "P3" else C_BLUE

        print(f"[{C_GREEN}✓ INGESTED{C_RESET}] Channel: {C_BOLD}{channel.upper():<14}{C_RESET} | "
              f"Priority: {prio_color}{C_BOLD}{priority:<4}{C_RESET} | "
              f"Dept: {C_PURPLE}{res.get('department', 'N/A'):<12}{C_RESET} | "
              f"Churn: {C_RED if res.get('churn_risk') else C_GREEN}{str(res.get('churn_risk')):<5}{C_RESET} | "
              f"Latency: {elapsed:.2f}s | "
              f"Subject: {res.get('subject', '')[:35]}...")
    except Exception as exc:
        print(f"[{C_RED}✗ FAILED{C_RESET}] Scenario: {scenario_key} | Error: {exc}")


def main():
    parser = argparse.ArgumentParser(description="Customer Inquiry Manager Omnichannel Traffic Seeder")
    parser.add_argument("--host", default="http://127.0.0.1:8000", help="FastAPI host (default: http://127.0.0.1:8000)")
    parser.add_argument("--scenario", choices=list(SCENARIOS.keys()) + ["all"], default="all", help="Scenario to inject")
    parser.add_argument("--count", type=int, default=1, help="Number of repetitions per scenario")
    parser.add_argument("--trustpilot-secret", default="", help="Optional HMAC-SHA256 secret for Trustpilot")
    parser.add_argument("--google-secret", default="", help="Optional header secret for Google Reviews")
    args = parser.parse_args()

    print(f"\n{C_BOLD}{C_CYAN}=== ExampleCorp CIM Omnichannel Traffic Harness ==={C_RESET}")
    print(f"Target Host: {args.host}")
    print(f"Scenario:    {args.scenario}")
    print(f"Cycles:      {args.count}\n")

    scenarios_to_run = list(SCENARIOS.keys()) if args.scenario == "all" else [args.scenario]

    for cycle in range(1, args.count + 1):
        if args.count > 1:
            print(f"\n--- Batch Cycle {cycle}/{args.count} ---")
        for scn in scenarios_to_run:
            dispatch_inquiry(
                host=args.host,
                scenario_key=scn,
                trustpilot_secret=args.trustpilot_secret,
                google_secret=args.google_secret,
            )
            time.sleep(0.5)

    print(f"\n{C_GREEN}Traffic seeding sequence complete.{C_RESET}\n")


if __name__ == "__main__":
    main()
