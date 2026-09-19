import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Flame,
  History,
  Lock,
  RotateCcw,
  Send,
  User,
  X,
  MessageSquare,
  Pause,
  Play,
} from 'lucide-react';
import {
  getAuditLogs,
  getInquiryMessages,
  postInquiryMessage,
  postCustomerReply,
  getInquiry,
  getCopilotDraft,
} from '../api/client';
import type {
  AgentProfile,
  AuditLog,
  Inquiry,
  InquiryMessage,
} from '../types/inquiry';
import {
  InquiryStatusEnum,
  PriorityEnum,
  MessageActionEnum,
} from '../types/inquiry';

const INTERNAL_TELEMETRY_KEYS = new Set([
  'confidence_score',
  'bedrock_latency_ms',
  'latency_ms',
  'model_id',
  'input_tokens',
  'output_tokens',
  'cost_eur',
  'sender_verification',
  'sla_warning_alerted',
  'sla_breach_alerted',
]);

interface LoadLogicDetailDrawerProps {
  ticket: Inquiry | null;
  onClose: () => void;
  currentAgent: AgentProfile;
  onResolveTicket: (id: string, resolutionText: string, notes?: string) => void;
  onOpenOverrideModal: () => void;
  onClaimTicket: (id: string) => void;
  isResolving: boolean;
  operators?: AgentProfile[];
  onTicketUpdated?: (updated: Inquiry) => void;
}

