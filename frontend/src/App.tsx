import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  checkBackendHealth,
  claimInquiry,
  createInquiry,
  fetchInquiries,
  overrideInquiry,
  resolveInquiry,
  getStoredUser,
  logoutOperator,
  fetchCurrentOperator,
  fetchDashboardMetrics,
  fetchRegisteredOperators,
} from './api/client';
import { LoadLogicTopHeader } from './components/LoadLogicTopHeader';
import { DashboardWidgetGrid } from './components/DashboardWidgetGrid';
import { LoadLogicDetailDrawer } from './components/LoadLogicDetailDrawer';
import { AmbientBackground } from './components/AmbientBackground';
import { THEMES, type ThemeId } from './types/theme';
import { type QueueTab } from './components/LoadLogicQueueTable';
import { NewInquiryModal } from './components/NewInquiryModal';
import { OverrideModal } from './components/OverrideModal';
import { AuthModal } from './components/AuthModal';
import type {
  AgentProfile,
  Inquiry,
  AuthUser,
  DashboardMetricsResponse,
  KPIStats,
} from './types/inquiry';
import {
  ChannelEnum,
  DepartmentEnum,
  PriorityEnum,
} from './types/inquiry';

const DEFAULT_KPIS: KPIStats = {
  activeCount: 0,
  p1Count: 0,
  slaComplianceRate: 100,
  aiAcceptanceRate: 100,
  avgMttrSeconds: 0,
  estimatedCostTodayEur: 0,
};

