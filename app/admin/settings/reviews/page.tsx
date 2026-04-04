"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { supabase } from "@/lib/supabase";

const defaultMessage =
  "Thank you for choosing [business_name]! We hope you love your new window treatments. Would you mind leaving us a quick review? It means the world to us! [review_link]";

type BusinessSettingsRecord = {
  id: string;
  business_name: string | null;
  review_url: string | null;
  review_platform: string | null;
  review_sms_message: string | null;
};

export default function ReviewsSettingsPage() {
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("Nelo");
  const [platform, setPlatform] = useState("Google");
  const [reviewUrl, setReviewUrl] = useState("");
  const [message, setMessage] = useState(defaultMessage);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    async function loadSettings() {
      const { data } = await supabase
        .from("business_settings")
        .select("id, business_name, review_url, review_platform, review_sms_message")
        .limit(1)
        .maybeSingle();

      const record = data as BusinessSettingsRecord | null;
      if (!record) {
        return;
      }

      setSettingsId(record.id);
      setBusinessName(record.business_name || "Nelo");
      setPlatform(record.review_platform || "Google");
      setReviewUrl(record.review_url || "");
      setMessage(record.review_sms_message || defaultMessage);
    }

    void loadSettings();
  }, []);

  const isOverLimit = message.length > 160;
  const previewHref = reviewUrl || "#";
  const mergePreview = useMemo(
    () =>
      message
        .replaceAll("[business_name]", businessName || "Nelo")
        .replaceAll("[review_link]", reviewUrl || "[review_link]"),
    [businessName, message, reviewUrl],
  );

  async function handleSave() {
    setIsSaving(true);
    setStatusMessage("");

    const payload = {
      review_url: reviewUrl || null,
      review_platform: platform,
      review_sms_message: message,
    };

    const response = settingsId
      ? await supabase.from("business_settings").update(payload).eq("id", settingsId)
      : await supabase
          .from("business_settings")
          .insert(payload)
          .select("id")
          .maybeSingle();

    if ("data" in response && response.data && !settingsId) {
      setSettingsId(String((response.data as { id?: string } | null)?.id ?? ""));
    }

    setStatusMessage("Review settings saved.");
    setIsSaving(false);
  }

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Settings" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar
          title="Reviews & customer feedback"
          titlePrefix={
            <Link href="/admin/settings" className="text-lg text-stone-400 transition hover:text-stone-700">
              ←
            </Link>
          }
        />

        <div className="space-y-6 p-8">
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">
              Review link
            </h2>

            <div className="mt-5 grid gap-5">
              <div>
                <label className="text-sm font-medium text-stone-700">Review platform</label>
                <select
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
                >
                  {["Google", "Yelp", "Facebook", "Houzz", "Other"].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-stone-700">Review URL</label>
                <input
                  value={reviewUrl}
                  onChange={(event) => setReviewUrl(event.target.value)}
                  placeholder="https://g.page/r/your-business/review"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
                />
                <p className="mt-2 text-sm text-stone-500">
                  This link is sent to customers via SMS after a successful installation sign-off
                </p>
              </div>

              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => window.open(previewHref, "_blank", "noopener,noreferrer")}
                  disabled={!reviewUrl}
                  className="min-h-12 rounded-2xl border border-stone-200 px-4 text-sm font-medium text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Preview link
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">
              Review request message
            </h2>

            <div className="mt-5">
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  [business_name]
                </span>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  [review_link]
                </span>
              </div>

              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="min-h-40 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-primary"
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                <p className={isOverLimit ? "text-rose-600" : "text-stone-500"}>
                  {message.length} / 160 characters
                </p>
                {isOverLimit ? (
                  <p className="text-rose-600">This message is over the standard 160-character SMS limit.</p>
                ) : null}
              </div>

              <div className="mt-4 rounded-2xl bg-stone-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                  Preview
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-700">{mergePreview}</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              {statusMessage ? <p className="text-sm text-emerald-600">{statusMessage}</p> : <span />}
              <button
                type="button"
                onClick={() => void handleSave()}
                className="min-h-12 rounded-2xl bg-primary px-5 text-sm font-semibold text-white"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
