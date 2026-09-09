import React from 'react';
import { CreditCard, Star, Mail, ChevronRight, Flame, Clock, ChevronDown } from 'lucide-react';
import type { Inquiry } from '../types/inquiry';
import { ChannelEnum, PriorityEnum, InquiryStatusEnum } from '../types/inquiry';

interface BentoUrgentCardProps {
  inquiries: Inquiry[];
  onSelectTicket: (ticket: Inquiry) => void;
  selectedTicket: Inquiry | null;
}

export const BentoUrgentCard: React.FC<BentoUrgentCardProps> = ({
  inquiries,
  onSelectTicket,
  selectedTicket,
}) => {
  const now = Date.now();

  // Urgent tickets (P1, Breached, or Churn Risk)
  const urgentTickets = inquiries
    .filter((ticket) => {
      if (ticket.status === InquiryStatusEnum.RESOLVED) return false;
      const isBreached = new Date(ticket.sla_deadline_at).getTime() <= now;
      return (
        ticket.priority === PriorityEnum.P1 ||
        ticket.churn_risk ||
        isBreached
      );
    })
    .slice(0, 3); // Fitonist shows 3 items in popular workouts

  const getChannelIcon = (channel: ChannelEnum) => {
    switch (channel) {
      case ChannelEnum.BILLING:
        return <CreditCard size={15} style={{ color: 'var(--pastel-yellow-dark)' }} />;
      case ChannelEnum.TRUSTPILOT:
        return <Star size={15} style={{ color: 'var(--pastel-coral)' }} />;
      case ChannelEnum.EMAIL:
        return <Mail size={15} style={{ color: 'var(--pastel-lilac)' }} />;
      default:
        return <Flame size={15} style={{ color: 'var(--pastel-coral)' }} />;
    }
  };

  return (
    <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      {/* Header: Title + Filter Dropdown (Fitonist "Popular workouts" / "Male ⌵" style) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
          Urgent Attention
        </span>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.2rem 0.6rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <span>P1 & Churn</span>
          <ChevronDown size={13} />
        </div>
      </div>

      {/* List Rows (Fitonist workout cards with rounded thumbnail, badges, count) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {urgentTickets.map((ticket) => {
          const isSelected = selectedTicket?.id === ticket.id;
          const deadline = new Date(ticket.sla_deadline_at).getTime();
          const isBreached = deadline <= now;
          const diffMinutes = Math.max(0, Math.floor((deadline - now) / 60000));

          return (
            <div
              key={ticket.id}
              onClick={() => onSelectTicket(ticket)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.85rem',
                borderRadius: '14px',
                backgroundColor: isSelected ? '#1e202e' : 'rgba(255, 255, 255, 0.03)',
                border: isSelected ? '1px solid var(--pastel-lilac)' : '1px solid rgba(255, 255, 255, 0.05)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
              }}
            >
              {/* Left: Thumbnail Icon + Title + Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                {/* Rounded Icon Box */}
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#1d1e28',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                  }}
                >
                  {getChannelIcon(ticket.channel)}
                </div>

                {/* Text Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#ffffff',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '180px',
                    }}
                    title={ticket.subject}
                  >
                    {ticket.subject}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        padding: '0.08rem 0.4rem',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      {ticket.department}
                    </span>
                    {ticket.churn_risk && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          padding: '0.08rem 0.4rem',
                          borderRadius: '4px',
                          backgroundColor: 'var(--pastel-coral-bg)',
                          color: 'var(--pastel-coral)',
                          fontWeight: 700,
                        }}
                      >
                        Churn Risk
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Countdown Pill & Arrow */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.5rem',
                    borderRadius: '9999px',
                    backgroundColor: isBreached ? 'var(--pastel-coral-bg)' : 'var(--pastel-yellow-bg)',
                    color: isBreached ? 'var(--pastel-coral)' : 'var(--pastel-yellow-dark)',
                  }}
                >
                  <Clock size={11} />
                  <span>{isBreached ? 'BREACHED' : `${diffMinutes}m`}</span>
                </span>
                <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