export const App: React.FC = () => {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Inquiry | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(getStoredUser()));
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(() => !Boolean(getStoredUser()));
  const [currentAgent, setCurrentAgent] = useState<AgentProfile>(() => {
    const stored = getStoredUser();
    if (stored) {
      return {
        id: stored.id,
        name: stored.name,
        email: stored.email,
        role: stored.role,
        initials: stored.initials || 'OP',
        color: stored.color || (stored.role === 'Operations_Manager' ? '#8b5cf6' : '#3b82f6'),
      };
    }
    return {
      id: '',
      name: 'Operator',
      email: '',
      role: 'Tier1_Agent',
      initials: 'OP',
      color: '#3b82f6',
    };
  });
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetricsResponse | null>(null);
  const [registeredOperators, setRegisteredOperators] = useState<AgentProfile[]>([]);
  const [queueTab, setQueueTab] = useState<QueueTab>('DEFAULT');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLiveBackend, setIsLiveBackend] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isInjecting, setIsInjecting] = useState<boolean>(false);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState<boolean>(false);
  const [isNewInquiryModalOpen, setIsNewInquiryModalOpen] = useState<boolean>(false);
  const [isLayoutCustomized, setIsLayoutCustomized] = useState<boolean>(false);
  const [resetSignal, setResetSignal] = useState<number>(0);
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    try {
      const saved = localStorage.getItem('ambient_theme_v2');
      if (saved === 'aura') {
        localStorage.setItem('ambient_theme_v2', 'cobalt');
        return 'cobalt';
      }
      if (saved && THEMES.some((t) => t.id === saved)) {
        return saved as ThemeId;
      }
    } catch {
      // fallback
    }
    return 'cloudscape';
  });

  const handleSelectTheme = (newTheme: ThemeId) => {
    setThemeId(newTheme);
    try {
      localStorage.setItem('ambient_theme_v2', newTheme);
    } catch {
      // ignore
    }
  };

  // Check stored session or validate token on initial mount
  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      setIsAuthenticated(false);
      setIsAuthModalOpen(true);
    } else {
      fetchCurrentOperator()
        .then(() => setIsAuthenticated(true))
        .catch(() => {
          setIsAuthenticated(false);
          setIsAuthModalOpen(true);
        });
    }
  }, []);

  const handleAuthSuccess = (user: AuthUser) => {
    const profile: AgentProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      initials: user.initials || user.name.slice(0, 2).toUpperCase(),
      color: user.color || (user.role === 'Operations_Manager' ? '#8b5cf6' : '#3b82f6'),
    };
    setCurrentAgent(profile);
    setIsAuthenticated(true);
    setIsAuthModalOpen(false);
    loadData();
  };

  const handleLogout = () => {
    logoutOperator();
    setIsAuthenticated(false);
    setIsAuthModalOpen(true);
  };

  // Load inquiries and live dashboard metrics from backend
  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const alive = await checkBackendHealth();
      setIsLiveBackend(alive);
      const [data, metrics, ops] = await Promise.all([
        fetchInquiries(),
        fetchDashboardMetrics(),
        fetchRegisteredOperators(),
      ]);
      setInquiries(data);
      setDashboardMetrics(metrics);
      setRegisteredOperators(ops);

      // Keep selected ticket in sync if open
      if (selectedTicket) {
        const updated = data.find((i) => i.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
    } catch (err) {
      console.warn('Backend sync warning:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedTicket]);

  // Initial load
  useEffect(() => {
    loadData();
  }, []);

  // Periodic short-polling interval (every 3000ms for multi-agent real-time concurrency)
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Handle ticket claim with concurrency conflict guard
  const handleClaimTicket = async (ticketId: string) => {
    setIsClaiming(true);
    try {
      const updated = await claimInquiry(ticketId, currentAgent.id);
      setInquiries((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setSelectedTicket(updated);
    } catch (err: any) {
      alert(err.message || 'Error al asignar el ticket');
      await loadData();
    } finally {
      setIsClaiming(false);
    }
  };

  // Handle ticket resolution
  const handleResolveTicket = async (
    ticketId: string,
    resolutionText: string,
    notes?: string
  ) => {
    setIsResolving(true);
    try {
      const updated = await resolveInquiry(ticketId, resolutionText, notes);
      setInquiries((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setSelectedTicket(updated);
    } catch (err: any) {
      alert(err.message || 'Error resolving ticket');
    } finally {
      setIsResolving(false);
    }
  };

  // Handle AI classification override
  const handleOverride = async (
    ticketId: string,
    newDepartment: DepartmentEnum,
    newPriority: PriorityEnum,
    reason: string
  ) => {
    try {
      const updated = await overrideInquiry(
        ticketId,
        newDepartment,
        newPriority,
        reason
      );
      setInquiries((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setIsOverrideModalOpen(false);
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket(updated);
      }
    } catch (err: any) {
      alert(err.message || 'Error overriding classification');
    }
  };

  // Handle customer inquiry creation from modal
  const handleCreateCustomerInquiry = async (payload: {
    channel: ChannelEnum;
    customer_email: string;
    customer_name: string;
    subject: string;
    body: string;
  }) => {
    setIsInjecting(true);
    try {
      const newInquiry = await createInquiry(payload);
      setInquiries((prev) => [newInquiry, ...prev.filter((i) => i.id !== newInquiry.id)]);
      setQueueTab('DEFAULT');
      setSearchQuery('');
      setSelectedTicket(null);
      setIsNewInquiryModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Error creating inquiry');
    } finally {
      setIsInjecting(false);
    }
  };

  // Export audit logs as JSON file
  const handleExportAuditLogs = () => {
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      platform: 'Customer Inquiry Management Platform',
      operator: currentAgent.name,
      inquiriesCount: inquiries.length,
      inquiries: inquiries.map((i) => ({
        id: i.id,
        created_at: i.created_at,
        customer_name: i.customer_name,
        customer_email: i.customer_email,
        channel: i.channel,
        department: i.department,
        priority: i.priority,
        status: i.status,
        confidence_score: i.confidence_score,
        bedrock_latency_ms: i.bedrock_latency_ms,
        sentiment_score: i.sentiment_score,
        churn_risk: i.churn_risk,
        was_edited: i.was_edited,
        assigned_agent_id: i.assigned_agent_id,
        resolution_text: i.resolution_text,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customer_inquiry_audit_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filter inquiries based on search query
  const searchedInquiries = useMemo(() => {
    if (!searchQuery.trim()) return inquiries;
    const q = searchQuery.toLowerCase();
    return inquiries.filter((ticket) => {
      const matchSubj = ticket.subject ? ticket.subject.toLowerCase().includes(q) : false;
      const matchBody = ticket.body ? ticket.body.toLowerCase().includes(q) : false;
      const matchCust = ticket.customer_name ? ticket.customer_name.toLowerCase().includes(q) : false;
      const matchEmail = ticket.customer_email ? ticket.customer_email.toLowerCase().includes(q) : false;
      const matchId = ticket.id ? ticket.id.toLowerCase().includes(q) : false;
      const matchDept = ticket.department ? ticket.department.toLowerCase().includes(q) : false;
      const matchOrder = ticket.entities?.order_id ? String(ticket.entities.order_id).toLowerCase().includes(q) : false;
      return matchSubj || matchBody || matchCust || matchEmail || matchId || matchDept || matchOrder;
    });
  }, [inquiries, searchQuery]);

  // Derived KPIs with live SQL aggregation priority
  const kpis: KPIStats = useMemo(() => {
    if (dashboardMetrics?.kpis) {
      return {
        slaComplianceRate: dashboardMetrics.kpis.sla_compliance_rate,
        aiAcceptanceRate: dashboardMetrics.kpis.ai_acceptance_rate,
        avgMttrSeconds: dashboardMetrics.kpis.avg_mttr_seconds,
        activeCount: dashboardMetrics.kpis.active_count,
        p1Count: dashboardMetrics.kpis.p1_count,
        estimatedCostTodayEur: dashboardMetrics.kpis.estimated_cost_today_eur,
      };
    }
    return DEFAULT_KPIS;
  }, [dashboardMetrics]);
  const currentTheme = THEMES.find((t) => t.id === themeId) || THEMES[0];

  // Completely gate project rendering behind active authentication (Zero-Trust)
  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          width: '100%',
          backgroundColor: '#0B0F17',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          boxSizing: 'border-box',
        }}
      >
        <AuthModal
          isOpen={true}
          onSuccess={handleAuthSuccess}
          canClose={false}
        />
      </div>
    );
  }

  return (
    <>
      {/* Zero-Lag Fixed Hardware-Accelerated Ambient Canvas Layer */}
      <AmbientBackground themeId={themeId} />

      <div
        style={{
          width: '100%',
          maxWidth: '1440px',
          margin: '0 auto',
          backgroundColor: '#FFFFFF',
          borderRadius: '32px',
          border: currentTheme.isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(12, 13, 13, 0.05)',
          boxShadow: currentTheme.isDark
            ? '0 32px 80px -16px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08)'
            : '0 24px 64px -12px rgba(12, 13, 13, 0.08)',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          position: 'relative',
          minHeight: '880px',
          boxSizing: 'border-box',
          transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
        }}
      >
        {/* 1. Global Full-Width Header Bar */}
        <LoadLogicTopHeader
          currentAgent={currentAgent}
          onSelectAgent={setCurrentAgent}
          onLogout={handleLogout}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          isLiveBackend={isLiveBackend}
          isRefreshing={isRefreshing}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onExportAuditLogs={handleExportAuditLogs}
          onOpenNewInquiryModal={() => setIsNewInquiryModalOpen(true)}
          onResetLayout={() => setResetSignal((prev) => prev + 1)}
          isLayoutCustomized={isLayoutCustomized}
          currentThemeId={themeId}
          onSelectTheme={handleSelectTheme}
          modelName={inquiries.find((i) => i.model_id)?.model_id || 'Claude Haiku 4.5'}
        />

      {/* 2. Interactive Mobile-Widget Drag & Drop Operations Grid */}
      <main style={{ width: '100%' }}>
        <DashboardWidgetGrid
          kpis={kpis}
          inquiries={searchedInquiries}
          selectedTicket={selectedTicket}
          onSelectTicket={setSelectedTicket}
          currentAgent={currentAgent}
          onClaimTicket={handleClaimTicket}
          isClaiming={isClaiming}
          activeTab={queueTab}
          onTabChange={setQueueTab}
          onLayoutChange={setIsLayoutCustomized}
          resetSignal={resetSignal}
          dashboardMetrics={dashboardMetrics}
          operators={registeredOperators}
        />
      </main>

      {/* 3. Centered Spacious Ticket Detail Modal (Backdrop-Blurred) */}
      {selectedTicket && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            boxSizing: 'border-box',
          }}
        >
          {/* High-Blur Darkened Backdrop */}
          <div
            onClick={() => setSelectedTicket(null)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(12, 13, 13, 0.48)',
              backdropFilter: 'blur(8px)',
              animation: 'fadeInMenu 0.15s ease-out',
            }}
          />

          <LoadLogicDetailDrawer
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
            currentAgent={currentAgent}
            onResolveTicket={handleResolveTicket}
            onOpenOverrideModal={() => setIsOverrideModalOpen(true)}
            onClaimTicket={handleClaimTicket}
            isResolving={isResolving}
            operators={registeredOperators}
          />
        </div>
      )}

      {/* 4. MLOps Category Override Modal (Centered & Backdrop-Blurred) */}
      {selectedTicket && (
        <OverrideModal
          isOpen={isOverrideModalOpen}
          onClose={() => setIsOverrideModalOpen(false)}
          ticket={selectedTicket}
          onSubmitOverride={handleOverride}
          isSubmitting={false}
        />
      )}

      {/* 5. New Customer Inquiry Modal (Centered & Backdrop-Blurred) */}
      <NewInquiryModal
        isOpen={isNewInquiryModalOpen}
        onClose={() => setIsNewInquiryModalOpen(false)}
        onSubmit={handleCreateCustomerInquiry}
        isSubmitting={isInjecting}
      />

      {/* 6. Enforced RFC 6238 Software Token TOTP MFA Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onSuccess={handleAuthSuccess}
        onClose={() => setIsAuthModalOpen(false)}
        canClose={Boolean(getStoredUser())}
      />
    </div>
    </>
  );
};

export default App;
