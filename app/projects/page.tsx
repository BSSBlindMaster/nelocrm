"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { sampleProjects } from "@/lib/project-samples";
import { supabase } from "@/lib/supabase";

type ProjectStatus = "Active" | "On Hold" | "Complete" | "Cancelled";

type ProjectRow = {
  id: string;
  jobNumber: string;
  customerName: string;
  projectType: string;
  workflowTemplateName: string;
  completedTasks: number;
  totalTasks: number;
  nextTaskName: string;
  nextTaskDue: string;
  location: string;
  status: ProjectStatus;
  assignedTo: string;
  assignedInitials: string;
};

type CustomerOption = {
  id: string;
  label: string;
  location: string;
};

type QuoteOption = {
  id: string;
  customerId: string;
  label: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getCustomerName(customer: Record<string, unknown> | null | undefined) {
  if (!customer) {
    return "Unknown customer";
  }

  const named = typeof customer.name === "string" ? customer.name : "";
  const first = typeof customer.first_name === "string" ? customer.first_name : "";
  const last = typeof customer.last_name === "string" ? customer.last_name : "";
  return named || [first, last].filter(Boolean).join(" ") || "Unknown customer";
}

function getTaskSummary(tasks: Array<Record<string, unknown>> | null | undefined) {
  const normalized = (tasks ?? []).map((task) => {
    const rawStatus = String(task.status ?? "pending").toLowerCase();
    return {
      name: String(task.name ?? task.task_name ?? "Task"),
      dueDate: String(task.due_date ?? task.due_at ?? ""),
      isComplete: rawStatus === "complete" || rawStatus === "completed" || rawStatus === "done",
    };
  });

  const completedTasks = normalized.filter((task) => task.isComplete).length;
  const incompleteTasks = normalized
    .filter((task) => !task.isComplete)
    .sort((a, b) => new Date(a.dueDate || "9999-12-31").getTime() - new Date(b.dueDate || "9999-12-31").getTime());

  return {
    completedTasks,
    totalTasks: normalized.length,
    nextTaskName: incompleteTasks[0]?.name ?? "All tasks complete",
    nextTaskDue: incompleteTasks[0]?.dueDate ?? "",
  };
}

function formatDate(value: string) {
  if (!value) {
    return "No due date";
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDueTone(date: string) {
  if (!date) {
    return "text-emerald-700 bg-emerald-50";
  }

  const today = new Date();
  const dueDate = new Date(date);
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return "text-rose-700 bg-rose-50";
  }

  if (diffDays <= 7) {
    return "text-amber-700 bg-amber-50";
  }

  return "text-emerald-700 bg-emerald-50";
}

function getStatusTone(status: string) {
  if (status === "Complete") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "On Hold") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "Cancelled") {
    return "bg-stone-200 text-stone-700";
  }

  return "bg-sky-100 text-sky-700";
}

function getLocationTone(location: string) {
  if (location === "Lindsay") {
    return "bg-emerald-100 text-emerald-700";
  }

  return "bg-sky-100 text-sky-700";
}

function getProjectTypeTone(projectType: string) {
  if (projectType === "Motorized") {
    return "bg-violet-100 text-violet-700";
  }

  if (projectType === "Repair") {
    return "bg-amber-100 text-amber-700";
  }

  if (projectType === "Commercial") {
    return "bg-stone-200 text-stone-700";
  }

  return "bg-orange-100 text-orange-700";
}

function createJobNumber() {
  const year = new Date().getFullYear();
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `PO${year}-${digits}`;
}

