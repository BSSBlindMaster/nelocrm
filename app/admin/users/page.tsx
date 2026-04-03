"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import {
  groupPermissionsByCategory,
} from "@/lib/admin-permissions";
import { supabase } from "@/lib/supabase";

type AppUserRecord = {
  id: string;
  auth_user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  role_id: string | null;
  active: boolean | null;
  last_login_at?: string | null;
  roles?: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
  } | null;
};

type RoleRecord = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
};

type RolePermissionRecord = {
  role_id: string;
  permission_key: string;
  allowed: boolean;
};

type UserOverrideRecord = {
  user_id: string;
  permission_key: string;
  allowed: boolean;
};

type UserFormState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  location: "Ellsworth" | "Lindsay" | "Both" | "";
  role_id: string;
};

const emptyForm: UserFormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  location: "",
  role_id: "",
};

function getFullName(user: Partial<AppUserRecord>) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || "Unnamed User";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getLocationTone(location: string | null | undefined) {
  if ((location ?? "").toLowerCase() === "lindsay") {
    return "active";
  }

  if ((location ?? "").toLowerCase() === "both") {
    return "vip";
  }

  return "customer";
}

function formatLastLogin(lastLoginAt: string | null | undefined) {
  if (!lastLoginAt) {
    return "—";
  }

  return new Date(lastLoginAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AppUserRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionRecord[]>([]);
  const [userOverrides, setUserOverrides] = useState<UserOverrideRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [overrideMap, setOverrideMap] = useState<Record<string, boolean | undefined>>({});
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const permissionGroups = groupPermissionsByCategory();

  async function loadData(selectUserId?: string | null) {
    setIsLoading(true);

    const [usersResponse, rolesResponse, rolePermsResponse, overridesResponse] =
      await Promise.all([
        supabase
          .from("app_users")
          .select("id, auth_user_id, first_name, last_name, email, phone, location, role_id, active, last_login_at, roles(id, name, description, color)")
          .order("first_name"),
        supabase.from("roles").select("id, name, description, color").order("name"),
        supabase
          .from("role_permissions")
          .select("role_id, permission_key, allowed"),
        supabase
          .from("user_permission_overrides")
          .select("user_id, permission_key, allowed"),
      ]);

    setUsers((usersResponse.data as AppUserRecord[] | null) ?? []);
    setRoles((rolesResponse.data as RoleRecord[] | null) ?? []);
    setRolePermissions((rolePermsResponse.data as RolePermissionRecord[] | null) ?? []);
    setUserOverrides((overridesResponse.data as UserOverrideRecord[] | null) ?? []);
    setSelectedUserId(selectUserId ?? ((usersResponse.data as AppUserRecord[] | null)?.[0]?.id ?? null));
    setIsLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const selectedUser =
    users.find((user) => user.id === selectedUserId) ?? users[0] ?? null;

  const selectedRoleDefaults = useMemo(() => {
    const defaults: Record<string, boolean> = {};
    if (!form.role_id) {
      return defaults;
    }

    rolePermissions
      .filter((permission) => permission.role_id === form.role_id)
      .forEach((permission) => {
        defaults[permission.permission_key] = permission.allowed;
      });

    return defaults;
  }, [form.role_id, rolePermissions]);

  const selectedRole = roles.find((role) => role.id === form.role_id) ?? null;
  const isOwnerRole = selectedRole?.name === "Owner";

  function getEffectivePermission(key: string) {
    if (isOwnerRole) {
      return true;
    }

    if (key in overrideMap) {
      return overrideMap[key];
    }

    return selectedRoleDefaults[key] ?? false;
  }

  function openCreateDrawer() {
    setDrawerMode("create");
    setForm(emptyForm);
    setOverrideMap({});
    setIsDrawerOpen(true);
    setMessage("");
  }

  function openEditDrawer(user: AppUserRecord) {
    setDrawerMode("edit");
    setSelectedUserId(user.id);
    setForm({
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      location:
        user.location === "Ellsworth" ||
        user.location === "Lindsay" ||
        user.location === "Both"
          ? user.location
          : "",
      role_id: user.role_id ?? "",
    });

    const nextOverrides: Record<string, boolean | undefined> = {};
    userOverrides
      .filter((override) => override.user_id === user.auth_user_id)
      .forEach((override) => {
        nextOverrides[override.permission_key] = override.allowed;
      });

    setOverrideMap(nextOverrides);
    setIsDrawerOpen(true);
    setMessage("");
  }

  function updateForm<Key extends keyof UserFormState>(
    key: Key,
    value: UserFormState[Key],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetToRoleDefaults() {
    if (isOwnerRole) {
      return;
    }

    setOverrideMap({});
  }

  function togglePermission(key: string) {
    if (isOwnerRole) {
      return;
    }

    setOverrideMap((current) => {
      const roleDefault = selectedRoleDefaults[key] ?? false;
      const currentValue = key in current ? current[key] : roleDefault;
      const nextValue = !currentValue;

      if (nextValue === roleDefault) {
        const next = { ...current };
        delete next[key];
        return next;
      }

      return {
        ...current,
        [key]: nextValue,
      };
    });
  }

  async function handleSave() {
    if (!form.first_name || !form.last_name || !form.email || !form.location || !form.role_id) {
      return;
    }

    setIsSaving(true);
    setMessage("");

    if (drawerMode === "create") {
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: form.email,
          firstName: form.first_name,
          lastName: form.last_name,
          roleId: form.role_id,
          location: form.location,
          phone: form.phone,
        }),
      });

      const result = (await response.json()) as {
        error?: string;
        success?: boolean;
        userId?: string;
        appUserId?: string;
      };

      if (!response.ok || !result.success || !result.userId || !result.appUserId) {
        setMessage(result.error || "Unable to create auth user.");
        setIsSaving(false);
        return;
      }

      const overrideEntries = Object.entries(overrideMap).map(([permission_key, allowed]) => ({
        user_id: result.userId,
        permission_key,
        allowed,
      }));

      if (overrideEntries.length > 0 && !isOwnerRole) {
        await supabase.from("user_permission_overrides").insert(overrideEntries);
      }

      setMessage("User created — they will receive a login email");
      setIsDrawerOpen(false);
      await loadData(result.appUserId);
    } else if (selectedUser) {
      const { error: updateError } = await supabase
        .from("app_users")
        .update({
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone || null,
          location: form.location,
          role_id: form.role_id,
        })
        .eq("id", selectedUser.id);

      if (!updateError) {
        if (selectedUser.auth_user_id) {
          await supabase
            .from("user_permission_overrides")
            .delete()
            .eq("user_id", selectedUser.auth_user_id);

          const overrideEntries = Object.entries(overrideMap).map(
            ([permission_key, allowed]) => ({
              user_id: selectedUser.auth_user_id,
              permission_key,
              allowed,
            }),
          );

          if (overrideEntries.length > 0 && !isOwnerRole) {
            await supabase.from("user_permission_overrides").insert(overrideEntries);
          }
        }

        setIsDrawerOpen(false);
        await loadData(selectedUser.id);
      }
    }

    setIsSaving(false);
  }

  async function deactivateUser(user: AppUserRecord) {
    await supabase.from("app_users").update({ active: false }).eq("id", user.id);
    await loadData(user.id);
  }

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Users" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar
          title="Users"
          titleAdornment={
            <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 text-sm font-medium text-stone-600">
              {users.length}
            </span>
          }
          actionLabel="Add user"
          actionOnClick={openCreateDrawer}
        />

        <div className="flex flex-1 gap-6 p-8">
          <div className="min-w-0 flex-1 rounded-2xl border border-stone-200 bg-white shadow-sm">
            {isLoading ? (
              <div className="flex min-h-[240px] items-center justify-center text-sm text-stone-500">
                Loading users...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-stone-200">
                  <thead className="bg-stone-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                      <th className="px-4 py-4">Name</th>
                      <th className="px-4 py-4">Email</th>
                      <th className="px-4 py-4">Role</th>
                      <th className="px-4 py-4">Location</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-4 py-4">Last login</th>
                      <th className="px-4 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className={`transition ${
                          selectedUser?.id === user.id ? "bg-primary/5" : "hover:bg-stone-50"
                        }`}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold text-stone-600">
                              {getInitials(getFullName(user))}
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedUserId(user.id)}
                              className="font-medium text-stone-950"
                            >
                              {getFullName(user)}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-stone-600">{user.email}</td>
                        <td className="px-4 py-4">
                          <span
                            className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium text-white"
                            style={{ backgroundColor: user.roles?.color ?? "#FF4900" }}
                          >
                            {user.roles?.name ?? "Unassigned"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <Badge
                            label={user.location ?? "—"}
                            tone={getLocationTone(user.location)}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <Badge
                            label={user.active === false ? "Inactive" : "Active"}
                            tone={user.active === false ? "offline" : "active"}
                          />
                        </td>
                        <td className="px-4 py-4 text-sm text-stone-500">
                          {formatLastLogin(user.last_login_at)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex gap-3 text-sm">
                            <button
                              type="button"
                              onClick={() => openEditDrawer(user)}
                              className="text-primary transition hover:opacity-80"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void deactivateUser(user)}
                              className="text-stone-500 transition hover:text-stone-700"
                            >
                              Deactivate
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <aside className="hidden w-[380px] shrink-0 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm xl:block">
            {selectedUser ? (
              <>
                <div className="border-b border-stone-200 pb-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold text-stone-600">
                      {getInitials(getFullName(selectedUser))}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight text-stone-950">
                        {getFullName(selectedUser)}
                      </h2>
                      <p className="mt-1 text-sm text-stone-500">{selectedUser.email}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 space-y-3 text-sm text-stone-600">
                  <p>Role: {selectedUser.roles?.name ?? "Unassigned"}</p>
                  <p>Location: {selectedUser.location ?? "—"}</p>
                  <p>Status: {selectedUser.active === false ? "Inactive" : "Active"}</p>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-stone-400">
                Select a user to view details.
              </div>
            )}
          </aside>
        </div>
      </section>

      <aside
        className={`fixed inset-y-0 right-0 z-30 w-full max-w-2xl border-l border-stone-200 bg-stone-100 shadow-2xl transition-transform duration-300 ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-stone-200 bg-white px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
                  Admin
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">
                  {drawerMode === "create" ? "Add user" : "Edit user"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-500"
              >
                Close
              </button>
            </div>
            {message ? <p className="mt-3 text-sm text-emerald-600">{message}</p> : null}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <section className="rounded-2xl border border-stone-200 bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                Personal Info
              </h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input
                  type="text"
                  value={form.first_name}
                  onChange={(event) => updateForm("first_name", event.target.value)}
                  placeholder="First name"
                  className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
                <input
                  type="text"
                  value={form.last_name}
                  onChange={(event) => updateForm("last_name", event.target.value)}
                  placeholder="Last name"
                  className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm("email", event.target.value)}
                  placeholder="Email"
                  className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 md:col-span-2"
                />
                <input
                  type="text"
                  value={form.phone}
                  onChange={(event) => updateForm("phone", event.target.value)}
                  placeholder="Phone"
                  className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
                <select
                  value={form.location}
                  onChange={(event) =>
                    updateForm("location", event.target.value as UserFormState["location"])
                  }
                  className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                >
                  <option value="">Location</option>
                  <option value="Ellsworth">Ellsworth</option>
                  <option value="Lindsay">Lindsay</option>
                  <option value="Both">Both</option>
                </select>
              </div>
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                Role & Access
              </h3>
              <div className="mt-4">
                <select
                  value={form.role_id}
                  onChange={(event) => updateForm("role_id", event.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                >
                  <option value="">Select role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name} {role.description ? `— ${role.description}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 space-y-4">
                {permissionGroups.map((group) => (
                  <div key={group.category}>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                      {group.category}
                    </p>
                    <div className="mt-2 space-y-2">
                      {group.permissions.map((permission) => (
                        <div
                          key={permission.key}
                          className="flex items-center justify-between rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-medium text-stone-950">
                              {permission.label}
                            </p>
                            <p className="mt-1 text-sm text-stone-500">
                              {permission.description}
                            </p>
                          </div>
                          <span
                            className={`inline-flex h-6 w-11 items-center rounded-full px-1 ${
                              getEffectivePermission(permission.key)
                                ? "bg-primary"
                                : "bg-stone-300"
                            }`}
                          >
                            <span
                              className={`h-4 w-4 rounded-full bg-white transition ${
                                getEffectivePermission(permission.key)
                                  ? "translate-x-5"
                                  : "translate-x-0"
                              }`}
                            />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Permission Overrides
                </h3>
                <button
                  type="button"
                  onClick={resetToRoleDefaults}
                  className="text-sm font-medium text-primary transition hover:opacity-80"
                >
                  Reset to role defaults
                </button>
              </div>

              {isOwnerRole ? (
                <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4 text-sm text-stone-700">
                  Owner role has access to everything — no overrides needed
                </div>
              ) : null}

              <div className={`mt-4 space-y-5 ${isOwnerRole ? "opacity-50" : ""}`}>
                {permissionGroups.map((group) => (
                  <div key={group.category}>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                      {group.category}
                    </p>
                    <div className="mt-2 space-y-2">
                      {group.permissions.map((permission) => {
                        const roleDefault = selectedRoleDefaults[permission.key] ?? false;
                        const isCustom = permission.key in overrideMap;
                        const effective = getEffectivePermission(permission.key);

                        return (
                          <div
                            key={permission.key}
                            className="flex items-center justify-between rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-stone-950">
                                  {permission.label}
                                </p>
                                {isCustom ? (
                                  <span className="rounded-full bg-[#1A6BC4]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1A6BC4]">
                                    custom
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-sm text-stone-500">
                                {permission.description}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => togglePermission(permission.key)}
                              disabled={isOwnerRole}
                              className={`inline-flex h-6 w-11 items-center rounded-full px-1 ${
                                isCustom
                                  ? effective
                                    ? "bg-[#1A6BC4]"
                                    : "bg-[#1A6BC4]/30"
                                  : roleDefault
                                    ? "bg-primary"
                                    : "bg-stone-300"
                              }`}
                            >
                              <span
                                className={`h-4 w-4 rounded-full bg-white transition ${
                                  effective ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="border-t border-stone-200 bg-white px-6 py-5">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}
