export const APPOINTMENT_SLOTS = [
  { key: "AM", label: "AM", timeRange: "9:00 AM - 10:30 AM", shortTime: "9:00 AM" },
  { key: "MID", label: "MID", timeRange: "12:00 PM - 1:30 PM", shortTime: "12:00 PM" },
  { key: "PM", label: "PM", timeRange: "3:00 PM - 4:30 PM", shortTime: "3:00 PM" },
] as const;

export type AppointmentSlotKey = (typeof APPOINTMENT_SLOTS)[number]["key"];

export const INTEREST_OPTIONS = [
  "Blinds",
  "Shutters",
  "Shades",
  "Drapery",
  "Other",
] as const;

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function toDateKey(date: Date | string) {
  const normalized = typeof date === "string" ? new Date(date) : date;
  return normalized.toISOString().slice(0, 10);
}

export function fromDateKey(value: string) {
  return new Date(`${value}T12:00:00`);
}

export function isSunday(date: Date) {
  return date.getDay() === 0;
}

export function isWorkingDay(date: Date) {
  return date.getDay() >= 1 && date.getDay() <= 6;
}

export function getMonday(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function getMonthGrid(baseDate: Date) {
  const firstOfMonth = startOfMonth(baseDate);
  const firstGridDate = getMonday(firstOfMonth);
  const days: Date[] = [];

  let cursor = new Date(firstGridDate);
  while (days.length < 36) {
    if (isWorkingDay(cursor)) {
      days.push(new Date(cursor));
    }
    cursor = addDays(cursor, 1);
  }

  return days;
}

export function getWeekDays(baseDate: Date) {
  const monday = getMonday(baseDate);
  const days: Date[] = [];
  for (let index = 0; index < 6; index += 1) {
    days.push(addDays(monday, index));
  }
  return days;
}

export function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function formatDayLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatCompactDate(date: Date | string) {
  const normalized = typeof date === "string" ? new Date(date) : date;
  return normalized.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function getRoleDefaultCalendarView(roleName: string) {
  return roleName === "Installer" ? "install" : "appointments";
}

export function createSlotRecord(date: string, slot: AppointmentSlotKey) {
  return { date, slot };
}
