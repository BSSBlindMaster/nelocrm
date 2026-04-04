"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import {
  getCurrentAppUser,
  getActiveAppUsers,
  type CurrentAppUser,
  type ActiveAppUser,
} from "@/lib/current-app-user";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Commission = {
  id: string;
  project_id: string;
  user_id: string;
  sale_amount: number;
  commission_rate: number;
  commission_amount: number;
  payment_part: number;
  payment_label: string;
  status: string;
  earned_at: string | null;
  paid_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  exported_at: string | null;
  quickbooks_ref: string | null;
  notes: string | null;
  created_at: string;
  app_users: { id: string; first_name: string; last_name: string } | null;
  projects: { id: string; job_number: string; customer_id: string; customers: { name: string } | null } | null;
};

type FilterTab = "all" | "pending_sale" | "pending_install" | "earned" | "paid" | "exported";

type RemakeRow = {
  id: string;
  project_id: string;
  cost: number;
  reason: string;
  created_at: string;
  projects: { job_number: string; customers: { name: string } | null } | null;
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

function repName(c: Commission): string {
  if (!c.app_users) return "Unknown";
  return [c.app_users.first_name, c.app_users.last_name].filter(Boolean).join(" ");
}

function repInitials(c: Commission): string {
  if (!c.app_users) return "?";
  return (
    (c.app_users.first_name?.[0] ?? "") + (c.app_users.last_name?.[0] ?? "")
  ).toUpperCase();
}

function customerName(c: Commission): string {
  return c.projects?.customers?.name ?? "Unknown";
}

function jobNumber(c: Commission): string {
  return c.projects?.job_number ?? "—";
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

export default function CommissionsPage() {
  const [currentUser, setCurrentUser] = useState<CurrentAppUser | null>(null);
  const [reps, setReps] = useState<ActiveAppUser[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [remakes, setRemakes] = useState<RemakeRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [showRemakes, setShowRemakes] = useState(false);

  // Pay period modal
  const [payPeriodOpen, setPayPeriodOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [periodRepFilter, setPeriodRepFilter] = useState("all");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  async function loadCommissions() {
    const { data } = await supabase
      .from("commissions")
      .select(`
        *,
        app_users ( id, first_name, last_name ),
        projects ( id, job_number, customer_id, customers ( name ) )
      `)
      .order("created_at", { ascending: false });

    setCommissions((data as Commission[] | null) ?? []);
  }

  async function loadRemakes() {
    const { data } = await supabase
      .from("remakes")
      .select("id, project_id, cost, reason, created_at, projects ( job_number, customers ( name ) )")
      .order("created_at", { ascending: false });

    setRemakes((data as RemakeRow[] | null) ?? []);
  }

  useEffect(() => {
    let isMounted = true;
    async function init() {
      const [user, users] = await Promise.all([
        getCurrentAppUser(),
        getActiveAppUsers(),
      ]);
      if (!isMounted) return;
      setCurrentUser(user);
      setReps(users.filter((u) => u.roleName === "Sales Rep" || u.roleName === "Sales Manager"));
      await Promise.all([loadCommissions(), loadRemakes()]);
      setIsLoading(false);
    }
    void init();
    return () => { isMounted = false; };
  }, []);

  // Redirect reps to their own view
  useEffect(() => {
    if (!isLoading && currentUser) {
      const isManager = currentUser.roleName === "Owner" || currentUser.roleName === "Sales Manager";
      if (!isManager) {
        window.location.href = "/commissions/my";
      }
    }
  }, [isLoading, currentUser]);

  // -----------------------------------------------------------------------
  // Computed
  // -----------------------------------------------------------------------

  const filtered = useMemo(() => {
    if (activeFilter === "all") return commissions;
    return commissions.filter((c) => c.status === activeFilter);
  }, [commissions, activeFilter]);

  const summary = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    let pendingSale = 0;
    let earned = 0;
    let paidMonth = 0;
    let paidYtd = 0;

    commissions.forEach((c) => {
      if (c.status === "pending_sale") pendingSale += c.commission_amount;
      if (c.status === "earned") earned += c.commission_amount;
      if ((c.status === "paid" || c.status === "exported") && c.paid_at) {
        const paidDate = new Date(c.paid_at);
        if (paidDate >= yearStart) paidYtd += c.commission_amount;
        if (paidDate >= monthStart) paidMonth += c.commission_amount;
      }
    });

    return { pendingSale, earned, paidMonth, paidYtd };
  }, [commissions]);

  const periodCommissions = useMemo(() => {
    return commissions.filter((c) => {
      if (c.status !== "earned") return false;
      if (periodRepFilter !== "all" && c.user_id !== periodRepFilter) return false;
      if (c.earned_at) {
        const d = c.earned_at.slice(0, 10);
        if (d < periodStart || d > periodEnd) return false;
      }
      return true;
    });
  }, [commissions, periodStart, periodEnd, periodRepFilter]);

  const periodRepTotals = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number }> = {};
    periodCommissions.forEach((c) => {
      const name = repName(c);
      if (!map[c.user_id]) map[c.user_id] = { name, total: 0, count: 0 };
      map[c.user_id].total += c.commission_amount;
      map[c.user_id].count += 1;
    });
    return Object.values(map);
  }, [periodCommissions]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  async function approveCommission(id: string) {
    if (!currentUser) return;
    await supabase
      .from("commissions")
      .update({
        status: "earned",
        approved_by: currentUser.id,
        approved_at: new Date().toISOString(),
        earned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    await loadCommissions();
  }

  async function markAsPaid(ids: string[]) {
    setIsProcessing(true);
    for (const id of ids) {
      await supabase
        .from("commissions")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    }
    await loadCommissions();
    setIsProcessing(false);
    setStatusMessage(`${ids.length} commission${ids.length !== 1 ? "s" : ""} marked as paid`);
    setTimeout(() => setStatusMessage(""), 5000);
  }

  async function markAsExported(id: string) {
    await supabase
      .from("commissions")
      .update({
        status: "exported",
        exported_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    await loadCommissions();
  }

  function exportToCsv() {
    const header = "Rep Name,Customer,Job Number,Sale Amount,Commission Rate,Commission Amount,Pay Period\n";
    const rows = periodCommissions.map((c) =>
      [
        repName(c),
        customerName(c),
        jobNumber(c),
        c.sale_amount.toFixed(2),
        (c.commission_rate * 100).toFixed(1) + "%",
        c.commission_amount.toFixed(2),
        `${periodStart} to ${periodEnd}`,
      ].join(","),
    );
    const csv = header + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commissions_${periodStart}_${periodEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function applyRemakeDeduction(remakeId: string, userId: string, cost: number, projectId: string) {
    await supabase.from("commissions").insert({
      project_id: projectId,
      user_id: userId,
      sale_amount: 0,
      commission_rate: 0,
      commission_amount: -Math.abs(cost),
      payment_part: 0,
      payment_label: "Remake deduction",
      status: "deduction",
      earned_at: new Date().toISOString(),
    });
    await loadCommissions();
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (isLoading) return null;

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending_sale", label: "Pending Sale" },
    { key: "pending_install", label: "Pending Install" },
    { key: "earned", label: "Earned" },
    { key: "paid", label: "Paid" },
    { key: "exported", label: "Exported" },
  ];

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Commissions" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar
          title="Commissions"
          actionLabel="Run commission period"
          actionOnClick={() => setPayPeriodOpen(true)}
        />

        <div className="space-y-6 p-8">
          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Pending (sale)" value={summary.pendingSale} tone="stone" />
            <SummaryCard label="Earned (ready to pay)" value={summary.earned} tone="emerald" />
            <SummaryCard label="Paid this month" value={summary.paidMonth} tone="sky" />
            <SummaryCard label="Paid YTD" value={summary.paidYtd} tone="primary" />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveFilter(tab.key)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeFilter === tab.key
                    ? "bg-primary text-white"
                    : "bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Commission table */}
          <div className="overflow-x-auto rounded-3xl border border-stone-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-stone-200">
              <thead className="bg-stone-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                  <th className="px-4 py-4">Rep</th>
                  <th className="px-4 py-4">Customer</th>
                  <th className="px-4 py-4">Job #</th>
                  <th className="px-4 py-4">Sale Amount</th>
                  <th className="px-4 py-4">Rate</th>
                  <th className="px-4 py-4">Commission</th>
                  <th className="px-4 py-4">Part</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Earned</th>
                  <th className="px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-sm text-stone-400">
                      No commissions found
                    </td>
                  </tr>
                )}
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                          {repInitials(c)}
                        </span>
                        <span className="text-sm font-medium text-stone-900">{repName(c)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-700">
                      {c.projects?.id ? (
                        <a href={`/projects/${c.projects.id}`} className="text-primary hover:underline">
                          {customerName(c)}
                        </a>
                      ) : (
                        customerName(c)
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-stone-600">{jobNumber(c)}</td>
                    <td className="px-4 py-3 text-sm text-stone-700">{formatCurrency(c.sale_amount)}</td>
                    <td className="px-4 py-3 text-sm text-stone-700">{(c.commission_rate * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-sm font-semibold text-stone-900">
                      {c.commission_amount < 0 ? (
                        <span className="text-rose-600">{formatCurrency(c.commission_amount)}</span>
                      ) : (
                        formatCurrency(c.commission_amount)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-stone-500">
                        {c.payment_part === 0 ? "Deduction" : c.payment_part === 1 ? "Sale 50%" : "Install 50%"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[c.status] ?? "bg-stone-100 text-stone-600"}`}>
                        {statusLabel(c.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-500">
                      {c.earned_at ? formatDate(c.earned_at) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {c.status === "pending_sale" && (
                          <button
                            type="button"
                            onClick={() => void approveCommission(c.id)}
                            className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90"
                          >
                            Approve
                          </button>
                        )}
                        {c.status === "earned" && (
                          <button
                            type="button"
                            onClick={() => void markAsExported(c.id)}
                            className="rounded-lg border border-stone-200 px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-50"
                          >
                            Export to QB
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Status message */}
          {statusMessage && (
            <p className="text-sm font-medium text-emerald-600">{statusMessage}</p>
          )}

          {/* Remake deductions section */}
          <div className="rounded-3xl border border-stone-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setShowRemakes((v) => !v)}
              className="flex w-full items-center justify-between px-6 py-4 text-left"
            >
              <h2 className="text-lg font-semibold tracking-tight text-stone-950">
                Remake deductions
              </h2>
              <span className={`text-sm text-stone-400 transition ${showRemakes ? "rotate-90" : ""}`}>›</span>
            </button>
            {showRemakes && (
              <div className="border-t border-stone-200 px-6 pb-6">
                {remakes.length === 0 ? (
                  <p className="py-6 text-center text-sm text-stone-400">No remakes recorded</p>
                ) : (
                  <table className="mt-4 min-w-full divide-y divide-stone-200">
                    <thead className="bg-stone-50">
                      <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                        <th className="px-4 py-3">Project</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Remake Cost</th>
                        <th className="px-4 py-3">Reason</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {remakes.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-3 font-mono text-sm text-stone-600">
                            {r.projects?.job_number ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-stone-700">
                            {r.projects?.customers?.name ?? "Unknown"}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-rose-600">
                            {formatCurrency(r.cost)}
                          </td>
                          <td className="px-4 py-3 text-sm text-stone-600">{r.reason}</td>
                          <td className="px-4 py-3 text-xs text-stone-500">{formatDate(r.created_at)}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => {
                                // For now, apply to first rep found — manager picks
                                const firstCommission = commissions.find(
                                  (c) => c.project_id === r.project_id && c.payment_part > 0,
                                );
                                if (firstCommission) {
                                  void applyRemakeDeduction(
                                    r.id,
                                    firstCommission.user_id,
                                    r.cost,
                                    r.project_id,
                                  );
                                }
                              }}
                              className="rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                            >
                              Apply to commission
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* PAY PERIOD MODAL */}
      {payPeriodOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-stone-900">Run commission period</h2>
              <button
                type="button"
                onClick={() => setPayPeriodOpen(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {/* Controls */}
              <div className="mb-6 grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-400">
                    Period Start
                  </label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900 focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-400">
                    Period End
                  </label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900 focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-400">
                    Rep
                  </label>
                  <select
                    value={periodRepFilter}
                    onChange={(e) => setPeriodRepFilter(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900 focus:border-primary focus:outline-none"
                  >
                    <option value="all">All reps</option>
                    {reps.map((r) => (
                      <option key={r.id} value={r.id}>{r.fullName}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Per-rep totals */}
              {periodRepTotals.length > 0 && (
                <div className="mb-4 rounded-lg bg-stone-50 p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                    Totals by rep
                  </h3>
                  <div className="space-y-1">
                    {periodRepTotals.map((t) => (
                      <div key={t.name} className="flex justify-between text-sm">
                        <span className="text-stone-700">{t.name} ({t.count} commission{t.count !== 1 ? "s" : ""})</span>
                        <span className="font-semibold text-stone-900">{formatCurrency(t.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview list */}
              <div className="mb-4 max-h-[300px] overflow-y-auto">
                {periodCommissions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-stone-400">
                    No earned commissions in this period
                  </p>
                ) : (
                  <table className="min-w-full divide-y divide-stone-200 text-sm">
                    <thead className="bg-stone-50 text-xs uppercase text-stone-400">
                      <tr>
                        <th className="px-3 py-2 text-left">Rep</th>
                        <th className="px-3 py-2 text-left">Customer</th>
                        <th className="px-3 py-2 text-left">Job #</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {periodCommissions.map((c) => (
                        <tr key={c.id}>
                          <td className="px-3 py-2 text-stone-700">{repName(c)}</td>
                          <td className="px-3 py-2 text-stone-700">{customerName(c)}</td>
                          <td className="px-3 py-2 font-mono text-stone-500">{jobNumber(c)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-stone-900">
                            {formatCurrency(c.commission_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPayPeriodOpen(false)}
                  className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={exportToCsv}
                  disabled={periodCommissions.length === 0}
                  className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                >
                  Export to QuickBooks
                </button>
                <button
                  type="button"
                  onClick={() => void markAsPaid(periodCommissions.map((c) => c.id))}
                  disabled={isProcessing || periodCommissions.length === 0}
                  className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {isProcessing ? "Processing..." : "Mark as paid"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "stone" | "emerald" | "sky" | "primary";
}) {
  const toneClasses: Record<string, { bg: string; text: string; value: string }> = {
    stone: { bg: "bg-stone-50", text: "text-stone-400", value: "text-stone-900" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600/60", value: "text-emerald-700" },
    sky: { bg: "bg-sky-50", text: "text-sky-600/60", value: "text-sky-700" },
    primary: { bg: "bg-primary/5", text: "text-primary/60", value: "text-primary" },
  };
  const t = toneClasses[tone];

  return (
    <div className={`rounded-2xl ${t.bg} px-5 py-4`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${t.text}`}>{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${t.value}`}>
        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)}
      </p>
    </div>
  );
}
