import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  ListTodo,
  Clock3,
  CircleCheck,
  CalendarDays,
  Filter,
  Trash2,
  ClipboardList,
  AlertCircle,
  RefreshCw,
  UserRound,
  Paperclip,
  FileText,
  Download,
  X,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const STATUS_LABELS = {
  pending: "Pending",
  in_progress: "In Progress",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
};

const PRIORITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200/60",
  in_progress: "bg-sky-50 text-sky-700 border border-sky-200/60",
  submitted: "bg-violet-50 text-violet-700 border border-violet-200/60",
  approved: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
  rejected: "bg-rose-50 text-rose-700 border border-rose-200/60",
  completed: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
};

const PRIORITY_STYLES = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-orange-50 text-orange-700",
  urgent: "bg-rose-100 text-rose-800",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  assignedTo: "",
  priority: "medium",
  dueDate: "",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv",
  ".txt", ".png", ".jpg", ".jpeg", ".webp", ".zip",
];

const inputClass =
  "mt-2 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 px-4 py-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100";

const labelClass = "block text-sm font-bold text-slate-800";

const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm active:scale-95";

const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 active:scale-95";

function getId(item) {
  return item?._id || item?.id || item?.userId || "";
}

function getUserName(user) {
  return (
    user?.name ||
    user?.fullName ||
    user?.username ||
    user?.email ||
    "Unnamed User"
  );
}

function normalizeList(response, keys = []) {
  if (Array.isArray(response)) return response;

  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key];
    if (Array.isArray(response?.data?.[key])) return response.data[key];
  }

  if (Array.isArray(response?.data)) return response.data;
  return [];
}

async function apiRequest(path, options = {}) {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(isFormData || options.body == null
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const result = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok || result?.success === false) {
    throw new Error(
      result?.message ||
        result?.error ||
        (typeof result === "string" && result) ||
        `Request failed (${response.status})`,
    );
  }

  return result;
}

function getTaskAttachment(task) {
  const attachment =
    task?.attachment ||
    task?.file ||
    task?.attachments?.[0] ||
    task?.files?.[0] ||
    null;

  if (!attachment) return null;

  if (typeof attachment === "string") {
    return {
      name: attachment.split("/").pop() || "Download attachment",
      url: attachment,
    };
  }

  return {
    name:
      attachment.originalName ||
      attachment.originalname ||
      attachment.filename ||
      attachment.name ||
      "Task attachment",
    url:
      attachment.url ||
      attachment.fileUrl ||
      attachment.path ||
      attachment.downloadUrl ||
      "",
  };
}

function normalizeTask(task) {
  const assignedUser = task?.assignedTo || null;

  return {
    id: getId(task),
    title: task?.title || "Untitled Task",
    description: task?.description || "",
    assigneeName:
      typeof assignedUser === "object"
        ? getUserName(assignedUser)
        : task?.assigneeName || "Assigned user",
    status: String(task?.status || "pending").toLowerCase(),
    priority: String(task?.priority || "medium").toLowerCase(),
    dueDate: task?.dueDate ? String(task.dueDate).slice(0, 10) : "",
    attachment: getTaskAttachment(task),
  };
}

function SectionTitle({ eyebrow, title, description }) {
  return (
    <div>
      {eyebrow && (
        <span className="text-xs font-bold uppercase tracking-wider text-violet-600">
          {eyebrow}
        </span>
      )}
      <h3 className="text-lg font-bold tracking-tight text-slate-900 mt-0.5">
        {title}
      </h3>
      {description && (
        <p className="mt-0.5 text-xs text-slate-400">{description}</p>
      )}
    </div>
  );
}

