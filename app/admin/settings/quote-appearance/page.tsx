"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { supabase } from "@/lib/supabase";

type QuoteAppearanceSettings = {
  id: string;
  business_name: string | null;
  company_logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  quote_logo_position: string | null;
  quote_show_company_name: boolean | null;
  quote_show_address: boolean | null;
  quote_address_mode: string | null;
  quote_show_tagline: boolean | null;
  quote_tagline: string | null;
  quote_footer_text: string | null;
  payment_terms_text: string | null;
  quote_show_payment_terms: boolean | null;
  quote_show_room_label: boolean | null;
  quote_show_product_name: boolean | null;
  quote_show_fabric_color: boolean | null;
  quote_show_lift_option: boolean | null;
  quote_show_measurements: boolean | null;
  quote_show_quantity: boolean | null;
  quote_show_unit_price: boolean | null;
  quote_show_line_total: boolean | null;
  quote_show_subtotal: boolean | null;
  quote_show_tax: boolean | null;
  quote_show_shipping: boolean | null;
  quote_show_installation: boolean | null;
};

const defaults = {
  business_name: "Nelo",
  company_logo_url: "",
  primary_color: "#FF4900",
  secondary_color: "#1C1C1C",
  quote_logo_position: "left",
  quote_show_company_name: true,
  quote_show_address: true,
  quote_address_mode: "both",
  quote_show_tagline: false,
  quote_tagline: "",
  quote_footer_text: "",
  payment_terms_text: "50% deposit due at signing. Balance due upon completion of installation.",
  quote_show_payment_terms: true,
  quote_show_room_label: true,
  quote_show_product_name: true,
  quote_show_fabric_color: true,
  quote_show_lift_option: true,
  quote_show_measurements: false,
  quote_show_quantity: true,
  quote_show_unit_price: true,
  quote_show_line_total: true,
  quote_show_subtotal: true,
  quote_show_tax: true,
  quote_show_shipping: false,
  quote_show_installation: false,
};

