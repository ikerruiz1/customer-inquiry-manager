import React, { useState } from 'react';
import { X, Send, Sparkles } from 'lucide-react';
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
  const [name, setName] = useState<string>('Carlos Mendoza');
  const [email, setEmail] = useState<string>('carlos.mendoza@empresa.com');
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={18} color="#60a5fa" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#93c5fd' }}>
              Inject Custom Customer Inquiry (Live AI Triage)
            </span>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '0.3rem', borderRadius: '50%' }}
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.25rem' }}>
                CUSTOMER NAME:
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '6px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-prominent)',
                  color: 'var(--text-main)',
                  fontSize: '0.82rem',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.25rem' }}>
                CUSTOMER EMAIL:
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '6px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-prominent)',
                  color: 'var(--text-main)',
                  fontSize: '0.82rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.25rem' }}>
              INBOUND CHANNEL:
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as ChannelEnum)}
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: '6px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-prominent)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                outline: 'none',
              }}
            >
              <option value={ChannelEnum.WEB_FORM}>Web Form</option>
              <option value={ChannelEnum.EMAIL}>Email (SES)</option>
              <option value={ChannelEnum.BILLING}>Stripe Billing</option>
              <option value={ChannelEnum.TRUSTPILOT}>Trustpilot Review</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.25rem' }}>
              SUBJECT:
            </label>
            <input
              type="text"
              placeholder="e.g. Caída de base de datos en clúster k8s producción..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: '6px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-prominent)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.25rem' }}>
              INQUIRY CONTENT (Write any text in any language):
            </label>
            <textarea
              placeholder="Escribe aquí cualquier mensaje arbitrario (en español, inglés, con errores de ortografía o quejas extremas) para probar la inferencia de Amazon Bedrock..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              required
              style={{
                width: '100%',
                padding: '0.55rem 0.65rem',
                borderRadius: '6px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-prominent)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {error && (
            <span style={{ fontSize: '0.75rem', color: '#f87171' }}>{error}</span>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !subject.trim() || !body.trim()}
              className="btn btn-primary"
              style={{ fontSize: '0.8rem' }}
            >
              <Send size={13} />
              <span>Ingest & Trigger AI Triage</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
