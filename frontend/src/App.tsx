import {
  Download,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  calculateKPIs,
  checkBackendHealth,
  claimInquiry,
  createInquiry,
  fetchInquiries,
  overrideInquiry,
  resolveInquiry,
} from './api/client';
import { INITIAL_AGENTS } from './api/mockData';
import { LoadLogicDetailDrawer } from './components/LoadLogicDetailDrawer';
import { LoadLogicHeroCards } from './components/LoadLogicHeroCards';
import { LoadLogicQueueTable, type QueueTab } from './components/LoadLogicQueueTable';
import { LoadLogicSidebar } from './components/LoadLogicSidebar';
import { NewInquiryModal } from './components/NewInquiryModal';
import { OverrideModal } from './components/OverrideModal';
import type {
  AgentProfile,
  Inquiry,
} from './types/inquiry';
import {
  DepartmentEnum,
  PriorityEnum,
} from './types/inquiry';

export const App: React.FC = () => {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Inquiry | null>(null);
  const [currentAgent, setCurrentAgent] = useState<AgentProfile>(INITIAL_AGENTS[0]); // Carlos M. / Ethan Miller
  const [queueTab, setQueueTab] = useState<QueueTab>('DEFAULT');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLiveBackend, setIsLiveBackend] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isInjecting, setIsInjecting] = useState<boolean>(false);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState<boolean>(false);
  const [isNewInquiryModalOpen, setIsNewInquiryModalOpen] = useState<boolean>(false);

  // Load inquiries from client
  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (!isDemoMode) {
        const alive = await checkBackendHealth();
        setIsLiveBackend(alive);
      }
      const data = await fetchInquiries();
      setInquiries(data);

      // Keep selected ticket in sync if open
      if (selectedTicket) {
        const updated = data.find((i) => i.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
    } catch (err) {
      console.warn('Queue sync error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [isDemoMode, selectedTicket]);

  // Initial load
  useEffect(() => {
    loadData();
  }, []);

  // Periodic polling interval (every 4 seconds for real-time synchronization)
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 4000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Handle ticket claim
  const handleClaimTicket = async (ticketId: string) => {
    setIsClaiming(true);
    try {
      const updated = await claimInquiry(ticketId, currentAgent.id);
      setInquiries((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setSelectedTicket(updated);
    } catch (err: any) {
      alert(err.message || 'Error claiming ticket');
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
      setInquiries((prev) => [newInquiry, ...prev]);
      setSelectedTicket(newInquiry);
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
      platform: 'Customer Inquiry Manager (ExampleCorp)',
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
        is_simulation: i.is_simulation,
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
      const matchSubj = ticket.subject.toLowerCase().includes(q);
      const matchBody = ticket.body.toLowerCase().includes(q);
      const matchCust = ticket.customer_name.toLowerCase().includes(q);
      const matchEmail = ticket.customer_email.toLowerCase().includes(q);
      const matchId = ticket.id.toLowerCase().includes(q);
      const matchDept = ticket.department.toLowerCase().includes(q);
      const matchOrder = ticket.entities?.order_id?.toLowerCase().includes(q);
      return matchSubj || matchBody || matchCust || matchEmail || matchId || matchDept || matchOrder;
    });
  }, [inquiries, searchQuery]);

  // Derived KPIs
  const kpis = useMemo(() => calculateKPIs(inquiries), [inquiries]);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1440px',
        margin: '0 auto',
        backgroundColor: '#FFFFFF',
        borderRadius: '32px',
        border: '1px solid rgba(12, 13, 13, 0.05)',
        boxShadow: '0 24px 64px -12px rgba(12, 13, 13, 0.08)',
        padding: '24px',
        display: 'flex',
        gap: '24px',
        position: 'relative',
        minHeight: '880px',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Left Column: Clean Focused LoadLogic Sidebar */}
      <LoadLogicSidebar
        currentAgent={currentAgent}
        onSelectAgent={setCurrentAgent}
        isLiveBackend={isLiveBackend}
        isDemoMode={isDemoMode}
        onToggleDemoMode={() => setIsDemoMode(!isDemoMode)}
      />

      {/* 2. Right Column: Primary Unified Live Operations Console */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          minWidth: 0,
        }}
      >
        {/* Top Header Bar: Search Input + Action Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          {/* Search Box */}
          <div
            style={{
              position: 'relative',
              flex: 1,
              maxWidth: '480px',
              minWidth: '240px',
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
              placeholder="Search inquiries, order IDs, errors, customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

          {/* Right Action Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Live Network Pill */}
            <div
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
              }}
              title="Zero-internet egress AWS PrivateLink active"
            >
              <span className="status-dot status-dot-green" />
              <span>{isLiveBackend ? 'AWS PrivateLink' : isDemoMode ? 'Demo Sandbox' : 'Local Engine'}</span>
              {isRefreshing && <RefreshCw size={11} className="animate-spin" style={{ marginLeft: '4px', opacity: 0.6 }} />}
            </div>

            {/* Export Audit Logs Button */}
            <button
              onClick={handleExportAuditLogs}
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
              onClick={() => setIsNewInquiryModalOpen(true)}
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

        {/* Top Row: Two LoadLogic Sage Hero Cards with live telemetry & slate tones */}
        <LoadLogicHeroCards kpis={kpis} inquiries={searchedInquiries} />

        {/* Bottom Row: LoadLogic Inquiries Table with strict grid alignment & dropdown sort */}
        <LoadLogicQueueTable
          inquiries={searchedInquiries}
          selectedTicket={selectedTicket}
          onSelectTicket={setSelectedTicket}
          currentAgent={currentAgent}
          onClaimTicket={handleClaimTicket}
          isClaiming={isClaiming}
          activeTab={queueTab}
          onTabChange={setQueueTab}
        />
      </main>

      {/* 3. Slide-Over Ticket Detail Drawer */}
      {selectedTicket && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            zIndex: 100,
            display: 'flex',
          }}
        >
          {/* Backdrop */}
          <div
            onClick={() => setSelectedTicket(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(12, 13, 13, 0.4)',
              backdropFilter: 'blur(3px)',
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
    </div>
  );
};

export default App;
