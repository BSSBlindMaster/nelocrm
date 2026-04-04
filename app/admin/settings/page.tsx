"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { supabase } from "@/lib/supabase";

type BusinessSettingsRecord = {
  business_name?: string | null;
  primary_phone?: string | null;
  primary_email?: string | null;
  company_logo_url?: string | null;
  primary_color?: string | null;
  quote_logo_position?: string | null;
  quote_show_payment_terms?: boolean | null;
  terms_and_conditions?: string | null;
  quote_email_subject?: string | null;
  deposit_percentage?: number | null;
  ellsworth_tax_rate?: number | null;
  lindsay_tax_rate?: number | null;
  review_platform?: string | null;
  review_url?: string | null;
};

type PricingPreview = {
  manufacturerCount: number;
  averageCostFactor: number;
  averageDefaultMargin: number;
  averageMinimumMargin: number;
};

function SettingIcon({ label }: { label: string }) {
  return (
    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
      {label}
    </div>
  );
}

function PreviewText({ children }: { children: string }) {
  return <p className="mt-3 text-sm leading-6 text-stone-500">{children}</p>;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<BusinessSettingsRecord | null>(null);
  const [pricingPreview, setPricingPreview] = useState<PricingPreview>({
    manufacturerCount: 0,
    averageCostFactor: 0,
    averageDefaultMargin: 0,
    averageMinimumMargin: 0,
  });

  useEffect(() => {
    async function loadSettingsPage() {
      const [settingsResponse, pricingResponse] = await Promise.all([
        supabase.from("business_settings").select("*").limit(1).maybeSingle(),
        supabase
          .from("pricing_settings")
          .select("manufacturer_id, cost_factor, default_margin, minimum_margin"),
      ]);

      setSettings((settingsResponse.data as BusinessSettingsRecord | null) ?? null);

      const pricingRows =
        (pricingResponse.data as Array<{
          manufacturer_id?: string | null;
          cost_factor?: number | null;
          default_margin?: number | null;
          minimum_margin?: number | null;
        }> | null) ?? [];

      if (pricingRows.length > 0) {
        setPricingPreview({
          manufacturerCount: pricingRows.length,
          averageCostFactor:
            pricingRows.reduce((sum, row) => sum + Number(row.cost_factor ?? 0), 0) /
            pricingRows.length,
          averageDefaultMargin:
            pricingRows.reduce((sum, row) => sum + Number(row.default_margin ?? 0), 0) /
            pricingRows.length,
          averageMinimumMargin:
            pricingRows.reduce((sum, row) => sum + Number(row.minimum_margin ?? 0), 0) /
            pricingRows.length,
        });
      }
    }

    void loadSettingsPage();
  }, []);

  const cards = useMemo(
    () => [
      {
        title: "Company profile",
        description: "Name, logo, contact details, and Ellsworth/Lindsay location info.",
        href: "/admin/settings/company",
        icon: "Co",
        preview: settings?.business_name
          ? `${settings.business_name} · ${settings.primary_phone || "No phone set"}`
          : "Set your company identity and location details.",
      },
      {
        title: "Quote appearance",
        description: "Control quote header layout, brand colors, footer, and visible customer fields.",
        href: "/admin/settings/quote-appearance",
        icon: "Qa",
        preview: `${settings?.quote_logo_position || "left"} logo · primary ${settings?.primary_color || "#FF4900"}`,
      },
      {
        title: "Terms & conditions",
        description: "Manage quote terms, disclaimer text, and signature section copy.",
        href: "/admin/settings/terms",
        icon: "Tc",
        preview: settings?.terms_and_conditions
          ? `${settings.terms_and_conditions.length} characters configured`
          : "No terms configured yet.",
      },
      {
        title: "Email templates",
        description: "Quote, appointment, and install email/SMS templates with merge tags.",
        href: "/admin/settings/email-templates",
        icon: "Em",
        preview: settings?.quote_email_subject || "No quote email subject configured yet.",
      },
      {
        title: "Payment & billing",
        description: "Deposit percentage and payment terms text used on customer-facing quotes.",
        href: "/admin/settings/quote-appearance",
        icon: "Pb",
        preview: `${Number(settings?.deposit_percentage ?? 50).toFixed(0)}% deposit · ${settings?.quote_show_payment_terms ? "terms shown" : "terms hidden"}`,
      },
      {
        title: "Tax settings",
        description: "Maintain tax rates for Ellsworth and Lindsay quote calculations.",
        href: "/admin/settings/company",
        icon: "Tx",
        preview: `Ellsworth ${(Number(settings?.ellsworth_tax_rate ?? 0.0875) * 100).toFixed(2)}% · Lindsay ${(Number(settings?.lindsay_tax_rate ?? 0.0875) * 100).toFixed(2)}%`,
      },
      {
        title: "Labor & job costing",
        description: "Set installer rates and labor rules used in project costing.",
        href: "/admin/settings/labor",
        icon: "Lb",
        preview: "Installer default labor rate and overrides.",
      },
      {
        title: "Reviews & feedback",
        description: "Configure review platform, link, and post-install review request message.",
        href: "/admin/settings/reviews",
        icon: "Rv",
        preview: settings?.review_platform
          ? `${settings.review_platform} · ${settings.review_url || "No link yet"}`
          : "No review platform configured.",
      },
      {
        title: "Users & roles",
        description: "Manage team members, role access, and admin permissions.",
        href: "/admin/users",
        icon: "Ur",
        preview: "Invite staff and manage permissions.",
      },
      {
        title: "Product catalog",
        description: "Manufacturers, fabrics, lift options, and product configuration.",
        href: "/admin/catalog",
        icon: "Pc",
        preview: "Maintain manufacturers and product data.",
      },
      {
        title: "Pricing & margins",
        description: "Manufacturer pricing settings, shipping rules, and profit targets.",
        href: "/admin/settings/pricing",
        icon: "Pm",
        preview:
          pricingPreview.manufacturerCount > 0
            ? `${pricingPreview.manufacturerCount} manufacturers · avg margin ${(pricingPreview.averageDefaultMargin * 100).toFixed(0)}%`
            : "No pricing rules configured yet.",
      },
    ],
    [pricingPreview, settings],
  );

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Settings" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar title="Settings" />

        <div className="space-y-6 p-8">
          <div className="max-w-3xl">
            <p className="text-sm leading-6 text-stone-500">
              Configure how Nelo presents your company, prices quotes, communicates with customers,
              and manages internal operations.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {cards.map((card) => (
              <article
                key={card.title}
                className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <SettingIcon label={card.icon} />
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight text-stone-950">
                        {card.title}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-stone-500">{card.description}</p>
                      <PreviewText>{card.preview}</PreviewText>
                    </div>
                  </div>
                  <Link
                    href={card.href}
                    className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-primary hover:text-primary"
                  >
                    Edit
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
