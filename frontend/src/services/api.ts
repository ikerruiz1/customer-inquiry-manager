import {
  Inquiry,
  InquiryListResponse,
  AuditLog,
  OperatorProfile,
  MFAChallenge,
  Department,
  Priority,
} from "../types";

const API_BASE = "/api/v1";

let authToken: string | null = localStorage.getItem("auth_token") || "dev-token";

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem("auth_token", token);
  } else {
    localStorage.removeItem("auth_token");
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

export async function fetchInquiries(params?: {
  status?: string;
  department?: string;
  priority?: string;
  page?: number;
  page_size?: number;
}): Promise<InquiryListResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.append("status", params.status);
  if (params?.department) query.append("department", params.department);
  if (params?.priority) query.append("priority", params.priority);
  if (params?.page) query.append("page", params.page.toString());
  if (params?.page_size) query.append("page_size", params.page_size.toString());

  const res = await fetch(`${API_BASE}/inquiries/?${query.toString()}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch inquiries: ${res.statusText}`);
  return res.json();
}

export async function fetchInquiry(id: string): Promise<Inquiry> {
  const res = await fetch(`${API_BASE}/inquiries/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch inquiry: ${res.statusText}`);
  return res.json();
}

export async function claimInquiry(id: string): Promise<Inquiry> {
  const res = await fetch(`${API_BASE}/inquiries/${id}/claim`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  if (res.status === 409) {
    const errorData = await res.json();
    throw new Error(errorData.detail || "Ticket already claimed by another agent");
  }
  if (!res.ok) throw new Error(`Claim failed: ${res.statusText}`);
  return res.json();
}

export async function resolveInquiry(
  id: string,
  resolution_text: string,
  notes?: string
): Promise<Inquiry> {
  const res = await fetch(`${API_BASE}/inquiries/${id}/resolve`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ resolution_text, notes }),
  });
  if (!res.ok) throw new Error(`Resolve failed: ${res.statusText}`);
  return res.json();
}

export async function overrideInquiry(
  id: string,
  payload: { new_department?: Department; new_priority?: Priority; reason: string }
): Promise<Inquiry> {
  const res = await fetch(`${API_BASE}/inquiries/${id}/override`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Override failed: ${res.statusText}`);
  return res.json();
}

export async function fetchAuditLogs(id: string): Promise<AuditLog[]> {
  const res = await fetch(`${API_BASE}/inquiries/${id}/audit-logs`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch audit logs: ${res.statusText}`);
  return res.json();
}

export async function login(username: string, password: string): Promise<{ token?: string; mfa?: MFAChallenge }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Invalid username or password");
  const data = await res.json();
  if (data.challenge_name === "SOFTWARE_TOKEN_MFA") {
    return { mfa: data };
  }
  if (data.access_token) {
    setAuthToken(data.access_token);
    return { token: data.access_token };
  }
  throw new Error("Unexpected login response");
}

export async function verifyMFA(session: string, totp_code: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/mfa/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session, totp_code }),
  });
  if (!res.ok) throw new Error("Invalid 6-digit TOTP code");
  const data = await res.json();
  if (data.access_token) {
    setAuthToken(data.access_token);
    return data.access_token;
  }
  throw new Error("Missing access token after verification");
}

export async function fetchOperatorProfile(): Promise<OperatorProfile> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load operator profile");
  return res.json();
}

// Omnichannel Webhook Simulators
export async function triggerWebhook(channel: string, payload: any): Promise<Inquiry> {
  const endpoint = `${API_BASE}/webhooks/${channel}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Webhook dispatch failed: ${res.statusText}`);
  return res.json();
}
