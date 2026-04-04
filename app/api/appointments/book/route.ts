import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function sendRepNotification(to: string | null, message: string) {
  if (!to) {
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    return;
  }

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: to,
      From: from,
      Body: message,
    }),
  });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    customerId?: string;
    customerName?: string;
    phone?: string;
    address?: string;
    repUserId: string;
    date: string;
    slot: string;
    location: string;
    interestedIn?: string;
    notes?: string;
  };

  if (!payload.repUserId || !payload.date || !payload.slot) {
    return NextResponse.json({ error: "Missing appointment fields." }, { status: 400 });
  }

  let customerId = payload.customerId ?? "";

  if (!customerId) {
    const { data: newCustomer, error: customerError } = await supabaseAdmin
      .from("customers")
      .insert({
        name: payload.customerName ?? "New customer",
        phone: payload.phone ?? null,
        address: payload.address ?? null,
        type: "lead",
      })
      .select("id")
      .maybeSingle();

    if (customerError) {
      return NextResponse.json({ error: customerError.message }, { status: 400 });
    }

    customerId = String((newCustomer as { id?: string } | null)?.id ?? "");
  }

  const { data: appointment, error: appointmentError } = await supabaseAdmin
    .from("appointments")
    .insert({
      customer_id: customerId,
      rep_user_id: payload.repUserId,
      date: payload.date,
      slot: payload.slot,
      location: payload.location,
      interested_in: payload.interestedIn ?? null,
      notes: payload.notes ?? null,
      address: payload.address ?? null,
      status: "booked",
    })
    .select("id")
    .maybeSingle();

  if (appointmentError) {
    return NextResponse.json({ error: appointmentError.message }, { status: 400 });
  }

  await supabaseAdmin
    .from("appointment_slots")
    .update({
      status: "booked",
      appointment_id: (appointment as { id?: string } | null)?.id ?? null,
    })
    .eq("rep_user_id", payload.repUserId)
    .eq("date", payload.date)
    .eq("slot", payload.slot);

  const [{ data: rep }, { data: customer }] = await Promise.all([
    supabaseAdmin
      .from("app_users")
      .select("phone, first_name, last_name")
      .eq("id", payload.repUserId)
      .maybeSingle(),
    supabaseAdmin
      .from("customers")
      .select("name, first_name, last_name, address")
      .eq("id", customerId)
      .maybeSingle(),
  ]);

  const customerName =
    String((customer as { name?: string } | null)?.name ?? "").trim() ||
    [
      (customer as { first_name?: string } | null)?.first_name ?? "",
      (customer as { last_name?: string } | null)?.last_name ?? "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    payload.customerName ||
    "Customer";

  const repPhone = (rep as { phone?: string } | null)?.phone ?? null;
  const address =
    (customer as { address?: string } | null)?.address ??
    payload.address ??
    "Address unavailable";

  await sendRepNotification(
    repPhone,
    `New appointment: ${customerName} on ${payload.date} ${payload.slot}. Address: ${address}. Login at nelocrm.com for details.`,
  );

  return NextResponse.json({ success: true, appointmentId: (appointment as { id?: string } | null)?.id ?? null });
}
