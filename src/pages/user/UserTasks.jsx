import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  ListTodo,
  Clock3,
  CircleCheck,
  CircleAlert,
  CalendarDays,
  SlidersHorizontal,
  RefreshCw,
  Play,
  Send,
  Eye,
  Download,
  X,
  Paperclip,
  FileText,
  UserRound,
  Flag,
  Plus,
} from "lucide-react";
import api from "../../services/api";

const filters = [
  { label: "All", value: "All" },
  { label: "Pending", value: "pending" },
  { label: "In Progress", value: "in_progress" },
  { label: "Submitted", value: "submitted" },
  { label: "Completed", value: "completed" },
];

const normalizeStatus = (status) =>
  String(status || "pending").toLowerCase().replaceAll(" ", "_");

const statusLabel = (status) => {
  const labels = {
    pending: "Pending",
    in_progress: "In Progress",
    submitted: "Submitted",
    completed: "Completed",
    approved: "Approved",
    rejected: "Rejected",
  };

  return labels[normalizeStatus(status)] || status || "Pending";
};

const statusStyle = (status) => {
  const styles = {
    pending: "bg-amber-50 text-amber-700 border border-amber-200/60",
    in_progress: "bg-blue-50 text-blue-700 border border-blue-200/60",
    submitted: "bg-violet-50 text-violet-700 border border-violet-200/60",
    completed: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
    approved: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
    rejected: "bg-rose-50 text-rose-700 border border-rose-200/60",
  };

  return styles[normalizeStatus(status)] || "bg-slate-100 text-slate-700 border border-slate-200/60";
};

const statusIcon = (status) => {
  const normalized = normalizeStatus(status);

  if (["completed", "approved"].includes(normalized)) return CircleCheck;
  if (["in_progress", "submitted"].includes(normalized)) return Clock3;

  return CircleAlert;
};

const formatDate = (value) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Karachi",
  });
};

const getAttachments = (task) => {
  if (Array.isArray(task?.attachments)) return task.attachments;
  if (task?.attachment) return [task.attachment];
  if (task?.file) return [task.file];
  return [];
};

const getFileName = (file) =>
  file?.name || file?.filename || file?.originalname || "Attachment";

const getFilePath = (file) => file?.path || file?.url || file?.fileUrl || "";

const getTaskId = (task) => task?._id || task?.id;

const getApiError = (error, fallback) =>
  error.response?.data?.message || fallback;

