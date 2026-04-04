import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { geocodeAddress } from "@/lib/geocode";
import {
  buildOptimizedSchedule,
  type Job as SmartJob,
} from "@/lib/smart-schedule";

export async function POST(request: Request) {
  const body = await request.json();
  const { date, installer_id, start_time, start_lat, start_lng } = body;

  if (!date || !installer_id || !start_time) {
    return NextResponse.json(
      { error: "date, installer_id, and start_time are required" },
      { status: 400 },
    );
  }

  const startOfDay = `${date}T00:00:00`;
  const endOfDay = `${date}T23:59:59`;

  const { data: jobs, error } = await supabaseAdmin
    .from("jobs")
    .select(
      `
      id,
      address,
      lat,
      lng,
      duration_minutes,
      customers ( name, address, city, state, zip )
    `,
    )
    .eq("assigned_to", installer_id)
    .gte("scheduled_at", startOfDay)
    .lte("scheduled_at", endOfDay)
    .order("scheduled_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({
      schedule: [],
      total_drive_minutes: 0,
      total_work_minutes: 0,
    });
  }

  // Geocode any jobs missing lat/lng
  const geocoded: SmartJob[] = [];
  for (const job of jobs) {
    const row = job as Record<string, unknown>;
    const customer = row.customers as Record<string, unknown> | null;
    let lat = row.lat as number | null;
    let lng = row.lng as number | null;

    if (!lat || !lng) {
      const jobAddr = row.address as string | null;
      const fullAddr = jobAddr
        || [customer?.address, customer?.city, customer?.state, customer?.zip]
            .filter(Boolean)
            .join(", ");

      if (fullAddr) {
        const coords = await geocodeAddress(fullAddr);
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
          // Save geocoded coords back to the job
          await supabaseAdmin
            .from("jobs")
            .update({ lat, lng })
            .eq("id", row.id as string);
        }
      }
    }

    geocoded.push({
      id: row.id as string,
      customer_name: (customer?.name as string) ?? "Unknown",
      address:
        (row.address as string) ||
        [customer?.address, customer?.city, customer?.state]
          .filter(Boolean)
          .join(", "),
      estimated_duration: (row.duration_minutes as number) ?? 90,
      lat: lat ?? undefined,
      lng: lng ?? undefined,
    });
  }

  const startDate = new Date(`${date}T${start_time}`);
  const schedule = buildOptimizedSchedule(
    geocoded,
    start_lat ?? 33.4152,
    start_lng ?? -111.891,
    startDate,
  );

  // Update jobs in database with optimized times
  for (const item of schedule) {
    await supabaseAdmin
      .from("jobs")
      .update({
        scheduled_at: item.start_time,
        drive_time_minutes: item.drive_time_minutes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
  }

  const totalDrive = schedule.reduce((s, j) => s + j.drive_time_minutes, 0);
  const totalWork = schedule.reduce((s, j) => s + j.estimated_duration, 0);

  return NextResponse.json({
    schedule,
    total_drive_minutes: totalDrive,
    total_work_minutes: totalWork,
    end_time: schedule.length > 0 ? schedule[schedule.length - 1].end_time : null,
  });
}
