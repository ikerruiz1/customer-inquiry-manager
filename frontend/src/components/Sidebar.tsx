import React, { useState } from 'react';
import {
  LayoutDashboard,
  Ticket,
  Radio,
  Sparkles,
  ShieldCheck,
  Server,
  UserCheck,
  ChevronRight,
  ChevronLeft,
  Lock,
  RefreshCw,
} from 'lucide-react';
import type { AgentProfile } from '../types/inquiry';
import { INITIAL_AGENTS } from '../api/mockData';

interface SidebarProps {
  currentAgent: AgentProfile;
  onSelectAgent: (agent: AgentProfile) => void;
  isLiveBackend: boolean;
  isDemoMode: boolean;
  onToggleDemoMode: () => void;
  activeSection: string;
  onSelectSection: (section: string) => void;
  unassignedCount: number;
  urgentCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentAgent,
  onSelectAgent,
  isLiveBackend,
  isDemoMode,
  onToggleDemoMode,
  activeSection,
  onSelectSection,
  unassignedCount,
  urgentCount,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);

  return (
    <aside
      style={{
        width: collapsed ? '80px' : '260px',
        backgroundColor: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'width 0.2s ease',
        flexShrink: 0,
        zIndex: 20,
      }}
    >
      {/* Top Header & Navigation */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
        {/* Brand Header */}
        <div
          style={{
            padding: '1.25rem 1.2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            borderBottom: '1px solid var(--sidebar-border)',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
              flexShrink: 0,
            }}
          >
            <Sparkles size={20} />
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#ffffff', letterSpacing: '-0.01em' }}>
                ExampleCorp AI
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--sidebar-text)', fontWeight: 500 }}>
                Customer Inquiry Operations
              </div>
            </div>
          )}
        </div>

        {/* Navigation Sections */}
        <div style={{ padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* GENERAL SECTION */}
          <div>
            {!collapsed && (
              <div
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#64748b',
                  letterSpacing: '0.08em',
                  padding: '0 0.6rem 0.4rem',
                }}
              >
                General
              </div>
            )}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <button
                onClick={() => onSelectSection('dashboard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  backgroundColor: activeSection === 'dashboard' ? 'var(--sidebar-active-pill)' : 'transparent',
                  color: activeSection === 'dashboard' ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                  fontSize: '0.85rem',
                  fontWeight: activeSection === 'dashboard' ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                }}
              >
                <LayoutDashboard size={18} style={{ color: activeSection === 'dashboard' ? '#38bdf8' : 'inherit' }} />
                {!collapsed && <span>Dashboard</span>}
              </button>

              <button
                onClick={() => onSelectSection('queue')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  backgroundColor: activeSection === 'queue' ? 'var(--sidebar-active-pill)' : 'transparent',
                  color: activeSection === 'queue' ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                  fontSize: '0.85rem',
                  fontWeight: activeSection === 'queue' ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  justifyContent: collapsed ? 'center' : 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Ticket size={18} style={{ color: activeSection === 'queue' ? '#38bdf8' : 'inherit' }} />
                  {!collapsed && <span>Ticket Queue</span>}
                </div>
                {!collapsed && unassignedCount > 0 && (
                  <span
                    style={{
                      background: 'rgba(59, 130, 246, 0.25)',
                      color: '#93c5fd',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.45rem',
                      borderRadius: '9999px',
                    }}
                  >
                    {unassignedCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => onSelectSection('urgent')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  backgroundColor: activeSection === 'urgent' ? 'var(--sidebar-active-pill)' : 'transparent',
                  color: activeSection === 'urgent' ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                  fontSize: '0.85rem',
                  fontWeight: activeSection === 'urgent' ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  justifyContent: collapsed ? 'center' : 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Radio size={18} style={{ color: '#ef4444' }} />
                  {!collapsed && <span>Urgent Attention</span>}
                </div>
                {!collapsed && urgentCount > 0 && (
                  <span
                    style={{
                      background: 'rgba(239, 68, 68, 0.25)',
                      color: '#fca5a5',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.45rem',
                      borderRadius: '9999px',
                    }}
                  >
                    {urgentCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => onSelectSection('insights')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  backgroundColor: activeSection === 'insights' ? 'var(--sidebar-active-pill)' : 'transparent',
                  color: activeSection === 'insights' ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                  fontSize: '0.85rem',
                  fontWeight: activeSection === 'insights' ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                }}
              >
                <Sparkles size={18} style={{ color: activeSection === 'insights' ? '#38bdf8' : 'inherit' }} />
                {!collapsed && <span>AI Triage & MLOps</span>}
              </button>

              <button
                onClick={() => onSelectSection('audit')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  backgroundColor: activeSection === 'audit' ? 'var(--sidebar-active-pill)' : 'transparent',
                  color: activeSection === 'audit' ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                  fontSize: '0.85rem',
                  fontWeight: activeSection === 'audit' ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                }}
              >
                <ShieldCheck size={18} style={{ color: activeSection === 'audit' ? '#38bdf8' : 'inherit' }} />
                {!collapsed && <span>Audit Trail (SOC 2)</span>}
              </button>
            </nav>
          </div>

          {/* SYSTEM ENVIRONMENT & ROLES */}
          {!collapsed && (
            <div>
              <div
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#64748b',
                  letterSpacing: '0.08em',
                  padding: '0 0.6rem 0.4rem',
                }}
              >
                System & Roles
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {/* Backend Connection Status */}
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--sidebar-border)',
                    borderRadius: '0.5rem',
                    padding: '0.6rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Server size={15} style={{ color: isLiveBackend ? '#10b981' : '#f59e0b' }} />
                    <span style={{ fontSize: '0.78rem', color: '#e2e8f0', fontWeight: 500 }}>
                      {isLiveBackend ? 'AWS ECS Live' : (isDemoMode ? 'Demo Sandbox' : 'Local Fallback')}
                    </span>
                  </div>
                  <button
                    onClick={onToggleDemoMode}
                    title="Toggle Live Backend / Demo Mode"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '0.2rem',
                    }}
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>

                {/* Cognito Role Switcher */}
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--sidebar-border)',
                    borderRadius: '0.5rem',
                    padding: '0.6rem 0.75rem',
                    cursor: 'pointer',
                  }}
                  onClick={() => setAgentMenuOpen(!agentMenuOpen)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <UserCheck size={15} style={{ color: '#38bdf8' }} />
                      <span style={{ fontSize: '0.78rem', color: '#ffffff', fontWeight: 600 }}>
                        {currentAgent.name}
                      </span>
                    </div>
                    <ChevronRight
                      size={14}
                      style={{
                        color: '#64748b',
                        transform: agentMenuOpen ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </div>

                  {agentMenuOpen && (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        paddingTop: '0.5rem',
                        borderTop: '1px solid var(--sidebar-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                      }}
                    >
                      {INITIAL_AGENTS.map((agent) => (
                        <button
                          key={agent.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectAgent(agent);
                            setAgentMenuOpen(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.35rem 0.5rem',
                            borderRadius: '0.375rem',
                            border: 'none',
                            backgroundColor: agent.id === currentAgent.id ? '#1e293b' : 'transparent',
                            color: agent.id === currentAgent.id ? '#ffffff' : '#94a3b8',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <span>{agent.name}</span>
                          <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{agent.role}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Operator Card & Collapse Toggle */}
      <div
        style={{
          borderTop: '1px solid var(--sidebar-border)',
          padding: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {/* Active Operator Badge */}
        {!collapsed && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.4rem 0.5rem',
              borderRadius: '0.5rem',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
            }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: currentAgent.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.8rem',
                color: '#ffffff',
                flexShrink: 0,
              }}
            >
              {currentAgent.initials}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {currentAgent.name}
              </div>
              <div
                style={{
                  fontSize: '0.7rem',
                  color: '#64748b',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {currentAgent.email}
              </div>
            </div>
            <span title="Cognito TOTP MFA Active" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <Lock size={13} style={{ color: '#10b981', flexShrink: 0 }} />
            </span>
          </div>
        )}

        {/* Collapse Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: '0.5rem',
            padding: '0.4rem 0.5rem',
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            fontSize: '0.75rem',
            cursor: 'pointer',
            borderRadius: '0.375rem',
          }}
        >
          {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /> <span>Collapse Menu</span></>}
        </button>
      </div>
    </aside>
  );
};
