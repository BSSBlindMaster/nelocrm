"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type mapboxgl from "mapbox-gl";
import { Sidebar } from "@/components/Sidebar";
import {
  getActiveAppUsers,
  getCurrentAppUser,
  type ActiveAppUser,
  type CurrentAppUser,
} from "@/lib/current-app-user";
import { type DispatchJob } from "@/lib/dispatch-samples";
import { sendSMS } from "@/lib/twilio";
import { supabase } from "@/lib/supabase";

type JobFilter = "all" | "unassigned" | "scheduled" | "in_progress" | "complete";
type MapStyleMode = "streets" | "satellite";

type DetailJob = DispatchJob & {
  assignedInstallerId?: string | null;
};

type UndoState = {
  jobId: string;
  assignedTo: string | null;
  scheduledAt: string;
  durationMinutes: number;
  message: string;
};

const MAPBOX_STYLE = {
  streets: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
} satisfies Record<MapStyleMode, string>;

const STATUS_COLORS: Record<DispatchJob["status"], string> = {
  scheduled: "#FF4900",
  in_progress: "#1A6BC4",
  complete: "#2DA44E",
  issue: "#A32D2D",
};

const JOB_TYPE_TONES: Record<DispatchJob["job_type"], string> = {
  Install: "bg-orange-100 text-orange-700",
  Repair: "bg-amber-100 text-amber-700",
  Measure: "bg-sky-100 text-sky-700",
  Service: "bg-rose-100 text-rose-700",
};

const FILTER_LABELS: Array<{ key: JobFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "unassigned", label: "Unassigned" },
  { key: "scheduled", label: "Scheduled" },
  { key: "in_progress", label: "In Progress" },
  { key: "complete", label: "Complete" },
];

const TIMELINE_START_HOUR = 7;
const TIMELINE_END_HOUR = 19;
const SLOT_MINUTES = 30;
const SLOT_WIDTH = 72;

function formatFullDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatApiDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatTimeRange(startIso: string, durationMinutes: number) {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  return `${start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })} - ${end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function formatShortTime(startIso: string) {
  return new Date(startIso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getInstallerInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getMinutesFromTimelineStart(iso: string) {
  const date = new Date(iso);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return Math.max(0, (hours - TIMELINE_START_HOUR) * 60 + minutes);
}

function buildScheduledAt(date: Date, minutesFromStart: number) {
  const next = new Date(date);
  next.setHours(TIMELINE_START_HOUR, 0, 0, 0);
  next.setMinutes(next.getMinutes() + minutesFromStart);
  return next.toISOString();
}

function toneForStatus(status: DispatchJob["status"]) {
  if (status === "complete") {
    return "border-emerald-500";
  }
  if (status === "in_progress") {
    return "border-sky-500";
  }
  if (status === "issue") {
    return "border-rose-600";
  }
  return "border-[#FF4900]";
}

function countByFilter(jobs: DetailJob[], filter: JobFilter) {
  if (filter === "all") return jobs.length;
  if (filter === "unassigned") return jobs.filter((job) => !job.assigned_to).length;
  return jobs.filter((job) => job.status === filter).length;
}

function buildGeoJson(jobs: DetailJob[]) {
  return {
    type: "FeatureCollection" as const,
    features: jobs.map((job, index) => ({
      type: "Feature" as const,
      properties: {
        id: job.job_id,
        sequence: String(index + 1),
        customer_name: job.customer_name,
        address: job.address,
        installer: job.assigned_to_name,
        status: job.status,
        time: formatTimeRange(job.scheduled_at, job.duration_minutes),
        color: STATUS_COLORS[job.status],
      },
      geometry: {
        type: "Point" as const,
        coordinates: [job.lng, job.lat],
      },
    })),
  };
}

function buildRouteGeoJson(jobs: DetailJob[]) {
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates: jobs.map((job) => [job.lng, job.lat]),
        },
      },
    ],
  };
}

function InstallerRow({
  label,
  dotColor,
}: {
  label: string;
  dotColor?: string;
}) {
  return (
    <div className="flex h-16 items-center gap-3 border-b border-white/10 bg-[#1C1C1C] px-4 text-sm font-medium text-white">
      {dotColor ? (
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
      ) : (
        <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
      )}
      <span className="truncate">{label}</span>
    </div>
  );
}

export default function DispatchPage() {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [currentUser, setCurrentUser] = useState<CurrentAppUser | null>(null);
  const [installers, setInstallers] = useState<ActiveAppUser[]>([]);
  const [jobs, setJobs] = useState<DetailJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return today;
  });
  const [jobFilter, setJobFilter] = useState<JobFilter>("all");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [mapStyleMode, setMapStyleMode] = useState<MapStyleMode>("streets");
  const [liveTracking, setLiveTracking] = useState(false);
  const [detailDraft, setDetailDraft] = useState<{
    assignedTo: string;
    scheduledAt: string;
    durationMinutes: number;
    notes: string;
  } | null>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  async function fitMapToVisibleJobs(targetJobs: DetailJob[]) {
    const map = mapRef.current;
    if (!map || targetJobs.length === 0) {
      return;
    }

    const mapboxModule = await import("mapbox-gl");
    const bounds = new mapboxModule.default.LngLatBounds();
    targetJobs.forEach((job) => bounds.extend([job.lng, job.lat]));
    bounds.extend([-111.891, 33.4152]);
    map.fitBounds(bounds, { padding: 48, maxZoom: 12, duration: 500 });
  }

  useEffect(() => {
    let isMounted = true;

    async function loadPeople() {
      const [user, users] = await Promise.all([getCurrentAppUser(), getActiveAppUsers()]);
      if (!isMounted) {
        return;
      }
      setCurrentUser(user);
      setInstallers(users.filter((appUser) => appUser.roleName === "Installer"));
    }

    void loadPeople();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadJobs() {
      setIsLoading(true);

      const response = await fetch(`/api/dispatch/jobs?date=${formatApiDate(selectedDate)}`);
      const payload = (await response.json()) as { jobs?: DispatchJob[] };
      if (!isMounted) {
        return;
      }

      const rows = (payload.jobs ?? []).map((job) => ({
        ...job,
        assignedInstallerId: job.assigned_to ?? null,
      }));

      setJobs(rows);
      setSelectedJobId((previous) => previous ?? rows[0]?.job_id ?? null);
      setIsLoading(false);
    }

    void loadJobs();

    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  const filteredJobs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return jobs.filter((job) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        job.customer_name.toLowerCase().includes(normalizedSearch) ||
        job.address.toLowerCase().includes(normalizedSearch) ||
        job.assigned_to_name.toLowerCase().includes(normalizedSearch);

      if (!matchesSearch) {
        return false;
      }

      if (jobFilter === "unassigned") {
        return !job.assigned_to;
      }

      if (jobFilter === "all") {
        return true;
      }

      return job.status === jobFilter;
    });
  }, [jobFilter, jobs, searchTerm]);

  const selectedJob = useMemo(
    () => filteredJobs.find((job) => job.job_id === selectedJobId) ?? jobs.find((job) => job.job_id === selectedJobId) ?? null,
    [filteredJobs, jobs, selectedJobId],
  );

  useEffect(() => {
    if (!selectedJob) {
      setDetailDraft(null);
      return;
    }

    setDetailDraft({
      assignedTo: selectedJob.assigned_to ?? "",
      scheduledAt: selectedJob.scheduled_at.slice(0, 16),
      durationMinutes: selectedJob.duration_minutes,
      notes: selectedJob.notes ?? "",
    });
  }, [selectedJob]);

  useEffect(() => {
    let ignore = false;
    let localMap: mapboxgl.Map | null = null;

    async function initMap() {
      if (!mapNodeRef.current) {
        return;
      }

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      const mapboxModule = await import("mapbox-gl");
      const mapbox = mapboxModule.default;
      mapbox.accessToken = process.env.NEXT_PUBLIC_MAPBOX_KEY ?? "";

      const map = new mapbox.Map({
        container: mapNodeRef.current,
        style: MAPBOX_STYLE[mapStyleMode],
        center: [-111.891, 33.4152],
        zoom: 10,
      });
      localMap = map;

      map.addControl(new mapbox.NavigationControl({ visualizePitch: false }), "top-left");
      popupRef.current = new mapbox.Popup({ closeButton: false, closeOnClick: false, offset: 18 });
      mapRef.current = map;

      map.on("load", () => {
        if (ignore) {
          return;
        }

        map.addSource("dispatch-jobs", {
          type: "geojson",
          data: buildGeoJson(filteredJobs),
          cluster: true,
          clusterRadius: 40,
        });

        map.addSource("dispatch-route", {
          type: "geojson",
          data: buildRouteGeoJson(filteredJobs),
        });

        map.addSource("dispatch-office", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { label: "Office" },
                geometry: {
                  type: "Point",
                  coordinates: [-111.891, 33.4152],
                },
              },
            ],
          },
        });

        map.addLayer({
          id: "dispatch-route-line",
          type: "line",
          source: "dispatch-route",
          paint: {
            "line-color": "#FF4900",
            "line-width": 3,
            "line-opacity": 0.5,
          },
        });

        map.addLayer({
          id: "dispatch-clusters",
          type: "circle",
          source: "dispatch-jobs",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#1C1C1C",
            "circle-stroke-color": "#FF4900",
            "circle-stroke-width": 2,
            "circle-radius": 18,
          },
        });

        map.addLayer({
          id: "dispatch-cluster-count",
          type: "symbol",
          source: "dispatch-jobs",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 12,
          },
          paint: {
            "text-color": "#ffffff",
          },
        });

        map.addLayer({
          id: "dispatch-job-points",
          type: "circle",
          source: "dispatch-jobs",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": 15,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });

        map.addLayer({
          id: "dispatch-job-labels",
          type: "symbol",
          source: "dispatch-jobs",
          filter: ["!", ["has", "point_count"]],
          layout: {
            "text-field": ["get", "sequence"],
            "text-size": 11,
            "text-allow-overlap": true,
          },
          paint: {
            "text-color": "#ffffff",
          },
        });

        map.addLayer({
          id: "dispatch-office-marker",
          type: "symbol",
          source: "dispatch-office",
          layout: {
            "icon-image": "town-hall",
            "icon-size": 1,
            "text-field": ["get", "label"],
            "text-offset": [0, 1.1],
            "text-size": 11,
          },
          paint: {
            "text-color": "#1C1C1C",
          },
        });

        map.on("click", "dispatch-clusters", (event) => {
          const features = map.queryRenderedFeatures(event.point, {
            layers: ["dispatch-clusters"],
          });
          const feature = features[0];
          const clusterId = feature?.properties?.cluster_id;
          if (clusterId == null) {
            return;
          }
          const source = map.getSource("dispatch-jobs") as mapboxgl.GeoJSONSource & {
            getClusterExpansionZoom?: (
              clusterId: number,
              callback: (error: Error | null, zoom: number) => void,
            ) => void;
          };
          source.getClusterExpansionZoom?.(clusterId, (error, zoom) => {
            if (error) return;
            const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
            map.easeTo({ center: coordinates, zoom: typeof zoom === "number" ? zoom : 12 });
          });
        });

        map.on("click", "dispatch-job-points", (event) => {
          const feature = event.features?.[0];
          if (!feature) {
            return;
          }
          const properties = feature.properties as Record<string, string>;
          const id = properties.id;
          setSelectedJobId(id);
          popupRef.current
            ?.setLngLat((feature.geometry as GeoJSON.Point).coordinates as [number, number])
            .setHTML(
              `<div style="padding:4px 6px; min-width:220px;">
                <div style="font-weight:600; color:#1C1C1C;">${properties.customer_name}</div>
                <div style="font-size:12px; color:#57534E; margin-top:4px;">${properties.address}</div>
                <div style="font-size:12px; color:#57534E; margin-top:6px;">${properties.time}</div>
                <div style="font-size:12px; color:#57534E;">${properties.installer}</div>
              </div>`,
            )
            .addTo(map);
        });

        map.on("mouseenter", "dispatch-job-points", () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", "dispatch-job-points", () => {
          map.getCanvas().style.cursor = "";
        });
      });
    }

    void initMap();

    return () => {
      ignore = true;
      popupRef.current?.remove();
      if (localMap) {
        localMap.remove();
      }
      mapRef.current = null;
    };
  }, [mapStyleMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const geoJson = buildGeoJson(filteredJobs);
    const route = buildRouteGeoJson(filteredJobs);

    const applyUpdates = () => {
      const jobsSource = map.getSource("dispatch-jobs") as mapboxgl.GeoJSONSource | undefined;
      const routeSource = map.getSource("dispatch-route") as mapboxgl.GeoJSONSource | undefined;
      jobsSource?.setData(geoJson);
      routeSource?.setData(route);

      void fitMapToVisibleJobs(filteredJobs);
    };

    if (map.isStyleLoaded()) {
      applyUpdates();
    } else {
      map.once("style.load", applyUpdates);
    }
  }, [filteredJobs]);

  useEffect(() => {
    if (!selectedJobId) {
      return;
    }

    cardRefs.current[selectedJobId]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [selectedJobId]);

  useEffect(() => {
    if (!undoState) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setUndoState(null);
    }, 6000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [undoState]);

  useEffect(() => {
    if (!statusMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setStatusMessage("");
    }, 4000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [statusMessage]);

  async function refreshJobs(dateOverride?: Date) {
    const response = await fetch(`/api/dispatch/jobs?date=${formatApiDate(dateOverride ?? selectedDate)}`);
    const payload = (await response.json()) as { jobs?: DispatchJob[] };
    const rows = (payload.jobs ?? []).map((job) => ({
      ...job,
      assignedInstallerId: job.assigned_to ?? null,
    }));
    setJobs(rows);
  }

  async function applyAssignment(job: DetailJob, assignedTo: string | null, scheduledAt: string, durationMinutes: number) {
    const response = await fetch("/api/dispatch/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: job.job_id,
        assignedTo,
        scheduledAt,
        durationMinutes,
      }),
    });

    if (!response.ok) {
      setStatusMessage("We couldn’t update that job. Please try again.");
      return;
    }

    setUndoState({
      jobId: job.job_id,
      assignedTo: job.assigned_to ?? null,
      scheduledAt: job.scheduled_at,
      durationMinutes: job.duration_minutes,
      message: "Job rescheduled",
    });
    setStatusMessage("Assignment updated.");
    await refreshJobs();
  }

  async function updateJobStatus(jobId: string, status: DispatchJob["status"]) {
    await supabase.from("jobs").update({ status }).eq("id", jobId);
    await refreshJobs();
    setStatusMessage(status === "complete" ? "Job marked complete." : "Job updated.");
  }

  async function saveDetailChanges() {
    if (!selectedJob || !detailDraft) {
      return;
    }

    const scheduledAtIso = new Date(detailDraft.scheduledAt).toISOString();
    await supabase
      .from("jobs")
      .update({
        assigned_to: detailDraft.assignedTo || null,
        installer_id: detailDraft.assignedTo || null,
        scheduled_at: scheduledAtIso,
        duration_minutes: detailDraft.durationMinutes,
        notes: detailDraft.notes,
      })
      .eq("id", selectedJob.job_id);

    await refreshJobs();
    setStatusMessage("Dispatch details saved.");
  }

  async function sendInstallerNotification(job: DetailJob) {
    if (!job.assigned_to_phone) {
      setStatusMessage("This installer does not have a phone number saved.");
      return;
    }

    await sendSMS(
      job.assigned_to_phone,
      `Dispatch update: ${job.customer_name} at ${job.address} on ${new Date(job.scheduled_at).toLocaleDateString("en-US")} at ${formatShortTime(job.scheduled_at)}.`,
    );
    setStatusMessage("Installer notification sent.");
  }

  async function sendOnMyWay(job: DetailJob) {
    if (!job.phone) {
      setStatusMessage("This customer does not have a phone number saved.");
      return;
    }

    await sendSMS(
      job.phone,
      `Nelo update: your installer is on the way for ${formatShortTime(job.scheduled_at)} at ${job.address}.`,
    );
    setStatusMessage("Customer notification sent.");
  }

  async function reportIssue(job: DetailJob) {
    await supabase.from("service_tickets").insert({
      project_id: job.project_id,
      customer_id: job.customer_id,
      description: `Dispatch issue reported for ${job.customer_name}`,
      resolution_notes: job.notes ?? "",
      status: "open",
    });
    await supabase.from("jobs").update({ status: "issue" }).eq("id", job.job_id);
    await refreshJobs();
    setStatusMessage("Issue reported and service ticket created.");
  }

  const timelineRows = useMemo(() => {
    return [
      { id: "unassigned", label: "Unassigned", jobs: filteredJobs.filter((job) => !job.assigned_to), color: undefined },
      ...installers.map((installer, index) => ({
        id: installer.id,
        label: installer.fullName,
        jobs: filteredJobs.filter((job) => job.assigned_to === installer.id),
        color: ["#FF4900", "#1A6BC4", "#2DA44E", "#BA7517"][index % 4],
      })),
    ];
  }, [filteredJobs, installers]);

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = TIMELINE_START_HOUR; hour < TIMELINE_END_HOUR; hour += 1) {
      slots.push(
        new Date(2026, 0, 1, hour, 0).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
      );
      slots.push(
        new Date(2026, 0, 1, hour, 30).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
      );
    }
    return slots;
  }, []);

  const rowWidth = timeSlots.length * SLOT_WIDTH;

  const currentDateLabel = useMemo(() => formatFullDate(selectedDate), [selectedDate]);

  return (
    <div className="flex min-h-screen bg-stone-100">
      <Sidebar current="Dispatch" />

      <div className="flex h-screen flex-1 overflow-hidden">
        <section className="flex h-full w-[380px] shrink-0 flex-col border-r border-stone-200 bg-white">
          <div className="border-b border-stone-200 px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
                  Dispatch board
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                  Dispatch
                </h1>
                {currentUser ? (
                  <p className="mt-1 text-sm text-stone-500">Signed in as {currentUser.fullName}</p>
                ) : null}
              </div>
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                {filteredJobs.length} jobs
              </span>
            </div>

            <div className="mt-4">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search jobs..."
                className="h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm shadow-sm outline-none ring-0 transition focus:border-primary"
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = new Date(selectedDate);
                  next.setDate(next.getDate() - 1);
                  setSelectedDate(next);
                }}
                className="rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300"
              >
                Previous day
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = new Date();
                  next.setHours(12, 0, 0, 0);
                  setSelectedDate(next);
                }}
                className="rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = new Date(selectedDate);
                  next.setDate(next.getDate() + 1);
                  setSelectedDate(next);
                }}
                className="rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300"
              >
                Next day
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-stone-100 px-4 py-3 text-sm font-medium text-stone-700">
              {currentDateLabel}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {FILTER_LABELS.map((filter) => {
                const isActive = jobFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setJobFilter(filter.key)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                      isActive
                        ? "bg-primary text-white"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {filter.label} · {countByFilter(jobs, filter.key)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="h-28 animate-pulse rounded-3xl bg-stone-100" />
                ))}
              </div>
            ) : null}

            {!isLoading && filteredJobs.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center text-sm text-stone-500">
                No dispatch jobs match this view yet.
              </div>
            ) : null}

            {!isLoading ? (
              <div className="space-y-3">
                {filteredJobs.map((job) => (
                  <button
                    key={job.job_id}
                    ref={(node) => {
                      cardRefs.current[job.job_id] = node;
                    }}
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", job.job_id);
                    }}
                    onClick={() => setSelectedJobId(job.job_id)}
                    className={`w-full rounded-3xl border border-stone-200 border-l-4 bg-white p-4 text-left shadow-sm transition hover:border-stone-300 ${toneForStatus(
                      job.status,
                    )} ${selectedJobId === job.job_id ? "ring-2 ring-primary/25" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${JOB_TYPE_TONES[job.job_type]}`}>
                          {job.job_type}
                        </span>
                        <p className="mt-3 text-base font-semibold text-stone-950">
                          {job.customer_name}
                        </p>
                        <p className="mt-1 text-sm text-stone-500">📍 {job.address}</p>
                      </div>
                      <span className="cursor-grab text-stone-300">⋮⋮</span>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-stone-700">
                          {formatTimeRange(job.scheduled_at, job.duration_minutes)}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white">
                            {getInstallerInitials(job.assigned_to_name)}
                          </span>
                          <span className="text-sm text-stone-600">{job.assigned_to_name}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void updateJobStatus(job.job_id, "complete");
                        }}
                        className="h-12 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:opacity-95"
                      >
                        COMPLETE
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="relative basis-[55%] border-b border-stone-200 bg-white">
            <div ref={mapNodeRef} className="h-full w-full" />

            <div className="absolute right-4 top-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setLiveTracking((value) => !value)}
                className={`h-11 rounded-2xl px-4 text-sm font-semibold shadow-sm transition ${
                  liveTracking ? "bg-primary text-white" : "bg-white text-stone-700"
                }`}
              >
                LIVE TRACKING {liveTracking ? "ON" : "OFF"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const map = mapRef.current;
                  if (!map || filteredJobs.length === 0) return;
                  void fitMapToVisibleJobs(filteredJobs);
                }}
                className="h-11 rounded-2xl bg-white px-4 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50"
              >
                Fit all jobs
              </button>
              <button
                type="button"
                onClick={() =>
                  setMapStyleMode((currentMode) =>
                    currentMode === "streets" ? "satellite" : "streets",
                  )
                }
                className="h-11 rounded-2xl bg-white px-4 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50"
              >
                {mapStyleMode === "streets" ? "Satellite" : "Streets"}
              </button>
            </div>
          </div>

          <div className="basis-[45%] overflow-hidden bg-white">
            <div className="border-b border-stone-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-stone-950">Installer timeline</h2>
              <p className="mt-1 text-sm text-stone-500">
                Drag a job to another installer or time slot to reschedule.
              </p>
            </div>

            <div className="flex h-[calc(100%-77px)] min-h-0">
              <div className="w-[180px] shrink-0 border-r border-stone-200">
                <div className="h-12 border-b border-white/10 bg-[#1C1C1C] px-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/40" />
                {timelineRows.map((row) => (
                  <InstallerRow key={row.id} label={row.label} dotColor={row.color} />
                ))}
              </div>

              <div ref={timelineScrollRef} className="min-w-0 flex-1 overflow-auto">
                <div style={{ width: rowWidth }}>
                  <div className="grid h-12 border-b border-stone-200 bg-stone-50" style={{ gridTemplateColumns: `repeat(${timeSlots.length}, minmax(${SLOT_WIDTH}px, 1fr))` }}>
                    {timeSlots.map((slot) => (
                      <div key={slot} className="border-r border-stone-200 px-2 py-3 text-xs font-semibold text-stone-500">
                        {slot}
                      </div>
                    ))}
                  </div>

                  {timelineRows.map((row) => (
                    <div
                      key={row.id}
                      className="relative h-16 border-b border-stone-200 bg-white"
                      onDragOver={(event) => {
                        event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const jobId = event.dataTransfer.getData("text/plain");
                        const job = jobs.find((item) => item.job_id === jobId);
                        if (!job) {
                          return;
                        }
                        const container = event.currentTarget.getBoundingClientRect();
                        const offsetX = event.clientX - container.left + event.currentTarget.scrollLeft;
                        const slotIndex = Math.max(0, Math.min(timeSlots.length - 1, Math.round(offsetX / SLOT_WIDTH)));
                        const minutesFromStart = slotIndex * SLOT_MINUTES;
                        const nextScheduledAt = buildScheduledAt(selectedDate, minutesFromStart);
                        const nextAssignee = row.id === "unassigned" ? null : row.id;
                        void applyAssignment(job, nextAssignee, nextScheduledAt, job.duration_minutes);
                      }}
                    >
                      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${timeSlots.length}, minmax(${SLOT_WIDTH}px, 1fr))` }}>
                        {timeSlots.map((slot) => (
                          <div key={`${row.id}-${slot}`} className="border-r border-stone-100" />
                        ))}
                      </div>

                      {row.jobs.map((job) => {
                        const left = (getMinutesFromTimelineStart(job.scheduled_at) / SLOT_MINUTES) * SLOT_WIDTH;
                        const width = Math.max(SLOT_WIDTH * 1.5, (job.duration_minutes / SLOT_MINUTES) * SLOT_WIDTH);
                        return (
                          <button
                            key={job.job_id}
                            type="button"
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.setData("text/plain", job.job_id);
                            }}
                            onClick={() => setSelectedJobId(job.job_id)}
                            className={`absolute top-2 h-12 overflow-hidden rounded-2xl px-3 text-left shadow-sm transition ${
                              selectedJobId === job.job_id ? "ring-2 ring-primary/30" : ""
                            }`}
                            style={{
                              left,
                              width,
                              backgroundColor: STATUS_COLORS[job.status],
                              color: "#ffffff",
                            }}
                          >
                            <p className="truncate text-sm font-semibold">{job.customer_name}</p>
                            <p className="truncate text-[11px] text-white/85">
                              {job.address.replace(", Mesa, AZ", "")}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {selectedJob && detailDraft ? (
          <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-stone-200 bg-white">
            <div className="border-b border-stone-200 px-5 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
                    Job details
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-stone-950">
                    {selectedJob.customer_name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedJobId(null)}
                  className="rounded-full bg-stone-100 px-3 py-1 text-sm font-medium text-stone-600"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <div className="rounded-3xl bg-stone-50 p-4">
                <p className="text-sm font-semibold text-stone-900">{selectedJob.customer_name}</p>
                <a href={`tel:${selectedJob.phone}`} className="mt-2 block text-sm text-primary hover:underline">
                  {selectedJob.phone || "No phone saved"}
                </a>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedJob.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block text-sm text-stone-600 hover:text-stone-900"
                >
                  {selectedJob.address}
                </a>
                {selectedJob.gate_code ? (
                  <div className="mt-3 rounded-2xl bg-orange-100 px-3 py-2 text-sm font-semibold text-orange-700">
                    Gate code: {selectedJob.gate_code}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700">
                    Assigned installer
                  </label>
                  <select
                    value={detailDraft.assignedTo}
                    onChange={(event) =>
                      setDetailDraft((current) =>
                        current ? { ...current, assignedTo: event.target.value } : current,
                      )
                    }
                    className="h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm"
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
                  <label className="mb-2 block text-sm font-medium text-stone-700">
                    Scheduled time
                  </label>
                  <input
                    type="datetime-local"
                    value={detailDraft.scheduledAt}
                    onChange={(event) =>
                      setDetailDraft((current) =>
                        current ? { ...current, scheduledAt: event.target.value } : current,
                      )
                    }
                    className="h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700">
                    Duration
                  </label>
                  <input
                    type="number"
                    min={30}
                    step={30}
                    value={detailDraft.durationMinutes}
                    onChange={(event) =>
                      setDetailDraft((current) =>
                        current
                          ? {
                              ...current,
                              durationMinutes: Number(event.target.value) || 90,
                            }
                          : current,
                      )
                    }
                    className="h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700">
                    Notes
                  </label>
                  <textarea
                    value={detailDraft.notes}
                    onChange={(event) =>
                      setDetailDraft((current) =>
                        current ? { ...current, notes: event.target.value } : current,
                      )
                    }
                    rows={4}
                    className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm"
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-stone-200 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
                  Products to install
                </h3>
                <div className="mt-4 space-y-3">
                  {selectedJob.products.length > 0 ? (
                    selectedJob.products.map((product) => (
                      <div key={product.id} className="rounded-2xl bg-stone-50 px-3 py-3">
                        <p className="text-sm font-semibold text-stone-900">{product.name}</p>
                        <p className="mt-1 text-sm text-stone-600">
                          {product.color} · {product.lift_option}
                        </p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-stone-400">
                          Qty {product.quantity}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-stone-500">No quote line items were found for this job.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-stone-200 px-5 py-5">
              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => void sendInstallerNotification(selectedJob)}
                  className="h-12 rounded-2xl border border-stone-200 px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-300"
                >
                  Send notification to installer
                </button>
                <button
                  type="button"
                  onClick={() => void sendOnMyWay(selectedJob)}
                  className="h-12 rounded-2xl border border-stone-200 px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-300"
                >
                  Send on-my-way to customer
                </button>
                <button
                  type="button"
                  onClick={() => void updateJobStatus(selectedJob.job_id, "complete")}
                  className="h-12 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:opacity-95"
                >
                  Mark complete
                </button>
                <button
                  type="button"
                  onClick={() => void reportIssue(selectedJob)}
                  className="h-12 rounded-2xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:opacity-95"
                >
                  Report issue
                </button>
                <button
                  type="button"
                  onClick={() => void saveDetailChanges()}
                  className="h-12 rounded-2xl bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-95"
                >
                  Save dispatch updates
                </button>
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      {undoState ? (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#1C1C1C] px-4 py-3 text-sm text-white shadow-2xl">
          <span>{undoState.message}</span>
          <button
            type="button"
            onClick={() => {
              const job = jobs.find((item) => item.job_id === undoState.jobId);
              if (!job) {
                return;
              }
              void applyAssignment(
                job,
                undoState.assignedTo,
                undoState.scheduledAt,
                undoState.durationMinutes,
              );
              setUndoState(null);
            }}
            className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white"
          >
            Undo
          </button>
        </div>
      ) : null}

      {statusMessage ? (
        <div className="fixed bottom-6 right-6 z-40 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-stone-700 shadow-xl">
          {statusMessage}
        </div>
      ) : null}

      {!selectedJob && (
        <div className="pointer-events-none absolute right-8 top-8 hidden rounded-2xl bg-white/90 px-4 py-3 text-sm text-stone-600 shadow-lg backdrop-blur md:block">
          Click any job card or timeline block to open dispatch details.
        </div>
      )}
    </div>
  );
}
