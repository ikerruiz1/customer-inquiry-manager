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

interface LoadLogicDetailDrawerProps {
  ticket: Inquiry | null;
  onClose: () => void;
  currentAgent: AgentProfile;
  onResolveTicket: (id: string, resolutionText: string, notes?: string) => void;
  onOpenOverrideModal: () => void;
  onClaimTicket: (id: string) => void;
  isResolving: boolean;
}

export const LoadLogicDetailDrawer: React.FC<LoadLogicDetailDrawerProps> = ({
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
    setResponseText(ticket.suggested_response || '');
    setIsEditingDraft(false);

    // Fetch audit history
    getAuditLogs(ticket.id).then((logs) => setAuditLogs(logs));
  }, [ticket.id, ticket.suggested_response]);

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
        backgroundColor: '#FFFFFF',
        borderLeft: '1px solid rgba(12, 13, 13, 0.1)',
        width: '560px',
        maxWidth: '100%',
        height: '100%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-8px 0 28px rgba(12, 13, 13, 0.08)',
        position: 'relative',
        zIndex: 50,
      }}
    >
      {/* Drawer Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(12, 13, 13, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#FFFFFF',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0C0D0D', fontFamily: 'var(--font-mono)' }}>
            #{ticket.id.substring(0, 8).toUpperCase()}
          </span>
          <span
            style={{
              backgroundColor: 'rgba(12, 13, 13, 0.06)',
              color: '#0C0D0D',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '9999px',
            }}
          >
            {ticket.channel}
          </span>
          {ticket.priority === PriorityEnum.P1 && (
            <span
              style={{
                backgroundColor: '#0C0D0D',
                color: '#FFFFFF',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '9999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Flame size={11} color="#f87171" /> Emergency P1
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          style={{
            padding: '6px',
            borderRadius: '50%',
            border: '1px solid rgba(12, 13, 13, 0.1)',
            backgroundColor: '#FAFAFA',
            color: '#0C0D0D',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.15s ease',
          }}
          title="Close Drawer"
        >
          <X size={15} />
        </button>
      </div>

      {/* Concurrency Warning Banner (Cognito Multi-Agent Collision Lock) */}
      {isClaimedByOther && (
        <div
          style={{
            margin: '14px 20px 0',
            padding: '10px 14px',
            borderRadius: '12px',
            backgroundColor: '#FEF3C7',
            border: '1px solid #FDE68A',
            color: '#92400E',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <Lock size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Concurrency Warning:</strong> Claimed by{' '}
            <strong>{assignedAgent?.name || ticket.assigned_agent_id}</strong>. Read-only inspection mode is active to prevent collisions.
          </div>
        </div>
      )}

      {/* Main Drawer Body */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Section 1: Customer Message Card */}
        <div
          style={{
            backgroundColor: '#FAFAFA',
            border: '1px solid rgba(12, 13, 13, 0.08)',
            borderRadius: '18px',
            padding: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Customer Inquiry
            </span>
            <span style={{ fontSize: '0.72rem', color: '#888888' }}>
              {new Date(ticket.created_at).toLocaleString()}
            </span>
          </div>

          <div style={{ fontSize: '0.96rem', fontWeight: 700, color: '#0C0D0D', marginBottom: '8px' }}>
            {ticket.subject}
          </div>

          <div
            style={{
              fontSize: '0.84rem',
              color: '#333333',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              backgroundColor: '#FFFFFF',
              padding: '12px 14px',
              borderRadius: '12px',
              border: '1px solid rgba(12, 13, 13, 0.06)',
            }}
          >
            {ticket.body}
          </div>

          <div
            style={{
              marginTop: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: '#666666',
            }}
          >
            <span>Sender: <strong style={{ color: '#0C0D0D' }}>{ticket.customer_name}</strong> ({ticket.customer_email})</span>
            <span>Channel: <strong style={{ color: '#0C0D0D' }}>{ticket.channel}</strong></span>
          </div>
        </div>

        {/* Section 2: Explainable AI (XAI) & Latency Card (Sage Styling) */}
        <div
          style={{
            backgroundColor: '#ECF4EE',
            border: '1px solid rgba(12, 13, 13, 0.08)',
            borderRadius: '18px',
            padding: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Brain size={16} color="#0C0D0D" />
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0C0D0D', textTransform: 'uppercase' }}>
                Bedrock Explainable AI (XAI)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: '#FFFFFF',
                  color: '#0C0D0D',
                  fontWeight: 700,
                  border: '1px solid rgba(12, 13, 13, 0.08)',
                }}
              >
                Claude 3.5 Haiku
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: '#0C0D0D',
                  color: '#FFFFFF',
                  fontWeight: 700,
                }}
              >
                {ticket.bedrock_latency_ms || 612} ms
              </span>
            </div>
          </div>

          {/* Confidence Score Bar */}
          <div style={{ marginBottom: '10px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.74rem',
                color: '#444444',
                marginBottom: '4px',
                fontWeight: 600,
              }}
            >
              <span>Model Confidence:</span>
              <strong style={{ color: '#0C0D0D' }}>
                {Math.round((ticket.confidence_score || 0.98) * 100)}%
              </strong>
            </div>
            <div
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(12, 13, 13, 0.08)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.round((ticket.confidence_score || 0.98) * 100)}%`,
                  height: '100%',
                  backgroundColor: '#0C0D0D',
                  borderRadius: '9999px',
                }}
              />
            </div>
          </div>

          {/* Triage Rationale Quote */}
          <div
            style={{
              fontSize: '0.8rem',
              color: '#1a1a1a',
              backgroundColor: '#FFFFFF',
              padding: '10px 12px',
              borderRadius: '12px',
              border: '1px solid rgba(12, 13, 13, 0.08)',
              fontStyle: 'italic',
              lineHeight: 1.5,
            }}
          >
            "{ticket.triage_rationale || 'Clasificación semántica multivariable ejecutada mediante Amazon Bedrock Converse API.'}"
          </div>
        </div>

        {/* Section 3: Extracted Named Entities (NER Chips with 1-click Copy) */}
        <div
          style={{
            backgroundColor: '#FAFAFA',
            border: '1px solid rgba(12, 13, 13, 0.08)',
            borderRadius: '18px',
            padding: '16px',
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#666666', marginBottom: '8px', textTransform: 'uppercase' }}>
            EXTRACTED KEY DATA ENTITIES (NER)
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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
                      gap: '6px',
                      padding: '5px 10px',
                      borderRadius: '8px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid rgba(12, 13, 13, 0.1)',
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease',
                    }}
                    title="Click to copy value"
                  >
                    <span style={{ color: '#666666', textTransform: 'uppercase', fontSize: '0.66rem', fontWeight: 700 }}>
                      {key.replace('_', ' ')}:
                    </span>
                    <strong style={{ color: '#0C0D0D' }}>{displayVal}</strong>
                    {isCopied ? (
                      <Check size={12} color="#16a34a" />
                    ) : (
                      <Copy size={12} color="#888888" />
                    )}
                  </div>
                );
              })
            ) : (
              <span style={{ fontSize: '0.78rem', color: '#777777' }}>
                No structured entities detected in input text.
              </span>
            )}
          </div>
        </div>

        {/* Section 4: Sentiment & Frustration Meter */}
        <div
          style={{
            backgroundColor: '#FAFAFA',
            border: '1px solid rgba(12, 13, 13, 0.08)',
            borderRadius: '18px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#666666', marginBottom: '3px', textTransform: 'uppercase' }}>
              SENTIMENT & FRUSTRATION
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  color: ticket.sentiment_score < -0.5 ? '#dc2626' : ticket.sentiment_score > 0.3 ? '#16a34a' : '#0C0D0D',
                }}
              >
                {ticket.sentiment_score < -0.5
                  ? 'Hostile / Frustrated'
                  : ticket.sentiment_score > 0.3
                  ? 'Positive / Satisfied'
                  : 'Neutral / Transactional'}
              </span>
              <span style={{ fontSize: '0.74rem', color: '#777777' }}>
                (Score: {ticket.sentiment_score})
              </span>
            </div>
          </div>

          {ticket.churn_risk && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#dc2626',
                fontSize: '0.74rem',
                fontWeight: 700,
              }}
            >
              <AlertTriangle size={12} /> Churn Risk Alert
            </span>
          )}
        </div>

        {/* Section 5: Suggested Response Draft (Human-in-the-Loop) */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1.5px solid #0C0D0D',
            borderRadius: '18px',
            padding: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bot size={16} color="#0C0D0D" />
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0C0D0D' }}>
                SUGGESTED RESPONSE DRAFT
              </span>
            </div>
            {ticket.suggested_strategy && (
              <span
                style={{
                  backgroundColor: '#ECF4EE',
                  color: '#0C0D0D',
                  border: '1px solid rgba(12, 13, 13, 0.08)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                }}
              >
                Strategy: {ticket.suggested_strategy}
              </span>
            )}
          </div>

          {/* Confidential Copilot Notes */}
          {ticket.agent_copilot_notes && (
            <div
              style={{
                fontSize: '0.78rem',
                color: '#1a1a1a',
                backgroundColor: '#ECF4EE',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(12, 13, 13, 0.08)',
                marginBottom: '12px',
              }}
            >
              <strong style={{ color: '#0C0D0D' }}>Agent Copilot Guidance:</strong> {ticket.agent_copilot_notes}
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
                padding: '12px',
                borderRadius: '12px',
                backgroundColor: '#FAFAFA',
                border: '1.5px solid #0C0D0D',
                color: '#0C0D0D',
                fontSize: '0.84rem',
                fontFamily: 'var(--font-sans)',
                lineHeight: 1.5,
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          ) : (
            <div
              style={{
                backgroundColor: '#FAFAFA',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid rgba(12, 13, 13, 0.08)',
                fontSize: '0.84rem',
                color: '#0C0D0D',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {responseText || 'No response draft available.'}
            </div>
          )}

          {/* Action Buttons */}
          <div
            style={{
              marginTop: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div>
              {!isResolved && !isClaimedByOther && (
                <button
                  onClick={() => setIsEditingDraft(!isEditingDraft)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '9999px',
                    border: '1px solid rgba(12, 13, 13, 0.15)',
                    backgroundColor: '#FFFFFF',
                    color: '#0C0D0D',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Edit3 size={12} />
                  <span>{isEditingDraft ? 'Cancel Edit' : 'Quick Edit'}</span>
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Claim button if unassigned */}
              {ticket.status === InquiryStatusEnum.UNASSIGNED && (
                <button
                  onClick={() => onClaimTicket(ticket.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '9999px',
                    border: '1px solid rgba(12, 13, 13, 0.15)',
                    backgroundColor: '#FFFFFF',
                    color: '#0C0D0D',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
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
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '9999px',
                    backgroundColor: '#0C0D0D',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'opacity 0.15s ease',
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
                <span style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 700 }}>
                  ✓ Resolved & SLA Clock Frozen
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Section 6: MLOps Override & Audit History */}
        <div
          style={{
            borderTop: '1px solid rgba(12, 13, 13, 0.08)',
            paddingTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={onOpenOverrideModal}
              disabled={isResolved || isClaimedByOther}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '9999px',
                border: '1px solid rgba(12, 13, 13, 0.15)',
                backgroundColor: '#FFFFFF',
                color: '#0C0D0D',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Calibrate model classification with mandatory engineering justification"
            >
              <RotateCcw size={12} />
              <span>Override AI Classification</span>
            </button>

            <button
              onClick={() => setShowAuditLogs(!showAuditLogs)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '9999px',
                border: '1px solid rgba(12, 13, 13, 0.15)',
                backgroundColor: '#FFFFFF',
                color: '#0C0D0D',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
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
                backgroundColor: '#FAFAFA',
                borderRadius: '12px',
                padding: '12px',
                border: '1px solid rgba(12, 13, 13, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '0.74rem',
              }}
            >
              {auditLogs.length === 0 ? (
                <span style={{ color: '#888888' }}>No audit events recorded yet.</span>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      borderBottom: '1px solid rgba(12, 13, 13, 0.06)',
                      paddingBottom: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong style={{ color: '#0C0D0D' }}>{log.action}</strong>
                      <span style={{ color: '#888888' }}>
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ color: '#555555' }}>
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
