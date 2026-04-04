"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
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
import { getActiveAppUsers, getCurrentAppUser, type ActiveAppUser, type CurrentAppUser } from "@/lib/current-app-user";
import {
  formatKpiValue,
  getAverageGrossMargin,
  getAverageSale,
  getCloseRatio,
  getGrossProfitMtd,
  getJobsCompletedMtd,
  getKpiTrend,
  getKpiValue,
  getLeadSourcesBreakdown,
  getLeadsMetrics,
  getNSLI,
  getPinnedKpis,
  getPipelineValue,
  getQuotesStats,
  getRevenue,
  getRevenueVsGoal,
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

type MetricTone = "green" | "amber" | "red" | "default";

type MetricCard = {
  label: string;
  value: string;
  detail: string;
  tone?: MetricTone;
};

type PinnedCard = {
  id: string;
  key: string;
  definition: KpiDefinition;
  value: number;
  trend: number;
};

type QuoteSummary = {
  id: string;
  customerName: string;
  status: string;
  total: number;
  createdAt: string;
};

type AppointmentSummary = {
  id: string;
  slot: string;
  customerName: string;
  address: string;
  repName: string;
  sold: boolean;
  saleAmount: number;
};

type TeamPerformanceRow = {
  id: string;
  name: string;
  initials: string;
  closeRatio: number;
  averageSale: number;
  nsli: number;
  totalSold: number;
};

type TeamStatusRow = {
  id: string;
  name: string;
  status: string;
  detail: string;
};

type InstallerSignOff = {
  id: string;
  customerName: string;
  signedAt: string;
};

type GoalProgress = {
  actual: number;
  target: number;
  percentage: number;
  ellsworth: number;
  lindsay: number;
};

type MarketingMetrics = {
  leads: number;
  previousLeads: number;
  bookingRate: number;
  demoRate: number;
  leadToClose: number;
};

const PIE_COLORS = ["#FF4900", "#2DA44E", "#BA7517", "#1A6BC4", "#A32D2D", "#7C6F64"];

function monthLabel(date = new Date()) {
  return date.toLocaleDateString("en-US", { month: "long" });
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Date unavailable";
  }

  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function metricToneClass(tone: MetricTone = "default") {
  if (tone === "green") return "text-[#2DA44E]";
  if (tone === "amber") return "text-[#BA7517]";
  if (tone === "red") return "text-[#A32D2D]";
  return "text-stone-500";
}

function progressColor(value: number) {
  if (value >= 1) return "#2DA44E";
  if (value >= 0.8) return "#BA7517";
  return "#A32D2D";
}

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

function safeNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function formatCurrencyTooltip(value: unknown) {
  return formatKpiValue(safeNumber(value), "currency");
}

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function startOfPreviousMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

function endOfPreviousMonth() {
  return startOfCurrentMonth();
}

function withinLastDays(value: string, days: number) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return Date.now() - parsed.getTime() <= days * 24 * 60 * 60 * 1000;
}

function weekNumberInMonth(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 1;
  return Math.min(4, Math.floor((parsed.getDate() - 1) / 7) + 1);
}

