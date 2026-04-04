"use client";

import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

export default function OrdersPage() {
  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Orders" />
      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar title="Orders" />
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-sm text-stone-400">Orders coming soon</p>
        </div>
      </section>
    </main>
  );
}
