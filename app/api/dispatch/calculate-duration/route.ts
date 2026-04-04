import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const SETUP_CLEANUP_BUFFER = 15; // minutes

export async function POST(request: Request) {
  const body = await request.json();
  const { project_id, quote_lines } = body;

  // Load install time rules
  const { data: rules } = await supabaseAdmin
    .from("install_time_rules")
    .select("product_type, minutes_per_unit");

  const rulesMap: Record<string, number> = {};
  ((rules as Array<{ product_type: string; minutes_per_unit: number }>) ?? []).forEach(
    (r) => {
      rulesMap[r.product_type.toLowerCase()] = r.minutes_per_unit;
    },
  );

  let lines: Array<{
    product_name: string;
    quantity: number;
  }> = [];

  if (project_id) {
    // Look up quote lines from project
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("quote_id")
      .eq("id", project_id)
      .single();

    if (project?.quote_id) {
      const { data: dbLines } = await supabaseAdmin
        .from("quote_lines")
        .select("quantity, products ( name )")
        .eq("quote_id", project.quote_id);

      lines = ((dbLines as Array<Record<string, unknown>>) ?? []).map((l) => ({
        product_name:
          ((l.products as Record<string, unknown> | null)?.name as string) ??
          "Unknown",
        quantity: (l.quantity as number) ?? 1,
      }));
    }
  } else if (Array.isArray(quote_lines)) {
    lines = quote_lines.map(
      (l: { product_name?: string; quantity?: number }) => ({
        product_name: l.product_name ?? "Unknown",
        quantity: l.quantity ?? 1,
      }),
    );
  }

  if (lines.length === 0) {
    return NextResponse.json({
      total_minutes: SETUP_CLEANUP_BUFFER,
      breakdown: [],
      buffer_minutes: SETUP_CLEANUP_BUFFER,
    });
  }

  // Match each line to an install time rule
  const breakdown = lines.map((line) => {
    const nameLower = line.product_name.toLowerCase();
    let minutesEach = 30; // default

    for (const [ruleType, mins] of Object.entries(rulesMap)) {
      if (nameLower.includes(ruleType) || ruleType.includes(nameLower)) {
        minutesEach = mins;
        break;
      }
    }

    return {
      product: line.product_name,
      quantity: line.quantity,
      minutes_each: minutesEach,
      subtotal: minutesEach * line.quantity,
    };
  });

  const workMinutes = breakdown.reduce((s, b) => s + b.subtotal, 0);
  const totalMinutes = workMinutes + SETUP_CLEANUP_BUFFER;

  return NextResponse.json({
    total_minutes: totalMinutes,
    breakdown,
    buffer_minutes: SETUP_CLEANUP_BUFFER,
  });
}
