"use client";

import { useState, useEffect } from "react";
import {
  getWinnerVerificationContextAction,
  getWinnerProofSignedUrlAction,
  reviewWinnerProofAction,
} from "@/app/actions/winner";
import type { WinnerVerificationContext } from "@/lib/services/winner.service";
import {
  X,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Calendar,
  Loader2,
  Trophy,
} from "lucide-react";

interface AdminWinnerReviewModalProps {
  isOpen: boolean;
  winnerId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ReviewModalContentProps {
  winnerId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

function ReviewModalContent({
  winnerId,
  onClose,
  onSuccess,
}: ReviewModalContentProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const [context, setContext] = useState<WinnerVerificationContext | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      getWinnerVerificationContextAction(winnerId),
      getWinnerProofSignedUrlAction(winnerId),
    ])
      .then(([contextRes, urlRes]) => {
        if (!isMounted) return;

        if (contextRes.error) {
          setError(contextRes.error);
        } else if (contextRes.data) {
          setContext(contextRes.data);
          if (contextRes.data.winner.admin_notes) {
            setAdminNotes(contextRes.data.winner.admin_notes);
          }
        }

        if (urlRes.data?.signedUrl) {
          setSignedUrl(urlRes.data.signedUrl);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load verification context");
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [winnerId]);

  async function handleDecision(action: "approve" | "reject") {
    if (action === "reject" && (!adminNotes || adminNotes.trim().length < 3)) {
      setError("Please provide a rejection reason in the admin notes (minimum 3 characters).");
      return;
    }

    setSubmitting(action);
    setError(null);

    try {
      const result = await reviewWinnerProofAction({
        winnerId,
        action,
        notes: adminNotes.trim() || undefined,
      });

      if (result.error) {
        setError(result.error);
      } else {
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSubmitting(null);
    }
  }

  const drawnNumbers = context?.draw?.drawn_numbers ?? [];
  const snapshotScores = context?.drawEntry?.scores_snapshot ?? [];
  const matchedNumbers = context?.drawEntry?.matched_numbers ?? [];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Score Proof Verification Review</h3>
            <p className="text-xs text-slate-400">
              Inspect golfer scorecard screenshot against draw numbers and recorded snapshot
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6 flex-1">
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-400" />
            <p className="text-xs text-slate-400">Loading winner proof and scorecard snapshot...</p>
          </div>
        ) : context ? (
          <>
            {/* Winner & Draw Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400">Golfer</span>
                <div className="font-bold text-sm text-white">
                  {context.profile?.full_name || "Anonymous Golfer"}
                </div>
                <div className="text-slate-400 font-mono text-[11px]">
                  {context.profile?.email || context.winner.user_id}
                </div>
              </div>

              <div className="space-y-1 sm:text-right">
                <span className="text-slate-400">Prize & Tier</span>
                <div className="font-bold font-mono text-base text-emerald-400">
                  ₹{Number(context.winner.prize_amount).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </div>
                <div className="text-slate-400 capitalize">
                  {context.winner.tier.replace("_", " ")} ({context.drawEntry?.matches_count ?? 0} matches)
                </div>
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1">
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  <span>{context.draw?.title || "Official Draw"}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {context.draw?.draw_date
                      ? new Date(context.draw.draw_date).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Concluded"}
                  </span>
                </span>
              </div>
            </div>

            {/* Number Comparison Board */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/40 border border-slate-800">
              <div className="text-xs font-semibold text-slate-300">
                Authoritative Numbers Comparison
              </div>

              {/* Winning Drawn Numbers */}
              <div className="space-y-1.5">
                <div className="text-[11px] text-amber-400 font-medium uppercase tracking-wider">
                  Official Drawn Numbers:
                </div>
                <div className="flex items-center gap-2">
                  {drawnNumbers.map((num, idx) => (
                    <div
                      key={idx}
                      className="h-8 w-8 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold font-mono text-sm flex items-center justify-center shadow-inner"
                    >
                      {num}
                    </div>
                  ))}
                </div>
              </div>

              {/* Golfer Snapshot Scores */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                <div className="text-[11px] text-slate-400 font-medium">
                  Golfer 5-Score Snapshot (Green = Matched):
                </div>
                <div className="flex items-center gap-2">
                  {snapshotScores.map((score, idx) => {
                    const isMatch = matchedNumbers.includes(score);
                    return (
                      <div
                        key={idx}
                        className={`h-8 w-8 rounded-lg font-bold font-mono text-sm flex items-center justify-center border ${
                          isMatch
                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm"
                            : "bg-slate-800/60 border-slate-700 text-slate-400"
                        }`}
                      >
                        {score}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Uploaded Scorecard Proof Image */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Golfer Submitted Score Proof
                </span>
                {signedUrl && (
                  <a
                    href={signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 font-medium"
                  >
                    <span>Open Full Size</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {signedUrl ? (
                <div className="relative rounded-xl border border-slate-800 bg-slate-950 overflow-hidden max-h-72 flex items-center justify-center group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signedUrl}
                    alt="Golfer Score Proof"
                    className="w-full h-auto object-contain max-h-72 transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
              ) : (
                <div className="p-8 text-center rounded-xl border border-dashed border-slate-800 bg-slate-950/40 text-slate-500 text-xs">
                  No proof image uploaded yet.
                </div>
              )}
            </div>

            {/* Admin Review Notes Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="adminNotes"
                className="block text-xs font-semibold text-slate-300"
              >
                Review Notes / Audit Log
                <span className="text-slate-500 font-normal ml-1">
                  (Required on rejection, optional on approval)
                </span>
              </label>
              <textarea
                id="adminNotes"
                rows={3}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="e.g. Scorecard date and hole totals verified against club system."
                className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400 transition resize-none"
              />
            </div>
          </>
        ) : null}
      </div>

      {/* Action Buttons */}
      <div className="p-5 border-t border-slate-800 bg-slate-900/95 sticky bottom-0 flex items-center justify-end gap-3 z-10">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting !== null}
          className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={() => handleDecision("reject")}
          disabled={submitting !== null || loading || !context}
          className="px-4 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 transition inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {submitting === "reject" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          <span>Reject Proof</span>
        </button>

        <button
          type="button"
          onClick={() => handleDecision("approve")}
          disabled={submitting !== null || loading || !context}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/30 transition shadow-lg shadow-emerald-900/20 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {submitting === "approve" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          <span>Approve & Verify</span>
        </button>
      </div>
    </div>
  );
}

export function AdminWinnerReviewModal({
  isOpen,
  winnerId,
  onClose,
  onSuccess,
}: AdminWinnerReviewModalProps) {
  if (!isOpen || !winnerId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <ReviewModalContent
        winnerId={winnerId}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </div>
  );
}
