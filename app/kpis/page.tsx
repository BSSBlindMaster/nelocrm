"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { getCurrentAppUser, type CurrentAppUser } from "@/lib/current-app-user";
import {
  formatKpiValue,
  getKpiTrend,
  getKpiValue,
  getPinnedKpis,
  kpiDefinitions,
} from "@/lib/kpis";
import { supabase } from "@/lib/supabase";

type KpiCardState = {
  key: string;
  value: number;
  trend: number;
};

export default function KpiLibraryPage() {
  const [currentUser, setCurrentUser] = useState<CurrentAppUser | null>(null);
  const [kpiStates, setKpiStates] = useState<Record<string, KpiCardState>>({});
  const [pinnedKeys, setPinnedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadKpis() {
      setLoading(true);
      const user = await getCurrentAppUser();
      setCurrentUser(user);

      if (!user) {
        setLoading(false);
        return;
      }

      const [pins, values] = await Promise.all([
        getPinnedKpis(user.id),
        Promise.all(
          kpiDefinitions.map(async (definition) => {
            const [value, trend] = await Promise.all([
              getKpiValue(definition.key, user.id),
              getKpiTrend(definition.key, user.id),
            ]);
            return {
              key: definition.key,
              value: Number(value.value ?? 0),
              trend: Number(trend ?? 0),
            };
          }),
        ),
      ]);

      setPinnedKeys(pins.map((pin) => pin.kpi_key));
      setKpiStates(
        Object.fromEntries(values.map((item) => [item.key, item])),
      );
      setLoading(false);
    }

    void loadKpis();
  }, []);

  const grouped = useMemo(() => {
    return ["Sales KPIs", "Marketing KPIs", "Operations KPIs", "Financial KPIs"].map((category) => ({
      category,
      items: kpiDefinitions.filter((definition) => definition.category === category),
    }));
  }, []);

  async function togglePin(kpiKey: string) {
    if (!currentUser) {
      return;
    }

    if (pinnedKeys.includes(kpiKey)) {
      await supabase
        .from("user_dashboard_pins")
        .delete()
        .eq("user_id", currentUser.id)
        .eq("kpi_key", kpiKey);
      setPinnedKeys((current) => current.filter((key) => key !== kpiKey));
      return;
    }

    await supabase.from("user_dashboard_pins").insert({
      user_id: currentUser.id,
      kpi_key: kpiKey,
      position: pinnedKeys.length,
    });
    setPinnedKeys((current) => [...current, kpiKey]);
  }

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="KPIs" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar title="KPI library" />

        <div className="space-y-8 p-8">
          <div>
            <p className="text-sm text-stone-500">
              Pin any KPI to your dashboard for quick access
            </p>
          </div>

          {grouped.map((group) => (
            <section key={group.category}>
              <h2 className="text-lg font-semibold tracking-tight text-stone-950">
                {group.category}
              </h2>
              <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((definition) => {
                  const state = kpiStates[definition.key];
                  const pinned = pinnedKeys.includes(definition.key);
                  return (
                    <article
                      key={definition.key}
                      className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-stone-950">
                            {definition.label}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-stone-500">
                            {definition.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void togglePin(definition.key)}
                          className={`rounded-full p-2 ${pinned ? "bg-primary/10 text-primary" : "bg-stone-100 text-stone-400"}`}
                          aria-label={pinned ? "Unpin KPI" : "Pin KPI"}
                        >
                          <span className="block text-sm leading-none">{pinned ? "X" : "Pin"}</span>
                        </button>
                      </div>

                      <div className="mt-6 flex items-end justify-between gap-3">
                        {loading ? (
                          <div className="h-10 w-full animate-pulse rounded-xl bg-stone-100" />
                        ) : (
                          <>
                            <p className="text-3xl font-semibold tracking-tight text-stone-950">
                              {formatKpiValue(state?.value ?? 0, definition.format)}
                            </p>
                            <div className="flex items-center gap-2 text-sm">
                              {(state?.trend ?? 0) >= 0 ? (
                                <span className="text-[#2DA44E]">↑</span>
                              ) : (
                                <span className="text-[#A32D2D]">↓</span>
                              )}
                              <span className={(state?.trend ?? 0) >= 0 ? "text-[#2DA44E]" : "text-[#A32D2D]"}>
                                {definition.format === "percent"
                                  ? `${(((state?.trend ?? 0) || 0) * 100).toFixed(1)} pts`
                                  : formatKpiValue(Math.abs(state?.trend ?? 0), definition.format)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
