import { supabase } from "./supabase";

export async function getUserPermissions(userId: string): Promise<string[]> {
  const { data: user } = await supabase
    .from("app_users")
    .select("role_id")
    .eq("auth_user_id", userId)
    .single();

  if (!user) return [];

  const { data: rolePerms } = await supabase
    .from("role_permissions")
    .select("permission_key, allowed")
    .eq("role_id", user.role_id);

  const { data: overrides } = await supabase
    .from("user_permission_overrides")
    .select("permission_key, allowed")
    .eq("user_id", userId);

  const perms: Record<string, boolean> = {};
  rolePerms?.forEach((p) => {
    perms[p.permission_key] = p.allowed;
  });
  overrides?.forEach((p) => {
    perms[p.permission_key] = p.allowed;
  });

  return Object.entries(perms)
    .filter(([, allowed]) => allowed)
    .map(([key]) => key);
}

export function hasPermission(userPerms: string[], key: string): boolean {
  return userPerms.includes(key);
}
