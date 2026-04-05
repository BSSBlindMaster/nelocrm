"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/Badge";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { getCurrentAppUser, type CurrentAppUser } from "@/lib/current-app-user";
import {
  formatKpiValue,
  getAverageSale,
  getCloseRatio,
  getKpiTrend,
  getKpiValue,
  getLeadSourcesBreakdown,
  getLeadsMetrics,
  getNSLI,
  getPinnedKpis,
  getRevenue,
  getRevenueVsGoal,
  getTeamKPIs,
  kpiDefinitions,
  type KpiDefinition,
} from "@/lib/kpis";
import { supabase } from "@/lib/supabase";

type DashboardMode =
  | "owner"
  | "sales_manager"
  | "sales_rep"
  | "installer"
  | "marketing_manager";

type DateRangeOption =
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "this_year"
  | "last_year"
  | "custom";

type WidgetSize = "small" | "medium" | "large";

type WidgetKey =
  | "revenue_goal_progress"
  | "revenue_mtd"
  | "close_ratio"
  | "average_sale"
  | "nsli"
  | "todays_appointments"
  | "team_performance"
  | "sales_by_week"
  | "lead_sources";

type WidgetLayout = {
  id?: string;
  kpi_key: string;
  widgetKey: WidgetKey;
  size: WidgetSize;
  col_span: number;
  position: number;
};

type PinnedCard = {
  id: string;
  key: string;
  definition: KpiDefinition;
  value: number;
  trend: number;
};

type AppointmentSummary = {
  id: string;
  slot: string;
  customerName: string;
  repName: string;
  status: string;
};

type TeamPerformanceRow = {
  id: string;
  name: string;
  initials: string;
  closeRatio: number;
  averageSale: number;
  nsli: number;
  totalSold: number;
  location: string;
};

type DashboardData = {
  revenueGoal: { actual: number; target: number; percentage: number; hasGoal: boolean };
  revenueMtd: number;
  revenueTrend: number;
  closeRatio: { ratio: number; sold: number; total: number };
  averageSale: { average: number; count: number; total: number };
  averageSaleTrend: number;
  nsli: { nsli: number; totalSold: number; leadsIssued: number };
  nsliTrend: number;
  todaysAppointments: AppointmentSummary[];
  teamPerformance: TeamPerformanceRow[];
  salesByWeek: Array<{ label: string; value: number }>;
  leadSources: Array<{ source: string; leads: number; revenue: number }>;
  marketing: {
    leads: number;
    bookingRate: number;
    demoRate: number;
    leadToClose: number;
  };
  comparisons: {
    revenueMtd: number;
    closeRatio: number;
    averageSale: number;
    nsli: number;
  };
};

const OWNER_DEFAULT_WIDGETS: Array<{ key: WidgetKey; size: WidgetSize; position: number }> = [
  { key: "revenue_goal_progress", size: "large", position: 0 },
  { key: "revenue_mtd", size: "small", position: 1 },
  { key: "close_ratio", size: "small", position: 2 },
  { key: "average_sale", size: "small", position: 3 },
  { key: "nsli", size: "small", position: 4 },
  { key: "todays_appointments", size: "medium", position: 5 },
  { key: "team_performance", size: "medium", position: 6 },
  { key: "sales_by_week", size: "large", position: 7 },
  { key: "lead_sources", size: "small", position: 8 },
];

const PIE_COLORS = ["#FF4900", "#2DA44E", "#BA7517", "#1A6BC4", "#A32D2D"];

function dashboardMode(roleName: string): DashboardMode {
  if (roleName === "Sales Manager") return "sales_manager";
  if (roleName === "Sales Rep") return "sales_rep";
  if (roleName === "Installer") return "installer";
  if (roleName === "Marketing Manager") return "marketing_manager";
  return "owner";
}

function customerName(record: Record<string, unknown> | null | undefined) {
  if (!record) return "Customer";
  const name = typeof record.name === "string" ? record.name : "";
  const first = typeof record.first_name === "string" ? record.first_name : "";
  const last = typeof record.last_name === "string" ? record.last_name : "";
  return name || [first, last].filter(Boolean).join(" ") || "Customer";
}

function repName(record: Record<string, unknown> | null | undefined) {
  if (!record) return "Sales rep";
  return [record.first_name, record.last_name]
    .filter((value) => typeof value === "string" && value)
    .join(" ") || "Sales rep";
}

function monthLabel(date = new Date()) {
  return date.toLocaleDateString("en-US", { month: "long" });
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function safeNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function widgetKeyToDb(widgetKey: WidgetKey) {
  return `widget.${widgetKey}`;
}

function widgetSizeToSpan(size: WidgetSize) {
  if (size === "large") return 4;
  if (size === "medium") return 2;
  return 1;
}

function widgetSizeClass(size: WidgetSize) {
  if (size === "large") {
    return "col-span-1 md:col-span-2 xl:row-span-2";
  }
  if (size === "medium") {
    return "col-span-1 md:col-span-2 xl:row-span-1";
  }
  return "col-span-1 md:col-span-1 xl:row-span-1";
}

function widgetDesktopSpan(widgetKey: WidgetKey) {
  if (widgetKey === "revenue_goal_progress") return "xl:col-span-4";
  if (widgetKey === "todays_appointments" || widgetKey === "team_performance") return "xl:col-span-2";
  if (widgetKey === "sales_by_week") return "xl:col-span-3";
  if (widgetKey === "lead_sources") return "xl:col-span-1";
  return "xl:col-span-1";
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("complete") || normalized.includes("sold")) return "active";
  if (normalized.includes("pending") || normalized.includes("scheduled")) return "lead";
  return "customer";
}

function isoWeekLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Week";
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `W${weekNo}`;
}

function metricTone(value: number, target: number) {
  if (value >= target) return "text-[#2DA44E]";
  if (value >= target * 0.9) return "text-[#BA7517]";
  return "text-[#A32D2D]";
}

function progressColor(value: number) {
  if (value >= 1) return "#2DA44E";
  if (value >= 0.8) return "#BA7517";
  return "#A32D2D";
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateInputValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function formatComparisonChange(current: number, previous: number, format: KpiDefinition["format"]) {
  const diff = current - previous;
  const isPositive = diff >= 0;
  if (format === "percent") {
    return `${isPositive ? "↑" : "↓"} ${isPositive ? "+" : "-"}${(Math.abs(diff) * 100).toFixed(1)} pts`;
  }
  if (format === "currency") {
    return `${isPositive ? "↑" : "↓"} ${isPositive ? "+" : "-"}${formatKpiValue(Math.abs(diff), "currency")}`;
  }
  return `${isPositive ? "↑" : "↓"} ${isPositive ? "+" : "-"}${Math.abs(diff).toFixed(1)}`;
}

function getDateRange(option: DateRangeOption, customStart: string, customEnd: string) {
  const now = new Date();
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  switch (option) {
    case "this_week": {
      const start = startOfDay(addDays(now, -((now.getDay() + 6) % 7)));
      return { start, end: today };
    }
    case "this_month":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: today,
      };
    case "last_month":
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case "this_quarter": {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      return {
        start: new Date(now.getFullYear(), quarterStartMonth, 1),
        end: today,
      };
    }
    case "last_quarter": {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      const startMonth = quarterStartMonth - 3;
      return {
        start: new Date(now.getFullYear(), startMonth, 1),
        end: endOfDay(new Date(now.getFullYear(), quarterStartMonth, 0)),
      };
    }
    case "this_year":
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: today,
      };
    case "last_year":
      return {
        start: new Date(now.getFullYear() - 1, 0, 1),
        end: endOfDay(new Date(now.getFullYear() - 1, 11, 31)),
      };
    case "custom":
      return {
        start: customStart ? startOfDay(new Date(`${customStart}T00:00:00`)) : new Date(now.getFullYear(), now.getMonth(), 1),
        end: customEnd ? endOfDay(new Date(`${customEnd}T00:00:00`)) : today,
      };
  }
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-stone-50 px-4 py-5 text-sm text-stone-500">{children}</div>;
}

function ComparisonStack({
  currentValue,
  previousValue,
  format,
  toneClass,
  enabled,
}: {
  currentValue: number;
  previousValue: number;
  format: KpiDefinition["format"];
  toneClass?: string;
  enabled: boolean;
}) {
  return (
    <>
      <p className={`text-4xl font-semibold tracking-tight ${toneClass ?? "text-stone-950"}`}>
        {formatKpiValue(currentValue, format)}
      </p>
      {enabled ? (
        <>
          <p className="mt-3 text-sm text-stone-400">
            {formatKpiValue(previousValue, format)} same period last year
          </p>
          <p
            className={`mt-2 text-sm font-medium ${
              currentValue >= previousValue ? "text-[#2DA44E]" : "text-[#A32D2D]"
            }`}
          >
            {formatComparisonChange(currentValue, previousValue, format)}
          </p>
        </>
      ) : null}
    </>
  );
}

function WidgetShell({
  title,
  size,
  children,
  onResize,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  title: string;
  size: WidgetSize;
  children: ReactNode;
  onResize: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onDrop: () => void;
}) {
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="group rounded-3xl border border-stone-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="cursor-grab text-sm text-stone-300 opacity-0 transition group-hover:opacity-100">
            ⋮⋮
          </span>
          <h2 className="text-lg font-semibold tracking-tight text-stone-950">{title}</h2>
        </div>
        <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={onResize}
            className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600"
          >
            {size}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600"
          >
            🔖
          </button>
        </div>
      </div>
      <div className="mt-5 h-[calc(100%-44px)]">{children}</div>
    </article>
  );
}

