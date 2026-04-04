"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { getActiveAppUsers, getCurrentAppUser, type ActiveAppUser, type CurrentAppUser } from "@/lib/current-app-user";
import { normalizeJobNumber } from "@/lib/nelo-format";
import { sampleProjects } from "@/lib/project-samples";
import { supabase } from "@/lib/supabase";

type ProjectStatus = "Active" | "On Hold" | "Complete" | "Cancelled";
type AssignmentFilter = "my_tasks" | "my_team" | "all_tasks";
type StatusFilter = "all" | "pending" | "overdue" | "due_this_week";
type LocationFilter = "all" | "Ellsworth" | "Lindsay";

type ProjectTaskInfo = {
  id: string;
  name: string;
  dueDate: string;
  isComplete: boolean;
  assignedTo: string;
  assignedUserId?: string;
  assignedAuthUserId?: string;
  assignedLocation?: string;
};

type ProjectRow = {
  id: string;
  jobNumber: string;
  customerName: string;
  address: string;
  projectType: string;
  workflowTemplateName: string;
  location: string;
  status: ProjectStatus;
  scheduledDate: string;
  assignedTo: string;
  assignedInitials: string;
  tasks: ProjectTaskInfo[];
};

type FilteredProjectRow = ProjectRow & {
  assignmentScopedTasks: ProjectTaskInfo[];
  visibleTasks: ProjectTaskInfo[];
  completedTasks: number;
  totalTasks: number;
  nextTaskName: string;
  nextTaskDue: string;
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

function isOverdue(date: string, isComplete: boolean) {
  if (isComplete || !date) {
    return false;
  }

  return new Date(date).getTime() < Date.now();
}

function isDueThisWeek(date: string, isComplete: boolean) {
  if (isComplete || !date) {
    return false;
  }

  const diffMs = new Date(date).getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 7;
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

  const dueDate = new Date(date);
  const diffDays = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

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
  const year = String(new Date().getFullYear()).slice(-2);
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `PO${year}-${digits}`;
}

function getDefaultAssignmentFilter(roleName: string): AssignmentFilter {
  if (roleName === "Sales Manager") {
    return "my_team";
  }

  if (roleName === "Owner" || roleName === "Office Manager") {
    return "all_tasks";
  }

  return "my_tasks";
}

function getAllowedAssignmentFilters(roleName: string): AssignmentFilter[] {
  if (roleName === "Installer") {
    return ["my_tasks"];
  }

  if (roleName === "Sales Rep" || roleName === "Appointment Setter") {
    return ["my_tasks", "all_tasks"];
  }

  if (roleName === "Sales Manager") {
    return ["my_tasks", "my_team", "all_tasks"];
  }

  return ["my_tasks", "my_team", "all_tasks"];
}

function getTaskSummary(tasks: ProjectTaskInfo[]) {
  const completedTasks = tasks.filter((task) => task.isComplete).length;
  const incompleteTasks = tasks
    .filter((task) => !task.isComplete)
    .sort((a, b) => new Date(a.dueDate || "9999-12-31").getTime() - new Date(b.dueDate || "9999-12-31").getTime());

  return {
    completedTasks,
    totalTasks: tasks.length,
    nextTaskName: incompleteTasks[0]?.name ?? "All tasks complete",
    nextTaskDue: incompleteTasks[0]?.dueDate ?? "",
  };
}

function mapSampleProjects(): ProjectRow[] {
  return sampleProjects.map((project) => ({
    id: project.id,
    jobNumber: normalizeJobNumber(project.jobNumber),
    customerName: project.customerName,
    address: project.address,
    projectType: project.projectType,
    workflowTemplateName: project.workflowTemplateName,
    location: project.location,
    status: project.status,
    scheduledDate:
      project.scheduledAt ??
      project.tasks
        .map((task) => task.dueDate)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ??
      "",
    assignedTo: project.salesRep.name,
    assignedInitials: project.salesRep.initials,
    tasks: project.tasks.map((task) => ({
      id: task.id,
      name: task.name,
      dueDate: task.dueDate,
      isComplete: task.status === "Complete",
      assignedTo: task.assignedTo,
      assignedUserId: task.assignedUserId,
      assignedAuthUserId: task.assignedAuthUserId,
      assignedLocation: task.assignedLocation ?? project.location,
    })),
  }));
}

function taskMatchesAssignment(
  task: ProjectTaskInfo,
  assignmentFilter: AssignmentFilter,
  currentUser: CurrentAppUser | null,
  teamUserIds: Set<string>,
  teamAuthIds: Set<string>,
) {
  if (!currentUser) {
    return true;
  }

  if (assignmentFilter === "all_tasks") {
    return true;
  }

  if (assignmentFilter === "my_team") {
    return (
      (!!task.assignedUserId && teamUserIds.has(task.assignedUserId)) ||
      (!!task.assignedAuthUserId && teamAuthIds.has(task.assignedAuthUserId)) ||
      (!!task.assignedLocation && task.assignedLocation === currentUser.location)
    );
  }

  return (
    task.assignedUserId === currentUser.id ||
    task.assignedAuthUserId === currentUser.authUserId ||
    task.assignedTo === currentUser.fullName
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[]>(mapSampleProjects());
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [quotes, setQuotes] = useState<QuoteOption[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveAppUser[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentAppUser | null>(null);
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all_tasks");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProjects() {
      setIsLoading(true);

      const [currentAppUser, allActiveUsers, projectsResponse, customersResponse, quotesResponse] =
        await Promise.all([
          getCurrentAppUser(),
          getActiveAppUsers(),
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
                status,
                assigned_to_user_id,
                assignee_id,
                user_id,
                app_users (
                  id,
                  auth_user_id,
                  first_name,
                  last_name,
                  location
                )
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
          supabase
            .from("customers")
            .select("id, name, first_name, last_name, location")
            .order("created_at", { ascending: false }),
          supabase
            .from("quotes")
            .select("id, customer_id, created_at, total")
            .order("created_at", { ascending: false }),
        ]);

      setCurrentUser(currentAppUser);
      setActiveUsers(allActiveUsers);
      setAssignmentFilter(getDefaultAssignmentFilter(currentAppUser?.roleName ?? ""));
      setLocationFilter(currentAppUser?.roleName === "Owner" ? "all" : "all");

      const projectRows = ((projectsResponse.data as Array<Record<string, unknown>> | null) ?? []).map(
        (project) => {
          const assignedUser =
            project.app_users && !Array.isArray(project.app_users)
              ? (project.app_users as Record<string, unknown>)
              : null;
          const assignedName = [assignedUser?.first_name, assignedUser?.last_name]
            .filter((value) => typeof value === "string" && value)
            .join(" ");

          const tasks = (
            Array.isArray(project.project_tasks)
              ? (project.project_tasks as Array<Record<string, unknown>>)
              : []
          ).map((task, index) => {
            const taskUser =
              task.app_users && !Array.isArray(task.app_users)
                ? (task.app_users as Record<string, unknown>)
                : null;

            return {
              id: String(task.id ?? `task-${index}`),
              name: String(task.name ?? task.task_name ?? `Task ${index + 1}`),
              dueDate: String(task.due_date ?? task.due_at ?? ""),
              isComplete:
                ["complete", "completed", "done"].includes(
                  String(task.status ?? "pending").toLowerCase(),
                ),
              assignedTo:
                [taskUser?.first_name, taskUser?.last_name]
                  .filter((value) => typeof value === "string" && value)
                  .join(" ") || "Unassigned",
              assignedUserId:
                typeof task.assigned_to_user_id === "string"
                  ? task.assigned_to_user_id
                  : typeof task.assignee_id === "string"
                    ? task.assignee_id
                    : typeof task.user_id === "string"
                      ? task.user_id
                      : typeof taskUser?.id === "string"
                        ? taskUser.id
                        : undefined,
              assignedAuthUserId:
                typeof taskUser?.auth_user_id === "string" ? taskUser.auth_user_id : undefined,
              assignedLocation:
                typeof taskUser?.location === "string"
                  ? taskUser.location
                  : String(project.location ?? "Ellsworth"),
            } satisfies ProjectTaskInfo;
          });

          return {
            id: String(project.id),
            jobNumber: normalizeJobNumber(String(project.job_number ?? createJobNumber())),
            customerName: getCustomerName(
              project.customers && !Array.isArray(project.customers)
                ? (project.customers as Record<string, unknown>)
                : null,
            ),
            address:
              project.customers && !Array.isArray(project.customers)
                ? [
                    (project.customers as Record<string, unknown>).address,
                    (project.customers as Record<string, unknown>).city,
                    (project.customers as Record<string, unknown>).state,
                    (project.customers as Record<string, unknown>).zip,
                  ]
                    .filter((value) => typeof value === "string" && value)
                    .join(", ") || "Address unavailable"
                : "Address unavailable",
            projectType: String(project.project_type ?? "Standard Install"),
            workflowTemplateName:
              project.workflow_templates && !Array.isArray(project.workflow_templates)
                ? String((project.workflow_templates as Record<string, unknown>).name ?? "Workflow")
                : "Workflow",
            location: String(project.location ?? "Ellsworth"),
            status: String(project.status ?? "Active") as ProjectStatus,
            scheduledDate: String(project.scheduled_at ?? project.install_date ?? tasks[0]?.dueDate ?? ""),
            assignedTo: assignedName || "Unassigned",
            assignedInitials: getInitials(assignedName || "Unassigned"),
            tasks,
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

  const allowedAssignmentFilters = useMemo(
    () => getAllowedAssignmentFilters(currentUser?.roleName ?? ""),
    [currentUser?.roleName],
  );

  const teamUsers = useMemo(() => {
    if (!currentUser?.location) {
      return activeUsers;
    }

    return activeUsers.filter((user) => user.location === currentUser.location);
  }, [activeUsers, currentUser?.location]);

  const teamUserIds = useMemo(() => new Set(teamUsers.map((user) => user.id)), [teamUsers]);
  const teamAuthIds = useMemo(() => new Set(teamUsers.map((user) => user.authUserId)), [teamUsers]);

  const filteredProjects = useMemo(() => {
    return projects
      .filter((project) => locationFilter === "all" || project.location === locationFilter)
      .map((project) => {
        const assignmentScopedTasks = project.tasks.filter((task) =>
          taskMatchesAssignment(task, assignmentFilter, currentUser, teamUserIds, teamAuthIds),
        );

        const statusScopedTasks = assignmentScopedTasks.filter((task) => {
          if (statusFilter === "all") {
            return true;
          }

          if (statusFilter === "pending") {
            return !task.isComplete;
          }

          if (statusFilter === "overdue") {
            return isOverdue(task.dueDate, task.isComplete);
          }

          return isDueThisWeek(task.dueDate, task.isComplete);
        });

        const summaryTasks = statusScopedTasks.length > 0 ? statusScopedTasks : assignmentScopedTasks;
        const summary = getTaskSummary(summaryTasks);

        return {
          ...project,
          assignmentScopedTasks,
          visibleTasks: statusScopedTasks,
          completedTasks: summary.completedTasks,
          totalTasks: summary.totalTasks,
          nextTaskName: summary.nextTaskName,
          nextTaskDue: summary.nextTaskDue,
        } satisfies FilteredProjectRow;
      })
      .filter((project) =>
        statusFilter === "all"
          ? project.assignmentScopedTasks.length > 0
          : project.visibleTasks.length > 0,
      );
  }, [projects, locationFilter, assignmentFilter, currentUser, teamUserIds, teamAuthIds, statusFilter]);

  const summary = useMemo(() => {
    const visibleTasks = filteredProjects.flatMap((project) => project.visibleTasks);

    return {
      projectCount: filteredProjects.length,
      overdueCount: visibleTasks.filter((task) => isOverdue(task.dueDate, task.isComplete)).length,
      dueThisWeekCount: visibleTasks.filter((task) => isDueThisWeek(task.dueDate, task.isComplete)).length,
    };
  }, [filteredProjects]);

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

    const nextProject: ProjectRow = {
      id: String(data?.id ?? `local-${Date.now()}`),
      jobNumber,
      customerName: selectedCustomer?.label ?? "Selected customer",
      address: "Address unavailable",
      projectType: "Standard Install",
      workflowTemplateName: "Standard Install Workflow",
      location: selectedCustomer?.location ?? "Ellsworth",
      status: "Active",
      scheduledDate: new Date().toISOString(),
      assignedTo: "Unassigned",
      assignedInitials: "UN",
      tasks: [
        {
          id: `task-${Date.now()}`,
          name: "Create kickoff checklist",
          dueDate: new Date().toISOString(),
          isComplete: false,
          assignedTo: "Unassigned",
        },
      ],
    };

    setProjects((current) => [nextProject, ...current]);
    setMessage(
      error
        ? "Project created locally for preview. Supabase insert was unavailable."
        : "Project created successfully.",
    );

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
              {filteredProjects.length}
            </span>
          }
          actionLabel={currentUser?.roleName === "Installer" ? undefined : "New project"}
          actionOnClick={currentUser?.roleName === "Installer" ? undefined : () => setIsModalOpen(true)}
        />

        <div className="flex-1 p-8">
          {message ? (
            <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
              {message}
            </div>
          ) : null}

          <div className="mb-6 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 xl:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                  Filter by assignment
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { key: "my_tasks", label: "My tasks" },
                    { key: "my_team", label: "My team" },
                    { key: "all_tasks", label: "All tasks" },
                  ]
                    .filter((option) =>
                      allowedAssignmentFilters.includes(option.key as AssignmentFilter),
                    )
                    .map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setAssignmentFilter(option.key as AssignmentFilter)}
                        disabled={currentUser?.roleName === "Installer"}
                        className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                          assignmentFilter === option.key
                            ? "bg-primary text-white"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        } disabled:cursor-not-allowed disabled:opacity-100`}
                      >
                        {option.label}
                      </button>
                    ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                  Filter by status
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { key: "all", label: "All" },
                    { key: "pending", label: "Pending only" },
                    { key: "overdue", label: "Overdue" },
                    { key: "due_this_week", label: "Due this week" },
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setStatusFilter(option.key as StatusFilter)}
                      disabled={currentUser?.roleName === "Installer" && option.key !== "pending"}
                      className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                        statusFilter === option.key
                          ? "bg-primary text-white"
                          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                  Filter by location
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { key: "all", label: "All locations" },
                    { key: "Ellsworth", label: "Ellsworth" },
                    { key: "Lindsay", label: "Lindsay" },
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setLocationFilter(option.key as LocationFilter)}
                      disabled={currentUser?.roleName === "Installer"}
                      className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                        locationFilter === option.key
                          ? "bg-primary text-white"
                          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      } disabled:cursor-not-allowed disabled:opacity-100`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="mt-4 text-sm text-stone-500">
              Showing {summary.projectCount} projects · {summary.overdueCount} overdue tasks ·{" "}
              {summary.dueThisWeekCount} due this week
            </p>
          </div>

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
                      {currentUser?.roleName === "Installer" ? (
                        <>
                          <th className="px-4 py-4">Address</th>
                          <th className="px-4 py-4">Scheduled date</th>
                        </>
                      ) : (
                        <>
                          <th className="px-4 py-4">Project type</th>
                          <th className="px-4 py-4">Workflow progress</th>
                          <th className="px-4 py-4">Next task due</th>
                          <th className="px-4 py-4">Location</th>
                        </>
                      )}
                      <th className="px-4 py-4">Status</th>
                      {currentUser?.roleName === "Installer" ? null : (
                        <th className="px-4 py-4">Assigned to</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {filteredProjects.map((project) => {
                      const completionPercent =
                        project.totalTasks > 0
                          ? Math.round((project.completedTasks / project.totalTasks) * 100)
                          : 0;

                      return (
                        <tr
                          key={project.id}
                          className={`hover:bg-stone-50 ${currentUser?.roleName === "Installer" ? "cursor-pointer" : ""}`}
                          onClick={() => {
                            if (currentUser?.roleName === "Installer") {
                              router.push(`/projects/${project.id}`);
                            }
                          }}
                        >
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
                          {currentUser?.roleName === "Installer" ? (
                            <>
                              <td className="px-4 py-4 text-sm text-stone-600">{project.address}</td>
                              <td className="px-4 py-4 text-sm text-stone-600">
                                {formatDate(project.scheduledDate)}
                              </td>
                            </>
                          ) : (
                            <>
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
                            </>
                          )}
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusTone(project.status)}`}
                            >
                              {project.status}
                            </span>
                          </td>
                          {currentUser?.roleName === "Installer" ? null : (
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                                  {project.assignedInitials}
                                </div>
                                <span className="text-sm text-stone-700">{project.assignedTo}</span>
                              </div>
                            </td>
                          )}
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
