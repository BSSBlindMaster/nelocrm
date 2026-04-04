import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

const cards = [
  {
    title: "Campaign performance",
    description: "Track lead volume, cost per lead, and booked revenue by channel.",
  },
  {
    title: "Source attribution",
    description: "See which marketing sources are driving quotes, orders, and repeat business.",
  },
  {
    title: "Reactivation",
    description: "Coordinate follow-up campaigns for past customers and dormant leads.",
  },
];

export default function MarketingPage() {
  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Marketing" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar title="Marketing" />

        <div className="flex-1 p-8">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <article
                key={card.title}
                className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm"
              >
                <h2 className="text-lg font-semibold tracking-tight text-stone-950">
                  {card.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-stone-500">{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
