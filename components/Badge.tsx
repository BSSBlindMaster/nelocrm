type BadgeTone = "customer" | "lead" | "vip" | "active" | "offline";

const toneClasses: Record<BadgeTone, string> = {
  customer: "bg-sky-100 text-sky-700 ring-sky-200",
  lead: "bg-amber-100 text-amber-700 ring-amber-200",
  vip: "bg-rose-100 text-rose-700 ring-rose-200",
  active: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  offline: "bg-stone-200 text-stone-700 ring-stone-300",
};

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

export function Badge({ label, tone = "customer" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}