export default function QuoteAppearancePage() {
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [form, setForm] = useState(defaults);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadAppearanceSettings() {
      const { data } = await supabase.from("business_settings").select("*").limit(1).maybeSingle();
      const record = data as QuoteAppearanceSettings | null;
      if (!record) return;

      setSettingsId(record.id);
      setForm({
        business_name: record.business_name || defaults.business_name,
        company_logo_url: record.company_logo_url || "",
        primary_color: record.primary_color || defaults.primary_color,
        secondary_color: record.secondary_color || defaults.secondary_color,
        quote_logo_position: record.quote_logo_position || defaults.quote_logo_position,
        quote_show_company_name: record.quote_show_company_name ?? defaults.quote_show_company_name,
        quote_show_address: record.quote_show_address ?? defaults.quote_show_address,
        quote_address_mode: record.quote_address_mode || defaults.quote_address_mode,
        quote_show_tagline: record.quote_show_tagline ?? defaults.quote_show_tagline,
        quote_tagline: record.quote_tagline || "",
        quote_footer_text: record.quote_footer_text || "",
        payment_terms_text: record.payment_terms_text || defaults.payment_terms_text,
        quote_show_payment_terms: record.quote_show_payment_terms ?? defaults.quote_show_payment_terms,
        quote_show_room_label: record.quote_show_room_label ?? defaults.quote_show_room_label,
        quote_show_product_name: record.quote_show_product_name ?? defaults.quote_show_product_name,
        quote_show_fabric_color: record.quote_show_fabric_color ?? defaults.quote_show_fabric_color,
        quote_show_lift_option: record.quote_show_lift_option ?? defaults.quote_show_lift_option,
        quote_show_measurements: false,
        quote_show_quantity: record.quote_show_quantity ?? defaults.quote_show_quantity,
        quote_show_unit_price: record.quote_show_unit_price ?? defaults.quote_show_unit_price,
        quote_show_line_total: record.quote_show_line_total ?? defaults.quote_show_line_total,
        quote_show_subtotal: record.quote_show_subtotal ?? defaults.quote_show_subtotal,
        quote_show_tax: record.quote_show_tax ?? defaults.quote_show_tax,
        quote_show_shipping: record.quote_show_shipping ?? defaults.quote_show_shipping,
        quote_show_installation: record.quote_show_installation ?? defaults.quote_show_installation,
      });
    }

    void loadAppearanceSettings();
  }, []);

  function update<Key extends keyof typeof defaults>(key: Key, value: (typeof defaults)[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    setIsSaving(true);
    setStatusMessage("");

    const payload = {
      primary_color: form.primary_color,
      secondary_color: form.secondary_color,
      quote_logo_position: form.quote_logo_position,
      quote_show_company_name: form.quote_show_company_name,
      quote_show_address: form.quote_show_address,
      quote_address_mode: form.quote_address_mode,
      quote_show_tagline: form.quote_show_tagline,
      quote_tagline: form.quote_tagline || null,
      quote_footer_text: form.quote_footer_text || null,
      payment_terms_text: form.payment_terms_text || null,
      quote_show_payment_terms: form.quote_show_payment_terms,
      quote_show_room_label: form.quote_show_room_label,
      quote_show_product_name: form.quote_show_product_name,
      quote_show_fabric_color: form.quote_show_fabric_color,
      quote_show_lift_option: form.quote_show_lift_option,
      quote_show_measurements: false,
      quote_show_quantity: form.quote_show_quantity,
      quote_show_unit_price: form.quote_show_unit_price,
      quote_show_line_total: form.quote_show_line_total,
      quote_show_subtotal: form.quote_show_subtotal,
      quote_show_tax: form.quote_show_tax,
      quote_show_shipping: form.quote_show_shipping,
      quote_show_installation: form.quote_show_installation,
    };

    if (settingsId) {
      await supabase.from("business_settings").update(payload).eq("id", settingsId);
    } else {
      const { data } = await supabase.from("business_settings").insert(payload).select("id").maybeSingle();
      setSettingsId(String((data as { id?: string } | null)?.id ?? ""));
    }

    setStatusMessage("Quote appearance saved.");
    setIsSaving(false);
  }

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Settings" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar
          title="Quote appearance"
          titlePrefix={
            <Link href="/admin/settings" className="text-lg text-stone-400 transition hover:text-stone-700">
              ←
            </Link>
          }
        />

        <div className="space-y-6 p-8">
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">Quote header preview</h2>
            <div className="mt-5 rounded-3xl border border-stone-200 bg-white p-6">
              <div
                className={`flex ${form.quote_logo_position === "center" ? "justify-center" : form.quote_logo_position === "right" ? "justify-end" : "justify-start"}`}
              >
                <div className="flex items-center gap-3">
                  {form.company_logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.company_logo_url} alt="" className="h-10 w-auto object-contain" />
                  ) : (
                    <div className="h-10 w-10 rounded-2xl" style={{ backgroundColor: `${form.primary_color}22` }} />
                  )}
                  {form.quote_show_company_name ? (
                    <div>
                      <p className="text-lg font-semibold text-stone-950">{form.business_name}</p>
                      {form.quote_show_tagline && form.quote_tagline ? (
                        <p style={{ color: form.secondary_color }} className="text-sm">
                          {form.quote_tagline}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              {form.quote_show_address ? (
                <p className="mt-4 text-sm text-stone-500">
                  Address mode: {form.quote_address_mode}
                </p>
              ) : null}
              <div className="mt-5 h-1.5 rounded-full" style={{ backgroundColor: form.primary_color }} />
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">Quote header</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-stone-700">Logo position</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["left", "center", "right"].map((position) => (
                    <button
                      key={position}
                      type="button"
                      onClick={() => update("quote_logo_position", position)}
                      className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
                        form.quote_logo_position === position
                          ? "bg-primary text-white"
                          : "bg-stone-100 text-stone-700"
                      }`}
                    >
                      {position[0]?.toUpperCase() + position.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { key: "quote_show_company_name", label: "Show company name" },
                  { key: "quote_show_address", label: "Show address" },
                  { key: "quote_show_tagline", label: "Show tagline" },
                ].map((toggle) => (
                  <label key={toggle.key} className="flex items-center gap-3 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={Boolean(form[toggle.key as keyof typeof defaults])}
                      onChange={(event) => update(toggle.key as keyof typeof defaults, event.target.checked as never)}
                      className="h-4 w-4 accent-[#FF4900]"
                    />
                    <span>{toggle.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-stone-700">Address mode</label>
                <select
                  value={form.quote_address_mode}
                  onChange={(event) => update("quote_address_mode", event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
                >
                  <option value="ellsworth">Ellsworth</option>
                  <option value="lindsay">Lindsay</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700">Tagline</label>
                <input
                  value={form.quote_tagline}
                  onChange={(event) => update("quote_tagline", event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">Colors</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-stone-700">Primary color</label>
                <div className="mt-2 flex items-center gap-3">
                  <input type="color" value={form.primary_color} onChange={(event) => update("primary_color", event.target.value)} className="h-12 w-14 rounded-xl border border-stone-200 bg-white" />
                  <input value={form.primary_color} onChange={(event) => update("primary_color", event.target.value)} className="min-h-12 flex-1 rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700">Secondary color</label>
                <div className="mt-2 flex items-center gap-3">
                  <input type="color" value={form.secondary_color} onChange={(event) => update("secondary_color", event.target.value)} className="h-12 w-14 rounded-xl border border-stone-200 bg-white" />
                  <input value={form.secondary_color} onChange={(event) => update("secondary_color", event.target.value)} className="min-h-12 flex-1 rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary" />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">Quote footer</h2>
            <div className="mt-5 grid gap-5">
              <div>
                <label className="text-sm font-medium text-stone-700">Footer text</label>
                <textarea
                  value={form.quote_footer_text}
                  onChange={(event) => update("quote_footer_text", event.target.value)}
                  className="mt-2 min-h-28 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition focus:border-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700">Payment terms</label>
                <textarea
                  value={form.payment_terms_text}
                  onChange={(event) => update("payment_terms_text", event.target.value)}
                  className="mt-2 min-h-28 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition focus:border-primary"
                />
              </div>
              <label className="flex items-center gap-3 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={form.quote_show_payment_terms}
                  onChange={(event) => update("quote_show_payment_terms", event.target.checked)}
                  className="h-4 w-4 accent-[#FF4900]"
                />
                <span>Show payment terms on quote</span>
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">What shows on customer quote</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                ["quote_show_room_label", "Show product room label", false],
                ["quote_show_product_name", "Show product name", false],
                ["quote_show_fabric_color", "Show fabric/color", false],
                ["quote_show_lift_option", "Show lift option", false],
                ["quote_show_measurements", "Show measurements (width/height)", true],
                ["quote_show_quantity", "Show quantity", false],
                ["quote_show_unit_price", "Show unit price", false],
                ["quote_show_line_total", "Show line total", false],
                ["quote_show_subtotal", "Show subtotal", false],
                ["quote_show_tax", "Show tax", false],
                ["quote_show_shipping", "Show shipping", false],
                ["quote_show_installation", "Show installation", false],
              ].map(([key, label, locked]) => (
                <label key={String(key)} className="flex items-center justify-between rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-700">
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={locked ? false : Boolean(form[key as keyof typeof defaults])}
                    disabled={Boolean(locked)}
                    onChange={(event) => update(key as keyof typeof defaults, event.target.checked as never)}
                    className="h-4 w-4 accent-[#FF4900] disabled:opacity-50"
                  />
                </label>
              ))}
            </div>
          </section>

          <div className="flex items-center justify-between gap-3">
            {statusMessage ? <p className="text-sm text-emerald-600">{statusMessage}</p> : <span />}
            <button
              type="button"
              onClick={() => void handleSave()}
              className="min-h-12 rounded-2xl bg-primary px-5 text-sm font-semibold text-white"
            >
              {isSaving ? "Saving..." : "Save appearance"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
