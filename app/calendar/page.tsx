"use client";

import Link from "next/link";
import { Fragment } from "react";
import { DragEvent, useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { getActiveAppUsers, getCurrentAppUser, type ActiveAppUser, type CurrentAppUser } from "@/lib/current-app-user";
import {
  addDays,
  addMonths,
  APPOINTMENT_SLOTS,
  createSlotRecord,
  formatCompactDate,
  formatDayLabel,
  formatMonthLabel,
  fromDateKey,
  getMonthGrid,
  getRoleDefaultCalendarView,
  getWeekDays,
  INTEREST_OPTIONS,
  toDateKey,
  type AppointmentSlotKey,
} from "@/lib/calendar";
import { sampleProjects } from "@/lib/project-samples";
import { supabase } from "@/lib/supabase";
import { sendSMS } from "@/lib/twilio";

type CalendarMode = "appointments" | "install";
type AppointmentViewMode = "month" | "week" | "day";

type AppointmentItem = {
  id: string;
  date: string;
  slot: AppointmentSlotKey;
  location: string;
  notes: string;
  interestedIn: string;
  customerId: string;
  customerName: string;
  address: string;
  repUserId: string;
  repName: string;
};

type AvailabilitySlot = {
  id: string;
  date: string;
  slot: AppointmentSlotKey;
  location: string;
  status: string;
  repUserId: string;
  repName: string;
};

type CustomerOption = {
  id: string;
  name: string;
  phone: string;
  address: string;
};

type InstallJob = {
  id: string;
  customerName: string;
  address: string;
  gateCode?: string;
  jobType: string;
  date: string;
  time: string;
  installerId?: string;
  installerName?: string;
  location: string;
  quoteLines: Array<{
    id: string;
    room: string;
    productName: string;
    color: string;
    liftOption: string;
    quantity?: number;
  }>;
};

type BookingDraft = {
  date: string;
  slot: AppointmentSlotKey;
  location: string;
  customerId: string;
  customerSearch: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  repUserId: string;
  interestedIn: string;
  notes: string;
};

function getFullName(user: ActiveAppUser) {
  return user.fullName;
}

function getCustomerName(record: Record<string, unknown> | null | undefined) {
  if (!record) {
    return "Unknown customer";
  }

  const name = typeof record.name === "string" ? record.name : "";
  const first = typeof record.first_name === "string" ? record.first_name : "";
  const last = typeof record.last_name === "string" ? record.last_name : "";
  return name || [first, last].filter(Boolean).join(" ") || "Unknown customer";
}

function getSlotColor(slot: AppointmentSlotKey) {
  if (slot === "AM") {
    return "bg-sky-500";
  }

  if (slot === "MID") {
    return "bg-amber-500";
  }

  return "bg-primary";
}

function getInstallBadge(jobType: string) {
  if (jobType === "Motorized") {
    return "bg-violet-100 text-violet-700";
  }

  if (jobType === "Repair") {
    return "bg-amber-100 text-amber-700";
  }

  if (jobType === "Commercial") {
    return "bg-stone-200 text-stone-700";
  }

  return "bg-orange-100 text-orange-700";
}

function getRoleCanSubmitAvailability(roleName: string) {
  return roleName === "Sales Rep";
}

function getSampleAppointments(activeUsers: ActiveAppUser[]) {
  const salesReps = activeUsers.filter((user) =>
    ["Sales Rep", "Sales Manager", "Appointment Setter", "Owner", "Office Manager"].includes(
      user.roleName,
    ),
  );
  const today = new Date();
  const tomorrow = addDays(today, 1);

  return [
    {
      id: "sample-apt-1",
      date: toDateKey(today),
      slot: "AM" as AppointmentSlotKey,
      location: "Ellsworth",
      notes: "Interested in cellular shades",
      interestedIn: "Shades",
      customerId: "sample-customer-1",
      customerName: "Carter Residence",
      address: "245 S Main St, Ellsworth, KS 67439",
      repUserId: salesReps[0]?.id ?? "rep-1",
      repName: salesReps[0]?.fullName ?? "Ava Chen",
    },
    {
      id: "sample-apt-2",
      date: toDateKey(today),
      slot: "PM" as AppointmentSlotKey,
      location: "Lindsay",
      notes: "Needs shutter consultation",
      interestedIn: "Shutters",
      customerId: "sample-customer-2",
      customerName: "Lindsay Orthodontics",
      address: "118 N Pine Ave, Lindsay, OK 73052",
      repUserId: salesReps[1]?.id ?? salesReps[0]?.id ?? "rep-2",
      repName: salesReps[1]?.fullName ?? salesReps[0]?.fullName ?? "Noah Patel",
    },
    {
      id: "sample-apt-3",
      date: toDateKey(tomorrow),
      slot: "MID" as AppointmentSlotKey,
      location: "Ellsworth",
      notes: "Looking at woven woods",
      interestedIn: "Blinds",
      customerId: "sample-customer-3",
      customerName: "Miller Repair Call",
      address: "487 Oak Crest Dr, Ellsworth, KS 67439",
      repUserId: salesReps[0]?.id ?? "rep-3",
      repName: salesReps[0]?.fullName ?? "Leah Brooks",
    },
  ];
}

function getSampleAvailability(activeUsers: ActiveAppUser[]) {
  const salesReps = activeUsers.filter((user) => user.roleName === "Sales Rep");
  const currentWeek = getWeekDays(new Date());
  return currentWeek.flatMap((day, index) =>
    APPOINTMENT_SLOTS.flatMap((slot, slotIndex) =>
      salesReps
        .filter((_user, userIndex) => (index + slotIndex + userIndex) % 2 === 0)
        .map((rep) => ({
          id: `slot-${rep.id}-${toDateKey(day)}-${slot.key}`,
          date: toDateKey(day),
          slot: slot.key,
          location: rep.location || "Ellsworth",
          status: "open",
          repUserId: rep.id,
          repName: rep.fullName,
        })),
    ),
  );
}

function getSampleInstallJobs() {
  return sampleProjects.map((project) => ({
    id: project.id,
    customerName: project.customerName,
    address: project.address,
    gateCode: project.gateCode,
    jobType: project.projectType,
    date:
      project.scheduledAt?.slice(0, 10) ??
      project.tasks
        .map((task) => task.dueDate.slice(0, 10))
        .sort()[0] ??
      toDateKey(new Date()),
    time: project.scheduledAt
      ? new Date(project.scheduledAt).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
      : "9:00 AM",
    installerId: undefined,
    installerName: project.assignedTeam.installer,
    location: project.location,
    quoteLines: project.quoteLines.map((line) => ({
      id: line.id,
      room: line.room,
      productName: line.productName,
      color: line.color,
      liftOption: line.liftOption,
      quantity: line.quantity,
    })),
  }));
}

export default function CalendarPage() {
  const [currentUser, setCurrentUser] = useState<CurrentAppUser | null>(null);
  const [users, setUsers] = useState<ActiveAppUser[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("appointments");
  const [appointmentView, setAppointmentView] = useState<AppointmentViewMode>("month");
  const [displayMonth, setDisplayMonth] = useState(new Date());
  const [installWeekStart, setInstallWeekStart] = useState(new Date());
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [installJobs, setInstallJobs] = useState<InstallJob[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedInstallJob, setSelectedInstallJob] = useState<InstallJob | null>(null);
  const [bookingDraft, setBookingDraft] = useState<BookingDraft | null>(null);
  const [availabilitySelection, setAvailabilitySelection] = useState<Record<string, boolean>>({});
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
  const [isSubmittingAvailability, setIsSubmittingAvailability] = useState(false);
  const [isSavingAppointment, setIsSavingAppointment] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadCalendarData() {
      const [appUser, activeUsers, customersResponse, appointmentsResponse, slotsResponse, projectsResponse] =
        await Promise.all([
          getCurrentAppUser(),
          getActiveAppUsers(),
          supabase
            .from("customers")
            .select("id, name, first_name, last_name, phone, address, city, state, zip")
            .order("created_at", { ascending: false }),
          supabase
            .from("appointments")
            .select(`
              *,
              customers (
                id,
                name,
                first_name,
                last_name,
                address,
                city,
                state,
                zip
              ),
              app_users (
                id,
                first_name,
                last_name
              )
            `),
          supabase
            .from("appointment_slots")
            .select(`
              *,
              app_users (
                id,
                first_name,
                last_name
              )
            `),
          supabase
            .from("projects")
            .select(`
              *,
              customers (
                id,
                name,
                first_name,
                last_name,
                address,
                city,
                state,
                zip,
                gate_code
              ),
              quote_lines (
                id,
                room,
                product_name,
                color,
                lift_option_name,
                quantity
              ),
              app_users!projects_assigned_installer_id_fkey (
                id,
                first_name,
                last_name
              )
            `),
        ]);

      setCurrentUser(appUser);
      setUsers(activeUsers);
      setCalendarMode(getRoleDefaultCalendarView(appUser?.roleName ?? ""));

      const nextCustomers = ((customersResponse.data as Array<Record<string, unknown>> | null) ?? []).map(
        (customer) => ({
          id: String(customer.id),
          name: getCustomerName(customer),
          phone: String(customer.phone ?? ""),
          address: [
            customer.address,
            customer.city,
            customer.state,
            customer.zip,
          ]
            .filter((value) => typeof value === "string" && value)
            .join(", "),
        }),
      );
      setCustomers(nextCustomers);

      const nextAppointments = ((appointmentsResponse.data as Array<Record<string, unknown>> | null) ?? []).map(
        (appointment) => {
          const customer =
            appointment.customers && !Array.isArray(appointment.customers)
              ? (appointment.customers as Record<string, unknown>)
              : null;
          const rep =
            appointment.app_users && !Array.isArray(appointment.app_users)
              ? (appointment.app_users as Record<string, unknown>)
              : null;

          return {
            id: String(appointment.id),
            date: String(appointment.date ?? toDateKey(new Date())),
            slot: String(appointment.slot ?? "AM") as AppointmentSlotKey,
            location: String(appointment.location ?? "Ellsworth"),
            notes: String(appointment.notes ?? ""),
            interestedIn: String(appointment.interested_in ?? ""),
            customerId: String(appointment.customer_id ?? ""),
            customerName: getCustomerName(customer),
            address:
              [
                customer?.address,
                customer?.city,
                customer?.state,
                customer?.zip,
              ]
                .filter((value) => typeof value === "string" && value)
                .join(", ") || String(appointment.address ?? "Address unavailable"),
            repUserId: String(appointment.rep_user_id ?? ""),
            repName:
              [rep?.first_name, rep?.last_name]
                .filter((value) => typeof value === "string" && value)
                .join(" ") || "Sales rep",
          } satisfies AppointmentItem;
        },
      );
      setAppointments(nextAppointments.length > 0 ? nextAppointments : getSampleAppointments(activeUsers));

      const nextSlots = ((slotsResponse.data as Array<Record<string, unknown>> | null) ?? []).map((slot) => {
        const rep =
          slot.app_users && !Array.isArray(slot.app_users)
            ? (slot.app_users as Record<string, unknown>)
            : null;
        return {
          id: String(slot.id),
          date: String(slot.date),
          slot: String(slot.slot) as AppointmentSlotKey,
          location: String(slot.location ?? "Ellsworth"),
          status: String(slot.status ?? "open"),
          repUserId: String(slot.rep_user_id ?? rep?.id ?? ""),
          repName:
            [rep?.first_name, rep?.last_name]
              .filter((value) => typeof value === "string" && value)
              .join(" ") || "Sales rep",
        } satisfies AvailabilitySlot;
      });
      setAvailabilitySlots(nextSlots.length > 0 ? nextSlots : getSampleAvailability(activeUsers));

      const nextJobs = ((projectsResponse.data as Array<Record<string, unknown>> | null) ?? []).map((project) => {
        const customer =
          project.customers && !Array.isArray(project.customers)
            ? (project.customers as Record<string, unknown>)
            : null;
        const installer =
          project.app_users && !Array.isArray(project.app_users)
            ? (project.app_users as Record<string, unknown>)
            : null;
        const quoteLines = Array.isArray(project.quote_lines)
          ? (project.quote_lines as Array<Record<string, unknown>>)
          : [];

        return {
          id: String(project.id),
          customerName: getCustomerName(customer),
          address:
            [
              customer?.address,
              customer?.city,
              customer?.state,
              customer?.zip,
            ]
              .filter((value) => typeof value === "string" && value)
              .join(", ") || "Address unavailable",
          gateCode: typeof customer?.gate_code === "string" ? customer.gate_code : undefined,
          jobType: String(project.project_type ?? "Standard Install"),
          date: String(project.scheduled_at ?? new Date().toISOString()).slice(0, 10),
          time: new Date(String(project.scheduled_at ?? new Date().toISOString())).toLocaleTimeString(
            "en-US",
            {
              hour: "numeric",
              minute: "2-digit",
            },
          ),
          installerId: String(project.assigned_installer_id ?? installer?.id ?? ""),
          installerName:
            [installer?.first_name, installer?.last_name]
              .filter((value) => typeof value === "string" && value)
              .join(" ") || undefined,
          location: String(project.location ?? "Ellsworth"),
          quoteLines: quoteLines.map((line) => ({
            id: String(line.id),
            room: String(line.room ?? ""),
            productName: String(line.product_name ?? "Window treatment"),
            color: String(line.color ?? ""),
            liftOption: String(line.lift_option_name ?? ""),
            quantity: Number(line.quantity ?? 1),
          })),
        } satisfies InstallJob;
      });
      setInstallJobs(nextJobs.length > 0 ? nextJobs : getSampleInstallJobs());
    }

    void loadCalendarData();
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadMonthAvailability() {
      const monthStart = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
      const monthEnd = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0);

      const { data } = await supabase
        .from("appointment_slots")
        .select(`
          *,
          app_users (
            id,
            first_name,
            last_name
          )
        `)
        .gte("date", toDateKey(monthStart))
        .lte("date", toDateKey(monthEnd));

      if (!isMounted) {
        return;
      }

      const nextSlots = ((data as Array<Record<string, unknown>> | null) ?? []).map((slot) => {
        const rep =
          slot.app_users && !Array.isArray(slot.app_users)
            ? (slot.app_users as Record<string, unknown>)
            : null;
        return {
          id: String(slot.id),
          date: String(slot.date),
          slot: String(slot.slot) as AppointmentSlotKey,
          location: String(slot.location ?? "Ellsworth"),
          status: String(slot.status ?? "open"),
          repUserId: String(slot.rep_user_id ?? rep?.id ?? ""),
          repName:
            [rep?.first_name, rep?.last_name]
              .filter((value) => typeof value === "string" && value)
              .join(" ") || "Sales rep",
        } satisfies AvailabilitySlot;
      });

      if (nextSlots.length > 0) {
        setAvailabilitySlots((current) => {
          const otherMonths = current.filter((slot) => {
            const slotDate = new Date(slot.date);
            return (
              slotDate.getFullYear() !== displayMonth.getFullYear() ||
              slotDate.getMonth() !== displayMonth.getMonth()
            );
          });
          return [...otherMonths, ...nextSlots];
        });
      }
    }

    void loadMonthAvailability();

    return () => {
      isMounted = false;
    };
  }, [displayMonth]);

  const installers = useMemo(
    () => users.filter((user) => user.roleName === "Installer"),
    [users],
  );

  const monthDays = useMemo(() => getMonthGrid(displayMonth), [displayMonth]);
  const weekDays = useMemo(() => getWeekDays(displayMonth), [displayMonth]);
  const installDays = useMemo(() => getWeekDays(installWeekStart), [installWeekStart]);
  const nextMonth = useMemo(() => addMonths(new Date(), 1), []);
  const availabilityDays = useMemo(() => getMonthGrid(nextMonth), [nextMonth]);

  const selectedDayAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.date === selectedDay),
    [appointments, selectedDay],
  );
  const selectedDaySlots = useMemo(
    () => availabilitySlots.filter((slot) => slot.date === selectedDay),
    [availabilitySlots, selectedDay],
  );

  const availabilitySelectedCount = useMemo(
    () => Object.values(availabilitySelection).filter(Boolean).length,
    [availabilitySelection],
  );

  const appointmentCountsByDate = useMemo(() => {
    return appointments.reduce<Record<string, AppointmentItem[]>>((accumulator, appointment) => {
      accumulator[appointment.date] = [...(accumulator[appointment.date] ?? []), appointment];
      return accumulator;
    }, {});
  }, [appointments]);

  const availabilityByDate = useMemo(() => {
    return availabilitySlots.reduce<Record<string, AvailabilitySlot[]>>((accumulator, slot) => {
      accumulator[slot.date] = [...(accumulator[slot.date] ?? []), slot];
      return accumulator;
    }, {});
  }, [availabilitySlots]);

  const availabilityDotsByDate = useMemo(() => {
    return Object.fromEntries(
      Object.entries(availabilityByDate).map(([date, slots]) => {
        const slotMap = new Map<AppointmentSlotKey, string>();
        slots.forEach((slot) => {
          if (slot.status === "booked") {
            slotMap.set(slot.slot, "booked");
          } else if (!slotMap.has(slot.slot)) {
            slotMap.set(slot.slot, "open");
          }
        });
        return [date, Array.from(slotMap.entries())];
      }),
    ) as Record<string, Array<[AppointmentSlotKey, string]>>;
  }, [availabilityByDate]);

  const installJobsByCell = useMemo(() => {
    return installJobs.reduce<Record<string, InstallJob[]>>((accumulator, job) => {
      const key = `${job.installerId || "unassigned"}-${job.date}`;
      accumulator[key] = [...(accumulator[key] ?? []), job];
      return accumulator;
    }, {});
  }, [installJobs]);

  const appointmentDayList = appointmentView === "day" ? [selectedDay ? fromDateKey(selectedDay) : new Date()] : appointmentView === "week" ? weekDays : monthDays;

  const todaySubmissionWarning =
    getRoleCanSubmitAvailability(currentUser?.roleName ?? "") &&
    new Date().getDate() > 25 &&
    availabilitySelectedCount === 0;

  function openBooking(date: string, slot: AppointmentSlotKey, location: string) {
    setBookingDraft({
      date,
      slot,
      location,
      customerId: "",
      customerSearch: "",
      customerName: "",
      customerPhone: "",
      customerAddress: "",
      repUserId: "",
      interestedIn: "Blinds",
      notes: "",
    });
  }

  const matchingCustomers = useMemo(() => {
    if (!bookingDraft?.customerSearch) {
      return customers.slice(0, 6);
    }

    const query = bookingDraft.customerSearch.toLowerCase();
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(query) ||
        customer.phone.toLowerCase().includes(query),
    );
  }, [bookingDraft?.customerSearch, customers]);

  const availableRepsForBooking = useMemo(() => {
    if (!bookingDraft) {
      return [];
    }

    return availabilitySlots.filter(
      (slot) =>
        slot.date === bookingDraft.date &&
        slot.slot === bookingDraft.slot &&
        slot.status === "open" &&
        slot.location === bookingDraft.location,
    );
  }, [availabilitySlots, bookingDraft]);

  async function handleBookAppointment() {
    if (!bookingDraft || !bookingDraft.repUserId) {
      return;
    }

    setIsSavingAppointment(true);
    setMessage("");

    const response = await fetch("/api/appointments/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: bookingDraft.customerId || undefined,
        customerName: bookingDraft.customerName || bookingDraft.customerSearch,
        phone: bookingDraft.customerPhone,
        address: bookingDraft.customerAddress,
        repUserId: bookingDraft.repUserId,
        date: bookingDraft.date,
        slot: bookingDraft.slot,
        location: bookingDraft.location,
        interestedIn: bookingDraft.interestedIn,
        notes: bookingDraft.notes,
      }),
    });

    const result = (await response.json()) as { appointmentId?: string; error?: string };
    if (!response.ok) {
      setMessage(result.error || "Unable to book appointment.");
      setIsSavingAppointment(false);
      return;
    }

    const selectedCustomer =
      customers.find((customer) => customer.id === bookingDraft.customerId) ?? null;
    const selectedRep = availableRepsForBooking.find(
      (rep) => rep.repUserId === bookingDraft.repUserId,
    );

    setAppointments((current) => [
      {
        id: result.appointmentId ?? `appointment-${Date.now()}`,
        date: bookingDraft.date,
        slot: bookingDraft.slot,
        location: bookingDraft.location,
        notes: bookingDraft.notes,
        interestedIn: bookingDraft.interestedIn,
        customerId: bookingDraft.customerId || `temp-${Date.now()}`,
        customerName:
          selectedCustomer?.name || bookingDraft.customerName || bookingDraft.customerSearch || "New customer",
        address: selectedCustomer?.address || bookingDraft.customerAddress || "Address unavailable",
        repUserId: bookingDraft.repUserId,
        repName: selectedRep?.repName || "Sales rep",
      },
      ...current,
    ]);
    setAvailabilitySlots((current) =>
      current.map((slot) =>
        slot.date === bookingDraft.date &&
        slot.slot === bookingDraft.slot &&
        slot.repUserId === bookingDraft.repUserId
          ? { ...slot, status: "booked" }
          : slot,
      ),
    );
    setBookingDraft(null);
    setIsSavingAppointment(false);
    setMessage("Appointment booked.");
  }

  async function submitAvailability() {
    if (!currentUser) {
      return;
    }

    setIsSubmittingAvailability(true);
    const selectedSlots = Object.entries(availabilitySelection)
      .filter(([, selected]) => selected)
      .map(([key]) => {
        const [date, slot] = key.split("__");
        return createSlotRecord(date, slot as AppointmentSlotKey);
      });

    const response = await fetch("/api/availability/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repUserId: currentUser.id,
        location: currentUser.location || "Ellsworth",
        monthStart: toDateKey(nextMonth),
        slots: selectedSlots,
      }),
    });

    const result = (await response.json()) as { count?: number; error?: string };
    if (response.ok) {
      setAvailabilitySlots((current) => [
        ...current.filter((slot) => !(slot.repUserId === currentUser.id && slot.date >= toDateKey(nextMonth))),
        ...selectedSlots.map((slot) => ({
          id: `open-${currentUser.id}-${slot.date}-${slot.slot}`,
          date: slot.date,
          slot: slot.slot,
          location: currentUser.location || "Ellsworth",
          status: "open",
          repUserId: currentUser.id,
          repName: currentUser.fullName,
        })),
      ]);
      setIsAvailabilityOpen(false);
      setMessage(`Submitted ${result.count ?? selectedSlots.length} slots.`);
    } else {
      setMessage(result.error || "Unable to submit availability.");
    }
    setIsSubmittingAvailability(false);
  }

  async function updateInstallJob(jobId: string, updates: Partial<InstallJob>) {
    setInstallJobs((current) =>
      current.map((job) => (job.id === jobId ? { ...job, ...updates } : job)),
    );

    await supabase
      .from("projects")
      .update({
        assigned_installer_id: updates.installerId ?? null,
        scheduled_at: updates.date
          ? `${updates.date}T${updates.time === "9:00 AM" ? "09:00:00" : updates.time === "12:00 PM" ? "12:00:00" : updates.time === "3:00 PM" ? "15:00:00" : "09:00:00"}`
          : undefined,
      })
      .eq("id", jobId);
  }

  const todaysAppointmentsForCurrentUser = useMemo(() => {
    const todayKey = toDateKey(new Date());
    return appointments.filter((appointment) => {
      if (appointment.date !== todayKey) {
        return false;
      }
      if (!currentUser) {
        return true;
      }
      if (["Owner", "Sales Manager", "Office Manager"].includes(currentUser.roleName)) {
        return true;
      }
      return appointment.repUserId === currentUser.id;
    });
  }, [appointments, currentUser]);

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Calendar" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar title="Calendar" />

        <div className="flex-1 space-y-6 p-8">
          {/* Role-based action buttons */}
          <div className="flex flex-wrap gap-3">
            {getRoleCanSubmitAvailability(currentUser?.roleName ?? "") && (
              <Link
                href="/calendar/availability"
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
              >
                Submit my availability
              </Link>
            )}
            {["Owner", "Office Manager", "Appointment Setter"].includes(currentUser?.roleName ?? "") && (
              <Link
                href="/calendar/booking"
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
              >
                Book appointment
              </Link>
            )}
          </div>
          {message ? (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
              {message}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {[
              { key: "appointments", label: "Appointment calendar" },
              { key: "install", label: "Install schedule" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCalendarMode(tab.key as CalendarMode)}
                className={`rounded-full px-4 py-2.5 text-sm font-medium ${
                  calendarMode === tab.key
                    ? "bg-primary text-white"
                    : "bg-white text-stone-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {calendarMode === "appointments" ? (
            <>
              <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "month", label: "Month" },
                      { key: "week", label: "Week" },
                      { key: "day", label: "Day" },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setAppointmentView(tab.key as AppointmentViewMode)}
                        className={`rounded-full px-4 py-2 text-sm font-medium ${
                          appointmentView === tab.key
                            ? "bg-primary text-white"
                            : "bg-stone-100 text-stone-600"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setDisplayMonth(addMonths(displayMonth, -1))}
                      className="rounded-full border border-stone-200 px-3 py-2 text-sm text-stone-600"
                    >
                      Previous
                    </button>
                    <span className="text-sm font-medium text-stone-700">
                      {formatMonthLabel(displayMonth)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDisplayMonth(addMonths(displayMonth, 1))}
                      className="rounded-full border border-stone-200 px-3 py-2 text-sm text-stone-600"
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div className={`mt-6 grid gap-3 ${appointmentView === "month" ? "md:grid-cols-6" : "md:grid-cols-6"}`}>
                  {appointmentDayList.map((day) => {
                    const dateKey = toDateKey(day);
                    const dayAvailability = availabilityByDate[dateKey] ?? [];
                    const dayDots = availabilityDotsByDate[dateKey] ?? [];
                    return (
                      <button
                        key={dateKey}
                        type="button"
                        onClick={() => setSelectedDay(dateKey)}
                        className={`rounded-2xl border p-3 text-left transition ${
                          selectedDay === dateKey
                            ? "border-primary bg-primary/5"
                            : "border-stone-200 bg-stone-50 hover:border-stone-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
                              {day.toLocaleDateString("en-US", { weekday: "short" })}
                            </p>
                            <p className="mt-1 text-lg font-semibold text-stone-950">
                              {day.getDate()}
                            </p>
                          </div>
                          {dayAvailability.length === 0 ? (
                            <span className="rounded-full bg-stone-200 px-2 py-1 text-[11px] text-stone-500">
                              No availability
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {dayDots.map(([slotKey, slotStatus]) => (
                            <span
                              key={`${dateKey}-${slotKey}-${slotStatus}`}
                              className={`h-2.5 w-2.5 rounded-full ${
                                slotStatus === "booked"
                                  ? "bg-stone-400"
                                  : slotKey === "AM"
                                    ? "bg-sky-500"
                                    : slotKey === "MID"
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                              }`}
                              title={`${slotKey} · ${slotStatus === "booked" ? "Booked" : "Available"}`}
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedDay ? (
                <aside className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
                        Day detail
                      </p>
                      <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">
                        {formatDayLabel(fromDateKey(selectedDay))}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDay(null)}
                      className="rounded-full border border-stone-200 px-3 py-2 text-sm text-stone-500"
                    >
                      Close
                    </button>
                  </div>

                  <div className="mt-5 space-y-4">
                    {APPOINTMENT_SLOTS.map((slot) => {
                      const slotAvailability = selectedDaySlots.filter((item) => item.slot === slot.key && item.status === "open");
                      const slotBookings = selectedDayAppointments.filter((item) => item.slot === slot.key);
                      const slotLocation = slotAvailability[0]?.location ?? slotBookings[0]?.location ?? "Ellsworth";

                      return (
                        <div key={slot.key} className="rounded-2xl border border-stone-200 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-semibold text-stone-950">
                                {slot.label} · {slot.timeRange}
                              </h3>
                              <p className="mt-1 text-sm text-stone-500">{slotLocation}</p>
                            </div>
                            {slotAvailability.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => openBooking(selectedDay, slot.key, slotLocation)}
                                className="min-h-12 rounded-2xl bg-primary px-4 text-sm font-semibold text-white"
                              >
                                Book appointment
                              </button>
                            ) : (
                              <span className="rounded-full bg-stone-100 px-3 py-2 text-sm text-stone-500">
                                No rep available
                              </span>
                            )}
                          </div>

                          <div className="mt-4 space-y-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                                Available reps
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {slotAvailability.length > 0 ? (
                                  slotAvailability.map((rep) => (
                                    <span
                                      key={rep.id}
                                      className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700"
                                    >
                                      {rep.repName}
                                    </span>
                                  ))
                                ) : (
                                  <span className="rounded-full bg-stone-100 px-3 py-1.5 text-sm text-stone-500">
                                    No availability
                                  </span>
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                                Booked appointments
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {slotBookings.length > 0 ? (
                                  slotBookings.map((appointment) => (
                                    <span
                                      key={appointment.id}
                                      className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
                                    >
                                      {appointment.customerName}
                                    </span>
                                  ))
                                ) : (
                                  <span className="rounded-full bg-stone-100 px-3 py-1.5 text-sm text-stone-500">
                                    Nothing booked
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </aside>
              ) : null}
            </>
          ) : (
            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setInstallWeekStart(addDays(installWeekStart, -7))}
                    className="rounded-full border border-stone-200 px-3 py-2 text-sm text-stone-600"
                  >
                    Previous week
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstallWeekStart(new Date())}
                    className="rounded-full border border-stone-200 px-3 py-2 text-sm text-stone-600"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstallWeekStart(addDays(installWeekStart, 7))}
                    className="rounded-full border border-stone-200 px-3 py-2 text-sm text-stone-600"
                  >
                    Next week
                  </button>
                </div>
                <p className="text-sm font-medium text-stone-700">
                  {formatCompactDate(installDays[0])} - {formatCompactDate(installDays[installDays.length - 1])}
                </p>
              </div>

              <div className="mt-6 overflow-x-auto">
                <div className="min-w-[980px]">
                  <div className="grid grid-cols-[220px_repeat(6,minmax(120px,1fr))] gap-3">
                    <div />
                    {installDays.map((day) => (
                      <div key={toDateKey(day)} className="rounded-2xl bg-stone-50 px-3 py-3 text-center text-sm font-medium text-stone-700">
                        {formatDayLabel(day)}
                      </div>
                    ))}

                    {[{ id: "unassigned", fullName: "Unassigned" }, ...installers].map((installer) => (
                      <Fragment key={`installer-row-${installer.id}`}>
                        <div
                          key={`label-${installer.id}`}
                          className="rounded-2xl bg-stone-50 px-4 py-4 text-sm font-medium text-stone-900"
                        >
                          {installer.fullName}
                        </div>
                        {installDays.map((day) => {
                          const dateKey = toDateKey(day);
                          const cellKey = `${installer.id === "unassigned" ? "unassigned" : installer.id}-${dateKey}`;
                          const jobs = installJobsByCell[cellKey] ?? [];
                          return (
                            <div
                              key={`${cellKey}-cell`}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                const jobId = event.dataTransfer.getData("text/plain");
                                const draggedJob = installJobs.find((job) => job.id === jobId);
                                if (!draggedJob) {
                                  return;
                                }

                                const installerName =
                                  installer.id === "unassigned" ? undefined : installer.fullName;

                                void updateInstallJob(jobId, {
                                  date: dateKey,
                                  installerId: installer.id === "unassigned" ? undefined : installer.id,
                                  installerName,
                                });
                              }}
                              className="min-h-[140px] rounded-2xl border border-stone-200 bg-white p-2"
                            >
                              <div className="space-y-2">
                                {jobs.map((job) => (
                                  <button
                                    key={job.id}
                                    type="button"
                                    draggable
                                    onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                                      event.dataTransfer.setData("text/plain", job.id);
                                    }}
                                    onClick={() => setSelectedInstallJob(job)}
                                    className="w-full rounded-2xl border border-primary/15 bg-primary/5 px-3 py-3 text-left"
                                  >
                                    <p className="font-medium text-stone-950">{job.customerName}</p>
                                    <p className="mt-1 text-xs text-stone-500">{job.address}</p>
                                    <div className="mt-2 flex items-center justify-between gap-2">
                                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${getInstallBadge(job.jobType)}`}>
                                        {job.jobType}
                                      </span>
                                      <span className="text-xs font-medium text-stone-600">{job.time}</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-stone-950">
                Today&apos;s appointments
              </h2>
              <Link href="/calendar" className="text-sm font-medium text-primary">
                View all
              </Link>
            </div>
            <div className="mt-5 space-y-3">
              {todaysAppointmentsForCurrentUser.slice(0, 4).map((appointment) => (
                <div key={appointment.id} className="rounded-2xl border border-stone-100 bg-stone-50 px-4 py-4">
                  <p className="font-medium text-stone-950">
                    {appointment.slot} · {appointment.customerName}
                  </p>
                  <p className="mt-1 text-sm text-stone-500">{appointment.address}</p>
                  <p className="mt-1 text-xs text-stone-400">{appointment.repName}</p>
                </div>
              ))}
              {todaysAppointmentsForCurrentUser.length === 0 ? (
                <p className="rounded-2xl bg-stone-50 px-4 py-4 text-sm text-stone-500">
                  No appointments for today.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </section>

      {bookingDraft ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/35 p-6">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
                  Book appointment
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                  {bookingDraft.date} · {bookingDraft.slot}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setBookingDraft(null)}
                className="rounded-full border border-stone-200 px-3 py-2 text-sm text-stone-500"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <label className="text-sm font-medium text-stone-700">Customer search</label>
                <input
                  value={bookingDraft.customerSearch}
                  onChange={(event) =>
                    setBookingDraft((current) =>
                      current ? { ...current, customerSearch: event.target.value } : current,
                    )
                  }
                  className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {matchingCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() =>
                        setBookingDraft((current) =>
                          current
                            ? {
                                ...current,
                                customerId: customer.id,
                                customerSearch: customer.name,
                                customerName: customer.name,
                                customerPhone: customer.phone,
                                customerAddress: customer.address,
                              }
                            : current,
                        )
                      }
                      className="rounded-full bg-stone-100 px-3 py-2 text-sm text-stone-700"
                    >
                      {customer.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-stone-700">Rep selector</label>
                  <select
                    value={bookingDraft.repUserId}
                    onChange={(event) =>
                      setBookingDraft((current) =>
                        current ? { ...current, repUserId: event.target.value } : current,
                      )
                    }
                    className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
                  >
                    <option value="">Select rep</option>
                    {availableRepsForBooking.map((rep) => (
                      <option key={rep.id} value={rep.repUserId}>
                        {rep.repName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-700">Location</label>
                  <select
                    value={bookingDraft.location}
                    onChange={(event) =>
                      setBookingDraft((current) =>
                        current ? { ...current, location: event.target.value } : current,
                      )
                    }
                    className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
                  >
                    <option value="Ellsworth">Ellsworth</option>
                    <option value="Lindsay">Lindsay</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-700">Interested in</label>
                  <select
                    value={bookingDraft.interestedIn}
                    onChange={(event) =>
                      setBookingDraft((current) =>
                        current ? { ...current, interestedIn: event.target.value } : current,
                      )
                    }
                    className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
                  >
                    {INTEREST_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-700">Address</label>
                  <input
                    value={bookingDraft.customerAddress}
                    onChange={(event) =>
                      setBookingDraft((current) =>
                        current ? { ...current, customerAddress: event.target.value } : current,
                      )
                    }
                    className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-stone-700">Notes</label>
                <textarea
                  value={bookingDraft.notes}
                  onChange={(event) =>
                    setBookingDraft((current) =>
                      current ? { ...current, notes: event.target.value } : current,
                    )
                  }
                  className="mt-2 min-h-28 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition focus:border-primary"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => void handleBookAppointment()}
                disabled={!bookingDraft.repUserId || isSavingAppointment}
                className="min-h-12 rounded-2xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSavingAppointment ? "Booking..." : "Book appointment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAvailabilityOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/35 p-6">
          <div className="w-full max-w-5xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
                  Rep availability
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                  {formatMonthLabel(nextMonth)}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAvailabilityOpen(false)}
                className="rounded-full border border-stone-200 px-3 py-2 text-sm text-stone-500"
              >
                Close
              </button>
            </div>

            {todaySubmissionWarning ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Availability for next month is due by the 25th — please submit now
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {APPOINTMENT_SLOTS.map((slot) => (
                <button
                  key={slot.key}
                  type="button"
                  onClick={() =>
                    setAvailabilitySelection((current) => {
                      const next = { ...current };
                      availabilityDays.forEach((day) => {
                        next[`${toDateKey(day)}__${slot.key}`] = true;
                      });
                      return next;
                    })
                  }
                  className="rounded-full bg-stone-100 px-3 py-2 text-sm text-stone-700"
                >
                  Select all {slot.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAvailabilitySelection({})}
                className="rounded-full bg-stone-100 px-3 py-2 text-sm text-stone-700"
              >
                Clear all
              </button>
            </div>

            <p className="mt-4 text-sm text-stone-500">
              You have submitted {availabilitySelectedCount} available slots for {formatMonthLabel(nextMonth)}
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-6">
              {availabilityDays.map((day) => (
                <div key={toDateKey(day)} className="rounded-2xl border border-stone-200 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
                    {day.toLocaleDateString("en-US", { weekday: "short" })}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-stone-950">{day.getDate()}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {APPOINTMENT_SLOTS.map((slot) => {
                      const key = `${toDateKey(day)}__${slot.key}`;
                      const selected = !!availabilitySelection[key];
                      return (
                        <button
                          key={slot.key}
                          type="button"
                          onClick={() =>
                            setAvailabilitySelection((current) => ({
                              ...current,
                              [key]: !current[key],
                            }))
                          }
                          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                            selected ? "bg-primary text-white" : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => void submitAvailability()}
                disabled={availabilitySelectedCount < 10 || isSubmittingAvailability}
                className="min-h-12 rounded-2xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSubmittingAvailability ? "Submitting..." : "Submit availability"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedInstallJob ? (
        <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-xl overflow-y-auto border-l border-stone-200 bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
                Install job
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                {selectedInstallJob.customerName}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedInstallJob(null)}
              className="rounded-full border border-stone-200 px-3 py-2 text-sm text-stone-500"
            >
              Close
            </button>
          </div>

          <a
            href={`https://maps.apple.com/?q=${encodeURIComponent(selectedInstallJob.address)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 block text-sm font-medium text-stone-700 underline"
          >
            {selectedInstallJob.address}
          </a>
          {selectedInstallJob.gateCode ? (
            <div className="mt-4 rounded-2xl bg-primary/10 px-4 py-4 text-sm font-semibold text-primary">
              Gate code: {selectedInstallJob.gateCode}
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            {selectedInstallJob.quoteLines.map((line) => (
              <div key={line.id} className="rounded-2xl border border-stone-200 px-4 py-4">
                <p className="font-medium text-stone-950">{line.room}</p>
                <p className="mt-1 text-sm text-stone-600">
                  {line.productName} · {line.color} · {line.liftOption}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label className="text-sm font-medium text-stone-700">Assign / reassign installer</label>
              <select
                value={selectedInstallJob.installerId ?? ""}
                onChange={(event) =>
                  setSelectedInstallJob((current) =>
                    current
                      ? {
                          ...current,
                          installerId: event.target.value,
                          installerName:
                            installers.find((installer) => installer.id === event.target.value)
                              ?.fullName ?? undefined,
                        }
                      : current,
                  )
                }
                className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
              >
                <option value="">Unassigned</option>
                {installers.map((installer) => (
                  <option key={installer.id} value={installer.id}>
                    {installer.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700">Scheduled time</label>
              <select
                value={selectedInstallJob.time}
                onChange={(event) =>
                  setSelectedInstallJob((current) =>
                    current ? { ...current, time: event.target.value } : current,
                  )
                }
                className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm outline-none transition focus:border-primary"
              >
                {APPOINTMENT_SLOTS.map((slot) => (
                  <option key={slot.key} value={slot.shortTime}>
                    {slot.shortTime}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  selectedInstallJob &&
                  void updateInstallJob(selectedInstallJob.id, {
                    installerId: selectedInstallJob.installerId,
                    installerName: selectedInstallJob.installerName,
                    date: selectedInstallJob.date,
                    time: selectedInstallJob.time,
                  })
                }
                className="min-h-12 flex-1 rounded-2xl bg-primary px-4 text-sm font-semibold text-white"
              >
                Save schedule
              </button>
              <button
                type="button"
                onClick={async () => {
                  const installer = installers.find(
                    (user) => user.id === selectedInstallJob.installerId,
                  );
                  if (installer?.phone) {
                    await sendSMS(
                      installer.phone,
                      `Install scheduled: ${selectedInstallJob.customerName} on ${selectedInstallJob.date} ${selectedInstallJob.time}. Address: ${selectedInstallJob.address}.`,
                    );
                    setMessage("Installer notification sent.");
                  } else {
                    setMessage("Installer has no phone number on file.");
                  }
                }}
                className="min-h-12 flex-1 rounded-2xl border border-stone-200 px-4 text-sm font-semibold text-stone-700"
              >
                Send notification to installer
              </button>
            </div>
          </div>
        </aside>
      ) : null}
    </main>
  );
}
