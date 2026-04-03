import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-key";

let client: SupabaseClient | undefined;

export function createSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

function getSupabaseClient() {
  if (!client) {
    client = createSupabaseClient();
  }

  return client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const value = getSupabaseClient()[property as keyof SupabaseClient];

    if (typeof value === "function") {
      return value.bind(getSupabaseClient());
    }

    return value;
  },
});