function PinnedKpisRow({
  cards,
  onUnpin,
}: {
  cards: PinnedCard[];
  onUnpin: (id: string) => Promise<void>;
}) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-stone-950">My pinned KPIs</h2>
        <Link href="/kpis" className="text-sm font-medium text-primary">
          KPI library
        </Link>
      </div>
      {cards.length > 0 ? (
        <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
          {cards.map((card) => (
            <div key={card.id} className="min-w-[220px] rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-stone-500">{card.definition.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-stone-950">
                    {formatKpiValue(card.value, card.definition.format)}
                  </p>
                  <p className={`mt-2 text-sm ${card.trend >= 0 ? "text-[#2DA44E]" : "text-[#A32D2D]"}`}>
                    {card.trend >= 0 ? "Up" : "Down"} vs last month
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onUnpin(card.id)}
                  className="rounded-full bg-white px-2 py-1 text-xs text-stone-500"
                >
                  X
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-stone-500">
          Pin your favorite KPIs from the KPI library{" "}
          <Link href="/kpis" className="font-medium text-primary">
            →
          </Link>
        </p>
      )}
    </section>
  );
}

async function loadOwnerWidgets(userId: string) {
  const { data } = await supabase
    .from("user_dashboard_pins")
    .select("id, kpi_key, position, size, col_span")
    .eq("user_id", userId)
    .like("kpi_key", "widget.%")
    .order("position", { ascending: true });

  const rows =
    (data as Array<{
      id?: string | null;
      kpi_key?: string | null;
      position?: number | null;
      size?: string | null;
      col_span?: number | null;
    }> | null) ?? [];

  if (rows.length > 0) {
    const hydrated = rows.map((row) => {
      const widgetKey = String(row.kpi_key ?? "").replace("widget.", "") as WidgetKey;
      const size = (row.size as WidgetSize | null) ?? "small";
      return {
        id: row.id ?? undefined,
        kpi_key: row.kpi_key ?? "",
        widgetKey,
        size,
        col_span: row.col_span ?? widgetSizeToSpan(size),
        position: row.position ?? 0,
      } satisfies WidgetLayout;
    });

    const existingKeys = new Set(hydrated.map((widget) => widget.widgetKey));
    const missingDefaults = OWNER_DEFAULT_WIDGETS.filter((widget) => !existingKeys.has(widget.key)).map((widget) => ({
      kpi_key: widgetKeyToDb(widget.key),
      widgetKey: widget.key,
      size: widget.size,
      col_span: widgetSizeToSpan(widget.size),
      position: widget.position,
    }));

    return [...hydrated, ...missingDefaults].sort((a, b) => a.position - b.position);
  }

  const defaults = OWNER_DEFAULT_WIDGETS.map((widget) => ({
    user_id: userId,
    kpi_key: widgetKeyToDb(widget.key),
    size: widget.size,
    col_span: widgetSizeToSpan(widget.size),
    position: widget.position,
  }));

  await supabase.from("user_dashboard_pins").upsert(defaults, {
    onConflict: "user_id,kpi_key",
  });

  return OWNER_DEFAULT_WIDGETS.map((widget) => ({
    kpi_key: widgetKeyToDb(widget.key),
    widgetKey: widget.key,
    size: widget.size,
    col_span: widgetSizeToSpan(widget.size),
    position: widget.position,
  }));
}

async function saveOwnerWidgets(userId: string, widgets: WidgetLayout[]) {
  await Promise.all(
    widgets.map((widget, index) =>
      supabase.from("user_dashboard_pins").upsert(
        {
          user_id: userId,
          kpi_key: widget.kpi_key,
          size: widget.size,
          col_span: widgetSizeToSpan(widget.size),
          position: index,
        },
        { onConflict: "user_id,kpi_key" },
      ),
    ),
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentAppUser | null>(null);
  const [pinnedCards, setPinnedCards] = useState<PinnedCard[]>([]);
  const [ownerWidgets, setOwnerWidgets] = useState<WidgetLayout[]>([]);
  const [draggedWidget, setDraggedWidget] = useState<WidgetKey | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeOption>("this_month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [comparePriorYear, setComparePriorYear] = useState(false);
  const [data, setData] = useState<DashboardData>({
    revenueGoal: { actual: 0, target: 0, percentage: 0, hasGoal: false },
    revenueMtd: 0,
    revenueTrend: 0,
    closeRatio: { ratio: 0, sold: 0, total: 0 },
    averageSale: { average: 0, count: 0, total: 0 },
    averageSaleTrend: 0,
    nsli: { nsli: 0, totalSold: 0, leadsIssued: 0 },
    nsliTrend: 0,
    todaysAppointments: [],
    teamPerformance: [],
    salesByWeek: [],
    leadSources: [],
    marketing: { leads: 0, bookingRate: 0, demoRate: 0, leadToClose: 0 },
    comparisons: { revenueMtd: 0, closeRatio: 0, averageSale: 0, nsli: 0 },
  });

  const mode = dashboardMode(currentUser?.roleName ?? "Owner");
  const selectedRangePreview = getDateRange(dateRange, customStartDate, customEndDate);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setLoading(true);

      const user = await getCurrentAppUser();
      if (!isMounted) return;
      setCurrentUser(user);

      const effectiveMode = dashboardMode(user?.roleName ?? "Owner");
      const scopedUserId = effectiveMode === "sales_rep" ? user?.id : undefined;
      const selectedRange = getDateRange(dateRange, customStartDate, customEndDate);
      const startDate = selectedRange.start.toISOString();
      const endDate = selectedRange.end.toISOString();
      const priorYearStart = new Date(selectedRange.start);
      priorYearStart.setFullYear(priorYearStart.getFullYear() - 1);
      const priorYearEnd = new Date(selectedRange.end);
      priorYearEnd.setFullYear(priorYearEnd.getFullYear() - 1);
      const today = new Date().toISOString().slice(0, 10);
      const todayStart = `${today}T00:00:00.000Z`;
      const todayEnd = `${today}T23:59:59.999Z`;

      const [
        revenueGoal,
        revenueMtd,
        revenueTrend,
        closeRatio,
        averageSale,
        averageSaleTrend,
        nsli,
        nsliTrend,
        todayAppointmentsResponse,
        teamKpis,
        leadSources,
        marketing,
        revenuePriorYear,
        closeRatioPriorYear,
        averageSalePriorYear,
        nsliPriorYear,
        pins,
        salesByWeekResponse,
        widgets,
      ] = await Promise.all([
        getRevenueVsGoal({ startDate, endDate }),
        getRevenue(scopedUserId, "mtd", startDate, endDate),
        getKpiTrend("revenue_mtd", scopedUserId, startDate, endDate),
        getCloseRatio(scopedUserId, startDate, endDate),
        getAverageSale(scopedUserId, startDate, endDate),
        getKpiTrend("average_sale", scopedUserId, startDate, endDate),
        getNSLI(scopedUserId, startDate, endDate),
        getKpiTrend("nsli", scopedUserId, startDate, endDate),
        supabase
          .from("appointments")
          .select(`
            id,
            slot,
            status,
            scheduled_at,
            assigned_to,
            customers(name, first_name, last_name),
            app_users(first_name, last_name)
          `)
          .gte("scheduled_at", todayStart)
          .lte("scheduled_at", todayEnd)
          .order("scheduled_at", { ascending: true }),
        getTeamKPIs(startDate, endDate),
        getLeadSourcesBreakdown(startDate, endDate),
        getLeadsMetrics(scopedUserId, startDate, endDate),
        getRevenue(scopedUserId, "mtd", priorYearStart.toISOString(), priorYearEnd.toISOString()),
        getCloseRatio(scopedUserId, priorYearStart.toISOString(), priorYearEnd.toISOString()),
        getAverageSale(scopedUserId, priorYearStart.toISOString(), priorYearEnd.toISOString()),
        getNSLI(scopedUserId, priorYearStart.toISOString(), priorYearEnd.toISOString()),
        user ? getPinnedKpis(user.id) : Promise.resolve([]),
        supabase
          .from("appointments")
          .select("sale_amount, sold, scheduled_at")
          .gte("scheduled_at", startDate)
          .lte("scheduled_at", endDate)
          .order("scheduled_at", { ascending: true }),
        user && effectiveMode === "owner" ? loadOwnerWidgets(user.id) : Promise.resolve([]),
      ]);

      if (!isMounted) return;

      const todayAppointments =
        ((todayAppointmentsResponse.data as Array<Record<string, unknown>> | null) ?? [])
          .filter((row) => (effectiveMode === "sales_rep" ? String(row.assigned_to ?? "") === user?.id : true))
          .map((row) => {
          const customer =
            row.customers && !Array.isArray(row.customers)
              ? (row.customers as Record<string, unknown>)
              : null;
          const rep =
            row.app_users && !Array.isArray(row.app_users)
              ? (row.app_users as Record<string, unknown>)
              : null;
          const scheduledAt = String(row.scheduled_at ?? "");
          return {
            id: String(row.id ?? ""),
            slot:
              String(row.slot ?? "") ||
              new Date(scheduledAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              }),
            customerName: customerName(customer),
            repName: repName(rep),
            status: String(row.status ?? "scheduled"),
          } satisfies AppointmentSummary;
        });

      const weeklyTotals = new Map<string, number>();
      const salesRows =
        (salesByWeekResponse.data as Array<{ sale_amount?: number | null; sold?: boolean | null; scheduled_at?: string | null }> | null) ?? [];
      salesRows.forEach((row) => {
        if (!row.sold) return;
        const label = isoWeekLabel(String(row.scheduled_at ?? ""));
        weeklyTotals.set(label, (weeklyTotals.get(label) ?? 0) + safeNumber(row.sale_amount));
      });

      const teamRows = teamKpis.map((row) => ({
        id: row.user.id,
        name: row.user.name,
        initials: initials(row.user.name),
        closeRatio: row.closeRatio,
        averageSale: row.averageSale,
        nsli: row.nsli,
        totalSold: row.totalSold,
        location: row.user.location,
      }));

      const pinned = user
        ? await Promise.all(
            pins.map(async (pin) => {
              const definition = kpiDefinitions.find((item) => item.key === pin.kpi_key);
              if (!definition) return null;
              const [value, trend] = await Promise.all([
                getKpiValue(pin.kpi_key, user.id, startDate, endDate),
                getKpiTrend(pin.kpi_key, user.id, startDate, endDate),
              ]);
              return {
                id: pin.id,
                key: pin.kpi_key,
                definition,
                value: safeNumber(value.value),
                trend: safeNumber(trend),
              } satisfies PinnedCard;
            }),
          )
        : [];

      setPinnedCards((pinned.filter(Boolean) as PinnedCard[]) ?? []);
      setOwnerWidgets(widgets);
      setData({
        revenueGoal,
        revenueMtd,
        revenueTrend: safeNumber(revenueTrend),
        closeRatio,
        averageSale,
        averageSaleTrend: safeNumber(averageSaleTrend),
        nsli,
        nsliTrend: safeNumber(nsliTrend),
        todaysAppointments: todayAppointments,
        teamPerformance:
          effectiveMode === "sales_manager" && user?.location
            ? teamRows.filter((row) => row.location === user.location)
            : teamRows,
        salesByWeek: Array.from(weeklyTotals.entries()).map(([label, value]) => ({ label, value })),
        leadSources: leadSources.slice(0, 5).map((item) => ({
          source: item.source,
          leads: item.leads,
          revenue: item.revenue,
        })),
        marketing: {
          leads: marketing.leads,
          bookingRate: marketing.bookingRate,
          demoRate: marketing.demoRate,
          leadToClose: marketing.leadToClose,
        },
        comparisons: {
          revenueMtd: revenuePriorYear,
          closeRatio: closeRatioPriorYear.ratio,
          averageSale: averageSalePriorYear.average,
          nsli: nsliPriorYear.nsli,
        },
      });

      setLoading(false);
    }

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [comparePriorYear, customEndDate, customStartDate, dateRange]);

  async function unpinKpi(id: string) {
    await supabase.from("user_dashboard_pins").delete().eq("id", id);
    setPinnedCards((current) => current.filter((card) => card.id !== id));
  }

  async function updateOwnerWidgets(nextWidgets: WidgetLayout[]) {
    if (!currentUser) return;
    const normalized = nextWidgets.map((widget, index) => ({
      ...widget,
      position: index,
      col_span: widgetSizeToSpan(widget.size),
    }));
    setOwnerWidgets(normalized);
    await saveOwnerWidgets(currentUser.id, normalized);
  }

  async function cycleWidgetSize(widgetKey: WidgetKey) {
    const next: WidgetLayout[] = ownerWidgets.map((widget) => {
      if (widget.widgetKey !== widgetKey) return widget;
      const nextSize: WidgetSize =
        widget.size === "small"
          ? "medium"
          : widget.size === "medium"
            ? "large"
            : "small";
      return {
        ...widget,
        size: nextSize,
        col_span: widgetSizeToSpan(nextSize),
      };
    });
    await updateOwnerWidgets(next);
  }

  async function removeWidget(widgetKey: WidgetKey) {
    if (!currentUser) return;
    await supabase
      .from("user_dashboard_pins")
      .delete()
      .eq("user_id", currentUser.id)
      .eq("kpi_key", widgetKeyToDb(widgetKey));
    setOwnerWidgets((current) => current.filter((widget) => widget.widgetKey !== widgetKey));
  }

  async function reorderWidgets(fromKey: WidgetKey, toKey: WidgetKey) {
    if (fromKey === toKey) return;
    const current = [...ownerWidgets];
    const fromIndex = current.findIndex((widget) => widget.widgetKey === fromKey);
    const toIndex = current.findIndex((widget) => widget.widgetKey === toKey);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    await updateOwnerWidgets(current);
  }

  function renderOwnerWidget(widget: WidgetLayout) {
    switch (widget.widgetKey) {
      case "revenue_goal_progress":
        return (
          <WidgetShell
            key={widget.widgetKey}
            title={`${monthLabel(selectedRangePreview.start)} Revenue Goal: ${formatKpiValue(data.revenueGoal.target, "currency")}`}
            size={widget.size}
            onResize={() => void cycleWidgetSize(widget.widgetKey)}
            onRemove={() => void removeWidget(widget.widgetKey)}
            onDragStart={() => setDraggedWidget(widget.widgetKey)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedWidget) void reorderWidgets(draggedWidget, widget.widgetKey);
              setDraggedWidget(null);
            }}
          >
            {data.revenueGoal.hasGoal ? (
              <div className="flex h-full flex-col">
                <div className="h-5 rounded-full bg-stone-100">
                  <div
                    className="h-5 rounded-full transition-all"
                    style={{
                      width: `${Math.min(data.revenueGoal.percentage * 100, 100)}%`,
                      backgroundColor: progressColor(data.revenueGoal.percentage),
                    }}
                  />
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Actual</p>
                    <p className="mt-2 text-3xl font-semibold text-stone-950">
                      {formatKpiValue(data.revenueGoal.actual, "currency")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Goal</p>
                    <p className="mt-2 text-3xl font-semibold text-stone-950">
                      {formatKpiValue(data.revenueGoal.target, "currency")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Progress</p>
                    <p className={`mt-2 text-3xl font-semibold ${metricTone(data.revenueGoal.percentage, 1)}`}>
                      {(data.revenueGoal.percentage * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Remaining</p>
                    <p className="mt-2 text-3xl font-semibold text-stone-950">
                      {formatKpiValue(Math.max(data.revenueGoal.target - data.revenueGoal.actual, 0), "currency")}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col justify-center rounded-2xl bg-stone-50 px-6 py-8">
                <p className="text-lg font-semibold text-stone-950">No goal set</p>
                <p className="mt-2 text-sm text-stone-500">
                  Add your monthly company goal in settings to track progress here.
                </p>
                <Link href="/admin/settings" className="mt-4 text-sm font-medium text-primary">
                  Settings → Company goals
                </Link>
              </div>
            )}
          </WidgetShell>
        );

      case "revenue_mtd":
        return (
          <WidgetShell
            key={widget.widgetKey}
            title="Revenue MTD"
            size={widget.size}
            onResize={() => void cycleWidgetSize(widget.widgetKey)}
            onRemove={() => void removeWidget(widget.widgetKey)}
            onDragStart={() => setDraggedWidget(widget.widgetKey)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedWidget) void reorderWidgets(draggedWidget, widget.widgetKey);
              setDraggedWidget(null);
            }}
          >
            <ComparisonStack
              currentValue={data.revenueMtd}
              previousValue={data.comparisons.revenueMtd}
              format="currency"
              enabled={comparePriorYear}
            />
            {!comparePriorYear ? (
              <p className={`mt-4 text-sm font-medium ${data.revenueTrend >= 0 ? "text-[#2DA44E]" : "text-[#A32D2D]"}`}>
                {data.revenueTrend >= 0 ? "Above" : "Below"} last month by{" "}
                {formatKpiValue(Math.abs(data.revenueTrend), "currency")}
              </p>
            ) : null}
          </WidgetShell>
        );

      case "close_ratio":
        return (
          <WidgetShell
            key={widget.widgetKey}
            title="Close ratio"
            size={widget.size}
            onResize={() => void cycleWidgetSize(widget.widgetKey)}
            onRemove={() => void removeWidget(widget.widgetKey)}
            onDragStart={() => setDraggedWidget(widget.widgetKey)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedWidget) void reorderWidgets(draggedWidget, widget.widgetKey);
              setDraggedWidget(null);
            }}
          >
            <ComparisonStack
              currentValue={data.closeRatio.ratio}
              previousValue={data.comparisons.closeRatio}
              format="percent"
              toneClass={metricTone(data.closeRatio.ratio, 0.48)}
              enabled={comparePriorYear}
            />
            <p className="mt-4 text-sm text-stone-500">
              {data.closeRatio.sold} of {data.closeRatio.total} leads closed
            </p>
          </WidgetShell>
        );

      case "average_sale":
        return (
          <WidgetShell
            key={widget.widgetKey}
            title="Average sale"
            size={widget.size}
            onResize={() => void cycleWidgetSize(widget.widgetKey)}
            onRemove={() => void removeWidget(widget.widgetKey)}
            onDragStart={() => setDraggedWidget(widget.widgetKey)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedWidget) void reorderWidgets(draggedWidget, widget.widgetKey);
              setDraggedWidget(null);
            }}
          >
            <ComparisonStack
              currentValue={data.averageSale.average}
              previousValue={data.comparisons.averageSale}
              format="currency"
              toneClass={metricTone(data.averageSale.average, 7000)}
              enabled={comparePriorYear}
            />
            <p className={`mt-4 text-sm ${!comparePriorYear ? (data.averageSaleTrend >= 0 ? "text-[#2DA44E]" : "text-[#A32D2D]") : "text-stone-500"}`}>
              {data.averageSale.count} sold appointments in range
            </p>
          </WidgetShell>
        );

      case "nsli":
        return (
          <WidgetShell
            key={widget.widgetKey}
            title="NSLI"
            size={widget.size}
            onResize={() => void cycleWidgetSize(widget.widgetKey)}
            onRemove={() => void removeWidget(widget.widgetKey)}
            onDragStart={() => setDraggedWidget(widget.widgetKey)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedWidget) void reorderWidgets(draggedWidget, widget.widgetKey);
              setDraggedWidget(null);
            }}
          >
            <ComparisonStack
              currentValue={data.nsli.nsli}
              previousValue={data.comparisons.nsli}
              format="currency"
              enabled={comparePriorYear}
            />
            <p className={`mt-4 text-sm ${!comparePriorYear ? (data.nsliTrend >= 0 ? "text-[#2DA44E]" : "text-[#A32D2D]") : "text-stone-500"}`}>
              {data.nsli.leadsIssued} non-cancelled leads in range
            </p>
          </WidgetShell>
        );

      case "todays_appointments":
        return (
          <WidgetShell
            key={widget.widgetKey}
            title="Today's appointments"
            size={widget.size}
            onResize={() => void cycleWidgetSize(widget.widgetKey)}
            onRemove={() => void removeWidget(widget.widgetKey)}
            onDragStart={() => setDraggedWidget(widget.widgetKey)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedWidget) void reorderWidgets(draggedWidget, widget.widgetKey);
              setDraggedWidget(null);
            }}
          >
            <div className="space-y-3">
              {data.todaysAppointments.length > 0 ? (
                data.todaysAppointments.map((appointment) => (
                  <div key={appointment.id} className="rounded-2xl bg-stone-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-stone-950">
                        {appointment.slot} · {appointment.customerName}
                      </p>
                      <Badge label={appointment.status} tone={statusTone(appointment.status)} />
                    </div>
                    <p className="mt-1 text-sm text-stone-500">{appointment.repName}</p>
                  </div>
                ))
              ) : (
                <EmptyState>No appointments today.</EmptyState>
              )}
            </div>
            <div className="mt-4">
              <Link href="/calendar" className="text-sm font-medium text-primary">
                View calendar
              </Link>
            </div>
          </WidgetShell>
        );

      case "team_performance":
        return (
          <WidgetShell
            key={widget.widgetKey}
            title="Team performance"
            size={widget.size}
            onResize={() => void cycleWidgetSize(widget.widgetKey)}
            onRemove={() => void removeWidget(widget.widgetKey)}
            onDragStart={() => setDraggedWidget(widget.widgetKey)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedWidget) void reorderWidgets(draggedWidget, widget.widgetKey);
              setDraggedWidget(null);
            }}
          >
            <div className="space-y-3">
              {data.teamPerformance.map((person) => (
                <div key={person.id} className="grid grid-cols-[44px_1fr] gap-3 rounded-2xl bg-stone-50 px-4 py-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-semibold text-stone-600">
                    {person.initials}
                  </div>
                  <div>
                    <p className="font-medium text-stone-950">{person.name}</p>
                    <div className="mt-2 grid gap-2 text-sm md:grid-cols-4">
                      <span className={metricTone(person.closeRatio, 0.48)}>
                        Close {formatKpiValue(person.closeRatio, "percent")}
                      </span>
                      <span className={metricTone(person.averageSale, 7000)}>
                        Avg {formatKpiValue(person.averageSale, "currency")}
                      </span>
                      <span className="text-stone-600">NSLI {formatKpiValue(person.nsli, "currency")}</span>
                      <span className="text-stone-600">Sold {formatKpiValue(person.totalSold, "currency")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </WidgetShell>
        );

      case "sales_by_week":
        return (
          <WidgetShell
            key={widget.widgetKey}
            title="Sales by week"
            size={widget.size}
            onResize={() => void cycleWidgetSize(widget.widgetKey)}
            onRemove={() => void removeWidget(widget.widgetKey)}
            onDragStart={() => setDraggedWidget(widget.widgetKey)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedWidget) void reorderWidgets(draggedWidget, widget.widgetKey);
              setDraggedWidget(null);
            }}
          >
            <div className="h-full min-h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.salesByWeek}>
                  <XAxis dataKey="label" tick={{ fill: "#57534e" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#57534e" }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => formatKpiValue(safeNumber(value), "currency")} />
                  <Bar dataKey="value" fill="#FF4900" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </WidgetShell>
        );

      case "lead_sources":
        return (
          <WidgetShell
            key={widget.widgetKey}
            title="Lead sources"
            size={widget.size}
            onResize={() => void cycleWidgetSize(widget.widgetKey)}
            onRemove={() => void removeWidget(widget.widgetKey)}
            onDragStart={() => setDraggedWidget(widget.widgetKey)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedWidget) void reorderWidgets(draggedWidget, widget.widgetKey);
              setDraggedWidget(null);
            }}
          >
            <div className="h-full min-h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.leadSources} dataKey="leads" nameKey="source" innerRadius={48} outerRadius={74}>
                    {data.leadSources.map((entry, index) => (
                      <Cell key={entry.source} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </WidgetShell>
        );
    }
  }

  function renderOwnerDashboard() {
    const widgets =
      ownerWidgets.length > 0
        ? ownerWidgets
        : OWNER_DEFAULT_WIDGETS.map((widget) => ({
            kpi_key: widgetKeyToDb(widget.key),
            widgetKey: widget.key,
            size: widget.size,
            col_span: widgetSizeToSpan(widget.size),
            position: widget.position,
          }));

    const requiredKeys: WidgetKey[] = [
      "revenue_mtd",
      "close_ratio",
      "average_sale",
      "nsli",
    ];
    const hydratedWidgets = [...widgets];

    requiredKeys.forEach((requiredKey) => {
      if (!hydratedWidgets.some((widget) => widget.widgetKey === requiredKey)) {
        const fallback = OWNER_DEFAULT_WIDGETS.find((widget) => widget.key === requiredKey);
        if (fallback) {
          hydratedWidgets.push({
            kpi_key: widgetKeyToDb(fallback.key),
            widgetKey: fallback.key,
            size: fallback.size,
            col_span: widgetSizeToSpan(fallback.size),
            position: fallback.position,
          });
        }
      }
    });

    return (
      <div
        className="grid auto-rows-[220px] grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 xl:[grid-template-columns:repeat(4,minmax(0,1fr))]"
        style={{ gap: "16px" }}
      >
        {hydratedWidgets
          .sort((a, b) => a.position - b.position)
          .map((widget) => (
            <div
              key={widget.widgetKey}
              className={`${widgetSizeClass(widget.size)} ${widgetDesktopSpan(widget.widgetKey)}`}
            >
              {renderOwnerWidget(widget)}
            </div>
          ))}
      </div>
    );
  }

function renderFallbackDashboard() {
    return (
      <div className="grid gap-5 xl:grid-cols-4">
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-stone-500">Revenue MTD</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-stone-950">
            {formatKpiValue(data.revenueMtd, "currency")}
          </p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-stone-500">Close ratio</p>
          <p className={`mt-4 text-3xl font-semibold tracking-tight ${metricTone(data.closeRatio.ratio, 0.48)}`}>
            {formatKpiValue(data.closeRatio.ratio, "percent")}
          </p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-stone-500">Average sale</p>
          <p className={`mt-4 text-3xl font-semibold tracking-tight ${metricTone(data.averageSale.average, 7000)}`}>
            {formatKpiValue(data.averageSale.average, "currency")}
          </p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-stone-500">NSLI</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-stone-950">
            {formatKpiValue(data.nsli.nsli, "currency")}
          </p>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:col-span-2 xl:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">Today's appointments</h2>
            <Link href="/calendar" className="text-sm font-medium text-primary">
              View all
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {data.todaysAppointments.length > 0 ? (
              data.todaysAppointments.map((appointment) => (
                <div key={appointment.id} className="rounded-2xl bg-stone-50 px-4 py-4">
                  <p className="font-medium text-stone-950">
                    {appointment.slot} · {appointment.customerName}
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
                    {appointment.repName} · {appointment.status}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState>No appointments today.</EmptyState>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:col-span-2 xl:col-span-2">
          <h2 className="text-lg font-semibold tracking-tight text-stone-950">
            {mode === "marketing_manager" ? "Lead sources" : "Team performance"}
          </h2>
          <div className="mt-5">
            {mode === "marketing_manager" ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.leadSources} dataKey="leads" nameKey="source" innerRadius={60} outerRadius={90}>
                      {data.leadSources.map((entry, index) => (
                        <Cell key={entry.source} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="space-y-3">
                {data.teamPerformance.slice(0, 5).map((person) => (
                  <div key={person.id} className="rounded-2xl bg-stone-50 px-4 py-4">
                    <p className="font-medium text-stone-950">{person.name}</p>
                    <p className="mt-1 text-sm text-stone-500">
                      Close {formatKpiValue(person.closeRatio, "percent")} · Avg {formatKpiValue(person.averageSale, "currency")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Dashboard" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar
          title="Dashboard"
          actionLabel="New quote"
          actionHref="/quotes/new"
          actions={
            <div className="flex flex-wrap items-center justify-end gap-3">
              <select
                value={dateRange}
                onChange={(event) => setDateRange(event.target.value as DateRangeOption)}
                className="h-11 rounded-xl border border-stone-200 px-3 text-sm text-stone-700"
              >
                <option value="this_week">This week</option>
                <option value="this_month">This month</option>
                <option value="last_month">Last month</option>
                <option value="this_quarter">This quarter</option>
                <option value="last_quarter">Last quarter</option>
                <option value="this_year">This year</option>
                <option value="last_year">Last year</option>
                <option value="custom">Custom range</option>
              </select>

              {dateRange === "custom" ? (
                <>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(event) => setCustomStartDate(event.target.value)}
                    className="h-11 rounded-xl border border-stone-200 px-3 text-sm text-stone-700"
                  />
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(event) => setCustomEndDate(event.target.value)}
                    className="h-11 rounded-xl border border-stone-200 px-3 text-sm text-stone-700"
                  />
                </>
              ) : null}

              <label className="flex h-11 items-center gap-2 rounded-xl border border-stone-200 px-3 text-sm text-stone-700">
                <span>vs prior year</span>
                <button
                  type="button"
                  aria-pressed={comparePriorYear}
                  onClick={() => setComparePriorYear((current) => !current)}
                  className={`relative h-6 w-11 rounded-full transition ${
                    comparePriorYear ? "bg-primary" : "bg-stone-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                      comparePriorYear ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </label>
            </div>
          }
        />

        <div className="flex-1 space-y-8 p-8">
          <PinnedKpisRow cards={pinnedCards} onUnpin={unpinKpi} />

          {loading ? (
            <div className="grid gap-5 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-36 animate-pulse rounded-2xl border border-stone-200 bg-white" />
              ))}
            </div>
          ) : mode === "owner" ? (
            renderOwnerDashboard()
          ) : (
            renderFallbackDashboard()
          )}
        </div>
      </section>
    </main>
  );
}
