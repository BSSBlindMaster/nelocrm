"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getUserPermissions, hasPermission } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Customers", href: "/customers" },
  { label: "Quotes", href: "/quotes" },
  { label: "Orders", href: "/orders" },
  { label: "Dispatch", href: "/dispatch" },
  { label: "Calendar", href: "/calendar" },
  { label: "Reports", href: "/reports" },
  { label: "Settings", href: "/settings" },
];

const adminItems = [
  { label: "Users", href: "/admin/users", permission: "admin.users" },
  { label: "Roles", href: "/admin/roles", permission: "admin.roles" },
];

type SidebarProps = {
  current: string;
};

export function Sidebar({ current }: SidebarProps) {
  const [userPermissions, setUserPermissions] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadPermissions() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !isMounted) {
        return;
      }

      const permissions = await getUserPermissions(user.id);

      if (!isMounted) {
        return;
      }

      setUserPermissions(permissions);
    }

    void loadPermissions();

    return () => {
      isMounted = false;
    };
  }, []);

  const visibleAdminItems = adminItems.filter((item) =>
    hasPermission(userPermissions, item.permission),
  );

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
            <path
              d="M9.5 14.5 14.5 9.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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
        {navItems.map((item) => {
          const isActive = item.label === current;

          return (
            <Link
              key={item.label}
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
        })}

        {visibleAdminItems.length > 0 ? (
          <div className="mt-auto pt-6">
            <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
              Admin
            </p>
            <div className="flex flex-col gap-1">
              {visibleAdminItems.map((item) => {
                const isActive = item.label === current;

                return (
                  <Link
                    key={item.label}
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
              })}
            </div>
          </div>
        ) : null}
      </nav>
    </aside>
  );
}
