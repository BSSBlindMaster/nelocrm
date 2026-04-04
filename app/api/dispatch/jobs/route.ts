import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);

  const startOfDay = `${date}T00:00:00`;
  const endOfDay = `${date}T23:59:59.999`;

  // Try the join query first. If the DB has multiple FKs from jobs -> app_users
  // (e.g. assigned_to AND installer_id), the implicit "app_users" join is
  // ambiguous and PostgREST returns a 400. We attempt the explicit hint first,
  // then fall back to the implicit one, then fall back to no join at all.
  let jobs: Array<Record<string, unknown>> | null = null;
  let error: { message: string } | null = null;

  // Attempt 1: explicit FK hint (handles multiple FKs to app_users)
  const attempt1 = await supabaseAdmin
    .from("jobs")
    .select(
      `
      *,
      customers ( id, name, phone, address, city, state, zip, gate_code ),
      app_users!assigned_to ( id, first_name, last_name, phone )
    `,
    )
    .gte("scheduled_at", startOfDay)
    .lte("scheduled_at", endOfDay)
    .order("scheduled_at", { ascending: true });

  if (!attempt1.error) {
    jobs = attempt1.data as Array<Record<string, unknown>> | null;
  } else {
    console.log("[dispatch/jobs] attempt1 (explicit FK) failed:", attempt1.error.message);

    // Attempt 2: implicit join (works when only one FK to app_users)
    const attempt2 = await supabaseAdmin
      .from("jobs")
      .select(
        `
        *,
        customers ( id, name, phone, address, city, state, zip, gate_code ),
        app_users ( id, first_name, last_name, phone )
      `,
      )
      .gte("scheduled_at", startOfDay)
      .lte("scheduled_at", endOfDay)
      .order("scheduled_at", { ascending: true });

    if (!attempt2.error) {
      jobs = attempt2.data as Array<Record<string, unknown>> | null;
    } else {
      console.log("[dispatch/jobs] attempt2 (implicit) failed:", attempt2.error.message);

      // Attempt 3: no join — just get the raw jobs
      const attempt3 = await supabaseAdmin
        .from("jobs")
        .select("*")
        .gte("scheduled_at", startOfDay)
        .lte("scheduled_at", endOfDay)
        .order("scheduled_at", { ascending: true });

      jobs = attempt3.data as Array<Record<string, unknown>> | null;
      error = attempt3.error;
      console.log("[dispatch/jobs] attempt3 (no join):", attempt3.error?.message ?? "ok", "| rows:", (jobs ?? []).length);
    }
  }

  console.log("[dispatch/jobs] date:", date, "| rows:", (jobs ?? []).length);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if ((jobs ?? []).length === 0) {
    // Log what dates actually have jobs to diagnose mismatches
    const { data: sample } = await supabaseAdmin
      .from("jobs")
      .select("id, scheduled_at")
      .order("scheduled_at", { ascending: false })
      .limit(5);
    console.log("[dispatch/jobs] no jobs for", date, "— sample scheduled_at values in DB:", (sample ?? []).map((j: Record<string, unknown>) => j.scheduled_at));
  }

  // Fetch quote lines for each job that has a project_id
  const projectIds = (jobs ?? [])
    .map((j) => j.project_id)
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

  const enriched = (jobs ?? []).map((job) => ({
    ...job,
    products: job.project_id ? quoteLinesMap[job.project_id as string] ?? [] : [],
  }));

  return NextResponse.json({ jobs: enriched });
}
