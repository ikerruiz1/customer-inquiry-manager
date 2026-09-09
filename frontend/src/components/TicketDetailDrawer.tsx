import React, { useState, useEffect } from 'react';
import {
  X,
  Bot,
  Brain,
  Copy,
  Check,
  Flame,
  AlertTriangle,
  User,
  Send,
  Edit3,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  History,
  Lock,
} from 'lucide-react';
import {
  InquiryStatusEnum,
  PriorityEnum,
} from '../types/inquiry';
import type {
  Inquiry,
  AgentProfile,
  AuditLog,
} from '../types/inquiry';
import { INITIAL_AGENTS } from '../api/mockData';
import { getAuditLogs } from '../api/client';

interface TicketDetailDrawerProps {
  ticket: Inquiry | null;
  onClose: () => void;
  currentAgent: AgentProfile;
  onResolveTicket: (id: string, resolutionText: string, notes?: string) => void;
  onOpenOverrideModal: () => void;
  onClaimTicket: (id: string) => void;
  isResolving: boolean;
}

export const TicketDetailDrawer: React.FC<TicketDetailDrawerProps> = ({
  ticket,
  onClose,
  currentAgent,
  onResolveTicket,
  onOpenOverrideModal,
  onClaimTicket,
  isResolving,
}) => {
  if (!ticket) return null;

  const [isEditingDraft, setIsEditingDraft] = useState<boolean>(false);
  const [responseText, setResponseText] = useState<string>(
    ticket.suggested_response || ''
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showAuditLogs, setShowAuditLogs] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    setResponseText(
      ticket.resolution_text || ticket.suggested_response || ''
    );
    setIsEditingDraft(false);

    // Fetch audit history
    getAuditLogs(ticket.id).then((logs) => setAuditLogs(logs));
  }, [ticket.id]);

  const assignedAgent = INITIAL_AGENTS.find((a) => a.id === ticket.assigned_agent_id);
  const isClaimedByOther =
    ticket.status === InquiryStatusEnum.CLAIMED &&
    ticket.assigned_agent_id !== currentAgent.id;
  const isResolved = ticket.status === InquiryStatusEnum.RESOLVED;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleDispatch = () => {
    onResolveTicket(
      ticket.id,
      responseText,
      isEditingDraft ? 'Resolved with agent custom modifications' : 'Resolved verbatim with Bedrock AI draft'
    );
  };

  const isVerbatim =
    responseText.trim() === (ticket.suggested_response || '').trim();

  return (
    <div
      style={{
        backgroundColor: '#0a0f19',
        borderLeft: '1px solid var(--border-prominent)',
        width: '540px',
        maxWidth: '100%',
        height: '100%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.6)',
        position: 'relative',
        zIndex: 50,
      }}
    >
      {/* Drawer Header */}
      <div
        style={{
          padding: '0.85rem 1.25rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#0d1322',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Ticket #{ticket.id.substring(0, 8)}
          </span>
          <span
            className="badge"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              color: 'var(--text-muted)',
              fontSize: '0.7rem',
            }}
          >
            {ticket.channel}
          </span>
          {ticket.priority === PriorityEnum.P1 && (
            <span className="badge badge-p1" style={{ fontSize: '0.7rem' }}>
              <Flame size={10} /> P1
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          className="btn btn-secondary"
          style={{ padding: '0.3rem', borderRadius: '50%' }}
          title="Close Drawer"
        >
          <X size={15} />
        </button>
      </div>

      {/* Concurrency Warning Banner (Collision Detection) */}
      {isClaimedByOther && (
        <div
          style={{
            margin: '0.8rem 1.25rem 0',
            padding: '0.65rem 0.85rem',
            borderRadius: '6px',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            color: '#fcd34d',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
          }}
        >
          <Lock size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Concurrency Warning:</strong> This ticket is currently claimed by{' '}
            <strong>{assignedAgent?.name || ticket.assigned_agent_id}</strong>. Read-only inspection
            mode is active to prevent double-replies.
          </div>
        </div>
      )}

      {/* Main Drawer Body */}
      <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Section 1: Customer Message */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '0.9rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              ORIGINAL CUSTOMER MESSAGE
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
              {new Date(ticket.created_at).toLocaleString()}
            </span>
          </div>

          <div style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.4rem' }}>
            {ticket.subject}
          </div>

          <div
            style={{
              fontSize: '0.82rem',
              color: '#cbd5e1',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              background: 'rgba(0, 0, 0, 0.25)',
              padding: '0.75rem',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            {ticket.body}
          </div>

          <div
            style={{
              marginTop: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.72rem',
              color: 'var(--text-dim)',
            }}
          >
            <span>Remitente: <strong>{ticket.customer_name}</strong> ({ticket.customer_email})</span>
            <span>Canal: <strong>{ticket.channel}</strong></span>
          </div>
        </div>

        {/* Section 2: Explainable AI (XAI) & Latency Card */}
        <div
          style={{
            background: 'rgba(59, 130, 246, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '8px',
            padding: '0.9rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Brain size={16} color="#60a5fa" />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#93c5fd' }}>
                EXPLAINABLE AI TRIAGE (Amazon Bedrock)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '0.15rem 0.4rem',
                  borderRadius: '4px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#bfdbfe',
                }}
              >
                Claude Haiku 4.5
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '0.15rem 0.4rem',
                  borderRadius: '4px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#a7f3d0',
                }}
              >
                {ticket.bedrock_latency_ms || 615} ms
              </span>
            </div>
          </div>

          {/* Confidence Score Bar */}
          <div style={{ marginBottom: '0.6rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                marginBottom: '0.2rem',
              }}
            >
              <span>Model Confidence Score:</span>
              <strong style={{ color: '#60a5fa' }}>
                {Math.round((ticket.confidence_score || 0.98) * 100)}%
              </strong>
            </div>
            <div
              style={{
                width: '100%',
                height: '5px',
                borderRadius: '3px',
                background: 'rgba(255, 255, 255, 0.1)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.round((ticket.confidence_score || 0.98) * 100)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                }}
              />
            </div>
          </div>

          {/* Triage Rationale */}
          <div
            style={{
              fontSize: '0.78rem',
              color: '#cbd5e1',
              background: 'rgba(15, 23, 42, 0.6)',
              padding: '0.6rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              fontStyle: 'italic',
            }}
          >
            "{ticket.triage_rationale || 'Clasificación semántica multivariable ejecutada mediante Amazon Bedrock Converse API.'}"
          </div>
        </div>

        {/* Section 3: Extracted Named Entities (NER Chips) */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '0.85rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            EXTRACTED KEY DATA ENTITIES (NER)
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            {ticket.entities && Object.keys(ticket.entities).length > 0 ? (
              Object.entries(ticket.entities).map(([key, val]) => {
                if (!val) return null;
                const displayVal = String(val);
                const isCopied = copiedKey === key;
                return (
                  <div
                    key={key}
                    onClick={() => handleCopy(displayVal, key)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.25rem 0.55rem',
                      borderRadius: '5px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-prominent)',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease',
                    }}
                    title="Click to copy value"
                  >
                    <span style={{ color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: '0.65rem' }}>
                      {key.replace('_', ' ')}:
                    </span>
                    <strong style={{ color: '#38bdf8' }}>{displayVal}</strong>
                    {isCopied ? (
                      <Check size={12} color="#34d399" />
                    ) : (
                      <Copy size={12} color="var(--text-dim)" />
                    )}
                  </div>
                );
              })
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                No structured entities detected in input text.
              </span>
            )}
          </div>
        </div>

        {/* Section 4: Sentiment & Frustration Meter */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
              SENTIMENT & FRUSTRATION
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: ticket.sentiment_score < -0.5 ? '#f87171' : ticket.sentiment_score > 0.3 ? '#34d399' : '#cbd5e1',
                }}
              >
                {ticket.sentiment_score < -0.5
                  ? 'Hostile / Frustrated'
                  : ticket.sentiment_score > 0.3
                  ? 'Positive / Satisfied'
                  : 'Neutral / Transactional'}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                (Score: {ticket.sentiment_score})
              </span>
            </div>
          </div>

          {ticket.churn_risk && (
            <span
              className="badge pulse-critical"
              style={{
                background: 'rgba(239, 68, 68, 0.25)',
                color: '#fca5a5',
                border: '1px solid #ef4444',
                fontSize: '0.72rem',
              }}
            >
              <AlertTriangle size={12} /> Churn Risk Alert
            </span>
          )}
        </div>

        {/* Section 5: Suggested Response Draft (Human-in-the-Loop) */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-prominent)',
            borderRadius: '8px',
            padding: '0.9rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Bot size={15} color="#c084fc" />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e9d5ff' }}>
                SUGGESTED RESPONSE DRAFT
              </span>
            </div>
            {ticket.suggested_strategy && (
              <span
                className="badge"
                style={{
                  background: 'rgba(192, 132, 252, 0.15)',
                  color: '#e9d5ff',
                  border: '1px solid rgba(192, 132, 252, 0.3)',
                  fontSize: '0.68rem',
                }}
              >
                Strategy: {ticket.suggested_strategy}
              </span>
            )}
          </div>

          {/* Confidential Agent Copilot Note */}
          {ticket.agent_copilot_notes && (
            <div
              style={{
                background: 'rgba(30, 58, 138, 0.25)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                borderRadius: '6px',
                padding: '0.6rem 0.75rem',
                fontSize: '0.75rem',
                color: '#93c5fd',
                marginBottom: '0.7rem',
              }}
            >
              <strong>Agent Copilot Guidance:</strong> {ticket.agent_copilot_notes}
            </div>
          )}

          {/* Response Text Editor or Preview */}
          {isEditingDraft ? (
            <textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              rows={6}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '6px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-prominent)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                fontFamily: 'var(--font-sans)',
                lineHeight: 1.5,
                outline: 'none',
                resize: 'vertical',
              }}
            />
          ) : (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: '0.82rem',
                color: '#e2e8f0',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}
            >
              {responseText || 'No response draft available.'}
            </div>
          )}

          {/* Action Buttons */}
          <div
            style={{
              marginTop: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div>
              {!isResolved && !isClaimedByOther && (
                <button
                  onClick={() => setIsEditingDraft(!isEditingDraft)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                >
                  <Edit3 size={12} />
                  <span>{isEditingDraft ? 'Cancel Editing' : 'Quick Edit'}</span>
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {/* Claim button if unassigned */}
              {ticket.status === InquiryStatusEnum.UNASSIGNED && (
                <button
                  onClick={() => onClaimTicket(ticket.id)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem' }}
                >
                  <User size={13} />
                  <span>Claim Ticket</span>
                </button>
              )}

              {/* Approve & Dispatch Button */}
              {!isResolved && !isClaimedByOther && (
                <button
                  onClick={handleDispatch}
                  disabled={isResolving || !responseText.trim()}
                  className="btn btn-success"
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.45rem 0.95rem',
                    boxShadow: '0 0 12px rgba(16, 185, 129, 0.3)',
                  }}
                  title="Freeze SLA and dispatch response to customer"
                >
                  <Send size={13} />
                  <span>
                    {isVerbatim ? '1-Click Approve & Dispatch' : 'Dispatch Custom Response'}
                  </span>
                </button>
              )}

              {isResolved && (
                <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>
                  ✓ Resolved & SLA Clock Frozen
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Section 6: MLOps Override & Audit History */}
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '0.8rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={onOpenOverrideModal}
              disabled={isResolved || isClaimedByOther}
              className="btn btn-secondary"
              style={{ fontSize: '0.74rem', padding: '0.3rem 0.65rem' }}
              title="Calibrate model classification with mandatory engineering justification"
            >
              <RotateCcw size={12} />
              <span>Override AI Classification</span>
            </button>

            <button
              onClick={() => setShowAuditLogs(!showAuditLogs)}
              className="btn btn-secondary"
              style={{ fontSize: '0.74rem', padding: '0.3rem 0.65rem' }}
            >
              <History size={12} />
              <span>Audit Trail ({auditLogs.length})</span>
              {showAuditLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {/* Collapsible Audit Trail */}
          {showAuditLogs && (
            <div
              style={{
                background: 'var(--bg-card)',
                borderRadius: '6px',
                padding: '0.65rem',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                fontSize: '0.72rem',
              }}
            >
              {auditLogs.length === 0 ? (
                <span style={{ color: 'var(--text-dim)' }}>No audit events recorded yet.</span>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      paddingBottom: '0.3rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong style={{ color: '#38bdf8' }}>{log.action}</strong>
                      <span style={{ color: 'var(--text-dim)' }}>
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      Agent ID: {log.agent_id} | Reason: {log.reason || 'N/A'}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
