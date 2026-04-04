"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import {
  getSampleProjectById,
  sampleProjects,
  type SampleActivity,
  type SampleDocument,
  type SamplePayment,
  type SampleProject,
  type SampleProjectTask,
  type SampleQuoteLine,
} from "@/lib/project-samples";
import { supabase } from "@/lib/supabase";

type ProjectTab = "Tasks" | "Quote" | "Payments" | "Documents & Photos" | "Activity log";

const tabs: ProjectTab[] = ["Tasks", "Quote", "Payments", "Documents & Photos", "Activity log"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDueTextTone(date: string) {
  const now = new Date();
  const dueDate = new Date(date);
  const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < -7) {
    return "text-rose-600";
  }

  if (diffDays <= 7) {
    return "text-amber-600";
  }

  return "text-emerald-600";
}

function getCustomerName(record: Record<string, unknown> | null | undefined) {
  if (!record) {
    return "Unknown customer";
  }

  const named = typeof record.name === "string" ? record.name : "";
  const first = typeof record.first_name === "string" ? record.first_name : "";
  const last = typeof record.last_name === "string" ? record.last_name : "";

  return named || [first, last].filter(Boolean).join(" ") || "Unknown customer";
}

function getUserName(record: Record<string, unknown> | null | undefined) {
  if (!record) {
    return "Unassigned";
  }

  return [record.first_name, record.last_name]
    .filter((value) => typeof value === "string" && value)
    .join(" ") || "Unassigned";
}

