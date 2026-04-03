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

type CustomerRecord = {
  id: string;
  name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  type: "customer" | "lead" | "vip" | string;
  notes: string | null;
  created_at: string | null;
};

type QuoteRecord = {
  id: string;
  customer_id: string | null;
  status: string | null;
  total: number | null;
  created_at: string | null;
};

type CustomerFormState = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  type: "customer" | "lead" | "vip";
  notes: string;
};

type CustomerStats = {
  totalQuotes: number;
  totalOrders: number;
  lifetimeValue: number;
  recentQuotes: QuoteRecord[];
  lastActivityLabel: string;
};

const emptyForm: CustomerFormState = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  type: "customer",
  notes: "",
};

function getTone(type: string) {
  const normalized = type.toLowerCase();

  if (normalized === "vip") {
    return "vip";
  }

  if (normalized === "lead") {
    return "lead";
  }

  return "customer";
}

function getFilterValue(type: string) {
  const normalized = type.toLowerCase();

  if (normalized === "vip") {
    return "VIP";
  }

  if (normalized === "lead") {
    return "Leads";
  }

  return "Customers";
}

function getBadgeLabel(type: string) {
  const normalized = type.toLowerCase();

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

function formatAddress(customer: CustomerRecord) {
  return [customer.address, customer.city, customer.state, customer.zip]
    .filter(Boolean)
    .join(", ");
}

function getCustomerName(customer: CustomerRecord) {
  const fullNameFromParts = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return customer.name?.trim() || fullNameFromParts || "Unnamed Customer";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatRelativeLabel(dateString: string | null) {
  if (!dateString) {
    return "No recent quote activity";
  }

  const date = new Date(dateString);

  return date.toLocaleDateString("en-US", {
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
        totalOrders: 0,
        lifetimeValue: 0,
        recentQuotes: [],
        lastActivityLabel: "No recent quote activity",
      } satisfies CustomerStats);

    existing.totalQuotes += 1;

    if ((quote.status ?? "").toLowerCase() === "ordered") {
      existing.totalOrders += 1;
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
        ? `${getBadgeLabel(existing.recentQuotes[0].status ?? "customer")} quote • ${formatRelativeLabel(existing.recentQuotes[0].created_at)}`
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

function CustomerFormDrawer({
  isOpen,
  mode,
  form,
  isSaving,
  isDeleting,
  isConfirmingDelete,
  onChange,
  onCancel,
  onSave,
  onDelete,
  onDeleteCancel,
}: {
  isOpen: boolean;
  mode: "create" | "edit";
  form: CustomerFormState;
  isSaving: boolean;
  isDeleting: boolean;
  isConfirmingDelete: boolean;
  onChange: <Key extends keyof CustomerFormState>(
    key: Key,
    value: CustomerFormState[Key],
  ) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
  onDeleteCancel: () => void;
}) {
  function handleRetrieve(result: unknown) {
    const feature = (result as { features?: Array<{ properties?: Record<string, unknown> }> })
      ?.features?.[0];
    const properties = feature?.properties ?? {};

    onChange(
      "address",
      getAutofillValue(properties, ["address_line1", "address_line1_text", "address"])
        || form.address,
    );
    onChange(
      "city",
      getAutofillValue(properties, ["address_level2", "place", "city"]) || form.city,
    );
    onChange(
      "state",
      getAutofillValue(properties, ["address_level1", "region_code", "region"]) || form.state,
    );
    onChange(
      "zip",
      getAutofillValue(properties, ["postal_code", "postcode"]) || form.zip,
    );
  }

  return (
    <aside
      className={`fixed inset-y-0 right-0 z-30 w-full max-w-md border-l border-stone-200 bg-white shadow-2xl transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-stone-200 px-6 py-5">
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

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">
              Full name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(event) => onChange("name", event.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">
              Phone number
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
              Email address
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
              Street address
            </label>
            <AddressAutofill accessToken={MAPBOX_TOKEN} onRetrieve={handleRetrieve}>
              <input
                type="text"
                autoComplete="address-line1"
                value={form.address}
                onChange={(event) => onChange("address", event.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </AddressAutofill>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
                <option value="">Select state</option>
                {usStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">Zip code</label>
            <input
              type="text"
              autoComplete="postal-code"
              value={form.zip}
              onChange={(event) => onChange("zip", event.target.value)}
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
              <option value="customer">Customer</option>
              <option value="lead">Lead</option>
              <option value="vip">VIP</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">Notes</label>
            <textarea
              value={form.notes}
              onChange={(event) => onChange("notes", event.target.value)}
              rows={5}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>
        </div>

        <div className="border-t border-stone-200 px-6 py-5">
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
                      {isDeleting ? "Deleting..." : "Yes, delete"}
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
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  async function loadCustomersAndQuotes(selectCustomerId?: string | null) {
    setIsLoading(true);
    setLoadError("");

    const [customersResponse, quotesResponse] = await Promise.all([
      supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false }),
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
          : getCustomerName(customer).toLowerCase().includes(term) ||
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
        totalOrders: 0,
        lifetimeValue: 0,
        recentQuotes: [],
        lastActivityLabel: "No recent quote activity",
      }
    : null;

  function updateForm<Key extends keyof CustomerFormState>(
    key: Key,
    value: CustomerFormState[Key],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openCreateDrawer() {
    setDrawerMode("create");
    setForm(emptyForm);
    setIsConfirmingDelete(false);
    setIsDrawerOpen(true);
  }

  function openEditDrawer(customer: CustomerRecord) {
    setDrawerMode("edit");
    setForm({
      name: getCustomerName(customer),
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
      zip: customer.zip ?? "",
      type:
        customer.type.toLowerCase() === "vip"
          ? "vip"
          : customer.type.toLowerCase() === "lead"
            ? "lead"
            : "customer",
      notes: customer.notes ?? "",
    });
    setSelectedCustomerId(customer.id);
    setIsConfirmingDelete(false);
    setIsDrawerOpen(true);
  }

  async function handleSaveCustomer() {
    if (!form.name.trim()) {
      return;
    }

    setIsSaving(true);

    if (drawerMode === "create") {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          name: form.name.trim(),
          phone: form.phone || null,
          email: form.email || null,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          zip: form.zip || null,
          type: form.type,
          notes: form.notes || null,
        })
        .select("id")
        .single();

      if (!error && data) {
        await loadCustomersAndQuotes(data.id);
        setIsDrawerOpen(false);
        setIsConfirmingDelete(false);
      }
    } else if (selectedCustomerId) {
      const { error } = await supabase
        .from("customers")
        .update({
          name: form.name.trim(),
          phone: form.phone || null,
          email: form.email || null,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          zip: form.zip || null,
          type: form.type,
          notes: form.notes || null,
        })
        .eq("id", selectedCustomerId);

      if (!error) {
        await loadCustomersAndQuotes(selectedCustomerId);
        setIsDrawerOpen(false);
        setIsConfirmingDelete(false);
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
      setIsDrawerOpen(false);
      setIsConfirmingDelete(false);
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
                          onClick={() => openEditDrawer(customer)}
                          className={`cursor-pointer transition ${
                            isSelected ? "bg-primary/5" : "hover:bg-stone-50"
                          }`}
                        >
                          <td className="px-4 py-4 font-medium text-stone-950">
                            {getCustomerName(customer)}
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
        </div>
      </section>

      <CustomerFormDrawer
        isOpen={isDrawerOpen}
        mode={drawerMode}
        form={form}
        isSaving={isSaving}
        isDeleting={isDeleting}
        isConfirmingDelete={isConfirmingDelete}
        onChange={updateForm}
        onCancel={() => {
          setIsDrawerOpen(false);
          setIsConfirmingDelete(false);
        }}
        onSave={() => void handleSaveCustomer()}
        onDelete={() => void handleDeleteCustomer()}
        onDeleteCancel={() => setIsConfirmingDelete(false)}
      />
    </main>
  );
}
