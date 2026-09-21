import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CharityService } from "@/lib/services/charity.service";
import { AdminCharityTable } from "@/components/admin/charities/AdminCharityTable";
import { HeartHandshake, ArrowLeft, ShieldCheck } from "lucide-react";

export default async function AdminCharitiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/charities");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/dashboard?error=unauthorized");
  }

  const adminClient = createAdminClient();
  const { data: charities = [] } =
    await CharityService.getAllCharitiesAdmin(adminClient);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <header className="space-y-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Admin Portal</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                <HeartHandshake className="h-3.5 w-3.5" />
                Charity Operations
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                Admin Verified
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Partner Charity Management
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl">
              Onboard vetted non-profits, update mission narratives and branding, toggle featured spotlights, and manage platform giving recipients.
            </p>
          </div>
        </div>
      </header>

      {/* Main Table View */}
      <AdminCharityTable charities={charities} />
    </div>
  );
}
