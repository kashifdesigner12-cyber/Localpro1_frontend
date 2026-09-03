"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CalendarDays,
  CheckCircle2,
  Clock,
  ClipboardList,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  User,
  X,
} from "lucide-react";

import { taskService } from "@/services/taskService";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.localpro1.net/api";

// ==========================================
// Manager Tasks Page
// ==========================================

export default function ManagerTasksPage() {
  const router = useRouter();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");

  // Selected task state for Quick View Modal
  const [selectedTask, setSelectedTask] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  /*
   * ============================================================
   * API HELPER
   * ============================================================
   */

  const fetchJson = useCallback(async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    let result = null;

    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok || result?.success === false) {
      const requestError = new Error(
        result?.message ||
          result?.error ||
          `Request failed with status ${response.status}.`
      );

      requestError.status = response.status;

      throw requestError;
    }

    return result;
  }, []);

  // ========================================
  // Load Tasks
  // ========================================

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await taskService.getTasks();

      let backendTasks = [];

      if (Array.isArray(response?.tasks)) {
        backendTasks = response.tasks;
      } else if (Array.isArray(response?.data)) {
        backendTasks = response.data;
      } else if (Array.isArray(response?.data?.tasks)) {
        backendTasks = response.data.tasks;
      } else if (Array.isArray(response)) {
        backendTasks = response;
      }

      setTasks(backendTasks);
    } catch (err) {
      console.error("Manager tasks error:", err);

      if (
        err?.message === "UNAUTHORIZED" ||
        err?.message === "FORBIDDEN" ||
        err?.status === 401
      ) {
        router.replace("/login");
        return;
      }

      setError(err?.message || "Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // ========================================
  // Quick Status Update Handler
  // ========================================

  async function handleQuickStatusUpdate(taskId, newStatus) {
    if (!taskId || !newStatus) return;

    setIsUpdatingStatus(true);
    try {
      const result = await fetchJson(`${API_URL}/tasks/${taskId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });

      const updatedTask = result?.task || result?.data;

      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t._id === taskId || t.id === taskId
            ? { ...t, status: newStatus, ...(updatedTask || {}) }
            : t
        )
      );

      if (
        selectedTask &&
        (selectedTask._id === taskId || selectedTask.id === taskId)
      ) {
        setSelectedTask((prev) => ({
          ...prev,
          status: newStatus,
          ...(updatedTask || {}),
        }));
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      alert(err.message || "Could not update status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  // ========================================
  // Filters
  // ========================================

  const hasFilters =
    search.trim() !== "" ||
    status !== "all" ||
    priority !== "all";

  const filteredTasks = useMemo(() => {
    const searchValue = search.toLowerCase().trim();

    return tasks.filter((task) => {
      const assignedName =
        typeof task.assignedTo === "object"
          ? task.assignedTo?.name ||
            task.assignedTo?.email ||
            ""
          : task.assignedTo || "";

      const title = task.title?.toLowerCase() || "";
      const description = task.description?.toLowerCase() || "";
      const assigned = assignedName?.toLowerCase() || "";
      const taskStatus = task.status?.toLowerCase() || "";
      const taskPriority = task.priority?.toLowerCase() || "";

      const matchesSearch =
        !searchValue ||
        title.includes(searchValue) ||
        description.includes(searchValue) ||
        assigned.includes(searchValue);

      const matchesStatus =
        status === "all" ||
        taskStatus === status.toLowerCase();

      const matchesPriority =
        priority === "all" ||
        taskPriority === priority.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority
      );
    });
  }, [tasks, search, status, priority]);

  // ========================================
  // Clear Filters
  // ========================================

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setPriority("all");
  };

  // ========================================
  // Render
  // ========================================

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC]">
      <main className="w-full p-5 sm:p-6 lg:p-8">
        <div className="w-full space-y-6">
          {/* ==================================
              Page Header
              ================================== */}
          <section className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#2563EB]">
                MANAGER WORKSPACE
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
                Tasks Overview
              </h1>

              <p className="mt-2 text-sm text-[#64748B]">
                Manage, monitor, and assign your team&apos;s workspace tasks.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={loadTasks}
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#26344D] shadow-xs transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <RefreshCw size={17} />
                )}
                Refresh
              </button>

              <Link
                href="/manager/tasks/new"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#1D4ED8]"
              >
                <Plus size={18} />
                Add Task
              </Link>
            </div>
          </section>

          {/* ==================================
              Error Alert
              ================================== */}
          {error && (
            <section className="w-full rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-red-700">{error}</p>
                <button
                  type="button"
                  onClick={loadTasks}
                  disabled={loading}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
                >
                  <RefreshCw size={14} />
                  Try Again
                </button>
              </div>
            </section>
          )}

          {/* ==================================
              Filters
              ================================== */}
          <section className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex w-full flex-col gap-3 lg:flex-row">
              {/* Search */}
              <div className="relative min-w-0 flex-1">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search tasks by title, description, or assigned member..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              {/* Status */}
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#64748B] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 lg:w-48"
              >
                <option value="all">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              {/* Priority */}
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#64748B] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 lg:w-48"
              >
                <option value="all">All Priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>

              {/* Clear */}
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasFilters}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D] disabled:cursor-not-allowed disabled:opacity-40 lg:w-auto"
              >
                <SlidersHorizontal size={17} />
                Clear Filters
              </button>
            </div>
          </section>

          {/* ==================================
              Task Table
              ================================== */}
          <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Table Header */}
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#171B3A]">
                    Workspace Tasks
                  </h2>
                  <p className="mt-1 text-sm text-[#64748B]">
                    {loading
                      ? "Loading tasks..."
                      : `${filteredTasks.length} task${
                          filteredTasks.length !== 1 ? "s" : ""
                        } displayed.`}
                  </p>
                </div>

                {!loading && (
                  <span className="inline-flex w-fit rounded-full bg-[#EEF4FF] px-3 py-1 text-xs font-bold text-[#2563EB]">
                    {tasks.length} Total
                  </span>
                )}
              </div>
            </div>

            {/* Loading */}
            {loading ? (
              <div className="flex min-h-[330px] w-full flex-col items-center justify-center">
                <Loader2
                  size={30}
                  className="animate-spin text-[#2563EB]"
                />
                <p className="mt-3 text-sm font-medium text-[#64748B]">
                  Loading tasks...
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-slate-400 sm:px-6">
                        Task
                      </th>
                      <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                        Assigned To
                      </th>
                      <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                        Status
                      </th>
                      <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                        Priority
                      </th>
                      <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                        Due Date
                      </th>
                      <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-wide text-slate-400 sm:pr-6">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredTasks.length > 0 ? (
                      filteredTasks.map((task) => (
                        <TaskTableRow
                          key={task._id || task.id}
                          task={task}
                          onQuickView={() => setSelectedTask(task)}
                        />
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6">
                          <div className="flex min-h-[330px] w-full flex-col items-center justify-center px-6 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                              <ClipboardList size={25} />
                            </div>

                            <h3 className="mt-4 text-sm font-bold text-[#171B3A]">
                              No tasks available
                            </h3>

                            <p className="mt-2 max-w-sm text-sm leading-6 text-[#64748B]">
                              {hasFilters
                                ? "No task records match the selected filters."
                                : "There are currently no task records in the backend."}
                            </p>

                            {hasFilters ? (
                              <button
                                type="button"
                                onClick={clearFilters}
                                className="mt-4 text-sm font-bold text-[#2563EB] hover:underline"
                              >
                                Clear filters
                              </button>
                            ) : (
                              <Link
                                href="/manager/tasks/new"
                                className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-bold text-white transition hover:bg-[#1D4ED8]"
                              >
                                <Plus size={16} />
                                Add First Task
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ======================================================
          TASK QUICK VIEW MODAL
      ====================================================== */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 py-4">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                  {selectedTask._id || selectedTask.id}
                </span>
                <h3 className="mt-0.5 text-lg font-bold text-[#171B3A]">
                  {selectedTask.title || "Untitled Task"}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-6 p-6">
              {/* Description */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Description
                </h4>
                <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm leading-relaxed text-[#26344D]">
                  {selectedTask.description ||
                    "No description provided for this task."}
                </div>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-white p-4 sm:grid-cols-2">
                <div>
                  <span className="mb-1 block text-xs text-slate-400">
                    Assigned User
                  </span>
                  <div className="flex items-center gap-2">
                    <User size={15} className="text-[#2563EB]" />
                    <span className="text-sm font-semibold text-[#171B3A]">
                      {typeof selectedTask.assignedTo === "object"
                        ? selectedTask.assignedTo?.name ||
                          selectedTask.assignedTo?.email ||
                          "Unassigned"
                        : selectedTask.assignedTo || "Unassigned"}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="mb-1 block text-xs text-slate-400">
                    Due Date
                  </span>
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-amber-500" />
                    <span className="text-sm font-semibold text-[#171B3A]">
                      {formatDate(selectedTask.dueDate)}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="mb-1 block text-xs text-slate-400">
                    Priority
                  </span>
                  <StatusBadge
                    value={selectedTask.priority || "Medium"}
                    type="priority"
                  />
                </div>

                <div>
                  <span className="mb-1 block text-xs text-slate-400">
                    Category
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {selectedTask.category || "General"}
                  </span>
                </div>
              </div>

              {/* Status Update Actions */}
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Update Task Status
                </h4>
                <div className="flex flex-wrap gap-2">
                  {["Pending", "In Progress", "Completed", "Cancelled"].map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={
                          isUpdatingStatus || selectedTask.status === st
                        }
                        onClick={() =>
                          handleQuickStatusUpdate(
                            selectedTask._id || selectedTask.id,
                            st
                          )
                        }
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                          selectedTask.status === st
                            ? "border-[#2563EB] bg-[#2563EB] text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {selectedTask.status === st && (
                          <CheckCircle2 size={13} />
                        )}
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Comments Preview */}
              {Array.isArray(selectedTask.comments) &&
                selectedTask.comments.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                      Comments ({selectedTask.comments.length})
                    </h4>
                    <div className="max-h-40 space-y-2 overflow-y-auto">
                      {selectedTask.comments.map((c, i) => (
                        <div
                          key={c._id || i}
                          className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs"
                        >
                          <div className="mb-1 flex justify-between font-semibold text-slate-500">
                            <span>{c.user?.name || "User"}</span>
                            <span>{formatDate(c.createdAt)}</span>
                          </div>
                          <p className="text-slate-800">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 flex items-center justify-end border-t border-slate-100 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="h-10 rounded-xl bg-slate-100 px-6 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Task Table Row (Clean: View Only)
// ==========================================

function TaskTableRow({ task, onQuickView }) {
  const assignedTo =
    typeof task.assignedTo === "object"
      ? task.assignedTo?.name ||
        task.assignedTo?.email ||
        "Unassigned"
      : task.assignedTo || "Unassigned";

  return (
    <tr className="border-b border-slate-100 transition hover:bg-slate-50/60 last:border-b-0">
      {/* Task */}
      <td className="px-5 py-4 sm:px-6">
        <div>
          <p className="text-sm font-bold text-[#171B3A]">
            {task.title || "Untitled Task"}
          </p>

          <p className="mt-1 max-w-xs truncate text-xs text-[#64748B]">
            {task.description || "No description provided."}
          </p>
        </div>
      </td>

      {/* Assigned */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
            {assignedTo.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-[#26344D]">{assignedTo}</span>
        </div>
      </td>

      {/* Status */}
      <td className="px-5 py-4">
        <StatusBadge value={task.status || "Pending"} type="status" />
      </td>

      {/* Priority */}
      <td className="px-5 py-4">
        <StatusBadge value={task.priority || "Medium"} type="priority" />
      </td>

      {/* Due Date */}
      <td className="px-5 py-4 text-sm text-[#64748B]">
        {formatDate(task.dueDate)}
      </td>

      {/* Actions (View Only) */}
      <td className="px-5 py-4 text-right sm:pr-6">
        <button
          type="button"
          onClick={onQuickView}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-[#26344D] shadow-2xs transition hover:bg-slate-50"
        >
          <Eye size={13} />
          View
        </button>
      </td>
    </tr>
  );
}

// ==========================================
// Status Badge
// ==========================================

function StatusBadge({ value, type }) {
  let classes = "bg-slate-100 text-slate-700 border border-slate-200";

  const norm = String(value || "").toLowerCase().trim();

  if (type === "status") {
    if (norm === "completed") {
      classes = "bg-green-50 text-green-700 border border-green-200";
    } else if (norm === "in progress") {
      classes = "bg-blue-50 text-blue-700 border border-blue-200";
    } else if (norm === "cancelled") {
      classes = "bg-red-50 text-red-700 border border-red-200";
    } else if (norm === "pending") {
      classes = "bg-amber-50 text-amber-700 border border-amber-200";
    }
  }

  if (type === "priority") {
    if (norm === "urgent") {
      classes = "bg-red-50 text-red-700 border border-red-200";
    } else if (norm === "high") {
      classes = "bg-orange-50 text-orange-700 border border-orange-200";
    } else if (norm === "medium") {
      classes = "bg-amber-50 text-amber-700 border border-amber-200";
    } else if (norm === "low") {
      classes = "bg-green-50 text-green-700 border border-green-200";
    }
  }

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${classes}`}
    >
      {value}
    </span>
  );
}

// ==========================================
// Date Formatter
// ==========================================

function formatDate(date) {
  if (!date) {
    return "—";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }

  return parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}