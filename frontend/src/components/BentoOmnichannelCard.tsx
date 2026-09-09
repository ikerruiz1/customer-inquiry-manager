import React from 'react';
import { ArrowUpRight, Zap, CreditCard, Star, Mail } from 'lucide-react';
import { ChannelEnum } from '../types/inquiry';

interface BentoOmnichannelCardProps {
  onInjectScenario: (payload: {
    channel: ChannelEnum;
    customer_email: string;
    customer_name: string;
    subject: string;
    body: string;
  }) => void;
  isInjecting: boolean;
}

export const BentoOmnichannelCard: React.FC<BentoOmnichannelCardProps> = ({
  onInjectScenario,
  isInjecting,
}) => {
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

  const channels = [
    { name: 'Stripe Webhooks', count: '43,987', color: 'var(--pastel-yellow-dark)', icon: <CreditCard size={12} /> },
    { name: 'Trustpilot Reviews', count: '32,648', color: 'var(--pastel-coral)', icon: <Star size={12} /> },
    { name: 'AWS SES Email', count: '26,563', color: 'var(--pastel-lilac)', icon: <Mail size={12} /> },
    { name: 'REST API / Web Form', count: '21,514', color: 'var(--pastel-mint)', icon: <Zap size={12} /> },
  ];

  return (
    <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      {/* Card Header: Title + Big Impression Count (Fitonist Impressions 231,841 style) */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
        <div>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Omnichannel Ingress
          </span>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Worldwide Gateway Endpoints</div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em' }}>
              231,841
            </span>
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <ArrowUpRight size={12} />
            </div>
          </div>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)' }}>Inquiries ingested to date</span>
        </div>
      </div>

      {/* Center: Dotted Global Network Map + Breakdown Table */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '1rem', alignItems: 'center' }}>
        {/* Dotted Global Grid (SVG representation of Fitonist dotted world map) */}
        <div
          style={{
            height: '115px',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle Dotted Pattern SVG */}
          <svg width="100%" height="100%" viewBox="0 0 240 110" style={{ opacity: 0.85 }}>
            <pattern id="dotGrid" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="0.8" fill="rgba(255, 255, 255, 0.2)" />
            </pattern>
            <rect width="240" height="110" fill="url(#dotGrid)" />

            {/* Glowing European & US Clusters (AWS eu-west-1 & us-east-1) */}
            <circle cx="85" cy="40" r="16" fill="var(--pastel-lilac)" opacity="0.15" />
            <circle cx="85" cy="40" r="3.5" fill="var(--pastel-lilac)" />
            
            <circle cx="125" cy="35" r="18" fill="var(--pastel-mint)" opacity="0.15" />
            <circle cx="125" cy="35" r="3.5" fill="var(--pastel-mint)" />

            <circle cx="180" cy="65" r="12" fill="var(--pastel-yellow)" opacity="0.12" />
            <circle cx="180" cy="65" r="3" fill="var(--pastel-yellow)" />

            <path d="M 85,40 Q 105,25 125,35 T 180,65" fill="none" stroke="rgba(255, 255, 255, 0.2)" strokeDasharray="3 3" />
          </svg>

          <span style={{ position: 'absolute', bottom: '6px', left: '8px', fontSize: '0.62rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
            eu-west-1 PrivateLink
          </span>
        </div>

        {/* Channel Table (Fitonist country list USA / Australia style) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {channels.map((ch, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.22rem 0.45rem',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ color: ch.color }}>{ch.icon}</span>
                <span style={{ fontSize: '0.7rem', color: '#e2e8f0' }}>{ch.name}</span>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                {ch.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Fast Simulation Buttons */}
      <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)', fontWeight: 600, flexShrink: 0 }}>
          Inject Demo:
        </span>
        <button
          onClick={triggerStripeDispute}
          disabled={isInjecting}
          style={{
            fontSize: '0.68rem',
            padding: '0.2rem 0.5rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(254, 240, 138, 0.12)',
            color: 'var(--pastel-yellow-dark)',
            border: '1px solid rgba(254, 240, 138, 0.25)',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Stripe 1,200€
        </button>
        <button
          onClick={triggerTrustpilotChurn}
          disabled={isInjecting}
          style={{
            fontSize: '0.68rem',
            padding: '0.2rem 0.5rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(248, 113, 113, 0.12)',
            color: 'var(--pastel-coral)',
            border: '1px solid rgba(248, 113, 113, 0.25)',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Trustpilot 1★
        </button>
        <button
          onClick={triggerEmailOutage}
          disabled={isInjecting}
          style={{
            fontSize: '0.68rem',
            padding: '0.2rem 0.5rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(184, 165, 254, 0.12)',
            color: 'var(--pastel-lilac)',
            border: '1px solid rgba(184, 165, 254, 0.25)',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          SES 502 Outage
        </button>
      </div>
    </div>
  );
};
