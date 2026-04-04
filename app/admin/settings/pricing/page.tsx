"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { supabase } from "@/lib/supabase";

type ManufacturerRow = {
  id: string;
  name: string;
};

type PricingRow = {
  manufacturer_id: string;
  cost_factor: number | null;
  default_margin: number | null;
  minimum_margin: number | null;
};

type ShippingRule = {
  id: string;
  manufacturer_id: string | null;
  rule_type: string;
  amount: number | null;
};

type GoalRecord = {
  target_revenue: number | null;
};

function formatPercent(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

export default function PricingSettingsPage() {
  const [manufacturers, setManufacturers] = useState<ManufacturerRow[]>([]);
  const [pricingRows, setPricingRows] = useState<Record<string, PricingRow>>({});
  const [shippingRules, setShippingRules] = useState<ShippingRule[]>([]);
  const [desiredNetProfit, setDesiredNetProfit] = useState("20");
  const [operatingExpenses, setOperatingExpenses] = useState("35");
  const [statusMessage, setStatusMessage] = useState("");
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [taxRate, setTaxRate] = useState("8.3");
  const [depositPercentage, setDepositPercentage] = useState("70");
  const [paymentTerms, setPaymentTerms] = useState(
    "70% deposit due at signing. Balance due upon completion of installation.",
  );

  useEffect(() => {
    async function loadPricingSettings() {
      const now = new Date();
      const [manufacturerResponse, pricingResponse, rulesResponse, goalResponse, settingsResponse] = await Promise.all([
        supabase.from("manufacturers").select("id, name").order("name"),
        supabase.from("pricing_settings").select("manufacturer_id, cost_factor, default_margin, minimum_margin"),
        supabase.from("shipping_rules").select("*").order("created_at", { ascending: true }),
        supabase
          .from("company_goals")
          .select("target_revenue")
          .eq("year", now.getFullYear())
          .eq("month", now.getMonth() + 1)
          .maybeSingle(),
        supabase.from("business_settings").select("id, tax_rate, deposit_percentage, payment_terms").limit(1).maybeSingle(),
      ]);

      const bs = settingsResponse.data as Record<string, unknown> | null;
      if (bs) {
        setSettingsId(String(bs.id ?? ""));
        if (bs.tax_rate != null) setTaxRate(String(Number(bs.tax_rate) * 100));
        if (bs.deposit_percentage != null) setDepositPercentage(String(Number(bs.deposit_percentage)));
        if (typeof bs.payment_terms === "string") setPaymentTerms(bs.payment_terms);
      }

      const nextManufacturers = (manufacturerResponse.data as ManufacturerRow[] | null) ?? [];
      setManufacturers(nextManufacturers);

      const nextPricingRows = ((pricingResponse.data as PricingRow[] | null) ?? []).reduce<
        Record<string, PricingRow>
      >((acc, row) => {
        acc[row.manufacturer_id] = row;
        return acc;
      }, {});
      setPricingRows(nextPricingRows);

      setShippingRules((rulesResponse.data as ShippingRule[] | null) ?? []);

      const goal = goalResponse.data as GoalRecord | null;
      if (goal?.target_revenue) {
        setOperatingExpenses(String(Math.max(20, Math.min(45, Math.round(goal.target_revenue / 10000)))));
      }
    }

    void loadPricingSettings();
  }, []);

  async function saveManufacturerRow(manufacturerId: string) {
    const row = pricingRows[manufacturerId];
    if (!row) return;

    await supabase.from("pricing_settings").upsert(
      {
        manufacturer_id: manufacturerId,
        cost_factor: Number(row.cost_factor ?? 0),
        default_margin: Number(row.default_margin ?? 0),
        minimum_margin: Number(row.minimum_margin ?? 0),
      },
      { onConflict: "manufacturer_id" },
    );

    setStatusMessage("Pricing settings saved.");
  }

  async function saveShippingRule(rule: ShippingRule) {
    if (rule.id.startsWith("new-")) {
      const { data } = await supabase
        .from("shipping_rules")
        .insert({
          manufacturer_id: rule.manufacturer_id,
          rule_type: rule.rule_type,
          amount: Number(rule.amount ?? 0),
        })
        .select("*")
        .maybeSingle();

      if (data) {
        setShippingRules((current) =>
          current.map((item) => (item.id === rule.id ? (data as ShippingRule) : item)),
        );
      }
    } else {
      await supabase
        .from("shipping_rules")
        .update({
          manufacturer_id: rule.manufacturer_id,
          rule_type: rule.rule_type,
          amount: Number(rule.amount ?? 0),
        })
        .eq("id", rule.id);
    }

    setStatusMessage("Shipping rule saved.");
  }

  const requiredGrossMargin = useMemo(() => {
    const net = Number(desiredNetProfit || 0) / 100;
    const expenses = Number(operatingExpenses || 0) / 100;
    return Math.min(0.95, Math.max(0, net + expenses));
  }, [desiredNetProfit, operatingExpenses]);

  async function setAsDefaultMargin() {
    await Promise.all(
      manufacturers.map((manufacturer) =>
        supabase
          .from("pricing_settings")
          .upsert(
            {
              manufacturer_id: manufacturer.id,
              cost_factor: Number(pricingRows[manufacturer.id]?.cost_factor ?? 0.43),
              default_margin: requiredGrossMargin,
              minimum_margin: Number(pricingRows[manufacturer.id]?.minimum_margin ?? 0.55),
            },
            { onConflict: "manufacturer_id" },
          ),
      ),
    );

    setPricingRows((current) =>
      Object.fromEntries(
        manufacturers.map((manufacturer) => [
          manufacturer.id,
          {
            manufacturer_id: manufacturer.id,
            cost_factor: current[manufacturer.id]?.cost_factor ?? 0.43,
            default_margin: requiredGrossMargin,
            minimum_margin: current[manufacturer.id]?.minimum_margin ?? 0.55,
          },
        ]),
      ),
    );
    setStatusMessage("Default margin updated from calculator.");
  }

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Settings" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar
          title="Pricing & margins"
          titlePrefix={
            <Link href="/admin/settings" className="text-lg text-stone-400 transition hover:text-stone-700">
              ←
            </Link>
          }
        />

        <div className="space-y-6 p-8">
          {/* Tax settings */}
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">Tax settings</h2>
            <div className="mt-5 max-w-sm">
              <label className="text-sm font-medium text-stone-700">Tax rate (%)</label>
              <div className="mt-2 flex items-center rounded-2xl border border-stone-200 bg-white px-4">
                <input
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="min-h-12 w-full px-2 text-sm outline-none"
                />
                <span className="text-sm text-stone-500">%</span>
              </div>
              <p className="mt-2 text-sm text-stone-500">
                Applied to all quotes. Both Mesa locations charge Mesa rate.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!settingsId) return;
                await supabase.from("business_settings").update({ tax_rate: Number(taxRate) / 100 }).eq("id", settingsId);
                setStatusMessage("Tax rate saved.");
              }}
              className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white"
            >
              Save
            </button>
          </section>

          {/* Payment terms */}
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">Payment terms</h2>
            <div className="mt-5 space-y-5 max-w-lg">
              <div>
                <label className="text-sm font-medium text-stone-700">Deposit percentage</label>
                <div className="mt-2 flex items-center rounded-2xl border border-stone-200 bg-white px-4">
                  <input
                    value={depositPercentage}
                    onChange={(e) => setDepositPercentage(e.target.value)}
                    className="min-h-12 w-full px-2 text-sm outline-none"
                  />
                  <span className="text-sm text-stone-500">%</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700">Payment terms text</label>
                <textarea
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition focus:border-primary"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!settingsId) return;
                await supabase.from("business_settings").update({ deposit_percentage: Number(depositPercentage), payment_terms: paymentTerms }).eq("id", settingsId);
                setStatusMessage("Payment terms saved.");
              }}
              className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white"
            >
              Save
            </button>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">Per manufacturer settings</h2>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-200">
                <thead className="bg-stone-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                    <th className="px-4 py-4">Manufacturer</th>
                    <th className="px-4 py-4">Cost factor</th>
                    <th className="px-4 py-4">Default margin</th>
                    <th className="px-4 py-4">Minimum margin</th>
                    <th className="px-4 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {manufacturers.map((manufacturer) => {
                    const row = pricingRows[manufacturer.id] ?? {
                      manufacturer_id: manufacturer.id,
                      cost_factor: 0.43,
                      default_margin: 0.65,
                      minimum_margin: 0.55,
                    };

                    return (
                      <tr key={manufacturer.id}>
                        <td className="px-4 py-4 text-sm font-medium text-stone-950">{manufacturer.name}</td>
                        {(["cost_factor", "default_margin", "minimum_margin"] as const).map((field) => (
                          <td key={field} className="px-4 py-4">
                            <input
                              value={String(row[field] ?? "")}
                              onChange={(event) =>
                                setPricingRows((current) => ({
                                  ...current,
                                  [manufacturer.id]: {
                                    ...row,
                                    [field]: Number(event.target.value),
                                  },
                                }))
                              }
                              className="min-h-11 w-28 rounded-xl border border-stone-200 px-3 text-sm outline-none transition focus:border-primary"
                            />
                          </td>
                        ))}
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => void saveManufacturerRow(manufacturer.id)}
                            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white"
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-stone-950">Shipping rules</h2>
              <button
                type="button"
                onClick={() =>
                  setShippingRules((current) => [
                    ...current,
                    {
                      id: `new-${Date.now()}`,
                      manufacturer_id: manufacturers[0]?.id ?? null,
                      rule_type: "Flat rate",
                      amount: 0,
                    },
                  ])
                }
                className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700"
              >
                Add rule
              </button>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-200">
                <thead className="bg-stone-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                    <th className="px-4 py-4">Manufacturer</th>
                    <th className="px-4 py-4">Rule type</th>
                    <th className="px-4 py-4">Amount</th>
                    <th className="px-4 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {shippingRules.map((rule) => (
                    <tr key={rule.id}>
                      <td className="px-4 py-4">
                        <select
                          value={rule.manufacturer_id ?? ""}
                          onChange={(event) =>
                            setShippingRules((current) =>
                              current.map((item) =>
                                item.id === rule.id ? { ...item, manufacturer_id: event.target.value } : item,
                              ),
                            )
                          }
                          className="min-h-11 rounded-xl border border-stone-200 px-3 text-sm outline-none transition focus:border-primary"
                        >
                          {manufacturers.map((manufacturer) => (
                            <option key={manufacturer.id} value={manufacturer.id}>
                              {manufacturer.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={rule.rule_type}
                          onChange={(event) =>
                            setShippingRules((current) =>
                              current.map((item) =>
                                item.id === rule.id ? { ...item, rule_type: event.target.value } : item,
                              ),
                            )
                          }
                          className="min-h-11 rounded-xl border border-stone-200 px-3 text-sm outline-none transition focus:border-primary"
                        >
                          {["Flat rate", "Per piece", "Free over amount"].map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <input
                          value={String(rule.amount ?? 0)}
                          onChange={(event) =>
                            setShippingRules((current) =>
                              current.map((item) =>
                                item.id === rule.id ? { ...item, amount: Number(event.target.value) } : item,
                              ),
                            )
                          }
                          className="min-h-11 w-28 rounded-xl border border-stone-200 px-3 text-sm outline-none transition focus:border-primary"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => void saveShippingRule(rule)}
                          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white"
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">Net profit calculator</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-stone-700">Desired net profit %</label>
                <input
                  value={desiredNetProfit}
                  onChange={(event) => setDesiredNetProfit(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700">Operating expenses %</label>
                <input
                  value={operatingExpenses}
                  onChange={(event) => setOperatingExpenses(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
                />
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <p className="text-sm leading-6 text-stone-700">
                To achieve {desiredNetProfit}% net profit with {operatingExpenses}% operating expenses
                you need a <span className="font-semibold text-primary">{formatPercent(requiredGrossMargin)}</span> gross margin.
              </p>
              <p className="mt-3 text-sm text-stone-500">
                Formula shown: Desired net profit % + operating expenses % = required gross margin
              </p>
            </div>

            <button
              type="button"
              onClick={() => void setAsDefaultMargin()}
              className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white"
            >
              Set as default margin
            </button>
          </section>

          {statusMessage ? <p className="text-sm text-emerald-600">{statusMessage}</p> : null}
        </div>
      </section>
    </main>
  );
}
