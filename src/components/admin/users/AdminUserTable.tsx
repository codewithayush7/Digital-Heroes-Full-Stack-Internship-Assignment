"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Shield,
  User,
  Heart,
  Eye,
  Edit2,
  Filter,
} from "lucide-react";
import type { AdminUserListItem, CharityRow } from "@/lib/services/admin.service";
import { AdminUserDetailModal } from "./AdminUserDetailModal";
import { AdminUserEditModal } from "./AdminUserEditModal";
import { useRouter } from "next/navigation";

interface AdminUserTableProps {
  users: AdminUserListItem[];
  charities: CharityRow[];
}

export function AdminUserTable({ users, charities }: AdminUserTableProps) {
  const router = useRouter();

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [subStatusFilter, setSubStatusFilter] = useState<string>("all");

  // Modal states
  const [selectedDetailUserId, setSelectedDetailUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUserListItem | null>(null);

  // In-memory filtering
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // 1. Role filter
      if (roleFilter !== "all" && u.role !== roleFilter) {
        return false;
      }

      // 2. Subscription status filter
      if (subStatusFilter !== "all") {
        if (subStatusFilter === "none" && u.current_subscription !== null) {
          return false;
        }
        if (subStatusFilter !== "none") {
          if (!u.current_subscription) return false;
          if (u.current_subscription.status !== subStatusFilter) return false;
        }
      }

      // 3. Search filter (email or full_name)
      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase().trim();
        const matchesEmail = u.email.toLowerCase().includes(query);
        const matchesName = u.full_name?.toLowerCase().includes(query) ?? false;
        if (!matchesEmail && !matchesName) return false;
      }

      return true;
    });
  }, [users, roleFilter, subStatusFilter, searchTerm]);

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* Control / Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 transition-colors"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-3">
          {/* Role Filter */}
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 appearance-none pr-8 cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="subscriber">Subscribers</option>
              <option value="admin">Administrators</option>
            </select>
            <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
          </div>

          {/* Subscription Status Filter */}
          <div className="relative">
            <select
              value={subStatusFilter}
              onChange={(e) => setSubStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 appearance-none pr-8 cursor-pointer"
            >
              <option value="all">All Subscriptions</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="canceled">Canceled</option>
              <option value="past_due">Past Due</option>
              <option value="none">No Subscription</option>
            </select>
            <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
                <th className="p-4">User</th>
                <th className="p-4">Role</th>
                <th className="p-4">Current Subscription</th>
                <th className="p-4">Designated Charity</th>
                <th className="p-4">Joined Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    <User className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="text-sm font-medium">No users match your criteria</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Try adjusting your search terms or filter selections.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const sub = user.current_subscription;
                  const isActive =
                    sub &&
                    (sub.status === "active" || sub.status === "trialing") &&
                    sub.current_period_end !== null &&
                    new Date(sub.current_period_end) > new Date();

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* User Info */}
                      <td className="p-4">
                        <div className="font-semibold text-white text-sm">
                          {user.full_name || "Unnamed Golfer"}
                        </div>
                        <div className="text-slate-400 text-xs flex items-center gap-1.5 mt-0.5">
                          <span>{user.email}</span>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            user.role === "admin"
                              ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                              : "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                          }`}
                        >
                          {user.role === "admin" && (
                            <Shield className="w-3 h-3 text-purple-400" />
                          )}
                          <span className="capitalize">{user.role}</span>
                        </span>
                      </td>

                      {/* Current Subscription */}
                      <td className="p-4">
                        {sub ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                                  isActive
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                    : sub.status === "canceled"
                                    ? "bg-slate-800 text-slate-400 border border-slate-700"
                                    : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                }`}
                              >
                                {sub.status}
                              </span>
                              <span className="text-white font-medium capitalize">
                                {sub.plan_type}
                              </span>
                            </div>
                              <div className="text-[11px] text-slate-500">
                                {sub.cancel_at_period_end ? (
                                  <span className="text-amber-400">
                                    Expires{" "}
                                    {sub.current_period_end
                                      ? new Date(sub.current_period_end).toLocaleDateString()
                                      : "N/A"}
                                  </span>
                                ) : (
                                  <span>
                                    Renews{" "}
                                    {sub.current_period_end
                                      ? new Date(sub.current_period_end).toLocaleDateString()
                                      : "N/A"}
                                  </span>
                                )}
                              </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
                            None
                          </span>
                        )}
                      </td>

                      {/* Designated Charity */}
                      <td className="p-4">
                        {user.charity_name ? (
                          <div>
                            <div className="font-medium text-white flex items-center gap-1.5">
                              <Heart className="w-3.5 h-3.5 text-rose-400" />
                              <span className="truncate max-w-[160px]">
                                {user.charity_name}
                              </span>
                            </div>
                            <div className="text-[11px] text-amber-400 mt-0.5">
                              {user.charity_contribution_pct}% contribution
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs">None</span>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td className="p-4 text-slate-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedDetailUserId(user.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-medium"
                            title="View Account Details"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="hidden sm:inline">Details</span>
                          </button>
                          <button
                            onClick={() => setEditingUser(user)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-medium"
                            title="Edit User Profile"
                          >
                            <Edit2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Edit</span>
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

        {/* Directory Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <span className="text-white font-semibold">{filteredUsers.length}</span> of{" "}
            <span className="text-white font-semibold">{users.length}</span> users
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedDetailUserId && (
        <AdminUserDetailModal
          userId={selectedDetailUserId}
          isOpen={true}
          onClose={() => setSelectedDetailUserId(null)}
          onDataChanged={handleRefresh}
        />
      )}

      {editingUser && (
        <AdminUserEditModal
          user={editingUser}
          charities={charities}
          isOpen={true}
          onClose={() => setEditingUser(null)}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}
