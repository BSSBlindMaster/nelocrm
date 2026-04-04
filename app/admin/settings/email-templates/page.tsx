"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { supabase } from "@/lib/supabase";

type TemplateSettings = {
  id: string;
  business_name: string | null;
  quote_email_subject: string | null;
  quote_email_body: string | null;
  appointment_email_subject: string | null;
  appointment_email_body: string | null;
  install_email_subject: string | null;
  install_email_body: string | null;
  install_on_my_way_sms: string | null;
};

const defaults = {
  quote_email_subject: "Your Nelo quote [quote_number]",
  quote_email_body:
    "Hi [customer_name],\n\nYour quote [quote_number] is ready. Total: [quote_total].\n\nThanks,\n[rep_name]\n[business_name]\n[quote_link]",
  appointment_email_subject: "Your appointment is booked for [date]",
  appointment_email_body:
    "Hi [customer_name],\n\nYour appointment is confirmed for [date] during the [slot] window with [rep_name] at [address].\n\nThank you,\n[business_name]",
  install_email_subject: "Installation scheduled for [date]",
  install_email_body:
    "Hi [customer_name],\n\nYour installation is scheduled for [date] with [installer_name] during [time_window].\n\nThanks,\n[business_name]",
  install_on_my_way_sms: "Hi [customer_name], this is [installer_name] from [business_name]. I’m on my way and will arrive during [time_window].",
};

function MergeTag({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
      {label}
    </span>
  );
}

export default function EmailTemplatesPage() {
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("Nelo");
  const [form, setForm] = useState(defaults);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadTemplates() {
      const { data } = await supabase.from("business_settings").select("*").limit(1).maybeSingle();
      const record = data as TemplateSettings | null;
      if (!record) return;

      setSettingsId(record.id);
      setBusinessName(record.business_name || "Nelo");
      setForm({
        quote_email_subject: record.quote_email_subject || defaults.quote_email_subject,
        quote_email_body: record.quote_email_body || defaults.quote_email_body,
        appointment_email_subject:
          record.appointment_email_subject || defaults.appointment_email_subject,
        appointment_email_body: record.appointment_email_body || defaults.appointment_email_body,
        install_email_subject: record.install_email_subject || defaults.install_email_subject,
        install_email_body: record.install_email_body || defaults.install_email_body,
        install_on_my_way_sms: record.install_on_my_way_sms || defaults.install_on_my_way_sms,
      });
    }

    void loadTemplates();
  }, []);

  function update<Key extends keyof typeof defaults>(key: Key, value: (typeof defaults)[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const quotePreview = useMemo(
    () =>
      form.quote_email_body
        .replaceAll("[customer_name]", "Jordan Carter")
        .replaceAll("[quote_number]", "NEL2604041824")
        .replaceAll("[quote_total]", "$8,240")
        .replaceAll("[rep_name]", "Ava Chen")
        .replaceAll("[business_name]", businessName)
        .replaceAll("[quote_link]", "https://nelo.example/quotes/123"),
    [businessName, form.quote_email_body],
  );

  async function handleSave() {
    setIsSaving(true);
    setStatusMessage("");

    if (settingsId) {
      await supabase.from("business_settings").update(form).eq("id", settingsId);
    } else {
      const { data } = await supabase.from("business_settings").insert(form).select("id").maybeSingle();
      setSettingsId(String((data as { id?: string } | null)?.id ?? ""));
    }

    setStatusMessage("Email templates saved.");
    setIsSaving(false);
  }

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Settings" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar
          title="Email templates"
          titlePrefix={
            <Link href="/admin/settings" className="text-lg text-stone-400 transition hover:text-stone-700">
              ←
            </Link>
          }
        />

        <div className="space-y-6 p-8">
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-stone-950">Quote email</h2>
              <div className="flex flex-wrap gap-2">
                {["[customer_name]", "[quote_number]", "[quote_total]", "[rep_name]", "[business_name]", "[quote_link]"].map((tag) => (
                  <MergeTag key={tag} label={tag} />
                ))}
              </div>
            </div>
            <div className="mt-5 grid gap-4">
              <input
                value={form.quote_email_subject}
                onChange={(event) => update("quote_email_subject", event.target.value)}
                className="min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
              />
              <textarea
                value={form.quote_email_body}
                onChange={(event) => update("quote_email_body", event.target.value)}
                className="min-h-40 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-primary"
              />
              <div className="rounded-2xl bg-stone-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Preview</p>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-stone-700">{quotePreview}</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-stone-950">Appointment confirmation</h2>
              <div className="flex flex-wrap gap-2">
                {["[customer_name]", "[date]", "[slot]", "[rep_name]", "[address]", "[business_name]"].map((tag) => (
                  <MergeTag key={tag} label={tag} />
                ))}
              </div>
            </div>
            <div className="mt-5 grid gap-4">
              <input
                value={form.appointment_email_subject}
                onChange={(event) => update("appointment_email_subject", event.target.value)}
                className="min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
              />
              <textarea
                value={form.appointment_email_body}
                onChange={(event) => update("appointment_email_body", event.target.value)}
                className="min-h-36 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-primary"
              />
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-stone-950">Installation notification</h2>
              <div className="flex flex-wrap gap-2">
                {["[customer_name]", "[date]", "[installer_name]", "[time_window]", "[business_name]"].map((tag) => (
                  <MergeTag key={tag} label={tag} />
                ))}
              </div>
            </div>
            <div className="mt-5 grid gap-4">
              <input
                value={form.install_email_subject}
                onChange={(event) => update("install_email_subject", event.target.value)}
                className="min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
              />
              <textarea
                value={form.install_email_body}
                onChange={(event) => update("install_email_body", event.target.value)}
                className="min-h-36 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-primary"
              />
              <div>
                <label className="text-sm font-medium text-stone-700">On my way SMS template</label>
                <textarea
                  value={form.install_on_my_way_sms}
                  onChange={(event) => update("install_on_my_way_sms", event.target.value.slice(0, 160))}
                  className="mt-2 min-h-28 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-primary"
                />
                <p className={`mt-2 text-sm ${form.install_on_my_way_sms.length > 160 ? "text-rose-600" : "text-stone-500"}`}>
                  {form.install_on_my_way_sms.length} / 160 characters
                </p>
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
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
