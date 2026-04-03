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

function NavLink({
  item,
  current,
}: {
  item: NavItem;
  current: string;
}) {
  const isActive = item.label === current;

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

export function Sidebar({ current }: SidebarProps) {
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadPermissions() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !isMounted) {
        if (isMounted) {
          setIsLoadingPermissions(false);
        }
        return;
      }

      const permissions = await getUserPermissions(user.id);

      if (!isMounted) {
        return;
      }

      setUserPermissions(permissions);
      setIsLoadingPermissions(false);
    }

    void loadPermissions();

    return () => {
      isMounted = false;
    };
  }, []);

  const mainItems = useMemo(() => {
    const items: NavItem[] = [{ label: "Dashboard", href: "/dashboard" }];

    if (
      hasPermission(userPermissions, "customers.view_all") ||
      hasPermission(userPermissions, "customers.view_own")
    ) {
      items.push({ label: "Customers", href: "/customers" });
    }

    if (
      hasPermission(userPermissions, "quotes.view_own") ||
      hasPermission(userPermissions, "quotes.view_all")
    ) {
      items.push({ label: "Quotes", href: "/quotes" });
    }

    if (hasPermission(userPermissions, "orders.view_all")) {
      items.push({ label: "Orders", href: "/orders" });
    }

    if (
      hasPermission(userPermissions, "dispatch.view") ||
      hasPermission(userPermissions, "dispatch.manage")
    ) {
      items.push({ label: "Dispatch", href: "/dispatch" });
    }

    if (hasPermission(userPermissions, "calendar.view")) {
      items.push({ label: "Calendar", href: "/calendar" });
    }

    if (
      hasPermission(userPermissions, "reports.sales") ||
      hasPermission(userPermissions, "reports.marketing") ||
      hasPermission(userPermissions, "reports.financial") ||
      hasPermission(userPermissions, "reports.install")
    ) {
      items.push({ label: "Reports", href: "/reports" });
    }

    return items;
  }, [userPermissions]);

  const adminItems = useMemo(() => {
    const items: NavItem[] = [];

    if (hasPermission(userPermissions, "admin.settings")) {
      items.push({ label: "Settings", href: "/settings" });
    }
    if (hasPermission(userPermissions, "admin.users")) {
      items.push({ label: "Users", href: "/admin/users" });
    }
    if (hasPermission(userPermissions, "admin.roles")) {
      items.push({ label: "Roles", href: "/admin/roles" });
    }
    if (hasPermission(userPermissions, "admin.catalog")) {
      items.push({ label: "Product catalog", href: "/admin/catalog" });
    }
    if (hasPermission(userPermissions, "admin.marketing_spend")) {
      items.push({ label: "Marketing spend", href: "/admin/marketing-spend" });
    }
    if (hasPermission(userPermissions, "admin.settings")) {
      items.push({ label: "Pricing settings", href: "/admin/pricing-settings" });
      items.push({ label: "Tax settings", href: "/admin/tax-settings" });
    }

    return items;
  }, [userPermissions]);

  const teamItems = useMemo(() => {
    if (
      hasPermission(userPermissions, "kpi.view_team") ||
      hasPermission(userPermissions, "kpi.view_all")
    ) {
      return [
        { label: "Team KPIs", href: "/team/kpis" },
        { label: "Team schedule", href: "/team/schedule" },
      ] satisfies NavItem[];
    }

    return [] satisfies NavItem[];
  }, [userPermissions]);

  const showAdminSection = adminItems.length > 0;
  const showTeamSection = teamItems.length > 0;

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
        {isLoadingPermissions ? (
          <div className="space-y-3 px-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-9 animate-pulse rounded-xl bg-white/10" />
            ))}
          </div>
        ) : (
          <>
            {mainItems.map((item) => (
              <NavLink key={item.label} item={item} current={current} />
            ))}

            {showTeamSection ? (
              <div className="pt-6">
                <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                  My Team
                </p>
                <div className="flex flex-col gap-1">
                  {teamItems.map((item) => (
                    <NavLink key={item.label} item={item} current={current} />
                  ))}
                </div>
              </div>
            ) : null}

            {showAdminSection ? (
              <div className="mt-auto pt-6">
                <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                  Admin
                </p>
                <div className="flex flex-col gap-1">
                  {adminItems.map((item) => (
                    <NavLink key={item.label} item={item} current={current} />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </nav>
    </aside>
  );
}
