import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 15 }, // Warm-up
    { duration: "1m", target: 30 },  // Sustained load
    { duration: "30s", target: 50 }, // Peak spike testing Fargate Spot scaling
    { duration: "30s", target: 0 },  // Cooldown
  ],
  thresholds: {
    http_req_duration: ["p(95)<800"], // 95% of requests must complete under 800ms
    http_req_failed: ["rate<0.01"],    // Error rate must remain strictly under 1%
  },
};

const BASE_URL = __ENV.TARGET_HOST || "http://127.0.0.1:8000";

export default function () {
  // 1. Health Probe Verification
  const healthRes = http.get(`${BASE_URL}/health/live`);
  check(healthRes, {
    "liveness status 200": (r) => r.status === 200,
  });

  // 2. Queue Retrieval (Testing B-Tree Partial Index and SLA calculation)
  const queueRes = http.get(`${BASE_URL}/api/v1/inquiries/?status=UNASSIGNED`, {
    headers: {
      Authorization: "Bearer dev-token",
    },
  });
  check(queueRes, {
    "queue query status 200": (r) => r.status === 200,
  });

  // 3. Synthetic Webform Inquiry Intake
  const payload = JSON.stringify({
    channel: "WEB_FORM",
    customer_email: `loadtest_${__VU}_${__ITER}@loadtest-client.com`,
    customer_name: `Load Test Agent ${__VU}`,
    subject: `Load Test Inquiry Iteration ${__ITER}`,
    body: "Evaluating system throughput, Bedrock single-pass inference latency, and PostgreSQL connection pool behavior under load.",
  });

  const postRes = http.post(`${BASE_URL}/api/v1/webhooks/webform`, payload, {
    headers: { "Content-Type": "application/json" },
  });
  check(postRes, {
    "webhook intake 202/201": (r) => r.status === 202 || r.status === 201,
  });

  sleep(1);
}
