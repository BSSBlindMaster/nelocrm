import { Badge } from "@/components/Badge";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

const metrics = [
  { label: "Quotes This Month", value: "38", change: "+12% vs last month" },
  { label: "Revenue MTD", value: "$84,200", change: "+8.4% vs target" },
  { label: "Jobs Today", value: "14", change: "3 in progress right now" },
  { label: "Open Quotes", value: "21", change: "7 awaiting follow-up" },
];

const todaysJobs = [
  {
    title: "Atlas Renovation Group",
    time: "8:30 AM",
    detail: "Kitchen walkthrough with installer team",
    status: "active" as const,
  },
  {
    title: "Northfield Estates",
    time: "11:00 AM",
    detail: "Final quote review and scope confirmation",
    status: "active" as const,
  },
  {
    title: "Brook & Beam Studio",
    time: "2:15 PM",
    detail: "Site visit for custom cabinetry measurement",
    status: "offline" as const,
  },
];

const teamStatus = [
  { name: "Ava Chen", role: "Sales", status: "On calls", tone: "active" as const },
  { name: "Marcus Bell", role: "Ops", status: "At warehouse", tone: "active" as const },
  { name: "Isla Morgan", role: "Design", status: "Reviewing plans", tone: "active" as const },
  { name: "Noah Patel", role: "Dispatch", status: "Offline", tone: "offline" as const },
];

export default function DashboardPage() {
  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Dashboard" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar title="Dashboard" actionLabel="New quote" />

        <div className="flex-1 space-y-8 p-8">
          <div className="grid gap-5 xl:grid-cols-4">
            {metrics.map((metric) => (
              <article
                key={metric.label}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm text-stone-500">{metric.label}</p>
                <p className="mt-4 text-3xl font-semibold tracking-tight text-stone-950">
                  {metric.value}
                </p>
                <p className="mt-3 text-sm text-stone-400">{metric.change}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <article className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight text-stone-950">
                  Today&apos;s Jobs
                </h2>
                <span className="text-sm text-stone-400">Updated 9 minutes ago</span>
              </div>

              <div className="mt-6 space-y-4">
                {todaysJobs.map((job) => (
                  <div
                    key={job.title}
                    className="flex items-start justify-between rounded-2xl border border-stone-100 bg-stone-50 px-4 py-4"
                  >
                    <div>
                      <p className="font-medium text-stone-950">{job.title}</p>
                      <p className="mt-1 text-sm text-stone-500">{job.detail}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-stone-400">{job.time}</span>
                      <Badge
                        label={job.status === "active" ? "Scheduled" : "Pending"}
                        tone={job.status}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight text-stone-950">
                  Team Status
                </h2>
                <span className="text-sm text-stone-400">4 online</span>
              </div>

              <div className="mt-6 space-y-4">
                {teamStatus.map((member) => (
                  <div
                    key={member.name}
                    className="flex items-center justify-between rounded-2xl border border-stone-100 bg-stone-50 px-4 py-4"
                  >
                    <div>
                      <p className="font-medium text-stone-950">{member.name}</p>
                      <p className="mt-1 text-sm text-stone-500">{member.role}</p>
                    </div>
                    <Badge label={member.status} tone={member.tone} />
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
