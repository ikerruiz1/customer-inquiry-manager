import { Send, Sparkles, X } from 'lucide-react';
import React, { useState } from 'react';
import { ChannelEnum } from '../types/inquiry';

interface NewInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    channel: ChannelEnum;
    customer_email: string;
    customer_name: string;
    subject: string;
    body: string;
  }) => void;
  isSubmitting: boolean;
}

export const NewInquiryModal: React.FC<NewInquiryModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  if (!isOpen) return null;

  const [channel, setChannel] = useState<ChannelEnum>(ChannelEnum.WEB_FORM);
  const [name, setName] = useState<string>('Alex Turner');
  const [email, setEmail] = useState<string>('alex.turner@enterprise-client.io');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      setError('Please provide both subject and inquiry body text.');
      return;
    }
    setError(null);
    onSubmit({
      channel,
      customer_email: email.trim(),
      customer_name: name.trim(),
      subject: subject.trim(),
      body: body.trim(),
    });
    onClose();
  };

  const loadPreset = (presetType: 'billing' | 'p1' | 'review' | 'custom') => {
    if (presetType === 'billing') {
      setChannel(ChannelEnum.BILLING);
      setName('Sarah Jenkins');
      setEmail('s.jenkins@enterprisecorp.com');
      setSubject('Duplicate subscription renewal charge on invoice INV-9041');
      setBody('We were charged twice ($1,450.00) for our annual team license on Stripe today. Please cancel the redundant transaction and refund our company card immediately.');
    } else if (presetType === 'p1') {
      setChannel(ChannelEnum.EMAIL);
      setName('Alex Rivera');
      setEmail('arivera@fintech-bank.es');
      setSubject('EMERGENCY: Production database connection pool exhaustion in eu-west-1');
      setBody('Critical outage on API gateway. Microservices are throwing 504 Gateway Timeouts. Our SLA clock is ticking and customer checkouts are failing.');
    } else if (presetType === 'review') {
      setChannel(ChannelEnum.TRUSTPILOT);
      setName('David Miller');
      setEmail('dmiller99@gmail.com');
      setSubject('1-Star Review: Frustrated with unresolved ticket for 3 weeks');
      setBody('Horrible support experience. Nobody answers my inquiries regarding order #88412. I am canceling my account and requesting a full chargeback.');
    } else {
      setChannel(ChannelEnum.EMAIL);
      setName('');
      setEmail('');
      setSubject('Urgent assistance requested for our account setup');
      setBody('Hello, our engineering team needs help resolving an issue with our subscription configuration.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(12, 13, 13, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-sage)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-black)',
              }}
            >
              <Sparkles size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-black)', margin: 0, letterSpacing: '-0.02em' }}>
                New Customer Inquiry
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                Submit customer inquiry for automated classification and triage
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '50%',
              border: '1px solid rgba(12, 13, 13, 0.1)',
              backgroundColor: '#FAFAFA',
              color: 'var(--color-black)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Quick Scenario Fill Buttons */}
        <div
          style={{
            padding: '12px 24px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Quick Presets:
          </span>
          <button
            type="button"
            onClick={() => loadPreset('billing')}
            style={{
              padding: '3px 10px',
              borderRadius: '9999px',
              border: '1px solid rgba(12, 13, 13, 0.12)',
              backgroundColor: '#FAFAFA',
              color: '#0C0D0D',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Billing Dispute ($1,450)
          </button>
          <button
            type="button"
            onClick={() => loadPreset('p1')}
            style={{
              padding: '3px 10px',
              borderRadius: '9999px',
              border: '1px solid rgba(12, 13, 13, 0.12)',
              backgroundColor: '#FAFAFA',
              color: '#0C0D0D',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            P1 Outage (Tech Support)
          </button>
          <button
            type="button"
            onClick={() => loadPreset('review')}
            style={{
              padding: '3px 10px',
              borderRadius: '9999px',
              border: '1px solid rgba(12, 13, 13, 0.12)',
              backgroundColor: '#FAFAFA',
              color: '#0C0D0D',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Trustpilot 1-Star (Churn)
          </button>
          <button
            type="button"
            onClick={() => loadPreset('custom')}
            style={{
              padding: '3px 10px',
              borderRadius: '9999px',
              border: '1px solid #10B981',
              backgroundColor: '#ECFDF5',
              color: '#047857',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
            title="Pre-fill empty fields to test with your own personal email address"
          >
            ✍ Custom (Your Email)
          </button>
        </div>

        {/* Company Inbound Destination Banner */}
        <div
          style={{
            margin: '8px 24px 0',
            padding: '7px 12px',
            borderRadius: '8px',
            backgroundColor: '#F8FAFC',
            border: '1px solid rgba(12, 13, 13, 0.08)',
            fontSize: '0.72rem',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            Inbound Support Inbox:{' '}
            <strong style={{ color: '#0F172A' }}>
              {typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
                ? `support@${window.location.hostname.replace(/^(portal\.|app\.|www\.)/, '')}`
                : 'support@company.internal'}
            </strong>
          </span>
          <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
            Any external sender establishes connection
          </span>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {error && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#dc2626',
                fontSize: '0.76rem',
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          {/* Name & Email Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Customer Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  backgroundColor: '#FAFAFA',
                  border: '1px solid rgba(12, 13, 13, 0.12)',
                  color: '#0C0D0D',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Customer Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  backgroundColor: '#FAFAFA',
                  border: '1px solid rgba(12, 13, 13, 0.12)',
                  color: '#0C0D0D',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Channel Select */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Inbound Channel
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as ChannelEnum)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '10px',
                backgroundColor: '#FAFAFA',
                border: '1px solid rgba(12, 13, 13, 0.12)',
                color: '#0C0D0D',
                fontSize: '0.82rem',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
              }}
            >
              <option value={ChannelEnum.WEB_FORM}>Web Form</option>
              <option value={ChannelEnum.EMAIL}>Email (AWS SES)</option>
              <option value={ChannelEnum.BILLING}>Stripe Billing</option>
              <option value={ChannelEnum.TRUSTPILOT}>Trustpilot Review</option>
              <option value={ChannelEnum.GOOGLE_REVIEWS}>Google Reviews</option>
            </select>
          </div>

          {/* Subject */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Subject Line
            </label>
            <input
              type="text"
              placeholder="e.g. Production database connection timeout in eu-west-1..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '10px',
                backgroundColor: '#FAFAFA',
                border: '1px solid rgba(12, 13, 13, 0.12)',
                color: '#0C0D0D',
                fontSize: '0.82rem',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
              }}
            />
          </div>

          {/* Inquiry Content */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Inquiry Body Text (Any language / format)
            </label>
            <textarea
              rows={4}
              placeholder="Enter customer inquiry message or ticket description..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                backgroundColor: '#FAFAFA',
                border: '1px solid rgba(12, 13, 13, 0.12)',
                color: '#0C0D0D',
                fontSize: '0.82rem',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Footer Actions */}
          <div
            style={{
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '9999px',
                border: '1px solid rgba(12, 13, 13, 0.15)',
                backgroundColor: '#FFFFFF',
                color: '#0C0D0D',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 20px',
                borderRadius: '9999px',
                backgroundColor: '#0C0D0D',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(12, 13, 13, 0.15)',
              }}
            >
              <Send size={13} />
              <span>{isSubmitting ? 'Ingesting...' : 'Ingest & Trigger AI Triage'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
