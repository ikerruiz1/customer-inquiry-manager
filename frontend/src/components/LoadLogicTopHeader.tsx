import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Download,
  RefreshCw,
  Lock,
  ChevronDown,
  Server,
  Check,
  RotateCcw,
} from 'lucide-react';
import type { AgentProfile } from '../types/inquiry';
import { INITIAL_AGENTS } from '../api/mockData';
import { ThemeSelector } from './ThemeSelector';
import type { ThemeId } from '../types/theme';

interface LoadLogicTopHeaderProps {
  currentAgent: AgentProfile;
  onSelectAgent: (agent: AgentProfile) => void;
  isLiveBackend: boolean;
  isDemoMode: boolean;
  onToggleDemoMode: () => void;
  isRefreshing: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onExportAuditLogs: () => void;
  onOpenNewInquiryModal: () => void;
  onResetLayout: () => void;
  isLayoutCustomized: boolean;
  currentThemeId: ThemeId;
  onSelectTheme: (themeId: ThemeId) => void;
}

export const LoadLogicTopHeader: React.FC<LoadLogicTopHeaderProps> = ({
  currentAgent,
  onSelectAgent,
  isLiveBackend,
  isDemoMode,
  onToggleDemoMode,
  isRefreshing,
  searchQuery,
  onSearchChange,
  onExportAuditLogs,
  onOpenNewInquiryModal,
  onResetLayout,
  isLayoutCustomized,
  currentThemeId,
  onSelectTheme,
}) => {
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
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
      {/* Upper Row: Brand Logo + Operator Switcher + Telemetry Badges + Global Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        {/* Brand Logo & Title */}
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
                    width: '13px',
                    height: '8px',
                    backgroundColor: 'var(--color-black)',
                    borderRadius: '2px',
                  }}
                />
                <div
                  style={{
                    width: '13px',
                    height: '12px',
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
                ExampleCorp
              </span>
              <span style={{ fontSize: '0.67rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                AI Triage Operations
              </span>
            </div>
          </div>

          {/* Operator Profile Card with Cognito TOTP MFA Switcher */}
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
              title="Switch Active Operator (Cognito RFC 6238 TOTP MFA Enforced)"
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
                  ({currentAgent.role === 'Operations_Manager' ? 'Supervisor' : 'Tier 1 Agent'})
                </span>
              </div>

              <Lock size={12} style={{ color: 'var(--color-dot-green)', marginLeft: '2px' }} />
              <ChevronDown size={13} style={{ color: 'var(--color-text-muted)' }} />
            </div>

            {/* Operator Switcher Dropdown */}
            {agentMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  width: '240px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--color-border)',
                  borderRadius: '16px',
                  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.12)',
                  padding: '6px',
                  zIndex: 60,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                <div style={{ padding: '6px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-faint)', textTransform: 'uppercase' }}>
                  Select Operator Context
                </div>
                {INITIAL_AGENTS.map((agent) => (
                  <div
                    key={agent.id}
                    onClick={() => {
                      onSelectAgent(agent);
                      setAgentMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: '10px',
                      backgroundColor: currentAgent.id === agent.id ? 'var(--color-sage)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.12s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          backgroundColor: agent.color,
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                        }}
                      >
                        {agent.initials}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-black)' }}>
                          {agent.name}
                        </span>
                        <span style={{ fontSize: '0.67rem', color: 'var(--color-text-muted)' }}>
                          {agent.role === 'Operations_Manager' ? 'Operations Manager' : 'Tier 1 Agent'}
                        </span>
                      </div>
                    </div>
                    {currentAgent.id === agent.id && <Check size={14} color="var(--color-black)" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center/Right: Compliance & FinOps Telemetry Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* 1. AWS PrivateLink Zero-Internet Egress Pill */}
          <div
            onClick={onToggleDemoMode}
            title="Zero-internet egress verified: All communications traverse AWS PrivateLink VPC Endpoints. Click to toggle Demo Sandbox."
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '9999px',
              backgroundColor: '#ECF4EE',
              border: '1px solid rgba(12, 13, 13, 0.06)',
              fontSize: '0.74rem',
              fontWeight: 700,
              color: '#0C0D0D',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <Server size={12} style={{ color: isLiveBackend ? '#047857' : '#B45309' }} />
            <span className="status-dot status-dot-green" />
            <span>{isLiveBackend ? 'AWS PrivateLink' : isDemoMode ? 'Demo Sandbox' : 'Local Engine'}</span>
            {isRefreshing && <RefreshCw size={11} className="animate-spin" style={{ marginLeft: '4px', opacity: 0.6 }} />}
          </div>

          {/* 2. Bedrock GenAI Telemetry Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '9999px',
              backgroundColor: '#ECF4EE',
              border: '1px solid rgba(12, 13, 13, 0.06)',
              fontSize: '0.74rem',
            }}
            title="AWS Bedrock Converse API: Claude Haiku 4.5 autonomous triage engine."
          >
            <span className="status-dot status-dot-green" />
            <strong style={{ color: '#0C0D0D', fontWeight: 800 }}>Bedrock GenAI</strong>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>Claude Haiku 4.5</span>
          </div>
        </div>
      </div>

      {/* Lower Row: Full-Width Search Omnibar + Action Controls */}
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
        {/* Full-Width Search Input */}
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

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Reset Custom Widget Layout Button */}
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

          {/* Ambient Background Theme Selector */}
          <ThemeSelector
            currentThemeId={currentThemeId}
            onSelectTheme={onSelectTheme}
          />

          {/* Export Audit Logs Button */}
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

          {/* "+ Add New Inquiry" Black Action Button */}
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
    </header>
  );
};
