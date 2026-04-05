"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getActiveAppUsers, getCurrentAppUser } from "@/lib/current-app-user";
import { getUserPermissions, hasPermission } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

type SidebarProps = {
  current: string;
};

type NavItem = {
  label: string;
  href: string;
  badgeCount?: number;
};

type AppUserLookup = {
  role_id: string | null;
  roles?: {
    name: string | null;
  } | null;
};

const ALL_PERMISSION_KEYS = [
  "customers.view_all",
  "customers.view_own",
  "customers.view",
  "projects.view",
  "projects.manage",
  "quotes.view_all",
  "quotes.view_own",
  "quotes.view",
  "orders.view_all",
  "orders.manage",
  "calendar.view",
  "dispatch.view",
  "dispatch.manage",
  "marketing.view",
  "reports.sales",
  "reports.marketing",
  "reports.financial",
  "reports.install",
  "reporting.view",
  "kpi.view_team",
  "kpi.view_all",
  "admin.users",
  "admin.roles",
  "admin.settings",
  "admin.catalog",
  "admin.marketing_spend",
  "commissions.view_all",
  "commissions.view_own",
];

function hasAnyPermission(userPerms: string[], keys: string[]) {
  return keys.some((key) => hasPermission(userPerms, key));
}

function isCurrent(item: NavItem, current: string) {
  if (item.label === current) {
    return true;
  }

  if (item.label === "Roles & permissions" && current === "Roles") {
    return true;
  }

  return false;
}

function NavLink({
  item,
  current,
}: {
  item: NavItem;
  current: string;
}) {
  const isActive = isCurrent(item, current);

  return (
    <Link
      href={item.href}
      className={`flex items-center justify-between gap-3 border-l-2 px-3 py-2.5 text-sm transition ${
        isActive
          ? "border-[#FF4900] bg-[rgba(255,73,0,0.12)] font-medium !text-white"
          : "border-transparent bg-transparent !text-[rgba(255,255,255,0.55)] hover:bg-white/5 hover:!text-white"
      }`}
    >
      <span>{item.label}</span>
      {item.badgeCount && item.badgeCount > 0 ? (
        <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
          {item.badgeCount}
        </span>
      ) : null}
    </Link>
  );
}

function Section({
  title,
  items,
  current,
}: {
  title: string;
  items: NavItem[];
  current: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="pt-6">
      <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
        {title}
      </p>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <NavLink key={item.label} item={item} current={current} />
        ))}
      </div>
    </div>
  );
}

