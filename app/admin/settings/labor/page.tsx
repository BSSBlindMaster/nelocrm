"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { supabase } from "@/lib/supabase";

type BusinessSettingsRecord = {
  id: string;
  default_labor_rate: number | null;
};

type InstallTimeRule = {
  id: string;
  product_type: string;
  minutes_per_unit: number;
  notes: string;
  isNew?: boolean;
};

type InstallerUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  hourly_rate: number | null;
  hourly_rate_override: boolean | null;
  roles?: {
    name: string | null;
  } | null;
};

function getFullName(user: InstallerUser) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || "Unnamed installer";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function LaborSettingsPage() {
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [defaultLaborRate, setDefaultLaborRate] = useState("30");
  const [installers, setInstallers] = useState<InstallerUser[]>([]);
  const [installTimeRules, setInstallTimeRules] = useState<InstallTimeRule[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    async function loadLaborSettings() {
      const [settingsResponse, usersResponse, rulesResponse] = await Promise.all([
        supabase
          .from("business_settings")
          .select("id, default_labor_rate")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("app_users")
          .select("id, first_name, last_name, hourly_rate, hourly_rate_override, active, roles(name)")
          .eq("active", true)
          .order("first_name", { ascending: true }),
        supabase
          .from("install_time_rules")
          .select("id, product_type, minutes_per_unit, notes")
          .order("product_type", { ascending: true }),
      ]);

      const settings = settingsResponse.data as BusinessSettingsRecord | null;
      if (settings) {
        setSettingsId(settings.id);
        setDefaultLaborRate(String(settings.default_labor_rate ?? 30));
      }

      const users = ((usersResponse.data as InstallerUser[] | null) ?? []).filter(
        (user) => user.roles?.name === "Installer",
      );
      setInstallers(users);

      const rules = (rulesResponse.data as InstallTimeRule[] | null) ?? [];
      setInstallTimeRules(rules.map((r) => ({ ...r, notes: r.notes ?? "" })));
    }

    void loadLaborSettings();
  }, []);

  const liveExample = useMemo(() => {
    const saleAmount = 4200;
    const cogs = saleAmount * 0.43;
    const laborHours = 6;
    const laborCost = laborHours * Number(defaultLaborRate || 0);
    const commission = saleAmount * 0.08;
    const grossProfit = saleAmount - cogs - laborCost - commission;

    return {
      saleAmount,
      cogs,
      laborCost,
      commission,
      grossProfit,
    };
  }, [defaultLaborRate]);

  async function handleSave() {
    setIsSaving(true);
    setStatusMessage("");

    const laborRate = Number(defaultLaborRate || 30);

    if (settingsId) {
      await supabase
        .from("business_settings")
        .update({ default_labor_rate: laborRate })
        .eq("id", settingsId);
    } else {
      const { data } = await supabase
        .from("business_settings")
        .insert({ default_labor_rate: laborRate })
        .select("id")
        .maybeSingle();
      setSettingsId(String((data as { id?: string } | null)?.id ?? ""));
    }

    await Promise.all(
      installers.map((installer) =>
        supabase
          .from("app_users")
          .update({
            hourly_rate_override: installer.hourly_rate_override ?? false,
            hourly_rate: installer.hourly_rate_override
              ? Number(installer.hourly_rate ?? laborRate)
              : null,
          })
          .eq("id", installer.id),
      ),
    );

    // Save install time rules
    for (const rule of installTimeRules) {
      if (rule.isNew) {
        await supabase
          .from("install_time_rules")
          .insert({
            product_type: rule.product_type,
            minutes_per_unit: rule.minutes_per_unit,
            notes: rule.notes || null,
          });
      } else {
        await supabase
          .from("install_time_rules")
          .update({
            product_type: rule.product_type,
            minutes_per_unit: rule.minutes_per_unit,
            notes: rule.notes || null,
          })
          .eq("id", rule.id);
      }
    }

    // Reload rules to get proper IDs for new rows
    const { data: freshRules } = await supabase
      .from("install_time_rules")
      .select("id, product_type, minutes_per_unit, notes")
      .order("product_type", { ascending: true });
    setInstallTimeRules(
      ((freshRules as InstallTimeRule[] | null) ?? []).map((r) => ({ ...r, notes: r.notes ?? "" })),
    );

    setStatusMessage("Labor settings saved.");
    setIsSaving(false);
  }

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Settings" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar
          title="Labor & job costing"
          titlePrefix={
            <Link href="/admin/settings" className="text-lg text-stone-400 transition hover:text-stone-700">
              ←
            </Link>
          }
        />

        <div className="space-y-6 p-8">
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">
              Default labor rate
            </h2>
            <label className="mt-5 block text-sm font-medium text-stone-700">
              Default installer hourly rate
            </label>
            <div className="mt-2 flex max-w-sm items-center rounded-2xl border border-stone-200 bg-white px-4">
              <span className="text-sm text-stone-500">$</span>
              <input
                value={defaultLaborRate}
                onChange={(event) => setDefaultLaborRate(event.target.value)}
                className="min-h-12 w-full px-2 text-sm outline-none"
              />
            </div>
            <p className="mt-2 text-sm text-stone-500">
              Used to calculate labor cost on all jobs unless overridden per installer
            </p>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">
              Per-installer rates
            </h2>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-200">
                <thead className="bg-stone-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                    <th className="px-4 py-4">Installer</th>
                    <th className="px-4 py-4">Override</th>
                    <th className="px-4 py-4">Hourly rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {installers.map((installer) => {
                    const fullName = getFullName(installer);
                    const usesOverride = installer.hourly_rate_override ?? false;

                    return (
                      <tr key={installer.id}>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                              {getInitials(fullName)}
                            </div>
                            <span className="text-sm font-medium text-stone-900">{fullName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              setInstallers((current) =>
                                current.map((user) =>
                                  user.id === installer.id
                                    ? {
                                        ...user,
                                        hourly_rate_override: !(user.hourly_rate_override ?? false),
                                      }
                                    : user,
                                ),
                              )
                            }
                            className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium ${
                              usesOverride
                                ? "bg-primary text-white"
                                : "bg-stone-100 text-stone-600"
                            }`}
                          >
                            {usesOverride ? "Override on" : "Use default"}
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex max-w-[160px] items-center rounded-2xl border border-stone-200 px-4">
                            <span className="text-sm text-stone-500">$</span>
                            <input
                              value={
                                usesOverride
                                  ? String(installer.hourly_rate ?? defaultLaborRate)
                                  : defaultLaborRate
                              }
                              disabled={!usesOverride}
                              onChange={(event) =>
                                setInstallers((current) =>
                                  current.map((user) =>
                                    user.id === installer.id
                                      ? { ...user, hourly_rate: Number(event.target.value) }
                                      : user,
                                  ),
                                )
                              }
                              className="min-h-12 w-full px-2 text-sm outline-none disabled:text-stone-400"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">
              Install time rules
            </h2>
            <p className="mt-2 text-sm text-stone-500">
              These times are used to automatically calculate how long each job will take when scheduling installs.
            </p>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-200">
                <thead className="bg-stone-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                    <th className="px-4 py-4">Product type</th>
                    <th className="px-4 py-4">Minutes per unit</th>
                    <th className="px-4 py-4">Notes</th>
                    <th className="px-4 py-4 w-[60px]" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {installTimeRules.map((rule, idx) => (
                    <tr key={rule.id}>
                      <td className="px-4 py-3">
                        <input
                          value={rule.product_type}
                          onChange={(e) =>
                            setInstallTimeRules((current) =>
                              current.map((r, i) =>
                                i === idx ? { ...r, product_type: e.target.value } : r,
                              ),
                            )
                          }
                          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={rule.minutes_per_unit}
                          onChange={(e) =>
                            setInstallTimeRules((current) =>
                              current.map((r, i) =>
                                i === idx ? { ...r, minutes_per_unit: Number(e.target.value) } : r,
                              ),
                            )
                          }
                          className="w-24 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={rule.notes}
                          onChange={(e) =>
                            setInstallTimeRules((current) =>
                              current.map((r, i) =>
                                i === idx ? { ...r, notes: e.target.value } : r,
                              ),
                            )
                          }
                          placeholder="Optional notes"
                          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none placeholder:text-stone-400 focus:border-primary"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            setInstallTimeRules((current) =>
                              current.filter((_, i) => i !== idx),
                            )
                          }
                          className="rounded-lg p-1.5 text-stone-400 hover:bg-rose-50 hover:text-rose-500"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() =>
                setInstallTimeRules((current) => [
                  ...current,
                  {
                    id: `new-${Date.now()}`,
                    product_type: "",
                    minutes_per_unit: 30,
                    notes: "",
                    isNew: true,
                  },
                ])
              }
              className="mt-4 rounded-xl border border-dashed border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:border-primary hover:text-primary"
            >
              + Add product type
            </button>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">
              Job costing formula preview
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Sale amount → minus Cost of goods (43% of MSRP) → minus Labor (hours × rate) → minus Commission (rep %) → equals Gross profit
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl bg-stone-50 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Sale amount</p>
                <p className="mt-2 text-lg font-semibold text-stone-950">${liveExample.saleAmount.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl bg-stone-50 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-400">COGS</p>
                <p className="mt-2 text-lg font-semibold text-stone-950">${liveExample.cogs.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl bg-stone-50 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Labor</p>
                <p className="mt-2 text-lg font-semibold text-stone-950">${liveExample.laborCost.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl bg-stone-50 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Commission</p>
                <p className="mt-2 text-lg font-semibold text-stone-950">${liveExample.commission.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl bg-primary/10 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-primary">Gross profit</p>
                <p className="mt-2 text-lg font-semibold text-primary">${liveExample.grossProfit.toFixed(2)}</p>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-between gap-3">
            {statusMessage ? <p className="text-sm text-emerald-600">{statusMessage}</p> : <span />}
            <button
              type="button"
              onClick={() => void handleSave()}
              className="min-h-12 rounded-2xl bg-primary px-5 text-sm font-semibold text-white"
            >
              {isSaving ? "Saving..." : "Save all rates"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
