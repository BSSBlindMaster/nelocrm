import { supabase } from "@/lib/supabase";

export type CurrentAppUser = {
  id: string;
  authUserId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  location: string;
  roleName: string;
  phone?: string;
};

export type ActiveAppUser = {
  id: string;
  authUserId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  location: string;
  roleName: string;
  phone?: string;
};

function buildFullName(firstName: string, lastName: string) {
  return [firstName, lastName].filter(Boolean).join(" ") || "Unnamed user";
}

export async function getCurrentAppUser(): Promise<CurrentAppUser | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const authUserId = session?.user?.id;
  if (!authUserId) {
    return null;
  }

  const { data } = await supabase
    .from("app_users")
    .select("id, auth_user_id, first_name, last_name, location, phone, roles(name)")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  const record = data as
    | {
        id?: string | null;
        auth_user_id?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        location?: string | null;
        phone?: string | null;
        roles?: { name?: string | null } | null;
      }
    | null;

  if (!record?.id || !record.auth_user_id) {
    return null;
  }

  const firstName = record.first_name ?? "";
  const lastName = record.last_name ?? "";

  return {
    id: record.id,
    authUserId: record.auth_user_id,
    firstName,
    lastName,
    fullName: buildFullName(firstName, lastName),
    location: record.location ?? "",
    roleName: record.roles?.name ?? "",
    phone: record.phone ?? "",
  };
}

export async function getActiveAppUsers(): Promise<ActiveAppUser[]> {
  const { data } = await supabase
    .from("app_users")
    .select("id, auth_user_id, first_name, last_name, location, phone, active, roles(name)")
    .eq("active", true)
    .order("first_name", { ascending: true });

  const rows =
    (data as Array<{
      id?: string | null;
      auth_user_id?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      location?: string | null;
      phone?: string | null;
      roles?: { name?: string | null } | null;
    }> | null) ?? [];

  return rows
    .filter((row) => row.id && row.auth_user_id)
    .map((row) => {
      const firstName = row.first_name ?? "";
      const lastName = row.last_name ?? "";

      return {
        id: row.id!,
        authUserId: row.auth_user_id!,
        firstName,
        lastName,
        fullName: buildFullName(firstName, lastName),
        location: row.location ?? "",
        roleName: row.roles?.name ?? "",
        phone: row.phone ?? "",
      };
    });
}
