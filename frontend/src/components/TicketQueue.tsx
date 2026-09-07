import React from "react";
import {
  Mail,
  Globe,
  Star,
  DollarSign,
  AlertOctagon,
  CheckCircle2,
  Lock,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Inquiry, Channel, Priority, Department, Status } from "../types";
import { SLATimer } from "./SLATimer";

interface TicketQueueProps {
  inquiries: Inquiry[];
  selectedTicket: Inquiry | null;
  onSelectTicket: (ticket: Inquiry) => void;
  onClaimTicket: (id: string, e: React.MouseEvent) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  priorityFilter: string;
  setPriorityFilter: (p: string) => void;
  departmentFilter: string;
  setDepartmentFilter: (d: string) => void;
  loading: boolean;
}

const ChannelIcon: React.FC<{ channel: Channel }> = ({ channel }) => {
  switch (channel) {
    case "EMAIL":
      return <Mail className="w-4 h-4 text-sky-400" title="Email" />;
    case "WEB_FORM":
      return <Globe className="w-4 h-4 text-emerald-400" title="Web Form" />;
    case "TRUSTPILOT":
      return <Star className="w-4 h-4 text-amber-400 fill-amber-400/20" title="Trustpilot" />;
    case "GOOGLE_REVIEWS":
      return <Star className="w-4 h-4 text-blue-400 fill-blue-400/20" title="Google Reviews" />;
    case "BILLING":
      return <DollarSign className="w-4 h-4 text-rose-400" title="Stripe Billing" />;
    default:
      return <Mail className="w-4 h-4 text-slate-400" />;
  }
};

export const TicketQueue: React.FC<TicketQueueProps> = ({
  inquiries,
  selectedTicket,
  onSelectTicket,
  onClaimTicket,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  departmentFilter,
  setDepartmentFilter,
  loading,
}) => {
  return (
    <div className="flex flex-col h-full bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
      {/* Header & Filter Controls */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-400" />
          <h2 className="font-semibold text-sm text-white">Triage Queue ({inquiries.length})</h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2.5 py-1 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="UNASSIGNED">Unassigned</option>
            <option value="CLAIMED">Claimed</option>
            <option value="RESOLVED">Resolved</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2.5 py-1 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Priorities</option>
            <option value="P1">P1 (Critical - 1h)</option>
            <option value="P2">P2 (High - 4h)</option>
            <option value="P3">P3 (Medium - 12h)</option>
            <option value="P4">P4 (Low - 24h)</option>
          </select>

          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2.5 py-1 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Departments</option>
            <option value="TECH_SUPPORT">Tech Support</option>
            <option value="BILLING">Billing</option>
            <option value="SECURITY">Security</option>
            <option value="SALES">Sales</option>
            <option value="ACCOUNTS">Accounts</option>
            <option value="GENERAL">General</option>
          </select>
        </div>
      </div>

      {/* Ticket List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            Loading real-time queue...
          </div>
        ) : inquiries.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-300">All tickets triaged & resolved</p>
            <p className="text-xs text-slate-500 mt-1">Use the Omnichannel Simulator to inject synthetic traffic</p>
          </div>
        ) : (
          inquiries.map((ticket) => {
            const isSelected = selectedTicket?.id === ticket.id;
            const isUnassigned = ticket.status === "UNASSIGNED";

            return (
              <div
                key={ticket.id}
                onClick={() => onSelectTicket(ticket)}
                className={`p-3.5 transition-all cursor-pointer flex items-start gap-3 hover:bg-slate-800/50 ${
                  isSelected ? "bg-slate-800/90 border-l-4 border-blue-500 pl-2.5" : ""
                }`}
              >
                <div className="mt-1 p-2 rounded-lg bg-slate-800/80 border border-slate-700/50">
                  <ChannelIcon channel={ticket.channel} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 truncate">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                        ticket.priority === "P1"
                          ? "badge-p1"
                          : ticket.priority === "P2"
                          ? "badge-p2"
                          : ticket.priority === "P3"
                          ? "badge-p3"
                          : "badge-p4"
                      }`}>
                        {ticket.priority}
                      </span>
                      <span className="text-xs font-semibold text-slate-300 truncate">
                        {ticket.subject}
                      </span>
                      {ticket.churn_risk && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-800 text-[10px] font-bold text-rose-400">
                          <AlertOctagon className="w-3 h-3" />
                          CHURN RISK
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {ticket.status !== "RESOLVED" && (
                        <SLATimer
                          deadlineIso={ticket.sla_deadline_at}
                          initialRemainingSeconds={ticket.sla_remaining_seconds}
                        />
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-1 mb-2">
                    {ticket.body}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-2">
                      <span>{ticket.customer_name}</span>
                      <span>•</span>
                      <span className="font-mono text-slate-400">{ticket.department}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isUnassigned ? (
                        <button
                          onClick={(e) => onClaimTicket(ticket.id, e)}
                          className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] transition shadow cursor-pointer"
                        >
                          Claim Ticket
                        </button>
                      ) : ticket.status === "CLAIMED" ? (
                        <span className="flex items-center gap-1 text-indigo-400 font-medium font-mono text-[11px]">
                          <Lock className="w-3 h-3" />
                          Claimed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-400 font-medium font-mono text-[11px]">
                          <CheckCircle2 className="w-3 h-3" />
                          Resolved
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
