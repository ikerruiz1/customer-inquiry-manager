import React, { useState } from "react";
import { X, Send, Mail, Globe, Star, DollarSign, Sparkles, Check } from "lucide-react";
import { triggerWebhook } from "../services/api";
import { Inquiry } from "../types";

interface OmnichannelSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  onInquiryCreated: (inquiry: Inquiry) => void;
}

type TabType = "email" | "webform" | "trustpilot" | "google-reviews" | "billing";

export const OmnichannelSimulator: React.FC<OmnichannelSimulatorProps> = ({
  isOpen,
  onClose,
  onInquiryCreated,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("email");
  const [loading, setLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [emailSender, setEmailSender] = useState("cto@enterprise-client.com");
  const [emailName, setEmailName] = useState("Alexandre Dupont");
  const [emailSubject, setEmailSubject] = useState("EMERGENCY: Complete API Gateway Outage in Frankfurt");
  const [emailBody, setEmailBody] = useState(
    "Our production workloads in eu-central-1 cannot connect to your API gateway. Latency spiked to 12,000ms and now returning 502/504 errors. We have SLAs with our financial customers!"
  );

  const [stars, setStars] = useState(1);
  const [reviewTitle, setReviewTitle] = useState("Terrible reliability and non-existent support");
  const [reviewBody, setReviewBody] = useState(
    "We signed an annual Enterprise contract. Service has been down 3 times this month. If this is not resolved today we are filing a chargeback and cancelling all accounts."
  );

  const [disputeAmount, setDisputeAmount] = useState("1250.00");
  const [disputeReason, setDisputeReason] = useState("fraudulent");

  if (!isOpen) return null;

  const handleDispatch = async () => {
    setLoading(true);
    setSuccessMessage(null);
    try {
      let result: Inquiry;
      if (activeTab === "email") {
        result = await triggerWebhook("email", {
          from: emailSender,
          name: emailName,
          subject: emailSubject,
          text: emailBody,
        });
      } else if (activeTab === "webform") {
        result = await triggerWebhook("webform", {
          channel: "WEB_FORM",
          customer_email: emailSender,
          customer_name: emailName,
          subject: emailSubject,
          body: emailBody,
        });
      } else if (activeTab === "trustpilot") {
        result = await triggerWebhook("trustpilot", {
          stars: stars,
          title: reviewTitle,
          text: reviewBody,
          consumer: { email: emailSender, name: emailName },
        });
      } else if (activeTab === "google-reviews") {
        result = await triggerWebhook("google-reviews", {
          starRating: stars,
          comment: reviewBody,
          reviewer: { displayName: emailName, email: emailSender },
        });
      } else {
        result = await triggerWebhook("billing", {
          type: "charge.dispute.created",
          data: {
            object: {
              id: `disp_${Math.random().toString(36).substring(7)}`,
              amount: Math.round(parseFloat(disputeAmount) * 100),
              currency: "eur",
              reason: disputeReason,
              billing_details: { email: emailSender },
            },
          },
        });
      }

      onInquiryCreated(result);
      setSuccessMessage(`Ticket created! Assigned Priority: ${result.priority} (${result.department})`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Webhook error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (type: "p1_outage" | "churn_threat" | "security_incident") => {
    if (type === "p1_outage") {
      setActiveTab("email");
      setEmailSubject("CRITICAL: Primary database connection pool exhausted");
      setEmailBody("All transactions are dropping with connection timeout. Production cluster down. Immediate assistance requested under P1 Gold SLA.");
    } else if (type === "churn_threat") {
      setActiveTab("trustpilot");
      setStars(1);
      setReviewTitle("Worst customer experience, will never renew");
      setReviewBody("Support took 3 days to answer our ticket. We are terminating our subscription immediately and demanding a full refund.");
    } else {
      setActiveTab("webform");
      setEmailSubject("URGENT: Exposed S3 bucket credentials found in client bundle");
      setEmailBody("Our penetration testing team identified unauthenticated read/write access to public attachment buckets. Please revoke IAM keys immediately.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-white">Omnichannel Ingestion Simulator</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Simulate incoming customer inquiries across all 5 inbound webhooks to validate Bedrock triage.
        </p>

        {/* Preset scenario shortcuts */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-500 text-[11px] shrink-0">Presets:</span>
          <button
            onClick={() => applyPreset("p1_outage")}
            className="px-2.5 py-1 rounded bg-rose-950/80 border border-rose-800 text-rose-300 shrink-0 hover:bg-rose-900/80 transition"
          >
            P1 Outage (1h SLA)
          </button>
          <button
            onClick={() => applyPreset("churn_threat")}
            className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-800 text-amber-300 shrink-0 hover:bg-amber-900/80 transition"
          >
            Churn Risk (Trustpilot)
          </button>
          <button
            onClick={() => applyPreset("security_incident")}
            className="px-2.5 py-1 rounded bg-blue-950/80 border border-blue-800 text-blue-300 shrink-0 hover:bg-blue-900/80 transition"
          >
            Security Escalation
          </button>
        </div>

        {/* Channel Tabs */}
        <div className="flex border-b border-slate-800 mb-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("email")}
            className={`flex items-center gap-1.5 pb-2 px-3 border-b-2 transition ${
              activeTab === "email" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Mail className="w-3.5 h-3.5" /> Email
          </button>
          <button
            onClick={() => setActiveTab("webform")}
            className={`flex items-center gap-1.5 pb-2 px-3 border-b-2 transition ${
              activeTab === "webform" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> Web Form
          </button>
          <button
            onClick={() => setActiveTab("trustpilot")}
            className={`flex items-center gap-1.5 pb-2 px-3 border-b-2 transition ${
              activeTab === "trustpilot" ? "border-amber-500 text-amber-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Star className="w-3.5 h-3.5" /> Trustpilot
          </button>
          <button
            onClick={() => setActiveTab("google-reviews")}
            className={`flex items-center gap-1.5 pb-2 px-3 border-b-2 transition ${
              activeTab === "google-reviews" ? "border-blue-400 text-blue-300" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Star className="w-3.5 h-3.5" /> Google Reviews
          </button>
          <button
            onClick={() => setActiveTab("billing")}
            className={`flex items-center gap-1.5 pb-2 px-3 border-b-2 transition ${
              activeTab === "billing" ? "border-rose-500 text-rose-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" /> Stripe Billing
          </button>
        </div>

        {/* Inputs */}
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Customer Email</label>
              <input
                type="email"
                value={emailSender}
                onChange={(e) => setEmailSender(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Customer Name</label>
              <input
                type="text"
                value={emailName}
                onChange={(e) => setEmailName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white"
              />
            </div>
          </div>

          {(activeTab === "trustpilot" || activeTab === "google-reviews") && (
            <div>
              <label className="block text-slate-400 mb-1">Star Rating (1 to 5)</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStars(s)}
                    className={`px-3 py-1 rounded font-bold ${
                      stars === s ? "bg-amber-500 text-black" : "bg-slate-800 text-slate-400 border border-slate-700"
                    }`}
                  >
                    {s}★
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === "billing" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Disputed Amount (EUR)</label>
                <input
                  type="number"
                  value={disputeAmount}
                  onChange={(e) => setDisputeAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Dispute Reason</label>
                <select
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                >
                  <option value="fraudulent">Fraudulent</option>
                  <option value="duplicate">Duplicate Charge</option>
                  <option value="unrecognized">Unrecognized</option>
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-slate-400 mb-1">
                {activeTab === "trustpilot" ? "Review Title" : "Subject"}
              </label>
              <input
                type="text"
                value={activeTab === "trustpilot" ? reviewTitle : emailSubject}
                onChange={(e) =>
                  activeTab === "trustpilot" ? setReviewTitle(e.target.value) : setEmailSubject(e.target.value)
                }
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white"
              />
            </div>
          )}

          {activeTab !== "billing" && (
            <div>
              <label className="block text-slate-400 mb-1">Message Content / Review Text</label>
              <textarea
                rows={4}
                value={activeTab === "trustpilot" || activeTab === "google-reviews" ? reviewBody : emailBody}
                onChange={(e) =>
                  activeTab === "trustpilot" || activeTab === "google-reviews"
                    ? setReviewBody(e.target.value)
                    : setEmailBody(e.target.value)
                }
                className="w-full bg-slate-800 border border-slate-700 rounded p-2.5 text-white"
              />
            </div>
          )}
        </div>

        {successMessage && (
          <div className="mt-3 p-2.5 rounded bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleDispatch}
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{loading ? "Triaging with Bedrock..." : "Dispatch Webhook"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
