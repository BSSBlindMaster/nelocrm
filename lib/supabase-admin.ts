import { createClient } from "@supabase/supabase-js";

function getSafeSupabaseUrl() {
  const candidate = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (candidate) {
    try {
      const parsed = new URL(candidate);

      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return candidate;
      }
    } catch {
      // Fall through to the placeholder-safe default below.
    }
  }

  return "https://example.supabase.co";
}

export const supabaseAdmin = createClient(
  getSafeSupabaseUrl(),
  process.env.SUPABASE_SERVICE_ROLE_KEY || "service-role-key",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
