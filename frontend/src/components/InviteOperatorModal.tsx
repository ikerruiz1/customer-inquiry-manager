import React, { useState } from 'react';
import {
  UserPlus,
  Mail,
  User,
  Shield,
  Check,
  Copy,
  ArrowRight,
  ShieldAlert,
  X,
} from 'lucide-react';
import { inviteOperator } from '../api/client';
import type { InviteOperatorResponse } from '../types/inquiry';

interface InviteOperatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InviteOperatorModal: React.FC<InviteOperatorModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Tier1_Agent' | 'Operations_Manager'>('Tier1_Agent');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteOperatorResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await inviteOperator({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to provision operator.');
    } finally {
      setLoading(false);
    }
  };

  const copyPassword = () => {
    if (!result?.temporary_password) return;
    navigator.clipboard.writeText(result.temporary_password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetAndClose = () => {
    setName('');
    setEmail('');
    setRole('Tier1_Agent');
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(11, 15, 23, 0.7)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(4px)',
      }}
      onClick={handleResetAndClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(12, 13, 13, 0.12)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 28px 18px 28px',
            borderBottom: '1px solid rgba(12, 13, 13, 0.08)',
            backgroundColor: '#FAFAFA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#0C0D0D',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserPlus size={18} />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  color: '#0C0D0D',
                  letterSpacing: '-0.02em',
                }}
              >
                Invite Support Operator
              </h2>
              <span style={{ fontSize: '0.75rem', color: '#666666' }}>
                Supervisor Provisioning Control Plane
              </span>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#666666',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px' }}>
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#FEE2E2',
                border: '1px solid #FCA5A5',
                color: '#991B1B',
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '0.8rem',
                marginBottom: '18px',
              }}
            >
              <ShieldAlert size={16} color="#B91C1C" />
              <span>{error}</span>
            </div>
          )}

          {result ? (
            /* Success State */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '14px',
                  padding: '18px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: '#16A34A',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px auto',
                  }}
                >
                  <Check size={22} />
                </div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 800, color: '#166534' }}>
                  Operator Provisioned Successfully
                </h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#15803D', lineHeight: 1.4 }}>
                  Account created in AWS Cognito User Pool with <strong>FORCE_CHANGE_PASSWORD</strong> status.
                </p>
              </div>

              {/* Temporary Credentials Card */}
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: '12px',
                  border: '1px solid rgba(12, 13, 13, 0.1)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: '#64748B' }}>Operator Email:</span>
                  <strong style={{ color: '#0C0D0D' }}>{result.operator.email}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: '#64748B' }}>Assigned RBAC Role:</span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      backgroundColor: result.operator.role === 'Operations_Manager' ? '#EDE9FE' : '#DBEAFE',
                      color: result.operator.role === 'Operations_Manager' ? '#6D28D9' : '#1D4ED8',
                    }}
                  >
                    {result.operator.role === 'Operations_Manager' ? 'Operations Manager' : 'Tier 1 Support Agent'}
                  </span>
                </div>

                <div style={{ marginTop: '6px' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0C0D0D', display: 'block', marginBottom: '4px' }}>
                    Generated One-Time Temporary Password:
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#FFFFFF',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1.5px dashed #0C0D0D',
                    }}
                  >
                    <code style={{ fontSize: '0.92rem', fontWeight: 800, letterSpacing: '1px', color: '#0C0D0D' }}>
                      {result.temporary_password}
                    </code>
                    <button
                      type="button"
                      onClick={copyPassword}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        backgroundColor: copied ? '#DCFCE7' : '#F1F5F9',
                        color: copied ? '#16A34A' : '#0F172A',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <span style={{ fontSize: '0.70rem', color: '#64748B', lineHeight: 1.35, marginTop: '4px' }}>
                  Security Notice: Provide these credentials to the new agent. On their initial sign-in, AWS Cognito will mandate establishing a permanent password and enrolling an RFC 6238 Software Token TOTP device.
                </span>
              </div>

              <button
                type="button"
                onClick={handleResetAndClose}
                style={{
                  marginTop: '8px',
                  padding: '11px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#0C0D0D',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          ) : (
            /* Invite Form */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0C0D0D', marginBottom: '6px' }}>
                  Operator Full Name
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888888' }} />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Elena Ramos"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 36px',
                      borderRadius: '10px',
                      border: '1px solid rgba(12, 13, 13, 0.18)',
                      fontSize: '0.86rem',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0C0D0D' }}>
                    Corporate Identity Email
                  </label>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#2563EB', backgroundColor: '#EFF6FF', padding: '1px 6px', borderRadius: '4px' }}>
                    Corporate Domain Enforced
                  </span>
                </div>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888888' }} />
                  <input
                    type="email"
                    required
                    placeholder="e.g. elena.r@<company-domain>"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 36px',
                      borderRadius: '10px',
                      border: '1px solid rgba(12, 13, 13, 0.18)',
                      fontSize: '0.86rem',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '4px', display: 'block' }}>
                  Zero-Trust Policy: All operator identities must be registered under the corporate organization domain. External public domains (@gmail, @yahoo) are strictly prohibited.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0C0D0D', marginBottom: '6px' }}>
                  Assigned RBAC Role
                </label>
                <div style={{ position: 'relative' }}>
                  <Shield size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888888' }} />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 36px',
                      borderRadius: '10px',
                      border: '1px solid rgba(12, 13, 13, 0.18)',
                      fontSize: '0.86rem',
                      backgroundColor: '#FFFFFF',
                      boxSizing: 'border-box',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="Tier1_Agent">Tier 1 Support Agent (Queue Triage & Response)</option>
                    <option value="Operations_Manager">Operations Manager (Team Management & Overrides)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !name.trim() || !email.trim()}
                style={{
                  marginTop: '10px',
                  padding: '11px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#0C0D0D',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  cursor: loading || !name.trim() || !email.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: loading || !name.trim() || !email.trim() ? 0.6 : 1,
                }}
              >
                <span>{loading ? 'Provisioning in AWS Cognito...' : 'Send Invitation & Generate Credentials'}</span>
                <ArrowRight size={15} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
