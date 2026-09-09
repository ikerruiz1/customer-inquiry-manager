import React, { useState, useEffect } from 'react';
import {
  Clock,
  Flame,
  AlertTriangle,
  User,
  CheckCircle2,
  Mail,
  Globe,
  CreditCard,
  Star,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import {
  PriorityEnum,
  ChannelEnum,
  InquiryStatusEnum,
} from '../types/inquiry';
import type {
  Inquiry,
  AgentProfile,
} from '../types/inquiry';
import { INITIAL_AGENTS } from '../api/mockData';

interface TicketQueueTableProps {
  inquiries: Inquiry[];
  selectedTicket: Inquiry | null;
  onSelectTicket: (ticket: Inquiry) => void;
  currentAgent: AgentProfile;
  onClaimTicket: (ticketId: string) => void;
  isClaiming: boolean;
}

export const TicketQueueTable: React.FC<TicketQueueTableProps> = ({
  inquiries,
  selectedTicket,
  onSelectTicket,
  currentAgent,
  onClaimTicket,
  isClaiming,
}) => {
  // Live ticker updating every 1000ms for exact countdown recalculation
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Mathematical Tie-Breaking Sort
  const sortedInquiries = [...inquiries].sort((a, b) => {
    const now = currentTime;
    const aDeadline = new Date(a.sla_deadline_at).getTime();
    const bDeadline = new Date(b.sla_deadline_at).getTime();
    const aBreached = a.status !== InquiryStatusEnum.RESOLVED && aDeadline < now;
    const bBreached = b.status !== InquiryStatusEnum.RESOLVED && bDeadline < now;

    // 1. Breached SLA at the absolute top
    if (aBreached !== bBreached) {
      return aBreached ? -1 : 1;
    }

    // 2. Priority Order (P1 > P2 > P3 > P4)
    const priorityWeight: Record<PriorityEnum, number> = {
      [PriorityEnum.P1]: 1,
      [PriorityEnum.P2]: 2,
      [PriorityEnum.P3]: 3,
      [PriorityEnum.P4]: 4,
    };
    const pDiff = priorityWeight[a.priority] - priorityWeight[b.priority];
    if (pDiff !== 0) return pDiff;

    // 3. Churn Risk / Hostility Flag
    if (a.churn_risk !== b.churn_risk) {
      return a.churn_risk ? -1 : 1;
    }

    // 4. Nearest SLA deadline (earliest timestamp first)
    if (aDeadline !== bDeadline) {
      return aDeadline - bDeadline;
    }

    // 5. Arrival timestamp (FIFO tie-break)
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const getChannelBadge = (channel: ChannelEnum) => {
    switch (channel) {
      case ChannelEnum.BILLING:
        return (
          <span className="badge-channel channel-stripe">
            <CreditCard size={11} /> Stripe
          </span>
        );
      case ChannelEnum.TRUSTPILOT:
        return (
          <span className="badge-channel channel-trustpilot">
            <Star size={11} /> Trustpilot
          </span>
        );
      case ChannelEnum.EMAIL:
        return (
          <span className="badge-channel channel-email">
            <Mail size={11} /> Email
          </span>
        );
      case ChannelEnum.WEB_FORM:
        return (
          <span className="badge-channel channel-webform">
            <Globe size={11} /> Web Form
          </span>
        );
      default:
        return <span className="badge-channel channel-google">{channel}</span>;
    }
  };

  const getSeverityBadge = (priority: PriorityEnum) => {
    switch (priority) {
      case PriorityEnum.P1:
        return <span className="badge badge-emergency"><Flame size={11} /> Emergency</span>;
      case PriorityEnum.P2:
        return <span className="badge badge-high">High</span>;
      case PriorityEnum.P3:
        return <span className="badge badge-medium">Medium</span>;
      case PriorityEnum.P4:
        return <span className="badge badge-low">Low</span>;
    }
  };

  const formatCountdown = (ticket: Inquiry) => {
    if (ticket.status === InquiryStatusEnum.RESOLVED) {
      return (
        <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', fontWeight: 600 }}>
          <CheckCircle2 size={12} /> SLA Met
        </span>
      );
    }

    const deadline = new Date(ticket.sla_deadline_at).getTime();
    const diffSeconds = Math.floor((deadline - currentTime) / 1000);

    if (diffSeconds <= 0) {
      return (
        <span className="sla-pill sla-breached">
          <Clock size={11} /> Overdue
        </span>
      );
    }

    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;

    if (diffSeconds < 900) {
      return (
        <span className="sla-pill sla-breached pulse-emergency">
          <Clock size={11} /> {minutes}m {seconds}s
        </span>
      );
    }

    if (diffSeconds < 7200) {
      return (
        <span className="sla-pill sla-warning">
          <Clock size={11} /> {hours > 0 ? `${hours}h ` : ''}{minutes}m
        </span>
      );
    }

    return (
      <span className="sla-pill sla-on-track">
        <Clock size={11} /> {hours}h {minutes}m
      </span>
    );
  };

  const getAssignedAgent = (agentId?: string | null) => {
    if (!agentId) return null;
    return INITIAL_AGENTS.find((a) => a.id === agentId);
  };

  if (sortedInquiries.length === 0) {
    return (
      <div
        style={{
          padding: '4rem 2rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
          backgroundColor: 'var(--card-bg)',
          borderRadius: '0.85rem',
          border: '1px solid var(--card-border)',
        }}
      >
        <CheckCircle2 size={42} color="#10b981" />
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
          Queue is Completely Clear
        </div>
        <div style={{ fontSize: '0.82rem', maxWidth: '400px' }}>
          No customer inquiries match the current filter selection. Inject a scenario via the simulator on the right to see real-time AI triage.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--bento-card-bg)',
        borderRadius: 'var(--bento-card-radius)',
        border: '1px solid var(--bento-card-border)',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '0.82rem',
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                color: 'var(--text-muted)',
                fontSize: '0.74rem',
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}
            >
              <th style={{ padding: '0.85rem 1rem', width: '120px' }}>Ticket ID</th>
              <th style={{ padding: '0.85rem 1rem', width: '190px' }}>Customer & Channel</th>
              <th style={{ padding: '0.85rem 1rem', minWidth: '220px' }}>Issue & Key Entities</th>
              <th style={{ padding: '0.85rem 1rem', width: '190px' }}>Severity & SLA Due</th>
              <th style={{ padding: '0.85rem 1rem', width: '120px' }}>Flags</th>
              <th style={{ padding: '0.85rem 1rem', width: '120px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedInquiries.map((ticket) => {
              const isSelected = selectedTicket?.id === ticket.id;
              const assignedAgent = getAssignedAgent(ticket.assigned_agent_id);
              const isClaimedByOther =
                ticket.status === InquiryStatusEnum.CLAIMED &&
                ticket.assigned_agent_id !== currentAgent.id;

              return (
                <tr
                  key={ticket.id}
                  onClick={() => onSelectTicket(ticket)}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    backgroundColor: isSelected
                      ? 'rgba(184, 165, 254, 0.09)'
                      : ticket.priority === PriorityEnum.P1 && ticket.status !== InquiryStatusEnum.RESOLVED
                      ? 'rgba(248, 113, 113, 0.04)'
                      : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor =
                        ticket.priority === PriorityEnum.P1 && ticket.status !== InquiryStatusEnum.RESOLVED
                          ? 'rgba(248, 113, 113, 0.04)'
                          : 'transparent';
                    }
                  }}
                >
                  {/* Ticket ID */}
                  <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: isSelected ? 'var(--pastel-lilac)' : '#ffffff',
                      }}
                    >
                      {ticket.id.slice(0, 8).toUpperCase()}
                    </span>
                  </td>

                  {/* Customer & Channel */}
                  <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.82rem' }}>
                        {ticket.customer_name}
                      </span>
                      <div>{getChannelBadge(ticket.channel)}</div>
                    </div>
                  </td>

                  {/* Issue & Key Entities */}
                  <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span
                        style={{
                          fontWeight: 600,
                          color: '#ffffff',
                          fontSize: '0.82rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '360px',
                        }}
                        title={ticket.subject}
                      >
                        {ticket.subject}
                      </span>
                      {ticket.entities && (ticket.entities.order_id || ticket.entities.monetary_amount || ticket.entities.error_code) && (
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {ticket.entities.monetary_amount && (
                            <span style={{ fontSize: '0.68rem', backgroundColor: 'rgba(255, 255, 255, 0.06)', color: 'var(--pastel-yellow-dark)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
                              {ticket.entities.monetary_amount}
                            </span>
                          )}
                          {ticket.entities.order_id && (
                            <span style={{ fontSize: '0.68rem', backgroundColor: 'rgba(255, 255, 255, 0.06)', color: '#94a3b8', padding: '0.1rem 0.35rem', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                              Ref: {ticket.entities.order_id}
                            </span>
                          )}
                          {ticket.entities.error_code && (
                            <span style={{ fontSize: '0.68rem', backgroundColor: 'var(--pastel-coral-bg)', color: 'var(--pastel-coral)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
                              {ticket.entities.error_code}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Severity & SLA Due (matching reference layout: Severity Badge + Countdown) */}
                  <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {getSeverityBadge(ticket.priority)}
                      {formatCountdown(ticket)}
                    </div>
                  </td>

                  {/* Flags (Safety Risk, Churn Risk, All Clear) */}
                  <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                    {ticket.churn_risk ? (
                      <span className="flag-risk">
                        <AlertTriangle size={12} /> Churn Risk
                      </span>
                    ) : ticket.priority === PriorityEnum.P1 ? (
                      <span className="flag-warning">
                        <ShieldAlert size={12} /> Safety Risk
                      </span>
                    ) : (
                      <span className="flag-clear">
                        All Clear
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                    {ticket.status === InquiryStatusEnum.RESOLVED ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontSize: '0.72rem',
                          color: '#16a34a',
                          fontWeight: 600,
                        }}
                      >
                        <CheckCircle2 size={12} /> Closed
                      </span>
                    ) : ticket.status === InquiryStatusEnum.CLAIMED ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.72rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '0.375rem',
                          background: isClaimedByOther ? '#fffbeb' : '#eff6ff',
                          color: isClaimedByOther ? '#b45309' : '#2563eb',
                          border: `1px solid ${isClaimedByOther ? '#fde68a' : '#bfdbfe'}`,
                          fontWeight: 500,
                        }}
                      >
                        <User size={11} />
                        {assignedAgent ? assignedAgent.name : 'Claimed'}
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onClaimTicket(ticket.id);
                        }}
                        disabled={isClaiming}
                        className="btn-secondary"
                        style={{
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.75rem',
                          borderRadius: '0.375rem',
                        }}
                        title="Claim ticket for active agent"
                      >
                        <span>Claim</span>
                        <ChevronRight size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
