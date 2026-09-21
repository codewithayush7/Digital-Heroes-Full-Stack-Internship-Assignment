"use client";

import { useState, useRef } from "react";
import { submitWinnerProofAction } from "@/app/actions/winner";
import type { UserWinnerWithDraw } from "@/lib/services/draw.service";
import {
  X,
  Upload,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trophy,
  AlertTriangle,
} from "lucide-react";

interface SubmitProofModalProps {
  isOpen: boolean;
  winner: UserWinnerWithDraw | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SubmitProofModal({
  isOpen,
  winner,
  onClose,
  onSuccess,
}: SubmitProofModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !winner) return null;

  const isResubmission = winner.verification_status === "rejected";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setError(null);

    // Validate size (5 MB)
    if (selected.size > 5 * 1024 * 1024) {
      setError("Image file size exceeds 5 MB limit.");
      return;
    }

    // Validate type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(selected.type)) {
      setError("Only JPEG, PNG, and WebP images are allowed.");
      return;
    }

    setFile(selected);
    const url = URL.createObjectURL(selected);
    setPreviewUrl(url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!winner || !file) {
      setError("Please select a scorecard screenshot to upload.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("winnerId", winner.id);
      formData.set("proofFile", file);

      const result = await submitWinnerProofAction(formData);

      if (result.error) {
        setError(result.error);
      } else {
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload proof.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl space-y-0">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isResubmission ? "Resubmit Scorecard Proof" : "Submit Scorecard Proof"}
              </h3>
              <p className="text-xs text-slate-400">
                Upload screenshot of your official golf scorecard
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Previous Rejection Notes Alert if Resubmitting */}
          {isResubmission && winner.admin_notes && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                <span>Admin Rejection Feedback:</span>
              </div>
              <p className="text-slate-300 italic pl-5">&quot;{winner.admin_notes}&quot;</p>
              <p className="text-[11px] text-slate-400 pl-5">
                Please review the feedback and upload an updated, clear photo or digital scorecard.
              </p>
            </div>
          )}

          {/* Prize Context Card */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
            <div className="space-y-0.5">
              <span className="text-slate-400">Draw & Tier</span>
              <div className="font-semibold text-white flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5 text-amber-400" />
                <span>{winner.draw?.title || "Official Draw"}</span>
              </div>
            </div>
            <div className="text-right space-y-0.5">
              <span className="text-slate-400">Prize Won</span>
              <div className="font-bold font-mono text-emerald-400 text-sm">
                ${Number(winner.prize_amount).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>

          {/* File Upload Dropzone */}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {previewUrl ? (
              <div className="relative rounded-xl border border-slate-800 bg-slate-950 overflow-hidden group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Scorecard Preview"
                  className="w-full max-h-56 object-contain"
                />
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute top-2 right-2 p-1 rounded-lg bg-black/70 text-white hover:bg-black transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-slate-800 hover:border-amber-400/50 rounded-xl p-6 text-center space-y-2 transition bg-slate-950/40 hover:bg-slate-950/70"
              >
                <div className="h-10 w-10 rounded-full bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
                  <ImageIcon className="h-5 w-5 text-amber-400" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-white">
                    Click to select scorecard screenshot
                  </p>
                  <p className="text-[11px] text-slate-500">
                    PNG, JPG, or WebP up to 5 MB
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Submission Instructions */}
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Ensure your screenshot clearly shows the play date, player name, and hole-by-hole scores
            matching your 5 submitted numbers for verification.
          </p>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !file}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-400 transition shadow-lg shadow-amber-950/20 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              <span>{isResubmission ? "Resubmit Proof" : "Submit for Verification"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
