import React, { useState, useEffect } from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Mail,
  Globe,
  CreditCard,
  Star,
  ChevronRight,
  Flame,
  User,
  SlidersHorizontal,
} from 'lucide-react';
import {
  PriorityEnum,
  ChannelEnum,
  InquiryStatusEnum,
  DepartmentEnum,
} from '../types/inquiry';
import type {
  Inquiry,
  AgentProfile,
} from '../types/inquiry';

export type QueueTab = 'DEFAULT' | 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'PENDING_CUSTOMER' | 'ASSIGNED' | 'COMPLETED' | 'FILTERS';

export type FacetFilter =
  | 'ALL'
  | 'P1'
  | 'P2'
  | 'P3'
  | 'P4'
  | 'CHURN_RISK'
  | 'STRIPE'
  | 'EMAIL'
  | 'TRUSTPILOT'
  | 'WEB_FORM';

interface LoadLogicQueueTableProps {
  inquiries: Inquiry[];
  selectedTicket: Inquiry | null;
  onSelectTicket: (ticket: Inquiry) => void;
  currentAgent: AgentProfile;
  onClaimTicket: (ticketId: string) => void;
  isClaiming: boolean;
  activeTab: QueueTab;
  onTabChange: (tab: QueueTab) => void;
  dragHandle?: React.ReactNode;
  operators?: AgentProfile[];
}

