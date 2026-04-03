"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

type QuoteStatus = "Pending" | "Approved" | "Ordered" | "Expired";

type QuoteLine = {
  id: number;
  line: string;
  qty: number;
  productDetails: string;
  unitPrice: number;
};

type Quote = {
  id: number;
  quoteNumber: string;
  customer: string;
  contactName: string;
  email: string;
  phone: string;
  dateCreated: string;
  lines: QuoteLine[];
  shipping: number;
  installation: number;
  tax: number;
  status: QuoteStatus;
};

const filters = ["All", "Pending", "Approved", "Ordered", "Expired"] as const;

const quotes: Quote[] = [
  {
    id: 1,
    quoteNumber: "Q-24081",
    customer: "Bennett Properties",
    contactName: "Sofia Bennett",
    email: "sofia@nelo-demo.com",
    phone: "(212) 555-0148",
    dateCreated: "Apr 2, 2026",
    status: "Pending",
    shipping: 240,
    installation: 680,
    tax: 512,
    lines: [
      {
        id: 11,
        line: "Living Room",
        qty: 2,
        productDetails: "Alta Window Fashions motorized roller shades, linen white",
        unitPrice: 920,
      },
      {
        id: 12,
        line: "Primary Suite",
        qty: 3,
        productDetails: "Hunter Douglas blackout roman shades, custom fit",
        unitPrice: 740,
      },
    ],
  },
  {
    id: 2,
    quoteNumber: "Q-24080",
    customer: "Turner Build Co.",
    contactName: "Caleb Turner",
    email: "caleb@turnerbuild.com",
    phone: "(646) 555-0192",
    dateCreated: "Apr 1, 2026",
    status: "Approved",
    shipping: 190,
    installation: 540,
    tax: 401,
    lines: [
      {
        id: 21,
        line: "Office",
        qty: 4,
        productDetails: "Graber solar shades, charcoal weave, chainless system",
        unitPrice: 510,
      },
      {
        id: 22,
        line: "Conference",
        qty: 2,
        productDetails: "Lutron drapery track with custom ripplefold panels",
        unitPrice: 1460,
      },
    ],
  },
  {
    id: 3,
    quoteNumber: "Q-24079",
    customer: "Rodriguez Studio",
    contactName: "Maya Rodriguez",
    email: "maya@rodriguezstudio.com",
    phone: "(917) 555-0133",
    dateCreated: "Mar 31, 2026",
    status: "Ordered",
    shipping: 160,
    installation: 460,
    tax: 366,
    lines: [
      {
        id: 31,
        line: "Dining Area",
        qty: 2,
        productDetails: "Norman shutters, painted finish, hidden tilt",
        unitPrice: 980,
      },
      {
        id: 32,
        line: "Studio Loft",
        qty: 5,
        productDetails: "Roller shades with fascia, semi-sheer texture",
        unitPrice: 335,
      },
    ],
  },
  {
    id: 4,
    quoteNumber: "Q-24078",
    customer: "Kim Hospitality Group",
    contactName: "Daniel Kim",
    email: "daniel@kimhospitality.com",
    phone: "(718) 555-0175",
    dateCreated: "Mar 29, 2026",
    status: "Expired",
    shipping: 280,
    installation: 920,
    tax: 708,
    lines: [
      {
        id: 41,
        line: "Suite 201",
        qty: 6,
        productDetails: "Commercial dual shades with room darkening back roll",
        unitPrice: 690,
      },
      {
        id: 42,
        line: "Lobby",
        qty: 4,
        productDetails: "Custom drapery panels, acoustic lining, hardware included",
        unitPrice: 1280,
      },
    ],
  },
  {
    id: 5,
    quoteNumber: "Q-24077",
    customer: "Northfield Estates",
    contactName: "Leah Brooks",
    email: "leah@northfieldestates.com",
    phone: "(551) 555-0103",
    dateCreated: "Mar 28, 2026",
    status: "Pending",
    shipping: 210,
    installation: 590,
    tax: 436,
    lines: [
      {
        id: 51,
        line: "Guest Wing",
        qty: 4,
        productDetails: "Cellular shades, cordless, light filtering, ivory",
        unitPrice: 420,
      },
      {
        id: 52,
        line: "Media Room",
        qty: 2,
        productDetails: "Blackout roller shades with cassette valance",
        unitPrice: 760,
      },
    ],
  },
  {
    id: 6,
    quoteNumber: "Q-24076",
    customer: "Brook & Beam Studio",
    contactName: "Jules Carter",
    email: "jules@brookandbeam.com",
    phone: "(332) 555-0181",
    dateCreated: "Mar 27, 2026",
    status: "Approved",
    shipping: 145,
    installation: 320,
    tax: 274,
    lines: [
      {
        id: 61,
        line: "Showroom Front",
        qty: 3,
        productDetails: "Woven wood shades with privacy liner, walnut trim",
        unitPrice: 685,
      },
      {
        id: 62,
        line: "Back Office",
        qty: 2,
        productDetails: "Faux wood blinds, 2 inch slat, cordless lift",
        unitPrice: 248,
      },
    ],
  },
  {
    id: 7,
    quoteNumber: "Q-24075",
    customer: "Atlas Renovation Group",
    contactName: "Ethan Price",
    email: "ethan@atlasreno.com",
    phone: "(973) 555-0117",
    dateCreated: "Mar 26, 2026",
    status: "Ordered",
    shipping: 330,
    installation: 1040,
    tax: 801,
    lines: [
      {
        id: 71,
        line: "Penthouse",
        qty: 8,
        productDetails: "Motorized sheer shades with smart hub integration",
        unitPrice: 1125,
      },
      {
        id: 72,
        line: "Guest Bedrooms",
        qty: 5,
        productDetails: "Roman shades with trim band, room darkening liner",
        unitPrice: 625,
      },
    ],
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getStatusTone(status: QuoteStatus) {
  if (status === "Pending") {
    return "lead";
  }

  if (status === "Approved") {
    return "active";
  }

  if (status === "Ordered") {
    return "customer";
  }

  return "offline";
}

export default function QuotesPage() {
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<(typeof filters)[number]>("All");
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(quotes[0].id);

  const filteredQuotes = useMemo(() => {
    return quotes.filter((quote) => {
      const matchesFilter =
        selectedFilter === "All" ? true : quote.status === selectedFilter;

      const term = search.trim().toLowerCase();
      const matchesSearch =
        term.length === 0
          ? true
          : quote.quoteNumber.toLowerCase().includes(term) ||
            quote.customer.toLowerCase().includes(term) ||
            quote.contactName.toLowerCase().includes(term);

      return matchesFilter && matchesSearch;
    });
  }, [search, selectedFilter]);

  const selectedQuote =
    filteredQuotes.find((quote) => quote.id === selectedQuoteId) ?? filteredQuotes[0] ?? null;

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Quotes" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar
          title="Quotes"
          titleAdornment={
            <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 text-sm font-medium text-stone-600">
              {filteredQuotes.length}
            </span>
          }
          actionLabel="New quote"
          actionHref="/quotes/new"
        />

        <div className="border-b border-stone-200 bg-white px-8 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="w-full max-w-md">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search quotes by number, customer, or contact"
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
        </div>

        <div className="flex flex-1 gap-6 overflow-hidden p-8">
          <div className="min-w-0 flex-1 rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-200">
                <thead className="bg-stone-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                    <th className="px-4 py-4">Quote #</th>
                    <th className="px-4 py-4">Customer</th>
                    <th className="px-4 py-4">Date Created</th>
                    <th className="px-4 py-4">Lines</th>
                    <th className="px-4 py-4">Amount</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {filteredQuotes.map((quote) => {
                    const subtotal = quote.lines.reduce(
                      (sum, line) => sum + line.qty * line.unitPrice,
                      0,
                    );
                    const amount =
                      subtotal + quote.shipping + quote.installation + quote.tax;
                    const isSelected = quote.id === selectedQuote?.id;

                    return (
                      <tr
                        key={quote.id}
                        onClick={() => setSelectedQuoteId(quote.id)}
                        className={`cursor-pointer transition ${
                          isSelected ? "bg-primary/5" : "hover:bg-stone-50"
                        }`}
                      >
                        <td className="px-4 py-4 font-medium text-stone-950">
                          {quote.quoteNumber}
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-stone-950">{quote.customer}</p>
                            <p className="mt-1 text-sm text-stone-500">{quote.contactName}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-stone-500">{quote.dateCreated}</td>
                        <td className="px-4 py-4 text-sm text-stone-700">{quote.lines.length}</td>
                        <td className="px-4 py-4 text-sm font-medium text-stone-950">
                          {formatCurrency(amount)}
                        </td>
                        <td className="px-4 py-4">
                          <Badge
                            label={quote.status}
                            tone={getStatusTone(quote.status)}
                          />
                        </td>
                        <td className="px-4 py-4 text-sm text-stone-500">
                          View quote
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <aside
            className={`fixed inset-y-0 right-0 z-20 w-full max-w-xl border-l border-stone-200 bg-white shadow-2xl shadow-stone-300/20 transition-transform duration-300 xl:static xl:translate-x-0 xl:rounded-2xl xl:border xl:shadow-sm ${
              selectedQuote ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {selectedQuote ? (
              (() => {
                const subtotal = selectedQuote.lines.reduce(
                  (sum, line) => sum + line.qty * line.unitPrice,
                  0,
                );
                const total =
                  subtotal +
                  selectedQuote.shipping +
                  selectedQuote.installation +
                  selectedQuote.tax;

                return (
                  <div className="flex h-full flex-col">
                    <div className="border-b border-stone-200 px-6 py-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
                            Quote Detail
                          </p>
                          <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">
                            {selectedQuote.quoteNumber}
                          </h2>
                          <p className="mt-2 text-sm text-stone-500">
                            {selectedQuote.customer}
                          </p>
                          <p className="mt-1 text-sm text-stone-500">
                            {selectedQuote.contactName} • {selectedQuote.email}
                          </p>
                          <p className="mt-1 text-sm text-stone-500">
                            {selectedQuote.phone}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedQuoteId(null)}
                          className="rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-500 xl:hidden"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-6">
                      <div className="overflow-hidden rounded-2xl border border-stone-200">
                        <table className="min-w-full divide-y divide-stone-200">
                          <thead className="bg-stone-50">
                            <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                              <th className="px-4 py-3">Line</th>
                              <th className="px-4 py-3">Qty</th>
                              <th className="px-4 py-3">Product Details</th>
                              <th className="px-4 py-3">Unit Price</th>
                              <th className="px-4 py-3">Line Price</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100 bg-white">
                            {selectedQuote.lines.map((line) => (
                              <tr key={line.id}>
                                <td className="px-4 py-4 text-sm font-medium text-stone-950">
                                  {line.line}
                                </td>
                                <td className="px-4 py-4 text-sm text-stone-600">{line.qty}</td>
                                <td className="px-4 py-4 text-sm text-stone-600">
                                  {line.productDetails}
                                </td>
                                <td className="px-4 py-4 text-sm text-stone-600">
                                  {formatCurrency(line.unitPrice)}
                                </td>
                                <td className="px-4 py-4 text-sm font-medium text-stone-950">
                                  {formatCurrency(line.qty * line.unitPrice)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-6 space-y-3 rounded-2xl border border-stone-200 bg-stone-50 p-5">
                        <div className="flex items-center justify-between text-sm text-stone-600">
                          <span>Subtotal</span>
                          <span>{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-stone-600">
                          <span>Shipping</span>
                          <span>{formatCurrency(selectedQuote.shipping)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-stone-600">
                          <span>Installation</span>
                          <span>{formatCurrency(selectedQuote.installation)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-stone-600">
                          <span>Tax</span>
                          <span>{formatCurrency(selectedQuote.tax)}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-stone-200 pt-3 text-base font-semibold text-stone-950">
                          <span>Total</span>
                          <span>{formatCurrency(total)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-stone-200 px-6 py-5">
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-95"
                        >
                          Save Quote
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-300"
                        >
                          Create Order
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}