export function Sidebar({ current }: SidebarProps) {
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const [showAllNav, setShowAllNav] = useState(true);
  const [isOwnerRole, setIsOwnerRole] = useState(false);
  const [overdueProjectsCount, setOverdueProjectsCount] = useState(0);
  const [todayAppointmentsCount, setTodayAppointmentsCount] = useState(0);
  const [unassignedJobsCount, setUnassignedJobsCount] = useState(0);
  const [earnedCommissionsCount, setEarnedCommissionsCount] = useState(0);
  const [currentRoleName, setCurrentRoleName] = useState("");
  const [isAdminOpen, setIsAdminOpen] = useState(
    current === "Settings" ||
      current === "Users" ||
      current === "Roles" ||
      current === "Roles & permissions",
  );

  useEffect(() => {
    let isMounted = true;

    async function loadPermissions() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      const authUserId = session?.user?.id;

      if (!authUserId) {
        setShowAllNav(true);
        setIsLoadingPermissions(false);
        return;
      }

      const { data: appUser } = await supabase
        .from("app_users")
        .select("role_id, roles(name)")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      const resolvedUser = appUser as AppUserLookup | null;

      if (!resolvedUser) {
        setShowAllNav(true);
        setIsLoadingPermissions(false);
        return;
      }

      setCurrentRoleName(resolvedUser.roles?.name ?? "");

      if (resolvedUser.roles?.name === "Owner") {
        setIsOwnerRole(true);
        setShowAllNav(true);
        setIsAdminOpen(true);
        setIsLoadingPermissions(false);
        return;
      }

      const permissions = await getUserPermissions(authUserId);

      if (!isMounted) {
        return;
      }

      setUserPermissions(permissions);
      setShowAllNav(false);
      setIsLoadingPermissions(false);
    }

    void loadPermissions();

    return () => {
      isMounted = false;
    };
  }, [current]);

  useEffect(() => {
    let isMounted = true;

    async function loadOverdueCount() {
      const [currentUser, , projectsResponse] = await Promise.all([
        getCurrentAppUser(),
        getActiveAppUsers(),
        supabase
          .from("projects")
          .select(`
            id,
            location,
            project_tasks (
              id,
              due_date,
              status,
              assigned_to
            )
          `),
      ]);

      if (!isMounted) {
        return;
      }

      const overdueCount = (((projectsResponse.data as Array<Record<string, unknown>> | null) ?? []).flatMap(
        (project) => {
          const tasks = Array.isArray(project.project_tasks)
            ? (project.project_tasks as Array<Record<string, unknown>>)
            : [];

          return tasks.filter((task) => {
            const dueDate = String(task.due_date ?? "");
            const status = String(task.status ?? "pending").toLowerCase();
            const isComplete = ["complete", "completed", "done"].includes(status);
            if (isComplete || !dueDate || new Date(dueDate).getTime() >= Date.now()) {
              return false;
            }

            if (!currentUser || currentUser.roleName === "Owner" || currentUser.roleName === "Office Manager") {
              return true;
            }

            const assignedTo = typeof task.assigned_to === "string" ? task.assigned_to : "";
            return assignedTo === currentUser.id || assignedTo === currentUser.authUserId;
          });
        },
      )).length;

      setOverdueProjectsCount(overdueCount);
    }

    void loadOverdueCount();
    const intervalId = window.setInterval(() => {
      void loadOverdueCount();
    }, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadTodayAppointments() {
      const currentUser = await getCurrentAppUser();
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

      const { data } = await supabase
        .from("appointments")
        .select("id, assigned_to, scheduled_at")
        .gte("scheduled_at", startOfDay)
        .lte("scheduled_at", endOfDay);

      if (!isMounted) {
        return;
      }

      const rows = (data as Array<{ assigned_to?: string | null }> | null) ?? [];
      const count = currentUser
        ? rows.filter((appointment) => appointment.assigned_to === currentUser.id).length
        : rows.length;
      setTodayAppointmentsCount(count);
    }

    void loadTodayAppointments();
    const intervalId = window.setInterval(() => {
      void loadTodayAppointments();
    }, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadUnassignedJobs() {
      const today = new Date().toISOString().slice(0, 10);
      const { count } = await supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .is("assigned_to", null)
        .gte("scheduled_at", `${today}T00:00:00`)
        .lte("scheduled_at", `${today}T23:59:59`);

      if (!isMounted) return;
      setUnassignedJobsCount(count ?? 0);
    }

    void loadUnassignedJobs();
    const intervalId = window.setInterval(() => {
      void loadUnassignedJobs();
    }, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadEarnedCommissions() {
      const { count } = await supabase
        .from("commissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "earned");

      if (!isMounted) return;
      setEarnedCommissionsCount(count ?? 0);
    }

    void loadEarnedCommissions();
    const intervalId = window.setInterval(() => {
      void loadEarnedCommissions();
    }, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const effectivePermissions = useMemo(() => {
    if (showAllNav || isOwnerRole) {
      return ALL_PERMISSION_KEYS;
    }

    return userPermissions;
  }, [isOwnerRole, showAllNav, userPermissions]);

  const workItems = useMemo(() => {
    const items: NavItem[] = [{ label: "Dashboard", href: "/dashboard" }];

    if (
      hasAnyPermission(effectivePermissions, [
        "customers.view_all",
        "customers.view_own",
        "customers.view",
      ])
    ) {
      items.push({ label: "Customers", href: "/customers" });
    }

    if (
      hasAnyPermission(effectivePermissions, [
        "projects.view",
        "projects.manage",
        "quotes.view_all",
        "quotes.view_own",
        "quotes.view",
        "orders.view_all",
        "orders.manage",
      ])
    ) {
      items.push({ label: "Projects", href: "/projects", badgeCount: overdueProjectsCount });
    }

    if (
      hasAnyPermission(effectivePermissions, [
        "quotes.view_all",
        "quotes.view_own",
        "quotes.view",
      ])
    ) {
      items.push({ label: "Quotes", href: "/quotes" });
    }

    if (
      hasAnyPermission(effectivePermissions, [
        "orders.view_all",
        "orders.manage",
      ])
    ) {
      items.push({ label: "Orders", href: "/orders" });
    }

    if (hasPermission(effectivePermissions, "calendar.view")) {
      items.push({ label: "Calendar", href: "/calendar", badgeCount: todayAppointmentsCount });

      // Calendar sub-items based on role
      if (currentRoleName === "Sales Rep") {
        items.push({ label: "My availability", href: "/calendar/availability" });
      }
      if (["Owner", "Office Manager", "Appointment Setter", "Sales Manager"].includes(currentRoleName)) {
        items.push({ label: "Book appointment", href: "/calendar/booking" });
      }
    }

    if (
      hasAnyPermission(effectivePermissions, [
        "dispatch.view",
        "dispatch.manage",
      ])
    ) {
      const showDispatchBadge = isOwnerRole || effectivePermissions.includes("dispatch.manage");
      items.push({
        label: "Dispatch",
        href: "/dispatch",
        badgeCount: showDispatchBadge ? unassignedJobsCount : undefined,
      });
    }

    // Commissions — Owner and Sales Manager see management view with badge;
    // Sales Reps see their own view without badge
    if (
      hasAnyPermission(effectivePermissions, [
        "commissions.view_all",
        "commissions.view_own",
      ])
    ) {
      const isManagerOrOwner = isOwnerRole || currentRoleName === "Sales Manager";
      items.push({
        label: "Commissions",
        href: isManagerOrOwner ? "/commissions" : "/commissions/my",
        badgeCount: isManagerOrOwner ? earnedCommissionsCount : undefined,
      });
    }

    return items;
  }, [effectivePermissions, todayAppointmentsCount, unassignedJobsCount, isOwnerRole, earnedCommissionsCount, currentRoleName]);

  const marketingItems = useMemo(() => {
    if (
      hasAnyPermission(effectivePermissions, [
        "marketing.view",
        "reports.marketing",
        "admin.marketing_spend",
      ])
    ) {
      return [{ label: "Marketing", href: "/marketing" }] satisfies NavItem[];
    }

    return [] satisfies NavItem[];
  }, [effectivePermissions]);

  const reportItems = useMemo(() => {
    const items: NavItem[] = [];

    if (
      hasAnyPermission(effectivePermissions, [
        "reports.sales",
        "reports.marketing",
        "reports.financial",
        "reports.install",
        "reporting.view",
      ])
    ) {
      items.push({ label: "Reports", href: "/reports" });
    }

    if (
      hasAnyPermission(effectivePermissions, [
        "kpi.view_team",
        "kpi.view_all",
      ])
    ) {
      items.push({ label: "KPIs", href: "/kpis" });
    }

    return items;
  }, [effectivePermissions]);

  const adminItems = useMemo(() => {
    const items: NavItem[] = [];

    if (hasPermission(effectivePermissions, "admin.settings")) {
      items.push({ label: "Settings", href: "/admin/settings" });
    }

    return items;
  }, [effectivePermissions]);

  const showWorkSection = workItems.length > 0;
  const showMarketingSection = marketingItems.length > 0;
  const showReportsSection = reportItems.length > 0;
  const showAdminSection = isOwnerRole || adminItems.length > 0;
  const adminSectionExpanded = isOwnerRole || isAdminOpen;

  return (
    <aside className="flex h-screen w-[240px] min-w-[240px] shrink-0 flex-col bg-[#1C1C1C] text-white">
      {/* Logo — fixed at top */}
      <div className="shrink-0 px-5 pt-6">
        <Link href="/dashboard" className="flex items-center gap-2 p-4">
          <span className="inline-flex h-[18px] w-6 items-center justify-center text-[#FF4900]">
            <svg
              viewBox="0 0 24 24"
              className="h-[18px] w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M9.5 14.5 14.5 9.5" strokeLinecap="round" strokeLinejoin="round" />
              <path
                d="M7.25 16.75a3 3 0 0 1 0-4.25l2-2a3 3 0 0 1 4.25 0"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M16.75 7.25a3 3 0 0 1 0 4.25l-2 2a3 3 0 0 1-4.25 0"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-[18px] font-light tracking-[-0.5px] text-white">nelo</span>
        </Link>
      </div>

      {/* Nav — scrollable middle */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-5 pb-[60px]" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}>
        <div className={`mt-6 ${isLoadingPermissions ? "animate-pulse" : ""}`}>
          {showWorkSection ? <Section title="Work" items={workItems} current={current} /> : null}

          {showMarketingSection ? (
            <Section title="Marketing" items={marketingItems} current={current} />
          ) : null}

          {showReportsSection ? (
            <Section title="Reports" items={reportItems} current={current} />
          ) : null}

          {showAdminSection ? (
            <div className="pt-6">
              <button
                type="button"
                onClick={() => {
                  if (!isOwnerRole) {
                    setIsAdminOpen((open) => !open);
                  }
                }}
                className="flex w-full items-center justify-between px-3 pb-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-white/35"
              >
                <span>Admin</span>
                <span className={`text-sm transition ${adminSectionExpanded ? "rotate-90" : ""}`}>
                  ›
                </span>
              </button>
              {adminSectionExpanded ? (
                <div className="flex flex-col gap-1">
                  {adminItems.map((item) => (
                    <NavLink key={item.label} item={item} current={current} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </nav>

      {/* Bottom — pinned */}
      <div className="shrink-0 border-t border-white/10 px-5 py-4">
        <p className="text-center text-[10px] tracking-wide text-white/25">Powered by Nelo</p>
      </div>
    </aside>
  );
}
