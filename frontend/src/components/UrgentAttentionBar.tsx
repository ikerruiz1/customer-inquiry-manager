import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Clock, Flame } from 'lucide-react';
import type { Inquiry } from '../types/inquiry';
import { PriorityEnum, InquiryStatusEnum } from '../types/inquiry';

interface UrgentAttentionBarProps {
  inquiries: Inquiry[];
  selectedTicket: Inquiry | null;
  onSelectTicket: (ticket: Inquiry) => void;
}

export const UrgentAttentionBar: React.FC<UrgentAttentionBarProps> = ({
  inquiries,
  selectedTicket,
  onSelectTicket,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = Date.now();

  // Filter urgent inquiries: P1, P2, Churn Risk, or Breached
  const urgentTickets = inquiries
    .filter((ticket) => {
      if (ticket.status === InquiryStatusEnum.RESOLVED) return false;
      const isBreached = new Date(ticket.sla_deadline_at).getTime() <= now;
      return (
        ticket.priority === PriorityEnum.P1 ||
        ticket.priority === PriorityEnum.P2 ||
        ticket.churn_risk ||
        isBreached
      );
    })
    .sort((a, b) => {
      const deadA = new Date(a.sla_deadline_at).getTime();
      const deadB = new Date(b.sla_deadline_at).getTime();
      return deadA - deadB;
    });

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (urgentTickets.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--card-bg)',
        borderRadius: '0.85rem',
        padding: '1rem 1.25rem',
        border: '1px solid var(--card-border)',
        boxShadow: 'var(--card-shadow)',
        width: '100%',
      }}
    >
      {/* Header with Title and Scroll Arrows */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
            Urgent Attention
          </span>
          <span
            style={{
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.1rem 0.5rem',
              borderRadius: '9999px',
            }}
          >
            {urgentTickets.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            onClick={() => scroll('left')}
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Scroll Left"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => scroll('right')}
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Scroll Right"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Horizontal Cards Scrollable Container */}
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          gap: '0.85rem',
          overflowX: 'auto',
          paddingBottom: '0.35rem',
          scrollbarWidth: 'none',
        }}
      >
        {urgentTickets.map((ticket) => {
          const isSelected = selectedTicket?.id === ticket.id;
          const deadline = new Date(ticket.sla_deadline_at).getTime();
          const remainingMins = Math.round((deadline - now) / 60000);
          const isBreached = remainingMins <= 0;
          const isP1 = ticket.priority === PriorityEnum.P1;

          return (
            <div
              key={ticket.id}
              onClick={() => onSelectTicket(ticket)}
              style={{
                minWidth: '240px',
                maxWidth: '260px',
                flexShrink: 0,
                backgroundColor: isSelected ? '#f8fafc' : '#ffffff',
                border: isSelected
                  ? '1.5px solid var(--accent-primary)'
                  : isBreached
                  ? '1px solid #fecaca'
                  : '1px solid #e2e8f0',
                borderRadius: '0.65rem',
                padding: '0.75rem 0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
                boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              {/* Top Row: Severity Tag + ID */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  {isP1 ? (
                    <span
                      style={{
                        backgroundColor: '#fee2e2',
                        color: '#dc2626',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '0.3rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                    >
                      <Flame size={11} /> Emergency
                    </span>
                  ) : (
                    <span
                      style={{
                        backgroundColor: '#fffbeb',
                        color: '#d97706',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '0.3rem',
                      }}
                    >
                      High Priority
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                  {ticket.id.slice(0, 8).toUpperCase()}
                </span>
              </div>

              {/* Subject Title */}
              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={ticket.subject}
              >
                {ticket.subject}
              </div>

              {/* Footer: Customer & SLA Countdown */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                  {ticket.customer_name}
                </span>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontWeight: 700,
                    color: isBreached ? '#dc2626' : remainingMins < 30 ? '#d97706' : '#16a34a',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                  }}
                >
                  <Clock size={11} />
                  {isBreached ? 'Breached' : `⏳ ${remainingMins}m`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
