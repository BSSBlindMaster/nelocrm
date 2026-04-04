"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Sidebar } from "@/components/Sidebar";
import {
  getCurrentAppUser,
  getActiveAppUsers,
  type CurrentAppUser,
  type ActiveAppUser,
} from "@/lib/current-app-user";
import { supabase } from "@/lib/supabase";
import { sendSMS } from "@/lib/twilio";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Customer = {
  id: string;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

type Installer = {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
};

type QuoteLine = {
  id: string;
  room?: string | null;
  quantity?: number | null;
  products?: { name: string } | null;
  fabrics?: { name: string } | null;
  lift_options?: { name: string } | null;
};

type Job = {
  id: string;
  customer_id: string;
  project_id?: string | null;
  assigned_to: string | null;
  job_type: string;
  status: string;
  location?: string | null;
  address?: string | null;
  gate_code?: string | null;
  lat: number | null;
  lng: number | null;
  scheduled_at: string | null;
  duration_minutes: number;
  duration_auto_calculated?: boolean | null;
  drive_time_minutes?: number | null;
  notes?: string | null;
  customers: Customer | null;
  app_users: Installer | null;
  products: QuoteLine[];
};

type FilterTab = "all" | "unassigned" | "scheduled" | "in_progress" | "complete";

type OptimizedJob = {
  id: string;
  customer_name: string;
  address: string;
  estimated_duration: number;
  start_time: string;
  end_time: string;
  drive_time_minutes: number;
  optimized_sequence: number;
};

type DurationBreakdown = {
  product: string;
  quantity: number;
  minutes_each: number;
  subtotal: number;
};

const JOB_TYPE_COLORS: Record<string, string> = {
  Install: "bg-primary/10 text-primary",
  Repair: "bg-rose-100 text-rose-700",
  Measure: "bg-sky-100 text-sky-700",
  Service: "bg-amber-100 text-amber-700",
};

const STATUS_BORDER: Record<string, string> = {
  scheduled: "border-l-primary",
  complete: "border-l-emerald-500",
  in_progress: "border-l-sky-500",
  issue: "border-l-rose-500",
};

const STATUS_MARKER_COLOR: Record<string, string> = {
  scheduled: "#FF4900",
  complete: "#10b981",
  in_progress: "#3b82f6",
  issue: "#ef4444",
};

const TIMELINE_START = 7; // 7am
const TIMELINE_END = 19; // 7pm
const TIMELINE_SLOTS = (TIMELINE_END - TIMELINE_START) * 2; // 30-min slots
const SLOT_WIDTH = 120; // px per 30-min slot

const START_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  Ellsworth: { lat: 33.4142, lng: -111.7649 },
  Lindsay: { lat: 33.4373, lng: -111.8195 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function displayDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function customerDisplayName(c: Customer | null): string {
  if (!c) return "Unknown";
  if (c.name) return c.name;
  const full = [c.first_name, c.last_name].filter(Boolean).join(" ");
  return full || "Unknown";
}

function fullAddress(c: Customer | null, jobAddress?: string | null): string {
  if (jobAddress) return jobAddress;
  if (!c) return "";
  return [c.address, c.city, c.state, c.zip].filter(Boolean).join(", ");
}

function abbrevAddress(c: Customer | null, jobAddress?: string | null): string {
  const addr = jobAddress || c?.address || "";
  if (addr.length > 28) return addr.slice(0, 26) + "…";
  return addr;
}

function installerName(inst: Installer | null): string {
  if (!inst) return "Unassigned";
  return [inst.first_name, inst.last_name].filter(Boolean).join(" ");
}

function installerInitials(inst: Installer | null): string {
  if (!inst) return "?";
  return (
    (inst.first_name?.[0] ?? "") + (inst.last_name?.[0] ?? "")
  ).toUpperCase();
}

function jobMinutesFromMidnight(job: Job): number {
  if (!job.scheduled_at) return TIMELINE_START * 60;
  const d = new Date(job.scheduled_at);
  return d.getHours() * 60 + d.getMinutes();
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DispatchPage() {
  const [currentUser, setCurrentUser] = useState<CurrentAppUser | null>(null);
  const [installers, setInstallers] = useState<ActiveAppUser[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [liveTracking, setLiveTracking] = useState(false);
  const [mapStyle, setMapStyle] = useState<"streets" | "satellite">("streets");
  const [undoAction, setUndoAction] = useState<{
    jobId: string;
    prevAssignedTo: string | null;
    prevScheduledAt: string | null;
  } | null>(null);

  // Detail panel editable fields
  const [detailAssignedTo, setDetailAssignedTo] = useState<string>("");
  const [detailScheduledAt, setDetailScheduledAt] = useState<string>("");
  const [detailDuration, setDetailDuration] = useState<number>(90);
  const [detailNotes, setDetailNotes] = useState<string>("");
  const [detailBreakdown, setDetailBreakdown] = useState<DurationBreakdown[]>([]);
  const [detailBreakdownBuffer, setDetailBreakdownBuffer] = useState<number>(15);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Optimize modal state
  const [optimizeOpen, setOptimizeOpen] = useState(false);
  const [optimizeInstallerId, setOptimizeInstallerId] = useState<string>("");
  const [optimizeStartTime, setOptimizeStartTime] = useState("08:00");
  const [optimizeStartLocation, setOptimizeStartLocation] = useState("Ellsworth");
  const [optimizeCustomAddress, setOptimizeCustomAddress] = useState("");
  const [optimizeLoading, setOptimizeLoading] = useState(false);
  const [optimizeStatus, setOptimizeStatus] = useState("");
  const [optimizeResult, setOptimizeResult] = useState<{
    schedule: OptimizedJob[];
    total_drive_minutes: number;
    total_work_minutes: number;
    end_time: string | null;
  } | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupsRef = useRef<mapboxgl.Popup[]>([]);
  const routeLayerAdded = useRef(false);

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  const loadJobs = useCallback(async () => {
    const d = selectedDate;
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

    const { data, error } = await supabase
      .from("jobs")
      .select(`
        *,
        customers (
          id,
          name,
          first_name,
          last_name,
          phone,
          phone_mobile,
          address,
          city,
          state,
          zip,
          gate_code
        ),
        app_users!assigned_to (
          id,
          first_name,
          last_name,
          phone
        )
      `)
      .gte("scheduled_at", startOfDay.toISOString())
      .lte("scheduled_at", endOfDay.toISOString())
      .order("scheduled_at", { ascending: true });

    if (error) {
      // If explicit FK hint fails, retry without it
      const retry = await supabase
        .from("jobs")
        .select("*")
        .gte("scheduled_at", startOfDay.toISOString())
        .lte("scheduled_at", endOfDay.toISOString())
        .order("scheduled_at", { ascending: true });

      const rows = (retry.data ?? []) as Array<Record<string, unknown>>;
      setJobs(rows.map((j) => ({
        id: String(j.id ?? ""),
        customer_id: String(j.customer_id ?? ""),
        project_id: (j.project_id as string) ?? null,
        assigned_to: (j.assigned_to as string) ?? null,
        job_type: String(j.job_type ?? "Install"),
        status: String(j.status ?? "scheduled"),
        location: (j.location as string) ?? null,
        address: (j.address as string) ?? null,
        gate_code: (j.gate_code as string) ?? null,
        lat: typeof j.lat === "number" ? j.lat : null,
        lng: typeof j.lng === "number" ? j.lng : null,
        scheduled_at: (j.scheduled_at as string) ?? null,
        duration_minutes: Number(j.duration_minutes ?? 90),
        duration_auto_calculated: (j.duration_auto_calculated as boolean) ?? null,
        drive_time_minutes: (j.drive_time_minutes as number) ?? null,
        notes: (j.notes as string) ?? null,
        customers: null,
        app_users: null,
        products: [],
      })));
      return;
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    setJobs(rows.map((j) => {
      const c = j.customers as Record<string, unknown> | null;
      const u = j.app_users as Record<string, unknown> | null;
      return {
        id: String(j.id ?? ""),
        customer_id: String(j.customer_id ?? ""),
        project_id: (j.project_id as string) ?? null,
        assigned_to: (j.assigned_to as string) ?? null,
        job_type: String(j.job_type ?? "Install"),
        status: String(j.status ?? "scheduled"),
        location: (j.location as string) ?? null,
        address: (j.address as string) ?? null,
        gate_code: (j.gate_code as string) ?? (c?.gate_code as string) ?? null,
        lat: typeof j.lat === "number" ? j.lat : null,
        lng: typeof j.lng === "number" ? j.lng : null,
        scheduled_at: (j.scheduled_at as string) ?? null,
        duration_minutes: Number(j.duration_minutes ?? 90),
        duration_auto_calculated: (j.duration_auto_calculated as boolean) ?? null,
        drive_time_minutes: (j.drive_time_minutes as number) ?? null,
        notes: (j.notes as string) ?? null,
        customers: c ? {
          id: String(c.id ?? ""),
          name: String(c.name ?? "") || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown",
          first_name: (c.first_name as string) ?? null,
          last_name: (c.last_name as string) ?? null,
          phone: String(c.phone ?? c.phone_mobile ?? ""),
          address: (c.address as string) ?? null,
          city: (c.city as string) ?? null,
          state: (c.state as string) ?? null,
          zip: (c.zip as string) ?? null,
        } : null,
        app_users: u ? {
          id: String(u.id ?? ""),
          first_name: String(u.first_name ?? ""),
          last_name: String(u.last_name ?? ""),
          phone: (u.phone as string) ?? null,
        } : null,
        products: [],
      };
    }));
  }, [selectedDate]);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      const [user, users] = await Promise.all([
        getCurrentAppUser(),
        getActiveAppUsers(),
      ]);
      if (!isMounted) return;
      setCurrentUser(user);
      setInstallers(users.filter((u) => u.roleName === "Installer"));
      setIsLoading(false);
    }
    void init();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  // -----------------------------------------------------------------------
  // Filtered jobs
  // -----------------------------------------------------------------------

  const filteredJobs = useMemo(() => {
    switch (activeFilter) {
      case "unassigned":
        return jobs.filter((j) => !j.assigned_to);
      case "scheduled":
        return jobs.filter((j) => j.status === "scheduled");
      case "in_progress":
        return jobs.filter((j) => j.status === "in_progress");
      case "complete":
        return jobs.filter((j) => j.status === "complete");
      default:
        return jobs;
    }
  }, [jobs, activeFilter]);

  const counts = useMemo(
    () => ({
      all: jobs.length,
      unassigned: jobs.filter((j) => !j.assigned_to).length,
      scheduled: jobs.filter((j) => j.status === "scheduled").length,
      in_progress: jobs.filter((j) => j.status === "in_progress").length,
      complete: jobs.filter((j) => j.status === "complete").length,
    }),
    [jobs],
  );

  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  );

  // -----------------------------------------------------------------------
  // Map
  // -----------------------------------------------------------------------

  // Set the access token once on mount
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_KEY;
    if (token) {
      (mapboxgl as unknown as Record<string, string>).accessToken = token;
    }
  }, []);

  // Initialize the map after mount
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!(mapboxgl as unknown as Record<string, string>).accessToken) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style:
        mapStyle === "streets"
          ? "mapbox://styles/mapbox/streets-v12"
          : "mapbox://styles/mapbox/satellite-streets-v12",
      center: [-111.891, 33.4152],
      zoom: 10,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-left");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapStyle]);

  // Update markers when jobs change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    popupsRef.current.forEach((p) => p.remove());
    popupsRef.current = [];

    // Remove old route
    if (map.getSource("route")) {
      map.removeLayer("route-line");
      map.removeSource("route");
      routeLayerAdded.current = false;
    }

    const jobsWithCoords = jobs.filter((j) => j.lat && j.lng);
    const bounds = new mapboxgl.LngLatBounds();
    const routeCoords: [number, number][] = [];

    jobsWithCoords.forEach((job, idx) => {
      const color = STATUS_MARKER_COLOR[job.status] ?? "#FF4900";
      const el = document.createElement("div");
      el.className = "dispatch-marker";
      el.style.cssText = `
        width:32px;height:32px;border-radius:50%;background:${color};
        color:#fff;font-weight:700;font-size:13px;display:flex;
        align-items:center;justify-content:center;border:2px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;
      `;
      el.textContent = String(idx + 1);

      if (selectedJobId === job.id) {
        el.style.transform = "scale(1.3)";
        el.style.zIndex = "10";
      }

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="font-family:system-ui;font-size:13px;max-width:220px;">
          <strong>${customerDisplayName(job.customers)}</strong><br/>
          <span style="color:#666">${fullAddress(job.customers, job.address)}</span><br/>
          <span>${job.scheduled_at ? formatTime(job.scheduled_at) : "Unscheduled"}</span><br/>
          <span>Installer: ${installerName(job.app_users)}</span><br/>
          <span style="color:${color};font-weight:600;text-transform:capitalize">${job.status.replace("_", " ")}</span>
        </div>
      `);
      popupsRef.current.push(popup);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([job.lng!, job.lat!])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener("click", () => {
        setSelectedJobId(job.id);
      });

      markersRef.current.push(marker);
      bounds.extend([job.lng!, job.lat!]);
      routeCoords.push([job.lng!, job.lat!]);
    });

    // Fit bounds
    if (jobsWithCoords.length > 0) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    }

    // Draw route line
    if (routeCoords.length >= 2) {
      const addRoute = () => {
        if (map.getSource("route")) return;
        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: routeCoords },
          },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#FF4900",
            "line-width": 3,
            "line-opacity": 0.6,
            "line-dasharray": [2, 2],
          },
        });
        routeLayerAdded.current = true;
      };

      if (map.isStyleLoaded()) {
        addRoute();
      } else {
        map.on("load", addRoute);
      }
    }
  }, [jobs, selectedJobId]);

  function fitAllJobs() {
    const map = mapRef.current;
    if (!map) return;
    const withCoords = jobs.filter((j) => j.lat && j.lng);
    if (withCoords.length === 0) return;
    const bounds = new mapboxgl.LngLatBounds();
    withCoords.forEach((j) => bounds.extend([j.lng!, j.lat!]));
    map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
  }

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  async function updateJobStatus(jobId: string, status: string) {
    await supabase.from("jobs").update({ status, updated_at: new Date().toISOString() }).eq("id", jobId);
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)));
  }

  async function assignJob(
    jobId: string,
    assignedTo: string | null,
    scheduledAt?: string,
  ) {
    const prev = jobs.find((j) => j.id === jobId);
    setUndoAction({
      jobId,
      prevAssignedTo: prev?.assigned_to ?? null,
      prevScheduledAt: prev?.scheduled_at ?? null,
    });

    const res = await fetch("/api/dispatch/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, assignedTo, scheduledAt }),
    });
    const data = await res.json();

    if (data.success) {
      await loadJobs();
      setTimeout(() => setUndoAction(null), 8000);
    }
  }

  async function undoAssign() {
    if (!undoAction) return;
    await fetch("/api/dispatch/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: undoAction.jobId,
        assignedTo: undoAction.prevAssignedTo,
        scheduledAt: undoAction.prevScheduledAt,
      }),
    });
    setUndoAction(null);
    await loadJobs();
  }

  async function sendInstallerNotification(job: Job) {
    if (!job.app_users?.phone) return;
    const addr = fullAddress(job.customers, job.address);
    const date = job.scheduled_at
      ? new Date(job.scheduled_at).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : "TBD";
    const time = job.scheduled_at ? formatTime(job.scheduled_at) : "TBD";
    await sendSMS(
      job.app_users.phone,
      `You have been assigned a job: ${customerDisplayName(job.customers)} at ${addr} on ${date} at ${time}`,
    );
  }

  async function sendOnMyWay(job: Job) {
    if (!job.customers?.phone) return;
    await sendSMS(
      job.customers.phone,
      `Your installer is on their way! They should arrive at your location shortly.`,
    );
  }

  function openDetail(job: Job) {
    setSelectedJobId(job.id);
    setDetailAssignedTo(job.assigned_to ?? "");
    setDetailScheduledAt(
      job.scheduled_at ? job.scheduled_at.slice(0, 16) : "",
    );
    setDetailDuration(job.duration_minutes);
    setDetailNotes(job.notes ?? "");
    setDetailBreakdown([]);
    setDetailBreakdownBuffer(15);
    setShowBreakdown(false);
    setDetailOpen(true);

    // Load duration breakdown if project-linked
    if (job.project_id) {
      void loadDurationBreakdown(job.project_id);
    }
  }

  async function loadDurationBreakdown(projectId: string) {
    const res = await fetch("/api/dispatch/calculate-duration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    const data = await res.json();
    if (data.breakdown) {
      setDetailBreakdown(data.breakdown);
      setDetailBreakdownBuffer(data.buffer_minutes ?? 15);
    }
  }

  async function recalculateDuration() {
    if (!selectedJob?.project_id) return;
    setIsRecalculating(true);
    const res = await fetch("/api/dispatch/calculate-duration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: selectedJob.project_id }),
    });
    const data = await res.json();
    if (data.breakdown) {
      setDetailBreakdown(data.breakdown);
      setDetailBreakdownBuffer(data.buffer_minutes ?? 15);
      setDetailDuration(data.total_minutes);
      // Update in DB
      await supabase
        .from("jobs")
        .update({
          duration_minutes: data.total_minutes,
          duration_auto_calculated: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedJob.id);
      await loadJobs();
    }
    setIsRecalculating(false);
  }

  async function saveDetail() {
    if (!selectedJob) return;
    const updates: Record<string, unknown> = {
      assigned_to: detailAssignedTo || null,
      scheduled_at: detailScheduledAt || null,
      duration_minutes: detailDuration,
      notes: detailNotes,
      updated_at: new Date().toISOString(),
    };
    await supabase.from("jobs").update(updates).eq("id", selectedJob.id);
    await loadJobs();
  }

  // -----------------------------------------------------------------------
  // Optimize schedule
  // -----------------------------------------------------------------------

  function openOptimizeModal() {
    setOptimizeInstallerId(
      currentUser?.roleName === "Installer" ? currentUser.id : "",
    );
    setOptimizeStartTime("08:00");
    setOptimizeStartLocation("Ellsworth");
    setOptimizeCustomAddress("");
    setOptimizeResult(null);
    setOptimizeStatus("");
    setOptimizeLoading(false);
    setOptimizeOpen(true);
  }

  async function runOptimization() {
    if (!optimizeInstallerId) return;
    setOptimizeLoading(true);
    setOptimizeStatus("Geocoding addresses...");

    const loc = START_LOCATIONS[optimizeStartLocation];
    const startLat = loc?.lat ?? 33.4152;
    const startLng = loc?.lng ?? -111.891;

    setOptimizeStatus("Calculating optimal route...");

    const res = await fetch("/api/dispatch/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: formatDate(selectedDate),
        installer_id: optimizeInstallerId,
        start_time: optimizeStartTime,
        start_lat: startLat,
        start_lng: startLng,
      }),
    });

    const data = await res.json();

    if (data.error) {
      setOptimizeStatus(`Error: ${data.error}`);
      setOptimizeLoading(false);
      return;
    }

    setOptimizeResult(data);
    setOptimizeStatus("");
    setOptimizeLoading(false);
  }

  async function applyOptimization() {
    if (!optimizeResult) return;
    setOptimizeOpen(false);
    await loadJobs();

    const count = optimizeResult.schedule.length;
    showToast(
      `Schedule optimized — ${count} job${count !== 1 ? "s" : ""} scheduled`,
    );
  }

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 6000);
  }

  // -----------------------------------------------------------------------
  // Date navigation
  // -----------------------------------------------------------------------

  function prevDay() {
    setSelectedDate((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() - 1);
      return n;
    });
  }

  function nextDay() {
    setSelectedDate((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + 1);
      return n;
    });
  }

  function goToday() {
    setSelectedDate(new Date());
  }

  // -----------------------------------------------------------------------
  // Timeline drag
  // -----------------------------------------------------------------------

  function handleTimelineDrop(
    e: React.DragEvent,
    installerId: string | null,
    slotIndex: number,
  ) {
    e.preventDefault();
    const jobId = e.dataTransfer.getData("text/plain");
    if (!jobId) return;

    const hours = TIMELINE_START + Math.floor(slotIndex / 2);
    const minutes = (slotIndex % 2) * 30;
    const dateStr = formatDate(selectedDate);
    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    const scheduledAt = `${dateStr}T${hh}:${mm}:00`;

    void assignJob(jobId, installerId, scheduledAt);
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (isLoading) return null;

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "unassigned", label: "Unassigned" },
    { key: "scheduled", label: "Scheduled" },
    { key: "in_progress", label: "In Progress" },
    { key: "complete", label: "Complete" },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar current="Dispatch" />

      {/* LEFT PANEL */}
      <div className="flex h-full w-[380px] min-w-[380px] flex-col border-r border-stone-200 bg-stone-50">
        {/* Search + date nav + optimize button */}
        <div className="border-b border-stone-200 p-4">
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              placeholder="Search jobs..."
              className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={openOptimizeModal}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90"
              title="Optimize schedule"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Optimize my day
            </button>
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={prevDay}
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
            >
              ‹ Prev
            </button>
            <button
              type="button"
              onClick={goToday}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              Today
            </button>
            <button
              type="button"
              onClick={nextDay}
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
            >
              Next ›
            </button>
          </div>
          <p className="mt-2 text-center text-sm font-semibold text-stone-800">
            {displayDate(selectedDate)}
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-stone-200 px-4 py-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition ${
                activeFilter === tab.key
                  ? "bg-primary text-white"
                  : "bg-stone-200 text-stone-600 hover:bg-stone-300"
              }`}
            >
              {tab.label} · {counts[tab.key]}
            </button>
          ))}
        </div>

        {/* Job list */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredJobs.length === 0 && (
            <p className="py-12 text-center text-sm text-stone-400">
              No jobs for this day
            </p>
          )}
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", job.id)}
              onClick={() => openDetail(job)}
              className={`mb-2 cursor-pointer rounded-lg border-l-4 bg-white p-3 shadow-sm transition hover:shadow-md ${
                STATUS_BORDER[job.status] ?? "border-l-stone-300"
              } ${selectedJobId === job.id ? "ring-2 ring-primary" : ""}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    JOB_TYPE_COLORS[job.job_type] ?? "bg-stone-100 text-stone-600"
                  }`}
                >
                  {job.job_type}
                </span>
                <div className="flex items-center gap-1.5">
                  {/* Duration badge */}
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                    {job.duration_auto_calculated ? (
                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    )}
                    ~{formatDuration(job.duration_minutes)}
                  </span>
                  {job.scheduled_at && (
                    <span className="text-xs text-stone-500">
                      {formatTime(job.scheduled_at)}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm font-semibold text-stone-900">
                {customerDisplayName(job.customers)}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                {abbrevAddress(job.customers, job.address)}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-200 text-[10px] font-bold text-stone-600">
                    {installerInitials(job.app_users)}
                  </span>
                  <span className="text-xs text-stone-600">
                    {installerName(job.app_users)}
                  </span>
                </div>
                {job.status !== "complete" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void updateJobStatus(job.id, "complete");
                    }}
                    className="rounded-md bg-emerald-500 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-600"
                  >
                    COMPLETE
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex flex-1 flex-col">
        {/* MAP — top 55% */}
        <div style={{ position: "relative", width: "100%", height: "55%", minHeight: 400 }}>
          <div ref={mapContainerRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} />

          {/* Map controls overlay */}
          <div className="absolute right-3 top-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setLiveTracking((v) => !v)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold shadow-md ${
                liveTracking
                  ? "bg-primary text-white"
                  : "bg-white text-stone-700"
              }`}
            >
              LIVE TRACKING {liveTracking ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              onClick={fitAllJobs}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-md hover:bg-stone-50"
            >
              Fit all jobs
            </button>
            <button
              type="button"
              onClick={() =>
                setMapStyle((s) =>
                  s === "streets" ? "satellite" : "streets",
                )
              }
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-md hover:bg-stone-50"
            >
              {mapStyle === "streets" ? "Satellite" : "Streets"}
            </button>
          </div>
        </div>

        {/* TIMELINE — bottom 45% */}
        <div className="flex flex-col border-t border-stone-200 overflow-hidden" style={{ height: "45%" }}>
          {/* Timeline header */}
          <div className="flex border-b border-stone-200">
            <div className="w-[160px] min-w-[160px] border-r border-stone-200 bg-[#1C1C1C] px-3 py-2">
              <span className="text-xs font-semibold text-white/60">
                Installer
              </span>
            </div>
            <div className="flex overflow-x-auto">
              {Array.from({ length: TIMELINE_SLOTS }).map((_, i) => {
                const hour = TIMELINE_START + Math.floor(i / 2);
                const isHalf = i % 2 === 1;
                const label = isHalf
                  ? ""
                  : `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? "pm" : "am"}`;
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-center border-r border-stone-100 text-[10px] text-stone-400 ${
                      isHalf ? "" : "font-medium"
                    }`}
                    style={{ width: SLOT_WIDTH, minWidth: SLOT_WIDTH }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline rows */}
          <div className="flex-1 overflow-y-auto overflow-x-auto">
            {/* Unassigned row */}
            <TimelineRow
              label="Unassigned"
              installerId={null}
              jobs={jobs.filter((j) => !j.assigned_to)}
              selectedJobId={selectedJobId}
              onDrop={handleTimelineDrop}
              onJobClick={openDetail}
            />
            {/* Installer rows */}
            {installers.map((inst) => (
              <TimelineRow
                key={inst.id}
                label={inst.fullName}
                installerId={inst.id}
                jobs={jobs.filter((j) => j.assigned_to === inst.id)}
                selectedJobId={selectedJobId}
                onDrop={handleTimelineDrop}
                onJobClick={openDetail}
              />
            ))}
            {installers.length === 0 && (
              <div className="flex items-center justify-center py-8 text-sm text-stone-400">
                No installers found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* JOB DETAIL SIDE PANEL */}
      {detailOpen && selectedJob && (
        <div className="absolute right-0 top-0 z-50 flex h-full w-[400px] flex-col border-l border-stone-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-stone-900">
              Job Detail
            </h2>
            <button
              type="button"
              onClick={() => setDetailOpen(false)}
              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {/* Customer info */}
            <div className="mb-5">
              <h3 className="text-base font-semibold text-stone-900">
                {customerDisplayName(selectedJob.customers)}
              </h3>
              {selectedJob.customers?.phone && (
                <a
                  href={`tel:${selectedJob.customers.phone}`}
                  className="mt-1 block text-sm text-primary hover:underline"
                >
                  {selectedJob.customers.phone}
                </a>
              )}
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(
                  fullAddress(selectedJob.customers, selectedJob.address),
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-sm text-sky-600 hover:underline"
              >
                {fullAddress(selectedJob.customers, selectedJob.address)}
              </a>
            </div>

            {/* Gate code */}
            {selectedJob.gate_code && (
              <div className="mb-5 rounded-lg bg-primary/10 px-4 py-3">
                <span className="text-xs font-semibold uppercase text-primary">
                  Gate Code
                </span>
                <p className="text-lg font-bold text-primary">
                  {selectedJob.gate_code}
                </p>
              </div>
            )}

            {/* Job type + status */}
            <div className="mb-5 flex gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  JOB_TYPE_COLORS[selectedJob.job_type] ??
                  "bg-stone-100 text-stone-600"
                }`}
              >
                {selectedJob.job_type}
              </span>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold capitalize text-stone-600">
                {selectedJob.status.replace("_", " ")}
              </span>
            </div>

            {/* Products */}
            {selectedJob.products && selectedJob.products.length > 0 && (
              <div className="mb-5">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Products to Install
                </h4>
                <div className="space-y-1.5">
                  {selectedJob.products.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-md bg-stone-50 px-3 py-2 text-xs text-stone-700"
                    >
                      <span className="font-medium">
                        {(p.products as Record<string, string> | null)?.name ?? "Product"}
                      </span>
                      {(p.fabrics as Record<string, string> | null)?.name &&
                        ` — ${(p.fabrics as Record<string, string>).name}`}
                      {(p.lift_options as Record<string, string> | null)?.name &&
                        ` (${(p.lift_options as Record<string, string>).name})`}
                      {p.quantity && p.quantity > 1 && (
                        <span className="ml-1 text-stone-400">
                          ×{p.quantity}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assigned installer */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-400">
                Assigned Installer
              </label>
              <select
                value={detailAssignedTo}
                onChange={(e) => setDetailAssignedTo(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-primary focus:outline-none"
              >
                <option value="">Unassigned</option>
                {installers.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.fullName}
                  </option>
                ))}
              </select>
            </div>

            {/* Scheduled time */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-400">
                Scheduled Time
              </label>
              <input
                type="datetime-local"
                value={detailScheduledAt}
                onChange={(e) => setDetailScheduledAt(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-primary focus:outline-none"
              />
            </div>

            {/* Estimated duration */}
            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Estimated Duration
                </label>
                {selectedJob.project_id && (
                  <button
                    type="button"
                    onClick={() => void recalculateDuration()}
                    disabled={isRecalculating}
                    className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline disabled:opacity-50"
                  >
                    <svg className={`h-3 w-3 ${isRecalculating ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {isRecalculating ? "Recalculating..." : "Recalculate"}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={detailDuration}
                  onChange={(e) => setDetailDuration(Number(e.target.value))}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-primary focus:outline-none"
                />
                <span className="whitespace-nowrap text-xs text-stone-500">
                  {formatDuration(detailDuration)}
                </span>
              </div>
              {selectedJob.duration_auto_calculated && (
                <p className="mt-1 flex items-center gap-1 text-[10px] text-stone-400">
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Auto-calculated from install time rules
                </p>
              )}

              {/* Duration breakdown */}
              {detailBreakdown.length > 0 && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setShowBreakdown((v) => !v)}
                    className="flex items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-stone-700"
                  >
                    <span className={`transition ${showBreakdown ? "rotate-90" : ""}`}>›</span>
                    {showBreakdown ? "Hide" : "Show"} breakdown
                  </button>
                  {showBreakdown && (
                    <div className="mt-1.5 rounded-lg border border-stone-100 bg-stone-50 p-2">
                      {detailBreakdown.map((item, i) => (
                        <div key={i} className="flex justify-between py-0.5 text-[11px] text-stone-600">
                          <span>
                            {item.product} ×{item.quantity}
                          </span>
                          <span className="text-stone-400">
                            {item.minutes_each}min × {item.quantity} = {item.subtotal}min
                          </span>
                        </div>
                      ))}
                      <div className="mt-1 flex justify-between border-t border-stone-200 pt-1 text-[11px] text-stone-500">
                        <span>Setup/cleanup buffer</span>
                        <span>{detailBreakdownBuffer}min</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="mb-5">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-400">
                Notes
              </label>
              <textarea
                value={detailNotes}
                onChange={(e) => setDetailNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-primary focus:outline-none"
              />
            </div>

            {/* Save */}
            <button
              type="button"
              onClick={() => void saveDetail()}
              className="mb-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Save Changes
            </button>

            {/* Action buttons */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void sendInstallerNotification(selectedJob)}
                className="w-full rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Send notification to installer
              </button>
              <button
                type="button"
                onClick={() => void sendOnMyWay(selectedJob)}
                className="w-full rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Send on-my-way to customer
              </button>
              <button
                type="button"
                onClick={() => {
                  void updateJobStatus(selectedJob.id, "complete");
                  setDetailOpen(false);
                }}
                className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                Mark Complete
              </button>
              <button
                type="button"
                onClick={() => {
                  void updateJobStatus(selectedJob.id, "issue");
                  setDetailOpen(false);
                }}
                className="w-full rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-600"
              >
                Report Issue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OPTIMIZE MODAL */}
      {optimizeOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <h2 className="text-lg font-semibold text-stone-900">
                  Optimize schedule
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOptimizeOpen(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {/* Config inputs */}
              {!optimizeResult && (
                <div className="space-y-4">
                  {/* Installer selector */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-400">
                      Installer
                    </label>
                    <select
                      value={optimizeInstallerId}
                      onChange={(e) => setOptimizeInstallerId(e.target.value)}
                      className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-primary focus:outline-none"
                    >
                      <option value="">Select installer...</option>
                      {installers.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Start time */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-400">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={optimizeStartTime}
                      onChange={(e) => setOptimizeStartTime(e.target.value)}
                      className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-primary focus:outline-none"
                    />
                  </div>

                  {/* Start location */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-400">
                      Start Location
                    </label>
                    <select
                      value={optimizeStartLocation}
                      onChange={(e) => setOptimizeStartLocation(e.target.value)}
                      className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-primary focus:outline-none"
                    >
                      <option value="Ellsworth">Ellsworth showroom</option>
                      <option value="Lindsay">Lindsay showroom</option>
                      <option value="custom">Custom address</option>
                    </select>
                    {optimizeStartLocation === "custom" && (
                      <input
                        type="text"
                        value={optimizeCustomAddress}
                        onChange={(e) => setOptimizeCustomAddress(e.target.value)}
                        placeholder="Enter start address..."
                        className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-primary focus:outline-none"
                      />
                    )}
                  </div>

                  {/* Loading status */}
                  {optimizeLoading && (
                    <div className="flex items-center gap-2 rounded-lg bg-primary/5 px-4 py-3">
                      <svg className="h-4 w-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="text-sm font-medium text-primary">
                        {optimizeStatus}
                      </span>
                    </div>
                  )}

                  {/* Error status */}
                  {!optimizeLoading && optimizeStatus && (
                    <p className="text-sm text-rose-600">{optimizeStatus}</p>
                  )}

                  <button
                    type="button"
                    onClick={() => void runOptimization()}
                    disabled={optimizeLoading || !optimizeInstallerId}
                    className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Calculate optimal route
                  </button>
                </div>
              )}

              {/* Results preview */}
              {optimizeResult && (
                <div>
                  {/* Summary */}
                  <div className="mb-4 rounded-lg bg-stone-50 px-4 py-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span className="text-stone-600">
                        Total drive time:{" "}
                        <strong className="text-stone-900">
                          {formatDuration(optimizeResult.total_drive_minutes)}
                        </strong>
                      </span>
                      <span className="text-stone-600">
                        Total work time:{" "}
                        <strong className="text-stone-900">
                          {formatDuration(optimizeResult.total_work_minutes)}
                        </strong>
                      </span>
                      {optimizeResult.end_time && (
                        <span className="text-stone-600">
                          End time:{" "}
                          <strong className="text-stone-900">
                            ~{formatTime(optimizeResult.end_time)}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Optimized job list */}
                  <div className="mb-4 max-h-[300px] space-y-2 overflow-y-auto">
                    {optimizeResult.schedule.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 rounded-lg border border-stone-100 bg-white px-3 py-2"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                          {item.optimized_sequence}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-stone-900">
                            {item.customer_name}
                          </p>
                          <p className="truncate text-xs text-stone-500">
                            {item.address}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-stone-400">
                            <span>
                              {formatTime(item.start_time)} – {formatTime(item.end_time)}
                            </span>
                            <span>
                              {formatDuration(item.estimated_duration)} work
                            </span>
                            {item.drive_time_minutes > 0 && (
                              <span className="text-sky-600">
                                {item.drive_time_minutes}min drive
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setOptimizeResult(null)}
                      className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => void applyOptimization()}
                      className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                    >
                      Apply this schedule
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Undo toast */}
      {undoAction && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-stone-900 px-5 py-3 text-sm text-white shadow-lg">
          <span>Job reassigned</span>
          <button
            type="button"
            onClick={() => void undoAssign()}
            className="font-semibold text-primary hover:underline"
          >
            Undo
          </button>
        </div>
      )}

      {/* General toast */}
      {toastMessage && !undoAction && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-stone-900 px-5 py-3 text-sm text-white shadow-lg">
          <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline Row
// ---------------------------------------------------------------------------

function TimelineRow({
  label,
  installerId,
  jobs,
  selectedJobId,
  onDrop,
  onJobClick,
}: {
  label: string;
  installerId: string | null;
  jobs: Job[];
  selectedJobId: string | null;
  onDrop: (e: React.DragEvent, installerId: string | null, slotIndex: number) => void;
  onJobClick: (job: Job) => void;
}) {
  return (
    <div className="flex border-b border-stone-100" style={{ minHeight: 56 }}>
      {/* Row label */}
      <div className="flex w-[160px] min-w-[160px] items-center gap-2 border-r border-stone-200 bg-[#1C1C1C] px-3">
        <span
          className={`h-2 w-2 rounded-full ${
            installerId ? "bg-emerald-400" : "bg-stone-500"
          }`}
        />
        <span className="truncate text-xs font-medium text-white">
          {label}
        </span>
      </div>

      {/* Timeline slots */}
      <div className="relative flex">
        {Array.from({ length: TIMELINE_SLOTS }).map((_, i) => (
          <div
            key={i}
            className="border-r border-stone-50 hover:bg-primary/5"
            style={{ width: SLOT_WIDTH, minWidth: SLOT_WIDTH, height: "100%" }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, installerId, i)}
          />
        ))}

        {/* Job blocks */}
        {jobs.map((job) => {
          const mins = jobMinutesFromMidnight(job);
          const startSlot = (mins - TIMELINE_START * 60) / 30;
          const durationSlots = job.duration_minutes / 30;
          const left = startSlot * SLOT_WIDTH;
          const width = durationSlots * SLOT_WIDTH;
          const color = STATUS_MARKER_COLOR[job.status] ?? "#FF4900";

          if (left < 0) return null;

          return (
            <div
              key={job.id}
              draggable
              onDragStart={(e) =>
                e.dataTransfer.setData("text/plain", job.id)
              }
              onClick={() => onJobClick(job)}
              className={`absolute top-1 cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium text-white shadow-sm transition hover:opacity-90 ${
                selectedJobId === job.id ? "ring-2 ring-white ring-offset-1" : ""
              }`}
              style={{
                left,
                width: Math.max(width, SLOT_WIDTH),
                backgroundColor: color,
                height: "calc(100% - 8px)",
              }}
            >
              <div className="truncate font-semibold">
                {customerDisplayName(job.customers)}
              </div>
              <div className="truncate text-white/80">
                {abbrevAddress(job.customers, job.address)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
