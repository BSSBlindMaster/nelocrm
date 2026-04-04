import { NextResponse } from "next/server";
import { getSampleDispatchJobs, type DispatchJob } from "@/lib/dispatch-samples";
import { geocodeAddress } from "@/lib/geocode";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function getCustomerName(record: Record<string, unknown> | null | undefined) {
  if (!record) return "Customer";
  const name = typeof record.name === "string" ? record.name : "";
  const first = typeof record.first_name === "string" ? record.first_name : "";
  const last = typeof record.last_name === "string" ? record.last_name : "";
  return name || [first, last].filter(Boolean).join(" ") || "Customer";
}

function getUserName(record: Record<string, unknown> | null | undefined) {
  if (!record) return "Unassigned";
  return [record.first_name, record.last_name]
    .filter((value) => typeof value === "string" && value)
    .join(" ") || "Unassigned";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;

  const { data: jobsData } = await supabaseAdmin
    .from("jobs")
    .select(`
      *,
      customers (
        id,
        name,
        first_name,
        last_name,
        phone,
        address,
        city,
        state,
        zip,
        gate_code
      ),
      app_users!jobs_assigned_to_fkey (
        id,
        first_name,
        last_name,
        phone
      ),
      projects (
        id,
        quote_id
      )
    `)
    .gte("scheduled_at", start)
    .lte("scheduled_at", end)
    .order("scheduled_at", { ascending: true });

  const jobRows = (jobsData as Array<Record<string, unknown>> | null) ?? [];
  const quoteIds = jobRows
    .map((job) => {
      const project =
        job.projects && !Array.isArray(job.projects)
          ? (job.projects as Record<string, unknown>)
          : null;
      return typeof project?.quote_id === "string" ? project.quote_id : "";
    })
    .filter(Boolean);

  const { data: quoteLinesData } = quoteIds.length
    ? await supabaseAdmin.from("quote_lines").select("*").in("quote_id", quoteIds)
    : { data: [] };

  const quoteLines = (quoteLinesData as Array<Record<string, unknown>> | null) ?? [];

  let jobs: DispatchJob[] = await Promise.all(
    jobRows.map(async (job) => {
      const customer =
        job.customers && !Array.isArray(job.customers)
          ? (job.customers as Record<string, unknown>)
          : null;
      const assignedUser =
        job.app_users && !Array.isArray(job.app_users)
          ? (job.app_users as Record<string, unknown>)
          : null;
      const project =
        job.projects && !Array.isArray(job.projects)
          ? (job.projects as Record<string, unknown>)
          : null;

      const address =
        [
          customer?.address,
          customer?.city,
          customer?.state,
          customer?.zip,
        ]
          .filter((value) => typeof value === "string" && value)
          .join(", ") || String(job.address ?? "Address unavailable");

      const lat = typeof job.lat === "number" ? job.lat : Number(job.lat ?? 0);
      const lng = typeof job.lng === "number" ? job.lng : Number(job.lng ?? 0);
      const geocoded =
        lat && lng
          ? { lat, lng }
          : await geocodeAddress(address);

      const products = quoteLines
        .filter((line) => String(line.quote_id ?? "") === String(project?.quote_id ?? ""))
        .map((line) => ({
          id: String(line.id ?? ""),
          name: String(line.product_name ?? line.product ?? "Window treatment"),
          color: String(line.color_name ?? line.color ?? line.fabric_name ?? "Selected color"),
          lift_option: String(line.lift_option_name ?? "Standard"),
          quantity: Number(line.quantity ?? 1),
        }));

      return {
        job_id: String(job.id ?? ""),
        project_id: typeof job.project_id === "string" ? job.project_id : null,
        customer_id: typeof job.customer_id === "string" ? job.customer_id : null,
        customer_name: getCustomerName(customer),
        phone: String(customer?.phone ?? ""),
        address,
        gate_code: typeof job.gate_code === "string" ? job.gate_code : typeof customer?.gate_code === "string" ? customer.gate_code : null,
        scheduled_at: String(job.scheduled_at ?? new Date().toISOString()),
        duration_minutes: Number(job.duration_minutes ?? 90),
        assigned_to: typeof job.assigned_to === "string" ? job.assigned_to : null,
        assigned_to_name: getUserName(assignedUser),
        assigned_to_phone: typeof assignedUser?.phone === "string" ? assignedUser.phone : null,
        status: String(job.status ?? "scheduled") as DispatchJob["status"],
        job_type: String(job.job_type ?? "Install") as DispatchJob["job_type"],
        lat: geocoded?.lat ?? 33.4152,
        lng: geocoded?.lng ?? -111.891,
        notes: typeof job.notes === "string" ? job.notes : "",
        products,
      };
    }),
  );

  if (jobs.length === 0) {
    jobs = getSampleDispatchJobs();
  }

  return NextResponse.json({ jobs });
}
