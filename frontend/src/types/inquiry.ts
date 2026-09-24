/**
 * Canonical TypeScript Domain Schemas matching FastAPI / Pydantic v2 specifications.
 * Enforces erasable syntax (const objects + type unions) for full TS 5.8+ & Node compatibility.
 */

export const ChannelEnum = {
  EMAIL: 'EMAIL',
  WEB_FORM: 'WEB_FORM',
  TRUSTPILOT: 'TRUSTPILOT',
  GOOGLE_REVIEWS: 'GOOGLE_REVIEWS',
  BILLING: 'BILLING',
} as const;
export type ChannelEnum = (typeof ChannelEnum)[keyof typeof ChannelEnum];

export const DepartmentEnum = {
  BILLING: 'BILLING',
  SECURITY: 'SECURITY',
  TECH_SUPPORT: 'TECH_SUPPORT',
  ACCOUNTS: 'ACCOUNTS',
  SALES: 'SALES',
  GENERAL: 'GENERAL',
} as const;
export type DepartmentEnum = (typeof DepartmentEnum)[keyof typeof DepartmentEnum];

export const PriorityEnum = {
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
  P4: 'P4',
} as const;
export type PriorityEnum = (typeof PriorityEnum)[keyof typeof PriorityEnum];

export const InquiryStatusEnum = {
  UNASSIGNED: 'UNASSIGNED',
  CLAIMED: 'CLAIMED',
  PENDING_CUSTOMER: 'PENDING_CUSTOMER',
  RESOLVED: 'RESOLVED',
} as const;
export type InquiryStatusEnum = (typeof InquiryStatusEnum)[keyof typeof InquiryStatusEnum];

export const MessageSenderEnum = {
  CUSTOMER: 'CUSTOMER',
  AGENT: 'AGENT',
  SYSTEM: 'SYSTEM',
  AI_COPILOT: 'AI_COPILOT',
} as const;
export type MessageSenderEnum = (typeof MessageSenderEnum)[keyof typeof MessageSenderEnum];

export const MessageActionEnum = {
  REPLY: 'REPLY',
  REQUEST_INFO: 'REQUEST_INFO',
  INTERNAL_NOTE: 'INTERNAL_NOTE',
} as const;
export type MessageActionEnum = (typeof MessageActionEnum)[keyof typeof MessageActionEnum];

export interface InquiryMessage {
  id: string;
  inquiry_id: string;
  sender_type: MessageSenderEnum | string;
  sender_name: string;
  sender_email: string;
  body: string;
  is_internal_note: boolean;
  attachments?: any[];
  created_at: string;
}

export const ResponseStrategyEnum = {
  DIRECT_RESOLUTION: 'DIRECT_RESOLUTION',
  CLARIFICATION_REQUEST: 'CLARIFICATION_REQUEST',
  ESCALATION: 'ESCALATION',
  EMPATHETIC_DEFUSING: 'EMPATHETIC_DEFUSING',
} as const;
export type ResponseStrategyEnum = (typeof ResponseStrategyEnum)[keyof typeof ResponseStrategyEnum];

export interface ExtractedEntities {
  order_id?: string;
  invoice_id?: string;
  error_code?: string;
  product_affected?: string;
  monetary_amount?: string;
  customer_deadline?: string;
  missing_information?: string[];
  [key: string]: any;
}

export interface Inquiry {
  id: string;
  channel: ChannelEnum;
  customer_email: string;
  customer_name: string;
  subject: string;
  body: string;
  status: InquiryStatusEnum;

  // Triage Attributes from Bedrock
  department: DepartmentEnum;
  priority: PriorityEnum;
  urgency: number; // 1 to 5
  impact: number; // 1 to 3
  sentiment_score: number; // -1.0 to 1.0
  churn_risk: boolean;
  entities: ExtractedEntities;

  // Explainable AI & Copilot Guidance
  confidence_score?: number; // 0.0 to 1.0
  triage_rationale?: string;
  bedrock_latency_ms?: number;
  model_id?: string;
  cost_eur?: number;
  input_tokens?: number;
  output_tokens?: number;
  suggested_strategy?: ResponseStrategyEnum;
  suggested_response?: string;
  agent_copilot_notes?: string;

  // Temporal SLAs (ITIL v4 Compliant)
  sla_deadline_at: string; // ISO 8601 UTC
  sla_remaining_seconds?: number;
  first_response_deadline_at?: string;
  first_responded_at?: string;
  sla_paused_at?: string;
  total_paused_seconds?: number;

  // Human-in-the-Loop Ownership & Audit
  assigned_agent_id?: string | null;
  claimed_at?: string | null;
  resolved_at?: string | null;
  resolution_text?: string | null;
  human_reviewed: boolean;
  was_edited?: boolean;
  edit_character_distance?: number;

  // Conversation thread
  messages?: InquiryMessage[];

  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  inquiry_id: string;
  agent_id: string;
  action: string;
  previous_value?: Record<string, any> | null;
  new_value: Record<string, any>;
  reason?: string | null;
  created_at: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  email: string;
  role: 'Tier1_Agent' | 'Operations_Manager';
  initials: string;
  color: string;
}

export interface MFAChallenge {
  challenge_name: string;
  session: string;
  message: string;
  totp_secret?: string;
  otpauth_url?: string;
  email?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'Tier1_Agent' | 'Operations_Manager';
  initials: string;
  color: string;
  groups?: string[];
}

export interface InviteOperatorResponse {
  message: string;
  temporary_password: string;
  operator: {
    id?: string;
    name: string;
    email: string;
    role: 'Tier1_Agent' | 'Operations_Manager';
  };
}

export interface TokenAuthResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  groups?: string[];
  user?: AuthUser;
}

export interface KPIStats {
  activeCount: number;
  p1Count: number;
  slaComplianceRate: number; // e.g. 98.4%
  aiAcceptanceRate: number; // e.g. 86.5%
  avgMttrSeconds: number; // e.g. 14s
  estimatedCostTodayEur: number; // e.g. 0.008 EUR
}

export interface KPISummary {
  sla_compliance_rate: number;
  ai_acceptance_rate: number;
  avg_mttr_seconds: number;
  active_count: number;
  p1_count: number;
  estimated_cost_today_eur: number;
}

export interface DistributionMetrics {
  departments: Record<string, number>;
  priorities: Record<string, number>;
  channels: Record<string, number>;
  sentiments: Record<string, number>;
}

export interface DashboardMetricsResponse {
  kpis: KPISummary;
  distributions: DistributionMetrics;
  total_inquiries: number;
}

export interface InquiryFilters {
  statusTab: 'ACTIVE' | 'IN_PROGRESS' | 'PENDING_CUSTOMER' | 'RESOLVED' | 'ALL';
  department?: DepartmentEnum | 'ALL';
  priority?: PriorityEnum | 'ALL';
  churnOnly: boolean;
  searchQuery: string;
}