function SummaryCard({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-stone-950">{title}</h2>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-stone-50 px-4 py-5 text-sm text-stone-500">{children}</p>;
}

function MetricGrid({ metrics }: { metrics: MetricCard[] }) {
  return (
    <div className="grid gap-5 xl:grid-cols-4">
      {metrics.map((metric) => (
        <article key={metric.label} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-stone-500">{metric.label}</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-stone-950">{metric.value}</p>
          <p className={`mt-3 text-sm ${metricToneClass(metric.tone)}`}>{metric.detail}</p>
        </article>
      ))}
    </div>
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
            <div
              key={card.id}
              className="min-w-[220px] rounded-2xl border border-stone-200 bg-stone-50 p-4"
            >
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

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentAppUser | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveAppUser[]>([]);
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [pinnedCards, setPinnedCards] = useState<PinnedCard[]>([]);
  const [goal, setGoal] = useState<GoalProgress>({
    actual: 0,
    target: 0,
    percentage: 0,
    ellsworth: 0,
    lindsay: 0,
  });
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [teamPerformance, setTeamPerformance] = useState<TeamPerformanceRow[]>([]);
  const [teamStatus, setTeamStatus] = useState<TeamStatusRow[]>([]);
  const [salesByWeek, setSalesByWeek] = useState<Array<{ label: string; value: number }>>([]);
  const [leadSources, setLeadSources] = useState<
    Array<{ source: string; leads: number; appointments: number; sales: number; revenue: number; cost: number; cpl: number; roi: number }>
  >([]);
  const [locationComparison, setLocationComparison] = useState<Array<{ name: string; revenue: number }>>([]);
  const [installerStats, setInstallerStats] = useState({ completed: 0, averageHours: 0, laborHours: 0 });
  const [recentSignOffs, setRecentSignOffs] = useState<InstallerSignOff[]>([]);
  const [marketingMetrics, setMarketingMetrics] = useState<MarketingMetrics>({
    leads: 0,
    previousLeads: 0,
    bookingRate: 0,
    demoRate: 0,
    leadToClose: 0,
  });
  const [pipelineValue, setPipelineValue] = useState(0);
  const [followUpNeeded, setFollowUpNeeded] = useState(0);
  const [repGoalAmount, setRepGoalAmount] = useState(70000);
  const [grossProfitMtd, setGrossProfitMtd] = useState(0);
  const [avgGrossMargin, setAvgGrossMargin] = useState(0);

  const mode = dashboardMode(currentUser?.roleName ?? "Owner");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);

      const [user, users] = await Promise.all([getCurrentAppUser(), getActiveAppUsers()]);

      if (!isMounted) return;

      setCurrentUser(user);
      setActiveUsers(users);

      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const currentMonthStart = startOfCurrentMonth().toISOString();
      const previousMonthStart = startOfPreviousMonth().toISOString();
      const previousMonthEnd = endOfPreviousMonth().toISOString();
      const effectiveMode = dashboardMode(user?.roleName ?? "Owner");
      const scopedSalesUserId = effectiveMode === "sales_rep" ? user?.id : undefined;

      const [
        revenueMtd,
        closeRatio,
        averageSale,
        nsli,
        revenueGoal,
        quoteStats,
        pipeline,
        grossProfit,
        averageMargin,
        leadsBreakdown,
        leadsMetricSet,
        jobsStats,
        pins,
        signOffsResponse,
        quotesResponse,
        appointmentsResponse,
        projectsResponse,
        businessSettingsResponse,
      ] = await Promise.all([
        getRevenue(scopedSalesUserId, "mtd"),
        getCloseRatio(scopedSalesUserId),
        getAverageSale(scopedSalesUserId),
        getNSLI(scopedSalesUserId),
        getRevenueVsGoal(),
        getQuotesStats(),
        getPipelineValue(scopedSalesUserId),
        getGrossProfitMtd(),
        getAverageGrossMargin(),
        getLeadSourcesBreakdown(),
        getLeadsMetrics(scopedSalesUserId),
        getJobsCompletedMtd(effectiveMode === "installer" ? user?.id : undefined),
        user ? getPinnedKpis(user.id) : Promise.resolve([]),
        supabase
          .from("install_sign_offs")
          .select("id, signed_at, customer_name, installer_id")
          .order("signed_at", { ascending: false })
          .limit(10),
        supabase
          .from("quotes")
          .select("id, status, total, created_at, notes, customers(name, first_name, last_name)")
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("appointments")
          .select(`
            id,
            slot,
            date,
            scheduled_at,
            sold,
            sale_amount,
            rep_user_id,
            assigned_to,
            customers(name, first_name, last_name, address, city, state, zip),
            app_users(first_name, last_name)
          `)
          .gte("date", today)
          .lte("date", today)
          .order("slot", { ascending: true }),
        supabase
          .from("projects")
          .select("id, location, scheduled_at, install_date, status, assigned_rep_id, total_amount, gross_profit, cogs, labor_cost, commission")
          .order("scheduled_at", { ascending: false })
          .limit(12),
        supabase.from("business_settings").select("business_name").limit(1).maybeSingle(),
      ]);

      if (!isMounted) return;

      const revenuePrevRows = await supabase
        .from("appointments")
        .select("sale_amount, sold, scheduled_at, date, assigned_to, rep_user_id, location")
        .gte("scheduled_at", previousMonthStart)
        .lt("scheduled_at", previousMonthEnd);

      const prevAppointmentRows =
        (revenuePrevRows.data as Array<{
          sale_amount?: number | null;
          sold?: boolean | null;
          assigned_to?: string | null;
          rep_user_id?: string | null;
          location?: string | null;
        }> | null) ?? [];

      const filteredPrevRevenue = prevAppointmentRows
        .filter((row) => {
          if (!row.sold) return false;
          if (!scopedSalesUserId) return true;
          return row.assigned_to === scopedSalesUserId || row.rep_user_id === scopedSalesUserId;
        })
        .reduce((sum, row) => sum + safeNumber(row.sale_amount), 0);

      const locationRevenueCurrent = await supabase
        .from("appointments")
        .select("sale_amount, sold, location, scheduled_at")
        .gte("scheduled_at", currentMonthStart);

      const locationRows =
        (locationRevenueCurrent.data as Array<{ sale_amount?: number | null; sold?: boolean | null; location?: string | null }> | null) ?? [];

      const ellsworthRevenue = locationRows
        .filter((row) => row.sold && row.location === "Ellsworth")
        .reduce((sum, row) => sum + safeNumber(row.sale_amount), 0);
      const lindsayRevenue = locationRows
        .filter((row) => row.sold && row.location === "Lindsay")
        .reduce((sum, row) => sum + safeNumber(row.sale_amount), 0);

      setGoal({
        actual: revenueGoal.actual,
        target: revenueGoal.target,
        percentage: revenueGoal.percentage,
        ellsworth: ellsworthRevenue,
        lindsay: lindsayRevenue,
      });

      setPipelineValue(pipeline);
      setFollowUpNeeded(
        (((quotesResponse.data as Array<Record<string, unknown>> | null) ?? []).filter((quote) => {
          const createdAt = String(quote.created_at ?? "");
          const status = String(quote.status ?? "pending");
          return status === "pending" && !withinLastDays(createdAt, 7);
        })).length,
      );
      setGrossProfitMtd(grossProfit);
      setAvgGrossMargin(averageMargin);
      setMarketingMetrics(leadsMetricSet);
      setInstallerStats({
        completed: jobsStats.completed,
        averageHours: jobsStats.averageHours,
        laborHours: jobsStats.laborMinutes / 60,
      });

      setRecentSignOffs(
        (((signOffsResponse.data as Array<{ id: string; signed_at?: string | null; customer_name?: string | null; installer_id?: string | null }> | null) ?? [])
          .filter((item) => (effectiveMode === "installer" ? item.installer_id === user?.id : true))
          .slice(0, 5)
          .map((item) => ({
            id: item.id,
            customerName: item.customer_name ?? "Customer",
            signedAt: item.signed_at ?? new Date().toISOString(),
          }))),
      );

      const quotesList = (((quotesResponse.data as Array<Record<string, unknown>> | null) ?? []).map((quote) => {
        const customer =
          quote.customers && !Array.isArray(quote.customers)
            ? (quote.customers as Record<string, unknown>)
            : null;
        return {
          id: String(quote.id ?? ""),
          customerName: customerName(customer),
          status: String(quote.status ?? "pending"),
          total: safeNumber(quote.total),
          createdAt: String(quote.created_at ?? new Date().toISOString()),
        } satisfies QuoteSummary;
      }));
      setQuotes(quotesList.slice(0, 8));

      const appointmentList = (((appointmentsResponse.data as Array<Record<string, unknown>> | null) ?? []).map((appointment) => {
        const customer =
          appointment.customers && !Array.isArray(appointment.customers)
            ? (appointment.customers as Record<string, unknown>)
            : null;
        const rep =
          appointment.app_users && !Array.isArray(appointment.app_users)
            ? (appointment.app_users as Record<string, unknown>)
            : null;
        return {
          id: String(appointment.id ?? ""),
          slot: String(appointment.slot ?? ""),
          customerName: customerName(customer),
          address:
            [
              customer?.address,
              customer?.city,
              customer?.state,
              customer?.zip,
            ]
              .filter((value) => typeof value === "string" && value)
              .join(", ") || "Address unavailable",
          repName:
            [rep?.first_name, rep?.last_name]
              .filter((value) => typeof value === "string" && value)
              .join(" ") || "Sales rep",
          sold: Boolean(appointment.sold),
          saleAmount: safeNumber(appointment.sale_amount),
        } satisfies AppointmentSummary;
      }));

      setAppointments(
        appointmentList.filter((appointment, index) => {
          if (effectiveMode === "owner" || effectiveMode === "sales_manager" || effectiveMode === "marketing_manager") {
            return true;
          }
          if (effectiveMode === "sales_rep") {
            const raw = (appointmentsResponse.data as Array<Record<string, unknown>> | null)?.[index];
            return (
              String(raw?.assigned_to ?? "") === user?.id ||
              String(raw?.rep_user_id ?? "") === user?.id
            );
          }
          return index < 3;
        }),
      );

      const managerTeamUsers =
        effectiveMode === "sales_manager" && user?.location
          ? users.filter((person) => person.location === user.location)
          : users;

      const performanceRows = await Promise.all(
        managerTeamUsers
          .filter((person) => ["Sales Rep", "Sales Manager"].includes(person.roleName))
          .map(async (person) => {
            const [ratio, avgSaleMetric, nsliMetric, soldRevenue] = await Promise.all([
              getCloseRatio(person.id),
              getAverageSale(person.id),
              getNSLI(person.id),
              getRevenue(person.id, "mtd"),
            ]);
            return {
              id: person.id,
              name: person.fullName,
              initials: initials(person.fullName),
              closeRatio: ratio.ratio,
              averageSale: avgSaleMetric.average,
              nsli: nsliMetric.nsli,
              totalSold: soldRevenue,
            } satisfies TeamPerformanceRow;
          }),
      );
      setTeamPerformance(performanceRows);

      setTeamStatus(
        users
          .filter((person) => person.roleName === "Installer")
          .map((person, index) => ({
            id: person.id,
            name: person.fullName,
            status: index % 2 === 0 ? "On install" : "Available",
            detail: index % 2 === 0 ? "Assigned to field job" : "Waiting for next dispatch",
          })),
      );

      const projectRows =
        (projectsResponse.data as Array<{ location?: string | null; total_amount?: number | null; gross_profit?: number | null; cogs?: number | null; labor_cost?: number | null; commission?: number | null; status?: string | null }> | null) ?? [];
      setLocationComparison([
        {
          name: "Ellsworth",
          revenue: projectRows
            .filter((row) => row.location === "Ellsworth")
            .reduce((sum, row) => sum + safeNumber(row.total_amount), 0),
        },
        {
          name: "Lindsay",
          revenue: projectRows
            .filter((row) => row.location === "Lindsay")
            .reduce((sum, row) => sum + safeNumber(row.total_amount), 0),
        },
      ]);

      const weeklyBuckets = [1, 2, 3, 4].map((week) => ({
        label: `Week ${week}`,
        value: 0,
      }));
      appointmentList.forEach((appointment, index) => {
        const raw = (appointmentsResponse.data as Array<Record<string, unknown>> | null)?.[index];
        const dateValue = String(raw?.scheduled_at ?? raw?.date ?? "");
        const week = weekNumberInMonth(dateValue);
        weeklyBuckets[week - 1].value += appointment.sold ? appointment.saleAmount : 0;
      });
      setSalesByWeek(weeklyBuckets);
      setLeadSources(leadsBreakdown);

      if (user && pins.length > 0) {
        const pinned = await Promise.all(
          pins.map(async (pin) => {
            const definition = kpiDefinitions.find((item) => item.key === pin.kpi_key);
            if (!definition) {
              return null;
            }
            const [value, trend] = await Promise.all([
              getKpiValue(pin.kpi_key, user.id),
              getKpiTrend(pin.kpi_key, user.id),
            ]);
            return {
              id: pin.id,
              key: pin.kpi_key,
              definition,
              value: safeNumber(value.value),
              trend: safeNumber(trend),
            } satisfies PinnedCard;
          }),
        );
        setPinnedCards(pinned.filter(Boolean) as PinnedCard[]);
      } else {
        setPinnedCards([]);
      }

      const monthlyGoalTarget =
        effectiveMode === "sales_rep"
          ? Math.max(revenueGoal.target * 0.25, 70000)
          : revenueGoal.target;
      setRepGoalAmount(monthlyGoalTarget);

      const quotesChangeBase = quoteStats.prevCount || 1;
      const revenueChange = filteredPrevRevenue > 0 ? ((revenueMtd - filteredPrevRevenue) / filteredPrevRevenue) * 100 : 0;
      const quoteChange = ((quoteStats.monthCount - quoteStats.prevCount) / quotesChangeBase) * 100;

      if (effectiveMode === "marketing_manager") {
        setMetrics([
          {
            label: "Total leads this month",
            value: String(leadsMetricSet.leads),
            detail: `${leadsMetricSet.previousLeads > 0 ? (((leadsMetricSet.leads - leadsMetricSet.previousLeads) / leadsMetricSet.previousLeads) * 100).toFixed(1) : "0.0"}% vs last month`,
          },
          {
            label: "Booking rate",
            value: formatKpiValue(leadsMetricSet.bookingRate, "percent"),
            detail: "Leads that became appointments",
            tone: leadsMetricSet.bookingRate >= 0.5 ? "green" : leadsMetricSet.bookingRate >= 0.4 ? "amber" : "red",
          },
          {
            label: "Demo rate",
            value: formatKpiValue(leadsMetricSet.demoRate, "percent"),
            detail: "Appointments run vs booked",
            tone: leadsMetricSet.demoRate >= 0.7 ? "green" : leadsMetricSet.demoRate >= 0.6 ? "amber" : "red",
          },
          {
            label: "Lead to close rate",
            value: formatKpiValue(leadsMetricSet.leadToClose, "percent"),
            detail: "Sales vs total leads",
            tone: leadsMetricSet.leadToClose >= 0.3 ? "green" : leadsMetricSet.leadToClose >= 0.2 ? "amber" : "red",
          },
        ]);
      } else if (effectiveMode === "installer") {
        setMetrics([
          {
            label: "Jobs completed this month",
            value: String(jobsStats.completed),
            detail: "Completed installations this month",
          },
          {
            label: "Average job time",
            value: `${jobsStats.averageHours.toFixed(1)}h`,
            detail: "Average install duration",
          },
          {
            label: "Labor hours",
            value: `${(jobsStats.laborMinutes / 60).toFixed(1)}h`,
            detail: "Tracked time on jobs",
          },
          {
            label: "Recent sign-offs",
            value: String(
              (((signOffsResponse.data as Array<{ installer_id?: string | null }> | null) ?? []).filter(
                (item) => item.installer_id === user?.id,
              )).length,
            ),
            detail: "Customer sign-offs completed",
          },
        ]);
      } else if (effectiveMode === "sales_rep") {
        setMetrics([
          {
            label: "My close ratio",
            value: formatKpiValue(closeRatio.ratio, "percent"),
            detail: `${closeRatio.sold} of ${closeRatio.total} leads closed`,
            tone: closeRatio.ratio >= 0.48 ? "green" : closeRatio.ratio >= 0.38 ? "amber" : "red",
          },
          {
            label: "My average sale",
            value: formatKpiValue(averageSale.average, "currency"),
            detail: "Target $7,000 average sale",
            tone: averageSale.average >= 7000 ? "green" : averageSale.average >= 6300 ? "amber" : "red",
          },
          {
            label: "My NSLI",
            value: formatKpiValue(nsli.nsli, "currency"),
            detail: "Total sold ÷ leads issued",
          },
          {
            label: "My total sold MTD",
            value: formatKpiValue(revenueMtd, "currency"),
            detail: `${formatKpiValue(Math.max(monthlyGoalTarget - revenueMtd, 0), "currency")} to goal`,
            tone: revenueMtd >= monthlyGoalTarget ? "green" : revenueMtd >= monthlyGoalTarget * 0.9 ? "amber" : "red",
          },
        ]);
      } else if (effectiveMode === "sales_manager") {
        setMetrics([
          {
            label: "Revenue MTD",
            value: formatKpiValue(revenueMtd, "currency"),
            detail: `${revenueChange.toFixed(1)}% vs last month`,
            tone: revenueChange >= 0 ? "green" : revenueChange >= -10 ? "amber" : "red",
          },
          {
            label: "Quotes this month",
            value: String(quoteStats.monthCount),
            detail: `${quoteChange.toFixed(1)}% vs last month`,
          },
          {
            label: "Pipeline value",
            value: formatKpiValue(pipeline, "currency"),
            detail: "Open quote value × current close rate",
          },
          {
            label: "Follow-up needed",
            value: String(followUpNeeded),
            detail: "Quotes older than 7 days with no activity",
            tone: followUpNeeded > 0 ? "amber" : "default",
          },
        ]);
      } else {
        setMetrics([
          {
            label: "Revenue MTD",
            value: formatKpiValue(revenueGoal.actual, "currency"),
            detail: `${revenueChange.toFixed(1)}% vs last month`,
            tone: revenueChange >= 0 ? "green" : revenueChange >= -10 ? "amber" : "red",
          },
          {
            label: "Quotes this month",
            value: String(quoteStats.monthCount),
            detail: `${quoteChange.toFixed(1)}% vs last month`,
          },
          {
            label: "Jobs completed this month",
            value: String(jobsStats.completed),
            detail: `${jobsStats.averageHours.toFixed(1)} avg hours per job`,
          },
          {
            label: "Open quotes",
            value: String(quoteStats.openQuotes),
            detail: `${quoteStats.expiringSoon} expiring soon`,
            tone: quoteStats.expiringSoon > 0 ? "amber" : "default",
          },
        ]);
      }

      void businessSettingsResponse;
      setLoading(false);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  const teamRowsForManager = useMemo(() => {
    if (!currentUser || mode !== "sales_manager") return teamPerformance;
    return teamPerformance.filter((row) => {
      const matchingUser = activeUsers.find((person) => person.id === row.id);
      return matchingUser?.location === currentUser.location;
    });
  }, [activeUsers, currentUser, mode, teamPerformance]);

  async function unpin(id: string) {
    await supabase.from("user_dashboard_pins").delete().eq("id", id);
    setPinnedCards((current) => current.filter((card) => card.id !== id));
  }

  const ownerManagerRows = mode === "sales_manager" ? teamRowsForManager : teamPerformance;

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Dashboard" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar title="Dashboard" actionLabel="New quote" actionHref="/quotes/new" />

        <div className="flex-1 space-y-8 p-8">
          <PinnedKpisRow cards={pinnedCards} onUnpin={unpin} />

          {loading ? (
            <div className="grid gap-5 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-36 animate-pulse rounded-2xl border border-stone-200 bg-white"
                />
              ))}
            </div>
          ) : (
            <MetricGrid metrics={metrics} />
          )}

          {mode === "owner" ? (
            <>
              <SummaryCard title={`${monthLabel()} Revenue Goal: ${formatKpiValue(goal.target, "currency")}`}>
                <div className="h-4 rounded-full bg-stone-100">
                  <div
                    className="h-4 rounded-full"
                    style={{
                      width: `${Math.min(goal.percentage * 100, 100)}%`,
                      backgroundColor: progressColor(goal.percentage),
                    }}
                  />
                </div>
                <p className="mt-4 text-sm text-stone-600">
                  {formatKpiValue(goal.actual, "currency")} of {formatKpiValue(goal.target, "currency")} ·{" "}
                  {(goal.percentage * 100).toFixed(1)}% · {formatKpiValue(Math.max(goal.target - goal.actual, 0), "currency")} to go
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {[
                    { label: "Ellsworth", value: goal.ellsworth, color: "#FF4900" },
                    { label: "Lindsay", value: goal.lindsay, color: "#2DA44E" },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-sm text-stone-500">
                        <span>{item.label}</span>
                        <span>{formatKpiValue(item.value, "currency")}</span>
                      </div>
                      <div className="mt-2 h-3 rounded-full bg-stone-100">
                        <div
                          className="h-3 rounded-full"
                          style={{
                            width: `${goal.actual > 0 ? (item.value / goal.actual) * 100 : 0}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </SummaryCard>

              <div className="grid gap-5 xl:grid-cols-[1.2fr_0.9fr]">
                <div className="space-y-5">
                  <SummaryCard
                    title="Today's appointments"
                    action={<Link href="/calendar" className="text-sm font-medium text-primary">View all</Link>}
                  >
                    <div className="space-y-3">
                      {appointments.length > 0 ? (
                        appointments.map((appointment) => (
                          <div key={appointment.id} className="rounded-2xl bg-stone-50 px-4 py-4">
                            <p className="font-medium text-stone-950">
                              {appointment.slot} · {appointment.customerName}
                            </p>
                            <p className="mt-1 text-sm text-stone-500">{appointment.address}</p>
                            <p className="mt-1 text-xs text-stone-400">{appointment.repName}</p>
                          </div>
                        ))
                      ) : (
                        <EmptyState>No appointments scheduled for today.</EmptyState>
                      )}
                    </div>
                  </SummaryCard>

                  <SummaryCard title="Recent quotes">
                    <div className="space-y-3">
                      {quotes.slice(0, 5).map((quote) => (
                        <div key={quote.id} className="flex items-center justify-between rounded-2xl bg-stone-50 px-4 py-4">
                          <div>
                            <p className="font-medium text-stone-950">{quote.customerName}</p>
                            <p className="mt-1 text-sm text-stone-500">{formatDate(quote.createdAt)}</p>
                          </div>
                          <div className="text-right">
                            <Badge
                              label={quote.status}
                              tone={quote.status === "pending" ? "lead" : quote.status === "ordered" ? "active" : "customer"}
                            />
                            <p className="mt-2 text-sm font-medium text-stone-700">
                              {formatKpiValue(quote.total, "currency")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </SummaryCard>
                </div>

                <div className="space-y-5">
                  <SummaryCard title="Team performance">
                    <div className="space-y-3">
                      {ownerManagerRows.map((person) => (
                        <div key={person.id} className="grid grid-cols-[56px_1fr] gap-3 rounded-2xl bg-stone-50 px-4 py-4">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-semibold text-stone-600">
                            {person.initials}
                          </div>
                          <div>
                            <p className="font-medium text-stone-950">{person.name}</p>
                            <div className="mt-2 grid gap-2 text-sm md:grid-cols-4">
                              <span className={metricToneClass(person.closeRatio >= 0.48 ? "green" : person.closeRatio >= 0.38 ? "amber" : "red")}>
                                Close {formatKpiValue(person.closeRatio, "percent")}
                              </span>
                              <span className={metricToneClass(person.averageSale >= 7000 ? "green" : person.averageSale >= 6300 ? "amber" : "red")}>
                                Avg {formatKpiValue(person.averageSale, "currency")}
                              </span>
                              <span>NSLI {formatKpiValue(person.nsli, "currency")}</span>
                              <span>Sold {formatKpiValue(person.totalSold, "currency")}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </SummaryCard>

                  <SummaryCard title="Team status">
                    <div className="space-y-3">
                      {teamStatus.map((installer) => (
                        <div key={installer.id} className="rounded-2xl bg-stone-50 px-4 py-4">
                          <p className="font-medium text-stone-950">{installer.name}</p>
                          <p className="mt-1 text-sm text-stone-500">{installer.detail}</p>
                          <p className="mt-2 text-xs font-medium text-primary">{installer.status}</p>
                        </div>
                      ))}
                    </div>
                  </SummaryCard>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-3">
                <SummaryCard title="Sales by week">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={salesByWeek}>
                        <XAxis dataKey="label" />
                        <YAxis hide />
                        <Tooltip formatter={formatCurrencyTooltip} />
                        <Bar dataKey="value" fill="#FF4900" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </SummaryCard>

                <SummaryCard title="Lead sources">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={leadSources} dataKey="leads" nameKey="source" innerRadius={60} outerRadius={90}>
                          {leadSources.map((entry, index) => (
                            <Cell key={entry.source} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </SummaryCard>

                <SummaryCard title="Location comparison">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={locationComparison}>
                        <XAxis dataKey="name" />
                        <YAxis hide />
                        <Tooltip formatter={formatCurrencyTooltip} />
                        <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                          {locationComparison.map((entry) => (
                            <Cell key={entry.name} fill={entry.name === "Ellsworth" ? "#FF4900" : "#2DA44E"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </SummaryCard>
              </div>
            </>
          ) : null}

          {mode === "sales_manager" ? (
            <>
              <div className="grid gap-5 xl:grid-cols-[1.2fr_0.9fr]">
                <div className="space-y-5">
                  <SummaryCard
                    title="Today's appointments"
                    action={<Link href="/calendar" className="text-sm font-medium text-primary">View all</Link>}
                  >
                    <div className="space-y-3">
                      {appointments.length > 0 ? (
                        appointments.map((appointment) => (
                          <div key={appointment.id} className="rounded-2xl bg-stone-50 px-4 py-4">
                            <p className="font-medium text-stone-950">
                              {appointment.slot} · {appointment.customerName}
                            </p>
                            <p className="mt-1 text-sm text-stone-500">{appointment.address}</p>
                            <p className="mt-1 text-xs text-stone-400">{appointment.repName}</p>
                          </div>
                        ))
                      ) : (
                        <EmptyState>No appointments scheduled for today.</EmptyState>
                      )}
                    </div>
                  </SummaryCard>

                  <SummaryCard title="Recent quotes">
                    <div className="space-y-3">
                      {quotes.slice(0, 5).map((quote) => (
                        <div key={quote.id} className="rounded-2xl bg-stone-50 px-4 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-stone-950">{quote.customerName}</p>
                              <p className="mt-1 text-sm text-stone-500">{formatDate(quote.createdAt)}</p>
                            </div>
                            <Badge label={quote.status} tone={quote.status === "pending" ? "lead" : "customer"} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </SummaryCard>
                </div>

                <div className="space-y-5">
                  <SummaryCard title="Team performance">
                    <div className="space-y-3">
                      {teamRowsForManager.map((person) => (
                        <div key={person.id} className="rounded-2xl bg-stone-50 px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-semibold text-stone-600">
                              {person.initials}
                            </div>
                            <div>
                              <p className="font-medium text-stone-950">{person.name}</p>
                              <p className="mt-1 text-sm text-stone-500">
                                Close {formatKpiValue(person.closeRatio, "percent")} · Avg {formatKpiValue(person.averageSale, "currency")}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </SummaryCard>

                  <SummaryCard title="Team status">
                    <div className="space-y-3">
                      {teamStatus.map((installer) => (
                        <div key={installer.id} className="rounded-2xl bg-stone-50 px-4 py-4">
                          <p className="font-medium text-stone-950">{installer.name}</p>
                          <p className="mt-1 text-sm text-stone-500">{installer.detail}</p>
                        </div>
                      ))}
                    </div>
                  </SummaryCard>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <SummaryCard title="Sales by week">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={salesByWeek}>
                        <XAxis dataKey="label" />
                        <YAxis hide />
                        <Tooltip formatter={formatCurrencyTooltip} />
                        <Bar dataKey="value" fill="#FF4900" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </SummaryCard>

                <SummaryCard title="Lead sources">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={leadSources} dataKey="leads" nameKey="source" innerRadius={60} outerRadius={90}>
                          {leadSources.map((entry, index) => (
                            <Cell key={entry.source} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </SummaryCard>
              </div>
            </>
          ) : null}

          {mode === "sales_rep" ? (
            <>
              <div className="grid gap-5 xl:grid-cols-3">
                <SummaryCard title="My appointments today">
                  <div className="space-y-3">
                    {appointments.length > 0 ? (
                      appointments.map((appointment) => (
                        <div key={appointment.id} className="rounded-2xl bg-stone-50 px-4 py-4">
                          <p className="font-medium text-stone-950">
                            {appointment.slot} · {appointment.customerName}
                          </p>
                          <p className="mt-1 text-sm text-stone-500">{appointment.address}</p>
                        </div>
                      ))
                    ) : (
                      <EmptyState>No appointments scheduled for you today.</EmptyState>
                    )}
                  </div>
                </SummaryCard>

                <SummaryCard title="My open quotes">
                  <div className="space-y-3">
                    {quotes
                      .filter((quote) => quote.status === "pending")
                      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                      .slice(0, 5)
                      .map((quote) => (
                        <div key={quote.id} className="rounded-2xl bg-stone-50 px-4 py-4">
                          <p className="font-medium text-stone-950">{quote.customerName}</p>
                          <p className="mt-1 text-sm text-stone-500">Created {formatDate(quote.createdAt)}</p>
                        </div>
                      ))}
                  </div>
                </SummaryCard>

                <SummaryCard title="My recent sales">
                  <div className="space-y-3">
                    {appointments
                      .filter((appointment) => appointment.sold)
                      .slice(0, 5)
                      .map((appointment) => (
                        <div key={appointment.id} className="rounded-2xl bg-stone-50 px-4 py-4">
                          <p className="font-medium text-stone-950">{appointment.customerName}</p>
                          <p className="mt-1 text-sm text-stone-500">{appointment.slot}</p>
                          <p className="mt-2 text-sm font-medium text-primary">
                            {formatKpiValue(appointment.saleAmount, "currency")}
                          </p>
                        </div>
                      ))}
                  </div>
                </SummaryCard>
              </div>

              <SummaryCard title="My goal progress">
                <div className="h-4 rounded-full bg-stone-100">
                  <div
                    className="h-4 rounded-full bg-primary"
                    style={{
                      width: `${Math.min((safeNumber(metrics[3]?.value?.replace?.(/[^\d.-]/g, "") ?? 0) / Math.max(repGoalAmount, 1)) * 100, 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-4 text-sm text-stone-600">
                  You need {formatKpiValue(Math.max(repGoalAmount - (currentUser ? safeNumber(metrics[3]?.value?.replace?.(/[^\d.-]/g, "") ?? 0) : 0), 0), "currency")} more to hit your goal this month
                </p>
              </SummaryCard>
            </>
          ) : null}

          {mode === "installer" ? (
            <div className="grid gap-5 xl:grid-cols-3">
              <SummaryCard title="Today's jobs">
                <div className="space-y-3">
                  {appointments.slice(0, 5).map((appointment) => (
                    <div key={appointment.id} className="rounded-2xl bg-stone-50 px-4 py-4">
                      <p className="font-medium text-stone-950">{appointment.customerName}</p>
                      <p className="mt-1 text-sm text-stone-500">{appointment.address}</p>
                      <p className="mt-1 text-xs text-stone-400">{appointment.slot}</p>
                    </div>
                  ))}
                </div>
              </SummaryCard>

              <SummaryCard title="My stats this month">
                <div className="space-y-4 text-sm text-stone-500">
                  <p>
                    Jobs completed: <span className="font-semibold text-stone-950">{installerStats.completed}</span>
                  </p>
                  <p>
                    Average job time: <span className="font-semibold text-stone-950">{installerStats.averageHours.toFixed(1)}h</span>
                  </p>
                  <p>
                    Labor hours: <span className="font-semibold text-stone-950">{installerStats.laborHours.toFixed(1)}h</span>
                  </p>
                </div>
              </SummaryCard>

              <SummaryCard title="My recent sign-offs">
                <div className="space-y-3">
                  {recentSignOffs.map((signOff) => (
                    <div key={signOff.id} className="rounded-2xl bg-stone-50 px-4 py-4">
                      <p className="font-medium text-stone-950">{signOff.customerName}</p>
                      <p className="mt-1 text-sm text-stone-500">{formatDate(signOff.signedAt)}</p>
                    </div>
                  ))}
                </div>
              </SummaryCard>
            </div>
          ) : null}

          {mode === "marketing_manager" ? (
            <>
              <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
                <SummaryCard title="Lead source breakdown">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={leadSources}>
                        <XAxis dataKey="source" hide />
                        <YAxis hide />
                        <Tooltip />
                        <Bar dataKey="leads" fill="#FF4900" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </SummaryCard>

                <SummaryCard title="Revenue by source">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={leadSources}>
                        <XAxis dataKey="source" hide />
                        <YAxis hide />
                        <Tooltip formatter={formatCurrencyTooltip} />
                        <Bar dataKey="revenue" fill="#2DA44E" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </SummaryCard>
              </div>

              <SummaryCard title="Campaign performance">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-stone-400">
                      <tr>
                        <th className="pb-3 font-medium">Source</th>
                        <th className="pb-3 font-medium">Leads</th>
                        <th className="pb-3 font-medium">Appointments</th>
                        <th className="pb-3 font-medium">Sales</th>
                        <th className="pb-3 font-medium">Revenue</th>
                        <th className="pb-3 font-medium">Cost</th>
                        <th className="pb-3 font-medium">CPL</th>
                        <th className="pb-3 font-medium">ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadSources.map((row) => (
                        <tr key={row.source} className="border-t border-stone-100 text-stone-600">
                          <td className="py-3 font-medium text-stone-950">{row.source}</td>
                          <td className="py-3">{row.leads}</td>
                          <td className="py-3">{row.appointments}</td>
                          <td className="py-3">{row.sales}</td>
                          <td className="py-3">{formatKpiValue(row.revenue, "currency")}</td>
                          <td className="py-3">{formatKpiValue(row.cost, "currency")}</td>
                          <td className="py-3">{formatKpiValue(row.cpl, "currency")}</td>
                          <td className={`py-3 ${row.roi >= 0 ? "text-[#2DA44E]" : "text-[#A32D2D]"}`}>
                            {(row.roi * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SummaryCard>
            </>
          ) : null}

          {mode !== "installer" && mode !== "marketing_manager" && mode !== "sales_rep" ? (
            <SummaryCard title="Financial snapshot">
              <div className="grid gap-5 md:grid-cols-3">
                <div className="rounded-2xl bg-stone-50 px-4 py-4">
                  <p className="text-sm text-stone-500">Gross profit MTD</p>
                  <p className="mt-2 text-2xl font-semibold text-stone-950">
                    {formatKpiValue(grossProfitMtd, "currency")}
                  </p>
                </div>
                <div className="rounded-2xl bg-stone-50 px-4 py-4">
                  <p className="text-sm text-stone-500">Average gross margin</p>
                  <p className="mt-2 text-2xl font-semibold text-stone-950">
                    {formatKpiValue(avgGrossMargin, "percent")}
                  </p>
                </div>
                <div className="rounded-2xl bg-stone-50 px-4 py-4">
                  <p className="text-sm text-stone-500">Pipeline value</p>
                  <p className="mt-2 text-2xl font-semibold text-stone-950">
                    {formatKpiValue(pipelineValue, "currency")}
                  </p>
                </div>
              </div>
            </SummaryCard>
          ) : null}
        </div>
      </section>
    </main>
  );
}
