"use client";

import { useState } from "react";
import { Badge } from "@/components/Badge";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

const filters = ["All", "Customers", "Leads", "VIP"] as const;

const customers = [
  {
    id: 1,
    name: "Sofia Bennett",
    phone: "(212) 555-0148",
    type: "VIP" as const,
    lifetimeValue: "$42,600",
    lastActivity: "Quote signed yesterday",
    email: "sofia@nelo-demo.com",
    company: "Bennett Properties",
    location: "New York, NY",
    notes:
      "Prefers afternoon calls and highly values fast turnaround on custom orders.",
    stats: [
      { label: "Open Quotes", value: "3" },
      { label: "Closed Orders", value: "12" },
      { label: "Avg. Job Size", value: "$8.2k" },
    ],
    recentActivity: [
      "Approved revised kitchen scope for West 11th Street project",
      "Requested dispatch update for Friday delivery",
      "Paid deposit on spring showroom refresh",
    ],
  },
  {
    id: 2,
    name: "Caleb Turner",
    phone: "(646) 555-0192",
    type: "Customer" as const,
    lifetimeValue: "$18,950",
    lastActivity: "Called this morning",
    email: "caleb@turnerbuild.com",
    company: "Turner Build Co.",
    location: "Brooklyn, NY",
    notes:
      "Interested in expanding to recurring service work if the current install goes smoothly.",
    stats: [
      { label: "Open Quotes", value: "1" },
      { label: "Closed Orders", value: "5" },
      { label: "Avg. Job Size", value: "$4.4k" },
    ],
    recentActivity: [
      "Confirmed measurement appointment for Friday",
      "Asked for financing options on premium finish",
      "Opened latest quote email twice",
    ],
  },
  {
    id: 3,
    name: "Maya Rodriguez",
    phone: "(917) 555-0133",
    type: "Lead" as const,
    lifetimeValue: "$6,300",
    lastActivity: "Website form 2 days ago",
    email: "maya@rodriguezstudio.com",
    company: "Rodriguez Studio",
    location: "Queens, NY",
    notes:
      "Warm inbound lead from referral partner. Looking for a fast estimate this week.",
    stats: [
      { label: "Open Quotes", value: "2" },
      { label: "Closed Orders", value: "0" },
      { label: "Avg. Job Size", value: "$3.1k" },
    ],
    recentActivity: [
      "Submitted photos and dimensions through intake form",
      "Requested quote comparison with previous vendor",
      "Scheduled intro call for Thursday at 10:00 AM",
    ],
  },
  {
    id: 4,
    name: "Daniel Kim",
    phone: "(718) 555-0175",
    type: "Customer" as const,
    lifetimeValue: "$27,400",
    lastActivity: "Service completed Monday",
    email: "daniel@kimhospitality.com",
    company: "Kim Hospitality Group",
    location: "Jersey City, NJ",
    notes:
      "Likes concise updates. Best point of contact for approvals is Daniel directly.",
    stats: [
      { label: "Open Quotes", value: "0" },
      { label: "Closed Orders", value: "9" },
      { label: "Avg. Job Size", value: "$6.7k" },
    ],
    recentActivity: [
      "Left positive feedback after final walkthrough",
      "Requested maintenance quote for second location",
      "Shared new floorplans for Q3 expansion",
    ],
  },
];

function getTone(type: "VIP" | "Customer" | "Lead") {
  if (type === "VIP") {
    return "vip";
  }

  if (type === "Lead") {
    return "lead";
  }

  return "customer";
}

export default function CustomersPage() {
  const [selectedFilter, setSelectedFilter] = useState<(typeof filters)[number]>("All");
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0].id);

  const filteredCustomers = customers.filter((customer) => {
    if (selectedFilter === "All") {
      return true;
    }

    if (selectedFilter === "Customers") {
      return customer.type === "Customer";
    }

    if (selectedFilter === "Leads") {
      return customer.type === "Lead";
    }

    return customer.type === "VIP";
  });

  const selectedCustomer =
    filteredCustomers.find((customer) => customer.id === selectedCustomerId) ??
    filteredCustomers[0];

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Customers" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar title="Customers" actionLabel="New quote" />

        <div className="flex flex-1 gap-6 p-8">
          <div className="min-w-0 flex-1 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full max-w-md">
                <input
                  type="search"
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

                    return (
                      <tr
                        key={customer.id}
                        onClick={() => setSelectedCustomerId(customer.id)}
                        className={`cursor-pointer transition ${
                          isSelected ? "bg-primary/5" : "hover:bg-stone-50"
                        }`}
                      >
                        <td className="px-4 py-4 font-medium text-stone-950">
                          {customer.name}
                        </td>
                        <td className="px-4 py-4 text-sm text-stone-500">{customer.phone}</td>
                        <td className="px-4 py-4">
                          <Badge label={customer.type} tone={getTone(customer.type)} />
                        </td>
                        <td className="px-4 py-4 text-sm text-stone-700">
                          {customer.lifetimeValue}
                        </td>
                        <td className="px-4 py-4 text-sm text-stone-500">
                          {customer.lastActivity}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="hidden w-[360px] shrink-0 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm xl:block">
            {selectedCustomer ? (
              <>
                <div className="border-b border-stone-200 pb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight text-stone-950">
                        {selectedCustomer.name}
                      </h2>
                      <p className="mt-1 text-sm text-stone-500">
                        {selectedCustomer.company}
                      </p>
                    </div>
                    <Badge
                      label={selectedCustomer.type}
                      tone={getTone(selectedCustomer.type)}
                    />
                  </div>

                  <div className="mt-5 space-y-3 text-sm text-stone-600">
                    <p>{selectedCustomer.email}</p>
                    <p>{selectedCustomer.phone}</p>
                    <p>{selectedCustomer.location}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  {selectedCustomer.stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-2xl border border-stone-100 bg-stone-50 px-4 py-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                        {stat.label}
                      </p>
                      <p className="mt-2 text-xl font-semibold tracking-tight text-stone-950">
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
                    Notes
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-stone-600">
                    {selectedCustomer.notes}
                  </p>
                </div>

                <div className="mt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
                    Recent Activity
                  </h3>
                  <div className="mt-3 space-y-3">
                    {selectedCustomer.recentActivity.map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-stone-100 bg-stone-50 px-4 py-4 text-sm text-stone-600"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}
