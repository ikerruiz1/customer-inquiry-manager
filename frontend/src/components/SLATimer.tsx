import React, { useEffect, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";

interface SLATimerProps {
  deadlineIso: string;
  initialRemainingSeconds?: number;
}

export const SLATimer: React.FC<SLATimerProps> = ({ deadlineIso, initialRemainingSeconds }) => {
  const [remaining, setRemaining] = useState<number>(() => {
    if (initialRemainingSeconds !== undefined) return initialRemainingSeconds;
    const diff = Math.floor((new Date(deadlineIso).getTime() - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Math.floor((new Date(deadlineIso).getTime() - Date.now()) / 1000);
      setRemaining(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [deadlineIso]);

  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-950/80 border border-red-800 text-red-400 text-xs font-semibold font-mono animate-pulse">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>SLA BREACHED</span>
      </span>
    );
  }

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  const isImminent = remaining < 1800; // < 30 mins
  const isUrgent = remaining < 7200; // < 2 hours

  let colorClass = "bg-slate-800/80 border-slate-700 text-slate-300";
  if (isImminent) {
    colorClass = "bg-red-900/40 border-red-600/70 text-red-300 sla-breaching";
  } else if (isUrgent) {
    colorClass = "bg-amber-900/40 border-amber-600/70 text-amber-300";
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-mono font-medium ${colorClass}`}>
      <Clock className="w-3 h-3 opacity-80" />
      <span>
        {hours > 0 ? `${hours}h ` : ""}
        {String(minutes).padStart(2, "0")}m {String(seconds).padStart(2, "0")}s
      </span>
    </span>
  );
};