function mapRecordToProject(
  project: Record<string, unknown>,
  tasks: Array<Record<string, unknown>>,
  payments: Array<Record<string, unknown>>,
  documents: Array<Record<string, unknown>>,
  activity: Array<Record<string, unknown>>,
  quoteLines: Array<Record<string, unknown>>,
): SampleProject {
  const customer =
    project.customers && !Array.isArray(project.customers)
      ? (project.customers as Record<string, unknown>)
      : null;
  const workflowTemplate =
    project.workflow_templates && !Array.isArray(project.workflow_templates)
      ? (project.workflow_templates as Record<string, unknown>)
      : null;
  const assignedUser =
    project.app_users && !Array.isArray(project.app_users)
      ? (project.app_users as Record<string, unknown>)
      : null;

  const mappedTasks: SampleProjectTask[] = tasks.map((task, index) => ({
    id: String(task.id ?? `task-${index}`),
    name: String(task.name ?? task.task_name ?? `Task ${index + 1}`),
    assignedTo:
      typeof task.assigned_to_name === "string"
        ? task.assigned_to_name
        : getUserName(
            task.app_users && !Array.isArray(task.app_users)
              ? (task.app_users as Record<string, unknown>)
              : null,
          ),
    dueDate: String(task.due_date ?? task.due_at ?? new Date().toISOString()),
    status:
      String(task.status ?? "Pending").toLowerCase() === "complete" ||
      String(task.status ?? "Pending").toLowerCase() === "completed"
        ? "Complete"
        : "Pending",
  }));

  const mappedQuoteLines: SampleQuoteLine[] = quoteLines.map((line, index) => ({
    id: String(line.id ?? `line-${index}`),
    room: String(line.room ?? `Room ${index + 1}`),
    productName: String(line.product_name ?? line.product ?? "Window Treatment"),
    color: String(line.color ?? line.fabric_name ?? "Selected color"),
    liftOption: String(line.lift_option_name ?? line.lift_option ?? "Standard lift"),
    total: Number(line.line_total ?? line.sell_price ?? 0),
  }));

  const mappedPayments: SamplePayment[] = payments.map((payment, index) => ({
    id: String(payment.id ?? `payment-${index}`),
    date: String(payment.date ?? payment.created_at ?? new Date().toISOString()),
    amount: Number(payment.amount ?? 0),
    paymentType: String(payment.payment_type ?? "Payment"),
    method: String(payment.method ?? "Recorded"),
    receivedBy: String(payment.received_by ?? "Team member"),
  }));

  const mappedDocuments: SampleDocument[] = documents.map((document, index) => {
    const name = String(document.file_name ?? document.name ?? `Document ${index + 1}`);
    const lowerName = name.toLowerCase();

    return {
      id: String(document.id ?? `document-${index}`),
      name,
      uploadedAt: String(document.created_at ?? document.uploaded_at ?? new Date().toISOString()),
      type: lowerName.endsWith(".pdf") ? "pdf" : "image",
      preview: typeof document.public_url === "string" ? document.public_url : undefined,
    };
  });

  const mappedActivity: SampleActivity[] = activity.map((entry, index) => ({
    id: String(entry.id ?? `activity-${index}`),
    timestamp: String(entry.created_at ?? entry.timestamp ?? new Date().toISOString()),
    userName: String(entry.user_name ?? entry.actor_name ?? "Nelo"),
    description: String(entry.description ?? entry.action ?? "Project updated"),
  }));

  return {
    id: String(project.id),
    jobNumber: String(project.job_number ?? `PO${new Date().getFullYear()}-0000`),
    customerId: String(project.customer_id ?? ""),
    customerName: getCustomerName(customer),
    address:
      [customer?.address, customer?.city, customer?.state, customer?.zip]
        .filter((value) => typeof value === "string" && value)
        .join(", ") || "Address unavailable",
    projectType: String(project.project_type ?? "Standard Install") as SampleProject["projectType"],
    workflowTemplateName: String(workflowTemplate?.name ?? "Workflow template"),
    status: String(project.status ?? "Active") as SampleProject["status"],
    location: String(project.location ?? "Ellsworth") as SampleProject["location"],
    salesRep: {
      name: getUserName(assignedUser),
      initials: getUserName(assignedUser)
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join(""),
    },
    quoteId: String(project.quote_id ?? ""),
    totalAmount: Number(project.total_amount ?? project.total ?? mappedQuoteLines.reduce((sum, line) => sum + line.total, 0)),
    amountPaid: mappedPayments.reduce((sum, payment) => sum + payment.amount, 0),
    gateCode: typeof customer?.gate_code === "string" ? customer.gate_code : undefined,
    customerContact: {
      phone: String(customer?.phone ?? "No phone"),
      email: String(customer?.email ?? "No email"),
    },
    assignedTeam: {
      salesRep: getUserName(assignedUser),
      installer: String(project.installer_name ?? "Install team not assigned"),
    },
    costing: {
      cogs: Number(project.cogs ?? 0),
      labor: Number(project.labor_cost ?? 0),
      commission: Number(project.commission ?? 0),
      grossProfit: Number(project.gross_profit ?? 0),
    },
    purchaseOrder: {
      manufacturer: String(project.manufacturer_name ?? "TBD"),
      status: String(project.po_status ?? "Pending"),
      boxes: Number(project.boxes ?? 0),
      expectedDate: String(project.expected_date ?? new Date().toISOString()),
    },
    tasks: mappedTasks.length > 0 ? mappedTasks : sampleProjects[0].tasks,
    quoteLines: mappedQuoteLines.length > 0 ? mappedQuoteLines : sampleProjects[0].quoteLines,
    payments: mappedPayments,
    documents: mappedDocuments,
    activity: mappedActivity,
  };
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [project, setProject] = useState<SampleProject | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>("Tasks");
  const [isLoading, setIsLoading] = useState(true);
  const [localTasks, setLocalTasks] = useState<SampleProjectTask[]>([]);
  const [localDocuments, setLocalDocuments] = useState<SampleDocument[]>([]);
  const [status, setStatus] = useState<SampleProject["status"]>("Active");

  useEffect(() => {
    async function loadProject() {
      if (!projectId) {
        setProject(sampleProjects[0]);
        setLocalTasks(sampleProjects[0].tasks);
        setLocalDocuments(sampleProjects[0].documents);
        setStatus(sampleProjects[0].status);
        setIsLoading(false);
        return;
      }

      const sampleProject = getSampleProjectById(projectId);

      const { data: projectResponse } = await supabase
        .from("projects")
        .select(`
          *,
          customers (*),
          workflow_templates (*),
          app_users (*)
        `)
        .eq("id", projectId)
        .maybeSingle();

      if (!projectResponse) {
        const fallback = sampleProject ?? sampleProjects[0];
        setProject(fallback);
        setLocalTasks(fallback.tasks);
        setLocalDocuments(fallback.documents);
        setStatus(fallback.status);
        setIsLoading(false);
        return;
      }

      const projectRecord = projectResponse as Record<string, unknown>;

      const [tasksResponse, paymentsResponse, documentsResponse, activityResponse, quoteLinesResponse] =
        await Promise.all([
          supabase.from("project_tasks").select("*, app_users(*)").eq("project_id", projectId),
          supabase.from("payments").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
          supabase.from("project_documents").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
          supabase.from("audit_log").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
          supabase.from("quote_lines").select("*").eq("quote_id", String(projectRecord.quote_id ?? "")),
        ]);

      const normalized = mapRecordToProject(
        projectRecord,
        (tasksResponse.data as Array<Record<string, unknown>> | null) ?? [],
        (paymentsResponse.data as Array<Record<string, unknown>> | null) ?? [],
        (documentsResponse.data as Array<Record<string, unknown>> | null) ?? [],
        (activityResponse.data as Array<Record<string, unknown>> | null) ?? [],
        (quoteLinesResponse.data as Array<Record<string, unknown>> | null) ?? [],
      );

      setProject(normalized);
      setLocalTasks(normalized.tasks);
      setLocalDocuments(normalized.documents);
      setStatus(normalized.status);
      setIsLoading(false);
    }

    void loadProject();
  }, [projectId]);

  const sortedTasks = useMemo(() => {
    return [...localTasks].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "Pending" ? -1 : 1;
      }

      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [localTasks]);

  const amountPaid = useMemo(
    () => project?.payments.reduce((sum, payment) => sum + payment.amount, 0) ?? 0,
    [project],
  );

  async function toggleTask(taskId: string) {
    const nextTasks: SampleProjectTask[] = localTasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            status: task.status === "Complete" ? "Pending" : "Complete",
          }
        : task,
    );

    setLocalTasks(nextTasks);

    const toggledTask = nextTasks.find((task) => task.id === taskId);
    if (toggledTask && !String(taskId).startsWith("t")) {
      await supabase
        .from("project_tasks")
        .update({ status: toggledTask.status })
        .eq("id", taskId);
    }
  }

  function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    const nextDocuments = files.map((file, index) => ({
      id: `upload-${Date.now()}-${index}`,
      name: file.name,
      uploadedAt: new Date().toISOString(),
      type: file.type === "application/pdf" ? "pdf" : "image",
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    })) satisfies SampleDocument[];

    setLocalDocuments((current) => [...nextDocuments, ...current]);
    event.target.value = "";
  }

  if (isLoading || !project) {
    return (
      <main className="flex min-h-screen bg-stone-100">
        <Sidebar current="Projects" />
        <section className="flex flex-1 items-center justify-center text-sm text-stone-500">
          Loading project...
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Projects" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar
          title="Projects"
          titlePrefix={
            <Link href="/projects" className="text-lg text-stone-400 transition hover:text-stone-700">
              ←
            </Link>
          }
        />

        <div className="flex-1 space-y-6 p-8">
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="font-mono text-2xl font-semibold tracking-tight text-primary">
                  {project.jobNumber}
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
                  {project.customerName}
                </h1>
                <p className="mt-2 text-sm text-stone-500">{project.address}</p>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-stone-600">
                  <span className="rounded-full bg-orange-50 px-3 py-1.5 text-orange-700">
                    {project.projectType}
                  </span>
                  <span className="rounded-full bg-stone-100 px-3 py-1.5 text-stone-600">
                    {project.workflowTemplateName}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-start gap-3 xl:items-end">
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as SampleProject["status"])}
                  className="rounded-2xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-900 outline-none transition focus:border-primary"
                >
                  <option value="Active">Active</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Complete">Complete</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                <div className="flex flex-wrap gap-3">
                  {["Receive Payment", "Receive Shipment", "Complete", "Edit"].map((action) => (
                    <button
                      key={action}
                      type="button"
                      className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
                        action === "Edit"
                          ? "border border-stone-200 text-stone-600"
                          : "bg-primary text-white"
                      }`}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
            <section className="rounded-3xl border border-stone-200 bg-white shadow-sm">
              <div className="border-b border-stone-200 px-6 pt-6">
                <div className="flex flex-wrap gap-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`rounded-t-2xl px-4 py-3 text-sm font-medium transition ${
                        activeTab === tab
                          ? "bg-primary text-white"
                          : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6">
                {activeTab === "Tasks" ? (
                  <div className="space-y-4">
                    {sortedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex flex-col gap-3 rounded-2xl border border-stone-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p
                            className={`font-medium ${
                              task.status === "Complete"
                                ? "text-stone-400 line-through"
                                : "text-stone-900"
                            }`}
                          >
                            {task.name}
                          </p>
                          <p className="mt-1 text-sm text-stone-500">Assigned to {task.assignedTo}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-medium ${getDueTextTone(task.dueDate)}`}>
                            {formatDate(task.dueDate)}
                          </span>
                          <button
                            type="button"
                            onClick={() => void toggleTask(task.id)}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                              task.status === "Complete"
                                ? "bg-stone-200 text-stone-600"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            {task.status}
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() =>
                        setLocalTasks((current) => [
                          ...current,
                          {
                            id: `local-task-${Date.now()}`,
                            name: "New task",
                            assignedTo: project.assignedTeam.salesRep,
                            dueDate: new Date().toISOString(),
                            status: "Pending",
                          },
                        ])
                      }
                      className="rounded-xl border border-dashed border-primary/40 px-4 py-3 text-sm font-medium text-primary"
                    >
                      Add task
                    </button>
                  </div>
                ) : null}

                {activeTab === "Quote" ? (
                  <div className="space-y-4">
                    {project.quoteLines.map((line) => (
                      <div
                        key={line.id}
                        className="flex items-center justify-between rounded-2xl border border-stone-200 px-4 py-4"
                      >
                        <div>
                          <p className="font-medium text-stone-900">
                            {line.room} · {line.productName} · {line.color} · {line.liftOption}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-stone-900">
                          {formatCurrency(line.total)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-stone-200 pt-4">
                      <p className="text-sm text-stone-500">Total amount</p>
                      <p className="text-lg font-semibold text-stone-950">
                        {formatCurrency(project.totalAmount)}
                      </p>
                    </div>
                    <Link href="/quotes" className="text-sm font-medium text-primary">
                      View full quote
                    </Link>
                  </div>
                ) : null}

                {activeTab === "Payments" ? (
                  <div className="space-y-4">
                    {project.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="grid gap-3 rounded-2xl border border-stone-200 px-4 py-4 text-sm text-stone-600 md:grid-cols-5"
                      >
                        <span>{formatDate(payment.date)}</span>
                        <span className="font-medium text-stone-900">{formatCurrency(payment.amount)}</span>
                        <span>{payment.paymentType}</span>
                        <span>{payment.method}</span>
                        <span>{payment.receivedBy}</span>
                      </div>
                    ))}
                    <div className="rounded-2xl bg-stone-50 px-4 py-4">
                      <p className="text-sm text-stone-500">
                        Running balance: {formatCurrency(amountPaid)} paid of {formatCurrency(project.totalAmount)}
                      </p>
                    </div>
                    <button type="button" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white">
                      Receive payment
                    </button>
                  </div>
                ) : null}

                {activeTab === "Documents & Photos" ? (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-stone-500">Upload images or PDFs to keep everything tied to the project.</p>
                      <label className="cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white">
                        Upload
                        <input
                          type="file"
                          accept="image/*,.pdf,application/pdf"
                          multiple
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {localDocuments.map((document) => (
                        <div
                          key={document.id}
                          className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-50"
                        >
                          <div className="flex h-36 items-center justify-center bg-white">
                            {document.type === "image" && document.preview ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={document.preview} alt={document.name} className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-3xl text-stone-400">PDF</span>
                            )}
                          </div>
                          <div className="p-4">
                            <p className="truncate text-sm font-medium text-stone-900">{document.name}</p>
                            <p className="mt-1 text-xs text-stone-500">{formatDate(document.uploadedAt)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {activeTab === "Activity log" ? (
                  <div className="space-y-4">
                    {project.activity.map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-stone-200 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                          {formatDate(entry.timestamp)} · {entry.userName}
                        </p>
                        <p className="mt-2 text-sm text-stone-700">{entry.description}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            <aside className="space-y-5">
              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold tracking-tight text-stone-950">Customer info</h2>
                <div className="mt-4 space-y-2 text-sm text-stone-600">
                  <p className="font-medium text-stone-900">{project.customerName}</p>
                  <p>{project.customerContact.phone}</p>
                  <p>{project.customerContact.email}</p>
                  <p>{project.address}</p>
                  <p>Gate code: {project.gateCode ?? "—"}</p>
                </div>
              </div>

              {project.secondaryContact ? (
                <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold tracking-tight text-stone-950">
                    Secondary contact
                  </h2>
                  <div className="mt-4 space-y-2 text-sm text-stone-600">
                    <p className="font-medium text-stone-900">{project.secondaryContact.name}</p>
                    <p>{project.secondaryContact.relationship}</p>
                    <p>{project.secondaryContact.phone}</p>
                  </div>
                </div>
              ) : null}

              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold tracking-tight text-stone-950">Job costing summary</h2>
                <div className="mt-4 space-y-2 text-sm text-stone-600">
                  <div className="flex items-center justify-between">
                    <span>COGS</span>
                    <span>{formatCurrency(project.costing.cogs)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Labor</span>
                    <span>{formatCurrency(project.costing.labor)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Commission</span>
                    <span>{formatCurrency(project.costing.commission)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-stone-200 pt-3 font-medium text-stone-900">
                    <span>Gross profit</span>
                    <span>{formatCurrency(project.costing.grossProfit)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold tracking-tight text-stone-950">Assigned team</h2>
                <div className="mt-4 space-y-2 text-sm text-stone-600">
                  <p>Sales rep: {project.assignedTeam.salesRep}</p>
                  <p>Installer: {project.assignedTeam.installer}</p>
                </div>
              </div>

              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold tracking-tight text-stone-950">Purchase order status</h2>
                <div className="mt-4 space-y-2 text-sm text-stone-600">
                  <p>Manufacturer: {project.purchaseOrder.manufacturer}</p>
                  <p>PO status: {project.purchaseOrder.status}</p>
                  <p>Boxes: {project.purchaseOrder.boxes}</p>
                  <p>Expected date: {formatDate(project.purchaseOrder.expectedDate)}</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
