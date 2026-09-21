"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Search,
  Sparkles,
  ExternalLink,
  Edit2,
  Trash2,
  Heart,
  AlertTriangle,
  Loader2,
  Plus,
} from "lucide-react";
import type { Tables } from "@/types/database.types";
import { formatCurrency } from "@/lib/utils";
import { toggleFeaturedCharityAction, deleteCharityAction } from "@/app/actions/charity";
import { AdminCharityModal } from "./AdminCharityModal";
import { CharityLogoImage } from "@/components/charity/CharityImage";

export type Charity = Tables<"charities">;

interface AdminCharityTableProps {
  charities: Charity[];
}

export function AdminCharityTable({ charities }: AdminCharityTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCharity, setEditingCharity] = useState<Charity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Deletion modal state
  const [deletingCharity, setDeletingCharity] = useState<Charity | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Toggle featured state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const filteredCharities = charities.filter((c) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.slug.toLowerCase().includes(term) ||
      (c.tagline && c.tagline.toLowerCase().includes(term))
    );
  });

  const handleToggleFeatured = async (charity: Charity) => {
    setTogglingId(charity.id);
    try {
      await toggleFeaturedCharityAction(charity.id, !charity.is_featured);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteConfirm = () => {
    if (!deletingCharity) return;
    setDeleteError(null);

    startDeleteTransition(async () => {
      const res = await deleteCharityAction(deletingCharity.id);
      if (res.error) {
        setDeleteError(res.error);
      } else {
        setDeletingCharity(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter partners by name, slug..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
          />
        </div>

        {/* Add Charity Button */}
        <button
          type="button"
          onClick={() => {
            setEditingCharity(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Add Partner Charity</span>
        </button>
      </div>

      {/* Table Card */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Partner</th>
                <th className="py-3.5 px-4 font-semibold">Mission & Tagline</th>
                <th className="py-3.5 px-4 font-semibold text-right">
                  Total Raised
                </th>
                <th className="py-3.5 px-4 font-semibold text-center">
                  Featured
                </th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredCharities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <Heart className="h-8 w-8 mx-auto text-slate-600 mb-2" />
                    <p className="text-xs font-medium text-slate-400">
                      No partner charities found matching criteria.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCharities.map((charity) => {
                  const isToggling = togglingId === charity.id;

                  return (
                    <tr
                      key={charity.id}
                      className="hover:bg-slate-800/30 transition group"
                    >
                      {/* Name & Logo */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                            <CharityLogoImage
                              src={charity.logo_url}
                              name={charity.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm">
                              {charity.name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-[11px] text-slate-400">
                                /{charity.slug}
                              </span>
                              <Link
                                href={`/charities/${charity.slug}`}
                                target="_blank"
                                className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-0.5"
                                title="Preview public profile"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Tagline & Snippet */}
                      <td className="py-4 px-4 max-w-xs">
                        {charity.tagline ? (
                          <div className="font-medium text-slate-200 truncate">
                            {charity.tagline}
                          </div>
                        ) : null}
                        <div className="text-[11px] text-slate-400 line-clamp-2">
                          {charity.description}
                        </div>
                      </td>

                      {/* Funds Raised */}
                      <td className="py-4 px-4 text-right">
                        <div className="font-bold text-emerald-400 text-sm">
                          {formatCurrency(Number(charity.total_funds_raised))}
                        </div>
                      </td>

                      {/* Featured Toggle */}
                      <td className="py-4 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleFeatured(charity)}
                          disabled={isToggling}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition border ${
                            charity.is_featured
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
                          } disabled:opacity-50`}
                          title="Click to toggle featured status"
                        >
                          {isToggling ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles
                              className={`h-3 w-3 ${
                                charity.is_featured
                                  ? "fill-current text-emerald-400"
                                  : "text-slate-500"
                              }`}
                            />
                          )}
                          <span>
                            {charity.is_featured ? "Featured" : "Standard"}
                          </span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCharity(charity);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white transition"
                            title="Edit charity details"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null);
                              setDeletingCharity(charity);
                            }}
                            className="p-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition"
                            title="Delete partner charity"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Create Modal */}
      {isModalOpen && (
        <AdminCharityModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingCharity(null);
          }}
          charity={editingCharity}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingCharity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Delete Partner Charity?
                </h3>
                <p className="text-xs text-slate-400">
                  Confirm permanent removal of &apos;{deletingCharity.name}&apos;
                </p>
              </div>
            </div>

            {/* Destruction Warning */}
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 space-y-2 text-xs text-rose-200">
              <p className="font-semibold text-rose-300">
                PostgreSQL Cascade & Foreign Key Notice:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-rose-200/90">
                <li>
                  <strong>Donor Profiles:</strong> Subscribers supporting this
                  charity will have their designated charity reset to{" "}
                  <code>NULL</code> (their subscription and contribution % remain
                  active).
                </li>
                <li>
                  <strong>Charity Events:</strong> All associated golf days and
                  events will be <strong>permanently deleted</strong>.
                </li>
                <li>
                  <strong>Donation Records:</strong> Historic allocation records
                  for this partner will be <strong>permanently deleted</strong>.
                </li>
              </ul>
            </div>

            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-500/20 text-rose-300 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCharity(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-lg shadow-rose-600/20 disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
