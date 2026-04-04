import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const body = await request.json();
  const { jobId, assignedTo, scheduledAt } = body;

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const updateFields: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (assignedTo !== undefined) {
    updateFields.assigned_to = assignedTo || null;
  }

  if (scheduledAt !== undefined) {
    updateFields.scheduled_at = scheduledAt;
  }

  const { data: job, error } = await supabaseAdmin
    .from("jobs")
    .update(updateFields)
    .eq("id", jobId)
    .select(
      `
      id,
      assigned_to,
      scheduled_at,
      customers ( name, phone, address, city, state, zip ),
      app_users ( id, first_name, last_name, phone )
    `,
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send SMS notification to newly assigned installer
  const installer = job.app_users as unknown as Record<string, unknown> | null;
  const customer = job.customers as unknown as Record<string, unknown> | null;

  if (installer?.phone && customer) {
    const scheduledDate = job.scheduled_at
      ? new Date(job.scheduled_at as string).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : "TBD";
    const scheduledTime = job.scheduled_at
      ? new Date(job.scheduled_at as string).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
      : "TBD";

    const address = [customer.address, customer.city, customer.state]
      .filter(Boolean)
      .join(", ");

    const message = `You have been assigned a job: ${customer.name} at ${address} on ${scheduledDate} at ${scheduledTime}`;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;

    if (accountSid && authToken && from) {
      try {
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization:
                "Basic " +
                Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: installer.phone as string,
              From: from,
              Body: message,
            }),
          },
        );
      } catch {
        // SMS failure should not block the assignment
      }
    }
  }

  return NextResponse.json({ success: true, job });
}
