import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const body = await request.json();
  const { project_id } = body;

  if (!project_id) {
    return NextResponse.json(
      { error: "project_id is required" },
      { status: 400 },
    );
  }

  // Find the Part 2 commission for this project
  const { data: commission, error: findErr } = await supabaseAdmin
    .from("commissions")
    .select("id, status")
    .eq("project_id", project_id)
    .eq("payment_part", 2)
    .eq("status", "pending_install")
    .maybeSingle();

  if (findErr) {
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }

  if (!commission) {
    return NextResponse.json(
      { error: "No pending install commission found for this project" },
      { status: 404 },
    );
  }

  // Update to earned
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("commissions")
    .update({
      status: "earned",
      earned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", (commission as Record<string, unknown>).id)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, commission: updated });
}
