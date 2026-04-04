import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const body = await request.json();
  const { project_id, user_id, sale_amount } = body;

  if (!project_id || !user_id || sale_amount == null) {
    return NextResponse.json(
      { error: "project_id, user_id, and sale_amount are required" },
      { status: 400 },
    );
  }

  // Look up commission rate from app_users
  const { data: appUser } = await supabaseAdmin
    .from("app_users")
    .select("commission_rate")
    .eq("id", user_id)
    .single();

  const rate = Number((appUser as Record<string, unknown> | null)?.commission_rate ?? 0.08);
  const totalCommission = sale_amount * rate;
  const halfCommission = Math.round(totalCommission * 50) / 100; // round to cents

  // Create Part 1 — Sale commission (50%)
  const { data: part1, error: err1 } = await supabaseAdmin
    .from("commissions")
    .insert({
      project_id,
      user_id,
      sale_amount,
      commission_rate: rate,
      commission_amount: halfCommission,
      payment_part: 1,
      payment_label: "Sale commission (50%)",
      status: "pending_sale",
    })
    .select()
    .single();

  if (err1) {
    return NextResponse.json({ error: err1.message }, { status: 500 });
  }

  // Create Part 2 — Install commission (50%)
  const { data: part2, error: err2 } = await supabaseAdmin
    .from("commissions")
    .insert({
      project_id,
      user_id,
      sale_amount,
      commission_rate: rate,
      commission_amount: totalCommission - halfCommission, // remainder to avoid rounding drift
      payment_part: 2,
      payment_label: "Install commission (50%)",
      status: "pending_install",
    })
    .select()
    .single();

  if (err2) {
    return NextResponse.json({ error: err2.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    commissions: [part1, part2],
    total_commission: totalCommission,
  });
}
