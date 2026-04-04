"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { getCurrentAppUser, type CurrentAppUser } from "@/lib/current-app-user";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Commission = {
  id: string;
  project_id: string;
  sale_amount: number;
  commission_rate: number;
  commission_amount: number;
  payment_part: number;
  payment_label: string;
  status: string;
  earned_at: string | null;
  paid_at: string | null;
  created_at: string;
  projects: { id: string; job_number: string; customers: { name: string } | null } | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_BADGE: Record<string, string> = {
  pending_sale: "bg-stone-100 text-stone-600",
  pending_install: "bg-amber-100 text-amber-700",
  earned: "bg-emerald-100 text-emerald-700",
  paid: "bg-emerald-100 text-emerald-700",
  exported: "bg-sky-100 text-sky-700",
  deduction: "bg-rose-100 text-rose-700",
};

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MyCommissionsPage() {
  const [currentUser, setCurrentUser] = useState<CurrentAppUser | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      const user = await getCurrentAppUser();
      if (!isMounted || !user) return;
      setCurrentUser(user);

      const { data } = await supabase
        .from("commissions")
        .select(`
          *,
          projects ( id, job_number, customers ( name ) )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!isMounted) return;
      setCommissions((data as Commission[] | null) ?? []);
      setIsLoading(false);
    }
    void init();
    return () => { isMounted = false; };
  }, []);

  const summary = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    let mtdEarned = 0;
    let ytdEarned = 0;
    let pending = 0;

    commissions.forEach((c) => {
      if (c.status === "pending_sale" || c.status === "pending_install") {
        pending += c.commission_amount;
      }
      const isPaid = c.status === "earned" || c.status === "paid" || c.status === "exported";
      const earnDate = c.earned_at ? new Date(c.earned_at) : c.paid_at ? new Date(c.paid_at) : null;
      if (isPaid && earnDate) {
        if (earnDate >= yearStart) ytdEarned += c.commission_amount;
        if (earnDate >= monthStart) mtdEarned += c.commission_amount;
      }
    });

    return { mtdEarned, ytdEarned, pending };
  }, [commissions]);

  if (isLoading) return null;

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Commissions" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar title="My Commissions" />

        <div className="space-y-6 p-8">
          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-emerald-50 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600/60">MTD Earned</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-700">{formatCurrency(summary.mtdEarned)}</p>
            </div>
            <div className="rounded-2xl bg-primary/5 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/60">YTD Earned</p>
              <p className="mt-2 text-2xl font-semibold text-primary">{formatCurrency(summary.ytdEarned)}</p>
            </div>
            <div className="rounded-2xl bg-stone-50 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Pending</p>
              <p className="mt-2 text-2xl font-semibold text-stone-900">{formatCurrency(summary.pending)}</p>
            </div>
          </div>

          {/* Commission table */}
          <div className="overflow-x-auto rounded-3xl border border-stone-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-stone-200">
              <thead className="bg-stone-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                  <th className="px-4 py-4">Customer</th>
                  <th className="px-4 py-4">Job #</th>
                  <th className="px-4 py-4">Sale Amount</th>
                  <th className="px-4 py-4">Commission</th>
                  <th className="px-4 py-4">Part</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {commissions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-stone-400">
                      No commissions yet
                    </td>
                  </tr>
                )}
                {commissions.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 text-sm text-stone-700">
                      {c.projects?.customers?.name ?? "Unknown"}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-stone-600">
                      {c.projects?.job_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-700">{formatCurrency(c.sale_amount)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-stone-900">
                      {c.commission_amount < 0 ? (
                        <span className="text-rose-600">{formatCurrency(c.commission_amount)}</span>
                      ) : (
                        formatCurrency(c.commission_amount)
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-500">
                      {c.payment_part === 0 ? "Deduction" : c.payment_part === 1 ? "Sale 50%" : "Install 50%"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[c.status] ?? "bg-stone-100 text-stone-600"}`}>
                        {statusLabel(c.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-500">
                      {c.earned_at ? formatDate(c.earned_at) : formatDate(c.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