export const LoadLogicDetailDrawer: React.FC<LoadLogicDetailDrawerProps> = ({
  ticket: initialTicket,
  onClose,
  currentAgent,
  onResolveTicket,
  onOpenOverrideModal,
  onClaimTicket,
  isResolving,
  operators,
  onTicketUpdated,
}) => {
  if (!initialTicket) return null;

  const [ticket, setTicket] = useState<Inquiry>(initialTicket);
  const [messages, setMessages] = useState<InquiryMessage[]>(initialTicket.messages || []);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [actionType, setActionType] = useState<MessageActionEnum>('REPLY');
  const [messageText, setMessageText] = useState<string>(initialTicket.suggested_response || '');
  const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);
  const defaultSimText = 'Here are the requested diagnostic details: verified server issue, attached logs.';
  const [simulatedReplyText, setSimulatedReplyText] = useState<string>(defaultSimText);
  const [showSimulationWidget, setShowSimulationWidget] = useState<boolean>(true);
  const [isSendingCustomerReply, setIsSendingCustomerReply] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showAuditLogs, setShowAuditLogs] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dispatchToast, setDispatchToast] = useState<string | null>(null);

  // Derive conversation state
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const isAwaitingCustomer =
    lastMessage?.sender_type === 'AGENT' ||
    lastMessage?.sender_type === 'AI_COPILOT' ||
    ticket.status === InquiryStatusEnum.PENDING_CUSTOMER;

  useEffect(() => {
    setTicket(initialTicket);
    setMessageText(initialTicket.suggested_response || '');
    setSimulatedReplyText(defaultSimText);

    // Initial action selection based on status
    if (initialTicket.status === InquiryStatusEnum.PENDING_CUSTOMER) {
      setActionType(MessageActionEnum.INTERNAL_NOTE);
    } else {
      setActionType(MessageActionEnum.REPLY);
    }

    // Fetch fresh chronological message thread
    setIsLoadingMessages(true);
    getInquiryMessages(initialTicket.id)
      .then((msgs) => {
        if (msgs && msgs.length > 0) {
          setMessages(msgs);
          const lastM = msgs[msgs.length - 1];
          if (lastM && (lastM.sender_type === 'AGENT' || lastM.sender_type === 'AI_COPILOT')) {
            setActionType(MessageActionEnum.INTERNAL_NOTE);
          }
        } else if (initialTicket.messages && initialTicket.messages.length > 0) {
          setMessages(initialTicket.messages);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch messages:', err);
        if (initialTicket.messages) setMessages(initialTicket.messages);
      })
      .finally(() => setIsLoadingMessages(false));

    // Fetch audit history
    getAuditLogs(initialTicket.id).then((logs) => setAuditLogs(logs));
  }, [initialTicket.id]);

  // Real-time synchronization while drawer is open (picks up external emails & replies)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [freshTicket, freshMsgs] = await Promise.all([
          getInquiry(ticket.id),
          getInquiryMessages(ticket.id),
        ]);
        if (freshMsgs && freshMsgs.length !== messages.length) {
          setMessages(freshMsgs);
          setTicket(freshTicket);
          if (onTicketUpdated) onTicketUpdated(freshTicket);

          // If latest message is from customer, auto-load reply draft
          const lastM = freshMsgs[freshMsgs.length - 1];
          if (lastM && lastM.sender_type === 'CUSTOMER') {
            setActionType(MessageActionEnum.REPLY);
            getCopilotDraft(ticket.id, MessageActionEnum.REPLY).then((d) => {
              if (d) setMessageText(d);
            });
          }
        } else if (freshTicket.status !== ticket.status || freshTicket.sla_remaining_seconds !== ticket.sla_remaining_seconds) {
          setTicket(freshTicket);
        }
      } catch {
        // Silently ignore background polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [ticket.id, messages.length, ticket.status]);

  const assignedAgent = operators?.find(
    (a) => a.id === ticket.assigned_agent_id || a.email === ticket.assigned_agent_id
  );
  const isClaimedByOther =
    ticket.status === InquiryStatusEnum.CLAIMED &&
    ticket.assigned_agent_id !== currentAgent.id;
  const isResolved = ticket.status === InquiryStatusEnum.RESOLVED;
  const isPendingCustomer = ticket.status === InquiryStatusEnum.PENDING_CUSTOMER;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleSelectAction = async (newType: MessageActionEnum) => {
    setActionType(newType);
    try {
      const draft = await getCopilotDraft(ticket.id, newType);
      if (draft) {
        setMessageText(draft);
      }
    } catch (err) {
      console.warn('Failed to fetch copilot draft for action:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || isSendingMessage) return;
    setIsSendingMessage(true);
    try {
      const isInfoRequest = actionType === 'REQUEST_INFO';
      
      // Optimistically update local state if pausing SLA
      if (isInfoRequest) {
        setTicket((prev) => ({
          ...prev,
          status: InquiryStatusEnum.PENDING_CUSTOMER,
          sla_paused_at: new Date().toISOString(),
        }));
      }

      const newMsg = await postInquiryMessage(ticket.id, {
        body: messageText.trim(),
        action: actionType,
      });
      setMessages((prev) => [...prev, newMsg]);
      setMessageText('');

      if (actionType === 'REPLY' || actionType === 'REQUEST_INFO') {
        setDispatchToast(`📧 Outbound email dispatched to ${ticket.customer_email}`);
        setTimeout(() => setDispatchToast(null), 4500);
      }

      // Refresh inquiry state to sync SLA pauses and status
      const freshTicket = await getInquiry(ticket.id);
      setTicket(freshTicket);
      if (onTicketUpdated) {
        onTicketUpdated(freshTicket);
      }
      getAuditLogs(ticket.id).then((logs) => setAuditLogs(logs));
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleSimulateCustomerReply = async () => {
    if (isSendingCustomerReply) return;
    setIsSendingCustomerReply(true);
    const replyBody = simulatedReplyText.trim() || defaultSimText;
    try {
      // Optimistically resume ticket locally
      setTicket((prev) => ({
        ...prev,
        status: prev.assigned_agent_id ? InquiryStatusEnum.CLAIMED : InquiryStatusEnum.UNASSIGNED,
        sla_paused_at: undefined,
      }));

      const newMsg = await postCustomerReply(ticket.id, {
        body: replyBody,
        customer_name: ticket.customer_name,
        customer_email: ticket.customer_email,
      });
      setMessages((prev) => [...prev, newMsg]);
      setSimulatedReplyText(defaultSimText);

      setDispatchToast(`📥 Customer response received! SLA countdown resumed.`);
      setTimeout(() => setDispatchToast(null), 4500);

      // Refresh inquiry state (which unpauses SLA and extends deadline)
      const freshTicket = await getInquiry(ticket.id);
      setTicket(freshTicket);
      if (onTicketUpdated) {
        onTicketUpdated(freshTicket);
      }
      getAuditLogs(ticket.id).then((logs) => setAuditLogs(logs));

      // Auto-load resolution reply draft now that customer answered
      setActionType(MessageActionEnum.REPLY);
      getCopilotDraft(ticket.id, MessageActionEnum.REPLY).then((d) => {
        if (d) setMessageText(d);
      });
    } catch (err: any) {
      alert(err.message || 'Failed to simulate customer reply');
    } finally {
      setIsSendingCustomerReply(false);
    }
  };

  const handleDispatchResolution = () => {
    onResolveTicket(
      ticket.id,
      messageText.trim() || ticket.suggested_response || 'Resolved by support operator',
      'Resolved via Operations Console'
    );
  };

  // Remaining SLA countdown formatting
  const remainingSec = ticket.sla_remaining_seconds ?? 0;
  const remHours = Math.floor(Math.abs(remainingSec) / 3600);
  const remMinutes = Math.floor((Math.abs(remainingSec) % 3600) / 60);
  const isOverdue = remainingSec < 0 && !isResolved;

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid rgba(12, 13, 13, 0.12)',
        borderRadius: '24px',
        width: 'min(1180px, 94vw)',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
        position: 'relative',
        zIndex: 50,
        overflow: 'hidden',
        animation: 'fadeInMenu 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Modal Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(12, 13, 13, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#FFFFFF',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0C0D0D', fontFamily: 'var(--font-mono)' }}>
            #{ticket.id.substring(0, 8).toUpperCase()}
          </span>
          <span
            style={{
              backgroundColor: 'rgba(12, 13, 13, 0.06)',
              color: '#0C0D0D',
              fontSize: '0.74rem',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '9999px',
            }}
          >
            {ticket.channel}
          </span>
          <span
            style={{
              backgroundColor: '#EFF6FF',
              color: '#2563EB',
              fontSize: '0.74rem',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '9999px',
            }}
          >
            {ticket.department}
          </span>
          <span
            style={{
              backgroundColor: isResolved
                ? '#ECFDF5'
                : isPendingCustomer
                  ? '#FEF3C7'
                  : '#EFF6FF',
              color: isResolved
                ? '#047857'
                : isPendingCustomer
                  ? '#B45309'
                  : '#1D4ED8',
              fontSize: '0.74rem',
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: '9999px',
              border: isPendingCustomer ? '1px solid #F59E0B' : 'none',
            }}
          >
            {isPendingCustomer ? '⏸ PENDING CUSTOMER (SLA PAUSED)' : ticket.status}
          </span>
          {ticket.priority === PriorityEnum.P1 && (
            <span
              style={{
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                fontSize: '0.74rem',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '9999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
              }}
            >
              <Flame size={12} color="#FFFFFF" /> Emergency P1
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          style={{
            padding: '7px',
            borderRadius: '50%',
            border: '1px solid rgba(12, 13, 13, 0.1)',
            backgroundColor: '#FAFAFA',
            color: '#0C0D0D',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          title="Close Dialog"
        >
          <X size={17} />
        </button>
      </div>

      {/* Concurrency Warning Banner (Cognito Multi-Agent Collision Lock) */}
      {isClaimedByOther && (
        <div
          style={{
            margin: '14px 24px 0',
            padding: '10px 16px',
            borderRadius: '12px',
            backgroundColor: '#FEF3C7',
            border: '1px solid #FDE68A',
            color: '#92400E',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Lock size={15} style={{ flexShrink: 0 }} />
          <div>
            <strong>Concurrency Warning:</strong> Claimed by{' '}
            <strong>{assignedAgent?.name || ticket.assigned_agent_id}</strong>. Read-only inspection mode is active to prevent collisions.
          </div>
        </div>
      )}

      {/* Main Modal Grid Body: 2-Column Layout */}
      <div
        style={{
          padding: '24px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: '24px',
          overflowY: 'auto',
          maxHeight: 'calc(92vh - 75px)',
          boxSizing: 'border-box',
        }}
      >
        {/* LEFT COLUMN: Ticket Summary, Conversation Timeline & Response Composer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Section 1: Customer Ticket Summary Card */}
          <div
            style={{
              backgroundColor: '#FAFAFA',
              border: '1px solid rgba(12, 13, 13, 0.08)',
              borderRadius: '18px',
              padding: '18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Customer Inquiry Overview
              </span>
              <span style={{ fontSize: '0.72rem', color: '#888888' }}>
                {new Date(ticket.created_at).toLocaleString()}
              </span>
            </div>

            <div style={{ fontSize: '1.02rem', fontWeight: 800, color: '#0C0D0D', marginBottom: '10px' }}>
              {ticket.subject}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.76rem',
                color: '#666666',
                borderTop: '1px solid rgba(12, 13, 13, 0.06)',
                paddingTop: '8px',
              }}
            >
              <span>Sender: <strong style={{ color: '#0C0D0D' }}>{ticket.customer_name}</strong> ({ticket.customer_email})</span>
              <span>Channel: <strong style={{ color: '#0C0D0D' }}>{ticket.channel}</strong></span>
            </div>
          </div>

          {/* Section 2: Extracted Key Data Entities (NER Chips with 1-click Copy) */}
          <div
            style={{
              backgroundColor: '#FAFAFA',
              border: '1px solid rgba(12, 13, 13, 0.08)',
              borderRadius: '18px',
              padding: '16px 18px',
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#666666', marginBottom: '8px', textTransform: 'uppercase' }}>
              EXTRACTED KEY DATA ENTITIES (NER)
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(() => {
                const businessEntities = Object.entries(ticket.entities || {}).filter(
                  ([key, val]) => val && typeof val !== 'object' && !INTERNAL_TELEMETRY_KEYS.has(key)
                );
                if (businessEntities.length === 0) {
                  return (
                    <span style={{ fontSize: '0.78rem', color: '#777777' }}>
                      No structured business entities detected in input text.
                    </span>
                  );
                }
                return businessEntities.map(([key, val]) => {
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
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <strong style={{ color: '#0C0D0D' }}>{displayVal}</strong>
                      {isCopied ? (
                        <Check size={12} color="#16a34a" />
                      ) : (
                        <Copy size={12} color="#888888" />
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Section 3: Interactive Multi-Turn Conversation Thread */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid rgba(12, 13, 13, 0.1)',
              borderRadius: '18px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={16} color="#0C0D0D" />
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0C0D0D', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Conversation Thread ({messages.length || 1})
                </span>
              </div>
            </div>

            {/* Message Bubble List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
              {isLoadingMessages ? (
                <div style={{ textAlign: 'center', padding: '16px', color: '#64748B', fontSize: '0.8rem' }}>
                  Syncing conversation thread...
                </div>
              ) : messages.length === 0 ? (
                // Fallback to opening body if messages list is empty
                <div
                  style={{
                    backgroundColor: '#FAFAFA',
                    border: '1px solid rgba(12, 13, 13, 0.08)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#1D4ED8' }}>
                      Customer: {ticket.customer_name}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#888888' }}>
                      {new Date(ticket.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#1F2937', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {ticket.body}
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isCustomer = msg.sender_type === 'CUSTOMER';
                  const isInternal = msg.is_internal_note;

                  return (
                    <div
                      key={msg.id || idx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignSelf: isInternal ? 'stretch' : isCustomer ? 'flex-start' : 'flex-end',
                        maxWidth: isInternal ? '100%' : '88%',
                        width: isInternal ? '100%' : 'auto',
                      }}
                    >
                      {/* Sender Meta Header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginBottom: '4px',
                          fontSize: '0.72rem',
                          justifyContent: isInternal ? 'flex-start' : isCustomer ? 'flex-start' : 'flex-end',
                        }}
                      >
                        {isInternal ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#B45309', fontWeight: 800 }}>
                            <Lock size={11} /> Team Internal Note • {msg.sender_name}
                          </span>
                        ) : isCustomer ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#1D4ED8', fontWeight: 700 }}>
                            <User size={11} /> Customer: {msg.sender_name}
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#047857', fontWeight: 700 }}>
                            <Bot size={11} /> Support Operator: {msg.sender_name}
                          </span>
                        )}
                        <span style={{ color: '#9CA3AF', fontSize: '0.68rem' }}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Message Bubble Body */}
                      <div
                        style={{
                          padding: '12px 16px',
                          borderRadius: '14px',
                          fontSize: '0.84rem',
                          lineHeight: 1.55,
                          whiteSpace: 'pre-wrap',
                          backgroundColor: isInternal
                            ? '#FEF3C7'
                            : isCustomer
                              ? '#F8FAFC'
                              : '#ECFDF5',
                          border: isInternal
                            ? '1px solid #FDE68A'
                            : isCustomer
                              ? '1px solid rgba(12, 13, 13, 0.08)'
                              : '1px solid #A7F3D0',
                          color: isInternal
                            ? '#92400E'
                            : '#0F172A',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        }}
                      >
                        {msg.body}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* SLA Clock Paused Alert Box & Simulation Tool */}
            {isPendingCustomer && (
              <div
                style={{
                  backgroundColor: '#FEF3C7',
                  border: '1.5px dashed #F59E0B',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#B45309', fontWeight: 800, fontSize: '0.82rem' }}>
                    <Pause size={14} />
                    <span>SLA CLOCK FROZEN (PENDING CUSTOMER)</span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      backgroundColor: '#FFFFFF',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      border: '1px solid #FCD34D',
                      color: '#92400E',
                      fontWeight: 700,
                    }}
                  >
                    Paused {Math.max(1, Math.round(((ticket.total_paused_seconds || 0) + (ticket.sla_paused_at ? (Date.now() - new Date(ticket.sla_paused_at).getTime()) / 1000 : 0)) / 60))}m ago
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#92400E', lineHeight: 1.45 }}>
                  The support agent requested additional information. In ITIL enterprise operations, the SLA countdown is halted so operators are not penalized while awaiting customer reply.
                </p>

                {/* Simulated Customer Reply Test Tool */}
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '10px',
                    padding: '12px',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0C0D0D' }}>
                      🧪 Interactive Simulation: Receive Customer Response
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSimulationWidget(!showSimulationWidget)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#92400E',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      {showSimulationWidget ? 'Hide Tool' : 'Show Tool'}
                    </button>
                  </div>

                  {showSimulationWidget && (
                    <>
                      <input
                        type="text"
                        value={simulatedReplyText}
                        onChange={(e) => setSimulatedReplyText(e.target.value)}
                        placeholder="e.g. Here is our error screenshot and system logs"
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(12, 13, 13, 0.15)',
                          fontSize: '0.82rem',
                          outline: 'none',
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={handleSimulateCustomerReply}
                          disabled={isSendingCustomerReply}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            borderRadius: '9999px',
                            backgroundColor: '#D97706',
                            color: '#FFFFFF',
                            border: 'none',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <Play size={12} />
                          <span>{isSendingCustomerReply ? 'Resuming SLA...' : 'Simulate Customer Reply & Resume Clock'}</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Response & Action Composer */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1.5px solid #0C0D0D',
              borderRadius: '18px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Header & Copilot Suggestion Pill */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Bot size={16} color="#0C0D0D" />
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0C0D0D', textTransform: 'uppercase' }}>
                  Action & Response Composer
                </span>
              </div>
            </div>

            {/* Outbound Dispatch Confirmation Toast */}
            {dispatchToast && (
              <div
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  color: '#065F46',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  animation: 'fadeInMenu 0.15s ease-out',
                }}
              >
                <Check size={14} color="#059669" />
                <span>{dispatchToast}</span>
              </div>
            )}

            {/* Awaiting Customer State Alert Banner */}
            {!isResolved && !isClaimedByOther && isAwaitingCustomer && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #FCD34D',
                  color: '#92400E',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 600,
                }}
              >
                <Pause size={14} color="#D97706" />
                <span>
                  <strong>Awaiting customer reply:</strong> We contacted {ticket.customer_email}. We are waiting for the customer to reply before drafting a final resolution. You can document internal team notes or dispatch a follow-up.
                </span>
              </div>
            )}

            {/* Action Mode Selector Tabs (Adaptive according to conversation state) */}
            {!isResolved && !isClaimedByOther && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                {isAwaitingCustomer ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSelectAction(MessageActionEnum.INTERNAL_NOTE)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        border: actionType === 'INTERNAL_NOTE' ? '1.5px solid #6B7280' : '1px solid rgba(107, 114, 128, 0.2)',
                        backgroundColor: actionType === 'INTERNAL_NOTE' ? '#374151' : '#F9FAFB',
                        color: actionType === 'INTERNAL_NOTE' ? '#FFFFFF' : '#374151',
                      }}
                    >
                      🔒 Team Internal Note
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectAction(MessageActionEnum.REPLY)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        border: actionType === 'REPLY' ? '1.5px solid #0C0D0D' : '1px solid rgba(12, 13, 13, 0.15)',
                        backgroundColor: actionType === 'REPLY' ? '#0C0D0D' : '#FFFFFF',
                        color: actionType === 'REPLY' ? '#FFFFFF' : '#0C0D0D',
                      }}
                    >
                      💬 Send Follow-Up to Customer
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSelectAction(MessageActionEnum.REPLY)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        border: actionType === 'REPLY' ? '1.5px solid #0C0D0D' : '1px solid rgba(12, 13, 13, 0.15)',
                        backgroundColor: actionType === 'REPLY' ? '#0C0D0D' : '#FFFFFF',
                        color: actionType === 'REPLY' ? '#FFFFFF' : '#0C0D0D',
                      }}
                    >
                      💬 Reply to Customer
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectAction(MessageActionEnum.REQUEST_INFO)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        border: actionType === 'REQUEST_INFO' ? '1.5px solid #F59E0B' : '1px solid rgba(245, 158, 11, 0.3)',
                        backgroundColor: actionType === 'REQUEST_INFO' ? '#F59E0B' : '#FFFBEB',
                        color: actionType === 'REQUEST_INFO' ? '#FFFFFF' : '#B45309',
                      }}
                      title="Ask customer for info and freeze SLA timer"
                    >
                      ⏸ Ask Info & Pause SLA
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectAction(MessageActionEnum.INTERNAL_NOTE)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        border: actionType === 'INTERNAL_NOTE' ? '1.5px solid #6B7280' : '1px solid rgba(107, 114, 128, 0.2)',
                        backgroundColor: actionType === 'INTERNAL_NOTE' ? '#374151' : '#F9FAFB',
                        color: actionType === 'INTERNAL_NOTE' ? '#FFFFFF' : '#374151',
                      }}
                    >
                      🔒 Team Internal Note
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Contextual Action Notification Banner */}
            {!isResolved && !isClaimedByOther && (
              <div
                style={{
                  fontSize: '0.76rem',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: actionType === 'REQUEST_INFO'
                    ? '#FFFBEB'
                    : actionType === 'INTERNAL_NOTE'
                      ? '#F3F4F6'
                      : '#F0FDF4',
                  color: actionType === 'REQUEST_INFO'
                    ? '#92400E'
                    : actionType === 'INTERNAL_NOTE'
                      ? '#4B5563'
                      : '#166534',
                  border: actionType === 'REQUEST_INFO'
                    ? '1px solid #FDE68A'
                    : actionType === 'INTERNAL_NOTE'
                      ? '1px solid #E5E7EB'
                      : '1px solid #BBF7D0',
                }}
              >
                {actionType === 'REQUEST_INFO' && (
                  <span>
                    <strong>⏸ SLA Freeze:</strong> Sending this message will transition the ticket to <strong>PENDING_CUSTOMER</strong> and pause the SLA countdown until customer replies.
                  </span>
                )}
                {actionType === 'INTERNAL_NOTE' && (
                  <span>
                    <strong>🔒 Confidential Note:</strong> Visible only to internal support agents and recorded in the audit log. The customer will NOT see this note.
                  </span>
                )}
                {actionType === 'REPLY' && (
                  <span>
                    <strong>💬 Customer Message:</strong> Sent directly to customer and logged in conversation thread. First reply registers First Response SLA.
                  </span>
                )}
              </div>
            )}

            {/* Textarea Composer */}
            {!isResolved && !isClaimedByOther ? (
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={5}
                placeholder={
                  actionType === 'REQUEST_INFO'
                    ? 'Ask the customer for necessary files, logs, or error codes to continue triage...'
                    : actionType === 'INTERNAL_NOTE'
                      ? 'Enter confidential team notes, investigation findings, or handover instructions...'
                      : 'Type message to customer or review the AI copilot suggested draft...'
                }
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  backgroundColor: '#FAFAFA',
                  border: '1.5px solid rgba(12, 13, 13, 0.15)',
                  color: '#0C0D0D',
                  fontSize: '0.86rem',
                  fontFamily: 'var(--font-sans)',
                  lineHeight: 1.55,
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  backgroundColor: '#FAFAFA',
                  fontSize: '0.84rem',
                  color: '#4B5563',
                }}
              >
                {isResolved
                  ? `Ticket resolved on ${new Date(ticket.resolved_at || ticket.updated_at).toLocaleString()}. Resolution text: "${ticket.resolution_text || 'Completed'}"`
                  : 'Ticket is currently locked by another operator.'}
              </div>
            )}

            {/* Bottom Actions Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                borderTop: '1px solid rgba(12, 13, 13, 0.06)',
                paddingTop: '10px',
              }}
            >
              <div>
                {ticket.status === InquiryStatusEnum.UNASSIGNED && (
                  <button
                    onClick={() => onClaimTicket(ticket.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '7px 14px',
                      borderRadius: '9999px',
                      border: '1px solid rgba(12, 13, 13, 0.15)',
                      backgroundColor: '#FFFFFF',
                      color: '#0C0D0D',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <User size={13} />
                    <span>Claim Ticket</span>
                  </button>
                )}
              </div>

              {!isResolved && !isClaimedByOther && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Primary Send Button */}
                  <button
                    onClick={handleSendMessage}
                    disabled={isSendingMessage || !messageText.trim()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '9999px',
                      backgroundColor: actionType === 'REQUEST_INFO' ? '#D97706' : '#0C0D0D',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                    }}
                  >
                    <Send size={13} />
                    <span>
                      {isSendingMessage
                        ? 'Dispatching...'
                        : actionType === 'REQUEST_INFO'
                          ? 'Ask Info & Freeze SLA'
                          : actionType === 'INTERNAL_NOTE'
                            ? 'Post Internal Note'
                            : 'Send Customer Reply'}
                    </span>
                  </button>

                  {/* Resolve and Close Ticket Button */}
                  <button
                    onClick={handleDispatchResolution}
                    disabled={isResolving}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '9999px',
                      backgroundColor: '#059669',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
                    }}
                    title="Mark ticket as resolved and permanently stop SLA clock"
                  >
                    <Check size={13} />
                    <span>{isResolving ? 'Resolving...' : 'Resolve Ticket'}</span>
                  </button>
                </div>
              )}

              {isResolved && (
                <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={14} /> Ticket Resolved & Closed
                </span>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Operations Center, Dual SLA Tracking & AI Telemetry */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Section: Operator Ownership & Lifecycle Card */}
          {(ticket.assigned_agent_id || ticket.claimed_at || ticket.status !== InquiryStatusEnum.UNASSIGNED) && (
            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid rgba(12, 13, 13, 0.1)',
                borderRadius: '18px',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Operator Assignment & Ownership
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: isResolved
                      ? '#ECFDF5'
                      : isPendingCustomer
                        ? '#FEF3C7'
                        : '#EFF6FF',
                    color: isResolved
                      ? '#047857'
                      : isPendingCustomer
                        ? '#B45309'
                        : '#1D4ED8',
                    border: isResolved ? '1px solid #A7F3D0' : isPendingCustomer ? '1px solid #FDE68A' : '1px solid #BFDBFE',
                  }}
                >
                  {isResolved
                    ? 'Resolved'
                    : isPendingCustomer
                      ? 'Waiting Customer (Paused)'
                      : 'Active In Triage'}
                </span>
              </div>

              {/* Operator Info Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    backgroundColor: assignedAgent?.color || '#3b82f6',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {assignedAgent?.initials || (ticket.assigned_agent_id ? ticket.assigned_agent_id.slice(0, 2).toUpperCase() : 'OP')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0C0D0D' }}>
                      {assignedAgent?.name || ticket.assigned_agent_id || 'Assigned Operator'}
                    </span>
                    {(ticket.assigned_agent_id === currentAgent.id || assignedAgent?.id === currentAgent.id) && (
                      <span style={{ fontSize: '0.66rem', backgroundColor: '#ECFDF5', color: '#047857', fontWeight: 700, padding: '1px 6px', borderRadius: '4px' }}>
                        You
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                    {assignedAgent?.role?.replace('_', ' ') || 'Support Agent'} • {assignedAgent?.email || 'enterprise.internal'}
                  </span>
                </div>
              </div>

              {/* Timestamp Details */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '8px',
                  backgroundColor: '#FAFAFA',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(12, 13, 13, 0.05)',
                  fontSize: '0.74rem',
                }}
              >
                <div>
                  <span style={{ display: 'block', color: '#94A3B8', fontWeight: 600, fontSize: '0.68rem', marginBottom: '2px' }}>
                    Assigned At
                  </span>
                  <span style={{ color: '#0F172A', fontWeight: 700 }}>
                    {ticket.claimed_at ? new Date(ticket.claimed_at).toLocaleString() : 'In intake queue'}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', color: '#94A3B8', fontWeight: 600, fontSize: '0.68rem', marginBottom: '2px' }}>
                    {ticket.status === InquiryStatusEnum.RESOLVED ? 'Resolved At' : 'Dwell Elapsed'}
                  </span>
                  <span style={{ color: '#0F172A', fontWeight: 700 }}>
                    {ticket.status === InquiryStatusEnum.RESOLVED
                      ? (ticket.resolved_at ? new Date(ticket.resolved_at).toLocaleString() : 'Closed')
                      : ticket.claimed_at
                        ? `${Math.max(1, Math.round((Date.now() - new Date(ticket.claimed_at).getTime()) / 60000))}m in triage`
                        : 'Pending pick-up'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Section: ITIL Dual SLA Tracking Card (First Response vs MTTR & Business Hours) */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid rgba(12, 13, 13, 0.1)',
              borderRadius: '18px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ITIL Dual SLA Tracking
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {/* First Response SLA */}
              <div style={{ backgroundColor: '#FAFAFA', padding: '10px', borderRadius: '10px', border: '1px solid rgba(12, 13, 13, 0.05)' }}>
                <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                  FIRST RESPONSE (FRT)
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: ticket.first_responded_at ? '#059669' : '#0F172A' }}>
                  {ticket.first_responded_at
                    ? `✓ Responded (${new Date(ticket.first_responded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                    : ticket.first_response_deadline_at
                      ? `Due: ${new Date(ticket.first_response_deadline_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'N/A'}
                </span>
              </div>

              {/* Resolution SLA (MTTR) */}
              <div style={{ backgroundColor: '#FAFAFA', padding: '10px', borderRadius: '10px', border: '1px solid rgba(12, 13, 13, 0.05)' }}>
                <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                  RESOLUTION SLA (MTTR)
                </span>
                <span
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    color: isResolved
                      ? '#059669'
                      : isPendingCustomer
                        ? '#D97706'
                        : isOverdue
                          ? '#DC2626'
                          : '#0F172A',
                  }}
                >
                  {isResolved
                    ? '✓ SLA Met'
                    : isPendingCustomer
                      ? `⏸ Paused (${remHours}h ${remMinutes}m)`
                      : isOverdue
                        ? `⚠️ Overdue ${remHours}h ${remMinutes}m`
                        : `${remHours}h ${remMinutes}m remaining`}
                </span>
              </div>
            </div>

            {(ticket.total_paused_seconds ?? 0) > 0 && (
              <div style={{ fontSize: '0.72rem', color: '#92400E', backgroundColor: '#FEF3C7', padding: '6px 10px', borderRadius: '8px' }}>
                Clock previously paused for {Math.round((ticket.total_paused_seconds ?? 0) / 60)} min. SLA deadline was extended by that exact duration.
              </div>
            )}
          </div>

          {/* Section: AI Triage Intelligence Card */}
          <div
            style={{
              backgroundColor: '#ECF4EE',
              border: '1px solid rgba(12, 13, 13, 0.08)',
              borderRadius: '18px',
              padding: '18px',
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
                  AI Triage Intelligence
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                  {ticket.bedrock_latency_ms ?? ticket.entities?.bedrock_latency_ms ?? 485} ms
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
                  {Math.round(((ticket.confidence_score ?? ticket.entities?.confidence_score) ?? 0.95) * 100)}%
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
                    width: `${Math.round(((ticket.confidence_score ?? ticket.entities?.confidence_score) ?? 0.95) * 100)}%`,
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
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid rgba(12, 13, 13, 0.08)',
                fontStyle: 'italic',
                lineHeight: 1.5,
              }}
            >
              &quot;{ticket.triage_rationale || ticket.agent_copilot_notes || 'Automated semantic triage and classification analysis.'}&quot;
            </div>

            {/* Model & FinOps Telemetry Pill Row - Visible exclusively to Operations_Manager */}
            {currentAgent.role === 'Operations_Manager' && (
              <div
                style={{
                  marginTop: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '6px',
                  fontSize: '0.68rem',
                  color: '#64748B',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid rgba(12, 13, 13, 0.05)',
                }}
              >
                <span>
                  Model: <strong style={{ color: '#0F172A' }}>Claude Haiku 4.5</strong>
                </span>
                {(ticket.cost_eur || ticket.entities?.cost_eur) && (
                  <span>
                    FinOps: <strong style={{ color: '#047857' }}>~{(ticket.cost_eur ?? ticket.entities?.cost_eur).toFixed(5)} €</strong>
                  </span>
                )}
                {(ticket.entities?.input_tokens || ticket.entities?.output_tokens) && (
                  <span>
                    Tokens: <strong style={{ color: '#475569' }}>{ticket.entities?.input_tokens || 0} in / {ticket.entities?.output_tokens || 0} out</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Section: Sentiment & Frustration Meter */}
          <div
            style={{
              backgroundColor: '#FAFAFA',
              border: '1px solid rgba(12, 13, 13, 0.08)',
              borderRadius: '18px',
              padding: '16px 18px',
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

          {/* Section: MLOps Override & Audit History */}
          <div
            style={{
              backgroundColor: '#FAFAFA',
              border: '1px solid rgba(12, 13, 13, 0.08)',
              borderRadius: '18px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#666666', textTransform: 'uppercase' }}>
                Model Governance & Actions
              </span>
              <button
                onClick={onOpenOverrideModal}
                disabled={isResolved || isClaimedByOther || currentAgent.role !== 'Operations_Manager'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 12px',
                  borderRadius: '9999px',
                  border: '1px solid rgba(12, 13, 13, 0.15)',
                  backgroundColor: currentAgent.role === 'Operations_Manager' ? '#FFFFFF' : '#F5F5F5',
                  color: currentAgent.role === 'Operations_Manager' ? '#0C0D0D' : '#999999',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: currentAgent.role === 'Operations_Manager' ? 'pointer' : 'not-allowed',
                  opacity: currentAgent.role === 'Operations_Manager' ? 1 : 0.6,
                }}
                title={
                  currentAgent.role === 'Operations_Manager'
                    ? 'Calibrate model classification with mandatory engineering justification'
                    : 'Restricted to Operations Managers'
                }
              >
                <RotateCcw size={12} />
                <span>Override Classification</span>
              </button>
            </div>

            <div style={{ borderTop: '1px solid rgba(12, 13, 13, 0.06)', paddingTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <button
                  onClick={() => setShowAuditLogs(!showAuditLogs)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    border: '1px solid rgba(12, 13, 13, 0.12)',
                    backgroundColor: '#FFFFFF',
                    color: '#0C0D0D',
                    fontSize: '0.72rem',
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
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    border: '1px solid rgba(12, 13, 13, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '0.74rem',
                    maxHeight: '180px',
                    overflowY: 'auto',
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
                          <span style={{ color: '#888888', fontSize: '0.68rem' }}>
                            {new Date(log.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <div style={{ color: '#555555', fontSize: '0.7rem' }}>
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
      </div>
    </div>
  );
};
