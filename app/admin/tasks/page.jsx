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

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.localpro1.net/api";

export default function AdminTasksPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");

  const [tasks, setTasks] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Selected task state for Quick View Modal
  const [selectedTask, setSelectedTask] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  /*
   * ============================================================
   * API HELPER (Optimized: Added caching bypass option)
   * ============================================================
   */

  const fetchJson = useCallback(async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      credentials: "include",
      cache: "no-store",
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

  /*
   * ============================================================
   * EXTRACT CURRENT USER
   * ============================================================
   */

  const extractCurrentUser = useCallback((result) => {
    if (result?.user) {
      return result.user;
    }

    if (result?.data?.user) {
      return result.data.user;
    }

    if (
      result?.data &&
      !Array.isArray(result.data) &&
      typeof result.data === "object"
    ) {
      return result.data;
    }

    return null;
  }, []);

  /*
   * ============================================================
   * EXTRACT TASKS
   * ============================================================
   */

  const extractTasks = useCallback((result) => {
    if (Array.isArray(result)) {
      return result;
    }

    if (Array.isArray(result?.tasks)) {
      return result.tasks;
    }

    if (Array.isArray(result?.data)) {
      return result.data;
    }

    if (Array.isArray(result?.data?.tasks)) {
      return result.data.tasks;
    }

    return [];
  }, []);

  /*
   * ============================================================
   * LOAD TASKS (Optimized with Parallel Requests via Promise.all)
   * ============================================================
   */

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // Optimized: Fetch me and tasks in parallel to speed up total load time
      const [meResult, tasksResult] = await Promise.all([
        fetchJson(`${API_URL}/auth/me`),
        fetchJson(`${API_URL}/tasks`),
      ]);

      const authenticatedUser =
        extractCurrentUser(meResult);

      if (!authenticatedUser) {
        router.replace("/login");
        return;
      }

      const authenticatedRole = String(
        authenticatedUser?.role || ""
      ).toLowerCase();

      if (authenticatedRole !== "admin") {
        router.replace("/login");
        return;
      }

      const loadedTasks =
        extractTasks(tasksResult);

      setCurrentUser(authenticatedUser);

      setTasks(
        Array.isArray(loadedTasks)
          ? loadedTasks
          : []
      );
    } catch (requestError) {
      console.error(
        "Admin tasks loading error:",
        requestError
      );

      const statusCode =
        requestError?.status;

      if (statusCode === 401) {
        router.replace("/login");
        return;
      }

      if (statusCode === 403) {
        setTasks([]);

        setError(
          requestError?.message ||
            "You do not have permission to access tasks."
        );

        return;
      }

      setTasks([]);

      setError(
        requestError?.message ||
          "Unable to load tasks from backend."
      );
    } finally {
      setLoading(false);
    }
  }, [fetchJson, router, extractCurrentUser, extractTasks]);

  /*
   * ============================================================
   * INITIAL LOAD
   * ============================================================
   */

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  /*
   * ============================================================
   * CLEAR FILTERS
   * ============================================================
   */

  function clearFilters() {
    setSearch("");
    setStatus("");
    setPriority("");
  }

  /*
   * ============================================================
   * QUICK STATUS UPDATE HANDLER
   * ============================================================
   */

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
          (t._id === taskId || t.id === taskId)
            ? { ...t, status: newStatus, ...(updatedTask || {}) }
            : t
        )
      );

      if (selectedTask && (selectedTask._id === taskId || selectedTask.id === taskId)) {
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

  /*
   * ============================================================
   * FILTERED TASKS (Optimized with useMemo)
   * ============================================================
   */

  const filteredTasks = useMemo(() => {
    const searchValue =
      search.toLowerCase().trim();

    return tasks.filter((task) => {
      const assignedUser =
        task?.assignedTo;

      const assignedName =
        assignedUser &&
        typeof assignedUser === "object"
          ? assignedUser?.name || ""
          : String(
              assignedUser || ""
            );

      const assignedEmail =
        assignedUser &&
        typeof assignedUser === "object"
          ? assignedUser?.email || ""
          : "";

      const title = String(
        task?.title || ""
      );

      const description = String(
        task?.description || ""
      );

      const taskStatus = String(
        task?.status || ""
      );

      const taskPriority = String(
        task?.priority || ""
      );

      const matchesSearch =
        !searchValue ||
        title
          .toLowerCase()
          .includes(searchValue) ||
        description
          .toLowerCase()
          .includes(searchValue) ||
        assignedName
          .toLowerCase()
          .includes(searchValue) ||
        assignedEmail
          .toLowerCase()
          .includes(searchValue);

      const matchesStatus =
        !status ||
        taskStatus.toLowerCase() ===
          status.toLowerCase();

      const matchesPriority =
        !priority ||
        taskPriority.toLowerCase() ===
          priority.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority
      );
    });
  }, [
    tasks,
    search,
    status,
    priority,
  ]);

  /*
   * ============================================================
   * DISPLAY HELPERS
   * ============================================================
   */

  function getAssignedUserName(task) {
    const assignedUser =
      task?.assignedTo;

    if (
      assignedUser &&
      typeof assignedUser === "object"
    ) {
      return (
        assignedUser?.name ||
        assignedUser?.email ||
        "Unassigned"
      );
    }

    if (assignedUser) {
      return String(assignedUser);
    }

    return "Unassigned";
  }

  function getAssignedUserEmail(task) {
    const assignedUser = task?.assignedTo;
    if (assignedUser && typeof assignedUser === "object") {
      return assignedUser?.email || "";
    }
    return "";
  }

  function formatTaskStatus(value) {
    if (!value) {
      return "Unknown";
    }

    const normalized = String(value)
      .trim()
      .toLowerCase();

    if (
      normalized === "in progress" ||
      normalized === "in-progress" ||
      normalized === "in_progress"
    ) {
      return "In Progress";
    }

    if (normalized === "completed") {
      return "Completed";
    }

    if (normalized === "pending") {
      return "Pending";
    }

    if (normalized === "cancelled") {
      return "Cancelled";
    }

    return String(value)
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }

  function formatPriority(value) {
    if (!value) {
      return "Unknown";
    }

    return String(value)
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString(
      undefined,
      {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }
    );
  }

  function getStatusClasses(value) {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();

    if (normalized === "completed") {
      return "bg-green-50 text-green-700 border border-green-200";
    }

    if (
      normalized === "in progress" ||
      normalized === "in-progress" ||
      normalized === "in_progress"
    ) {
      return "bg-blue-50 text-blue-700 border border-blue-200";
    }

    if (normalized === "pending") {
      return "bg-amber-50 text-amber-700 border border-amber-200";
    }

    if (normalized === "cancelled") {
      return "bg-slate-100 text-slate-600 border border-slate-200";
    }

    return "bg-slate-100 text-[#26344D] border border-slate-200";
  }

  function getPriorityClasses(value) {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();

    if (normalized === "urgent") {
      return "bg-red-50 text-red-700 border border-red-200";
    }

    if (normalized === "high") {
      return "bg-orange-50 text-orange-700 border border-orange-200";
    }

    if (normalized === "medium") {
      return "bg-amber-50 text-amber-700 border border-amber-200";
    }

    if (normalized === "low") {
      return "bg-green-50 text-green-700 border border-green-200";
    }

    return "bg-slate-100 text-[#26344D] border border-slate-200";
  }

  /*
   * ============================================================
   * RENDER (FULL WIDTH PAGE WORKSPACE)
   * ============================================================
   */

  return (
    <div className="w-full min-h-screen bg-[#F8FAFC] p-4 sm:p-6 lg:p-8">
      <div className="w-full space-y-6">

        {/* PAGE HEADER */}
        <section className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#2563EB]">
              ADMINISTRATION
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
              Tasks Overview
            </h1>

            <p className="mt-2 text-sm text-[#64748B]">
              View, filter, and monitor all organization tasks in full workspace view.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadTasks}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#26344D] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 shadow-xs"
            >
              {loading ? (
                <Loader2
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <RefreshCw size={17} />
              )}
              Refresh
            </button>

            <Link
              href="/admin/tasks/new"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#1D4ED8]"
            >
              <Plus size={18} />
              Add Task
            </Link>
          </div>
        </section>

        {/* ERROR ALERT */}
        {error && (
          <section className="w-full rounded-2xl border border-red-100 bg-red-50 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-red-700">
                  Unable to load tasks
                </h2>

                <p className="mt-1 text-sm text-red-600">
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={loadTasks}
                disabled={loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                <RefreshCw size={16} />
                Try Again
              </button>
            </div>
          </section>
        )}

        {/* FILTERS */}
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex w-full flex-col gap-3 lg:flex-row">

            <div className="relative min-w-0 flex-1">
              <Search
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search by title, description, or assigned user..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <select
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value
                )
              }
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#64748B] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">
                All Statuses
              </option>
              <option value="pending">
                Pending
              </option>
              <option value="in progress">
                In Progress
              </option>
              <option value="completed">
                Completed
              </option>
              <option value="cancelled">
                Cancelled
              </option>
            </select>

            <select
              value={priority}
              onChange={(event) =>
                setPriority(
                  event.target.value
                )
              }
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#64748B] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">
                All Priorities
              </option>
              <option value="low">
                Low
              </option>
              <option value="medium">
                Medium
              </option>
              <option value="high">
                High
              </option>
              <option value="urgent">
                Urgent
              </option>
            </select>

            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D]"
            >
              <SlidersHorizontal size={17} />
              Clear Filters
            </button>
          </div>
        </section>

        {/* TASK TABLE (100% FULL WIDTH) */}
        <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <h2 className="text-base font-bold text-[#171B3A]">
                  Workspace Tasks
                </h2>

                <p className="mt-1 text-sm text-[#64748B]">
                  {loading
                    ? "Loading tasks from backend..."
                    : `${filteredTasks.length} task${
                        filteredTasks.length !==
                        1
                          ? "s"
                          : ""
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

          {loading ? (
            <div className="flex min-h-[360px] w-full flex-col items-center justify-center px-6 text-center">
              <Loader2
                size={30}
                className="animate-spin text-[#2563EB]"
              />

              <h3 className="mt-4 text-sm font-bold text-[#171B3A]">
                Loading tasks
              </h3>

              <p className="mt-2 text-sm text-[#64748B]">
                Fetching real task records from the backend.
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
                    filteredTasks.map(
                      (task, index) => {
                        const taskId =
                          task?._id ||
                          task?.id;

                        const rowKey =
                          taskId ||
                          `task-row-${index}`;

                        return (
                          <tr
                            key={rowKey}
                            className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition"
                          >

                            <td className="px-5 py-4 sm:px-6">
                              <div>
                                <p className="text-sm font-bold text-[#171B3A]">
                                  {task?.title ||
                                    "Untitled Task"}
                                </p>

                                <p className="mt-1 max-w-md truncate text-xs text-[#64748B]">
                                  {task?.description ||
                                    "No description provided."}
                                </p>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                                  {getAssignedUserName(task).charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-[#26344D]">
                                    {getAssignedUserName(task)}
                                  </p>
                                  {getAssignedUserEmail(task) && (
                                    <p className="text-[11px] text-[#64748B]">
                                      {getAssignedUserEmail(task)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStatusClasses(
                                  task?.status
                                )}`}
                              >
                                {formatTaskStatus(
                                  task?.status
                                )}
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getPriorityClasses(
                                  task?.priority
                                )}`}
                              >
                                {formatPriority(
                                  task?.priority
                                )}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-sm text-[#64748B]">
                              {formatDate(
                                task?.dueDate
                              )}
                            </td>

                            <td className="px-5 py-4 text-right sm:pr-6">
                              <div className="flex items-center justify-end gap-2">
                                {/* Quick View Button */}
                                <button
                                  type="button"
                                  onClick={() => setSelectedTask(task)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#26344D] shadow-2xs transition hover:bg-slate-50"
                                >
                                  <Eye size={13} />
                                  View
                                </button>

                                {/* Full Details Page Link */}
                                {taskId && (
                                  <Link
                                    href={`/admin/tasks/${taskId}`}
                                    className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#2563EB] transition hover:bg-[#EEF4FF]"
                                  >
                                    Edit
                                  </Link>
                                )}
                              </div>
                            </td>

                          </tr>
                        );
                      }
                    )
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <div className="flex min-h-[330px] w-full flex-col items-center justify-center px-6 text-center">

                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                            <ClipboardList
                              size={25}
                            />
                          </div>

                          <h3 className="mt-4 text-sm font-bold text-[#171B3A]">
                            {tasks.length === 0
                              ? "No tasks available"
                              : "No matching tasks"}
                          </h3>

                          <p className="mt-2 max-w-sm text-sm leading-6 text-[#64748B]">
                            {tasks.length === 0
                              ? "There are currently no task records available from the backend."
                              : "Try changing your search or filters."}
                          </p>

                          {tasks.length === 0 && (
                            <Link
                              href="/admin/tasks/new"
                              className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-bold text-white transition hover:bg-[#1D4ED8]"
                            >
                              <Plus size={16} />
                              Add First Task
                            </Link>
                          )}

                          {(search ||
                            status ||
                            priority) && (
                            <button
                              type="button"
                              onClick={
                                clearFilters
                              }
                              className="mt-4 text-sm font-bold text-[#2563EB] hover:underline"
                            >
                              Clear filters
                            </button>
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

        {/* RESULTS FOOTER */}
        <section className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <p className="text-xs text-slate-400">
            {loading
              ? "Loading task records..."
              : `${filteredTasks.length} of ${tasks.length} task${
                  tasks.length !== 1
                    ? "s"
                    : ""
                } displayed`}
          </p>

          <button
            type="button"
            onClick={loadTasks}
            disabled={loading}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#26344D] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh Tasks
          </button>

        </section>

      </div>

      {/* ======================================================
          TASK QUICK VIEW MODAL
      ====================================================== */}

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 py-4">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  {selectedTask._id || selectedTask.id}
                </span>
                <h3 className="mt-0.5 text-lg font-bold text-[#171B3A]">
                  {selectedTask.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Description
                </h4>
                <div className="mt-2 rounded-xl bg-slate-50 p-4 border border-slate-100 text-sm text-[#26344D] leading-relaxed">
                  {selectedTask.description || "No description provided for this task."}
                </div>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-slate-100 p-4 bg-white">
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Assigned User</span>
                  <div className="flex items-center gap-2">
                    <User size={15} className="text-[#2563EB]" />
                    <span className="text-sm font-semibold text-[#171B3A]">
                      {getAssignedUserName(selectedTask)}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block mb-1">Due Date</span>
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-amber-500" />
                    <span className="text-sm font-semibold text-[#171B3A]">
                      {formatDate(selectedTask.dueDate)}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block mb-1">Priority</span>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${getPriorityClasses(selectedTask.priority)}`}>
                    {formatPriority(selectedTask.priority)}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block mb-1">Category</span>
                  <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {selectedTask.category || "General"}
                  </span>
                </div>
              </div>

              {/* Status Update Actions */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Update Task Status
                </h4>
                <div className="flex flex-wrap gap-2">
                  {["Pending", "In Progress", "Completed", "Cancelled"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={isUpdatingStatus || selectedTask.status === st}
                      onClick={() => handleQuickStatusUpdate(selectedTask._id || selectedTask.id, st)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                        selectedTask.status === st
                          ? "bg-[#2563EB] text-white border-[#2563EB]"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      } disabled:opacity-50`}
                    >
                      {selectedTask.status === st && <CheckCircle2 size={13} />}
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comments Preview */}
              {Array.isArray(selectedTask.comments) && selectedTask.comments.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Comments ({selectedTask.comments.length})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedTask.comments.map((c, i) => (
                      <div key={c._id || i} className="rounded-lg bg-slate-50 p-3 text-xs border border-slate-100">
                        <div className="flex justify-between text-slate-500 font-semibold mb-1">
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
                className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 px-6 text-xs font-bold text-slate-700 transition"
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