export default function UserTasks() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);

  // Assign Task Modal State & File Upload
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [assignForm, setAssignForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    dueDate: "",
    priority: "medium",
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  const todayHeader = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/tasks");
      const data = response.data;

      const records = Array.isArray(data?.tasks)
        ? data.tasks
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [];

      setTasks(records);

      setSelectedTask((current) => {
        if (!current) return null;

        const currentId = getTaskId(current);
        return records.find((task) => getTaskId(task) === currentId) || current;
      });
    } catch (err) {
      setError(getApiError(err, "Could not load your tasks. Please try again."));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get("/users");
      const data = res.data?.users || res.data?.data || res.data || [];
      setUsersList(Array.isArray(data) ? data : []);
    } catch {
      setUsersList([]);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadUsers();
  }, [loadTasks, loadUsers]);

  const updateTaskStatus = async (task, nextStatus) => {
    const taskId = getTaskId(task);
    if (!taskId || updatingId) return;

    setUpdatingId(taskId);
    setActionError("");

    try {
      const response = await api.patch(`/tasks/${taskId}/status`, {
        status: nextStatus,
      });

      const updatedTask =
        response.data?.task ||
        response.data?.data ||
        response.data?.updatedTask;

      setTasks((currentTasks) =>
        currentTasks.map((item) => {
          if (getTaskId(item) !== taskId) return item;

          return updatedTask && typeof updatedTask === "object"
            ? { ...item, ...updatedTask }
            : { ...item, status: nextStatus };
        })
      );

      setSelectedTask((current) => {
        if (!current || getTaskId(current) !== taskId) return current;

        return updatedTask
          ? { ...current, ...updatedTask }
          : { ...current, status: nextStatus };
      });

      await loadTasks();
    } catch (err) {
      setActionError(getApiError(err, "Could not update this task. Please try again."));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setAssignError("");

    if (!assignForm.title.trim() || !assignForm.assignedTo) {
      setAssignError("Task title and assigned user are required.");
      return;
    }

    try {
      setAssigning(true);

      const formData = new FormData();
      formData.append("title", assignForm.title.trim());
      formData.append("description", assignForm.description.trim());
      formData.append("assignedTo", assignForm.assignedTo);
      formData.append("dueDate", assignForm.dueDate || "");
      formData.append("priority", assignForm.priority);
      if (selectedFile) {
        formData.append("attachment", selectedFile);
      }

      await api.post("/tasks", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setIsAssignModalOpen(false);
      setAssignForm({
        title: "",
        description: "",
        assignedTo: "",
        dueDate: "",
        priority: "medium",
      });
      setSelectedFile(null);
      loadTasks();
    } catch (err) {
      setAssignError(getApiError(err, "Failed to assign task."));
    } finally {
      setAssigning(false);
    }
  };

  const downloadAttachment = async (task, file) => {
    const taskId = getTaskId(task);
    const filePath = getFilePath(file);

    setDownloadError("");

    try {
      setDownloading(true);

      const response = await api.get(
        `/tasks/${taskId}/attachments/${file?._id || file?.id || ""}/download`,
        { responseType: "blob" }
      );

      const blobUrl = window.URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = getFileName(file);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      if (filePath.startsWith("https://") || filePath.startsWith("http://")) {
        window.open(filePath, "_blank", "noopener,noreferrer");
      } else {
        setDownloadError(
          getApiError(
            err,
            "Download endpoint is not configured yet. Backend download route is required."
          )
        );
      }
    } finally {
      setDownloading(false);
    }
  };

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        String(task.title || "").toLowerCase().includes(query) ||
        String(task.description || "").toLowerCase().includes(query);

      const taskStatus = normalizeStatus(task.status);
      const matchesStatus =
        status === "All" ||
        (status === "completed"
          ? ["completed", "approved"].includes(taskStatus)
          : taskStatus === status);

      return matchesSearch && matchesStatus;
    });
  }, [tasks, search, status]);

  const inProgressCount = tasks.filter(
    (task) => normalizeStatus(task.status) === "in_progress"
  ).length;

  const completedCount = tasks.filter((task) =>
    ["completed", "approved"].includes(normalizeStatus(task.status))
  ).length;

  const summaryItems = [
    { label: "Total Tasks", value: tasks.length, icon: ListTodo },
    { label: "In Progress", value: inProgressCount, icon: Clock3 },
    { label: "Completed", value: completedCount, icon: CircleCheck },
  ];

  const selectedAttachments = getAttachments(selectedTask);

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-3xl p-6 shadow-xs border border-slate-100">
        <div>
          <span className="text-xs font-bold tracking-wider text-violet-600 uppercase">
            My Workspace
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            My Tasks
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs">
            <CalendarDays size={17} className="text-violet-600" />
            <span>{todayHeader}</span>
          </div>
          <button
            type="button"
            onClick={() => setIsAssignModalOpen(true)}
            className="flex items-center gap-2 h-11 px-5 rounded-2xl bg-violet-600 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-95 cursor-pointer"
          >
            <Plus size={18} /> Assign Task
          </button>
        </div>
      </div>

      {/* Summary Stat Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summaryItems.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs transition hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-slate-500">{item.label}</p>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                  <Icon size={22} />
                </div>
              </div>
              <p className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
                {loading ? "…" : item.value}
              </p>
              <p className="mt-1 text-xs text-slate-400">Current records</p>
            </div>
          );
        })}
      </div>

      {/* Main Assigned Tasks Container */}
      <div className="rounded-3xl border border-slate-100 bg-white shadow-xs overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Assigned Tasks</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Select a task to view its full details and files.
            </p>
          </div>

          <div className="flex gap-3">
            <div className="relative w-full lg:max-w-xs">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks..."
                className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 pl-10 pr-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
            </div>

            <button
              type="button"
              onClick={loadTasks}
              disabled={loading}
              aria-label="Refresh tasks"
              title="Refresh tasks"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50 text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatus(filter.value)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                status === filter.value
                  ? "bg-violet-600 text-white shadow-sm"
                  : "bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="m-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
            <p>{error}</p>
            <button type="button" onClick={loadTasks} className="mt-2 font-bold underline">
              Try again
            </button>
          </div>
        )}

        {actionError && (
          <div role="alert" className="mx-6 mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
            {actionError}
          </div>
        )}

        {loading ? (
          <div className="px-6 py-16 text-center text-sm text-slate-400">
            Loading your tasks…
          </div>
        ) : !error && filteredTasks.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredTasks.map((task, index) => {
              const currentStatus = normalizeStatus(task.status);
              const Icon = statusIcon(currentStatus);
              const taskId = getTaskId(task) || index;
              const dueDate = formatDate(task.dueDate);

              return (
                <div
                  key={taskId}
                  className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-slate-50/50"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900">
                      {task.title || "Untitled task"}
                    </h3>

                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-400">
                      {task.description || "No description provided."}
                    </p>

                    {dueDate && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <CalendarDays size={14} className="text-slate-400" />
                        Due {dueDate}
                      </p>
                    )}

                    <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${statusStyle(currentStatus)}`}>
                      <Icon size={14} />
                      {statusLabel(currentStatus)}
                    </span>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTask(task);
                        setDownloadError("");
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 active:scale-95"
                    >
                      <Eye size={15} />
                      View Details
                    </button>

                    {currentStatus === "pending" && (
                      <button
                        type="button"
                        disabled={Boolean(updatingId)}
                        onClick={() => updateTaskStatus(task, "in_progress")}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50 active:scale-95"
                      >
                        <Play size={15} />
                        {updatingId === taskId ? "Updating…" : "Start Task"}
                      </button>
                    )}

                    {["pending", "in_progress", "rejected"].includes(currentStatus) && (
                      <button
                        type="button"
                        disabled={Boolean(updatingId)}
                        onClick={() => updateTaskStatus(task, "submitted")}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 active:scale-95"
                      >
                        <Send size={15} />
                        {updatingId === taskId ? "Updating…" : "Submit Task"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : !error ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 border border-violet-100">
              <SlidersHorizontal size={25} />
            </div>
            <h3 className="mt-4 font-bold text-slate-900">
              {tasks.length === 0 ? "No tasks available" : "No matching tasks"}
            </h3>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-400">
              {tasks.length === 0
                ? "Your assigned tasks will appear here when they are available."
                : "Try changing your search or selecting a different status filter."}
            </p>
            {(search || status !== "All") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatus("All");
                }}
                className="mt-4 rounded-xl px-4 py-2 text-xs font-bold text-violet-600 hover:bg-violet-50"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* Assign Task Modal with File Upload */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Assign New Task</h3>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {assignError && (
              <div className="rounded-2xl bg-rose-50 p-3 text-xs font-bold text-rose-700">
                {assignError}
              </div>
            )}

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Task Title</label>
                <input
                  type="text"
                  value={assignForm.title}
                  onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })}
                  placeholder="Enter task title..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:outline-violet-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assign To Team Member</label>
                <select
                  value={assignForm.assignedTo}
                  onChange={(e) => setAssignForm({ ...assignForm, assignedTo: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:outline-violet-600"
                  required
                >
                  <option value="">Select team member...</option>
                  {usersList.map((u) => (
                    <option key={u._id || u.id} value={u._id || u.id}>
                      {u.name} ({u.role || "user"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={assignForm.dueDate}
                    onChange={(e) => setAssignForm({ ...assignForm, dueDate: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:outline-violet-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={assignForm.priority}
                    onChange={(e) => setAssignForm({ ...assignForm, priority: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:outline-violet-600"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows="3"
                  value={assignForm.description}
                  onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })}
                  placeholder="Task details..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:outline-violet-600 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Attachment File (Optional)</label>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="h-10 px-5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="h-10 px-6 rounded-xl bg-violet-600 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {assigning ? "Assigning..." : "Assign Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedTask(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-details-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-100 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50/50 p-6">
              <div className="pr-4">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-600">
                  Task Details
                </span>
                <h2 id="task-details-title" className="mt-0.5 text-xl font-bold text-slate-900">
                  {selectedTask.title || "Untitled task"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close task details"
                onClick={() => setSelectedTask(null)}
                className="rounded-2xl p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 p-6 sm:p-7">
              <div>
                <p className="mb-2 text-sm font-bold text-slate-800">Description</p>
                <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-500">
                  {selectedTask.description || "No description provided."}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                    <CircleAlert size={14} /> Status
                  </p>
                  <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusStyle(selectedTask.status)}`}>
                    {statusLabel(selectedTask.status)}
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                    <Flag size={14} /> Priority
                  </p>
                  <p className="mt-2 text-sm font-bold capitalize text-slate-800">
                    {selectedTask.priority || "Medium"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                    <CalendarDays size={14} /> Due Date
                  </p>
                  <p className="mt-2 text-sm font-bold text-slate-800">
                    {formatDate(selectedTask.dueDate) || "No due date"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                    <UserRound size={14} /> Assigned By
                  </p>
                  <p className="mt-2 text-sm font-bold text-slate-800">
                    {selectedTask.assignedBy?.name || "Not available"}
                  </p>
                </div>
              </div>

              {selectedTask.rejectionReason && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm font-bold text-rose-800">Rejection Reason</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-rose-700">
                    {selectedTask.rejectionReason}
                  </p>
                </div>
              )}

              <div>
                <h3 className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <Paperclip size={17} className="text-violet-600" />
                  Attachments ({selectedAttachments.length})
                </h3>

                {selectedAttachments.length > 0 ? (
                  <div className="mt-3 space-y-2.5">
                    {selectedAttachments.map((file, index) => (
                      <div
                        key={file._id || file.id || `${getFileName(file)}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/40 p-3.5 shadow-2xs"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="rounded-xl bg-violet-50 p-2.5 text-violet-600">
                            <FileText size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-800">
                              {getFileName(file)}
                            </p>
                            <p className="text-xs text-slate-400">
                              {formatDate(file.uploadedAt) || "Task attachment"}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={downloading}
                          onClick={() => downloadAttachment(selectedTask, file)}
                          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50 active:scale-95 shadow-sm"
                        >
                          <Download size={14} />
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-xs text-slate-400 text-center">
                    No files are attached to this task.
                  </p>
                )}

                {downloadError && (
                  <p role="alert" className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
                    {downloadError}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 bg-slate-50/50 p-6">
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="rounded-2xl border border-slate-200/80 bg-white px-6 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}