import React from 'react';
import { ChevronDown, ArrowUpRight, CheckCircle2, Clock } from 'lucide-react';
import type { KPIStats } from '../types/inquiry';

interface BentoSLAMatrixCardProps {
  kpis: KPIStats;
}

export const BentoSLAMatrixCard: React.FC<BentoSLAMatrixCardProps> = ({ kpis }) => {
  // Calendar days grid representation
  const daysOfWeek = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const days = [
    { num: 1, active: false, dot: false },
    { num: 2, active: false, dot: false },
    { num: 3, active: false, dot: false },
    { num: 4, active: false, dot: false },
    { num: 5, active: false, dot: false },
    { num: 6, active: false, dot: true },
    { num: 7, active: false, dot: false },
    { num: 8, active: false, dot: false },
    { num: 9, active: false, dot: false },
    { num: 10, active: false, dot: false },
    { num: 11, active: false, dot: false },
    { num: 12, active: false, dot: false },
    { num: 13, active: true, dot: false },
    { num: 14, active: true, dot: false },
    { num: 15, active: true, dot: false },
    { num: 16, active: true, dot: false },
    { num: 17, active: true, dot: false },
    { num: 18, active: true, dot: false },
    { num: 19, active: true, dot: false },
    { num: 20, active: false, dot: false },
    { num: 21, active: false, dot: false },
    { num: 22, active: false, dot: false },
    { num: 23, active: false, dot: false },
    { num: 24, active: false, dot: false },
    { num: 25, active: false, dot: false },
    { num: 26, active: false, dot: false },
    { num: 27, active: false, dot: false },
    { num: 28, active: false, dot: true },
    { num: 29, active: false, dot: false },
    { num: 30, active: false, dot: false },
  ];

  return (
    <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      {/* Header: Month selector + Expand icon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.88rem',
            fontWeight: 700,
            color: '#ffffff',
            cursor: 'pointer',
          }}
        >
          <span>September 2026</span>
          <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
        </div>

        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <ArrowUpRight size={13} />
        </div>
      </div>

      {/* SLA Calendar Matrix Grid (Fitonist calendar style) */}
      <div style={{ width: '100%' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '0.4rem' }}>
          {daysOfWeek.map((d, i) => (
            <span key={i} style={{ fontSize: '0.68rem', color: 'var(--text-faint)', fontWeight: 600 }}>
              {d}
            </span>
          ))}
        </div>

        {/* Days numbers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.3rem', textAlign: 'center' }}>
          {days.map((item, index) => (
            <div
              key={index}
              style={{
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: item.active ? '8px' : '6px',
                backgroundColor: item.active ? 'var(--pastel-lilac)' : 'transparent',
                color: item.active ? '#0d0e14' : 'var(--text-muted)',
                fontWeight: item.active ? 700 : 500,
                fontSize: '0.74rem',
                position: 'relative',
              }}
            >
              <span>{item.num}</span>
              {item.dot && !item.active && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '2px',
                    width: '3px',
                    height: '3px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--pastel-yellow)',
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Stat: SLA Compliance & FinOps */}
      <div
        style={{
          marginTop: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
            {kpis.slaComplianceRate}%
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--pastel-mint)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <CheckCircle2 size={11} /> ITIL SLA In-Bounds
          </span>
        </div>

        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--pastel-lilac)',
          }}
          title="0 Overdue Breaches Active"
        >
          <Clock size={15} />
        </div>
      </div>
    </div>
  );
};
