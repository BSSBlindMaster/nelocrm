import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "date parameter required" }, { status: 400 });
  }

  // Cast scheduled_at to date in the query using two approaches:
  // 1. Wide UTC range for the requested date
  // 2. Fallback: also try without Z suffix for naive timestamps
  const startOfDay = `${date}T00:00:00`;
  const endOfDay = `${date}T23:59:59.999`;

  console.log("[dispatch/jobs] date param:", date, "| range:", startOfDay, "to", endOfDay);

  const { data: jobs, error } = await supabaseAdmin
    .from("jobs")
    .select(
      `
      id,
      customer_id,
      project_id,
      assigned_to,
      job_type,
      status,
      location,
      address,
      gate_code,
      lat,
      lng,
      scheduled_at,
      duration_minutes,
      duration_auto_calculated,
      drive_time_minutes,
      notes,
      customers (
        id,
        name,
        phone,
        address,
        city,
        state,
        zip
      ),
      app_users (
        id,
        first_name,
        last_name,
        phone
      )
    `,
    )
    .gte("scheduled_at", startOfDay)
    .lte("scheduled_at", endOfDay)
    .order("scheduled_at", { ascending: true });

  console.log("[dispatch/jobs] query result — error:", error?.message ?? "none", "| rows:", (jobs ?? []).length);

  // If no jobs found for this date, log what dates DO have jobs to help debug
  if ((jobs ?? []).length === 0) {
    const { data: sample } = await supabaseAdmin
      .from("jobs")
      .select("id, scheduled_at")
      .order("scheduled_at", { ascending: false })
      .limit(5);
    console.log("[dispatch/jobs] no jobs for", date, "— sample scheduled_at values:", (sample ?? []).map((j: Record<string, unknown>) => j.scheduled_at));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch quote lines for each job that has a project_id
  const projectIds = (jobs ?? [])
    .map((j: Record<string, unknown>) => j.project_id)
    .filter(Boolean) as string[];

  let quoteLinesMap: Record<string, Array<Record<string, unknown>>> = {};

  if (projectIds.length > 0) {
    const { data: projects } = await supabaseAdmin
      .from("projects")
      .select("id, quote_id")
      .in("id", projectIds);

    const quoteIds = (projects ?? [])
      .map((p: Record<string, unknown>) => p.quote_id)
      .filter(Boolean) as string[];

    if (quoteIds.length > 0) {
      const { data: lines } = await supabaseAdmin
        .from("quote_lines")
        .select(
          `
          id,
          quote_id,
          room,
          quantity,
          products ( name ),
          fabrics ( name ),
          lift_options ( name )
        `,
        )
        .in("quote_id", quoteIds);

      const projectQuoteMap: Record<string, string> = {};
      (projects ?? []).forEach((p: Record<string, unknown>) => {
        if (p.id && p.quote_id) {
          projectQuoteMap[p.id as string] = p.quote_id as string;
        }
      });

      (lines ?? []).forEach((line: Record<string, unknown>) => {
        const quoteId = line.quote_id as string;
        for (const [projId, qId] of Object.entries(projectQuoteMap)) {
          if (qId === quoteId) {
            if (!quoteLinesMap[projId]) quoteLinesMap[projId] = [];
            quoteLinesMap[projId].push(line);
          }
        }
      });
    }
  }

  const enriched = (jobs ?? []).map((job: Record<string, unknown>) => ({
    ...job,
    products: job.project_id ? quoteLinesMap[job.project_id as string] ?? [] : [],
  }));

  return NextResponse.json({ jobs: enriched });
}
