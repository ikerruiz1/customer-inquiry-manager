import React from 'react';
import {
  Shield,
  Activity,
  Bot,
  Clock,
  Coins,
  RefreshCw,
  Radio,
  Sparkles,
} from 'lucide-react';
import type { AgentProfile, KPIStats } from '../types/inquiry';
import { INITIAL_AGENTS } from '../api/mockData';

interface NavbarProps {
  currentAgent: AgentProfile;
  onSelectAgent: (agent: AgentProfile) => void;
  kpis: KPIStats;
  isLiveBackend: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
  onToggleDemoMode: () => void;
  isDemoMode: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentAgent,
  onSelectAgent,
  kpis,
  isLiveBackend,
  onRefresh,
  isRefreshing,
  onToggleDemoMode,
  isDemoMode,
}) => {
  return (
    <header
      style={{
        backgroundColor: '#0a0e17',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0.65rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
      }}
    >
      {/* Top Row: Brand, Agent Profile & Connection */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #2563eb, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(59, 130, 246, 0.4)',
            }}
          >
            <Sparkles size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
                ExampleCorp CIM
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '4px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#93c5fd',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  fontWeight: 600,
                }}
              >
                v1.0.0
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Enterprise AI Customer Inquiry & Ticket Triage Operations Console
            </div>
          </div>
        </div>

        {/* Right Section: Connection Status & Agent Profile Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {/* Connection Mode Indicator / Toggle */}
          <button
            onClick={onToggleDemoMode}
            title="Click to toggle between Live FastAPI backend and Local Demo Mode"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              background: isDemoMode ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              border: `1px solid ${isDemoMode ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
              color: isDemoMode ? '#fcd34d' : '#6ee7b7',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Radio size={13} className={isLiveBackend && !isDemoMode ? 'pulse-critical' : ''} />
            <span>{isDemoMode ? 'Demo Mode (Offline)' : isLiveBackend ? 'Live API Connected' : 'API Connecting...'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
            title="Manual queue re-sync"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>

          {/* Cognito MFA & Agent Switcher */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.35rem 0.65rem',
              borderRadius: '8px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-prominent)',
            }}
          >
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: currentAgent.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#fff',
              }}
            >
              {currentAgent.initials}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  {currentAgent.name}
                </span>
                <span
                  title="Cognito TOTP MFA Active"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.15rem',
                    fontSize: '0.65rem',
                    color: '#34d399',
                  }}
                >
                  <Shield size={11} />
                  <span>MFA</span>
                </span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                {currentAgent.role === 'Operations_Manager' ? 'Ops Manager' : 'Tier 1 Support'}
              </div>
            </div>

            {/* Quick Profile Select dropdown */}
            <select
              value={currentAgent.id}
              onChange={(e) => {
                const found = INITIAL_AGENTS.find((a) => a.id === e.target.value);
                if (found) onSelectAgent(found);
              }}
              style={{
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                padding: '0.2rem 0.4rem',
                fontSize: '0.7rem',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {INITIAL_AGENTS.map((a) => (
                <option key={a.id} value={a.id}>
                  Switch: {a.name} ({a.role === 'Operations_Manager' ? 'Manager' : 'Agent'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bottom Row: FinOps & SRE Live KPI Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.6rem',
          padding: '0.45rem 0.6rem',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '6px',
          border: '1px solid rgba(30, 41, 59, 0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={15} color="#38bdf8" />
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Active Incidents
            </div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>
              {kpis.activeCount} <span style={{ fontSize: '0.72rem', color: kpis.p1Count > 0 ? '#f87171' : '#34d399' }}>({kpis.p1Count} P1 Critical)</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={15} color="#34d399" />
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              SLA Compliance (SLI)
            </div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#34d399' }}>
              {kpis.slaComplianceRate}%
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bot size={15} color="#c084fc" />
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              AI Acceptance Rate
            </div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#c084fc' }}>
              {kpis.aiAcceptanceRate}% <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>(Verbatim)</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={15} color="#fbbf24" />
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Avg MTTR Reduction
            </div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fbbf24' }}>
              {kpis.avgMttrSeconds}s <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>(vs 15m manual)</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Coins size={15} color="#4ade80" />
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              FinOps GenAI Cost
            </div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#4ade80' }}>
              ~{kpis.estimatedCostTodayEur} € <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>(Claude Haiku)</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
