import {
  ChannelEnum,
  DepartmentEnum,
  PriorityEnum,
  InquiryStatusEnum,
  ResponseStrategyEnum,
} from '../types/inquiry';
import type { Inquiry, AgentProfile } from '../types/inquiry';

export const INITIAL_AGENTS: AgentProfile[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Carlos M.',
    email: 'carlos.m@company.internal',
    role: 'Tier1_Agent',
    initials: 'CM',
    color: '#3b82f6', // Blue
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Laura G.',
    email: 'laura.g@company.internal',
    role: 'Tier1_Agent',
    initials: 'LG',
    color: '#10b981', // Emerald
  },
  {
    id: '00000000-0000-0000-0000-000000000099',
    name: 'Alex Rivera (Lead)',
    email: 'alex.rivera@company.internal',
    role: 'Operations_Manager',
    initials: 'AR',
    color: '#8b5cf6', // Purple
  },
];

const now = Date.now();

export const INITIAL_INQUIRIES: Inquiry[] = [
  {
    id: 'b1a2c3d4-0001-4000-8000-000000000001',
    channel: ChannelEnum.BILLING,
    customer_email: 'cto@fintech-pay.io',
    customer_name: 'Elena Rostova',
    subject: '[BANK DISPUTE] 450.00 EUR hold on Enterprise account',
    body: 'We have an active 450.00 EUR hold placed on our account due to an unrecognized Stripe dispute (ref: dp_88421). If these funds are not released by 18:00 UTC today, we will terminate our 25 Enterprise licenses and migrate our infrastructure to a competitor.',
    status: InquiryStatusEnum.UNASSIGNED,
    department: DepartmentEnum.BILLING,
    priority: PriorityEnum.P1,
    urgency: 5,
    impact: 3,
    sentiment_score: -0.85,
    churn_risk: true,
    entities: {
      order_id: 'dp_88421',
      monetary_amount: '450.00 EUR',
      customer_deadline: 'Today 18:00 UTC',
      product_affected: 'Billing Gateway',
    },
    confidence_score: 0.98,
    triage_rationale:
      'Classified under BILLING (P1) due to improper 450.00 EUR banking hold in Stripe dispute with explicit threat to terminate 25 Enterprise licenses (critical churn risk).',
    bedrock_latency_ms: 612,
    suggested_strategy: ResponseStrategyEnum.EMPATHETIC_DEFUSING,
    suggested_response:
      'Dear FinTech Pay team, we have placed an immediate administrative hold on the fund retention and escalated the case to our senior treasury group to reconcile dispute dp_88421 directly with the acquiring institution. We will provide a definitive resolution before 18:00 UTC today.',
    agent_copilot_notes:
      'Internal Note: Customer is on an annual Enterprise tier (MRR: 4,800 EUR). Do not dispute reject without consulting key accounts lead.',
    sla_deadline_at: new Date(now + 28 * 60 * 1000).toISOString(), // 28 mins left
    human_reviewed: false,
    created_at: new Date(now - 15 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'b1a2c3d4-0002-4000-8000-000000000002',
    channel: ChannelEnum.EMAIL,
    customer_email: 'sre-team@nexuscloud.com',
    customer_name: 'David Vance',
    subject: 'Outage Alert: 504 Gateway Timeout on managed Kubernetes cluster',
    body: 'Since the 14:00 deployment, all pods in cluster k8s-prod-eu1 are throwing 504 Gateway Timeout errors and failing with ERR_POD_OOMKILLED status. End users are unable to reach the payment checkout flow.',
    status: InquiryStatusEnum.CLAIMED,
    department: DepartmentEnum.TECH_SUPPORT,
    priority: PriorityEnum.P1,
    urgency: 5,
    impact: 3,
    sentiment_score: -0.72,
    churn_risk: true,
    entities: {
      error_code: '504 Gateway Timeout / ERR_POD_OOMKILLED',
      product_affected: 'Managed Kubernetes',
      order_id: 'k8s-prod-eu1',
    },
    confidence_score: 0.99,
    triage_rationale:
      'Critical service outage (P1): complete disruption of payment checkout pipeline due to OOM memory exhaustion in production Kubernetes cluster.',
    bedrock_latency_ms: 580,
    suggested_strategy: ResponseStrategyEnum.DIRECT_RESOLUTION,
    suggested_response:
      'Hello David, we have identified memory throttling across the control plane nodes of k8s-prod-eu1. Our SRE team is provisioning additional compute worker capacity to restore pod traffic immediately.',
    agent_copilot_notes:
      'Internal Note: CloudWatch metrics confirmed node worker-04 reached 99% RAM saturation. Initiated autoscaling group surge capacity.',
    sla_deadline_at: new Date(now + 42 * 60 * 1000).toISOString(), // 42 mins left
    assigned_agent_id: '00000000-0000-0000-0000-000000000001', // Claimed by Carlos M.
    claimed_at: new Date(now - 5 * 60 * 1000).toISOString(),
    human_reviewed: false,
    created_at: new Date(now - 20 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'b1a2c3d4-0003-4000-8000-000000000003',
    channel: ChannelEnum.TRUSTPILOT,
    customer_email: 'marcos.dev@outlook.com',
    customer_name: 'Marcos Benítez',
    subject: '[Trustpilot 1-Star] Unacceptable support delay and API latency',
    body: 'I have been waiting for 3 days for custom domain SSL certificate provisioning. Support has been completely absent and my storefront continues to show insecure connection warnings. Highly disappointing.',
    status: InquiryStatusEnum.UNASSIGNED,
    department: DepartmentEnum.ACCOUNTS,
    priority: PriorityEnum.P2,
    urgency: 4,
    impact: 2,
    sentiment_score: -0.92,
    churn_risk: true,
    entities: {
      product_affected: 'Custom Domains / SSL',
    },
    confidence_score: 0.94,
    triage_rationale:
      'Public 1-star Trustpilot review with severe reputational impact. Requires immediate de-escalation protocol.',
    bedrock_latency_ms: 630,
    suggested_strategy: ResponseStrategyEnum.EMPATHETIC_DEFUSING,
    suggested_response:
      'Hello Marcos, we sincerely apologize for the delay in issuing your SSL certificate. We have expedited DNS validation for your domain with highest priority, and it will be active within the next 10 minutes.',
    agent_copilot_notes:
      'Internal Note: Verify in Route 53 that CNAME challenge records have no conflicting CAA policies before replying.',
    sla_deadline_at: new Date(now + 95 * 60 * 1000).toISOString(), // 1h 35m left
    human_reviewed: false,
    created_at: new Date(now - 45 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'b1a2c3d4-0004-4000-8000-000000000004',
    channel: ChannelEnum.WEB_FORM,
    customer_email: 'jorge.developer@saasapp.es',
    customer_name: 'Jorge Salgado',
    subject: 'Configuration question regarding CORS headers on Gateway API',
    body: 'We are integrating our React frontend with the Gateway API and encountering a CORS origin not allowed error from localhost:5173. Could you advise on how to configure the allowed origin in the configuration file?',
    status: InquiryStatusEnum.UNASSIGNED,
    department: DepartmentEnum.TECH_SUPPORT,
    priority: PriorityEnum.P3,
    urgency: 2,
    impact: 1,
    sentiment_score: 0.1,
    churn_risk: false,
    entities: {
      product_affected: 'API Gateway',
      error_code: 'CORS Origin Not Allowed',
    },
    confidence_score: 0.97,
    triage_rationale:
      'Standard developer integration inquiry (P3). Zero churn risk, polite collaborative tone.',
    bedrock_latency_ms: 540,
    suggested_strategy: ResponseStrategyEnum.DIRECT_RESOLUTION,
    suggested_response:
      'Hello Jorge, to enable local development origins on the API Gateway, update your configuration in app/core/config.py or configure CORS_ORIGINS = ["http://localhost:5173"]. Refer to the attached microservices documentation for details.',
    agent_copilot_notes:
      'Internal Note: Provide direct link to microservices CORS configuration guide.',
    sla_deadline_at: new Date(now + 7 * 60 * 60 * 1000).toISOString(), // 7h left
    human_reviewed: false,
    created_at: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'b1a2c3d4-0005-4000-8000-000000000005',
    channel: ChannelEnum.EMAIL,
    customer_email: 'legal@enterprise-corp.de',
    customer_name: 'Klaus Schmidt',
    subject: 'Formal request for erasure of personal data (GDPR Article 17)',
    body: 'We hereby formally request the permanent, irrevocable erasure of all personal data and telemetry logs associated with customer account 991823 within 30 calendar days.',
    status: InquiryStatusEnum.UNASSIGNED,
    department: DepartmentEnum.SECURITY,
    priority: PriorityEnum.P2,
    urgency: 3,
    impact: 3,
    sentiment_score: 0.0,
    churn_risk: false,
    entities: {
      order_id: 'Account-991823',
      customer_deadline: '30 calendar days',
    },
    confidence_score: 0.99,
    triage_rationale:
      'Formal regulatory compliance request under GDPR Article 17. Routed to SECURITY with P2 compliance SLA.',
    bedrock_latency_ms: 605,
    suggested_strategy: ResponseStrategyEnum.ESCALATION,
    suggested_response:
      'Dear Klaus Schmidt, we acknowledge receipt of your data erasure request pursuant to GDPR Article 17. Case SEC-GDPR-2026 has been registered, and our Data Protection Officer (DPO) will provide official certification of data purging within 7 business days.',
    agent_copilot_notes:
      'Internal Note: Mandatory notification to dpo@company.internal required prior to executing physical database purge.',
    sla_deadline_at: new Date(now + 3 * 60 * 60 * 1000).toISOString(), // 3h left
    human_reviewed: false,
    created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'b1a2c3d4-0006-4000-8000-000000000006',
    channel: ChannelEnum.EMAIL,
    customer_email: 'promo@global-marketing-agency.com',
    customer_name: 'Commercial Lead',
    subject: 'Offshore backlink and SEO rank enhancement services',
    body: 'Dear Webmaster, we noticed your website ranking could improve. We offer premium link building packages starting at $99/mo.',
    status: InquiryStatusEnum.UNASSIGNED,
    department: DepartmentEnum.GENERAL,
    priority: PriorityEnum.P4,
    urgency: 1,
    impact: 1,
    sentiment_score: 0.0,
    churn_risk: false,
    entities: {},
    confidence_score: 0.99,
    triage_rationale:
      'Unsolicited external sales cold email (Spam). Zero operational impact.',
    bedrock_latency_ms: 450,
    suggested_strategy: ResponseStrategyEnum.DIRECT_RESOLUTION,
    suggested_response: 'Message automatically archived as irrelevant.',
    agent_copilot_notes: 'Internal Note: No action required. Auto-resolve directly.',
    sla_deadline_at: new Date(now + 23 * 60 * 60 * 1000).toISOString(), // 23h left
    human_reviewed: false,
    created_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'b1a2c3d4-0007-4000-8000-000000000007',
    channel: ChannelEnum.WEB_FORM,
    customer_email: 'sarah.connor@cyberdyne.io',
    customer_name: 'Sarah Connor',
    subject: 'Card decline error when updating corporate billing method',
    body: 'Payment gateway returned error 402 Card Declined when attempting to register a corporate card issued in the United Kingdom.',
    status: InquiryStatusEnum.RESOLVED,
    department: DepartmentEnum.BILLING,
    priority: PriorityEnum.P2,
    urgency: 4,
    impact: 2,
    sentiment_score: -0.4,
    churn_risk: false,
    entities: {
      error_code: '402 Card Declined',
    },
    confidence_score: 0.96,
    triage_rationale: 'Resolved 3DS payment verification failure on corporate billing method.',
    bedrock_latency_ms: 590,
    suggested_strategy: ResponseStrategyEnum.DIRECT_RESOLUTION,
    suggested_response:
      'Hello Sarah, the issuing institution required step-up 3DS two-factor authentication. We have generated a secure confirmation link to complete the authorization.',
    resolution_text:
      'Hello Sarah, 3DS v2 multi-currency authorization has been completed successfully. Your corporate card is verified and the invoice receipt has been issued.',
    assigned_agent_id: '00000000-0000-0000-0000-000000000001',
    claimed_at: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
    resolved_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    human_reviewed: true,
    was_edited: true,
    edit_character_distance: 42,
    sla_deadline_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
  },
];
