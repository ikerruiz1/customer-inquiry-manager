import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { OmnichannelBar } from './components/OmnichannelBar';
import { FilterBar } from './components/FilterBar';
import { TicketQueueTable } from './components/TicketQueueTable';
import { TicketDetailDrawer } from './components/TicketDetailDrawer';
import { OverrideModal } from './components/OverrideModal';
import { NewInquiryModal } from './components/NewInquiryModal';
import {
  InquiryStatusEnum,
  DepartmentEnum,
  PriorityEnum,
  ChannelEnum,
} from './types/inquiry';
import type {
  Inquiry,
  AgentProfile,
  InquiryFilters,
} from './types/inquiry';
import { INITIAL_AGENTS } from './api/mockData';
import {
  fetchInquiries,
  checkBackendHealth,
  claimInquiry,
  resolveInquiry,
  overrideInquiry,
  createInquiry,
  calculateKPIs,
} from './api/client';

export const App: React.FC = () => {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Inquiry | null>(null);
  const [currentAgent, setCurrentAgent] = useState<AgentProfile>(INITIAL_AGENTS[0]); // Carlos M.
  const [isLiveBackend, setIsLiveBackend] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isInjecting, setIsInjecting] = useState<boolean>(false);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState<boolean>(false);
  const [isNewInquiryModalOpen, setIsNewInquiryModalOpen] = useState<boolean>(false);

  // Filters State
  const [filters, setFilters] = useState<InquiryFilters>({
    statusTab: 'ACTIVE',
    department: 'ALL',
    priority: 'ALL',
    churnOnly: false,
    searchQuery: '',
  });

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
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(updated);
      }
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
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(updated);
      }
    } catch (err: any) {
      alert(err.message || 'Error overriding classification');
    }
  };

  // Handle scenario injection
  const handleInjectScenario = async (payload: {
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
    } catch (err: any) {
      alert(err.message || 'Error injecting scenario');
    } finally {
      setIsInjecting(false);
    }
  };

  // Filter inquiries based on active tab, department, priority, search
  const filteredInquiries = useMemo(() => {
    return inquiries.filter((ticket) => {
      // 1. Status Tab filter
      if (filters.statusTab === 'ACTIVE') {
        if (ticket.status === InquiryStatusEnum.RESOLVED) return false;
      } else if (filters.statusTab === 'IN_PROGRESS') {
        if (ticket.status !== InquiryStatusEnum.CLAIMED) return false;
      } else if (filters.statusTab === 'RESOLVED') {
        if (ticket.status !== InquiryStatusEnum.RESOLVED) return false;
      }

      // 2. Department filter
      if (filters.department && filters.department !== 'ALL') {
        if (ticket.department !== filters.department) return false;
      }

      // 3. Priority filter
      if (filters.priority && filters.priority !== 'ALL') {
        if (ticket.priority !== filters.priority) return false;
      }

      // 4. Churn risk only
      if (filters.churnOnly) {
        if (!ticket.churn_risk) return false;
      }

      // 5. Search query
      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase();
        const matchesSubject = ticket.subject.toLowerCase().includes(query);
        const matchesEmail = ticket.customer_email.toLowerCase().includes(query);
        const matchesName = ticket.customer_name.toLowerCase().includes(query);
        const matchesBody = ticket.body.toLowerCase().includes(query);
        if (!matchesSubject && !matchesEmail && !matchesName && !matchesBody) {
          return false;
        }
      }

      return true;
    });
  }, [inquiries, filters]);

  // Compute live KPIs
  const kpis = useMemo(() => calculateKPIs(inquiries), [inquiries]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top Navigation & KPIs */}
      <Navbar
        currentAgent={currentAgent}
        onSelectAgent={setCurrentAgent}
        kpis={kpis}
        isLiveBackend={isLiveBackend}
        onRefresh={loadData}
        isRefreshing={isRefreshing}
        onToggleDemoMode={() => setIsDemoMode(!isDemoMode)}
        isDemoMode={isDemoMode}
      />

      {/* Omnichannel Fast Trigger Simulator */}
      <OmnichannelBar
        onInjectScenario={handleInjectScenario}
        onOpenCustomModal={() => setIsNewInquiryModalOpen(true)}
        isInjecting={isInjecting}
      />

      {/* Filter & Search Bar */}
      <FilterBar
        filters={filters}
        onFilterChange={setFilters}
        inquiries={inquiries}
      />

      {/* Main Workspace: Table Queue + Split Drawer */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: 'var(--bg-app)',
        }}
      >
        {/* Left / Center Table Queue */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            height: '100%',
          }}
        >
          <TicketQueueTable
            inquiries={filteredInquiries}
            selectedTicket={selectedTicket}
            onSelectTicket={setSelectedTicket}
            currentAgent={currentAgent}
            onClaimTicket={handleClaimTicket}
            isClaiming={isClaiming}
          />
        </div>

        {/* Right Split View Drawer */}
        {selectedTicket && (
          <TicketDetailDrawer
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
            currentAgent={currentAgent}
            onResolveTicket={handleResolveTicket}
            onOpenOverrideModal={() => setIsOverrideModalOpen(true)}
            onClaimTicket={handleClaimTicket}
            isResolving={isResolving}
          />
        )}
      </div>

      {/* MLOps Category Override Modal */}
      <OverrideModal
        isOpen={isOverrideModalOpen}
        onClose={() => setIsOverrideModalOpen(false)}
        ticket={selectedTicket}
        onSubmitOverride={handleOverride}
        isSubmitting={false}
      />

      {/* Custom Inquiry Modal */}
      <NewInquiryModal
        isOpen={isNewInquiryModalOpen}
        onClose={() => setIsNewInquiryModalOpen(false)}
        onSubmit={handleInjectScenario}
        isSubmitting={isInjecting}
      />
    </div>
  );
};

export default App;