function TaskModal({ users, saving, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0] || null;
    setError("");

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const extension = `.${selectedFile.name.split(".").pop().toLowerCase()}`;

    if (!ALLOWED_FILE_TYPES.includes(extension)) {
      setError(
        "Unsupported file type. Upload PDF, Office documents, images, CSV, TXT or ZIP.",
      );
      event.target.value = "";
      setFile(null);
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("File size must be 10 MB or less.");
      event.target.value = "";
      setFile(null);
      return;
    }

    setFile(selectedFile);
  }

  async function submit(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("Task title is required.");
      return;
    }

    if (!form.assignedTo) {
      setError("Please select a user.");
      return;
    }

    try {
      await onSave({
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        dueDate: form.dueDate || "",
        attachment: file,
      });
    } catch (err) {
      setError(err.message || "Unable to create task.");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="my-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-violet-600">
              Task Management
            </span>
            <h2 className="mt-0.5 text-xl font-bold text-slate-900">
              Create New Task
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Assign work to a team member and attach a file if needed.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-2xl p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5 p-6 sm:p-7">
          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
            >
              {error}
            </div>
          )}

          <label className={labelClass}>
            Task Title *
            <input
              required
              maxLength={200}
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
              className={inputClass}
              placeholder="Enter task title"
            />
          </label>

          <label className={labelClass}>
            Description
            <textarea
              rows={3}
              maxLength={5000}
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              className={inputClass}
              placeholder="Describe the task and expected outcome"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Assign To *
              <select
                required
                value={form.assignedTo}
                onChange={(event) => update("assignedTo", event.target.value)}
                className={inputClass}
              >
                <option value="">Select a user</option>
                {users.map((user) => (
                  <option key={getId(user)} value={getId(user)}>
                    {getUserName(user)}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              Due Date
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => update("dueDate", event.target.value)}
                className={inputClass}
              />
            </label>

            <label className="sm:col-span-2">
              <span className={labelClass}>Priority</span>
              <select
                value={form.priority}
                onChange={(event) => update("priority", event.target.value)}
                className={inputClass}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
          </div>

          <div>
            <label
              htmlFor="task-attachment"
              className={labelClass}
            >
              Attach File (Optional)
            </label>

            <div className="mt-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-4 transition hover:border-violet-300">
              <label
                htmlFor="task-attachment"
                className="flex cursor-pointer items-center gap-3.5"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                  <Paperclip size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-800">
                    Choose a file
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    PDF, Office docs, images, CSV, TXT or ZIP · Max 10 MB
                  </span>
                </span>
              </label>

              <input
                id="task-attachment"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp,.zip"
                onChange={handleFileChange}
                className="sr-only"
              />

              {file && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FileText size={18} className="shrink-0 text-violet-600" />
                    <span className="truncate text-sm font-semibold text-slate-700">
                      {file.name}
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove attachment"
                    onClick={() => setFile(null)}
                    className="rounded-xl p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <X size={17} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={secondaryButton}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || users.length === 0}
              className={primaryButton}
            >
              {saving && <RefreshCw size={16} className="animate-spin" />}
              {saving ? "Saving..." : "Assign Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminTasks() {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTask, setDeleteTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("en", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    []
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const results = await Promise.allSettled([
        apiRequest("/tasks"),
        apiRequest("/users"),
      ]);

      const [tasksRes, usersRes] = results;

      if (tasksRes.status === "fulfilled") {
        setTasks(
          normalizeList(tasksRes.value, ["tasks", "results"]).map(normalizeTask),
        );
      } else {
        setTasks([]);
        setPageError(
          `Could not load tasks: ${tasksRes.reason?.message || "Request failed"}`,
        );
      }

      if (usersRes.status === "fulfilled") {
        setUsers(
          normalizeList(usersRes.value, [
            "users",
            "results",
            "employees",
          ]).filter((user) => getId(user)),
        );
      } else {
        setUsers([]);
        setPageError((current) =>
          [
            current,
            `Could not load users: ${usersRes.reason?.message || "Request failed"}`,
          ]
            .filter(Boolean)
            .join(" "),
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(
    () => [
      {
        label: "Total Tasks",
        value: tasks.length,
        icon: ClipboardList,
        iconStyle: "bg-violet-50 text-violet-600",
      },
      {
        label: "Pending",
        value: tasks.filter((task) => task.status === "pending").length,
        icon: Clock3,
        iconStyle: "bg-amber-50 text-amber-600",
      },
      {
        label: "In Progress",
        value: tasks.filter((task) => task.status === "in_progress").length,
        icon: AlertCircle,
        iconStyle: "bg-sky-50 text-sky-600",
      },
      {
        label: "Completed",
        value: tasks.filter((task) => task.status === "completed").length,
        icon: CircleCheck,
        iconStyle: "bg-emerald-50 text-emerald-600",
      },
    ],
    [tasks],
  );

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        !query ||
        task.title.toLowerCase().includes(query) ||
        task.assigneeName.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query);

      return (
        matchesSearch &&
        (statusFilter === "All" || task.status === statusFilter) &&
        (priorityFilter === "All" || task.priority === priorityFilter)
      );
    });
  }, [tasks, search, statusFilter, priorityFilter]);

  async function saveTask(form) {
    setSaving(true);
    setPageError("");
    setNotice("");

    try {
      const payload = new FormData();
      payload.append("title", form.title);
      payload.append("description", form.description);
      payload.append("assignedTo", form.assignedTo);
      payload.append("priority", form.priority);
      payload.append("dueDate", form.dueDate || "");

      if (form.attachment) {
        payload.append("attachment", form.attachment);
      }

      const result = await apiRequest("/tasks", {
        method: "POST",
        body: payload,
      });

      setModalOpen(false);
      setNotice(result?.message || "Task created successfully.");
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(task, status) {
    setPageError("");
    setNotice("");

    try {
      await apiRequest(`/tasks/${encodeURIComponent(task.id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      await loadData();
      setNotice("Task status updated.");
    } catch (error) {
      setPageError(`Could not update task status: ${error.message}`);
    }
  }

  async function confirmDelete() {
    if (!deleteTask?.id) return;

    setSaving(true);
    setPageError("");
    setNotice("");

    try {
      const result = await apiRequest(
        `/tasks/${encodeURIComponent(deleteTask.id)}`,
        { method: "DELETE" },
      );

      setTasks((current) =>
        current.filter((task) => task.id !== deleteTask.id),
      );
      setDeleteTask(null);
      setNotice(result?.message || "Task deleted successfully.");
    } catch (error) {
      setPageError(`Could not delete task: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-3xl p-6 shadow-xs border border-slate-100">
        <div>
          <span className="text-xs font-bold tracking-wider text-violet-600 uppercase">
            Admin Workspace
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Task Management
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs">
            <CalendarDays size={17} className="text-violet-600" />
            <span>{today}</span>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className={secondaryButton}
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={users.length === 0}
            className={primaryButton}
          >
            <Plus size={18} />
            Add Task
          </button>
        </div>
      </div>

      {pageError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3.5 text-sm font-medium text-rose-700 shadow-2xs"
        >
          <span>{pageError}</span>
          <button
            type="button"
            onClick={loadData}
            className="font-semibold underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm font-medium text-emerald-700 shadow-2xs"
        >
          {notice}
        </div>
      )}

      {/* Task Overview Stat Cards */}
      <section>
        <div className="mb-4 px-1">
          <SectionTitle
            eyebrow="At a glance"
            title="Task Overview"
            description="A summary of the current task workload."
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs transition hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-slate-500">
                    {stat.label}
                  </p>
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${stat.iconStyle}`}
                  >
                    <Icon size={22} />
                  </span>
                </div>
                <p className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
                  {loading ? "—" : stat.value}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {loading ? "Loading..." : "Backend records"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Task Records Table Container */}
      <section className="rounded-3xl border border-slate-100 bg-white shadow-xs overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-6 lg:flex-row lg:items-center lg:justify-between">
          <SectionTitle
            title="Task Records"
            description="Search, filter and update task progress."
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks..."
                className={`${inputClass} mt-0 min-h-11 py-2.5 pl-10 sm:w-56`}
              />
            </div>

            <div className="relative">
              <Filter
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-700 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100 sm:w-44"
              >
                <option value="All">All statuses</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <select
              aria-label="Filter by priority"
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              className="min-h-11 rounded-2xl border border-slate-200/80 bg-slate-50/40 px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
            >
              <option value="All">All priorities</option>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left">
            <thead className="bg-slate-50/50 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-bold">Task Details</th>
                <th className="px-6 py-4 font-bold">Assigned To</th>
                <th className="px-6 py-4 font-bold">Attachment</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Priority</th>
                <th className="px-6 py-4 font-bold">Due Date</th>
                <th className="px-6 py-4 text-right font-bold">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {!loading &&
                filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="transition-colors hover:bg-slate-50/50"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3.5">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                          <ListTodo size={18} />
                        </div>
                        <div className="max-w-xs">
                          <p className="font-bold text-slate-800">
                            {task.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-400">
                            {task.description || "No description"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold text-xs">
                          {task.assigneeName.charAt(0).toUpperCase()}
                        </span>
                        <span className="text-sm font-bold text-slate-700">
                          {task.assigneeName}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {task.attachment?.url ? (
                        <a
                          href={
                            task.attachment.url.startsWith("http")
                              ? task.attachment.url
                              : `${API_BASE.replace(/\/api$/, "")}/${task.attachment.url.replace(/^\/+/, "")}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-48 items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700"
                          title={task.attachment.name}
                        >
                          <Download size={15} className="shrink-0" />
                          <span className="truncate">
                            {task.attachment.name}
                          </span>
                        </a>
                      ) : task.attachment?.name ? (
                        <span className="inline-flex max-w-48 items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <FileText size={15} className="shrink-0" />
                          <span className="truncate">
                            {task.attachment.name}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">
                          No attachment
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <select
                        aria-label={`Status for ${task.title}`}
                        value={task.status}
                        onChange={(event) =>
                          updateStatus(task, event.target.value)
                        }
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset outline-none focus:ring-2 focus:ring-violet-200 cursor-pointer ${
                          STATUS_STYLES[task.status] || STATUS_STYLES.pending
                        }`}
                      >
                        {Object.entries(STATUS_LABELS).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                          PRIORITY_STYLES[task.priority] ||
                          PRIORITY_STYLES.medium
                        }`}
                      >
                        {PRIORITY_LABELS[task.priority] || task.priority}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                        <CalendarDays size={14} className="text-slate-400" />
                        {task.dueDate || "Not set"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          title="Delete task"
                          aria-label={`Delete ${task.title}`}
                          onClick={() => setDeleteTask(task)}
                          className="rounded-2xl p-2.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="p-12 text-center">
            <RefreshCw
              size={28}
              className="mx-auto animate-spin text-violet-600"
            />
            <p className="mt-3 text-sm text-slate-400">
              Loading backend records...
            </p>
          </div>
        )}

        {!loading && filteredTasks.length === 0 && (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-300 border border-slate-100">
              <ListTodo size={28} />
            </div>
            <p className="mt-3 font-bold text-slate-800">
              {tasks.length === 0 ? "No tasks available" : "No tasks found"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {tasks.length === 0
                ? "Tasks from your backend will appear here."
                : "Try a different search or filter."}
            </p>
          </div>
        )}

        {!loading && filteredTasks.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
            <p className="text-xs text-slate-400">
              Showing{" "}
              <span className="font-bold text-slate-700">
                {filteredTasks.length}
              </span>{" "}
              of{" "}
              <span className="font-bold text-slate-700">
                {tasks.length}
              </span>{" "}
              tasks
            </p>
            <span className="text-xs font-bold text-slate-400">
              LocalPro1 Task Management
            </span>
          </div>
        )}
      </section>

      {/* Modal and Delete Dialogs */}
      {modalOpen && (
        <TaskModal
          users={users}
          saving={saving}
          onClose={() => !saving && setModalOpen(false)}
          onSave={saveTask}
        />
      )}

      {deleteTask && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
            <div className="border-b border-slate-100 bg-slate-50/50 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
                <Trash2 size={22} />
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-900">
                Delete this task?
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                This task will be deleted from the backend. This action cannot
                be undone.
              </p>
            </div>

            <div className="flex justify-end gap-3 p-5">
              <button
                type="button"
                onClick={() => setDeleteTask(null)}
                disabled={saving}
                className={secondaryButton}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50 active:scale-95 shadow-sm"
              >
                {saving && <RefreshCw size={15} className="animate-spin" />}
                {saving ? "Deleting..." : "Delete Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}