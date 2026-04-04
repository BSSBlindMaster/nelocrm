"use client";

import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

export default function ReportsPage() {
  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Reports" />
      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar title="Reports" />
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-sm text-stone-400">Reports coming soon</p>
        </div>
      </section>
    </main>
  );
}
