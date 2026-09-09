import React, { useState } from 'react';
import { ArrowUpRight, Sparkles, Zap } from 'lucide-react';
import type { KPIStats } from '../types/inquiry';

interface BentoVelocityCardProps {
  kpis: KPIStats;
}

export const BentoVelocityCard: React.FC<BentoVelocityCardProps> = ({ kpis }) => {
  const [activeRange, setActiveRange] = useState<'Today' | 'Week' | 'Month' | 'Range'>('Month');

  return (
    <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      {/* Card Header: Title + Pill Range Toggles */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Inquiry Velocity
          </span>
          <span
            style={{
              fontSize: '0.68rem',
              color: 'var(--pastel-lilac)',
              background: 'var(--pastel-lilac-bg)',
              padding: '0.15rem 0.45rem',
              borderRadius: '9999px',
              fontWeight: 600,
            }}
          >
            Bedrock AI
          </span>
        </div>

        {/* Range Pill Toggle */}
        <div className="card-range-pills">
          {(['Today', 'Week', 'Month', 'Range'] as const).map((range) => (
            <button
              key={range}
              className={`card-range-btn ${activeRange === range ? 'active' : ''}`}
              onClick={() => setActiveRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Main Stats (Fitonist Revenue & Daily subs style) */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2.5rem', marginBottom: '1.25rem' }}>
        {/* Stat 1: AI Acceptance Rate */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em' }}>
              {kpis.aiAcceptanceRate}%
            </span>
            <span className="badge-trend-mint">
              <ArrowUpRight size={12} />
              <span>+4.2%</span>
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Autonomous Acceptance
          </span>
        </div>

        {/* Stat 2: MTTR */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em' }}>
              {kpis.avgMttrSeconds}s
            </span>
            <span className="badge-trend-mint">
              <Zap size={11} />
              <span>-92%</span>
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            1-Click MTTR (vs 15m baseline)
          </span>
        </div>
      </div>

      {/* Interactive Wavy Spline Curves SVG (Fitonist smooth wave graph) */}
      <div style={{ position: 'relative', width: '100%', height: '110px', marginTop: 'auto' }}>
        {/* Tooltip Pill */}
        <div
          style={{
            position: 'absolute',
            top: '4px',
            right: '25%',
            backgroundColor: '#1f202e',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '9999px',
            padding: '0.2rem 0.6rem',
            fontSize: '0.7rem',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            zIndex: 5,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '9999px', background: 'var(--pastel-lilac)' }} />
            842 AI Triage
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '9999px', background: 'var(--pastel-yellow)' }} />
            142 Escalate
          </span>
        </div>

        <svg viewBox="0 0 500 120" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="lilacGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b8a5fe" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#b8a5fe" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="yellowGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fde047" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#fde047" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background Area Fill */}
          <path
            d="M 0,90 Q 70,30 140,65 T 280,40 T 420,55 T 500,35 L 500,120 L 0,120 Z"
            fill="url(#lilacGradient)"
          />

          {/* Lilac Wave (Inquiry Ingested / Autonomous Dispatch) */}
          <path
            d="M 0,90 Q 70,30 140,65 T 280,40 T 420,55 T 500,35"
            fill="none"
            stroke="var(--pastel-lilac)"
            strokeWidth="2.8"
            strokeLinecap="round"
          />

          {/* Yellow Wave (Human Escalations / Reviews) */}
          <path
            d="M 0,105 Q 60,85 130,95 T 270,75 T 410,85 T 500,60"
            fill="none"
            stroke="var(--pastel-yellow)"
            strokeWidth="2.2"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />

          {/* Glowing Active Dot */}
          <circle cx="340" cy="46" r="6" fill="var(--pastel-lilac)" />
          <circle cx="340" cy="46" r="11" fill="none" stroke="var(--pastel-lilac)" strokeWidth="1.5" opacity="0.5" />
          <line x1="340" y1="46" x2="340" y2="120" stroke="rgba(255, 255, 255, 0.15)" strokeDasharray="3 3" />
        </svg>

        {/* X-Axis Labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', fontSize: '0.65rem', color: 'var(--text-faint)' }}>
          <span>Day 1</span>
          <span>Day 6</span>
          <span>Day 12</span>
          <span>Day 18</span>
          <span>Day 24</span>
          <span>Day 30</span>
        </div>
      </div>

      {/* Unit Economics Note */}
      <div style={{ marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Sparkles size={12} style={{ color: 'var(--pastel-lilac)' }} />
          <span>GenAI Unit Economics: ~0.00025 € / inference (Claude Haiku 4.5)</span>
        </span>
        <span style={{ fontWeight: 600, color: 'var(--pastel-mint)' }}>99.9% Cost Reduction</span>
      </div>
    </div>
  );
};
