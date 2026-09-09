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
          <span className="badge badge-stripe">
            <CreditCard size={11} /> Stripe
          </span>
        );
      case ChannelEnum.TRUSTPILOT:
        return (
          <span className="badge badge-trustpilot">
            <Star size={11} /> Trustpilot
          </span>
        );
      case ChannelEnum.EMAIL:
        return (
          <span className="badge badge-email">
            <Mail size={11} /> Email
          </span>
        );
      case ChannelEnum.WEB_FORM:
        return (
          <span className="badge badge-webform">
            <Globe size={11} /> Web Form
          </span>
        );
      default:
        return <span className="badge">{channel}</span>;
    }
  };

  const getPriorityBadge = (priority: PriorityEnum) => {
    switch (priority) {
      case PriorityEnum.P1:
        return (
          <span className="badge badge-p1">
            <Flame size={11} /> P1
          </span>
        );
      case PriorityEnum.P2:
        return <span className="badge badge-p2">P2</span>;
      case PriorityEnum.P3:
        return <span className="badge badge-p3">P3</span>;
      case PriorityEnum.P4:
        return <span className="badge badge-p4">P4</span>;
    }
  };

  const formatCountdown = (ticket: Inquiry) => {
    if (ticket.status === InquiryStatusEnum.RESOLVED) {
      return (
        <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 600 }}>
          <CheckCircle2 size={13} /> SLA Met
        </span>
      );
    }

    const deadline = new Date(ticket.sla_deadline_at).getTime();
    const diffSeconds = Math.floor((deadline - currentTime) / 1000);

    if (diffSeconds <= 0) {
      const minsOver = Math.abs(Math.floor(diffSeconds / 60));
      return (
        <span
          className="badge"
          style={{
            background: 'rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            border: '1px solid #ef4444',
            fontSize: '0.72rem',
          }}
        >
          🚨 BREACHED (-{minsOver}m)
        </span>
      );
    }

    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;

    if (diffSeconds < 900) {
      // Under 15 mins -> Pulsing crimson
      return (
        <span
          className="pulse-critical"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            color: '#f87171',
            fontWeight: 700,
            fontSize: '0.75rem',
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
            background: 'rgba(239, 68, 68, 0.2)',
          }}
        >
          <Clock size={12} />
          {minutes}m {seconds}s
        </span>
      );
    }

    if (diffSeconds < 7200) {
      // Under 2 hours -> Amber
      return (
        <span style={{ color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 600 }}>
          <Clock size={12} />
          {hours}h {minutes}m
        </span>
      );
    }

    // Normal green
    return (
      <span style={{ color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
        <Clock size={12} />
        {hours}h {minutes}m
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
        }}
      >
        <CheckCircle2 size={42} color="#10b981" />
        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>
          Queue is Completely Clear
        </div>
        <div style={{ fontSize: '0.85rem', maxWidth: '420px' }}>
          No customer inquiries match the current filter selection. Inject a scenario via the simulator above to see real-time AI triage.
        </div>
      </div>
    );
  }

  return (
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
              backgroundColor: '#0a0e17',
              borderBottom: '1px solid var(--border-prominent)',
              color: 'var(--text-dim)',
              fontSize: '0.72rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <th style={{ padding: '0.65rem 1rem', width: '130px' }}>Priority & SLA</th>
            <th style={{ padding: '0.65rem 0.8rem', width: '110px' }}>Channel</th>
            <th style={{ padding: '0.65rem 1rem', minWidth: '220px' }}>Customer & Subject</th>
            <th style={{ padding: '0.65rem 0.8rem', width: '130px' }}>Department</th>
            <th style={{ padding: '0.65rem 0.8rem', width: '130px' }}>AI Alerts</th>
            <th style={{ padding: '0.65rem 1rem', width: '140px', textAlign: 'right' }}>Assignment</th>
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
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: isSelected
                    ? 'rgba(59, 130, 246, 0.12)'
                    : ticket.priority === PriorityEnum.P1 && ticket.status !== InquiryStatusEnum.RESOLVED
                    ? 'rgba(239, 68, 68, 0.05)'
                    : 'transparent',
                  cursor: 'pointer',
                  transition: 'background-color 0.1s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor =
                      ticket.priority === PriorityEnum.P1 && ticket.status !== InquiryStatusEnum.RESOLVED
                        ? 'rgba(239, 68, 68, 0.05)'
                        : 'transparent';
                  }
                }}
              >
                {/* Priority & Countdown */}
                <td style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {getPriorityBadge(ticket.priority)}
                    </div>
                    <div>{formatCountdown(ticket)}</div>
                  </div>
                </td>

                {/* Channel */}
                <td style={{ padding: '0.75rem 0.8rem' }}>
                  {getChannelBadge(ticket.channel)}
                </td>

                {/* Customer & Subject */}
                <td style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {ticket.customer_name}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                        ({ticket.customer_email})
                      </span>
                    </div>
                    <div
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.8rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '480px',
                      }}
                    >
                      {ticket.subject}
                    </div>
                  </div>
                </td>

                {/* Department */}
                <td style={{ padding: '0.75rem 0.8rem' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.74rem',
                      fontWeight: 500,
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#cbd5e1',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {ticket.department}
                  </span>
                </td>

                {/* AI Alerts / Churn Risk */}
                <td style={{ padding: '0.75rem 0.8rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {ticket.churn_risk && (
                      <span
                        className="badge"
                        style={{
                          background: 'rgba(239, 68, 68, 0.2)',
                          color: '#fca5a5',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          fontSize: '0.68rem',
                        }}
                      >
                        <AlertTriangle size={10} /> Churn Risk
                      </span>
                    )}
                    {ticket.sentiment_score < -0.6 && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: '#f87171',
                          fontWeight: 500,
                        }}
                      >
                        Frustration: {ticket.urgency}/5
                      </span>
                    )}
                  </div>
                </td>

                {/* Assignment & Action */}
                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                  {ticket.status === InquiryStatusEnum.RESOLVED ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.75rem',
                        color: '#34d399',
                        fontWeight: 500,
                      }}
                    >
                      <CheckCircle2 size={13} /> Closed
                    </span>
                  ) : ticket.status === InquiryStatusEnum.CLAIMED ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        background: isClaimedByOther ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: isClaimedByOther ? '#fcd34d' : '#93c5fd',
                        border: `1px solid ${isClaimedByOther ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                      }}
                    >
                      <User size={12} />
                      {assignedAgent ? assignedAgent.name : 'Claimed'}
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClaimTicket(ticket.id);
                      }}
                      disabled={isClaiming}
                      className="btn btn-secondary"
                      style={{
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.75rem',
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
  );
};
