"use client";

import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

const settingsCards = [
  {
    title: "Company setup",
    description: "Manage company name, logo, locations, and brand colors.",
    href: "/admin/settings/company",
  },
  {
    title: "Users & roles",
    description: "Invite team members, assign roles, and review access.",
    href: "/admin/users",
  },
  {
    title: "Pricing & margins",
    description: "Set default pricing rules, margins, and quoting controls.",
    href: "/admin/pricing",
  },
  {
    title: "Tax settings",
    description: "Configure tax rates, exemptions, and location-based rules.",
    href: "/admin/tax",
  },
  {
    title: "Product catalog",
    description: "Maintain manufacturers, products, fabrics, and options.",
    href: "/admin/catalog",
  },
  {
    title: "Email & notifications",
    description: "Control invites, alerts, reminders, and notification defaults.",
    href: "/admin/settings/notifications",
  },
  {
    title: "Billing & subscription",
    description: "Review plan details, billing contacts, and subscription status.",
    href: "/admin/settings/billing",
  },
] as const;

export default function AdminSettingsPage() {
  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Settings" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar title="Settings" />

        <div className="p-8">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {settingsCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="group flex min-h-[190px] flex-col rounded-3xl border border-stone-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-stone-950">
                      {card.title}
                    </h2>
                    <p className="mt-3 max-w-xs text-sm leading-6 text-stone-500">
                      {card.description}
                    </p>
                  </div>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg text-primary transition group-hover:bg-primary group-hover:text-white">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
