"use client";

import { useState, useEffect, useTransition } from "react";
import {
  X,
  User,
  Shield,
  Calendar,
  CreditCard,
  Heart,
  Trophy,
  AlertTriangle,
  Loader2,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
} from "lucide-react";
import type { AdminUserDetail } from "@/lib/services/admin.service";
import {
  getUserDetailAction,
  cancelUserSubscriptionAction,
  adminAddScoreAction,
  adminUpdateScoreAction,
  adminDeleteScoreAction,
} from "@/app/actions/admin-user";
import { formatCurrency } from "@/lib/utils";

interface AdminUserDetailModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

export function AdminUserDetailModal({
  userId,
  isOpen,
  onClose,
  onDataChanged,
}: AdminUserDetailModalProps) {
  if (!isOpen) return null;

  return (
    <DetailModalContent
      userId={userId}
      onClose={onClose}
      onDataChanged={onDataChanged}
    />
  );
}

function DetailModalContent({
  userId,
  onClose,
  onDataChanged,
}: {
  userId: string;
  onClose: () => void;
  onDataChanged?: () => void;
}) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Score Add Form state
  const [showAddScore, setShowAddScore] = useState(false);
  const [newScore, setNewScore] = useState("");
  const [newPlayedDate, setNewPlayedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Score Edit Form state
  const [editingScoreId, setEditingScoreId] = useState<string | null>(null);
  const [editScoreValue, setEditScoreValue] = useState("");

  // Transitions
  const [isActionPending, startActionTransition] = useTransition();

  const reloadDetail = async () => {
    const res = await getUserDetailAction(userId);
    if (res.error || !res.data) {
      setError(res.error ?? "Failed to load user details");
    } else {
      setDetail(res.data);
    }
  };

  useEffect(() => {
    let isMounted = true;
    getUserDetailAction(userId).then((res) => {
      if (!isMounted) return;
      if (res.error || !res.data) {
        setError(res.error ?? "Failed to load user details");
      } else {
        setDetail(res.data);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleCancelSubscription = (subId: string) => {
    if (
      !confirm(
        "Are you sure you want to schedule this subscription for cancellation at period end? Stripe will be updated first."
      )
    ) {
      return;
    }

    startActionTransition(async () => {
      setError(null);
      setSuccessMessage(null);
      const res = await cancelUserSubscriptionAction(subId);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccessMessage("Subscription scheduled for cancellation at period end.");
        await reloadDetail();
        onDataChanged?.();
      }
    });
  };

  const handleAddScore = (e: React.FormEvent) => {
    e.preventDefault();
    const scoreNum = parseInt(newScore, 10);
    if (isNaN(scoreNum) || scoreNum < 1 || scoreNum > 45) {
      setError("Score must be a valid integer between 1 and 45.");
      return;
    }

    startActionTransition(async () => {
      setError(null);
      setSuccessMessage(null);
      const res = await adminAddScoreAction(userId, {
        score: scoreNum,
        playedDate: newPlayedDate,
      });

      if (res.error) {
        setError(res.error);
      } else {
        setSuccessMessage("Score added successfully.");
        setShowAddScore(false);
        setNewScore("");
        await reloadDetail();
        onDataChanged?.();
      }
    });
  };

  const handleUpdateScore = (scoreId: string) => {
    const scoreNum = parseInt(editScoreValue, 10);
    if (isNaN(scoreNum) || scoreNum < 1 || scoreNum > 45) {
      setError("Score must be a valid integer between 1 and 45.");
      return;
    }

    startActionTransition(async () => {
      setError(null);
      setSuccessMessage(null);
      const res = await adminUpdateScoreAction(userId, scoreId, {
        score: scoreNum,
      });

      if (res.error) {
        setError(res.error);
      } else {
        setSuccessMessage("Score updated successfully.");
        setEditingScoreId(null);
        await reloadDetail();
        onDataChanged?.();
      }
    });
  };

  const handleDeleteScore = (scoreId: string) => {
    if (!confirm("Are you sure you want to delete this score?")) {
      return;
    }

    startActionTransition(async () => {
      setError(null);
      setSuccessMessage(null);
      const res = await adminDeleteScoreAction(userId, scoreId);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccessMessage("Score deleted successfully.");
        await reloadDetail();
        onDataChanged?.();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {detail?.profile.full_name || "User Details"}
              </h2>
              <p className="text-xs text-slate-400">
                {detail?.profile.email} • ID: {userId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
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

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-sm">Loading user account record...</p>
            </div>
          ) : detail ? (
            <>
              {/* Account Overview Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    <Shield className="w-4 h-4 text-purple-400" />
                    <span>Role</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        detail.profile.role === "admin"
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                      }`}
                    >
                      {detail.profile.role.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    <Heart className="w-4 h-4 text-rose-400" />
                    <span>Designated Charity</span>
                  </div>
                  <p className="text-sm font-medium text-white truncate">
                    {detail.charity ? detail.charity.name : "None Designated"}
                  </p>
                  <p className="text-xs text-amber-400 mt-0.5">
                    {detail.profile.charity_contribution_pct}% contribution
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <span>Joined Date</span>
                  </div>
                  <p className="text-sm font-medium text-white">
                    {new Date(detail.profile.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Updated: {new Date(detail.profile.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* 1:N Complete Subscription History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Subscription History ({detail.subscriptions.length})
                    </h3>
                  </div>
                </div>

                {detail.subscriptions.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-slate-500 text-sm">
                    No subscriptions recorded for this user.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950 text-slate-400">
                          <th className="p-3">Plan</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Amount</th>
                          <th className="p-3">Current Period</th>
                          <th className="p-3">Auto-Renew</th>
                          <th className="p-3">Stripe Sub ID</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {detail.subscriptions.map((sub) => {
                          const isActive =
                            (sub.status === "active" || sub.status === "trialing") &&
                            sub.current_period_end !== null &&
                            new Date(sub.current_period_end) > new Date();

                          return (
                            <tr key={sub.id} className="hover:bg-slate-800/30">
                              <td className="p-3 font-semibold text-white capitalize">
                                {sub.plan_type}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                                    isActive
                                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                      : sub.status === "canceled"
                                      ? "bg-slate-700/50 text-slate-400"
                                      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                  }`}
                                >
                                  {sub.status}
                                </span>
                              </td>
                              <td className="p-3 text-slate-300 font-medium">
                                {formatCurrency(Number(sub.amount), sub.currency)}
                              </td>
                              <td className="p-3 text-slate-400">
                                {sub.current_period_start
                                  ? new Date(sub.current_period_start).toLocaleDateString()
                                  : "N/A"}{" "}
                                -{" "}
                                {sub.current_period_end
                                  ? new Date(sub.current_period_end).toLocaleDateString()
                                  : "N/A"}
                              </td>
                              <td className="p-3">
                                {sub.cancel_at_period_end ? (
                                  <span className="text-amber-400 font-medium">
                                    Cancels at end
                                  </span>
                                ) : (
                                  <span className="text-emerald-400 font-medium">
                                    Active (Renews)
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-mono text-[11px] text-slate-400">
                                {sub.stripe_subscription_id}
                              </td>
                              <td className="p-3 text-right">
                                {isActive && !sub.cancel_at_period_end && (
                                  <button
                                    onClick={() => handleCancelSubscription(sub.id)}
                                    disabled={isActionPending}
                                    className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 text-[11px] font-medium transition-colors"
                                  >
                                    Cancel at End
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Retained Golf Scores (PRD: Up to 5) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Retained Golf Scores ({detail.scores.length} / 5)
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowAddScore(!showAddScore)}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Score</span>
                  </button>
                </div>

                {/* Score Policy Explanatory Note */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Only the latest 5 scores are retained (1-45 Stableford range). Older dates never displace newer retained scores.
                  </span>
                </div>

                {/* Inline Add Score Form */}
                {showAddScore && (
                  <form
                    onSubmit={handleAddScore}
                    className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 flex flex-wrap items-end gap-3 animate-in fade-in duration-150"
                  >
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Score (1-45)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={45}
                        required
                        value={newScore}
                        onChange={(e) => setNewScore(e.target.value)}
                        placeholder="e.g. 36"
                        className="w-28 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Played Date
                      </label>
                      <input
                        type="date"
                        required
                        value={newPlayedDate}
                        onChange={(e) => setNewPlayedDate(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isActionPending}
                        className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors"
                      >
                        Save Score
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddScore(false)}
                        className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {detail.scores.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-slate-500 text-sm">
                    No golf scores logged for this user yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950 text-slate-400">
                          <th className="p-3">Rank</th>
                          <th className="p-3">Played Date</th>
                          <th className="p-3">Score (Stableford)</th>
                          <th className="p-3">Logged Date</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {detail.scores.map((sc, index) => (
                          <tr key={sc.id} className="hover:bg-slate-800/30">
                            <td className="p-3 font-semibold text-amber-400">
                              #{index + 1}
                            </td>
                            <td className="p-3 text-white font-medium">
                              {sc.played_date}
                            </td>
                            <td className="p-3">
                              {editingScoreId === sc.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={1}
                                    max={45}
                                    value={editScoreValue}
                                    onChange={(e) => setEditScoreValue(e.target.value)}
                                    className="w-20 bg-slate-900 border border-amber-500 rounded px-2 py-0.5 text-xs text-white"
                                  />
                                  <button
                                    onClick={() => handleUpdateScore(sc.id)}
                                    disabled={isActionPending}
                                    className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px]"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingScoreId(null)}
                                    className="text-slate-400 hover:text-white text-[11px]"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <span className="font-bold text-white text-sm">
                                  {sc.score} pts
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-slate-500">
                              {new Date(sc.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {editingScoreId !== sc.id && (
                                  <button
                                    onClick={() => {
                                      setEditingScoreId(sc.id);
                                      setEditScoreValue(sc.score.toString());
                                    }}
                                    className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                                    title="Edit Score"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteScore(sc.id)}
                                  disabled={isActionPending}
                                  className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                                  title="Delete Score"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
