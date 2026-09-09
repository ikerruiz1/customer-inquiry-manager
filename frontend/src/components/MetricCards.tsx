import React from 'react';
import { ArrowUpRight, ArrowDownRight, AlertTriangle, Clock, Sparkles, Inbox, Flame } from 'lucide-react';
import type { KPIStats, Inquiry } from '../types/inquiry';
import { PriorityEnum, InquiryStatusEnum } from '../types/inquiry';

interface MetricCardsProps {
  kpis: KPIStats;
  inquiries: Inquiry[];
}

export const MetricCards: React.FC<MetricCardsProps> = ({ kpis, inquiries }) => {
  const now = Date.now();

  const totalOpened = inquiries.length;
  const inTriage = inquiries.filter((i) => i.status === InquiryStatusEnum.UNASSIGNED).length;
  const activeSLA = inquiries.filter((i) => {
    if (i.status === InquiryStatusEnum.RESOLVED) return false;
    const deadline = new Date(i.sla_deadline_at).getTime();
    return deadline > now;
  }).length;
  const overdueCount = inquiries.filter((i) => {
    if (i.status === InquiryStatusEnum.RESOLVED) return false;
    const deadline = new Date(i.sla_deadline_at).getTime();
    return deadline <= now;
  }).length;
  const emergenciesCount = inquiries.filter(
    (i) => i.priority === PriorityEnum.P1 && i.status !== InquiryStatusEnum.RESOLVED
  ).length;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '1rem',
        width: '100%',
      }}
    >
      {/* 1. Opened Tickets */}
      <div
        style={{
          backgroundColor: 'var(--card-bg)',
          borderRadius: '0.85rem',
          padding: '1.1rem 1.25rem',
          border: '1px solid var(--card-border)',
          boxShadow: 'var(--card-shadow)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Opened Tickets
          </span>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Inbox size={15} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.65rem', marginTop: '0.75rem' }}>
          <span style={{ fontSize: '1.9rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {totalOpened}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: '#10b981',
              gap: '0.15rem',
            }}
          >
            <ArrowUpRight size={13} /> 40% vs last week
          </span>
        </div>
      </div>

      {/* 2. In Triage */}
      <div
        style={{
          backgroundColor: 'var(--card-bg)',
          borderRadius: '0.85rem',
          padding: '1.1rem 1.25rem',
          border: '1px solid var(--card-border)',
          boxShadow: 'var(--card-shadow)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            In Triage (AI)
          </span>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: '#f0fdf4',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={15} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.65rem', marginTop: '0.75rem' }}>
          <span style={{ fontSize: '1.9rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {inTriage}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: '#3b82f6',
              gap: '0.2rem',
            }}
          >
            <Sparkles size={11} /> {kpis.aiAcceptanceRate}% AI match
          </span>
        </div>
      </div>

      {/* 3. Active SLA */}
      <div
        style={{
          backgroundColor: 'var(--card-bg)',
          borderRadius: '0.85rem',
          padding: '1.1rem 1.25rem',
          border: '1px solid var(--card-border)',
          boxShadow: 'var(--card-shadow)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Active SLA
          </span>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: '#f8fafc',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clock size={15} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.65rem', marginTop: '0.75rem' }}>
          <span style={{ fontSize: '1.9rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {activeSLA}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: '#10b981',
              gap: '0.15rem',
            }}
          >
            <ArrowUpRight size={13} /> {kpis.slaComplianceRate}% compliance
          </span>
        </div>
      </div>

      {/* 4. Overdue SLA */}
      <div
        style={{
          backgroundColor: 'var(--card-bg)',
          borderRadius: '0.85rem',
          padding: '1.1rem 1.25rem',
          border: overdueCount > 0 ? '1px solid #fca5a5' : '1px solid var(--card-border)',
          boxShadow: 'var(--card-shadow)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: overdueCount > 0 ? '#dc2626' : 'var(--text-muted)' }}>
            Overdue SLA
          </span>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: overdueCount > 0 ? '#fef2f2' : '#f8fafc',
              color: overdueCount > 0 ? '#ef4444' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={15} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.65rem', marginTop: '0.75rem' }}>
          <span style={{ fontSize: '1.9rem', fontWeight: 700, color: overdueCount > 0 ? '#dc2626' : 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {overdueCount}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: overdueCount > 0 ? '#ef4444' : '#10b981',
              gap: '0.15rem',
            }}
          >
            {overdueCount > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {overdueCount > 0 ? 'Breached' : '0% breach'}
          </span>
        </div>
      </div>

      {/* 5. Emergencies / P1 */}
      <div
        style={{
          backgroundColor: emergenciesCount > 0 ? '#fff5f5' : 'var(--card-bg)',
          borderRadius: '0.85rem',
          padding: '1.1rem 1.25rem',
          border: emergenciesCount > 0 ? '1px solid #fecaca' : '1px solid var(--card-border)',
          boxShadow: 'var(--card-shadow)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: emergenciesCount > 0 ? '#b91c1c' : 'var(--text-muted)' }}>
            Emergencies (P1)
          </span>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: emergenciesCount > 0 ? '#fee2e2' : '#f8fafc',
              color: emergenciesCount > 0 ? '#dc2626' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Flame size={15} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.65rem', marginTop: '0.75rem' }}>
          <span style={{ fontSize: '1.9rem', fontWeight: 700, color: emergenciesCount > 0 ? '#b91c1c' : 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {emergenciesCount}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: emergenciesCount > 0 ? '#dc2626' : '#10b981',
              gap: '0.15rem',
            }}
          >
            {emergenciesCount > 0 ? 'Action Required' : 'All Clear'}
          </span>
        </div>
      </div>
    </div>
  );
};
