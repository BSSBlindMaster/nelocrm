"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { MAPBOX_TOKEN } from "@/lib/mapbox";
import { supabase } from "@/lib/supabase";

const AddressAutofill = dynamic(
  () => import("@mapbox/search-js-react").then((module) => module.AddressAutofill),
  { ssr: false },
);

const filters = ["All", "Customers", "Leads", "VIP"] as const;

const usStates = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
] as const;

const primaryLeadSources = [
  "Google My Business (GMB)",
  "Google Ads",
  "Facebook Ad",
  "Instagram Ad",
  "The Home Mag",
  "Home Show / Event",
  "Website Organic",
  "Repeat Customer",
  "Referral",
  "G4 Marketing",
  "Email Marketing (G4)",
  "Walk-in",
  "Other",
] as const;

const customerStatuses = ["New", "Repeat", "Referral"] as const;

type CustomerRecord = {
  id: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  spouse_name?: string | null;
  phone?: string | null;
  phone_mobile?: string | null;
  phone_home?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  location?: string | null;
  type?: string | null;
  lead_source_primary?: string | null;
  lead_source_secondary?: string | null;
  customer_status?: string | null;
  referred_by_id?: string | null;
  referral_reward_sent?: boolean | null;
  referral_reward_sent_date?: string | null;
  lead_campaign?: string | null;
  ok_to_call?: boolean | null;
  ok_to_text?: boolean | null;
  ok_to_email?: boolean | null;
  ok_to_mail?: boolean | null;
  do_not_contact?: boolean | null;
  opt_out_date?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type QuoteRecord = {
  id: string;
  customer_id: string | null;
  status: string | null;
  total: number | null;
  created_at: string | null;
};

type CustomerStats = {
  totalQuotes: number;
  lifetimeValue: number;
  recentQuotes: QuoteRecord[];
  lastActivityLabel: string;
};

type CustomerFormState = {
  first_name: string;
  last_name: string;
  spouse_name: string;
  phone: string;
  phone_mobile: string;
  phone_home: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  location: "Ellsworth" | "Lindsay" | "";
  type: "Customer" | "Lead" | "VIP";
  lead_source_primary: string;
  lead_source_secondary: string;
  customer_status: "New" | "Repeat" | "Referral";
  referred_by_id: string | null;
  referral_reward_sent: boolean;
  referral_reward_sent_date: string | null;
  lead_campaign: string;
  ok_to_call: boolean;
  ok_to_text: boolean;
  ok_to_email: boolean;
  ok_to_mail: boolean;
  do_not_contact: boolean;
  opt_out_date: string | null;
  notes: string;
};

type SectionKey =
  | "contact"
  | "address"
  | "lead"
  | "communication"
  | "notes";

const emptyForm: CustomerFormState = {
  first_name: "",
  last_name: "",
  spouse_name: "",
  phone: "",
  phone_mobile: "",
  phone_home: "",
  email: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  location: "",
  type: "Customer",
  lead_source_primary: "",
  lead_source_secondary: "",
  customer_status: "New",
  referred_by_id: null,
  referral_reward_sent: false,
  referral_reward_sent_date: null,
  lead_campaign: "",
  ok_to_call: true,
  ok_to_text: true,
  ok_to_email: true,
  ok_to_mail: true,
  do_not_contact: false,
  opt_out_date: null,
  notes: "",
};

function getFullName(customer: Partial<CustomerRecord>) {
  const fullNameFromParts = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullNameFromParts || customer.name?.trim() || "Unnamed Customer";
}

function getTone(type: string | null | undefined) {
  const normalized = (type ?? "").toLowerCase();

  if (normalized === "vip") {
    return "vip";
  }

  if (normalized === "lead") {
    return "lead";
  }

  return "customer";
}

function getFilterValue(type: string | null | undefined) {
  const normalized = (type ?? "").toLowerCase();

  if (normalized === "vip") {
    return "VIP";
  }

  if (normalized === "lead") {
    return "Leads";
  }

  return "Customers";
}

function getBadgeLabel(type: string | null | undefined) {
  const normalized = (type ?? "").toLowerCase();

  if (normalized === "vip") {
    return "VIP";
  }

  if (normalized === "lead") {
    return "Lead";
  }

  return "Customer";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatAddress(customer: Partial<CustomerRecord>) {
  return [customer.address, customer.city, customer.state, customer.zip]
    .filter(Boolean)
    .join(", ");
}

function getLocationTone(location: string | null | undefined) {
  if ((location ?? "").toLowerCase() === "lindsay") {
    return "active";
  }

  return "customer";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatRelativeLabel(dateString: string | null | undefined) {
  if (!dateString) {
    return "No recent quote activity";
  }

  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildStatsMap(quotes: QuoteRecord[]) {
  return quotes.reduce<Record<string, CustomerStats>>((accumulator, quote) => {
    if (!quote.customer_id) {
      return accumulator;
    }

    const existing =
      accumulator[quote.customer_id] ??
      ({
        totalQuotes: 0,
        lifetimeValue: 0,
        recentQuotes: [],
        lastActivityLabel: "No recent quote activity",
      } satisfies CustomerStats);

    existing.totalQuotes += 1;

    if ((quote.status ?? "").toLowerCase() === "ordered") {
      existing.lifetimeValue += Number(quote.total ?? 0);
    }

    existing.recentQuotes = [...existing.recentQuotes, quote]
      .sort((left, right) => {
        return (
          new Date(right.created_at ?? 0).getTime() -
          new Date(left.created_at ?? 0).getTime()
        );
      })
      .slice(0, 5);

    existing.lastActivityLabel =
      existing.recentQuotes.length > 0
        ? `${existing.recentQuotes[0].status ?? "Quote"} • ${formatRelativeLabel(existing.recentQuotes[0].created_at)}`
        : "No recent quote activity";

    accumulator[quote.customer_id] = existing;
    return accumulator;
  }, {});
}

function getAutofillValue(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

function Section({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-4 text-left"
      >
        <span className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
          {title}
        </span>
        <span className="text-stone-400">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen ? <div className="border-t border-stone-200 px-4 py-4">{children}</div> : null}
    </section>
  );
}

function PreferenceRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
      <div>
        <p className="text-sm font-medium text-stone-950">{label}</p>
        <p className="mt-1 text-sm text-stone-500">{description}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onChange}
        className={`relative h-7 w-12 rounded-full transition ${
          checked ? "bg-primary" : "bg-stone-300"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function CommunicationIcon({
  allowed,
  label,
}: {
  allowed: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-stone-600">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
          allowed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
        }`}
      >
        {allowed ? "✓" : "×"}
      </span>
      <span>{label}</span>
    </div>
  );
}

function CustomerFormDrawer({
  isOpen,
  mode,
  form,
  referredByName,
  referredSearch,
  referredMatches,
  sections,
  isSaving,
  isDeleting,
  isConfirmingDelete,
  onSectionToggle,
  onChange,
  onCommunicationToggle,
  onReferralRewardToggle,
  onRetrieveAddress,
  onReferredSearchChange,
  onSelectReferredCustomer,
  onClearReferredCustomer,
  onCancel,
  onSave,
  onDelete,
  onDeleteCancel,
}: {
  isOpen: boolean;
  mode: "create" | "edit";
  form: CustomerFormState;
  referredByName: string;
  referredSearch: string;
  referredMatches: CustomerRecord[];
  sections: Record<SectionKey, boolean>;
  isSaving: boolean;
  isDeleting: boolean;
  isConfirmingDelete: boolean;
  onSectionToggle: (section: SectionKey) => void;
  onChange: <Key extends keyof CustomerFormState>(
    key: Key,
    value: CustomerFormState[Key],
  ) => void;
  onCommunicationToggle: (
    key:
      | "ok_to_call"
      | "ok_to_text"
      | "ok_to_email"
      | "ok_to_mail"
      | "do_not_contact",
  ) => void;
  onReferralRewardToggle: () => void;
  onRetrieveAddress: (result: unknown) => void;
  onReferredSearchChange: (value: string) => void;
  onSelectReferredCustomer: (customer: CustomerRecord) => void;
  onClearReferredCustomer: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
  onDeleteCancel: () => void;
}) {
  return (
    <aside
      className={`fixed inset-y-0 right-0 z-30 w-full max-w-2xl border-l border-stone-200 bg-stone-100 shadow-2xl transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-stone-200 bg-white px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
                Customer
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">
                {mode === "create" ? "Add customer" : "Edit customer"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-500"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {form.do_not_contact ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
              This customer has requested no contact — all communications are blocked
            </div>
          ) : null}

          <Section
            title="Contact Information"
            isOpen={sections.contact}
            onToggle={() => onSectionToggle("contact")}
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700">
                    First name
                  </label>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(event) => onChange("first_name", event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700">
                    Last name
                  </label>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(event) => onChange("last_name", event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700">
                    Spouse / partner name
                  </label>
                  <input
                    type="text"
                    value={form.spouse_name}
                    onChange={(event) => onChange("spouse_name", event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700">
                    Customer type
                  </label>
                  <select
                    value={form.type}
                    onChange={(event) =>
                      onChange("type", event.target.value as CustomerFormState["type"])
                    }
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  >
                    <option value="Customer">Customer</option>
                    <option value="Lead">Lead</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-stone-700">
                  Location
                </label>
                <select
                  value={form.location}
                  onChange={(event) =>
                    onChange("location", event.target.value as CustomerFormState["location"])
                  }
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                >
                  <option value="">Select location</option>
                  <option value="Ellsworth">Ellsworth</option>
                  <option value="Lindsay">Lindsay</option>
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700">
                    Primary phone
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(event) => onChange("phone", event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700">
                    Mobile phone
                  </label>
                  <input
                    type="text"
                    value={form.phone_mobile}
                    onChange={(event) => onChange("phone_mobile", event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => onChange("email", event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700">
                    Home phone
                  </label>
                  <input
                    type="text"
                    value={form.phone_home}
                    onChange={(event) => onChange("phone_home", event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="Address"
            isOpen={sections.address}
            onToggle={() => onSectionToggle("address")}
          >
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-stone-700">
                  Street address
                </label>
                <AddressAutofill accessToken={MAPBOX_TOKEN} onRetrieve={onRetrieveAddress}>
                  <input
                    type="text"
                    autoComplete="address-line1"
                    value={form.address}
                    onChange={(event) => onChange("address", event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </AddressAutofill>
              </div>

              <div className="grid gap-4 md:grid-cols-[1.2fr_120px_140px]">
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700">City</label>
                  <input
                    type="text"
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={(event) => onChange("city", event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700">State</label>
                  <select
                    autoComplete="address-level1"
                    value={form.state}
                    onChange={(event) => onChange("state", event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  >
                    <option value="">State</option>
                    {usStates.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700">Zip</label>
                  <input
                    type="text"
                    autoComplete="postal-code"
                    value={form.zip}
                    onChange={(event) => onChange("zip", event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="Lead Source"
            isOpen={sections.lead}
            onToggle={() => onSectionToggle("lead")}
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700">
                    Primary source
                  </label>
                  <select
                    value={form.lead_source_primary}
                    onChange={(event) => onChange("lead_source_primary", event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  >
                    <option value="">Select source</option>
                    {primaryLeadSources.map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700">
                    Secondary source
                  </label>
                  <input
                    type="text"
                    value={form.lead_source_secondary}
                    onChange={(event) => onChange("lead_source_secondary", event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    placeholder='Type specifics like "Spring Home Show 2026"'
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700">
                    Customer status
                  </label>
                  <select
                    value={form.customer_status}
                    onChange={(event) =>
                      onChange(
                        "customer_status",
                        event.target.value as CustomerFormState["customer_status"],
                      )
                    }
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  >
                    {customerStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700">
                    Campaign notes
                  </label>
                  <input
                    type="text"
                    value={form.lead_campaign}
                    onChange={(event) => onChange("lead_campaign", event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              {form.customer_status === "Referral" ? (
                <div className="space-y-4">
                  <label className="mb-2 block text-sm font-medium text-stone-700">
                    Referred by
                  </label>
                  {form.referred_by_id && referredByName ? (
                    <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                      <span className="text-sm text-stone-700">{referredByName}</span>
                      <button
                        type="button"
                        onClick={onClearReferredCustomer}
                        className="text-sm text-stone-500 transition hover:text-stone-700"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="search"
                        value={referredSearch}
                        onChange={(event) => onReferredSearchChange(event.target.value)}
                        placeholder="Search referred customer"
                        className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none placeholder:text-stone-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                      />
                      {referredSearch ? (
                        <div className="mt-3 overflow-hidden rounded-2xl border border-stone-200">
                          {referredMatches.length > 0 ? (
                            referredMatches.map((customer) => (
                              <button
                                key={customer.id}
                                type="button"
                                onClick={() => onSelectReferredCustomer(customer)}
                                className="flex w-full items-center justify-between bg-white px-4 py-3 text-left text-sm text-stone-700 transition hover:bg-stone-50"
                              >
                                <span>{getFullName(customer)}</span>
                                <span className="text-stone-400">{customer.phone || "No phone"}</span>
                              </button>
                            ))
                          ) : (
                            <div className="bg-white px-4 py-3 text-sm text-stone-400">
                              No matching customers found.
                            </div>
                          )}
                        </div>
                      ) : null}
                    </>
                  )}

                  <PreferenceRow
                    label="Referral reward sent"
                    description="Track whether the referring customer has been thanked"
                    checked={form.referral_reward_sent}
                    onChange={onReferralRewardToggle}
                  />
                </div>
              ) : null}
            </div>
          </Section>

          <Section
            title="Communication Preferences"
            isOpen={sections.communication}
            onToggle={() => onSectionToggle("communication")}
          >
            <div className="space-y-3">
              <PreferenceRow
                label="OK to call"
                description="Customer has consented to phone calls"
                checked={form.ok_to_call}
                disabled={form.do_not_contact}
                onChange={() => onCommunicationToggle("ok_to_call")}
              />
              <PreferenceRow
                label="OK to text (SMS)"
                description="TCPA consent for text messages"
                checked={form.ok_to_text}
                disabled={form.do_not_contact}
                onChange={() => onCommunicationToggle("ok_to_text")}
              />
              <PreferenceRow
                label="OK to email"
                description="CAN-SPAM consent for email marketing"
                checked={form.ok_to_email}
                disabled={form.do_not_contact}
                onChange={() => onCommunicationToggle("ok_to_email")}
              />
              <PreferenceRow
                label="OK to mail"
                description="Physical mail and postcards"
                checked={form.ok_to_mail}
                disabled={form.do_not_contact}
                onChange={() => onCommunicationToggle("ok_to_mail")}
              />
              <PreferenceRow
                label="Do not contact"
                description="Overrides all above — no communications of any kind"
                checked={form.do_not_contact}
                onChange={() => onCommunicationToggle("do_not_contact")}
              />
            </div>
          </Section>

          <Section
            title="Notes"
            isOpen={sections.notes}
            onToggle={() => onSectionToggle("notes")}
          >
            <textarea
              rows={6}
              value={form.notes}
              onChange={(event) => onChange("notes", event.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </Section>
        </div>

        <div className="border-t border-stone-200 bg-white px-6 py-5">
          {mode === "edit" ? (
            <div className="mb-4">
              {isConfirmingDelete ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm text-rose-700">
                    Are you sure? This cannot be undone
                  </p>
                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      onClick={onDelete}
                      disabled={isDeleting}
                      className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isDeleting ? "Deleting..." : "Yes delete"}
                    </button>
                    <button
                      type="button"
                      onClick={onDeleteCancel}
                      className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onDelete}
                  className="text-sm text-rose-600 transition hover:text-rose-700"
                >
                  Delete customer
                </button>
              )}
            </div>
          ) : null}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<(typeof filters)[number]>("All");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<CustomerFormState>(emptyForm);
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    contact: true,
    address: true,
    lead: true,
    communication: true,
    notes: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [referredSearch, setReferredSearch] = useState("");
  const [referredMatches, setReferredMatches] = useState<CustomerRecord[]>([]);
  const [referredByName, setReferredByName] = useState("");

  async function loadCustomersAndQuotes(selectCustomerId?: string | null) {
    setIsLoading(true);
    setLoadError("");

    const [customersResponse, quotesResponse] = await Promise.all([
      supabase.from("customers").select("*").order("created_at", { ascending: false }),
      supabase
        .from("quotes")
        .select("id, customer_id, status, total, created_at")
        .order("created_at", { ascending: false }),
    ]);

    if (customersResponse.error || quotesResponse.error) {
      setLoadError("Unable to load customers right now.");
      setCustomers([]);
      setQuotes([]);
      setIsLoading(false);
      return;
    }

    const nextCustomers = (customersResponse.data as CustomerRecord[] | null) ?? [];
    const nextQuotes = (quotesResponse.data as QuoteRecord[] | null) ?? [];

    setCustomers(nextCustomers);
    setQuotes(nextQuotes);
    setSelectedCustomerId((current) => {
      if (selectCustomerId) {
        return selectCustomerId;
      }

      if (current && nextCustomers.some((customer) => customer.id === current)) {
        return current;
      }

      return nextCustomers[0]?.id ?? null;
    });
    setIsLoading(false);
  }

  useEffect(() => {
    void loadCustomersAndQuotes();
  }, []);

  useEffect(() => {
    if (!isDrawerOpen || form.customer_status !== "Referral" || !referredSearch.trim()) {
      setReferredMatches([]);
      return;
    }

    let isMounted = true;

    async function searchCustomers() {
      const term = referredSearch.trim();
      const { data } = await supabase
        .from("customers")
        .select("*")
        .or(
          `first_name.ilike.%${term}%,last_name.ilike.%${term}%,name.ilike.%${term}%,phone.ilike.%${term}%`,
        )
        .limit(8);

      if (!isMounted) {
        return;
      }

      setReferredMatches(((data as CustomerRecord[] | null) ?? []).filter((customer) => customer.id !== selectedCustomerId));
    }

    void searchCustomers();

    return () => {
      isMounted = false;
    };
  }, [form.customer_status, isDrawerOpen, referredSearch, selectedCustomerId]);

  const statsByCustomer = useMemo(() => buildStatsMap(quotes), [quotes]);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesFilter =
        selectedFilter === "All"
          ? true
          : getFilterValue(customer.type) === selectedFilter;

      const matchesSearch =
        term.length === 0
          ? true
          : getFullName(customer).toLowerCase().includes(term) ||
            (customer.phone ?? "").toLowerCase().includes(term) ||
            (customer.email ?? "").toLowerCase().includes(term);

      return matchesFilter && matchesSearch;
    });
  }, [customers, search, selectedFilter]);

  const selectedCustomer =
    filteredCustomers.find((customer) => customer.id === selectedCustomerId) ??
    customers.find((customer) => customer.id === selectedCustomerId) ??
    filteredCustomers[0] ??
    null;

  const selectedStats = selectedCustomer
    ? statsByCustomer[selectedCustomer.id] ?? {
        totalQuotes: 0,
        lifetimeValue: 0,
        recentQuotes: [],
        lastActivityLabel: "No recent quote activity",
      }
    : null;

  const referredByCustomer =
    selectedCustomer?.referred_by_id
      ? customers.find((customer) => customer.id === selectedCustomer.referred_by_id) ?? null
      : null;
  const referredCustomers = selectedCustomer
    ? customers.filter((customer) => customer.referred_by_id === selectedCustomer.id)
    : [];

  function toggleSection(section: SectionKey) {
    setSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function updateForm<Key extends keyof CustomerFormState>(
    key: Key,
    value: CustomerFormState[Key],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function setOptOutNowIfNeeded(nextValue: boolean) {
    if (!nextValue) {
      return new Date().toISOString();
    }

    return form.opt_out_date;
  }

  function handleCommunicationToggle(
    key: "ok_to_call" | "ok_to_text" | "ok_to_email" | "ok_to_mail" | "do_not_contact",
  ) {
    setForm((current) => {
      if (key === "do_not_contact") {
        const nextDoNotContact = !current.do_not_contact;

        if (nextDoNotContact) {
          return {
            ...current,
            do_not_contact: true,
            ok_to_call: false,
            ok_to_text: false,
            ok_to_email: false,
            ok_to_mail: false,
            opt_out_date: new Date().toISOString(),
          };
        }

        return {
          ...current,
          do_not_contact: false,
        };
      }

      const nextValue = !current[key];

      return {
        ...current,
        [key]: nextValue,
        opt_out_date: setOptOutNowIfNeeded(nextValue),
      };
    });
  }

  function handleReferralRewardToggle() {
    setForm((current) => {
      const nextValue = !current.referral_reward_sent;

      return {
        ...current,
        referral_reward_sent: nextValue,
        referral_reward_sent_date: nextValue ? new Date().toISOString() : null,
      };
    });
  }

  function handleRetrieveAddress(result: unknown) {
    const feature = (result as { features?: Array<{ properties?: Record<string, unknown> }> })
      ?.features?.[0];
    const properties = feature?.properties ?? {};

    updateForm(
      "address",
      getAutofillValue(properties, ["address_line1", "address_line1_text", "address"]) ||
        form.address,
    );
    updateForm(
      "city",
      getAutofillValue(properties, ["address_level2", "place", "city"]) || form.city,
    );
    updateForm(
      "state",
      getAutofillValue(properties, ["address_level1", "region_code", "region"]) || form.state,
    );
    updateForm(
      "zip",
      getAutofillValue(properties, ["postal_code", "postcode"]) || form.zip,
    );
  }

  function resetDrawerState() {
    setSections({
      contact: true,
      address: true,
      lead: true,
      communication: true,
      notes: true,
    });
    setIsConfirmingDelete(false);
    setReferredSearch("");
    setReferredMatches([]);
    setReferredByName("");
  }

  function openCreateDrawer() {
    setDrawerMode("create");
    setForm(emptyForm);
    resetDrawerState();
    setIsDrawerOpen(true);
  }

  function openEditDrawer(customer: CustomerRecord) {
    setDrawerMode("edit");
    setSelectedCustomerId(customer.id);
    setForm({
      first_name: customer.first_name ?? "",
      last_name: customer.last_name ?? "",
      spouse_name: customer.spouse_name ?? "",
      phone: customer.phone ?? "",
      phone_mobile: customer.phone_mobile ?? "",
      phone_home: customer.phone_home ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
      zip: customer.zip ?? "",
      location:
        customer.location === "Ellsworth" || customer.location === "Lindsay"
          ? customer.location
          : "",
      type:
        customer.type?.toLowerCase() === "vip"
          ? "VIP"
          : customer.type?.toLowerCase() === "lead"
            ? "Lead"
            : "Customer",
      lead_source_primary: customer.lead_source_primary ?? "",
      lead_source_secondary: customer.lead_source_secondary ?? "",
      customer_status:
        customer.customer_status === "Referral"
          ? "Referral"
          : customer.customer_status === "Repeat"
            ? "Repeat"
            : "New",
      referred_by_id: customer.referred_by_id ?? null,
      referral_reward_sent: customer.referral_reward_sent ?? false,
      referral_reward_sent_date: customer.referral_reward_sent_date ?? null,
      lead_campaign: customer.lead_campaign ?? "",
      ok_to_call: customer.ok_to_call ?? true,
      ok_to_text: customer.ok_to_text ?? true,
      ok_to_email: customer.ok_to_email ?? true,
      ok_to_mail: customer.ok_to_mail ?? true,
      do_not_contact: customer.do_not_contact ?? false,
      opt_out_date: customer.opt_out_date ?? null,
      notes: customer.notes ?? "",
    });
    resetDrawerState();

    if (customer.referred_by_id) {
      const referredCustomer = customers.find((item) => item.id === customer.referred_by_id);
      setReferredByName(referredCustomer ? getFullName(referredCustomer) : "");
    }

    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
    resetDrawerState();
  }

  async function handleSaveCustomer() {
    if (
      !form.first_name.trim() ||
      !form.last_name.trim() ||
      !form.lead_source_primary ||
      !form.location
    ) {
      return;
    }

    setIsSaving(true);

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      spouse_name: form.spouse_name || null,
      phone: form.phone || null,
      phone_mobile: form.phone_mobile || null,
      phone_home: form.phone_home || null,
      email: form.email || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      zip: form.zip || null,
      location: form.location,
      type: form.type,
      lead_source_primary: form.lead_source_primary,
      lead_source_secondary: form.lead_source_secondary || null,
      customer_status: form.customer_status,
      referred_by_id: form.customer_status === "Referral" ? form.referred_by_id : null,
      referral_reward_sent:
        form.customer_status === "Referral" ? form.referral_reward_sent : false,
      referral_reward_sent_date:
        form.customer_status === "Referral" ? form.referral_reward_sent_date : null,
      lead_campaign: form.lead_campaign || null,
      ok_to_call: form.ok_to_call,
      ok_to_text: form.ok_to_text,
      ok_to_email: form.ok_to_email,
      ok_to_mail: form.ok_to_mail,
      do_not_contact: form.do_not_contact,
      opt_out_date: form.opt_out_date,
      notes: form.notes || null,
    };

    if (drawerMode === "create") {
      const { data, error } = await supabase
        .from("customers")
        .insert(payload)
        .select("id")
        .single();

      if (!error && data) {
        await loadCustomersAndQuotes(data.id);
        closeDrawer();
      }
    } else if (selectedCustomerId) {
      const { error } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", selectedCustomerId);

      if (!error) {
        await loadCustomersAndQuotes(selectedCustomerId);
        closeDrawer();
      }
    }

    setIsSaving(false);
  }

  async function handleDeleteCustomer() {
    if (drawerMode !== "edit" || !selectedCustomerId) {
      return;
    }

    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }

    setIsDeleting(true);

    const { error } = await supabase.from("customers").delete().eq("id", selectedCustomerId);

    if (!error) {
      const remainingCustomers = customers.filter((customer) => customer.id !== selectedCustomerId);
      closeDrawer();
      setSelectedCustomerId(remainingCustomers[0]?.id ?? null);
      await loadCustomersAndQuotes(remainingCustomers[0]?.id ?? null);
    }

    setIsDeleting(false);
  }

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Customers" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar title="Customers" actionLabel="Add Customer" actionOnClick={openCreateDrawer} />

        <div className="flex flex-1 gap-6 p-8">
          <div className="min-w-0 flex-1 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full max-w-md">
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search customers"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {filters.map((filter) => {
                  const isActive = filter === selectedFilter;

                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setSelectedFilter(filter)}
                      className={`rounded-xl px-3 py-2 text-sm transition ${
                        isActive
                          ? "bg-primary text-white"
                          : "border border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                      }`}
                    >
                      {filter}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-stone-200">
              {isLoading ? (
                <div className="flex min-h-[260px] items-center justify-center">
                  <div className="flex items-center gap-3 text-sm text-stone-500">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-primary" />
                    Loading customers...
                  </div>
                </div>
              ) : loadError ? (
                <div className="px-6 py-10 text-center text-sm text-rose-600">{loadError}</div>
              ) : filteredCustomers.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-base font-medium text-stone-950">
                    No customers yet — add your first one
                  </p>
                  <p className="mt-2 text-sm text-stone-500">
                    New customers will appear here as soon as you save them.
                  </p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-stone-200">
                  <thead className="bg-stone-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                      <th className="px-4 py-4">Customer Name</th>
                      <th className="px-4 py-4">Phone</th>
                      <th className="px-4 py-4">Type</th>
                      <th className="px-4 py-4">Lifetime Value</th>
                      <th className="px-4 py-4">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {filteredCustomers.map((customer) => {
                      const isSelected = selectedCustomer?.id === customer.id;
                      const customerStats = statsByCustomer[customer.id];

                      return (
                        <tr
                          key={customer.id}
                          onClick={() => setSelectedCustomerId(customer.id)}
                          className={`cursor-pointer transition ${
                            isSelected ? "bg-primary/5" : "hover:bg-stone-50"
                          }`}
                        >
                          <td className="px-4 py-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-stone-950">
                                  {getFullName(customer)}
                                </p>
                                {customer.location ? (
                                  <Badge
                                    label={customer.location}
                                    tone={getLocationTone(customer.location)}
                                  />
                                ) : null}
                                {customer.do_not_contact ? (
                                  <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-700">
                                    DNC
                                  </span>
                                ) : null}
                              </div>
                              {customer.lead_source_primary ? (
                                <p className="mt-1 inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-500">
                                  {customer.lead_source_primary}
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-stone-500">
                            {customer.phone || "—"}
                          </td>
                          <td className="px-4 py-4">
                            <Badge
                              label={getBadgeLabel(customer.type)}
                              tone={getTone(customer.type)}
                            />
                          </td>
                          <td className="px-4 py-4 text-sm text-stone-700">
                            {formatCurrency(customerStats?.lifetimeValue ?? 0)}
                          </td>
                          <td className="px-4 py-4 text-sm text-stone-500">
                            {customerStats?.lastActivityLabel ?? "No recent quote activity"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <aside className="hidden w-[380px] shrink-0 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm xl:block">
            {selectedCustomer ? (
              <>
                {selectedCustomer.do_not_contact ? (
                  <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                    Do Not Contact — all communications are blocked
                  </div>
                ) : null}

                <div className="border-b border-stone-200 pb-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold text-stone-600">
                      {getInitials(getFullName(selectedCustomer))}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight text-stone-950">
                        {getFullName(selectedCustomer)}
                      </h2>
                      {selectedCustomer.spouse_name ? (
                        <p className="mt-1 text-sm text-stone-500">
                          Spouse: {selectedCustomer.spouse_name}
                        </p>
                      ) : null}
                      <div className="mt-2">
                        <Badge
                          label={getBadgeLabel(selectedCustomer.type)}
                          tone={getTone(selectedCustomer.type)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3 text-sm text-stone-600">
                    <p>{selectedCustomer.phone || "No primary phone"}</p>
                    <p>{selectedCustomer.phone_mobile || "No mobile phone"}</p>
                    <p>{selectedCustomer.phone_home || "No home phone"}</p>
                    <p>{selectedCustomer.email || "No email on file"}</p>
                    <p>{selectedCustomer.location || "No location assigned"}</p>
                    <p>{formatAddress(selectedCustomer) || "No address on file"}</p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
                      Lead Source
                    </h3>
                    <p className="mt-3 text-sm text-stone-600">
                      {selectedCustomer.lead_source_primary || "Not set"}
                    </p>
                    {selectedCustomer.lead_source_secondary ? (
                      <p className="mt-1 text-sm text-stone-500">
                        {selectedCustomer.lead_source_secondary}
                      </p>
                    ) : null}
                  </div>

                  {referredByCustomer ? (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
                        Referred By
                      </h3>
                      <button
                        type="button"
                        onClick={() => setSelectedCustomerId(referredByCustomer.id)}
                        className="mt-3 text-sm font-medium text-primary transition hover:opacity-80"
                      >
                        {getFullName(referredByCustomer)}
                      </button>
                    </div>
                  ) : null}

                  {referredCustomers.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
                        Referral Rewards
                      </h3>
                      <div className="mt-3 space-y-2">
                        {referredCustomers.map((customer) => (
                          <p key={customer.id} className="text-sm text-stone-600">
                            Referred {getFullName(customer)} — reward sent{" "}
                            {customer.referral_reward_sent_date
                              ? formatRelativeLabel(customer.referral_reward_sent_date)
                              : "Not yet"}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
                      Communication Preferences
                    </h3>
                    <div className="mt-3 space-y-2">
                      <CommunicationIcon allowed={selectedCustomer.ok_to_call ?? true} label="OK to call" />
                      <CommunicationIcon allowed={selectedCustomer.ok_to_text ?? true} label="OK to text" />
                      <CommunicationIcon allowed={selectedCustomer.ok_to_email ?? true} label="OK to email" />
                      <CommunicationIcon allowed={selectedCustomer.ok_to_mail ?? true} label="OK to mail" />
                      <CommunicationIcon allowed={!(selectedCustomer.do_not_contact ?? false)} label="Do not contact override" />
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-stone-100 bg-stone-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                      Total Quotes
                    </p>
                    <p className="mt-2 text-xl font-semibold tracking-tight text-stone-950">
                      {selectedStats?.totalQuotes ?? 0}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-stone-100 bg-stone-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                      Lifetime Value
                    </p>
                    <p className="mt-2 text-xl font-semibold tracking-tight text-stone-950">
                      {formatCurrency(selectedStats?.lifetimeValue ?? 0)}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
                    Notes
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-stone-600">
                    {selectedCustomer.notes || "No notes yet."}
                  </p>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => openEditDrawer(selectedCustomer)}
                    className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-95"
                  >
                    Edit
                  </button>
                  <Link
                    href="/quotes/new"
                    className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-300"
                  >
                    New Quote
                  </Link>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-stone-400">
                Select a customer to view details.
              </div>
            )}
          </aside>
        </div>
      </section>

      <CustomerFormDrawer
        isOpen={isDrawerOpen}
        mode={drawerMode}
        form={form}
        referredByName={referredByName}
        referredSearch={referredSearch}
        referredMatches={referredMatches}
        sections={sections}
        isSaving={isSaving}
        isDeleting={isDeleting}
        isConfirmingDelete={isConfirmingDelete}
        onSectionToggle={toggleSection}
        onChange={updateForm}
        onCommunicationToggle={handleCommunicationToggle}
        onReferralRewardToggle={handleReferralRewardToggle}
        onRetrieveAddress={handleRetrieveAddress}
        onReferredSearchChange={setReferredSearch}
        onSelectReferredCustomer={(customer) => {
          updateForm("referred_by_id", customer.id);
          setReferredByName(getFullName(customer));
          setReferredSearch("");
          setReferredMatches([]);
        }}
        onClearReferredCustomer={() => {
          updateForm("referred_by_id", null);
          setReferredByName("");
          setReferredSearch("");
        }}
        onCancel={closeDrawer}
        onSave={() => void handleSaveCustomer()}
        onDelete={() => void handleDeleteCustomer()}
        onDeleteCancel={() => setIsConfirmingDelete(false)}
      />
    </main>
  );
}
