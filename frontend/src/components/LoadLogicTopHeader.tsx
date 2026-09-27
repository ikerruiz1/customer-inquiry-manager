import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Download,
  Lock,
  ChevronDown,
  RotateCcw,
  LogOut,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import type { AgentProfile } from '../types/inquiry';
import { ThemeSelector } from './ThemeSelector';
import type { ThemeId } from '../types/theme';
import { InviteOperatorModal } from './InviteOperatorModal';

interface LoadLogicTopHeaderProps {
  currentAgent: AgentProfile;
  onSelectAgent?: (agent: AgentProfile) => void;
  onLogout?: () => void;
  isLiveBackend: boolean;
  isRefreshing: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onExportAuditLogs: () => void;
  onOpenNewInquiryModal: () => void;
  onResetLayout: () => void;
  isLayoutCustomized: boolean;
  currentThemeId: ThemeId;
  onSelectTheme: (themeId: ThemeId) => void;
  modelName?: string;
}

export const LoadLogicTopHeader: React.FC<LoadLogicTopHeaderProps> = ({
  currentAgent,
  onSelectAgent: _onSelectAgent,
  onLogout,
  isLiveBackend: _isLiveBackend,
  isRefreshing: _isRefreshing,
  searchQuery,
  onSearchChange,
  onExportAuditLogs,
  onOpenNewInquiryModal,
  onResetLayout,
  isLayoutCustomized,
  currentThemeId,
  onSelectTheme,
  modelName: _modelName,
}) => {

  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAgentMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        width: '100%',
        paddingBottom: '4px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <div
                style={{
                  width: '7px',
                  height: '22px',
                  backgroundColor: 'var(--color-black)',
                  borderRadius: '2px',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div
                  style={{
                    width: '12px',
                    height: '10px',
                    backgroundColor: 'var(--color-dot-green)',
                    borderRadius: '2px',
                  }}
                />
                <div
                  style={{
                    width: '12px',
                    height: '10px',
                    backgroundColor: 'var(--color-black)',
                    borderRadius: '2px',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  color: 'var(--color-black)',
                  lineHeight: 1.1,
                }}
              >
                Inquiry Operations
              </span>
              <span style={{ fontSize: '0.67rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Incident & Triage Console
              </span>
            </div>
          </div>

          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <div
              onClick={() => setAgentMenuOpen(!agentMenuOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 12px',
                borderRadius: '9999px',
                border: '1px solid var(--color-border)',
                backgroundColor: '#FFFFFF',
                cursor: 'pointer',
                transition: 'border-color 0.15s ease',
                boxShadow: '0 1px 3px rgba(12, 13, 13, 0.04)',
              }}
              title="Authenticated Operator Profile (RFC 6238 TOTP Verified)"
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: currentAgent.color || '#0C0D0D',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {currentAgent.initials}
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-black)' }}>
                  {currentAgent.name}
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  ({currentAgent.role === 'Operations_Manager' ? 'Operations Manager' : 'Tier 1 Agent'})
                </span>
              </div>

              <Lock size={12} style={{ color: 'var(--color-dot-green)', marginLeft: '2px' }} />
              <ChevronDown size={13} style={{ color: 'var(--color-text-muted)' }} />
            </div>

            {agentMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  width: '280px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--color-border)',
                  borderRadius: '16px',
                  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.12)',
                  padding: '12px',
                  zIndex: 60,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '8px', borderBottom: '1px solid rgba(12, 13, 13, 0.08)' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: currentAgent.color || '#0C0D0D',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {currentAgent.initials}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-black)' }}>
                      {currentAgent.name}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                      {currentAgent.email}
                    </span>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        color: currentAgent.role === 'Operations_Manager' ? '#6D28D9' : '#1D4ED8',
                        backgroundColor: currentAgent.role === 'Operations_Manager' ? '#EDE9FE' : '#DBEAFE',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        marginTop: '4px',
                        width: 'fit-content',
                      }}
                    >
                      {currentAgent.role === 'Operations_Manager'
                        ? 'Operations Manager'
                        : 'Tier 1 Support Agent'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--color-text-muted)', padding: '2px 4px' }}>
                  <UserCheck size={13} style={{ color: 'var(--color-dot-green)' }} />
                  <span>Two-Factor Authentication Active</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', lineHeight: 1.3, padding: '2px 4px' }}>
                    Single active session. To change operator credentials, you must explicitly sign out.
                  </div>

                  {currentAgent.role === 'Operations_Manager' && (
                    <button
                      type="button"
                      onClick={() => {
                        setAgentMenuOpen(false);
                        setShowInviteModal(true);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(12, 13, 13, 0.15)',
                        backgroundColor: '#0C0D0D',
                        color: '#FFFFFF',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'opacity 0.15s ease',
                      }}
                    >
                      <UserPlus size={14} />
                      <span>Invite Support Operator</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setAgentMenuOpen(false);
                      if (onLogout) onLogout();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#FEE2E2',
                      color: '#991B1B',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {currentAgent.role === 'Operations_Manager' && (
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '9999px',
                border: '1px solid #7C3AED',
                backgroundColor: '#EDE9FE',
                color: '#6D28D9',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Supervisor Action: Provision new support operator with temporary credentials"
            >
              <UserPlus size={13} />
              <span>+ Invite Agent</span>
            </button>
          )}
        </div>


      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          flexWrap: 'wrap',
          width: '100%',
        }}
      >
        <div
          style={{
            position: 'relative',
            flex: 1,
            minWidth: '280px',
          }}
        >
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#888888',
            }}
          />
          <input
            type="text"
            placeholder="Search inquiries by customer, subject, order ID (ORD-), error code, or department..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              borderRadius: '9999px',
              backgroundColor: '#FAFAFA',
              border: '1px solid rgba(12, 13, 13, 0.1)',
              color: '#0C0D0D',
              fontSize: '0.84rem',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              transition: 'border-color 0.15s ease',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {isLayoutCustomized && (
            <button
              onClick={onResetLayout}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '8px 14px',
                borderRadius: '9999px',
                backgroundColor: '#FFFFFF',
                border: '1px solid rgba(12, 13, 13, 0.16)',
                color: '#4B5563',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Reset widget layout order back to standard default"
            >
              <RotateCcw size={12} />
              <span>Reset Layout</span>
            </button>
          )}

          <ThemeSelector
            currentThemeId={currentThemeId}
            onSelectTheme={onSelectTheme}
          />

          <button
            onClick={onExportAuditLogs}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '9999px',
              backgroundColor: '#FFFFFF',
              border: '1px solid rgba(12, 13, 13, 0.12)',
              color: '#0C0D0D',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            title="Download full operational audit ledger as JSON"
          >
            <Download size={14} />
            <span>Export</span>
          </button>

          <button
            onClick={onOpenNewInquiryModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '9999px',
              backgroundColor: '#0C0D0D',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'opacity 0.15s ease, transform 0.1s ease',
              boxShadow: '0 4px 12px rgba(12, 13, 13, 0.15)',
            }}
            title="Open modal to create or test customer inquiry"
          >
            <Plus size={15} />
            <span>+ Add New Inquiry</span>
          </button>
        </div>
      </div>

      <InviteOperatorModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />
    </header>
  );
};
