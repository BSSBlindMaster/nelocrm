"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import { useEffect, useRef } from "react";

interface MapJob {
  id: string;
  lat?: number | null;
  lng?: number | null;
  customer_name: string;
  address: string;
  status: string;
  scheduled_at?: string | null;
  installer_name: string;
}

interface DispatchMapProps {
  jobs: MapJob[];
  selectedJobId: string | null;
  onJobClick: (jobId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#FF4900",
  complete: "#10b981",
  in_progress: "#3b82f6",
  issue: "#ef4444",
};

export default function DispatchMap({ jobs, selectedJobId, onJobClick }: DispatchMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const mapboxgl = require("mapbox-gl");
    require("mapbox-gl/dist/mapbox-gl.css");

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_KEY;

    mapInstance.current = new mapboxgl.Map({
      container: mapRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-111.891, 33.4152],
      zoom: 10,
    });

    mapInstance.current.addControl(new mapboxgl.NavigationControl(), "top-left");

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update markers when jobs change
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    const mapboxgl = require("mapbox-gl");

    // Clear old markers
    markersRef.current.forEach((m: any) => m.remove());
    markersRef.current = [];

    // Remove old route
    try {
      if (map.getSource("route")) {
        map.removeLayer("route-line");
        map.removeSource("route");
      }
    } catch {
      // ignore if style not loaded yet
    }

    const jobsWithCoords = jobs.filter((j) => j.lat && j.lng);
    const bounds = new mapboxgl.LngLatBounds();
    const routeCoords: [number, number][] = [];

    jobsWithCoords.forEach((job, idx) => {
      const color = STATUS_COLORS[job.status] ?? "#FF4900";
      const el = document.createElement("div");
      el.style.cssText = `
        background:${color};color:white;width:28px;height:28px;
        border-radius:50%;display:flex;align-items:center;
        justify-content:center;font-weight:bold;font-size:12px;
        cursor:pointer;border:2px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,0.3);
      `;
      if (selectedJobId === job.id) {
        el.style.transform = "scale(1.3)";
        el.style.zIndex = "10";
      }
      el.innerText = String(idx + 1);
      el.onclick = () => onJobClick(job.id);

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="font-family:system-ui;font-size:13px;max-width:220px;">
          <strong>${job.customer_name}</strong><br/>
          <span style="color:#666">${job.address}</span><br/>
          <span>${job.scheduled_at ? new Date(job.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "Unscheduled"}</span><br/>
          <span>Installer: ${job.installer_name}</span><br/>
          <span style="color:${color};font-weight:600;text-transform:capitalize">${job.status.replace("_", " ")}</span>
        </div>
      `);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([job.lng!, job.lat!])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
      bounds.extend([job.lng!, job.lat!]);
      routeCoords.push([job.lng!, job.lat!]);
    });

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
      };

      if (map.isStyleLoaded()) {
        addRoute();
      } else {
        map.on("load", addRoute);
      }
    }
  }, [jobs, selectedJobId, onJobClick]);

  return (
    <div style={{ position: "relative", width: "100%", height: "400px" }}>
      <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
