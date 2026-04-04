"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { supabase } from "@/lib/supabase";

type TermsSettings = {
  id: string;
  terms_and_conditions: string | null;
  disclaimer_text: string | null;
};

const defaultDisclaimer =
  "I understand that all window treatments are custom fabricated and non-refundable";

export default function TermsSettingsPage() {
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [terms, setTerms] = useState("");
  const [disclaimer, setDisclaimer] = useState(defaultDisclaimer);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadTermsSettings() {
      const { data } = await supabase
        .from("business_settings")
        .select("id, terms_and_conditions, disclaimer_text")
        .limit(1)
        .maybeSingle();

      const record = data as TermsSettings | null;
      if (!record) return;

      setSettingsId(record.id);
      setTerms(record.terms_and_conditions || "");
      setDisclaimer(record.disclaimer_text || defaultDisclaimer);
    }

    void loadTermsSettings();
  }, []);

  async function handleSave() {
    setIsSaving(true);
    setStatusMessage("");

    const payload = {
      terms_and_conditions: terms || null,
      disclaimer_text: disclaimer || null,
    };

    if (settingsId) {
      await supabase.from("business_settings").update(payload).eq("id", settingsId);
    } else {
      const { data } = await supabase.from("business_settings").insert(payload).select("id").maybeSingle();
      setSettingsId(String((data as { id?: string } | null)?.id ?? ""));
    }

    setStatusMessage("Terms and disclaimer saved.");
    setIsSaving(false);
  }

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Settings" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar
          title="Terms & conditions"
          titlePrefix={
            <Link href="/admin/settings" className="text-lg text-stone-400 transition hover:text-stone-700">
              ←
            </Link>
          }
        />

        <div className="space-y-6 p-8">
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <label className="text-sm font-medium text-stone-700">Terms & conditions</label>
            <textarea
              value={terms}
              onChange={(event) => setTerms(event.target.value)}
              className="mt-2 min-h-[220px] w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-primary"
            />
            <p className="mt-3 text-sm text-stone-500">{terms.length} characters</p>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <label className="text-sm font-medium text-stone-700">Disclaimer text</label>
            <textarea
              value={disclaimer}
              onChange={(event) => setDisclaimer(event.target.value)}
              className="mt-2 min-h-[180px] w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-primary"
            />
            <p className="mt-3 text-sm text-stone-500">{disclaimer.length} characters</p>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">Preview</h2>
            <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <div className="max-h-[150px] overflow-y-auto rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm leading-6 text-stone-600">
                {terms || "Your terms will appear here."}
              </div>
              <label className="mt-4 flex items-start gap-3 text-sm text-stone-700">
                <input type="checkbox" checked readOnly className="mt-1 h-4 w-4 accent-[#FF4900]" />
                <span>{disclaimer || defaultDisclaimer}</span>
              </label>
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
