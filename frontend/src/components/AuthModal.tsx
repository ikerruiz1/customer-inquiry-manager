import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  KeyRound,
  Mail,
  Lock,
  ShieldAlert,
  Check,
  Copy,
  ArrowRight,
  ArrowLeft,
  Smartphone,
} from 'lucide-react';
import {
  loginOperator,
  verifyMfaCode,
} from '../api/client';
import type { MFAChallenge, AuthUser } from '../types/inquiry';

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: (user: AuthUser) => void;
  onClose?: () => void;
  canClose?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onSuccess,
  onClose,
  canClose = false,
}) => {
  if (!isOpen) return null;

  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');

  // Form Fields
  const [email, setEmail] = useState('carlos.m@company.internal');
  const [password, setPassword] = useState('Agent123!');

  // MFA Challenge State
  const [mfaChallenge, setMfaChallenge] = useState<MFAChallenge | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Status & Error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw QR code onto HTML5 canvas whenever MFA challenge provides otpauth_url
  useEffect(() => {
    if (step === 'mfa' && mfaChallenge?.otpauth_url && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        mfaChallenge.otpauth_url,
        {
          width: 180,
          margin: 1,
          color: {
            dark: '#0C0D0D',
            light: '#FFFFFF',
          },
        },
        (err) => {
          if (err) console.error('Error generating TOTP QR Code canvas:', err);
        }
      );
    }
  }, [step, mfaChallenge]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await loginOperator(email.trim().toLowerCase(), password);
      if ('challenge_name' in response && response.challenge_name === 'SOFTWARE_TOKEN_MFA') {
        setMfaChallenge(response as MFAChallenge);
        setStep('mfa');
        setTotpCode('');
      } else if ('user' in response && response.user) {
        onSuccess(response.user);
      } else {
        setError('Unexpected authentication response');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge || totpCode.trim().length !== 6) {
      setError('Please enter a valid 6-digit verification code');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const response = await verifyMfaCode(mfaChallenge.session, totpCode.trim());
      if (response.user) {
        onSuccess(response.user);
      } else {
        onSuccess({
          id: 'user-authenticated',
          name: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          email: email.trim().toLowerCase(),
          role: email.includes('manager') || email.includes('alex') ? 'Operations_Manager' : 'Tier1_Agent',
          initials: email.slice(0, 2).toUpperCase(),
          color: email.includes('alex') ? '#8b5cf6' : '#3b82f6',
        });
      }
    } catch (err: any) {
      setError(err.message || 'The verification code provided is invalid or expired');
    } finally {
      setLoading(false);
    }
  };

  const copySecretToClipboard = () => {
    if (!mfaChallenge?.totp_secret) return;
    navigator.clipboard.writeText(mfaChallenge.totp_secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleQuickPrefill = (prefillEmail: string, prefillPass: string) => {
    setEmail(prefillEmail);
    setPassword(prefillPass);
    setError(null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#0B0F17',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={canClose ? onClose : undefined}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(12, 13, 13, 0.12)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '26px 28px 18px 28px',
            borderBottom: '1px solid rgba(12, 13, 13, 0.08)',
            backgroundColor: '#FAFAFA',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  backgroundColor: '#0C0D0D',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <KeyRound size={17} />
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  color: '#0C0D0D',
                  letterSpacing: '-0.02em',
                }}
              >
                {step === 'credentials' ? 'Support Portal Login' : 'Two-Factor Verification'}
              </h2>
            </div>
            {canClose && onClose && (
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '0.86rem',
                  color: '#666666',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            )}
          </div>
          <p
            style={{
              margin: '8px 0 0 0',
              fontSize: '0.82rem',
              color: '#666666',
              lineHeight: 1.45,
            }}
          >
            {step === 'credentials'
              ? 'Enter your assigned enterprise credentials to access the ticket management and triage queue.'
              : 'Open Google Authenticator or Microsoft Authenticator on your mobile device to scan the code and enter your 6-digit verification code.'}
          </p>
        </div>

        {/* Modal Body */}
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

          {step === 'credentials' ? (
            <form onSubmit={handleCredentialsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#0C0D0D',
                    marginBottom: '6px',
                  }}
                >
                  Enterprise Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={15}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#888888',
                    }}
                  />
                  <input
                    type="email"
                    required
                    placeholder="user@company.internal"
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
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#0C0D0D',
                    marginBottom: '6px',
                  }}
                >
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={15}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#888888',
                    }}
                  />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

              {/* Pre-provisioned Operator Quick Login Helpers (Strictly in Local Development) */}
              {import.meta.env.DEV && (
                <div style={{ marginTop: '4px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#888888', display: 'block', marginBottom: '6px' }}>
                    Pre-provisioned Enterprise Accounts:
                  </span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleQuickPrefill('carlos.m@company.internal', 'Agent123!')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        border: '1px solid rgba(12, 13, 13, 0.15)',
                        backgroundColor: email === 'carlos.m@company.internal' ? '#0C0D0D' : '#F9F9F9',
                        color: email === 'carlos.m@company.internal' ? '#FFFFFF' : '#0C0D0D',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Carlos M. (Tier 1 Support Agent)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPrefill('alex.rivera@company.internal', 'Manager123!')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        border: '1px solid rgba(12, 13, 13, 0.15)',
                        backgroundColor: email === 'alex.rivera@company.internal' ? '#0C0D0D' : '#F9F9F9',
                        color: email === 'alex.rivera@company.internal' ? '#FFFFFF' : '#0C0D0D',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Alex Rivera (Operations Manager)
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: '10px',
                  padding: '11px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#0C0D0D',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'opacity 0.15s ease',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                <span>{loading ? 'Authenticating...' : 'Continue to Verification'}</span>
                <ArrowRight size={15} />
              </button>
            </form>
          ) : (
            /* MFA Step */
            <form onSubmit={handleMfaSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '14px',
                  backgroundColor: '#FAFAFA',
                  borderRadius: '14px',
                  border: '1px solid rgba(12, 13, 13, 0.08)',
                }}
              >
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    padding: '8px',
                    borderRadius: '12px',
                    border: '1px solid rgba(12, 13, 13, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <canvas ref={canvasRef} style={{ width: '170px', height: '170px', display: 'block' }} />
                </div>

                <span style={{ fontSize: '0.74rem', color: '#666666', marginTop: '10px', textAlign: 'center' }}>
                  Scan this code using <strong>Google Authenticator</strong> or <strong>Microsoft Authenticator</strong>
                </span>

                {mfaChallenge?.totp_secret && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '10px',
                      padding: '6px 12px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px dashed rgba(12, 13, 13, 0.2)',
                    }}
                  >
                    <span style={{ fontSize: '0.72rem', color: '#666666' }}>Manual key:</span>
                    <code style={{ fontSize: '0.76rem', fontWeight: 700, letterSpacing: '1px', color: '#0C0D0D' }}>
                      {mfaChallenge.totp_secret}
                    </code>
                    <button
                      type="button"
                      onClick={copySecretToClipboard}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '2px',
                        cursor: 'pointer',
                        color: copiedSecret ? '#16A34A' : '#666666',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Copy manual secret key"
                    >
                      {copiedSecret ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#0C0D0D',
                    marginBottom: '6px',
                  }}
                >
                  6-Digit Verification Code
                </label>
                <div style={{ position: 'relative' }}>
                  <Smartphone
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#888888',
                    }}
                  />
                  <input
                    type="text"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    autoFocus
                    placeholder="123456"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 38px',
                      borderRadius: '12px',
                      border: '1.5px solid #0C0D0D',
                      fontSize: '1.15rem',
                      fontWeight: 700,
                      letterSpacing: '5px',
                      boxSizing: 'border-box',
                      outline: 'none',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
                {import.meta.env.DEV && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#666666' }}>
                      Local development test code: 123456
                    </span>
                    <button
                      type="button"
                      onClick={() => setTotpCode('123456')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563EB',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Fill 123456
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setError(null);
                  }}
                  style={{
                    padding: '11px 16px',
                    borderRadius: '12px',
                    border: '1px solid rgba(12, 13, 13, 0.18)',
                    backgroundColor: '#FFFFFF',
                    color: '#0C0D0D',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>

                <button
                  type="submit"
                  disabled={loading || totpCode.trim().length !== 6}
                  style={{
                    flex: 1,
                    padding: '11px 16px',
                    borderRadius: '12px',
                    backgroundColor: '#0C0D0D',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    cursor: loading || totpCode.trim().length !== 6 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: loading || totpCode.trim().length !== 6 ? 0.6 : 1,
                  }}
                >
                  <span>{loading ? 'Verifying...' : 'Sign In & Access Queue'}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
