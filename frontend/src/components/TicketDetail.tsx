import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Send,
  AlertTriangle,
  FileText,
  User,
  History,
  Edit3,
  CheckCircle,
  Tag,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { Inquiry, AuditLog, Department, Priority, OperatorProfile } from "../types";
import { SLATimer } from "./SLATimer";
import { fetchAuditLogs, resolveInquiry, overrideInquiry, claimInquiry } from "../services/api";

interface TicketDetailProps {
  ticket: Inquiry | null;
  operator: OperatorProfile | null;
  onTicketUpdated: (updated: Inquiry) => void;
}

export const TicketDetail: React.FC<TicketDetailProps> = ({
  ticket,
  operator,
  onTicketUpdated,
}) => {
  const [draftResponse, setDraftResponse] = useState<string>("");
  const [resolutionNotes, setResolutionNotes] = useState<string>("");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [showOverride, setShowOverride] = useState<boolean>(false);
  const [newDepartment, setNewDepartment] = useState<Department | "">("");
  const [newPriority, setNewPriority] = useState<Priority | "">("");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (ticket) {
      setDraftResponse(ticket.suggested_response || "");
      setResolutionNotes("");
      setShowOverride(false);
      setErrorMessage(null);
      loadLogs(ticket.id);
    }
  }, [ticket?.id]);

  const loadLogs = async (id: string) => {
    setLoadingLogs(true);
    try {
      const logs = await fetchAuditLogs(id);
      setAuditLogs(logs);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  if (!ticket) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900/40 rounded-xl border border-slate-800/80 p-8 text-slate-500">
        <div className="text-center">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-400">Select a ticket from the queue</p>
          <p className="text-xs text-slate-600 mt-1">Review AI triage analysis, audit logs, and copilot drafts</p>
        </div>
      </div>
    );
  }

  const isClaimedByMe = ticket.status === "CLAIMED" && ticket.assigned_agent_id === operator?.sub;
  const isUnassigned = ticket.status === "UNASSIGNED";
  const isResolved = ticket.status === "RESOLVED";
  const isOpsManager = operator?.groups.includes("Operations_Managers") ?? false;

  const handleClaim = async () => {
    try {
      const updated = await claimInquiry(ticket.id);
      onTicketUpdated(updated);
      loadLogs(ticket.id);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleResolve = async () => {
    if (!draftResponse.trim()) {
      setErrorMessage("Resolution text cannot be empty.");
      return;
    }
    setIsResolving(true);
    setErrorMessage(null);
    try {
      const updated = await resolveInquiry(ticket.id, draftResponse, resolutionNotes);
      onTicketUpdated(updated);
      loadLogs(ticket.id);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsResolving(false);
    }
  };

  const handleOverride = async () => {
    if (!overrideReason || overrideReason.length < 10) {
      setErrorMessage("Override requires an engineering rationale of at least 10 characters.");
      return;
    }
    try {
      const payload: any = { reason: overrideReason };
      if (newDepartment) payload.new_department = newDepartment;
      if (newPriority) payload.new_priority = newPriority;
      const updated = await overrideInquiry(ticket.id, payload);
      onTicketUpdated(updated);
      setShowOverride(false);
      setOverrideReason("");
      loadLogs(ticket.id);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/80 rounded-xl border border-slate-800 overflow-y-auto shadow-2xl">
      {/* Header Bar */}
      <div className="p-5 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
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
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-xs">
                {ticket.department}
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-950/70 border border-blue-800/80 text-blue-400 font-mono text-xs">
                {ticket.channel}
              </span>
              {ticket.churn_risk && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-bold">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  CHURN THREAT
                </span>
              )}
            </div>
            <h1 className="text-base font-bold text-white">{ticket.subject}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              From <span className="text-slate-200">{ticket.customer_name}</span> ({ticket.customer_email}) • ID: <span className="font-mono text-slate-500">{ticket.id.slice(0, 8)}</span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {ticket.status !== "RESOLVED" && (
              <SLATimer
                deadlineIso={ticket.sla_deadline_at}
                initialRemainingSeconds={ticket.sla_remaining_seconds}
              />
            )}
            <div className="flex items-center gap-2">
              {isUnassigned && (
                <button
                  onClick={handleClaim}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition cursor-pointer shadow"
                >
                  Claim Ticket
                </button>
              )}
              {isOpsManager && (
                <button
                  onClick={() => setShowOverride(!showOverride)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Override (MLOps)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-3 p-2.5 rounded bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Supervisor MLOps Override Drawer */}
        {showOverride && (
          <div className="mt-4 p-4 rounded-xl bg-amber-950/20 border border-amber-800/60">
            <div className="flex items-center gap-2 mb-3">
              <Edit3 className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                MLOps Audit Override (Operations Manager Only)
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Override Department</label>
                <select
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value as Department)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="">Keep current ({ticket.department})</option>
                  <option value="TECH_SUPPORT">Tech Support</option>
                  <option value="BILLING">Billing</option>
                  <option value="SECURITY">Security</option>
                  <option value="SALES">Sales</option>
                  <option value="ACCOUNTS">Accounts</option>
                  <option value="GENERAL">General</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Override Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as Priority)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="">Keep current ({ticket.priority})</option>
                  <option value="P1">P1 (Critical)</option>
                  <option value="P2">P2 (High)</option>
                  <option value="P3">P3 (Medium)</option>
                  <option value="P4">P4 (Low)</option>
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-[11px] text-slate-400 mb-1">
                Mandatory Engineering Rationale (Logged for SOC 2 / MLOps Calibration)
              </label>
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why Bedrock's classification was inaccurate (min 10 characters)..."
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowOverride(false)}
                className="px-3 py-1 rounded bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleOverride}
                className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs"
              >
                Apply Override & Log Audit
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="p-5 space-y-6">
        {/* Customer Message Body */}
        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Inbound Customer Message
          </h3>
          <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
            {ticket.body}
          </p>
        </div>

        {/* Bedrock AI Inference & Grounding Metadata */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/70 to-slate-900/70 border border-blue-500/20 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                Amazon Bedrock Triage & NER Extraction
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Model: Claude Haiku 4.5
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Urgency / Impact</span>
              <span className="text-sm font-bold text-white font-mono">
                {ticket.urgency}/5 • {ticket.impact}/3
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Sentiment Score</span>
              <span className={`text-sm font-bold font-mono ${
                ticket.sentiment_score < -0.3
                  ? "text-rose-400"
                  : ticket.sentiment_score > 0.3
                  ? "text-emerald-400"
                  : "text-amber-400"
              }`}>
                {ticket.sentiment_score.toFixed(2)}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Churn Probability</span>
              <span className={`text-sm font-bold font-mono ${ticket.churn_risk ? "text-rose-400" : "text-emerald-400"}`}>
                {ticket.churn_risk ? "HIGH RISK" : "NORMAL"}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Recommended Action</span>
              <span className="text-xs font-bold text-indigo-300 truncate block">
                {ticket.suggested_strategy || "DIRECT_RESOLUTION"}
              </span>
            </div>
          </div>

          {/* Key Entities Tags */}
          {ticket.entities && Object.keys(ticket.entities).length > 0 && (
            <div className="mb-3">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1.5 flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-400" />
                Extracted Key Entities (NER)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(ticket.entities).map(([k, v]) => (
                  <span
                    key={k}
                    className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px]"
                  >
                    <span className="text-slate-500">{k}:</span> {String(v)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {ticket.agent_copilot_notes && (
            <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-900/40 text-xs text-blue-200/90 leading-relaxed">
              <span className="font-semibold text-blue-300 block mb-0.5">Copilot Guidance Notes:</span>
              {ticket.agent_copilot_notes}
            </div>
          )}
        </div>

        {/* Human-in-the-Loop Response Editor & Approval Form */}
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Edit3 className="w-4 h-4 text-emerald-400" />
              Human-in-the-Loop (HITL) Customer Response Draft
            </h3>
            {ticket.human_reviewed && (
              <span className="flex items-center gap-1 text-emerald-400 text-xs font-mono">
                <CheckCircle className="w-3.5 h-3.5" />
                Human Approved
              </span>
            )}
          </div>

          <textarea
            rows={5}
            value={draftResponse}
            onChange={(e) => setDraftResponse(e.target.value)}
            disabled={isResolved}
            placeholder="Agent approved customer response..."
            className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs leading-relaxed focus:outline-none focus:border-blue-500 disabled:opacity-75"
          />

          {!isResolved && (
            <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <input
                type="text"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Optional internal resolution audit notes..."
                className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleResolve}
                disabled={isResolving}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isResolving ? "Resolving..." : "Approve & Resolve Ticket"}</span>
              </button>
            </div>
          )}

          {isResolved && ticket.resolution_text && (
            <div className="mt-3 p-3 rounded bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300">
              <span className="font-bold block mb-1">Official Resolution Sent to Customer:</span>
              {ticket.resolution_text}
            </div>
          )}
        </div>

        {/* SOC 2 / HIPAA Audit Log Trail */}
        <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Immutable SOC 2 / HIPAA Audit Trail ({auditLogs.length})
            </h3>
          </div>

          {loadingLogs ? (
            <p className="text-xs text-slate-500">Loading audit history...</p>
          ) : auditLogs.length === 0 ? (
            <p className="text-xs text-slate-500">No operational audit records yet.</p>
          ) : (
            <div className="space-y-2 text-xs">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded bg-slate-900/60 border border-slate-800/80 flex items-start justify-between gap-3 font-mono"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-400 font-bold text-[10px]">
                        {log.action}
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        Agent: <span className="text-slate-200">{log.agent_id.slice(0, 16)}</span>
                      </span>
                    </div>
                    {log.reason && (
                      <p className="text-slate-300 font-sans text-xs mt-1">
                        Reason: {log.reason}
                      </p>
                    )}
                  </div>
                  <span className="text-slate-500 text-[10px] shrink-0">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
