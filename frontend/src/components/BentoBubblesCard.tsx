import React from 'react';
import { Sparkles, PieChart } from 'lucide-react';

export const BentoBubblesCard: React.FC = () => {
  return (
    <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
          AI Classification
        </span>

        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--pastel-lilac)',
          }}
        >
          <PieChart size={14} />
        </div>
      </div>

      {/* Overlapping Pastel Bubble Circles (Fitonist "Age range" style) */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '170px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Bubble 1: Large Lilac Circle (46% Tech Support) */}
        <div
          style={{
            position: 'absolute',
            left: '12%',
            bottom: '10px',
            width: '120px',
            height: '120px',
            borderRadius: '9999px',
            backgroundColor: 'var(--pastel-lilac)',
            color: '#0d0e14',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(184, 165, 254, 0.35)',
            zIndex: 3,
            cursor: 'default',
            transition: 'transform 0.2s ease',
          }}
          title="Amazon Bedrock Tech Support Triage"
        >
          <span style={{ fontSize: '1.45rem', fontWeight: 800, lineHeight: '1' }}>46%</span>
          <span style={{ fontSize: '0.62rem', fontWeight: 700, marginTop: '2px', opacity: 0.85 }}>
            Tech Support
          </span>
        </div>

        {/* Bubble 2: Yellow Circle (32% Billing & Disputes) */}
        <div
          style={{
            position: 'absolute',
            right: '18%',
            bottom: '15px',
            width: '95px',
            height: '95px',
            borderRadius: '9999px',
            backgroundColor: 'var(--pastel-yellow)',
            color: '#0d0e14',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 20px rgba(254, 240, 138, 0.3)',
            zIndex: 4,
            cursor: 'default',
            transition: 'transform 0.2s ease',
          }}
          title="Stripe & Invoicing Billing"
        >
          <span style={{ fontSize: '1.25rem', fontWeight: 800, lineHeight: '1' }}>32%</span>
          <span style={{ fontSize: '0.6rem', fontWeight: 700, marginTop: '2px', opacity: 0.85 }}>
            Billing
          </span>
        </div>

        {/* Bubble 3: Sky Cyan Circle (18% Security & Accounts) */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '38%',
            width: '78px',
            height: '78px',
            borderRadius: '9999px',
            backgroundColor: 'var(--pastel-cyan)',
            color: '#0d0e14',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(103, 232, 249, 0.3)',
            zIndex: 2,
            cursor: 'default',
          }}
          title="Security & Accounts"
        >
          <span style={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: '1' }}>18%</span>
          <span style={{ fontSize: '0.55rem', fontWeight: 700, marginTop: '1px', opacity: 0.85 }}>
            Security
          </span>
        </div>

        {/* Bubble 4: Small Emerald Circle (4% General) */}
        <div
          style={{
            position: 'absolute',
            top: '32px',
            right: '16%',
            width: '42px',
            height: '42px',
            borderRadius: '9999px',
            backgroundColor: 'var(--pastel-mint)',
            color: '#0d0e14',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(74, 222, 128, 0.3)',
            zIndex: 1,
            cursor: 'default',
          }}
          title="General Inquiry"
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 800, lineHeight: '1' }}>4%</span>
        </div>
      </div>

      {/* Model Grounding Footnote */}
      <div style={{ marginTop: '0.4rem', textAlign: 'center', fontSize: '0.68rem', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
        <Sparkles size={11} style={{ color: 'var(--pastel-lilac)' }} />
        <span>Amazon Bedrock Claude Haiku Autonomous Department Routing</span>
      </div>
    </div>
  );
};
