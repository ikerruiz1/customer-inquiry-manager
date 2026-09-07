export type Priority = "P1" | "P2" | "P3" | "P4";

export type Department =
  | "BILLING"
  | "SECURITY"
  | "TECH_SUPPORT"
  | "ACCOUNTS"
  | "SALES"
  | "GENERAL";

export type Channel =
  | "EMAIL"
  | "WEB_FORM"
  | "TRUSTPILOT"
  | "GOOGLE_REVIEWS"
  | "BILLING";

export type Status = "UNASSIGNED" | "CLAIMED" | "RESOLVED";

export type ResponseStrategy =
  | "DIRECT_RESOLUTION"
  | "CLARIFICATION_REQUEST"
  | "ESCALATION"
  | "EMPATHETIC_DEFUSING";

export interface Inquiry {
  id: string;
  channel: Channel;
  customer_email: string;
  customer_name: string;
  subject: string;
  body: string;
  status: Status;
  department: Department;
  priority: Priority;
  urgency: number;
  impact: number;
  sentiment_score: number;
  churn_risk: boolean;
  entities: Record<string, any>;
  suggested_strategy?: ResponseStrategy;
  suggested_response?: string;
  agent_copilot_notes?: string;
  sla_deadline_at: string;
  sla_remaining_seconds?: number;
  assigned_agent_id?: string;
  claimed_at?: string;
  resolved_at?: string;
  resolution_text?: string;
  human_reviewed: boolean;
  created_at: string;
  updated_at: string;
}

export interface InquiryListResponse {
  items: Inquiry[];
  total: number;
  page: number;
  page_size: number;
}

export interface AuditLog {
  id: string;
  inquiry_id: string;
  agent_id: string;
  action: string;
  previous_value?: Record<string, any>;
  new_value: Record<string, any>;
  reason?: string;
  created_at: string;
}

export interface OperatorProfile {
  sub: string;
  email: string;
  groups: string[];
  token_use?: string;
}

export interface MFAChallenge {
  challenge_name: string;
  session: string;
  message: string;
}
