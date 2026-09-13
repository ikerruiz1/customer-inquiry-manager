import {
  DepartmentEnum,
  PriorityEnum,
  InquiryStatusEnum,
  ChannelEnum,
} from '../types/inquiry';
import type {
  Inquiry,
  AuditLog,
  MFAChallenge,
  AuthUser,
  TokenAuthResponse,
  DashboardMetricsResponse,
  AgentProfile,
} from '../types/inquiry';

// Active session token keys
const AUTH_TOKEN_KEY = 'auth_token_v2';
const AUTH_USER_KEY = 'auth_user_v2';

// Active bearer token
let authToken: string = localStorage.getItem(AUTH_TOKEN_KEY) || '';

export const setAuthToken = (token: string) => {
  authToken = token;
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
};

export const getStoredAuthToken = (): string => {
  return localStorage.getItem(AUTH_TOKEN_KEY) || authToken;
};

export const getStoredUser = (): AuthUser | null => {
  try {
    const saved = localStorage.getItem(AUTH_USER_KEY);
    if (saved) return JSON.parse(saved);
  } catch (err) {
    console.warn('Failed to parse stored auth user', err);
  }
  return null;
};

export const setStoredUser = (user: AuthUser | null) => {
  if (user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_USER_KEY);
  }
};

export const logoutOperator = () => {
  authToken = '';
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
};

const getHeaders = () => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY) || authToken;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

/**
 * Initial login challenge: returns either MFA challenge or token response
 */
export async function loginOperator(
  username: string,
  password: string
): Promise<MFAChallenge | TokenAuthResponse> {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Invalid credentials or user not found');
  }
  return await res.json();
}

/**
 * Register a new operator and initiate MFA enrollment
 */
export async function registerOperator(payload: {
  name: string;
  email: string;
  password: string;
  role: 'Tier1_Agent' | 'Operations_Manager';
}): Promise<MFAChallenge> {
  const res = await fetch('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Operator registration failed');
  }
  return await res.json();
}

/**
 * Verify 6-digit TOTP code (Google/Microsoft Authenticator) and establish session
 */
export async function verifyMfaCode(
  session: string,
  totpCode: string
): Promise<TokenAuthResponse> {
  const res = await fetch('/api/v1/auth/mfa/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session, totp_code: totpCode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Invalid or expired verification code');
  }
  const tokenData: TokenAuthResponse = await res.json();
  if (tokenData.access_token) {
    setAuthToken(tokenData.access_token);
    if (tokenData.user) {
      setStoredUser(tokenData.user);
    }
  }
  return tokenData;
}

/**
 * Fetch current operator identity and RBAC profile
 */
export async function fetchCurrentOperator(): Promise<AuthUser> {
  const res = await fetch('/api/v1/auth/me', {
    headers: getHeaders(),
  });
  if (!res.ok) {
    throw new Error('Invalid or expired operator session');
  }
  const user = await res.json();
  setStoredUser(user);
  return user;
}

/**
 * Check if the live FastAPI microservice is reachable on port 8000
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch('/health/live', { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch prioritized inquiry queue directly from persistent backend database
 */
export async function fetchInquiries(params?: {
  status?: InquiryStatusEnum;
  department?: DepartmentEnum;
  priority?: PriorityEnum;
}): Promise<Inquiry[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.department) query.set('department', params.department);
  if (params?.priority) query.set('priority', params.priority);

  const res = await fetch(`/api/v1/inquiries/?${query.toString()}`, {
    headers: getHeaders(),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP error ${res.status}: Failed to fetch inquiries from backend`);
  }
  const data = await res.json();
  const liveItems: Inquiry[] = data.items || data;
  return Array.isArray(liveItems) ? liveItems : [];
}

/**
 * Retrieve single inquiry detail from persistent database
 */
export async function getInquiry(id: string): Promise<Inquiry> {
  const res = await fetch(`/api/v1/inquiries/${id}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP error ${res.status}: Inquiry not found`);
  }
  return await res.json();
}

/**
 * Atomic Claim: Assigns inquiry to the current agent in database with race-condition guard
 */
export async function claimInquiry(
  id: string,
  _agentId?: string
): Promise<Inquiry> {
  const res = await fetch(`/api/v1/inquiries/${id}/claim`, {
    method: 'PATCH',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    if (res.status === 409) {
      throw new Error(errorData.detail || 'Collision: Ticket already claimed by another agent');
    }
    throw new Error(errorData.detail || `HTTP error ${res.status}: Failed to claim ticket`);
  }
  return await res.json();
}

/**
 * Human-in-the-Loop Resolution: Approves response and closes ticket in database
 */
export async function resolveInquiry(
  id: string,
  resolutionText: string,
  notes?: string
): Promise<Inquiry> {
  const res = await fetch(`/api/v1/inquiries/${id}/resolve`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({
      resolution_text: resolutionText,
      notes: notes || null,
    }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP error ${res.status}: Failed to resolve ticket`);
  }
  return await res.json();
}

/**
 * MLOps Classification Override with mandatory audit justification in database
 */
export async function overrideInquiry(
  id: string,
  newDepartment: DepartmentEnum,
  newPriority: PriorityEnum,
  reason: string
): Promise<Inquiry> {
  const res = await fetch(`/api/v1/inquiries/${id}/override`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({
      new_department: newDepartment,
      new_priority: newPriority,
      reason: reason,
    }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP error ${res.status}: Failed to override ticket classification`);
  }
  return await res.json();
}

/**
 * Intake / Ingest new customer inquiry via backend pipeline
 */
export async function createInquiry(payload: {
  channel: ChannelEnum;
  customer_email: string;
  customer_name: string;
  subject: string;
  body: string;
}): Promise<Inquiry> {
  const res = await fetch('/api/v1/inquiries/', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP error ${res.status}: Failed to ingest inquiry`);
  }
  return await res.json();
}

/**
 * Fetch compliance audit trail for a ticket from persistent database
 */
export async function getAuditLogs(inquiryId: string): Promise<AuditLog[]> {
  const res = await fetch(`/api/v1/inquiries/${inquiryId}/audit-logs`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP error ${res.status}: Failed to fetch audit logs`);
  }
  return await res.json();
}

/**
 * Fetch live SQL-aggregated KPIs and categorical distribution metrics from backend
 */
export async function fetchDashboardMetrics(): Promise<DashboardMetricsResponse> {
  const res = await fetch('/api/v1/metrics/dashboard', {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP error ${res.status}: Failed to fetch live SQL dashboard metrics`);
  }
  return await res.json();
}

/**
 * Fetch all registered support operators dynamically from backend database
 */
export async function fetchRegisteredOperators(): Promise<AgentProfile[]> {
  const res = await fetch('/api/v1/auth/operators', {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP error ${res.status}: Failed to fetch registered operators`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
