"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import {
  getActiveAppUsers,
  getCurrentAppUser,
  type ActiveAppUser,
  type CurrentAppUser,
} from "@/lib/current-app-user";
import {
  addDays,
  APPOINTMENT_SLOTS,
  formatMonthLabel,
  getMonthGrid,
  getWeekDays,
  INTEREST_OPTIONS,
  toDateKey,
  type AppointmentSlotKey,
} from "@/lib/calendar";
import { supabase } from "@/lib/supabase";

type AvailSlot = {
  repUserId: string;
  repName: string;
  date: string;
  slot: AppointmentSlotKey;
  status: string;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  address: string;
};

type BookingDraft = {
  date: string;
  slot: AppointmentSlotKey;
  repUserId: string;
  location: string;
  customerSearch: string;
  customerId: string;
  customerAddress: string;
  customerPhone: string;
  interestedIn: string;
  leadSource: string;
  notes: string;
};

const LEAD_SOURCES = [
  "Google",
  "Referral",
  "Home Show",
  "Yelp",
  "Facebook",
  "Instagram",
  "Nextdoor",
  "Other",
];

export default function BookingPage() {
  const [currentUser, setCurrentUser] = useState<CurrentAppUser | null>(null);
  const [reps, setReps] = useState<ActiveAppUser[]>([]);
  const [slots, setSlots] = useState<AvailSlot[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [viewDate, setViewDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("week");
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const days = useMemo(
    () => (viewMode === "month" ? getMonthGrid(viewDate) : getWeekDays(viewDate)),
    [viewDate, viewMode],
  );

  useEffect(() => {
    let isMounted = true;
    async function init() {
      const [user, users] = await Promise.all([
        getCurrentAppUser(),
        getActiveAppUsers(),
      ]);
      if (!isMounted) return;
      setCurrentUser(user);
      setReps(
        users.filter((u) =>
          ["Sales Rep", "Sales Manager"].includes(u.roleName),
        ),
      );

      const { data: slotData } = await supabase
        .from("appointment_slots")
        .select("rep_user_id, date, slot, status")
        .order("date", { ascending: true });

      const repMap: Record<string, string> = {};
      users.forEach((u) => {
        repMap[u.id] = u.fullName;
      });

      setSlots(
        ((slotData as Array<Record<string, unknown>> | null) ?? []).map((s) => ({
          repUserId: String(s.rep_user_id ?? ""),
          repName: repMap[String(s.rep_user_id ?? "")] ?? "Rep",
          date: String(s.date ?? ""),
          slot: String(s.slot ?? "AM") as AppointmentSlotKey,
          status: String(s.status ?? "open"),
        })),
      );

      const { data: custData } = await supabase
        .from("customers")
        .select("id, name, phone, address")
        .order("name", { ascending: true });
      setCustomers(
        ((custData as Array<Record<string, unknown>> | null) ?? []).map((c) => ({
          id: String(c.id ?? ""),
          name: String(c.name ?? ""),
          phone: String(c.phone ?? ""),
          address: String(c.address ?? ""),
        })),
      );
    }
    void init();
    return () => {
      isMounted = false;
    };
  }, []);

  function openBooking(date: string, slot: AppointmentSlotKey, repUserId: string) {
    setDraft({
      date,
      slot,
      repUserId,
      location: "Ellsworth",
      customerSearch: "",
      customerId: "",
      customerAddress: "",
      customerPhone: "",
      interestedIn: "",
      leadSource: "",
      notes: "",
    });
  }

  const filteredCustomers = useMemo(() => {
    if (!draft?.customerSearch) return [];
    const q = draft.customerSearch.toLowerCase();
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [draft?.customerSearch, customers]);

  const availableRepsForSlot = useMemo(() => {
    if (!draft) return [];
    return slots.filter(
      (s) => s.date === draft.date && s.slot === draft.slot && s.status === "open",
    );
  }, [slots, draft]);

  async function handleBook() {
    if (!draft || !draft.repUserId) return;
    setIsSaving(true);

    const res = await fetch("/api/appointments/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: draft.customerId || undefined,
        customerName: draft.customerSearch,
        phone: draft.customerPhone,
        address: draft.customerAddress,
        repUserId: draft.repUserId,
        date: draft.date,
        slot: draft.slot,
        location: draft.location,
        interestedIn: draft.interestedIn,
        notes: draft.notes,
      }),
    });

    const result = await res.json();
    if (result.success) {
      const rep = reps.find((r) => r.id === draft.repUserId);
      setMessage(
        `Appointment booked for ${draft.customerSearch || "customer"} on ${draft.date} ${draft.slot} with ${rep?.fullName ?? "rep"}`,
      );
      setSlots((prev) =>
        prev.map((s) =>
          s.date === draft.date && s.slot === draft.slot && s.repUserId === draft.repUserId
            ? { ...s, status: "booked" }
            : s,
        ),
      );
      setDraft(null);
    } else {
      setMessage(result.error || "Unable to book appointment.");
    }
    setIsSaving(false);
  }

  if (!currentUser) return null;
  const canAccess = ["Owner", "Office Manager", "Appointment Setter"].includes(currentUser.roleName);
  if (!canAccess) return null;

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Calendar" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar
          title="Book appointment"
          titlePrefix={
            <Link href="/calendar" className="text-lg text-stone-400 transition hover:text-stone-700">
              ←
            </Link>
          }
        />

        <div className="space-y-6 p-8">
          {message && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setViewDate((d) => addDays(d, viewMode === "week" ? -7 : -30))}
              className="rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-600"
            >
              ‹ Prev
            </button>
            <span className="text-sm font-semibold text-stone-900">
              {formatMonthLabel(viewDate)}
            </span>
            <button
              type="button"
              onClick={() => setViewDate((d) => addDays(d, viewMode === "week" ? 7 : 30))}
              className="rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-600"
            >
              Next ›
            </button>
            <div className="ml-auto flex gap-1">
              {(["week", "month"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setViewMode(m)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${
                    viewMode === m ? "bg-primary text-white" : "bg-stone-100 text-stone-600"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="overflow-x-auto rounded-3xl border border-stone-200 bg-white shadow-sm">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                  <th className="px-4 py-3 text-left">Day</th>
                  {APPOINTMENT_SLOTS.map((s) => (
                    <th key={s.key} className="px-4 py-3 text-left">
                      {s.key} <span className="font-normal normal-case">{s.timeRange}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {days.map((day) => {
                  const dk = toDateKey(day);
                  return (
                    <tr key={dk} className="hover:bg-stone-50">
                      <td className="px-4 py-3 text-sm font-medium text-stone-900">
                        {day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </td>
                      {APPOINTMENT_SLOTS.map((slot) => {
                        const daySlots = slots.filter(
                          (s) => s.date === dk && s.slot === slot.key,
                        );
                        return (
                          <td key={slot.key} className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {daySlots.length === 0 && (
                                <span className="text-xs text-stone-300">—</span>
                              )}
                              {daySlots.map((s) => (
                                <button
                                  key={s.repUserId}
                                  type="button"
                                  disabled={s.status !== "open"}
                                  onClick={() => openBooking(dk, slot.key, s.repUserId)}
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                    s.status === "open"
                                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                      : "bg-primary/10 text-primary"
                                  }`}
                                >
                                  {s.repName}
                                </button>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Booking modal */}
      {draft && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-stone-900">Book appointment</h2>
              <button type="button" onClick={() => setDraft(null)} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 p-6">
              <p className="text-sm text-stone-500">{draft.date} · {draft.slot}</p>

              {/* Customer search */}
              <div>
                <label className="text-sm font-medium text-stone-700">Customer</label>
                <input
                  value={draft.customerSearch}
                  onChange={(e) => {
                    setDraft((d) => d ? { ...d, customerSearch: e.target.value, customerId: "" } : null);
                  }}
                  placeholder="Search or enter new customer name"
                  className="mt-1 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm outline-none focus:border-primary"
                />
                {filteredCustomers.length > 0 && (
                  <div className="mt-1 max-h-32 overflow-y-auto rounded-xl border border-stone-200 bg-white">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          setDraft((d) =>
                            d ? { ...d, customerId: c.id, customerSearch: c.name, customerPhone: c.phone, customerAddress: c.address } : null,
                          )
                        }
                        className="w-full px-4 py-2 text-left text-sm hover:bg-stone-50"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Rep */}
              <div>
                <label className="text-sm font-medium text-stone-700">Rep</label>
                <select
                  value={draft.repUserId}
                  onChange={(e) => setDraft((d) => d ? { ...d, repUserId: e.target.value } : null)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm outline-none focus:border-primary"
                >
                  {availableRepsForSlot.map((s) => (
                    <option key={s.repUserId} value={s.repUserId}>{s.repName}</option>
                  ))}
                  {availableRepsForSlot.length === 0 && reps.map((r) => (
                    <option key={r.id} value={r.id}>{r.fullName}</option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="text-sm font-medium text-stone-700">Location</label>
                <select
                  value={draft.location}
                  onChange={(e) => setDraft((d) => d ? { ...d, location: e.target.value } : null)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm outline-none focus:border-primary"
                >
                  <option value="Ellsworth">Ellsworth</option>
                  <option value="Lindsay">Lindsay</option>
                </select>
              </div>

              {/* Interested in */}
              <div>
                <label className="text-sm font-medium text-stone-700">Interested in</label>
                <select
                  value={draft.interestedIn}
                  onChange={(e) => setDraft((d) => d ? { ...d, interestedIn: e.target.value } : null)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm outline-none focus:border-primary"
                >
                  <option value="">Select...</option>
                  {INTEREST_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  <option value="Motorized">Motorized</option>
                </select>
              </div>

              {/* Lead source */}
              <div>
                <label className="text-sm font-medium text-stone-700">Lead source</label>
                <select
                  value={draft.leadSource}
                  onChange={(e) => setDraft((d) => d ? { ...d, leadSource: e.target.value } : null)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm outline-none focus:border-primary"
                >
                  <option value="">Select...</option>
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Address */}
              <div>
                <label className="text-sm font-medium text-stone-700">Address</label>
                <input
                  value={draft.customerAddress}
                  onChange={(e) => setDraft((d) => d ? { ...d, customerAddress: e.target.value } : null)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-stone-700">Notes</label>
                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => d ? { ...d, notes: e.target.value } : null)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <button
                type="button"
                onClick={() => void handleBook()}
                disabled={!draft.repUserId || isSaving}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSaving ? "Booking..." : "Book appointment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
