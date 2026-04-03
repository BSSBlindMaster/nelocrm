import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-key",
  );
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
