import React from 'react';
import {
  CreditCard,
  Star,
  Mail,
  Globe,
  PlusCircle,
  Zap,
} from 'lucide-react';
import { ChannelEnum } from '../types/inquiry';

interface OmnichannelBarProps {
  onInjectScenario: (scenario: {
    channel: ChannelEnum;
    customer_email: string;
    customer_name: string;
    subject: string;
    body: string;
  }) => void;
  onOpenCustomModal: () => void;
  isInjecting: boolean;
}

export const OmnichannelBar: React.FC<OmnichannelBarProps> = ({
  onInjectScenario,
  onOpenCustomModal,
  isInjecting,
}) => {
  const handleStripeScenario = () => {
    onInjectScenario({
      channel: ChannelEnum.BILLING,
      customer_email: 'finance@fintech-enterprise.com',
      customer_name: 'Martin Krause',
      subject: '[DISPUTA STRIPE] Retención de 680.00 EUR en cuenta Pro',
      body: 'El banco emisor ha retenido 680.00 EUR por una disputa bancaria no reconocida en Stripe (charge_id: ch_9928192). Exigimos desbloqueo inmediato o cancelamos las 15 suscripciones de nuestro equipo.',
    });
  };

  const handleTrustpilotScenario = () => {
    onInjectScenario({
      channel: ChannelEnum.TRUSTPILOT,
      customer_email: 'carmen.v@gmail.com',
      customer_name: 'Carmen Vega',
      subject: '[Trustpilot 1★] Caída en pasarela de pagos y cero respuesta del soporte',
      body: 'Llevamos 2 horas con los pagos bloqueados en nuestra tienda online. Hemos perdido más de 2.000€ en ventas esta mañana. Si no nos compensan migraremos a la competencia mañana mismo.',
    });
  };

  const handleEmailScenario = () => {
    onInjectScenario({
      channel: ChannelEnum.EMAIL,
      customer_email: 'devops-lead@saas-scale.org',
      customer_name: 'Guillermo Morales',
      subject: 'URGENTE: 504 Gateway Timeout en API de producción tras deploy',
      body: 'Nuestros microservicios están recibiendo 504 Gateway Timeout constante al conectar con ExampleCorp Gateway API. El clúster k8s está saturado por timeouts en cascada. Por favor necesitamos intervención de ingeniería nivel 3.',
    });
  };

  const handleWebformScenario = () => {
    onInjectScenario({
      channel: ChannelEnum.WEB_FORM,
      customer_email: 'lucia.frontend@startup.io',
      customer_name: 'Lucía Méndez',
      subject: 'Factura duplicada en recibo mensual de marzo',
      body: 'Hola equipo, en el extracto bancario de nuestra tarjeta nos aparecen dos cobros de 49€ correspondientes a la suscripción del plan Team de este mes. ¿Podríais verificar el duplicado y tramitar el reembolso del segundo cargo?',
    });
  };

  return (
    <div
      style={{
        backgroundColor: '#0c101a',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0.45rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
        <Zap size={14} color="#f59e0b" />
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Omnichannel Intake Simulator:
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
        {/* Stripe Trigger */}
        <button
          onClick={handleStripeScenario}
          disabled={isInjecting}
          className="btn"
          style={{
            background: 'rgba(139, 92, 246, 0.12)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            color: '#c4b5fd',
            fontSize: '0.74rem',
            padding: '0.28rem 0.65rem',
          }}
          title="Inject Stripe dispute P1 webhook"
        >
          <CreditCard size={13} />
          <span>Stripe Dispute (P1)</span>
        </button>

        {/* Trustpilot Trigger */}
        <button
          onClick={handleTrustpilotScenario}
          disabled={isInjecting}
          className="btn"
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#6ee7b7',
            fontSize: '0.74rem',
            padding: '0.28rem 0.65rem',
          }}
          title="Inject Trustpilot 1★ public review webhook"
        >
          <Star size={13} />
          <span>Trustpilot 1★ (P2 Churn)</span>
        </button>

        {/* Email Trigger */}
        <button
          onClick={handleEmailScenario}
          disabled={isInjecting}
          className="btn"
          style={{
            background: 'rgba(14, 165, 233, 0.12)',
            border: '1px solid rgba(14, 165, 233, 0.4)',
            color: '#7dd3fc',
            fontSize: '0.74rem',
            padding: '0.28rem 0.65rem',
          }}
          title="Inject Email K8s outage P1 webhook"
        >
          <Mail size={13} />
          <span>Email Outage (P1)</span>
        </button>

        {/* Web Form Trigger */}
        <button
          onClick={handleWebformScenario}
          disabled={isInjecting}
          className="btn"
          style={{
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            color: '#fcd34d',
            fontSize: '0.74rem',
            padding: '0.28rem 0.65rem',
          }}
          title="Inject Webform billing inquiry webhook"
        >
          <Globe size={13} />
          <span>Web Form (P3)</span>
        </button>

        {/* Custom Inquiry Modal Trigger */}
        <button
          onClick={onOpenCustomModal}
          disabled={isInjecting}
          className="btn btn-primary"
          style={{
            fontSize: '0.74rem',
            padding: '0.28rem 0.75rem',
          }}
          title="Submit arbitrary text inquiry in any language"
        >
          <PlusCircle size={13} />
          <span>+ Custom Inquiry</span>
        </button>
      </div>
    </div>
  );
};
