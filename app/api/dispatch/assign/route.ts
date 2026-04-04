import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { jobId, assignedTo, scheduledAt, durationMinutes } = (await request.json()) as {
    jobId: string;
    assignedTo: string | null;
    scheduledAt?: string;
    durationMinutes?: number;
  };

  const { data: updatedJob, error: updateError } = await supabaseAdmin
    .from("jobs")
    .update({
      assigned_to: assignedTo,
      installer_id: assignedTo,
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes,
    })
    .eq("id", jobId)
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
        zip
      ),
      app_users!jobs_assigned_to_fkey (
        id,
        first_name,
        last_name,
        phone
      )
    `)
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const job = updatedJob as Record<string, unknown> | null;
  const customer =
    job?.customers && !Array.isArray(job.customers)
      ? (job.customers as Record<string, unknown>)
      : null;
  const installer =
    job?.app_users && !Array.isArray(job.app_users)
      ? (job.app_users as Record<string, unknown>)
      : null;

  const toPhone = typeof installer?.phone === "string" ? installer.phone : "";
  if (toPhone) {
    const customerName =
      typeof customer?.name === "string"
        ? customer.name
        : [customer?.first_name, customer?.last_name]
            .filter((value) => typeof value === "string" && value)
            .join(" ") || "Customer";
    const address =
      [
        customer?.address,
        customer?.city,
        customer?.state,
        customer?.zip,
      ]
        .filter((value) => typeof value === "string" && value)
        .join(", ") || String(job?.address ?? "Address unavailable");

    await fetch(new URL("/api/sms/send", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: toPhone,
        message: `You have been assigned a job: ${customerName} at ${address} on ${new Date(String(job?.scheduled_at ?? scheduledAt ?? new Date().toISOString())).toLocaleDateString("en-US")} at ${new Date(String(job?.scheduled_at ?? scheduledAt ?? new Date().toISOString())).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
      }),
    }).catch(() => null);
  }

  return NextResponse.json({ job: updatedJob });
}
