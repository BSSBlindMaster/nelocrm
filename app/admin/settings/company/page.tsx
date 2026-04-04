"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { supabase } from "@/lib/supabase";

type BusinessSettingsRecord = {
  id: string;
  business_name: string | null;
  primary_phone: string | null;
  primary_email: string | null;
  website_url: string | null;
  company_logo_url: string | null;
  ellsworth_address: string | null;
  ellsworth_phone: string | null;
  ellsworth_email: string | null;
  lindsay_address: string | null;
  lindsay_phone: string | null;
  lindsay_email: string | null;
};

const emptyState = {
  business_name: "",
  primary_phone: "",
  primary_email: "",
  website_url: "",
  company_logo_url: "",
  ellsworth_address: "",
  ellsworth_phone: "",
  ellsworth_email: "",
  lindsay_address: "",
  lindsay_phone: "",
  lindsay_email: "",
};

export default function CompanyProfilePage() {
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyState);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    async function loadCompanySettings() {
      const { data } = await supabase.from("business_settings").select("*").limit(1).maybeSingle();
      const record = data as BusinessSettingsRecord | null;
      if (!record) return;

      setSettingsId(record.id);
      setForm({
        business_name: record.business_name || "",
        primary_phone: record.primary_phone || "",
        primary_email: record.primary_email || "",
        website_url: record.website_url || "",
        company_logo_url: record.company_logo_url || "",
        ellsworth_address: record.ellsworth_address || "1035 N. Ellsworth Rd., Suite 102, Mesa, AZ 85207",
        ellsworth_phone: record.ellsworth_phone || "",
        ellsworth_email: record.ellsworth_email || "",
        lindsay_address: record.lindsay_address || "",
        lindsay_phone: record.lindsay_phone || "",
        lindsay_email: record.lindsay_email || "",
      });
    }

    void loadCompanySettings();
  }, []);

  function updateField<Key extends keyof typeof emptyState>(key: Key, value: (typeof emptyState)[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setStatusMessage("Logo must be 2MB or smaller.");
      return;
    }

    setIsUploading(true);
    setStatusMessage("");

    const extension = file.name.split(".").pop() || "png";
    const path = `logos/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("company-assets")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setStatusMessage("Logo upload failed. Make sure the company-assets bucket exists.");
      setIsUploading(false);
      return;
    }

    const { data } = supabase.storage.from("company-assets").getPublicUrl(path);
    updateField("company_logo_url", data.publicUrl);
    setStatusMessage("Logo uploaded. Save changes to apply it.");
    setIsUploading(false);
    event.target.value = "";
  }

  async function handleSave() {
    setIsSaving(true);
    setStatusMessage("");

    const payload = {
      business_name: form.business_name || null,
      primary_phone: form.primary_phone || null,
      primary_email: form.primary_email || null,
      website_url: form.website_url || null,
      company_logo_url: form.company_logo_url || null,
      ellsworth_address: form.ellsworth_address || null,
      ellsworth_phone: form.ellsworth_phone || null,
      ellsworth_email: form.ellsworth_email || null,
      lindsay_address: form.lindsay_address || null,
      lindsay_phone: form.lindsay_phone || null,
      lindsay_email: form.lindsay_email || null,
    };

    if (settingsId) {
      await supabase.from("business_settings").update(payload).eq("id", settingsId);
    } else {
      const { data } = await supabase.from("business_settings").insert(payload).select("id").maybeSingle();
      setSettingsId(String((data as { id?: string } | null)?.id ?? ""));
    }

    setStatusMessage("Company profile saved.");
    setIsSaving(false);
  }

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Settings" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar
          title="Company profile"
          titlePrefix={
            <Link href="/admin/settings" className="text-lg text-stone-400 transition hover:text-stone-700">
              ←
            </Link>
          }
        />

        <div className="space-y-6 p-8">
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">Business info</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-stone-700">Business name</label>
                <input
                  value={form.business_name}
                  onChange={(event) => updateField("business_name", event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700">Primary phone</label>
                <input
                  value={form.primary_phone}
                  onChange={(event) => updateField("primary_phone", event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700">Primary email</label>
                <input
                  value={form.primary_email}
                  onChange={(event) => updateField("primary_email", event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700">Website URL</label>
                <input
                  value={form.website_url}
                  onChange={(event) => updateField("website_url", event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">Logo</h2>
            <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_320px]">
              <div>
                <div className="overflow-hidden rounded-3xl border border-stone-200 bg-stone-50">
                  <div className="flex min-h-[180px] items-center justify-center bg-white p-6">
                    {form.company_logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.company_logo_url} alt="Company logo preview" className="max-h-28 object-contain" />
                    ) : (
                      <span className="text-sm text-stone-400">No logo uploaded yet</span>
                    )}
                  </div>
                  <div className="grid gap-4 border-t border-stone-200 p-5 md:grid-cols-2">
                    <div className="rounded-2xl bg-[#1C1C1C] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/40">Sidebar preview</p>
                      <div className="mt-4 flex items-center gap-3">
                        {form.company_logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={form.company_logo_url} alt="" className="h-8 w-auto object-contain" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-primary/20" />
                        )}
                        <span className="text-lg font-light tracking-[-0.5px] text-white">
                          {form.business_name || "nelo"}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Quote preview</p>
                      <div className="mt-4 flex items-center gap-3">
                        {form.company_logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={form.company_logo_url} alt="" className="h-8 w-auto object-contain" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-primary/10" />
                        )}
                        <div>
                          <p className="font-semibold text-stone-900">{form.business_name || "Your company"}</p>
                          <p className="text-sm text-stone-500">{form.primary_phone || "Phone number"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
                <p className="text-sm leading-6 text-stone-500">
                  Upload a PNG, JPG, or SVG up to 2MB. The file is stored in the Supabase Storage
                  bucket named <span className="font-medium text-stone-700">company-assets</span>.
                </p>
                <label className="mt-5 inline-flex min-h-12 cursor-pointer items-center rounded-2xl bg-primary px-5 text-sm font-semibold text-white">
                  {isUploading ? "Uploading..." : "Upload new logo"}
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                <input
                  value={form.company_logo_url}
                  onChange={(event) => updateField("company_logo_url", event.target.value)}
                  placeholder="Or paste a logo URL"
                  className="mt-4 min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm outline-none transition focus:border-primary"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">Locations</h2>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {[
                {
                  key: "Ellsworth" as const,
                  addressKey: "ellsworth_address" as const,
                  phoneKey: "ellsworth_phone" as const,
                  emailKey: "ellsworth_email" as const,
                },
                {
                  key: "Lindsay" as const,
                  addressKey: "lindsay_address" as const,
                  phoneKey: "lindsay_phone" as const,
                  emailKey: "lindsay_email" as const,
                },
              ].map((location) => (
                <div key={location.key} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
                  <h3 className="text-base font-semibold text-stone-950">{location.key}</h3>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="text-sm font-medium text-stone-700">Full address</label>
                      <textarea
                        value={form[location.addressKey]}
                        onChange={(event) => updateField(location.addressKey, event.target.value)}
                        className="mt-2 min-h-24 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-stone-700">Phone</label>
                      <input
                        value={form[location.phoneKey]}
                        onChange={(event) => updateField(location.phoneKey, event.target.value)}
                        className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm outline-none transition focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-stone-700">Email</label>
                      <input
                        value={form[location.emailKey]}
                        onChange={(event) => updateField(location.emailKey, event.target.value)}
                        className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm outline-none transition focus:border-primary"
                      />
                    </div>
                  </div>
                </div>
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
              {isSaving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
