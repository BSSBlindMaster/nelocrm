"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getUserPermissions, hasPermission } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

type SidebarProps = {
  current: string;
};

type NavItem = {
  label: string;
  href: string;
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
      className={`border-l-2 px-3 py-2.5 text-sm transition ${
        isActive
          ? "border-[#FF4900] bg-[rgba(255,73,0,0.12)] font-medium text-white"
          : "border-transparent text-[rgba(255,255,255,0.55)] hover:bg-white/5 hover:text-white"
      }`}
    >
      {item.label}
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
      items.push({ label: "Projects", href: "/projects" });
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
      items.push({ label: "Calendar", href: "/calendar" });
    }

    if (
      hasAnyPermission(effectivePermissions, [
        "dispatch.view",
        "dispatch.manage",
      ])
    ) {
      items.push({ label: "Dispatch", href: "/dispatch" });
    }

    return items;
  }, [effectivePermissions]);

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
      items.push({ label: "KPIs", href: "/team/kpis" });
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
    <aside className="flex h-screen w-[240px] min-w-[240px] shrink-0 flex-col bg-[#1C1C1C] px-5 py-6 text-white">
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

      <nav className="mt-10 flex flex-1 flex-col gap-1">
        <div className={isLoadingPermissions ? "animate-pulse" : ""}>
          {showWorkSection ? <Section title="Work" items={workItems} current={current} /> : null}

          {showMarketingSection ? (
            <Section title="Marketing" items={marketingItems} current={current} />
          ) : null}

          {showReportsSection ? (
            <Section title="Reports" items={reportItems} current={current} />
          ) : null}

          {showAdminSection ? (
            <div className="mt-auto pt-6">
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
    </aside>
  );
}
