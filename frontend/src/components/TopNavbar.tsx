import React, { useState } from 'react';
import {
  Search,
  Plus,
  Server,
  Lock,
  ChevronDown,
  UserCheck,
  Sparkles,
  Radio,
  Layers,
  Inbox,
} from 'lucide-react';
import type { AgentProfile } from '../types/inquiry';
import { INITIAL_AGENTS } from '../api/mockData';

interface TopNavbarProps {
  activeTab: 'overview' | 'queue' | 'ai' | 'omnichannel';
  onSelectTab: (tab: 'overview' | 'queue' | 'ai' | 'omnichannel') => void;
  currentAgent: AgentProfile;
  onSelectAgent: (agent: AgentProfile) => void;
  isLiveBackend: boolean;
  isDemoMode: boolean;
  onToggleDemoMode: () => void;
  onOpenNewInquiry: () => void;
  pendingTicketCount: number;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  activeTab,
  onSelectTab,
  currentAgent,
  onSelectAgent,
  isLiveBackend,
  isDemoMode,
  onToggleDemoMode,
  onOpenNewInquiry,
  pendingTicketCount,
}) => {
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 0.25rem 1.25rem 0.25rem',
        width: '100%',
      }}
    >
      {/* 1. Brand Logo (Fitonist style - clean lowercase sans-serif) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <div
          style={{
            fontSize: '1.45rem',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <span>cloudscale</span>
          <span style={{ color: 'var(--pastel-lilac)', fontSize: '1.6rem', lineHeight: '0.8' }}>.</span>
        </div>
        <span
          style={{
            fontSize: '0.68rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-faint)',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '0.15rem 0.45rem',
            borderRadius: '9999px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          v2.4
        </span>
      </div>

      {/* 2. Centered Floating Pill Navigation */}
      <nav className="floating-pill-nav">
        <button
          className={`pill-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => onSelectTab('overview')}
        >
          <Layers size={14} />
          <span>Overview</span>
        </button>
        <button
          className={`pill-nav-item ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => onSelectTab('queue')}
        >
          <Inbox size={14} />
          <span>Live Queue</span>
          {pendingTicketCount > 0 && (
            <span
              style={{
                fontSize: '0.68rem',
                padding: '0.05rem 0.4rem',
                borderRadius: '9999px',
                background: activeTab === 'queue' ? '#0d0e14' : 'var(--pastel-lilac)',
                color: activeTab === 'queue' ? 'var(--pastel-lilac)' : '#0d0e14',
                fontWeight: 700,
              }}
            >
              {pendingTicketCount}
            </span>
          )}
        </button>
        <button
          className={`pill-nav-item ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => onSelectTab('ai')}
        >
          <Sparkles size={14} />
          <span>AI Triage & MLOps</span>
        </button>
        <button
          className={`pill-nav-item ${activeTab === 'omnichannel' ? 'active' : ''}`}
          onClick={() => onSelectTab('omnichannel')}
        >
          <Radio size={14} />
          <span>Omnichannel</span>
        </button>
      </nav>

      {/* 3. Right Actions: New Request, Search, Backend Status & Profile Pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        {/* + New Inquiry Button */}
        <button
          onClick={onOpenNewInquiry}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.45rem 0.85rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#ffffff',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
        >
          <Plus size={14} />
          <span>New Ticket</span>
        </button>

        {/* Backend / Demo Indicator */}
        <button
          onClick={onToggleDemoMode}
          title="Click to toggle Live AWS ECS / Standalone Mode"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 0.75rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            color: isLiveBackend ? 'var(--pastel-mint)' : isDemoMode ? 'var(--pastel-yellow-dark)' : 'var(--text-muted)',
            fontSize: '0.74rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Server size={13} />
          <span>{isLiveBackend ? 'ECS Live' : isDemoMode ? 'Demo Sandbox' : 'Local Fallback'}</span>
        </button>

        {/* Search Pill Button */}
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <Search size={15} />
        </div>

        {/* User Profile Pill (Fitonist Olivia Brooks style) */}
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => setAgentMenuOpen(!agentMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.28rem 0.75rem 0.28rem 0.35rem',
              borderRadius: '9999px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {/* Avatar Circle */}
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '9999px',
                backgroundColor: currentAgent.color || '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.75rem',
              }}
            >
              {currentAgent.initials}
            </div>

            {/* Name & Email */}
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: '1.15' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span>{currentAgent.name}</span>
                <span title="Cognito RFC 6238 TOTP Enforced" style={{ display: 'inline-flex' }}>
                  <Lock size={11} style={{ color: 'var(--pastel-mint)' }} />
                </span>
              </div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                {currentAgent.email}
              </span>
            </div>

            <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          </div>

          {/* Cognito Operator Dropdown */}
          {agentMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '230px',
                backgroundColor: '#191a25',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '16px',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
                padding: '0.5rem',
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              <div style={{ padding: '0.35rem 0.55rem', fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 700 }}>
                Cognito Active Operator
              </div>
              {INITIAL_AGENTS.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    onSelectAgent(agent);
                    setAgentMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: currentAgent.id === agent.id ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    color: '#ffffff',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '9999px',
                        backgroundColor: agent.color,
                        color: '#fff',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {agent.initials}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.76rem', fontWeight: 600 }}>{agent.name}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{agent.role}</div>
                    </div>
                  </div>
                  {currentAgent.id === agent.id && <UserCheck size={14} style={{ color: 'var(--pastel-mint)' }} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
