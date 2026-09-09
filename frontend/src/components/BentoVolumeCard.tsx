import React, { useState } from 'react';
import { Bot, UserCheck } from 'lucide-react';

export const BentoVolumeCard: React.FC = () => {
  const [activeRange, setActiveRange] = useState<'Today' | 'Week' | 'Month' | 'Range'>('Week');

  // Days of week with stylized bar heights matching Fitonist installs chart
  const weekDays = [
    { day: 'Mon', h1: 45, h2: 0, active: false },
    { day: 'Tue', h1: 65, h2: 0, active: false },
    { day: 'Wed', h1: 50, h2: 0, active: false },
    { day: 'Thu', h1: 70, h2: 0, active: false },
    { day: 'Fri', h1: 85, h2: 35, active: true, pillLilac: '562', pillYellow: '286' },
    { day: 'Sat', h1: 40, h2: 0, active: false },
    { day: 'Sun', h1: 30, h2: 0, active: false },
  ];

  return (
    <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      {/* Card Header: Title + Range Pills */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
          Ticket Volume
        </span>

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

      {/* Main Stat + Sub-Pills (Fitonist Installs 4,365 + 2,876 Apple / 1,489 Android style) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em' }}>
            1,284
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>This week</span>
        </div>

        {/* Sub-Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Bedrock Auto Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.65rem',
              borderRadius: '12px',
              backgroundColor: '#1d1e2a',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <Bot size={13} style={{ color: 'var(--pastel-lilac)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>842</span>
          </div>

          {/* Human Review Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.65rem',
              borderRadius: '12px',
              backgroundColor: '#1d1e2a',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <UserCheck size={13} style={{ color: 'var(--pastel-yellow)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>442</span>
          </div>
        </div>
      </div>

      {/* Stylized Hatched Column Bars with Pastel Floating Pills */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', gap: '0.5rem' }}>
        {weekDays.map((col, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              height: '100%',
              justifyContent: 'flex-end',
              flex: 1,
            }}
          >
            {/* If Active Friday Column: Display Floating Lilac and Yellow Pills */}
            {col.active ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '4px' }}>
                {/* Lilac Top Pill (P1 Criticals: 562) */}
                <div
                  style={{
                    backgroundColor: 'var(--pastel-lilac)',
                    color: '#0d0e14',
                    fontWeight: 800,
                    fontSize: '0.72rem',
                    padding: '0.55rem 0.2rem',
                    borderRadius: '10px',
                    width: '100%',
                    textAlign: 'center',
                    boxShadow: '0 4px 12px rgba(184, 165, 254, 0.3)',
                  }}
                >
                  {col.pillLilac}
                </div>

                {/* Yellow Bottom Pill (P2 High: 286) */}
                <div
                  style={{
                    backgroundColor: 'var(--pastel-yellow)',
                    color: '#0d0e14',
                    fontWeight: 800,
                    fontSize: '0.72rem',
                    padding: '0.45rem 0.2rem',
                    borderRadius: '10px',
                    width: '100%',
                    textAlign: 'center',
                    boxShadow: '0 4px 12px rgba(254, 240, 138, 0.25)',
                  }}
                >
                  {col.pillYellow}
                </div>
              </div>
            ) : (
              /* Other Days: Hatched Carbon Bar with Rounded Cap */
              <div
                className="hatched-bar"
                style={{
                  width: '100%',
                  height: `${col.h1}%`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  paddingTop: '6px',
                }}
              >
                <div
                  style={{
                    width: '12px',
                    height: '3px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '9999px',
                  }}
                />
              </div>
            )}

            {/* Day Label */}
            <span style={{ fontSize: '0.68rem', color: col.active ? '#ffffff' : 'var(--text-faint)', marginTop: '0.45rem', fontWeight: col.active ? 700 : 500 }}>
              {col.day}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
