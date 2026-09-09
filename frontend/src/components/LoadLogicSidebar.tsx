import React, { useState } from 'react';
import {
  Activity,
  Lock,
  ChevronDown,
  Server,
  Check,
} from 'lucide-react';
import type { AgentProfile } from '../types/inquiry';
import { INITIAL_AGENTS } from '../api/mockData';

interface LoadLogicSidebarProps {
  currentAgent: AgentProfile;
  onSelectAgent: (agent: AgentProfile) => void;
  isLiveBackend: boolean;
  isDemoMode: boolean;
  onToggleDemoMode: () => void;
}

export const LoadLogicSidebar: React.FC<LoadLogicSidebarProps> = ({
  currentAgent,
  onSelectAgent,
  isLiveBackend,
  isDemoMode,
  onToggleDemoMode,
}) => {
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);

  return (
    <aside className="loadlogic-sidebar">
      {/* Top: Brand Logo + Operator Card + Navigation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* 1. Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', paddingLeft: '0.2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <div
              style={{
                width: '7px',
                height: '20px',
                backgroundColor: 'var(--color-black)',
                borderRadius: '2px',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div
                style={{
                  width: '12px',
                  height: '7px',
                  backgroundColor: 'var(--color-black)',
                  borderRadius: '2px',
                }}
              />
              <div
                style={{
                  width: '12px',
                  height: '11px',
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
            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              AI Triage Operations
            </span>
          </div>
        </div>

        {/* 2. Operator Profile Card with Cognito TOTP Lock & Switcher */}
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => setAgentMenuOpen(!agentMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.65rem 0.8rem',
              borderRadius: '16px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-white)',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  backgroundColor: currentAgent.color || '#0C0D0D',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {currentAgent.initials}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: 'var(--color-black)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {currentAgent.name}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                  {currentAgent.role === 'Operations_Manager' ? 'Supervisor' : 'Tier 1 Support'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <span title="Cognito RFC 6238 TOTP MFA Enforced" style={{ display: 'inline-flex' }}>
                <Lock size={13} style={{ color: 'var(--color-dot-green)' }} />
              </span>
              <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
            </div>
          </div>

          {/* Operator Switcher Dropdown */}
          {agentMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                backgroundColor: 'var(--color-white)',
                border: '1px solid var(--color-border)',
                borderRadius: '16px',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.1)',
                padding: '0.5rem',
                zIndex: 40,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              <div style={{ padding: '0.35rem 0.5rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-faint)', textTransform: 'uppercase' }}>
                Active Operator Identity
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
                    padding: '0.45rem 0.6rem',
                    borderRadius: '8px',
                    backgroundColor: currentAgent.id === agent.id ? 'var(--color-sage)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-black)' }}>
                        {agent.name}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                        {agent.role === 'Operations_Manager' ? 'Operations Manager' : 'Tier 1 Agent'}
                      </span>
                    </div>
                  </div>
                  {currentAgent.id === agent.id && <Check size={13} color="var(--color-black)" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Primary View: Live Operations Console */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.75rem 1rem',
              borderRadius: '16px',
              backgroundColor: 'var(--color-black)',
              color: 'var(--color-white)',
              border: 'none',
              fontSize: '0.86rem',
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(12, 13, 13, 0.15)',
              boxSizing: 'border-box',
            }}
          >
            <Activity size={18} />
            <span>Live Operations</span>
          </div>
        </div>
      </div>

      {/* Bottom: Functional Bedrock Widget with Batch Simulation Trigger */}
      <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {/* Backend State Pill */}
        <div
          onClick={onToggleDemoMode}
          title="Click to toggle Live AWS PrivateLink / Sandbox Mode"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.45rem 0.75rem',
            borderRadius: '10px',
            backgroundColor: 'var(--color-canvas)',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
            fontSize: '0.72rem',
            fontWeight: 600,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Server size={12} style={{ color: isLiveBackend ? 'var(--color-dot-green)' : 'var(--color-dot-amber)' }} />
            <span>{isLiveBackend ? 'AWS PrivateLink' : isDemoMode ? 'Demo Sandbox' : 'Local Fallback'}</span>
          </div>
          <span className={`status-dot ${isLiveBackend ? 'status-dot-green' : 'status-dot-amber'}`} />
        </div>

        {/* Functional Bedrock GenAI Card */}
        <div
          style={{
            backgroundColor: 'var(--color-sage)',
            borderRadius: '20px',
            padding: '1.1rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            border: '1px solid var(--color-sage-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="status-dot status-dot-green" />
              <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--color-black)' }}>
                Bedrock GenAI
              </span>
            </div>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              Claude 3.5 Haiku
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: '1.3' }}>
              Unit cost: <strong style={{ color: 'var(--color-black)' }}>~0.00025 €</strong> / ticket
            </div>
            <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700 }}>
              Zero NAT Gateway egress
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