export const LoadLogicQueueTable: React.FC<LoadLogicQueueTableProps> = ({
  inquiries,
  selectedTicket,
  onSelectTicket,
  currentAgent,
  onClaimTicket,
  isClaiming,
  activeTab,
  onTabChange,
  dragHandle,
  operators,
}) => {
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [activeFacetFilter, setActiveFacetFilter] = useState<FacetFilter>('ALL');
  const [isFiltersBarOpen, setIsFiltersBarOpen] = useState<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeTab === 'DEFAULT' || activeTab === 'ALL') {
      setActiveFacetFilter('ALL');
    }
  }, [activeTab]);

  const activeInquiries = inquiries.filter((t) => t.status !== InquiryStatusEnum.RESOLVED);
  const tabCounts = {
    all: activeInquiries.length,
    pending: inquiries.filter((t) => t.status === InquiryStatusEnum.UNASSIGNED).length,
    inProgress: inquiries.filter((t) => t.status === InquiryStatusEnum.CLAIMED).length,
    pendingCustomer: inquiries.filter((t) => t.status === InquiryStatusEnum.PENDING_CUSTOMER).length,
    assigned: inquiries.filter((t) => t.assigned_agent_id === currentAgent.id && t.status !== InquiryStatusEnum.RESOLVED).length,
    completed: inquiries.filter((t) => t.status === InquiryStatusEnum.RESOLVED).length,
  };

  const facetCounts = {
    p1: activeInquiries.filter((t) => t.priority === PriorityEnum.P1).length,
    p2: activeInquiries.filter((t) => t.priority === PriorityEnum.P2).length,
    p3: activeInquiries.filter((t) => t.priority === PriorityEnum.P3).length,
    p4: activeInquiries.filter((t) => t.priority === PriorityEnum.P4).length,
    churn: activeInquiries.filter((t) => t.churn_risk).length,
    stripe: activeInquiries.filter((t) => t.channel === ChannelEnum.BILLING).length,
    email: activeInquiries.filter((t) => t.channel === ChannelEnum.EMAIL).length,
    trustpilot: activeInquiries.filter((t) => t.channel === ChannelEnum.TRUSTPILOT).length,
    webForm: activeInquiries.filter((t) => t.channel === ChannelEnum.WEB_FORM).length,
  };

  const tabFilteredInquiries = inquiries.filter((ticket) => {
    if (activeTab === 'PENDING') return ticket.status === InquiryStatusEnum.UNASSIGNED;
    if (activeTab === 'IN_PROGRESS') return ticket.status === InquiryStatusEnum.CLAIMED;
    if (activeTab === 'PENDING_CUSTOMER') return ticket.status === InquiryStatusEnum.PENDING_CUSTOMER;
    if (activeTab === 'ASSIGNED') return ticket.assigned_agent_id === currentAgent.id && ticket.status !== InquiryStatusEnum.RESOLVED;
    if (activeTab === 'COMPLETED') return ticket.status === InquiryStatusEnum.RESOLVED;
    return ticket.status !== InquiryStatusEnum.RESOLVED;
  });

  const facetFilteredInquiries = tabFilteredInquiries.filter((ticket) => {
    if (activeFacetFilter === 'ALL') return true;
    if (activeFacetFilter === 'P1') return ticket.priority === PriorityEnum.P1;
    if (activeFacetFilter === 'P2') return ticket.priority === PriorityEnum.P2;
    if (activeFacetFilter === 'P3') return ticket.priority === PriorityEnum.P3;
    if (activeFacetFilter === 'P4') return ticket.priority === PriorityEnum.P4;
    if (activeFacetFilter === 'CHURN_RISK') return ticket.churn_risk === true;
    if (activeFacetFilter === 'STRIPE') return ticket.channel === ChannelEnum.BILLING;
    if (activeFacetFilter === 'EMAIL') return ticket.channel === ChannelEnum.EMAIL;
    if (activeFacetFilter === 'TRUSTPILOT') return ticket.channel === ChannelEnum.TRUSTPILOT;
    if (activeFacetFilter === 'WEB_FORM') return ticket.channel === ChannelEnum.WEB_FORM;
    return true;
  });

  const sortedInquiries = [...facetFilteredInquiries].sort((a, b) => {
    const now = currentTime;
    const aDeadline = new Date(a.sla_deadline_at).getTime();
    const bDeadline = new Date(b.sla_deadline_at).getTime();
    const aBreached = a.status !== InquiryStatusEnum.RESOLVED && aDeadline < now;
    const bBreached = b.status !== InquiryStatusEnum.RESOLVED && bDeadline < now;

    if (aBreached !== bBreached) return aBreached ? -1 : 1;

    const priorityWeight: Record<PriorityEnum, number> = {
      [PriorityEnum.P1]: 1,
      [PriorityEnum.P2]: 2,
      [PriorityEnum.P3]: 3,
      [PriorityEnum.P4]: 4,
    };
    const pDiff = (priorityWeight[a.priority] || 4) - (priorityWeight[b.priority] || 4);
    if (pDiff !== 0) return pDiff;

    if (a.churn_risk !== b.churn_risk) return a.churn_risk ? -1 : 1;

    if (aDeadline !== bDeadline) return aDeadline - bDeadline;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const getChannelBadge = (channel: ChannelEnum) => {
    switch (channel) {
      case ChannelEnum.BILLING:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(147, 51, 234, 0.08)', color: '#7E22CE', border: '1px solid rgba(147, 51, 234, 0.15)', fontSize: '0.67rem', fontWeight: 800, letterSpacing: '0.03em' }}>
            <CreditCard size={10} color="#7E22CE" /> STRIPE
          </span>
        );
      case ChannelEnum.TRUSTPILOT:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(0, 182, 122, 0.1)', color: '#00875A', border: '1px solid rgba(0, 182, 122, 0.2)', fontSize: '0.67rem', fontWeight: 800, letterSpacing: '0.03em' }}>
            <Star size={10} color="#00875A" fill="#00875A" /> TRUSTPILOT
          </span>
        );
      case ChannelEnum.EMAIL:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(37, 99, 235, 0.08)', color: '#1D4ED8', border: '1px solid rgba(37, 99, 235, 0.15)', fontSize: '0.67rem', fontWeight: 800, letterSpacing: '0.03em' }}>
            <Mail size={10} color="#1D4ED8" /> EMAIL
          </span>
        );
      case ChannelEnum.WEB_FORM:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.08)', color: '#B45309', border: '1px solid rgba(245, 158, 11, 0.15)', fontSize: '0.67rem', fontWeight: 800, letterSpacing: '0.03em' }}>
            <Globe size={10} color="#B45309" /> WEB FORM
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(12, 13, 13, 0.05)', color: '#4B5563', fontSize: '0.67rem', fontWeight: 700 }}>
            {channel}
          </span>
        );
    }
  };

  const getDepartmentBadge = (dept: DepartmentEnum) => {
    const meta: Record<DepartmentEnum, { label: string; color: string; bg: string; dot: string; dotBorder?: string }> = {
      [DepartmentEnum.TECH_SUPPORT]: { label: 'Tech Support', color: '#111827', bg: 'rgba(17, 24, 39, 0.08)', dot: '#111827' },
      [DepartmentEnum.SECURITY]: { label: 'Security', color: '#374151', bg: 'rgba(107, 114, 128, 0.12)', dot: '#6B7280' },
      [DepartmentEnum.GENERAL]: { label: 'General', color: '#4B5563', bg: 'rgba(203, 213, 225, 0.25)', dot: '#CBD5E1', dotBorder: '1px solid #94A3B8' },
      [DepartmentEnum.BILLING]: { label: 'Billing', color: '#064E3B', bg: 'rgba(6, 78, 59, 0.08)', dot: '#064E3B' },
      [DepartmentEnum.ACCOUNTS]: { label: 'Accounts', color: '#047857', bg: 'rgba(16, 185, 129, 0.12)', dot: '#10B981' },
      [DepartmentEnum.SALES]: { label: 'Sales', color: '#4D7C0F', bg: 'rgba(132, 204, 22, 0.15)', dot: '#84CC16' },
    };
    const m = meta[dept] || meta[DepartmentEnum.GENERAL];
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '1px 6px',
          borderRadius: '4px',
          backgroundColor: m.bg,
          color: m.color,
          fontSize: '0.68rem',
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: m.dot,
            border: m.dotBorder || 'none',
            flexShrink: 0,
          }}
        />
        {m.label}
      </span>
    );
  };

  const getSeverityBadge = (priority: PriorityEnum) => {
    switch (priority) {
      case PriorityEnum.P1:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(254, 242, 242, 0.95)',
              color: '#DC2626',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              fontSize: '0.7rem',
              fontWeight: 800,
              whiteSpace: 'nowrap',
            }}
          >
            <Flame size={11} color="#DC2626" /> P1 Emergency
          </span>
        );
      case PriorityEnum.P2:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(254, 243, 199, 0.85)',
              color: '#B45309',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              fontSize: '0.7rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            P2 High
          </span>
        );
      case PriorityEnum.P3:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(239, 246, 255, 0.9)',
              color: '#2563EB',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              fontSize: '0.7rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            P3 Medium
          </span>
        );
      case PriorityEnum.P4:
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(243, 244, 246, 0.9)',
              color: '#4B5563',
              border: '1px solid rgba(107, 114, 128, 0.2)',
              fontSize: '0.7rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            P4 Low
          </span>
        );
    }
  };

  const getSlaDuePill = (ticket: Inquiry) => {
    if (ticket.status === InquiryStatusEnum.RESOLVED) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            padding: '2px 8px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(236, 253, 245, 0.9)',
            color: '#059669',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            fontSize: '0.7rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          <CheckCircle2 size={11} /> SLA Met
        </span>
      );
    }

    if (ticket.status === InquiryStatusEnum.PENDING_CUSTOMER) {
      let remaining = ticket.sla_remaining_seconds;
      if (remaining === undefined && ticket.sla_deadline_at && ticket.sla_paused_at) {
        const d = new Date(ticket.sla_deadline_at).getTime();
        const p = new Date(ticket.sla_paused_at).getTime();
        remaining = Math.max(0, Math.floor((d - p) / 1000));
      }
      const remSec = remaining ?? 0;
      const h = Math.floor(remSec / 3600);
      const m = Math.floor((remSec % 3600) / 60);
      const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(254, 243, 199, 0.95)',
            color: '#B45309',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            fontSize: '0.7rem',
            fontWeight: 800,
            whiteSpace: 'nowrap',
          }}
          title="SLA clock frozen in PENDING_CUSTOMER state until customer responds"
        >
          <span>⏸</span> SLA PAUSED ({timeStr})
        </span>
      );
    }

    const deadline = new Date(ticket.sla_deadline_at).getTime();
    const diffSeconds = Math.floor((deadline - currentTime) / 1000);

    if (diffSeconds <= 0) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            padding: '2px 8px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(254, 242, 242, 0.9)',
            color: '#DC2626',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            fontSize: '0.7rem',
            fontWeight: 800,
            whiteSpace: 'nowrap',
          }}
        >
          <AlertTriangle size={11} /> Overdue
        </span>
      );
    }

    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);

    if (diffSeconds < 3600) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            padding: '2px 8px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(254, 243, 199, 0.9)',
            color: '#B45309',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            fontSize: '0.7rem',
            fontWeight: 800,
            whiteSpace: 'nowrap',
          }}
        >
          <Clock size={11} /> {minutes}m
        </span>
      );
    }

    if (diffSeconds < 7200) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            padding: '2px 8px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(254, 243, 199, 0.75)',
            color: '#B45309',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            fontSize: '0.7rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          <Clock size={11} /> {hours}h {minutes}m
        </span>
      );
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          padding: '2px 8px',
          borderRadius: '9999px',
          backgroundColor: '#FAFAFA',
          color: '#4B5563',
          border: '1px solid rgba(12, 13, 13, 0.08)',
          fontSize: '0.7rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        <Clock size={11} color="#6B7280" /> {hours}h {minutes}m
      </span>
    );
  };

  const getAssignedAgent = (agentId?: string | null) => {
    if (!agentId) return null;
    return operators?.find((a) => a.id === agentId || a.email === agentId) || null;
  };

  const gridColumns = '100px 165px 1fr 190px 115px 110px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0C0D0D', letterSpacing: '-0.02em', margin: 0 }}>
                Inquiries
              </h2>
              <span
                style={{
                  backgroundColor: 'rgba(12, 13, 13, 0.08)',
                  color: '#0C0D0D',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                {sortedInquiries.length}
              </span>
            </div>

            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              
              <button
                onClick={() => {
                  onTabChange('DEFAULT');
                  setActiveFacetFilter('ALL');
                  setIsFiltersBarOpen(false);
                }}
                className={`pill-btn ${activeTab === 'DEFAULT' || (activeTab === 'ALL' && activeFacetFilter === 'ALL' && !isFiltersBarOpen) ? 'active' : ''}`}
                title="Active Operational Queue: Urgent first prioritization"
              >
                Default (Urgent First) {tabCounts.all}
              </button>

              <button
                onClick={() => {
                  onTabChange('PENDING');
                  setActiveFacetFilter('ALL');
                }}
                className={`pill-btn ${activeTab === 'PENDING' ? 'active' : ''}`}
              >
                Pending {tabCounts.pending}
              </button>

              <button
                onClick={() => {
                  onTabChange('IN_PROGRESS');
                  setActiveFacetFilter('ALL');
                }}
                className={`pill-btn ${activeTab === 'IN_PROGRESS' ? 'active' : ''}`}
              >
                In Progress {tabCounts.inProgress}
              </button>

              <button
                onClick={() => {
                  onTabChange('PENDING_CUSTOMER');
                  setActiveFacetFilter('ALL');
                }}
                className={`pill-btn ${activeTab === 'PENDING_CUSTOMER' ? 'active' : ''}`}
                title="Tickets awaiting customer response with SLA paused"
              >
                ⏸ Pending Customer {tabCounts.pendingCustomer}
              </button>

              <button
                onClick={() => {
                  onTabChange('ASSIGNED');
                  setActiveFacetFilter('ALL');
                }}
                className={`pill-btn ${activeTab === 'ASSIGNED' ? 'active' : ''}`}
              >
                Assigned {tabCounts.assigned}
              </button>

              <button
                onClick={() => {
                  onTabChange('COMPLETED');
                  setActiveFacetFilter('ALL');
                }}
                className={`pill-btn ${activeTab === 'COMPLETED' ? 'active' : ''}`}
              >
                Completed {tabCounts.completed}
              </button>

              
              <button
                onClick={() => {
                  setIsFiltersBarOpen(!isFiltersBarOpen);
                  if (activeTab !== 'FILTERS') {
                    onTabChange('FILTERS');
                  }
                }}
                className={`pill-btn ${activeTab === 'FILTERS' || isFiltersBarOpen || activeFacetFilter !== 'ALL' ? 'active' : ''}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  border: activeFacetFilter !== 'ALL' ? '1.5px solid #0C0D0D' : undefined,
                }}
              >
                <SlidersHorizontal size={13} />
                <span>Filters</span>
                {activeFacetFilter !== 'ALL' && (
                  <span
                    style={{
                      backgroundColor: '#047857',
                      color: '#FFFFFF',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: '8px',
                    }}
                  >
                    {activeFacetFilter}
                  </span>
                )}
              </button>
            </div>
          </div>

          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {dragHandle}
          </div>
        </div>

        
        {(isFiltersBarOpen || activeTab === 'FILTERS' || activeFacetFilter !== 'ALL') && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap',
              padding: '8px 14px',
              backgroundColor: '#FAFAFA',
              borderRadius: '12px',
              border: '1px solid rgba(12, 13, 13, 0.08)',
            }}
          >
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '4px' }}>
              Filter By:
            </span>

            
            <button
              onClick={() => setActiveFacetFilter(activeFacetFilter === 'P1' ? 'ALL' : 'P1')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '9999px',
                backgroundColor: activeFacetFilter === 'P1' ? '#DC2626' : '#FFFFFF',
                color: activeFacetFilter === 'P1' ? '#FFFFFF' : '#DC2626',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Flame size={11} />
              <span>P1 Only ({facetCounts.p1})</span>
            </button>

            
            <button
              onClick={() => setActiveFacetFilter(activeFacetFilter === 'P2' ? 'ALL' : 'P2')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 10px',
                borderRadius: '9999px',
                backgroundColor: activeFacetFilter === 'P2' ? '#B45309' : '#FFFFFF',
                color: activeFacetFilter === 'P2' ? '#FFFFFF' : '#B45309',
                border: '1px solid rgba(180, 83, 9, 0.3)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>P2 Only ({facetCounts.p2})</span>
            </button>

            
            <button
              onClick={() => setActiveFacetFilter(activeFacetFilter === 'P3' ? 'ALL' : 'P3')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 10px',
                borderRadius: '9999px',
                backgroundColor: activeFacetFilter === 'P3' ? '#2563EB' : '#FFFFFF',
                color: activeFacetFilter === 'P3' ? '#FFFFFF' : '#2563EB',
                border: '1px solid rgba(37, 99, 235, 0.3)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>P3 Only ({facetCounts.p3})</span>
            </button>

            
            <button
              onClick={() => setActiveFacetFilter(activeFacetFilter === 'P4' ? 'ALL' : 'P4')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 10px',
                borderRadius: '9999px',
                backgroundColor: activeFacetFilter === 'P4' ? '#4B5563' : '#FFFFFF',
                color: activeFacetFilter === 'P4' ? '#FFFFFF' : '#4B5563',
                border: '1px solid rgba(75, 85, 99, 0.3)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>P4 Only ({facetCounts.p4})</span>
            </button>

            
            <button
              onClick={() => setActiveFacetFilter(activeFacetFilter === 'CHURN_RISK' ? 'ALL' : 'CHURN_RISK')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '9999px',
                backgroundColor: activeFacetFilter === 'CHURN_RISK' ? '#0C0D0D' : '#FFFFFF',
                color: activeFacetFilter === 'CHURN_RISK' ? '#FFFFFF' : '#DC2626',
                border: activeFacetFilter === 'CHURN_RISK' ? '1px solid #0C0D0D' : '1px solid rgba(220, 38, 38, 0.35)',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <AlertTriangle size={11} />
              <span>Churn Risk ({facetCounts.churn})</span>
            </button>

            
            <button
              onClick={() => setActiveFacetFilter(activeFacetFilter === 'STRIPE' ? 'ALL' : 'STRIPE')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '9999px',
                backgroundColor: activeFacetFilter === 'STRIPE' ? '#7E22CE' : '#FFFFFF',
                color: activeFacetFilter === 'STRIPE' ? '#FFFFFF' : '#7E22CE',
                border: '1px solid rgba(126, 34, 206, 0.3)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <CreditCard size={10} />
              <span>Stripe ({facetCounts.stripe})</span>
            </button>

            
            <button
              onClick={() => setActiveFacetFilter(activeFacetFilter === 'EMAIL' ? 'ALL' : 'EMAIL')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '9999px',
                backgroundColor: activeFacetFilter === 'EMAIL' ? '#1D4ED8' : '#FFFFFF',
                color: activeFacetFilter === 'EMAIL' ? '#FFFFFF' : '#1D4ED8',
                border: '1px solid rgba(29, 78, 216, 0.3)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Mail size={10} />
              <span>Email ({facetCounts.email})</span>
            </button>

            
            <button
              onClick={() => setActiveFacetFilter(activeFacetFilter === 'TRUSTPILOT' ? 'ALL' : 'TRUSTPILOT')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '9999px',
                backgroundColor: activeFacetFilter === 'TRUSTPILOT' ? '#00875A' : '#FFFFFF',
                color: activeFacetFilter === 'TRUSTPILOT' ? '#FFFFFF' : '#00875A',
                border: '1px solid rgba(0, 135, 90, 0.3)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Star size={10} />
              <span>Trustpilot ({facetCounts.trustpilot})</span>
            </button>

            
            <button
              onClick={() => setActiveFacetFilter(activeFacetFilter === 'WEB_FORM' ? 'ALL' : 'WEB_FORM')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '9999px',
                backgroundColor: activeFacetFilter === 'WEB_FORM' ? '#B45309' : '#FFFFFF',
                color: activeFacetFilter === 'WEB_FORM' ? '#FFFFFF' : '#B45309',
                border: '1px solid rgba(180, 83, 9, 0.3)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Globe size={10} />
              <span>Web Form ({facetCounts.webForm})</span>
            </button>

            
            {activeFacetFilter !== 'ALL' && (
              <button
                onClick={() => setActiveFacetFilter('ALL')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(12, 13, 13, 0.08)',
                  color: '#0C0D0D',
                  border: 'none',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                ↺ Reset Filter
              </button>
            )}
          </div>
        )}
      </div>

      
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridColumns,
          alignItems: 'center',
          gap: '14px',
          padding: '8px 18px',
          backgroundColor: '#FAFAFA',
          borderRadius: '12px',
          border: '1px solid rgba(12, 13, 13, 0.05)',
          fontSize: '0.72rem',
          fontWeight: 700,
          color: '#64748B',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        <span>Ticket ID</span>
        <span>Customer & Channel</span>
        <span>Issue & Key Entities</span>
        <span>Severity & SLA Due</span>
        <span>Flags</span>
        <span style={{ textAlign: 'right' }}>Actions</span>
      </div>

      
      {sortedInquiries.length === 0 ? (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            border: '1px solid rgba(12, 13, 13, 0.08)',
            padding: '48px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#ECF4EE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#16a34a',
            }}
          >
            <CheckCircle2 size={24} />
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0C0D0D', margin: 0 }}>
            No Inquiries In This View
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#666666', maxWidth: '380px', margin: 0 }}>
            There are currently no tickets matching the "{activeTab}" filter. Select "All" or create a new test inquiry using the top action buttons.
          </p>
        </div>
      ) : (
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {sortedInquiries.map((ticket) => {
            const isSelected = selectedTicket?.id === ticket.id;
            const assignedAgent = getAssignedAgent(ticket.assigned_agent_id);

            return (
              <div
                key={ticket.id}
                onClick={() => onSelectTicket(ticket)}
                className={`table-row-card ${isSelected ? 'selected' : ''}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: gridColumns,
                  alignItems: 'center',
                  gap: '14px',
                  padding: '12px 18px',
                  backgroundColor: isSelected ? 'rgba(236, 244, 238, 0.7)' : '#FFFFFF',
                  borderRadius: '14px',
                  border: isSelected
                    ? '1.5px solid #0C0D0D'
                    : '1px solid rgba(12, 13, 13, 0.08)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected
                    ? '0 4px 16px rgba(12, 13, 13, 0.08)'
                    : '0 1px 3px rgba(12, 13, 13, 0.02)',
                }}
              >
                
                <div>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      color: '#1F2937',
                    }}
                  >
                    #{ticket.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>

                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
                  <span
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      color: '#0C0D0D',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={ticket.customer_name}
                  >
                    {ticket.customer_name}
                  </span>
                  <div>{getChannelBadge(ticket.channel)}</div>
                </div>

                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {Date.now() - new Date(ticket.created_at).getTime() < 180000 && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 7px',
                          borderRadius: '9999px',
                          backgroundColor: '#ECFDF5',
                          color: '#047857',
                          border: '1px solid #A7F3D0',
                          fontSize: '0.64rem',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                        }}
                      >
                        <span className="status-dot status-dot-green" /> NEW INTAKE
                      </span>
                    )}

                    <span
                      style={{
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        color: '#0C0D0D',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={ticket.subject}
                    >
                      {ticket.subject}
                    </span>
                  </div>

                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {getDepartmentBadge(ticket.department)}
                    {ticket.entities?.monetary_amount && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          backgroundColor: '#ECF4EE',
                          color: '#0C0D0D',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontWeight: 700,
                        }}
                      >
                        {ticket.entities.monetary_amount}
                      </span>
                    )}
                    {ticket.entities?.order_id && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          backgroundColor: 'rgba(12, 13, 13, 0.05)',
                          color: '#4B5563',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        Ref: {ticket.entities.order_id}
                      </span>
                    )}
                    {ticket.entities?.error_code && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          color: '#dc2626',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontWeight: 700,
                        }}
                      >
                        {ticket.entities.error_code}
                      </span>
                    )}
                  </div>
                </div>

                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {getSeverityBadge(ticket.priority)}
                  {getSlaDuePill(ticket)}
                </div>

                
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {ticket.churn_risk ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.74rem',
                        color: '#DC2626',
                        fontWeight: 700,
                      }}
                    >
                      <AlertTriangle size={12} color="#DC2626" /> Churn Risk
                    </span>
                  ) : (
                    <span style={{ color: '#9CA3AF', fontSize: '0.74rem', fontWeight: 500 }}>
                      All Clear
                    </span>
                  )}
                </div>

                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                  {ticket.status === InquiryStatusEnum.UNASSIGNED ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClaimTicket(ticket.id);
                      }}
                      disabled={isClaiming}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        backgroundColor: '#FFFFFF',
                        color: '#1F2937',
                        border: '1px solid rgba(12, 13, 13, 0.16)',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(12, 13, 13, 0.04)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F3F4F6')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                      title="Claim ticket for current operator"
                    >
                      <span>Claim</span>
                      <ChevronRight size={11} />
                    </button>
                  ) : ticket.status === InquiryStatusEnum.RESOLVED ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#059669',
                      }}
                    >
                      <CheckCircle2 size={12} /> Resolved
                    </span>
                  ) : ticket.status === InquiryStatusEnum.PENDING_CUSTOMER ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        color: '#B45309',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                      title="Ticket awaiting customer response. SLA countdown is paused."
                    >
                      <span>⏸</span> Waiting Info
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        backgroundColor: (assignedAgent?.id === currentAgent.id || ticket.assigned_agent_id === currentAgent.id) ? '#ECFDF5' : 'rgba(37, 99, 235, 0.08)',
                        color: (assignedAgent?.id === currentAgent.id || ticket.assigned_agent_id === currentAgent.id) ? '#047857' : '#1D4ED8',
                        border: (assignedAgent?.id === currentAgent.id || ticket.assigned_agent_id === currentAgent.id) ? '1px solid #A7F3D0' : '1px solid rgba(37, 99, 235, 0.2)',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                      title={`Assigned to ${assignedAgent ? `${assignedAgent.name} (${assignedAgent.role})` : (ticket.assigned_agent_id || 'Operator')}`}
                    >
                      <User size={11} />
                      <span>
                        {(assignedAgent?.id === currentAgent.id || ticket.assigned_agent_id === currentAgent.id)
                          ? 'Assigned to You'
                          : assignedAgent
                            ? assignedAgent.name
                            : 'Assigned'}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
