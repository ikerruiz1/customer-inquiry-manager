import React from 'react';
import { Clock, Brain, ShieldCheck, Zap } from 'lucide-react';
import { DepartmentEnum } from '../types/inquiry';
import type { KPIStats, Inquiry } from '../types/inquiry';

export interface SlaMatrixHeroCardProps {
  kpis: KPIStats;
  inquiries: Inquiry[];
  dragHandle?: React.ReactNode;
}

export const SlaMatrixHeroCard: React.FC<SlaMatrixHeroCardProps> = ({ kpis, inquiries, dragHandle }) => {
  const totalInquiries = inquiries.length || 1;
  const now = Date.now();
  const overdueCount = inquiries.filter(
    (t) => t.status !== 'RESOLVED' && new Date(t.sla_deadline_at).getTime() < now
  ).length;
  const activeInBoundsCount = inquiries.filter(
    (t) => t.status !== 'RESOLVED' && new Date(t.sla_deadline_at).getTime() >= now
  ).length;

  const resolvedCount = inquiries.filter((t) => t.status === 'RESOLVED').length;
  const inBoundsPct = Math.round((activeInBoundsCount / totalInquiries) * 100);
  const overduePct = Math.round((overdueCount / totalInquiries) * 100);
  const resolvedPct = Math.max(0, 100 - inBoundsPct - overduePct);

  return (
    <div className="loadlogic-sage-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} color="#1F2937" />
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1F2937', letterSpacing: '-0.02em' }}>
                Operational Triage & SLA Matrix
              </span>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
              Deterministic ITIL queue load, SLA compliance & critical incident monitoring
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 9px',
                borderRadius: '9999px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--color-border)',
                fontSize: '0.7rem',
                fontWeight: 700,
                color: kpis.slaComplianceRate >= 95 ? '#047857' : '#B45309',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: kpis.slaComplianceRate >= 95 ? '#10B981' : '#F59E0B',
                }}
              />
              <span>{kpis.slaComplianceRate}% In-Bounds</span>
            </div>

            {dragHandle}
          </div>
        </div>

        {/* Big SLA Compliance Percentage Metric + Status Tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
          <span style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1F2937', letterSpacing: '-0.03em' }}>
            {kpis.slaComplianceRate}%
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              padding: '3px 8px',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#1F2937',
              border: '1px solid var(--color-border)',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: overdueCount === 0 ? '#10B981' : '#EF4444',
              }}
            />
            <span>{overdueCount === 0 ? 'Optimal Queue Health' : `${overdueCount} Critical Breaches`}</span>
          </span>
        </div>

        {/* Proportional Segmented SLA Breakdown Bar */}
        <div
          style={{
            width: '100%',
            height: '10px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(12, 13, 13, 0.08)',
            display: 'flex',
            overflow: 'hidden',
            marginBottom: '12px',
          }}
        >
          {inBoundsPct > 0 && (
            <div
              style={{
                width: `${inBoundsPct}%`,
                height: '100%',
                backgroundColor: '#047857',
                transition: 'width 0.3s ease',
              }}
              title={`Active In-Bounds SLA: ${activeInBoundsCount} tickets (${inBoundsPct}%)`}
            />
          )}
          {resolvedPct > 0 && (
            <div
              style={{
                width: `${resolvedPct}%`,
                height: '100%',
                backgroundColor: '#10B981',
                transition: 'width 0.3s ease',
              }}
              title={`Resolved SLA: ${resolvedCount} tickets (${resolvedPct}%)`}
            />
          )}
          {overduePct > 0 && (
            <div
              style={{
                width: `${overduePct}%`,
                height: '100%',
                backgroundColor: '#DC2626',
                transition: 'width 0.3s ease',
              }}
              title={`Overdue Breach: ${overdueCount} tickets (${overduePct}%)`}
            />
          )}
        </div>

        {/* Explicit SLA Metrics Section Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#4B5563' }}>
            SLA & Incident Metric Breakdown
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            {inquiries.length} Active Tickets
          </span>
        </div>

        {/* 4 Crisp KPI Tiles (2x2 Grid Styled Identically to Right Card) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px',
          }}
        >
          {/* Tile 1: Opened Tickets */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.75)',
              border: '1px solid rgba(12, 13, 13, 0.06)',
              fontSize: '0.72rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#2563EB',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 700, color: '#1F2937' }}>Opened Tickets</span>
            </div>
            <span style={{ fontWeight: 800, color: '#1F2937' }}>
              {inquiries.length} <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>(100%)</span>
            </span>
          </div>

          {/* Tile 2: Active SLA */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.75)',
              border: '1px solid rgba(12, 13, 13, 0.06)',
              fontSize: '0.72rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#047857',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 700, color: '#1F2937' }}>Active SLA</span>
            </div>
            <span style={{ fontWeight: 800, color: '#047857' }}>
              {activeInBoundsCount} <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>({Math.round((activeInBoundsCount / totalInquiries) * 100)}%)</span>
            </span>
          </div>

          {/* Tile 3: Overdue SLA */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: '8px',
              backgroundColor: overdueCount > 0 ? 'rgba(254, 242, 242, 0.85)' : 'rgba(255, 255, 255, 0.75)',
              border: overdueCount > 0 ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(12, 13, 13, 0.06)',
              fontSize: '0.72rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: overdueCount > 0 ? '#DC2626' : '#6B7280',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 700, color: overdueCount > 0 ? '#DC2626' : '#1F2937' }}>Overdue SLA</span>
            </div>
            <span style={{ fontWeight: 800, color: overdueCount > 0 ? '#DC2626' : '#1F2937' }}>
              {overdueCount} <span style={{ fontSize: '0.65rem', color: overdueCount > 0 ? '#DC2626' : 'var(--color-text-muted)', fontWeight: 600 }}>({Math.round((overdueCount / totalInquiries) * 100)}%)</span>
            </span>
          </div>

          {/* Tile 4: Emergencies (P1) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: '8px',
              backgroundColor: kpis.p1Count > 0 ? 'rgba(254, 242, 242, 0.85)' : 'rgba(255, 255, 255, 0.75)',
              border: kpis.p1Count > 0 ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(12, 13, 13, 0.06)',
              fontSize: '0.72rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: kpis.p1Count > 0 ? '#EF4444' : '#6B7280',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 700, color: kpis.p1Count > 0 ? '#DC2626' : '#1F2937' }}>Emergencies (P1)</span>
            </div>
            <span style={{ fontWeight: 800, color: kpis.p1Count > 0 ? '#DC2626' : '#1F2937' }}>
              {kpis.p1Count} <span style={{ fontSize: '0.65rem', color: kpis.p1Count > 0 ? '#DC2626' : 'var(--color-text-muted)', fontWeight: 600 }}>({Math.round((kpis.p1Count / totalInquiries) * 100)}%)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Footnote */}
      <div
        style={{
          marginTop: '10px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(12, 13, 13, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.74rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Target SLA Bound:</span>
          <strong style={{ color: '#1F2937', fontWeight: 800 }}>
            ≥ 95.0%
          </strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Avg AI MTTR:</span>
          <strong style={{ color: '#047857', fontWeight: 800 }}>
            {kpis.avgMttrSeconds}s
          </strong>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.68rem' }}>(vs 15m manual)</span>
        </div>
      </div>
    </div>
  );
};

export interface BedrockRoutingHeroCardProps {
  kpis: KPIStats;
  inquiries: Inquiry[];
  dragHandle?: React.ReactNode;
}

export const BedrockRoutingHeroCard: React.FC<BedrockRoutingHeroCardProps> = ({ kpis, inquiries, dragHandle }) => {
  const departmentCounts: Record<DepartmentEnum, number> = {
    [DepartmentEnum.TECH_SUPPORT]: 0,
    [DepartmentEnum.BILLING]: 0,
    [DepartmentEnum.SECURITY]: 0,
    [DepartmentEnum.ACCOUNTS]: 0,
    [DepartmentEnum.SALES]: 0,
    [DepartmentEnum.GENERAL]: 0,
  };

  inquiries.forEach((ticket) => {
    if (departmentCounts[ticket.department] !== undefined) {
      departmentCounts[ticket.department]++;
    }
  });

  const totalInquiries = inquiries.length || 1;

  const orderedDepartments: DepartmentEnum[] = [
    DepartmentEnum.TECH_SUPPORT,
    DepartmentEnum.SECURITY,
    DepartmentEnum.GENERAL,
    DepartmentEnum.BILLING,
    DepartmentEnum.ACCOUNTS,
    DepartmentEnum.SALES,
  ];

  const departmentMeta: Record<DepartmentEnum, { label: string; color: string; bg: string; dotBorder?: string }> = {
    [DepartmentEnum.TECH_SUPPORT]: { label: 'Tech Support', color: '#111827', bg: 'rgba(17, 24, 39, 0.08)' },
    [DepartmentEnum.SECURITY]: { label: 'Security', color: '#6B7280', bg: 'rgba(107, 114, 128, 0.12)' },
    [DepartmentEnum.GENERAL]: { label: 'General', color: '#CBD5E1', bg: 'rgba(203, 213, 225, 0.25)', dotBorder: '1px solid #94A3B8' },
    [DepartmentEnum.BILLING]: { label: 'Billing', color: '#064E3B', bg: 'rgba(6, 78, 59, 0.08)' },
    [DepartmentEnum.ACCOUNTS]: { label: 'Accounts', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
    [DepartmentEnum.SALES]: { label: 'Sales', color: '#84CC16', bg: 'rgba(132, 204, 22, 0.15)' },
  };

  return (
    <div className="loadlogic-sage-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Brain size={16} color="#1F2937" />
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1F2937', letterSpacing: '-0.02em' }}>
                Bedrock Autonomous Routing
              </span>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
              Claude Haiku 4.5 semantic classification across 6 enterprise domains
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '9999px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--color-border)',
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#047857',
              }}
            >
              <Zap size={11} />
              <span>~0.00025 €/ticket</span>
            </div>

            {dragHandle}
          </div>
        </div>

        {/* Big Volume Metric + Accuracy Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
          <span style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1F2937', letterSpacing: '-0.03em' }}>
            {inquiries.length} Inquiries
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              padding: '3px 8px',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#1F2937',
              border: '1px solid var(--color-border)',
            }}
          >
            <ShieldCheck size={12} color="#047857" />
            <span>{kpis.aiAcceptanceRate}% AI Accuracy</span>
          </span>
        </div>

        {/* Proportional Segmented Department Distribution Bar */}
        <div
          style={{
            width: '100%',
            height: '10px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(12, 13, 13, 0.08)',
            display: 'flex',
            overflow: 'hidden',
            marginBottom: '12px',
          }}
        >
          {orderedDepartments.map((dept) => {
            const count = departmentCounts[dept] || 0;
            const pct = Math.round((count / totalInquiries) * 100);
            if (pct <= 0) return null;
            return (
              <div
                key={dept}
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  backgroundColor: departmentMeta[dept].color,
                  transition: 'width 0.3s ease',
                }}
                title={`${departmentMeta[dept].label}: ${count} tickets (${pct}%)`}
              />
            );
          })}
        </div>

        {/* Explicit Department Legend Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#4B5563' }}>
            Autonomous Routing Legend by Domain
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            {inquiries.length} Active Tickets
          </span>
        </div>

        {/* Department Legend Grid: 3 Distinct Greys (Top) + 3 Distinct Greens (Bottom) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
          }}
        >
          {orderedDepartments.map((dept) => {
            const count = departmentCounts[dept] || 0;
            const meta = departmentMeta[dept];
            const pct = Math.round((count / totalInquiries) * 100);
            return (
              <div
                key={dept}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 8px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                  border: '1px solid rgba(12, 13, 13, 0.06)',
                  fontSize: '0.72rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: meta.color,
                      border: meta.dotBorder || 'none',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontWeight: 700, color: '#1F2937' }}>
                    {meta.label}
                  </span>
                </div>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>
                  {count} <span style={{ fontSize: '0.65rem', opacity: 0.85 }}>({pct}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footnote */}
      <div
        style={{
          marginTop: '10px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(12, 13, 13, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.74rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Bedrock Base Engine:</span>
          <strong style={{ color: '#1F2937', fontWeight: 800 }}>
            Claude Haiku 4.5
          </strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>VPC Egress:</span>
          <strong style={{ color: '#047857', fontWeight: 800 }}>
            PrivateLink (Zero NAT)
          </strong>
        </div>
      </div>
    </div>
  );
};

export interface LoadLogicHeroCardsProps {
  kpis: KPIStats;
  inquiries: Inquiry[];
}

export const LoadLogicHeroCards: React.FC<LoadLogicHeroCardsProps> = ({ kpis, inquiries }) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        width: '100%',
      }}
    >
      <SlaMatrixHeroCard kpis={kpis} inquiries={inquiries} />
      <BedrockRoutingHeroCard kpis={kpis} inquiries={inquiries} />
    </div>
  );
};
