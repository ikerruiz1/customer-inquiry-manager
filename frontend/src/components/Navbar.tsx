import React from "react";
import { ShieldCheck, Cpu, Database, Zap, UserCheck, LogOut, Radio } from "lucide-react";
import { OperatorProfile } from "../types";

interface NavbarProps {
  operator: OperatorProfile | null;
  onOpenSimulator: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  operator,
  onOpenSimulator,
  onOpenAuth,
  onLogout,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand & Topology Status */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">
                  ExampleCorp CIM
                </span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Bedrock Haiku 4.5
                </span>
              </div>
              <p className="text-xs text-slate-400">Enterprise AI Triage & HITL Operations Console</p>
            </div>
          </div>

          {/* Infrastructure Health Badges */}
          <div className="hidden lg:flex items-center gap-2.5 text-xs text-slate-400 border-l border-slate-800 pl-6">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/60 border border-slate-700/50">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              <span>Fargate Spot (Dual-Container)</span>
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/60 border border-slate-700/50">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>RDS PostgreSQL 16 (Isolated)</span>
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/60 border border-slate-700/50">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero-Egress PrivateLink</span>
            </span>
          </div>
        </div>

        {/* Right Actions & Operator Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSimulator}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse text-indigo-200" />
            <span>Omnichannel Simulator</span>
          </button>

          {operator ? (
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/70 text-xs">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <div className="flex flex-col text-left">
                  <span className="text-white font-medium truncate max-w-[140px]">
                    {operator.email}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {operator.groups.includes("Operations_Managers") ? "Operations Manager" : "Tier 1 Agent"} (TOTP Active)
                  </span>
                </div>
              </div>
              <button
                onClick={onLogout}
                title="Sign out"
                className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 transition cursor-pointer"
            >
              Sign In (Cognito MFA)
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
