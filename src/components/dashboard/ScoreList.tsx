"use client";

import { useState } from "react";
import type { GolfScore } from "@/lib/services/score.service";
import { deleteScoreAction, updateScoreAction } from "@/app/actions/score";
import { formatDate } from "@/lib/utils";
import { SCORE_MIN, SCORE_MAX } from "@/lib/config/constants";
import { Edit2, Trash2, Calendar, Check, X, AlertCircle } from "lucide-react";

export function ScoreList({ scores }: { scores: GolfScore[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState<number>(36);
  const [editDate, setEditDate] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startEdit = (score: GolfScore) => {
    setEditingId(score.id);
    setEditScore(score.score);
    setEditDate(score.played_date);
    setErrorMessage(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setErrorMessage(null);
  };

  const handleSaveEdit = async (scoreId: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("scoreId", scoreId);
    formData.append("score", editScore.toString());
    formData.append("playedDate", editDate);

    const res = await updateScoreAction(null, formData);
    setIsSubmitting(false);

    if (res?.error) {
      setErrorMessage(res.error);
    } else {
      setEditingId(null);
    }
  };

  const handleDelete = async (scoreId: string) => {
    if (!confirm("Are you sure you want to delete this score?")) {
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    const res = await deleteScoreAction(scoreId);
    setIsSubmitting(false);

    if (res?.error) {
      setErrorMessage(res.error);
    }
  };

  return (
    <div className="glass-panel rounded-xl p-5 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <h3 className="text-sm font-semibold text-white">
          Retained Scores (Newest First)
        </h3>
        <span className="text-xs text-slate-400">
          Showing {scores.length} of 5 max
        </span>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
          <p>{errorMessage}</p>
        </div>
      )}

      {scores.length === 0 ? (
        <div className="text-center py-8 space-y-2 text-slate-400">
          <Calendar className="h-8 w-8 mx-auto text-slate-600" />
          <p className="text-xs">No golf scores recorded yet.</p>
          <p className="text-[11px] text-slate-500">
            Enter your last 5 Stableford scores above to qualify for monthly draws.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/60">
          {scores.map((s, index) => {
            const isEditing = editingId === s.id;

            return (
              <div
                key={s.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {isEditing ? (
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase font-semibold">
                        Score ({SCORE_MIN}–{SCORE_MAX})
                      </label>
                      <input
                        type="number"
                        min={SCORE_MIN}
                        max={SCORE_MAX}
                        value={editScore}
                        onChange={(e) => setEditScore(Number(e.target.value))}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase font-semibold">
                        Played Date
                      </label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-slate-400 border border-slate-700">
                      #{index + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-amber-400">
                          {s.score} pts
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          Stableford
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Calendar className="h-3 w-3 text-slate-500" />
                        <span>{formatDate(s.played_date)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleSaveEdit(s.id)}
                        className="inline-flex items-center gap-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 text-xs font-medium transition disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" />
                        <span>Save</span>
                      </button>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={cancelEdit}
                        className="inline-flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 text-xs font-medium transition"
                      >
                        <X className="h-3 w-3" />
                        <span>Cancel</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-300 px-2.5 py-1 text-xs font-medium transition"
                      >
                        <Edit2 className="h-3 w-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleDelete(s.id)}
                        className="inline-flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 px-2.5 py-1 text-xs font-medium transition disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
