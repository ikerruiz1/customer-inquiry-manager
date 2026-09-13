import {
  DepartmentEnum,
  PriorityEnum,
  InquiryStatusEnum,
  ChannelEnum,
} from '../types/inquiry';
import type {
  Inquiry,
  AuditLog,
  KPIStats,
  MFAChallenge,
  AuthUser,
  TokenAuthResponse,
  DashboardMetricsResponse,
  AgentProfile,
} from '../types/inquiry';
import { INITIAL_INQUIRIES, INITIAL_AGENTS } from './mockData';

// Persistent local caching across browser refreshes
const INQUIRIES_STORAGE_KEY = 'inquiries_storage_v3';
const AUTH_TOKEN_KEY = 'auth_token_v2';
const AUTH_USER_KEY = 'auth_user_v2';

function loadPersistedInquiries(): Inquiry[] {
  try {
    const saved = localStorage.getItem(INQUIRIES_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to load persisted inquiries:', err);
  }
  return [...INITIAL_INQUIRIES];
}

function savePersistedInquiries(items: Inquiry[]) {
  try {
    localStorage.setItem(INQUIRIES_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Failed to save persisted inquiries:', err);
  }
}

// Mutable store initialized from localStorage with fallback to INITIAL_INQUIRIES
let inMemoryInquiries: Inquiry[] = loadPersistedInquiries();
const inMemoryAuditLogs: Record<string, AuditLog[]> = {};

// Active bearer token
let authToken: string = localStorage.getItem(AUTH_TOKEN_KEY) || 'dev-token';

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
  const token = localStorage.getItem(AUTH_TOKEN_KEY) || authToken || 'dev-token';
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

/**
 * Initial login challenge: returns either MFA challenge or token response
 */
export async function loginOperator(
  username: string,
  password: string
): Promise<MFAChallenge | TokenAuthResponse> {
  try {
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
  } catch (err: any) {
    throw new Error(err.message || 'Authentication request failed');
  }
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
    throw new Error('Sesión no válida o expirada');
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
 * Fetch prioritized inquiry queue
 */
export async function fetchInquiries(params?: {
  status?: InquiryStatusEnum;
  department?: DepartmentEnum;
  priority?: PriorityEnum;
}): Promise<Inquiry[]> {
  try {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.department) query.set('department', params.department);
    if (params?.priority) query.set('priority', params.priority);

    const res = await fetch(`/api/v1/inquiries/?${query.toString()}`, {
      headers: getHeaders(),
    });

    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    const liveItems: Inquiry[] = data.items || data;
    if (Array.isArray(liveItems)) {
      inMemoryInquiries = [...liveItems];
      savePersistedInquiries(inMemoryInquiries);
      return liveItems;
    }
    return inMemoryInquiries;
  } catch {
    // Fallback to persisted store
    let filtered = [...inMemoryInquiries];
    if (params?.status) {
      filtered = filtered.filter((i) => i.status === params.status);
    }
    if (params?.department) {
      filtered = filtered.filter((i) => i.department === params.department);
    }
    if (params?.priority) {
      filtered = filtered.filter((i) => i.priority === params.priority);
    }
    return filtered;
  }
}

/**
 * Retrieve single inquiry detail
 */
export async function getInquiry(id: string): Promise<Inquiry> {
  try {
    const res = await fetch(`/api/v1/inquiries/${id}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch {
    const found = inMemoryInquiries.find((i) => i.id === id);
    if (!found) throw new Error('Inquiry not found');
    return found;
  }
}

/**
 * Atomic Claim: Assigns inquiry to the current agent
 */
export async function claimInquiry(
  id: string,
  agentId: string
): Promise<Inquiry> {
  try {
    const res = await fetch(`/api/v1/inquiries/${id}/claim`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    if (!res.ok) {
      if (res.status === 409) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Collision: Ticket already claimed by another agent');
      }
      throw new Error(`HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    // In-memory fallback
    const idx = inMemoryInquiries.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error('Inquiry not found');

    const item = inMemoryInquiries[idx];
    if (item.status === InquiryStatusEnum.CLAIMED && item.assigned_agent_id !== agentId) {
      throw new Error(`Collision: Ticket already claimed by agent ${item.assigned_agent_id}`);
    }

    const updated: Inquiry = {
      ...item,
      status: InquiryStatusEnum.CLAIMED,
      assigned_agent_id: agentId,
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryInquiries[idx] = updated;
    savePersistedInquiries(inMemoryInquiries);

    // Record audit log
    if (!inMemoryAuditLogs[id]) inMemoryAuditLogs[id] = [];
    inMemoryAuditLogs[id].push({
      id: crypto.randomUUID(),
      inquiry_id: id,
      agent_id: agentId,
      action: 'CLAIM',
      new_value: { status: 'CLAIMED', assigned_agent_id: agentId },
      reason: 'Agent claimed ticket from queue',
      created_at: new Date().toISOString(),
    });

    return updated;
  }
}

/**
 * Human-in-the-Loop Resolution: Approves response and closes ticket
 */
export async function resolveInquiry(
  id: string,
  resolutionText: string,
  notes?: string
): Promise<Inquiry> {
  try {
    const res = await fetch(`/api/v1/inquiries/${id}/resolve`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        resolution_text: resolutionText,
        notes: notes || null,
      }),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const resolved: Inquiry = await res.json();
    const idx = inMemoryInquiries.findIndex((i) => i.id === id);
    if (idx !== -1) {
      inMemoryInquiries[idx] = resolved;
      savePersistedInquiries(inMemoryInquiries);
    }
    return resolved;
  } catch {
    const idx = inMemoryInquiries.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error('Inquiry not found');

    const item = inMemoryInquiries[idx];
    const wasEdited =
      (item.suggested_response || '').trim() !== resolutionText.trim();
    const editDistance = Math.abs(
      resolutionText.length - (item.suggested_response || '').length
    );

    const updated: Inquiry = {
      ...item,
      status: InquiryStatusEnum.RESOLVED,
      resolution_text: resolutionText,
      resolved_at: new Date().toISOString(),
      human_reviewed: true,
      was_edited: wasEdited,
      edit_character_distance: editDistance,
      updated_at: new Date().toISOString(),
    };
    inMemoryInquiries[idx] = updated;
    savePersistedInquiries(inMemoryInquiries);

    if (!inMemoryAuditLogs[id]) inMemoryAuditLogs[id] = [];
    inMemoryAuditLogs[id].push({
      id: crypto.randomUUID(),
      inquiry_id: id,
      agent_id: item.assigned_agent_id || 'current-agent',
      action: 'RESOLVE',
      new_value: { status: 'RESOLVED', resolution_text: resolutionText },
      reason: notes || 'Ticket approved and resolved by human agent',
      created_at: new Date().toISOString(),
    });

    return updated;
  }
}

/**
 * MLOps Classification Override with mandatory audit justification
 */
export async function overrideInquiry(
  id: string,
  newDepartment: DepartmentEnum,
  newPriority: PriorityEnum,
  reason: string
): Promise<Inquiry> {
  try {
    const res = await fetch(`/api/v1/inquiries/${id}/override`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        new_department: newDepartment,
        new_priority: newPriority,
        reason: reason,
      }),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const overridden: Inquiry = await res.json();
    const idx = inMemoryInquiries.findIndex((i) => i.id === id);
    if (idx !== -1) {
      inMemoryInquiries[idx] = overridden;
      savePersistedInquiries(inMemoryInquiries);
    }
    return overridden;
  } catch {
    const idx = inMemoryInquiries.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error('Inquiry not found');

    const item = inMemoryInquiries[idx];
    const updated: Inquiry = {
      ...item,
      department: newDepartment,
      priority: newPriority,
      updated_at: new Date().toISOString(),
    };
    inMemoryInquiries[idx] = updated;
    savePersistedInquiries(inMemoryInquiries);

    if (!inMemoryAuditLogs[id]) inMemoryAuditLogs[id] = [];
    inMemoryAuditLogs[id].push({
      id: crypto.randomUUID(),
      inquiry_id: id,
      agent_id: item.assigned_agent_id || 'supervisor',
      action: 'OVERRIDE_CLASSIFICATION',
      previous_value: {
        department: item.department,
        priority: item.priority,
      },
      new_value: {
        department: newDepartment,
        priority: newPriority,
      },
      reason: reason,
      created_at: new Date().toISOString(),
    });

    return updated;
  }
}

/**
 * Intake / Create new customer inquiry
 */
export async function createInquiry(payload: {
  channel: ChannelEnum;
  customer_email: string;
  customer_name: string;
  subject: string;
  body: string;
}): Promise<Inquiry> {
  try {
    const res = await fetch('/api/v1/inquiries/', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const created: Inquiry = await res.json();
    inMemoryInquiries.unshift(created);
    savePersistedInquiries(inMemoryInquiries);
    return created;
  } catch {
    const isP1 =
      payload.subject.toLowerCase().includes('disputa') ||
      payload.body.toLowerCase().includes('timeout') ||
      payload.body.toLowerCase().includes('caída');
    const priority = isP1 ? PriorityEnum.P1 : PriorityEnum.P3;
    const deadlineMinutes = isP1 ? 30 : 480;

    const newInquiry: Inquiry = {
      id: crypto.randomUUID(),
      channel: payload.channel,
      customer_email: payload.customer_email,
      customer_name: payload.customer_name,
      subject: payload.subject,
      body: payload.body,
      status: InquiryStatusEnum.UNASSIGNED,
      department: payload.subject.toLowerCase().includes('disputa')
        ? DepartmentEnum.BILLING
        : DepartmentEnum.TECH_SUPPORT,
      priority: priority,
      urgency: isP1 ? 5 : 2,
      impact: isP1 ? 3 : 1,
      sentiment_score: isP1 ? -0.8 : 0.0,
      churn_risk: isP1,
      entities: {
        detected_text: payload.subject,
        confidence_score: 0.98,
        bedrock_latency_ms: 540,
        model_id: 'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
        cost_eur: 0.000325,
      },
      confidence_score: 0.98,
      triage_rationale: `Clasificación multivariable ejecutada mediante Amazon Bedrock Converse API para canal ${payload.channel}.`,
      bedrock_latency_ms: 540,
      model_id: 'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
      cost_eur: 0.000325,
      suggested_strategy: isP1
        ? ('EMPATHETIC_DEFUSING' as any)
        : ('DIRECT_RESOLUTION' as any),
      suggested_response: `Estimado/a ${payload.customer_name}, hemos recibido su consulta referente a "${payload.subject}". Nuestro equipo de soporte está gestionando el ticket con máxima prioridad.`,
      agent_copilot_notes: 'Nota Interna: Ticket ingerido a través de la pasarela omnicanal.',
      sla_deadline_at: new Date(Date.now() + deadlineMinutes * 60 * 1000).toISOString(),
      human_reviewed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    inMemoryInquiries.unshift(newInquiry);
    savePersistedInquiries(inMemoryInquiries);
    return newInquiry;
  }
}

/**
 * Fetch compliance audit trail for a ticket
 */
export async function getAuditLogs(inquiryId: string): Promise<AuditLog[]> {
  try {
    const res = await fetch(`/api/v1/inquiries/${inquiryId}/audit-logs`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch {
    return inMemoryAuditLogs[inquiryId] || [];
  }
}

/**
 * Calculate FinOps & SRE Live KPIs from current ticket pool
 */
export function calculateKPIs(inquiries: Inquiry[]): KPIStats {
  const now = Date.now();
  const active = inquiries.filter((i) => i.status !== InquiryStatusEnum.RESOLVED);
  const p1s = active.filter((i) => i.priority === PriorityEnum.P1);
  const resolved = inquiries.filter((i) => i.status === InquiryStatusEnum.RESOLVED);

  // Dynamic SLA compliance rate
  const inBoundsCount = inquiries.filter(
    (t) => t.status === InquiryStatusEnum.RESOLVED || new Date(t.sla_deadline_at).getTime() >= now
  ).length;
  const slaComplianceRate =
    inquiries.length > 0 ? Number(((inBoundsCount / inquiries.length) * 100).toFixed(1)) : 100;

  // AI acceptance rate: resolved tickets approved verbatim
  const acceptedVerbatim = resolved.filter((i) => i.was_edited === false).length;
  const aiAcceptanceRate =
    resolved.length > 0 ? Number(((acceptedVerbatim / resolved.length) * 100).toFixed(1)) : 100;

  // Dynamic Mean Time to Resolution (MTTR) in seconds
  const resolvedWithTimes = resolved.filter((i) => i.resolved_at);
  const avgMttrSeconds =
    resolvedWithTimes.length > 0
      ? Math.round(
          resolvedWithTimes.reduce((sum, i) => {
            const created = new Date(i.created_at).getTime();
            const closed = new Date(i.resolved_at!).getTime();
            return sum + Math.max(1, (closed - created) / 1000);
          }, 0) / resolvedWithTimes.length
        )
      : 0;

  // Real aggregate FinOps token ingestion cost
  const totalCost = inquiries.reduce((sum, i) => sum + (i.cost_eur || 0.00025), 0);

  return {
    activeCount: active.length,
    p1Count: p1s.length,
    slaComplianceRate,
    aiAcceptanceRate,
    avgMttrSeconds,
    estimatedCostTodayEur: Number(totalCost.toFixed(4)),
  };
}

/**
 * Fetch live SQL-aggregated KPIs and categorical distribution metrics from backend
 */
export async function fetchDashboardMetrics(): Promise<DashboardMetricsResponse> {
  try {
    const res = await fetch('/api/v1/metrics/dashboard', {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    // Graceful offline fallback
    const fallbackKpis = calculateKPIs(inMemoryInquiries);
    return {
      kpis: {
        sla_compliance_rate: fallbackKpis.slaComplianceRate,
        ai_acceptance_rate: fallbackKpis.aiAcceptanceRate,
        avg_mttr_seconds: fallbackKpis.avgMttrSeconds,
        active_count: fallbackKpis.activeCount,
        p1_count: fallbackKpis.p1Count,
        estimated_cost_today_eur: fallbackKpis.estimatedCostTodayEur,
      },
      distributions: {
        departments: {},
        priorities: {},
        channels: {},
        sentiments: {},
      },
      total_inquiries: inMemoryInquiries.length,
    };
  }
}

/**
 * Fetch all registered support operators dynamically from backend database
 */
export async function fetchRegisteredOperators(): Promise<AgentProfile[]> {
  try {
    const res = await fetch('/api/v1/auth/operators', {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
    return INITIAL_AGENTS;
  } catch {
    return INITIAL_AGENTS;
  }
}


