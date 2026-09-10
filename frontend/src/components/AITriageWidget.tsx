import React from 'react';
import { Sparkles, Zap, ShieldAlert, AlertTriangle } from 'lucide-react';
import { ChannelEnum } from '../types/inquiry';

interface AITriageWidgetProps {
  onInjectScenario: (payload: {
    channel: ChannelEnum;
    customer_email: string;
    customer_name: string;
    subject: string;
    body: string;
  }) => void;
  isInjecting: boolean;
}

export const AITriageWidget: React.FC<AITriageWidgetProps> = ({
  onInjectScenario,
  isInjecting,
}) => {
  // Pre-configured canonical simulation payloads
  const triggerStripeDispute = () => {
    onInjectScenario({
      channel: ChannelEnum.BILLING,
      customer_email: 'finance@enterprise-saas.com',
      customer_name: 'Sophia Vance',
      subject: '[DISPUTA STRIPE] Retención de 1,200 EUR en tarjeta corporativa',
      body: 'Hemos detectado una retención de 1,200 EUR no autorizada en Stripe (ref: dp_live_99214). Exigimos cancelación inmediata o daremos de baja el servicio ExampleCorp hoy mismo.',
    });
  };

  const triggerTrustpilotChurn = () => {
    onInjectScenario({
      channel: ChannelEnum.TRUSTPILOT,
      customer_email: 'angry-ceo@retail-group.co.uk',
      customer_name: 'Arthur Pendelton',
      subject: 'Reseña 1 Estrella: Pésimo soporte y caída del sistema',
      body: 'Llevamos 4 horas sin poder facturar y ningún agente responde. Su servicio de soporte técnico es un desastre. Cancelaremos el contrato si no contactan de inmediato.',
    });
  };

  const triggerEmailOutage = () => {
    onInjectScenario({
      channel: ChannelEnum.EMAIL,
      customer_email: 'ops@infra-monitor.net',
      customer_name: 'Marcus Brody',
      subject: 'Alerta SRE: 502 Bad Gateway en backend de producción',
      body: 'Se reportan picos de 502 Bad Gateway tras el despliegue en eu-west-1. Los contenedores Fargate están reiniciando continuamente por error de memoria OOM.',
    });
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--card-bg)',
        borderRadius: '0.85rem',
        padding: '1.25rem',
        border: '1px solid var(--card-border)',
        boxShadow: 'var(--card-shadow)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {/* Widget Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={16} style={{ color: '#2563eb' }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
            AI Triage Confidence
          </span>
        </div>
        <span
          style={{
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '0.15rem 0.5rem',
            borderRadius: '9999px',
          }}
        >
          Bedrock Haiku 4.5
        </span>
      </div>

      {/* SVG Donut Chart (matching reference image) */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0.25rem 0' }}>
        <div style={{ position: 'relative', width: '150px', height: '150px' }}>
          <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            {/* Background Track */}
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="4.2"
            />
            {/* Segment 1: Ready for Dispatch (60% - Blue) */}
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#2563eb"
              strokeWidth="4.2"
              strokeDasharray="60, 100"
              strokeLinecap="round"
            />
            {/* Segment 2: Missing Information (25% - Cyan) */}
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#06b6d4"
              strokeWidth="4.2"
              strokeDasharray="25, 100"
              strokeDashoffset="-60"
            />
            {/* Segment 3: Escalation (10% - Amber) */}
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="4.2"
              strokeDasharray="10, 100"
              strokeDashoffset="-85"
            />
            {/* Segment 4: Churn Risk (5% - Rose) */}
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#ef4444"
              strokeWidth="4.2"
              strokeDasharray="5, 100"
              strokeDashoffset="-95"
            />
          </svg>

          {/* Center Text */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em' }}>
              86.5%
            </div>
          </div>
        </div>

        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '0.4rem' }}>
          Average AI Triage Confidence
        </span>
      </div>

      {/* Legend Breakdown (matching reference image) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563eb' }} />
            <span style={{ color: 'var(--text-muted)' }}>Ready for 1-Click Dispatch</span>
          </div>
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>60%</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#06b6d4' }} />
            <span style={{ color: 'var(--text-muted)' }}>Clarification Protocol</span>
          </div>
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>25%</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            <span style={{ color: 'var(--text-muted)' }}>Escalation to Tier 2</span>
          </div>
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>10%</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
            <span style={{ color: 'var(--text-muted)' }}>Hostility / Churn Risk</span>
          </div>
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>5%</span>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9' }} />

      {/* Omnichannel Fast Trigger Simulator */}
      <div>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.6rem' }}>
          Inbound Omnichannel Simulator
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <button
            onClick={triggerStripeDispute}
            disabled={isInjecting}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0.65rem',
              borderRadius: '0.45rem',
              backgroundColor: '#faf5ff',
              border: '1px solid #e9d5ff',
              color: '#6b21a8',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: isInjecting ? 'not-allowed' : 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldAlert size={14} />
              <span>Stripe Dispute P1</span>
            </div>
            <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>$4,200 risk</span>
          </button>

          <button
            onClick={triggerTrustpilotChurn}
            disabled={isInjecting}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0.65rem',
              borderRadius: '0.45rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: isInjecting ? 'not-allowed' : 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertTriangle size={14} />
              <span>Trustpilot 1★ Churn</span>
            </div>
            <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>Hostile tone</span>
          </button>

          <button
            onClick={triggerEmailOutage}
            disabled={isInjecting}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0.65rem',
              borderRadius: '0.45rem',
              backgroundColor: '#f0f9ff',
              border: '1px solid #bae6fd',
              color: '#075985',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: isInjecting ? 'not-allowed' : 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Zap size={14} />
              <span>Email P1 Outage</span>
            </div>
            <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>502 Gateway</span>
          </button>
        </div>
      </div>

      {/* GenAI Unit Economics Footer */}
      <div
        style={{
          marginTop: 'auto',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          padding: '0.6rem 0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-main)' }}>
          <span>GenAI Unit Economics</span>
          <span style={{ color: '#10b981' }}>~0.00025 € / ticket</span>
        </div>
        <div>MTTR Reduction: 15 min ➔ &lt;10s with 1-click approval</div>
      </div>
    </div>
  );
};
