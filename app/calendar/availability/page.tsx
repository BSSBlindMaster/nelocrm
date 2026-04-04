"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { getActiveAppUsers, getCurrentAppUser, type ActiveAppUser, type CurrentAppUser } from "@/lib/current-app-user";
import {
  addMonths,
  APPOINTMENT_SLOTS,
  createSlotRecord,
  formatMonthLabel,
  getMonthGrid,
  toDateKey,
  type AppointmentSlotKey,
} from "@/lib/calendar";
import { supabase } from "@/lib/supabase";

type AvailabilityEntry = {
  repUserId: string;
  date: string;
  slot: AppointmentSlotKey;
};

type SubmissionStatus = {
  repUserId: string;
  submittedAt: string;
};

export default function AvailabilityPage() {
  const [currentUser, setCurrentUser] = useState<CurrentAppUser | null>(null);
  const [users, setUsers] = useState<ActiveAppUser[]>([]);
  const [selectedRepId, setSelectedRepId] = useState("");
  const [availability, setAvailability] = useState<AvailabilityEntry[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionStatus[]>([]);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentMonth = new Date();
  const nextMonth = addMonths(new Date(), 1);
  const currentMonthDays = useMemo(() => getMonthGrid(currentMonth), [currentMonth]);
  const nextMonthDays = useMemo(() => getMonthGrid(nextMonth), [nextMonth]);

  useEffect(() => {
    async function loadAvailability() {
      const [appUser, activeUsers, availabilityResponse, submissionResponse] = await Promise.all([
        getCurrentAppUser(),
        getActiveAppUsers(),
        supabase.from("rep_availability").select("rep_user_id, date, slot"),
        supabase.from("availability_submissions").select("rep_user_id, submitted_at"),
      ]);

      setCurrentUser(appUser);
      setUsers(activeUsers.filter((user) => user.roleName === "Sales Rep"));
      setSelectedRepId(appUser?.id ?? "");
      setAvailability(
        ((availabilityResponse.data as Array<Record<string, unknown>> | null) ?? []).map((entry) => ({
          repUserId: String(entry.rep_user_id),
          date: String(entry.date),
          slot: String(entry.slot) as AppointmentSlotKey,
        })),
      );
      setSubmissions(
        ((submissionResponse.data as Array<Record<string, unknown>> | null) ?? []).map((entry) => ({
          repUserId: String(entry.rep_user_id),
          submittedAt: String(entry.submitted_at),
        })),
      );
    }

    void loadAvailability();
  }, []);

  useEffect(() => {
    if (!selectedRepId) {
      return;
    }

    const next: Record<string, boolean> = {};
    availability
      .filter((entry) => entry.repUserId === selectedRepId && entry.date >= toDateKey(nextMonth))
      .forEach((entry) => {
        next[`${entry.date}__${entry.slot}`] = true;
      });
    setSelection(next);
  }, [availability, nextMonth, selectedRepId]);

  const canManageAll = ["Owner", "Sales Manager", "Office Manager"].includes(currentUser?.roleName ?? "");
  const effectiveRepId = canManageAll ? selectedRepId || users[0]?.id || "" : currentUser?.id || "";
  const selectedRep = users.find((user) => user.id === effectiveRepId) ?? null;

  const currentMonthEntries = availability.filter(
    (entry) => entry.repUserId === effectiveRepId && entry.date < toDateKey(nextMonth),
  );

  async function handleSubmit() {
    if (!effectiveRepId) {
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    const slots = Object.entries(selection)
      .filter(([, selected]) => selected)
      .map(([key]) => {
        const [date, slot] = key.split("__");
        return createSlotRecord(date, slot as AppointmentSlotKey);
      });

    const response = await fetch("/api/availability/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repUserId: effectiveRepId,
        location: selectedRep?.location ?? "Ellsworth",
        monthStart: toDateKey(nextMonth),
        slots,
      }),
    });

    const result = (await response.json()) as { count?: number; error?: string };
    if (response.ok) {
      setAvailability((current) => [
        ...current.filter((entry) => !(entry.repUserId === effectiveRepId && entry.date >= toDateKey(nextMonth))),
        ...slots.map((slot) => ({
          repUserId: effectiveRepId,
          date: slot.date,
          slot: slot.slot,
        })),
      ]);
      setSubmissions((current) => [
        ...current.filter((entry) => entry.repUserId !== effectiveRepId),
        { repUserId: effectiveRepId, submittedAt: new Date().toISOString() },
      ]);
      setMessage(`Submitted ${result.count ?? slots.length} slots.`);
    } else {
      setMessage(result.error || "Unable to submit availability.");
    }
    setIsSubmitting(false);
  }

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Calendar" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar
          title="Availability"
          titlePrefix={
            <Link href="/calendar" className="text-lg text-stone-400 transition hover:text-stone-700">
              ←
            </Link>
          }
        />

        <div className="space-y-6 p-8">
          {message ? (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
              {message}
            </div>
          ) : null}

          {canManageAll ? (
            <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
              <label className="text-sm font-medium text-stone-700">View availability for rep</label>
              <select
                value={effectiveRepId}
                onChange={(event) => setSelectedRepId(event.target.value)}
                className="mt-2 min-h-12 w-full max-w-sm rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </select>
            </section>
          ) : null}

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">
              Submission status
            </h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {users.map((user) => {
                const submission = submissions.find((entry) => entry.repUserId === user.id);
                return (
                  <div key={user.id} className="rounded-2xl bg-stone-50 px-4 py-4">
                    <p className="font-medium text-stone-900">{user.fullName}</p>
                    <p className={`mt-2 text-sm ${submission ? "text-stone-500" : "text-rose-600"}`}>
                      {submission
                        ? `${user.firstName} — submitted ${new Date(submission.submittedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}`
                        : `${user.fullName} — NOT SUBMITTED`}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">
              Current month submitted availability
            </h2>
            <div className="mt-5 grid gap-3 md:grid-cols-6">
              {currentMonthDays.map((day) => {
                const dateKey = toDateKey(day);
                const dayEntries = currentMonthEntries.filter((entry) => entry.date === dateKey);
                return (
                  <div key={dateKey} className="rounded-2xl border border-stone-200 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
                      {day.toLocaleDateString("en-US", { weekday: "short" })}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-stone-950">{day.getDate()}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {APPOINTMENT_SLOTS.map((slot) => {
                        const selected = dayEntries.some((entry) => entry.slot === slot.key);
                        return (
                          <span
                            key={slot.key}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                              selected ? "bg-primary text-white" : "bg-stone-100 text-stone-400"
                            }`}
                          >
                            {slot.key}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-stone-950">
                  Next month availability
                </h2>
                <p className="mt-1 text-sm text-stone-500">{formatMonthLabel(nextMonth)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {APPOINTMENT_SLOTS.map((slot) => (
                  <button
                    key={slot.key}
                    type="button"
                    onClick={() =>
                      setSelection((current) => {
                        const next = { ...current };
                        nextMonthDays.forEach((day) => {
                          next[`${toDateKey(day)}__${slot.key}`] = true;
                        });
                        return next;
                      })
                    }
                    className="rounded-full bg-stone-100 px-3 py-2 text-sm text-stone-700"
                  >
                    Select all {slot.key}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelection({})}
                  className="rounded-full bg-stone-100 px-3 py-2 text-sm text-stone-700"
                >
                  Clear all
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-6">
              {nextMonthDays.map((day) => (
                <div key={toDateKey(day)} className="rounded-2xl border border-stone-200 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
                    {day.toLocaleDateString("en-US", { weekday: "short" })}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-stone-950">{day.getDate()}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {APPOINTMENT_SLOTS.map((slot) => {
                      const key = `${toDateKey(day)}__${slot.key}`;
                      const selected = !!selection[key];
                      return (
                        <button
                          key={slot.key}
                          type="button"
                          onClick={() =>
                            setSelection((current) => ({
                              ...current,
                              [key]: !current[key],
                            }))
                          }
                          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                            selected ? "bg-primary text-white" : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {slot.key}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={Object.values(selection).filter(Boolean).length < 10 || isSubmitting}
                className="min-h-12 rounded-2xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Submit availability"}
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