function mapSampleProjects() {
  return sampleProjects.map((project) => {
    const incompleteTasks = project.tasks.filter((task) => task.status !== "Complete");
    const nextTask = incompleteTasks.sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    )[0];

    return {
      id: project.id,
      jobNumber: project.jobNumber,
      customerName: project.customerName,
      projectType: project.projectType,
      workflowTemplateName: project.workflowTemplateName,
      completedTasks: project.tasks.filter((task) => task.status === "Complete").length,
      totalTasks: project.tasks.length,
      nextTaskName: nextTask?.name ?? "All tasks complete",
      nextTaskDue: nextTask?.dueDate ?? "",
      location: project.location,
      status: project.status,
      assignedTo: project.salesRep.name,
      assignedInitials: project.salesRep.initials,
    } satisfies ProjectRow;
  });
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>(mapSampleProjects());
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [quotes, setQuotes] = useState<QuoteOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProjects() {
      setIsLoading(true);

      const [projectsResponse, customersResponse, quotesResponse] = await Promise.all([
        supabase
          .from("projects")
          .select(`
            *,
            customers (
              id,
              name,
              first_name,
              last_name
            ),
            project_tasks (
              id,
              name,
              task_name,
              due_date,
              due_at,
              status
            ),
            app_users (
              id,
              first_name,
              last_name
            ),
            workflow_templates (
              id,
              name
            )
          `),
        supabase.from("customers").select("id, name, first_name, last_name, location").order("created_at", { ascending: false }),
        supabase.from("quotes").select("id, customer_id, created_at, total").order("created_at", { ascending: false }),
      ]);

      const projectRows = ((projectsResponse.data as Array<Record<string, unknown>> | null) ?? []).map(
        (project) => {
          const taskSummary = getTaskSummary(
            Array.isArray(project.project_tasks)
              ? (project.project_tasks as Array<Record<string, unknown>>)
              : [],
          );
          const assignedUser =
            project.app_users && !Array.isArray(project.app_users)
              ? (project.app_users as Record<string, unknown>)
              : null;
          const assignedName = [assignedUser?.first_name, assignedUser?.last_name]
            .filter((value) => typeof value === "string" && value)
            .join(" ");

          return {
            id: String(project.id),
            jobNumber: String(project.job_number ?? createJobNumber()),
            customerName: getCustomerName(
              project.customers && !Array.isArray(project.customers)
                ? (project.customers as Record<string, unknown>)
                : null,
            ),
            projectType: String(project.project_type ?? "Standard Install"),
            workflowTemplateName:
              project.workflow_templates && !Array.isArray(project.workflow_templates)
                ? String((project.workflow_templates as Record<string, unknown>).name ?? "Workflow")
                : "Workflow",
            completedTasks: taskSummary.completedTasks,
            totalTasks: taskSummary.totalTasks,
            nextTaskName: taskSummary.nextTaskName,
            nextTaskDue: taskSummary.nextTaskDue,
            location: String(project.location ?? "Ellsworth"),
            status: String(project.status ?? "Active") as ProjectStatus,
            assignedTo: assignedName || "Unassigned",
            assignedInitials: getInitials(assignedName || "Unassigned"),
          } satisfies ProjectRow;
        },
      );

      const customerOptions = ((customersResponse.data as Array<Record<string, unknown>> | null) ?? []).map(
        (customer) => ({
          id: String(customer.id),
          label: getCustomerName(customer),
          location: String(customer.location ?? "Ellsworth"),
        }),
      );

      const quoteOptions = ((quotesResponse.data as Array<Record<string, unknown>> | null) ?? []).map(
        (quote) => ({
          id: String(quote.id),
          customerId: String(quote.customer_id ?? ""),
          label: `${String(quote.id)} · ${new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          }).format(Number(quote.total ?? 0))}`,
        }),
      );

      setProjects(projectRows.length > 0 ? projectRows : mapSampleProjects());
      setCustomers(customerOptions);
      setQuotes(quoteOptions);
      setIsLoading(false);
    }

    void loadProjects();
  }, []);

  const filteredQuotes = useMemo(() => {
    if (!selectedCustomerId) {
      return quotes;
    }

    return quotes.filter((quote) => quote.customerId === selectedCustomerId);
  }, [quotes, selectedCustomerId]);

  async function handleCreateProject() {
    if (!selectedCustomerId || !selectedQuoteId) {
      return;
    }

    setIsSaving(true);
    setMessage("");

    const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
    const jobNumber = createJobNumber();

    const { data, error } = await supabase
      .from("projects")
      .insert({
        customer_id: selectedCustomerId,
        quote_id: selectedQuoteId,
        job_number: jobNumber,
        project_type: "Standard Install",
        status: "Active",
        location: selectedCustomer?.location ?? "Ellsworth",
      })
      .select("id")
      .maybeSingle();

    if (error) {
      setProjects((current) => [
        {
          id: `local-${Date.now()}`,
          jobNumber,
          customerName: selectedCustomer?.label ?? "Selected customer",
          projectType: "Standard Install",
          workflowTemplateName: "Standard Install Workflow",
          completedTasks: 0,
          totalTasks: 6,
          nextTaskName: "Create kickoff checklist",
          nextTaskDue: new Date().toISOString(),
          location: selectedCustomer?.location ?? "Ellsworth",
          status: "Active",
          assignedTo: "Unassigned",
          assignedInitials: "UN",
        },
        ...current,
      ]);
      setMessage("Project created locally for preview. Supabase insert was unavailable.");
    } else {
      setProjects((current) => [
        {
          id: String(data?.id ?? `project-${Date.now()}`),
          jobNumber,
          customerName: selectedCustomer?.label ?? "Selected customer",
          projectType: "Standard Install",
          workflowTemplateName: "Standard Install Workflow",
          completedTasks: 0,
          totalTasks: 0,
          nextTaskName: "No tasks yet",
          nextTaskDue: "",
          location: selectedCustomer?.location ?? "Ellsworth",
          status: "Active",
          assignedTo: "Unassigned",
          assignedInitials: "UN",
        },
        ...current,
      ]);
      setMessage("Project created successfully.");
    }

    setSelectedCustomerId("");
    setSelectedQuoteId("");
    setIsModalOpen(false);
    setIsSaving(false);
  }

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Projects" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar
          title="Projects"
          titleAdornment={
            <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 text-sm font-medium text-stone-600">
              {projects.length}
            </span>
          }
          actionLabel="New project"
          actionOnClick={() => setIsModalOpen(true)}
        />

        <div className="flex-1 p-8">
          {message ? (
            <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
              {message}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
            {isLoading ? (
              <div className="flex min-h-[280px] items-center justify-center text-sm text-stone-500">
                Loading projects...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-stone-200">
                  <thead className="bg-stone-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                      <th className="px-4 py-4">Job number</th>
                      <th className="px-4 py-4">Customer name</th>
                      <th className="px-4 py-4">Project type</th>
                      <th className="px-4 py-4">Workflow progress</th>
                      <th className="px-4 py-4">Next task due</th>
                      <th className="px-4 py-4">Location</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-4 py-4">Assigned to</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {projects.map((project) => {
                      const completionPercent =
                        project.totalTasks > 0
                          ? Math.round((project.completedTasks / project.totalTasks) * 100)
                          : 0;

                      return (
                        <tr key={project.id} className="hover:bg-stone-50">
                          <td className="px-4 py-4">
                            <Link
                              href={`/projects/${project.id}`}
                              className="font-mono text-sm font-semibold text-primary transition hover:opacity-80"
                            >
                              {project.jobNumber}
                            </Link>
                          </td>
                          <td className="px-4 py-4 text-sm font-medium text-stone-900">
                            {project.customerName}
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getProjectTypeTone(project.projectType)}`}
                            >
                              {project.projectType}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="min-w-[200px]">
                              <p className="text-sm text-stone-700">
                                {project.completedTasks} of {project.totalTasks} tasks complete
                              </p>
                              <div className="mt-2 h-2 rounded-full bg-stone-100">
                                <div
                                  className="h-2 rounded-full bg-primary"
                                  style={{ width: `${completionPercent}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div
                              className={`inline-flex flex-col rounded-2xl px-3 py-2 text-sm ${getDueTone(project.nextTaskDue)}`}
                            >
                              <span className="font-medium">{project.nextTaskName}</span>
                              <span className="text-xs opacity-80">{formatDate(project.nextTaskDue)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getLocationTone(project.location)}`}
                            >
                              {project.location}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusTone(project.status)}`}
                            >
                              {project.status}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                                {project.assignedInitials}
                              </div>
                              <span className="text-sm text-stone-700">{project.assignedTo}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/35 p-6">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
                  Projects
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                  Create manual project
                </h2>
                <p className="mt-2 text-sm text-stone-500">
                  Projects usually start from an ordered quote. Use this when you need to create one manually.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-500"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="text-sm font-medium text-stone-700">Customer</label>
                <select
                  value={selectedCustomerId}
                  onChange={(event) => {
                    setSelectedCustomerId(event.target.value);
                    setSelectedQuoteId("");
                  }}
                  className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-primary"
                >
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-stone-700">Quote</label>
                <select
                  value={selectedQuoteId}
                  onChange={(event) => setSelectedQuoteId(event.target.value)}
                  disabled={!selectedCustomerId}
                  className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-primary disabled:bg-stone-50 disabled:text-stone-400"
                >
                  <option value="">Select a quote</option>
                  {filteredQuotes.map((quote) => (
                    <option key={quote.id} value={quote.id}>
                      {quote.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreateProject()}
                disabled={!selectedCustomerId || !selectedQuoteId || isSaving}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Creating..." : "Create project"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
