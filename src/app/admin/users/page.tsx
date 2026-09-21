import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminService } from "@/lib/services/admin.service";
import { AdminUserTable } from "@/components/admin/users/AdminUserTable";
import { Users, Shield, CreditCard } from "lucide-react";

export const metadata = {
  title: "User Directory | Digital Heroes Admin",
  description: "Master ledger of registered golfers, subscription lifecycles, and scores.",
};

export default async function AdminUsersPage() {
  const supabase = await createClient();

  // 1. Verify authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // 2. Verify admin role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const adminClient = createAdminClient();

  // 3. Fetch all users and charities in parallel
  const [usersRes, charitiesRes] = await Promise.all([
    AdminService.getUsersList(adminClient),
    adminClient.from("charities").select("*").order("name", { ascending: true }),
  ]);

  const users = usersRes.data?.users ?? [];
  const charities = charitiesRes.data ?? [];

  // Summary counts
  const totalCount = users.length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const activeSubCount = users.filter(
    (u) =>
      u.current_subscription &&
      (u.current_subscription.status === "active" ||
        u.current_subscription.status === "trialing") &&
      u.current_subscription.current_period_end !== null &&
      new Date(u.current_subscription.current_period_end) > new Date()
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          User Directory & Subscriptions
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Master ledger of registered golfers, subscription lifecycles, and scores.
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{totalCount}</div>
            <div className="text-xs text-slate-400 font-medium">Registered Users</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400">{activeSubCount}</div>
            <div className="text-xs text-slate-400 font-medium">Active Subscribers</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-400">{adminCount}</div>
            <div className="text-xs text-slate-400 font-medium">Administrators</div>
          </div>
        </div>
      </div>

      {/* User Directory Table */}
      <AdminUserTable users={users} charities={charities} />
    </div>
  );
}
