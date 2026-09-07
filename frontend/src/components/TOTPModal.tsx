import React, { useState } from "react";
import { ShieldCheck, Lock, X, AlertCircle } from "lucide-react";
import { login, verifyMFA } from "../services/api";
import { MFAChallenge, OperatorProfile } from "../types";

interface TOTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (profile: OperatorProfile) => void;
}

export const TOTPModal: React.FC<TOTPModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [username, setUsername] = useState("lead.agent@enterprise.com");
  const [password, setPassword] = useState("Password123!");
  const [totpCode, setTotpCode] = useState("");
  const [mfaChallenge, setMfaChallenge] = useState<MFAChallenge | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await login(username, password);
      if (res.mfa) {
        setMfaChallenge(res.mfa);
      } else {
        // Direct login success (e.g. dev mode)
        onAuthSuccess({
          sub: "00000000-0000-0000-0000-000000000001",
          email: username,
          groups: ["Tier1_Agents", "Operations_Managers"],
        });
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge) return;
    setLoading(true);
    setError(null);
    try {
      await verifyMFA(mfaChallenge.session, totpCode);
      onAuthSuccess({
        sub: "00000000-0000-0000-0000-000000000001",
        email: username,
        groups: ["Operations_Managers", "Tier1_Agents"],
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Invalid TOTP code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Amazon Cognito Authentication</h2>
            <p className="text-xs text-slate-400 font-mono">RFC 6238 Software Token MFA</p>
          </div>
        </div>

        {error && (
          <div className="my-3 p-3 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {!mfaChallenge ? (
          <form onSubmit={handleLogin} className="space-y-3.5 mt-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Operator Username / Corporate Email</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Master Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Initiate Login Challenge"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyTOTP} className="space-y-4 mt-4 text-xs">
            <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-900/60 text-blue-300 text-xs">
              <span className="font-semibold block mb-1">MFA Challenge Active:</span>
              Open your Authenticator app (1Password, Google Authenticator) and enter the 6-digit code.
            </div>

            <div>
              <label className="block text-slate-400 mb-1">6-Digit Software Token (TOTP)</label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="123456"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-center text-lg tracking-widest font-mono text-white focus:outline-none focus:border-blue-500"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || totpCode.length !== 6}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? "Verifying TOTP..." : "Verify Token & Authorize Session"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
