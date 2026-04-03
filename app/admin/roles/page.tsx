"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import {
  groupPermissionsByCategory,
  permissionCategories,
} from "@/lib/admin-permissions";
import { supabase } from "@/lib/supabase";

type RoleRecord = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_preset: boolean | null;
};

type RolePermissionRecord = {
  role_id: string;
  permission_key: string;
  allowed: boolean;
};

type AppUserRoleRecord = {
  id: string;
  role_id: string | null;
};

type RoleFormState = {
  name: string;
  description: string;
  color: string;
};

const colorOptions = [
  "#FF4900",
  "#1A6BC4",
  "#1C1C1C",
  "#2F855A",
  "#C05621",
  "#B83280",
  "#2D3748",
  "#805AD5",
];

const emptyForm: RoleFormState = {
  name: "",
  description: "",
  color: "#FF4900",
};

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionRecord[]>([]);
  const [users, setUsers] = useState<AppUserRoleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [form, setForm] = useState<RoleFormState>(emptyForm);
  const [permissionMap, setPermissionMap] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const permissionGroups = groupPermissionsByCategory();

  async function loadData(selectRoleId?: string | null) {
    setIsLoading(true);

    const [rolesResponse, rolePermissionsResponse, usersResponse] = await Promise.all([
      supabase.from("roles").select("id, name, description, color, is_preset").order("name"),
      supabase
        .from("role_permissions")
        .select("role_id, permission_key, allowed"),
      supabase.from("app_users").select("id, role_id"),
    ]);

    setRoles((rolesResponse.data as RoleRecord[] | null) ?? []);
    setRolePermissions((rolePermissionsResponse.data as RolePermissionRecord[] | null) ?? []);
    setUsers((usersResponse.data as AppUserRoleRecord[] | null) ?? []);
    setSelectedRoleId(selectRoleId ?? ((rolesResponse.data as RoleRecord[] | null)?.[0]?.id ?? null));
    setIsLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const roleCounts = useMemo(() => {
    return users.reduce<Record<string, number>>((accumulator, user) => {
      if (!user.role_id) {
        return accumulator;
      }

      accumulator[user.role_id] = (accumulator[user.role_id] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [users]);

  const selectedRole =
    roles.find((role) => role.id === selectedRoleId) ?? roles[0] ?? null;

  function openCreateDrawer() {
    const allFalse = permissionGroups.flatMap((group) => group.permissions).reduce(
      (accumulator, permission) => {
        accumulator[permission.key] = false;
        return accumulator;
      },
      {} as Record<string, boolean>,
    );

    setDrawerMode("create");
    setForm(emptyForm);
    setPermissionMap(allFalse);
    setIsDrawerOpen(true);
    setMessage("");
  }

  function openEditDrawer(role: RoleRecord) {
    const nextPermissions = permissionGroups.flatMap((group) => group.permissions).reduce(
      (accumulator, permission) => {
        accumulator[permission.key] =
          rolePermissions.find(
            (rolePermission) =>
              rolePermission.role_id === role.id &&
              rolePermission.permission_key === permission.key,
          )?.allowed ?? false;
        return accumulator;
      },
      {} as Record<string, boolean>,
    );

    setDrawerMode("edit");
    setSelectedRoleId(role.id);
    setForm({
      name: role.name,
      description: role.description ?? "",
      color: role.color ?? "#FF4900",
    });
    setPermissionMap(nextPermissions);
    setIsDrawerOpen(true);
    setMessage("");
  }

  function togglePermission(key: string) {
    setPermissionMap((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function setGroupPermissions(category: string, allowed: boolean) {
    setPermissionMap((current) => {
      const next = { ...current };
      permissionGroups
        .find((group) => group.category === category)
        ?.permissions.forEach((permission) => {
          next[permission.key] = allowed;
        });
      return next;
    });
  }

  async function handleSave() {
    if (!form.name.trim()) {
      return;
    }

    setIsSaving(true);
    let roleId = selectedRoleId;

    if (drawerMode === "create") {
      const { data, error } = await supabase
        .from("roles")
        .insert({
          name: form.name,
          description: form.description || null,
          color: form.color,
          is_preset: false,
        })
        .select("id")
        .single();

      if (error || !data) {
        setMessage("Unable to create role.");
        setIsSaving(false);
        return;
      }

      roleId = data.id;
    } else if (selectedRoleId) {
      await supabase
        .from("roles")
        .update({
          name: form.name,
          description: form.description || null,
          color: form.color,
        })
        .eq("id", selectedRoleId);

      await supabase.from("role_permissions").delete().eq("role_id", selectedRoleId);
      roleId = selectedRoleId;
    }

    const permissionRows = Object.entries(permissionMap).map(([permission_key, allowed]) => ({
      role_id: roleId,
      permission_key,
      allowed,
    }));

    if (permissionRows.length > 0) {
      await supabase.from("role_permissions").insert(permissionRows);
    }

    setIsDrawerOpen(false);
    await loadData(roleId ?? null);
    setIsSaving(false);
  }

  async function handleDelete(role: RoleRecord) {
    if (role.is_preset) {
      setMessage("Preset roles cannot be deleted. You can edit their permissions.");
      return;
    }

    if ((roleCounts[role.id] ?? 0) > 0) {
      setMessage("This role still has assigned users and cannot be deleted.");
      return;
    }

    await supabase.from("role_permissions").delete().eq("role_id", role.id);
    await supabase.from("roles").delete().eq("id", role.id);
    await loadData();
  }

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Roles" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar title="Roles & permissions" actionLabel="Add role" actionOnClick={openCreateDrawer} />

        <div className="p-8">
          {message ? <p className="mb-4 text-sm text-stone-600">{message}</p> : null}
          {isLoading ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500 shadow-sm">
              Loading roles...
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {roles.map((role) => (
                <article
                  key={role.id}
                  className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex h-4 w-4 rounded-full"
                        style={{ backgroundColor: role.color ?? "#FF4900" }}
                      />
                      <div>
                        <h2 className="text-lg font-semibold tracking-tight text-stone-950">
                          {role.name}
                        </h2>
                        <p className="mt-1 text-sm text-stone-500">
                          {role.description || "No description yet."}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditDrawer(role)}
                      className="text-stone-500 transition hover:text-stone-700"
                      aria-label={`Edit ${role.name}`}
                    >
                      ✎
                    </button>
                  </div>

                  <div className="mt-5 flex items-center gap-3 text-sm">
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600">
                      {roleCounts[role.id] ?? 0} users
                    </span>
                    {role.is_preset ? (
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">
                        Preset
                      </span>
                    ) : null}
                  </div>

                  {role.name === "Owner" ? (
                    <p className="mt-3 text-sm text-stone-500">
                      Full access — all permissions enabled automatically
                    </p>
                  ) : null}

                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      onClick={() => openEditDrawer(role)}
                      className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-95"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(role)}
                      className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-300"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
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
                  {drawerMode === "create" ? "Add role" : "Edit role"}
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
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <section className="rounded-2xl border border-stone-200 bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                Role Details
              </h3>
              <div className="mt-4 space-y-4">
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Role name"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Description"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
                <div className="flex flex-wrap gap-3">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, color }))}
                      className={`h-9 w-9 rounded-full border-2 ${
                        form.color === color ? "border-stone-950" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Choose color ${color}`}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                Permissions
              </h3>
              <div className="mt-4 space-y-5">
                {permissionCategories.map((category) => {
                  const group = permissionGroups.find((item) => item.category === category);

                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                          {category}
                        </p>
                        <div className="flex gap-3 text-sm">
                          <button
                            type="button"
                            onClick={() => setGroupPermissions(category, true)}
                            className="text-primary transition hover:opacity-80"
                          >
                            Enable all
                          </button>
                          <button
                            type="button"
                            onClick={() => setGroupPermissions(category, false)}
                            className="text-stone-500 transition hover:text-stone-700"
                          >
                            Disable all
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 space-y-2">
                        {group?.permissions.map((permission) => (
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
                            <button
                              type="button"
                              onClick={() => togglePermission(permission.key)}
                              className={`inline-flex h-6 w-11 items-center rounded-full px-1 ${
                                permissionMap[permission.key] ? "bg-primary" : "bg-stone-300"
                              }`}
                            >
                              <span
                                className={`h-4 w-4 rounded-full bg-white transition ${
                                  permissionMap[permission.key] ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="border-t border-stone-200 bg-white px-6 py-5">
            {selectedRole?.is_preset ? (
              <p className="mb-4 text-sm text-stone-500">
                Preset roles cannot be deleted. You can edit their permissions.
              </p>
            ) : null}
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
