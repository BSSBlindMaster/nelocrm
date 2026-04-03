import Link from "next/link";

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

type SidebarProps = {
  current: string;
};

export function Sidebar({ current }: SidebarProps) {
  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar px-5 py-6 text-white">
      <Link href="/dashboard" className="px-2 text-3xl font-light tracking-tight">
        nelo
      </Link>

      <nav className="mt-10 flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const isActive = item.label === current;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`rounded-xl px-3 py-2.5 text-sm transition ${
                isActive
                  ? "bg-white/10 font-medium text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
