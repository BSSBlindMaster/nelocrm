"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CurrentAppUser } from "@/lib/current-app-user";
import { normalizeJobNumber } from "@/lib/nelo-format";
import type { SampleProject } from "@/lib/project-samples";
import { supabase } from "@/lib/supabase";

type InstallerViewProps = {
  project: SampleProject;
  projectId: string;
  currentUser: CurrentAppUser | null;
};

type LineItemState = {
  status: "pending" | "installed" | "problem";
  problemDescription: string;
  resolutionNotes: string;
  photoName?: string;
};

type ClockEntry = {
  id?: string;
  clockIn?: string | null;
  clockOut?: string | null;
  laborMinutes?: number | null;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h ${remaining}m`;
}

function mapUrlForAddress(address: string) {
  const encoded = encodeURIComponent(address);
  return `https://maps.apple.com/?q=${encoded}`;
}

export function InstallerView({ project, projectId, currentUser }: InstallerViewProps) {
  const [lineStates, setLineStates] = useState<Record<string, LineItemState>>(() =>
    Object.fromEntries(
      project.quoteLines.map((line) => [
        line.id,
        {
          status: "pending",
          problemDescription: "",
          resolutionNotes: "",
        } satisfies LineItemState,
      ]),
    ),
  );
  const [problemLineId, setProblemLineId] = useState<string | null>(null);
  const [jobNotes, setJobNotes] = useState(project.notes ?? "");
  const [clockEntry, setClockEntry] = useState<ClockEntry | null>(null);
  const [customerName, setCustomerName] = useState(project.customerName);
  const [signOffConfirmed, setSignOffConfirmed] = useState(false);
  const [signatureSaved, setSignatureSaved] = useState(false);
  const [isSubmittingSignature, setIsSubmittingSignature] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    async function loadInstallerState() {
      const [clockResponse, installsResponse] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, clock_in, clock_out, labor_minutes")
          .eq("project_id", projectId)
          .eq("installer_id", currentUser?.id ?? "")
          .order("clock_in", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("install_line_items")
          .select("*")
          .eq("project_id", projectId),
      ]);

      const installRows = (installsResponse.data as Array<Record<string, unknown>> | null) ?? [];
      if (installRows.length > 0) {
        setLineStates((current) => {
          const next = { ...current };
          for (const row of installRows) {
            const lineId = String(row.quote_line_id ?? row.line_item_id ?? "");
            if (!lineId || !(lineId in next)) {
              continue;
            }

            next[lineId] = {
              status: String(row.status ?? "pending") === "installed" ? "installed" : String(row.status ?? "pending") === "problem" ? "problem" : "pending",
              problemDescription: String(row.problem_description ?? ""),
              resolutionNotes: String(row.resolution_notes ?? ""),
              photoName: String(row.photo_name ?? ""),
            };
          }
          return next;
        });
      }

      if (clockResponse.data) {
        setClockEntry({
          id: String(clockResponse.data.id),
          clockIn: String(clockResponse.data.clock_in ?? ""),
          clockOut: String(clockResponse.data.clock_out ?? ""),
          laborMinutes: Number(clockResponse.data.labor_minutes ?? 0),
        });
      }
    }

    void loadInstallerState();
  }, [currentUser?.id, projectId]);

  const markedCount = useMemo(
    () => Object.values(lineStates).filter((line) => line.status !== "pending").length,
    [lineStates],
  );
  const installedCount = useMemo(
    () => Object.values(lineStates).filter((line) => line.status === "installed").length,
    [lineStates],
  );
  const problemCount = useMemo(
    () => Object.values(lineStates).filter((line) => line.status === "problem").length,
    [lineStates],
  );
  const allMarked = markedCount === project.quoteLines.length;
  const progressPercent = project.quoteLines.length
    ? Math.round((markedCount / project.quoteLines.length) * 100)
    : 0;

  function startDrawing(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    drawingRef.current = true;
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.strokeStyle = "#1C1C1C";
    context.beginPath();
    context.moveTo(clientX - rect.left, clientY - rect.top);
  }

  function continueDrawing(clientX: number, clientY: number) {
    if (!drawingRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    context.lineTo(clientX - rect.left, clientY - rect.top);
    context.stroke();
  }

  function stopDrawing() {
    drawingRef.current = false;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function markInstalled(lineId: string) {
    setLineStates((current) => ({
      ...current,
      [lineId]: {
        ...current[lineId],
        status: "installed",
      },
    }));

    await supabase.from("install_line_items").insert({
      project_id: projectId,
      quote_line_id: lineId,
      status: "installed",
      installed_by: currentUser?.id ?? null,
      installed_at: new Date().toISOString(),
    });
  }

  async function saveProblem(lineId: string) {
    const state = lineStates[lineId];
    if (!state.problemDescription.trim()) {
      return;
    }

    setLineStates((current) => ({
      ...current,
      [lineId]: {
        ...current[lineId],
        status: "problem",
      },
    }));

    await Promise.all([
      supabase.from("install_line_items").insert({
        project_id: projectId,
        quote_line_id: lineId,
        status: "problem",
        installed_by: currentUser?.id ?? null,
        installed_at: new Date().toISOString(),
        problem_description: state.problemDescription,
        resolution_notes: state.resolutionNotes,
        photo_name: state.photoName ?? null,
      }),
      supabase.from("service_tickets").insert({
        project_id: projectId,
        quote_line_id: lineId,
        customer_id: project.customerId,
        description: state.problemDescription,
        resolution_notes: state.resolutionNotes,
        status: "open",
        created_by: currentUser?.id ?? null,
      }),
    ]);

    setProblemLineId(null);
  }

  async function saveNotes() {
    setIsSavingNotes(true);
    await supabase.from("projects").update({ notes: jobNotes }).eq("id", projectId);
    setIsSavingNotes(false);
  }

  async function clockIn() {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("jobs")
      .insert({
        project_id: projectId,
        installer_id: currentUser?.id ?? null,
        clock_in: now,
      })
      .select("id, clock_in, clock_out, labor_minutes")
      .maybeSingle();

    setClockEntry({
      id: String(data?.id ?? `job-${Date.now()}`),
      clockIn: String(data?.clock_in ?? now),
      clockOut: data?.clock_out ? String(data.clock_out) : null,
      laborMinutes: Number(data?.labor_minutes ?? 0),
    });
  }

  async function clockOut() {
    if (!clockEntry?.clockIn) {
      return;
    }

    const now = new Date().toISOString();
    const laborMinutes = Math.max(
      0,
      Math.round((new Date(now).getTime() - new Date(clockEntry.clockIn).getTime()) / 60000),
    );

    if (clockEntry.id && !clockEntry.id.startsWith("job-")) {
      await supabase
        .from("jobs")
        .update({
          clock_out: now,
          labor_minutes: laborMinutes,
        })
        .eq("id", clockEntry.id);
    }

    setClockEntry((current) =>
      current
        ? {
            ...current,
            clockOut: now,
            laborMinutes,
          }
        : current,
    );
  }

  async function submitSignOff() {
    const canvas = canvasRef.current;
    if (!canvas || !signOffConfirmed || !allMarked) {
      return;
    }

    setIsSubmittingSignature(true);
    const signatureData = canvas.toDataURL("image/png");
    const now = new Date().toISOString();
    const { data: settings } = await supabase
      .from("business_settings")
      .select("business_name, review_url, review_sms_message")
      .limit(1)
      .maybeSingle();

    const businessName = String(
      (settings as { business_name?: string | null } | null)?.business_name ?? "Nelo",
    );
    const reviewUrl = String(
      (settings as { review_url?: string | null } | null)?.review_url ?? "",
    );
    const reviewMessageTemplate = String(
      (settings as { review_sms_message?: string | null } | null)?.review_sms_message ??
        "Thank you for choosing [business_name]! We hope you love your new window treatments. Would you mind leaving us a quick review? It means the world to us! [review_link]",
    );
    const reviewMessage = reviewMessageTemplate
      .replaceAll("[business_name]", businessName)
      .replaceAll("[review_link]", reviewUrl);

    await Promise.all([
      supabase.from("install_sign_offs").insert({
        project_id: projectId,
        installer_id: currentUser?.id ?? null,
        customer_name: customerName,
        signature_data: signatureData,
        ip_address: null,
        signed_at: now,
      }),
      supabase.from("projects").update({ status: "Complete" }).eq("id", projectId),
      supabase.from("conversations").insert({
        project_id: projectId,
        customer_id: project.customerId,
        channel: "sms",
        status: "pending_send",
        message: reviewMessage,
      }),
    ]);

    setSignatureSaved(true);
    setSuccessMessage(`Job complete! Thank you ${customerName}.`);
    setIsSubmittingSignature(false);
  }

  if (signatureSaved) {
    return (
      <main className="min-h-screen bg-stone-100 px-4 py-6 text-stone-950">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-stone-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
            Installation complete
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
            {successMessage}
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-100 px-3 py-4 sm:px-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-[28px] border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {!clockEntry?.clockIn ? (
                <p className="text-sm text-stone-500">Current time {formatTime(new Date().toISOString())}</p>
              ) : (
                <p className="text-sm text-stone-500">
                  Clocked in at {formatTime(clockEntry.clockIn)}
                  {clockEntry.clockOut ? ` · Total time ${formatMinutes(clockEntry.laborMinutes ?? 0)}` : ""}
                </p>
              )}
            </div>
            {!clockEntry?.clockIn ? (
              <button
                type="button"
                onClick={() => void clockIn()}
                className="min-h-12 rounded-2xl bg-emerald-600 px-5 text-sm font-semibold text-white"
              >
                Clock in
              </button>
            ) : !clockEntry.clockOut ? (
              <button
                type="button"
                onClick={() => void clockOut()}
                className="min-h-12 rounded-2xl bg-rose-600 px-5 text-sm font-semibold text-white"
              >
                Clock out
              </button>
            ) : null}
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm font-medium text-stone-700">
              <span>
                {markedCount} of {project.quoteLines.length} products marked
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="mt-2 h-3 rounded-full bg-stone-100">
              <div className="h-3 rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>

        <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm">
          <p className="font-mono text-2xl font-semibold text-primary">{normalizeJobNumber(project.jobNumber)}</p>
          <h1 className="mt-3 text-2xl font-semibold text-stone-950">{project.customerName}</h1>
          <a
            href={mapUrlForAddress(project.address)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block text-lg font-medium text-stone-800 underline decoration-stone-300 underline-offset-4"
          >
            {project.address}
          </a>
          {project.gateCode ? (
            <div className="mt-4 rounded-2xl bg-primary/10 px-4 py-4 text-base font-semibold text-primary">
              Gate code: {project.gateCode}
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 text-sm text-stone-600 sm:grid-cols-2">
            <div className="rounded-2xl bg-stone-50 px-4 py-3">
              Today
              <div className="mt-1 text-base font-semibold text-stone-900">
                {formatDateTime(new Date().toISOString())}
              </div>
            </div>
            <div className="rounded-2xl bg-stone-50 px-4 py-3">
              Scheduled time
              <div className="mt-1 text-base font-semibold text-stone-900">
                {project.scheduledAt ? formatDateTime(project.scheduledAt) : "Schedule not set"}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-stone-950">Products to install</h2>
          <div className="mt-4 space-y-4">
            {project.quoteLines.map((line) => {
              const state = lineStates[line.id];
              const tone =
                state?.status === "installed"
                  ? "border-emerald-200 bg-emerald-50"
                  : state?.status === "problem"
                    ? "border-rose-200 bg-rose-50"
                    : "border-stone-200 bg-white";

              return (
                <div key={line.id} className={`rounded-3xl border p-4 ${tone}`}>
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-stone-950">{line.room}</p>
                    <p className="text-sm text-stone-700">
                      {line.productName} · {line.color}
                    </p>
                    <p className="text-sm text-stone-600">{line.liftOption}</p>
                    <p className="text-sm text-stone-600">Quantity {line.quantity ?? 1}</p>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void markInstalled(line.id)}
                      className="min-h-12 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white"
                    >
                      {state?.status === "installed" ? "Installed" : "Mark installed"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setProblemLineId(line.id)}
                      className="min-h-12 rounded-2xl bg-rose-600 px-4 text-sm font-semibold text-white"
                    >
                      {state?.status === "problem" ? "Problem logged" : "Problem"}
                    </button>
                  </div>
                  {state?.status === "installed" ? (
                    <p className="mt-3 text-sm font-medium text-emerald-700">Checked and marked installed.</p>
                  ) : null}
                  {state?.status === "problem" ? (
                    <p className="mt-3 text-sm font-medium text-rose-700">Problem noted and follow-up created.</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-stone-950">Installer notes</h2>
          <label className="mt-3 block text-sm font-medium text-stone-600">
            Job notes — visible to office
          </label>
          <textarea
            value={jobNotes}
            onChange={(event) => setJobNotes(event.target.value)}
            className="mt-2 min-h-32 w-full rounded-2xl border border-stone-200 px-4 py-3 text-base outline-none transition focus:border-primary"
          />
          <button
            type="button"
            onClick={() => void saveNotes()}
            className="mt-4 min-h-12 rounded-2xl bg-primary px-5 text-sm font-semibold text-white"
          >
            {isSavingNotes ? "Saving..." : "Save notes"}
          </button>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-stone-950">Customer sign-off</h2>
          {!allMarked ? (
            <p className="mt-3 rounded-2xl bg-stone-50 px-4 py-4 text-sm text-stone-600">
              Mark all products before requesting sign-off
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm text-stone-600">
                {installedCount} of {project.quoteLines.length} products installed successfully · {problemCount} items need follow-up
              </p>
              <label className="mt-4 block text-sm font-medium text-stone-700">Customer name</label>
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-base outline-none transition focus:border-primary"
              />
              <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={220}
                  className="h-44 w-full touch-none bg-white"
                  onMouseDown={(event) => startDrawing(event.nativeEvent.offsetX, event.nativeEvent.offsetY)}
                  onMouseMove={(event) => continueDrawing(event.nativeEvent.offsetX, event.nativeEvent.offsetY)}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={(event) => {
                    const touch = event.touches[0];
                    startDrawing(touch.clientX, touch.clientY);
                  }}
                  onTouchMove={(event) => {
                    const touch = event.touches[0];
                    continueDrawing(touch.clientX, touch.clientY);
                  }}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <button
                type="button"
                onClick={clearSignature}
                className="mt-3 min-h-12 rounded-2xl border border-stone-200 px-4 text-sm font-medium text-stone-600"
              >
                Clear signature
              </button>
              <label className="mt-4 flex items-start gap-3 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={signOffConfirmed}
                  onChange={(event) => setSignOffConfirmed(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#FF4900]"
                />
                <span>I confirm the above work has been completed to my satisfaction</span>
              </label>
              <button
                type="button"
                onClick={() => void submitSignOff()}
                disabled={!signOffConfirmed || isSubmittingSignature}
                className="mt-4 min-h-12 w-full rounded-2xl bg-primary px-5 text-base font-semibold text-white disabled:opacity-50"
              >
                {isSubmittingSignature ? "Submitting..." : "Get signature"}
              </button>
            </>
          )}
        </section>

        {problemLineId ? (
          <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-[28px] border border-stone-200 bg-white p-5 shadow-2xl">
            <div className="mx-auto max-w-3xl">
              <h3 className="text-lg font-semibold text-stone-950">Problem details</h3>
              <label className="mt-4 block text-sm font-medium text-stone-700">
                Problem description
              </label>
              <textarea
                value={lineStates[problemLineId]?.problemDescription ?? ""}
                onChange={(event) =>
                  setLineStates((current) => ({
                    ...current,
                    [problemLineId]: {
                      ...current[problemLineId],
                      problemDescription: event.target.value,
                    },
                  }))
                }
                className="mt-2 min-h-28 w-full rounded-2xl border border-stone-200 px-4 py-3 text-base outline-none transition focus:border-primary"
              />
              <label className="mt-4 block text-sm font-medium text-stone-700">
                Resolution notes
              </label>
              <textarea
                value={lineStates[problemLineId]?.resolutionNotes ?? ""}
                onChange={(event) =>
                  setLineStates((current) => ({
                    ...current,
                    [problemLineId]: {
                      ...current[problemLineId],
                      resolutionNotes: event.target.value,
                    },
                  }))
                }
                className="mt-2 min-h-24 w-full rounded-2xl border border-stone-200 px-4 py-3 text-base outline-none transition focus:border-primary"
              />
              <label className="mt-4 block text-sm font-medium text-stone-700">Photo upload</label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    return;
                  }

                  setLineStates((current) => ({
                    ...current,
                    [problemLineId]: {
                      ...current[problemLineId],
                      photoName: file.name,
                    },
                  }));
                }}
                className="mt-2 min-h-12 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-600"
              />
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setProblemLineId(null)}
                  className="min-h-12 flex-1 rounded-2xl border border-stone-200 px-4 text-sm font-semibold text-stone-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveProblem(problemLineId)}
                  className="min-h-12 flex-1 rounded-2xl bg-primary px-4 text-sm font-semibold text-white"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
