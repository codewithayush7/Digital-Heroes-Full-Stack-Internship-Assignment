"use client";

import { useState, useTransition } from "react";
import { X, AlertTriangle, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import type { AdminUserListItem, CharityRow } from "@/lib/services/admin.service";
import {
  updateUserProfileAction,
  updateUserRoleAction,
} from "@/app/actions/admin-user";

interface AdminUserEditModalProps {
  user: AdminUserListItem;
  charities: CharityRow[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AdminUserEditModal({
  user,
  charities,
  isOpen,
  onClose,
  onSuccess,
}: AdminUserEditModalProps) {
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [charityId, setCharityId] = useState(user.charity_id ?? "");
  const [contributionPct, setContributionPct] = useState(
    user.charity_contribution_pct || 10
  );
  const [role, setRole] = useState<"admin" | "subscriber">(user.role);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      // 1. Update Profile Fields (full_name, charity_id, charity_contribution_pct)
      const formData = new FormData();
      formData.set("userId", user.id);
      formData.set("fullName", fullName);
      formData.set("charityId", charityId);
      formData.set("charityContributionPct", contributionPct.toString());

      const profileRes = await updateUserProfileAction(null, formData);
      if (profileRes.error) {
        setError(profileRes.error);
        return;
      }

      // 2. Update Role if changed
      if (role !== user.role) {
        const roleRes = await updateUserRoleAction(user.id, role);
        if (roleRes.error) {
          setError(`Profile updated, but role change failed: ${roleRes.error}`);
          return;
        }
      }

      setSuccessMessage("User profile updated successfully.");
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 750);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white">Edit User Profile</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Update user details and access privileges
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div>{successMessage}</div>
            </div>
          )}

          {/* Email (Read-Only) */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-400 cursor-not-allowed select-none"
              />
              <span className="absolute right-3 top-2.5 px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase rounded bg-slate-800 text-slate-400 border border-slate-700">
                Auth Immutable
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Primary email is managed by authentication and cannot be edited directly.
            </p>
          </div>

          {/* Full Name */}
          <div>
            <label
              htmlFor="fullName"
              className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2"
            >
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Tiger Woods"
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-4 py-2.5 text-sm text-white transition-colors"
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              System Role
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("subscriber")}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                  role === "subscriber"
                    ? "bg-sky-500/10 border-sky-500/50 text-sky-400 shadow-sm"
                    : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span>Subscriber</span>
              </button>
              <button
                type="button"
                onClick={() => setRole("admin")}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                  role === "admin"
                    ? "bg-purple-500/10 border-purple-500/50 text-purple-400 shadow-sm"
                    : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Administrator</span>
              </button>
            </div>
            {user.role === "admin" && role === "subscriber" && (
              <div className="mt-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  Demoting this admin will remove all administrative privileges. The last remaining administrator is protected from demotion.
                </span>
              </div>
            )}
          </div>

          {/* Designated Charity */}
          <div>
            <label
              htmlFor="charityId"
              className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2"
            >
              Designated Charity
            </label>
            <div className="relative">
              <select
                id="charityId"
                value={charityId}
                onChange={(e) => setCharityId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-4 py-2.5 text-sm text-white appearance-none transition-colors"
              >
                <option value="">No charity designated</option>
                {charities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Charity Contribution Percentage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="contributionPct"
                className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
              >
                Charity Contribution
              </label>
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {contributionPct}%
              </span>
            </div>
            <input
              id="contributionPct"
              type="range"
              min={10}
              max={100}
              step={5}
              value={contributionPct}
              onChange={(e) => setContributionPct(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>10% (Minimum)</span>
              <span>50%</span>
              <span>100% (Maximum)</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
