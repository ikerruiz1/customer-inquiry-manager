import React, { useState, useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { TicketQueue } from "./components/TicketQueue";
import { TicketDetail } from "./components/TicketDetail";
import { OmnichannelSimulator } from "./components/OmnichannelSimulator";
import { TOTPModal } from "./components/TOTPModal";
import { Inquiry, OperatorProfile } from "./types";
import {
  fetchInquiries,
  claimInquiry,
  fetchOperatorProfile,
  setAuthToken,
} from "./services/api";

export const App: React.FC = () => {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Inquiry | null>(null);
  const [operator, setOperator] = useState<OperatorProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");

  // Modals
  const [simulatorOpen, setSimulatorOpen] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);

  // Initial load
  useEffect(() => {
    loadOperator();
    loadInquiries();
    const pollInterval = setInterval(() => {
      loadInquiries(false);
    }, 10000); // 10s auto-refresh
    return () => clearInterval(pollInterval);
  }, [statusFilter, priorityFilter, departmentFilter]);

  const loadOperator = async () => {
    try {
      const prof = await fetchOperatorProfile();
      setOperator(prof);
    } catch {
      // Dev mode default operator
      setOperator({
        sub: "00000000-0000-0000-0000-000000000001",
        email: "lead.agent@cloudscale.io",
        groups: ["Tier1_Agents", "Operations_Managers"],
      });
    }
  };

  const loadInquiries = async (showLoadingSpinner: boolean = true) => {
    if (showLoadingSpinner) setLoading(true);
    try {
      const data = await fetchInquiries({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        department: departmentFilter || undefined,
      });
      setInquiries(data.items);
      // Keep selected ticket in sync if still present
      if (selectedTicket) {
        const matching = data.items.find((i) => i.id === selectedTicket.id);
        if (matching) setSelectedTicket(matching);
      } else if (data.items.length > 0 && showLoadingSpinner) {
        setSelectedTicket(data.items[0]);
      }
    } catch (err) {
      console.error("Failed to load queue:", err);
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  };

  const handleClaim = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = await claimInquiry(id);
      setInquiries((prev) => prev.map((t) => (t.id === id ? updated : t)));
      if (selectedTicket?.id === id) {
        setSelectedTicket(updated);
      }
    } catch (err: any) {
      alert(`Claim failed: ${err.message}`);
    }
  };

  const handleTicketUpdated = (updated: Inquiry) => {
    setInquiries((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelectedTicket(updated);
  };

  const handleInquiryCreated = (newInquiry: Inquiry) => {
    setInquiries((prev) => [newInquiry, ...prev]);
    setSelectedTicket(newInquiry);
  };

  const handleLogout = () => {
    setAuthToken(null);
    setOperator(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        operator={operator}
        onOpenSimulator={() => setSimulatorOpen(true)}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main 2-Column Master-Detail Operations Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        {/* Left Column: Prioritized Triage Queue (5 cols) */}
        <div className="lg:col-span-5 h-[calc(100vh-6.5rem)]">
          <TicketQueue
            inquiries={inquiries}
            selectedTicket={selectedTicket}
            onSelectTicket={setSelectedTicket}
            onClaimTicket={handleClaim}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            priorityFilter={priorityFilter}
            setPriorityFilter={setPriorityFilter}
            departmentFilter={departmentFilter}
            setDepartmentFilter={setDepartmentFilter}
            loading={loading}
          />
        </div>

        {/* Right Column: Selected Ticket HITL Detail & AI Inference (7 cols) */}
        <div className="lg:col-span-7 h-[calc(100vh-6.5rem)]">
          <TicketDetail
            ticket={selectedTicket}
            operator={operator}
            onTicketUpdated={handleTicketUpdated}
          />
        </div>
      </main>

      {/* Omnichannel Webhook Intake Simulator Modal */}
      <OmnichannelSimulator
        isOpen={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        onInquiryCreated={handleInquiryCreated}
      />

      {/* RFC 6238 Software Token TOTP MFA Modal */}
      <TOTPModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(prof) => setOperator(prof)}
      />
    </div>
  );
};
export default App;
