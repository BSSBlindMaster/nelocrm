import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const { repUserId, location, monthStart, slots } = (await request.json()) as {
    repUserId: string;
    location?: string;
    monthStart: string;
    slots: Array<{ date: string; slot: string }>;
  };

  if (!repUserId || !Array.isArray(slots) || slots.length === 0) {
    return NextResponse.json({ error: "Missing availability payload." }, { status: 400 });
  }

  await Promise.all([
    supabaseAdmin.from("rep_availability").delete().eq("rep_user_id", repUserId).gte("date", monthStart),
    supabaseAdmin.from("appointment_slots").delete().eq("rep_user_id", repUserId).gte("date", monthStart).eq("status", "open"),
  ]);

  const availabilityRows = slots.map((entry) => ({
    rep_user_id: repUserId,
    date: entry.date,
    slot: entry.slot,
    location: location ?? null,
  }));

  const slotRows = slots.map((entry) => ({
    rep_user_id: repUserId,
    date: entry.date,
    slot: entry.slot,
    location: location ?? null,
    status: "open",
  }));

  const [{ error: availabilityError }, { error: slotsError }, { error: submissionError }] =
    await Promise.all([
      supabaseAdmin.from("rep_availability").insert(availabilityRows),
      supabaseAdmin.from("appointment_slots").insert(slotRows),
      supabaseAdmin
        .from("availability_submissions")
        .upsert(
          {
            rep_user_id: repUserId,
            month_start: monthStart,
            slot_count: slots.length,
            submitted_at: new Date().toISOString(),
          },
          { onConflict: "rep_user_id,month_start" },
        ),
    ]);

  if (availabilityError || slotsError || submissionError) {
    return NextResponse.json(
      { error: availabilityError?.message || slotsError?.message || submissionError?.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, count: slots.length });
}
