"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Clock3,
  ClipboardList,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  User,
  X,
  Zap,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.localpro1.net/api";

const CACHE_TIME = 30 * 1000;

const normalizeApiUrl = (url) => String(url || "").replace(/\/+$/, "");
const BASE_API_URL = normalizeApiUrl(API_URL);

function getStoredToken() {
  if (typeof window === "undefined") return null;

  const tokenKeys = [
    "token",
    "accessToken",
    "access_token",
    "authToken",
    "auth_token",
    "jwt",
  ];

  for (const key of tokenKeys) {
    const localVal = window.localStorage.getItem(key);
    if (localVal) return localVal;

    const sessionVal = window.sessionStorage.getItem(key);
    if (sessionVal) return sessionVal;
  }

  return null;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTaskStatus(value) {
  if (!value) return "Pending";
  const normalized = String(value).trim().toLowerCase();
  if (["in progress", "in-progress", "in_progress"].includes(normalized)) {
    return "In Progress";
  }
  if (normalized === "completed") return "Completed";
  if (normalized === "pending") return "Pending";
  if (normalized === "cancelled") return "Cancelled";

  return String(value)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPriority(value) {
  if (!value) return "Medium";
  return String(value)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusBadgeStyle(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "completed") {
    return "bg-emerald-50 text-emerald-600 border border-emerald-100";
  }
  if (["in progress", "in-progress", "in_progress"].includes(normalized)) {
    return "bg-violet-50 text-violet-600 border border-violet-100";
  }
  if (normalized === "pending") {
    return "bg-amber-50 text-amber-600 border border-amber-100";
  }
  if (normalized === "cancelled") {
    return "bg-rose-50 text-rose-600 border border-rose-100";
  }
  return "bg-slate-100 text-slate-600 border border-slate-200";
}

function getPriorityBadgeStyle(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "urgent") {
    return "bg-rose-50 text-rose-600 border border-rose-100";
  }
  if (normalized === "high") {
    return "bg-orange-50 text-orange-600 border border-orange-100";
  }
  if (normalized === "medium") {
    return "bg-amber-50 text-amber-600 border border-amber-100";
  }
  if (normalized === "low") {
    return "bg-emerald-50 text-emerald-600 border border-emerald-100";
  }
  return "bg-slate-100 text-slate-600 border border-slate-200";
}

function StatCard({ title, value, subtitle, icon: Icon, gradient }) {
  return (
    <div className="group relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(45,35,100,0.06)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(45,35,100,0.10)]">
      <div
        className={`absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${gradient} opacity-[0.08] transition duration-300 group-hover:scale-125`}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[13px] font-semibold text-slate-500">{title}</p>
          <h3 className="mt-2 text-[28px] font-bold tracking-tight text-slate-900">
            {value}
          </h3>
          <p className="mt-2 text-[11px] font-medium text-slate-400">
            {subtitle}
          </p>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg`}
        >
          <Icon size={21} strokeWidth={2.2} />
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex justify-between">
        <div>
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="mt-3 h-8 w-20 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-28 rounded bg-slate-100" />
        </div>
        <div className="h-12 w-12 rounded-2xl bg-slate-200" />
      </div>
    </div>
  );
}

export default function AdminTasksPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false); // Instant render enabled
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const cacheRef = useRef({ timestamp: 0, data: null });
  const loadingRef = useRef(false);

  const fetchJson = useCallback(async (url, options = {}) => {
    const token = getStoredToken();
    const headers = {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    };

    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      credentials: "include",
      cache: "no-store",
      headers,
    });

    let result = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok || result?.success === false) {
      const reqErr = new Error(
        result?.message ||
          result?.error ||
          `Request failed with status ${response.status}.`
      );
      reqErr.status = response.status;
      reqErr.response = result;
      throw reqErr;
    }

    return result;
  }, []);

  const extractCurrentUser = useCallback((result) => {
    if (!result) return null;
    if (result?.user) return result.user;
    if (result?.data?.user) return result.data.user;
    if (result?.data && !Array.isArray(result.data) && typeof result.data === "object") {
      return result.data;
    }
    return null;
  }, []);

  const extractTasks = useCallback((result) => {
    if (!result) return [];
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.tasks)) return result.tasks;
    if (Array.isArray(result?.data)) return result.data;
    if (Array.isArray(result?.data?.tasks)) return result.data.tasks;
    if (Array.isArray(result?.data?.items)) return result.data.items;
    if (Array.isArray(result?.items)) return result.items;
    return [];
  }, []);

  const handleAuthFailure = useCallback(() => {
    if (typeof window !== "undefined") {
      [
        "token",
        "accessToken",
        "access_token",
        "authToken",
        "auth_token",
        "jwt",
      ].forEach((key) => {
        window.localStorage.removeItem(key);
        window.sessionStorage.removeItem(key);
      });
    }
    router.replace("/login");
  }, [router]);

  const loadTasks = useCallback(
    async (force = false) => {
      if (loadingRef.current) return;

      const now = Date.now();
      if (!force && cacheRef.current.data && now - cacheRef.current.timestamp < CACHE_TIME) {
        setTasks(cacheRef.current.data);
        return;
      }

      loadingRef.current = true;
      if (force) {
        setRefreshing(true);
      }
      setError("");

      try {
        const tasksResult = await fetchJson(`${BASE_API_URL}/tasks`);
        const loadedTasks = extractTasks(tasksResult);

        const nextTasks = Array.isArray(loadedTasks) ? loadedTasks : [];
        setTasks(nextTasks);
        cacheRef.current = {
          timestamp: Date.now(),
          data: nextTasks,
        };
      } catch (requestError) {
        console.error("Admin tasks loading error:", requestError);
        const statusCode = requestError?.status;

        if (statusCode === 401) {
          handleAuthFailure();
          return;
        }

        if (statusCode === 403) {
          setTasks([]);
          setError(
            requestError?.message || "You do not have permission to access tasks."
          );
          return;
        }

        setTasks([]);
        setError(requestError?.message || "Unable to load tasks from backend.");
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchJson, extractTasks, handleAuthFailure]
  );

  useEffect(() => {
    loadTasks(false);
  }, [loadTasks]);

  const clearFilters = useCallback(() => {
    setSearch("");
    setStatus("");
    setPriority("");
  }, []);

  const handleQuickStatusUpdate = useCallback(
    async (taskId, newStatus) => {
      if (!taskId || !newStatus) return;

      setIsUpdatingStatus(true);

      try {
        const result = await fetchJson(
          `${BASE_API_URL}/tasks/${taskId}/status`,
          {
            method: "PATCH",
            body: JSON.stringify({ status: newStatus }),
          }
        );

        const updatedTask =
          result?.task || result?.data?.task || result?.data;

        const updateTaskItem = (task) => {
          const currentId = task?._id || task?.id;
          if (String(currentId) !== String(taskId)) return task;
          return {
            ...task,
            status: newStatus,
            ...(updatedTask && typeof updatedTask === "object" ? updatedTask : {}),
          };
        };

        setTasks((prev) => {
          const updated = prev.map(updateTaskItem);
          cacheRef.current.data = updated;
          return updated;
        });

        setSelectedTask((prev) => {
          if (!prev) return prev;
          const prevId = prev?._id || prev?.id;
          if (String(prevId) !== String(taskId)) return prev;
          return {
            ...prev,
            status: newStatus,
            ...(updatedTask && typeof updatedTask === "object" ? updatedTask : {}),
          };
        });
      } catch (requestError) {
        console.error("Failed to update task status:", requestError);
        if (requestError?.status === 401) {
          handleAuthFailure();
          return;
        }
        alert(requestError?.message || "Could not update task status.");
      } finally {
        setIsUpdatingStatus(false);
      }
    },
    [fetchJson, handleAuthFailure]
  );

  const filteredTasks = useMemo(() => {
    const searchValue = search.toLowerCase().trim();
    const normalizedStatus = status.toLowerCase().trim();
    const normalizedPriority = priority.toLowerCase().trim();

    return tasks.filter((task) => {
      const assignedUser = task?.assignedTo;
      const assignedName =
        assignedUser && typeof assignedUser === "object"
          ? assignedUser?.name || ""
          : String(assignedUser || "");
      const assignedEmail =
        assignedUser && typeof assignedUser === "object"
          ? assignedUser?.email || ""
          : "";

      const title = String(task?.title || "");
      const description = String(task?.description || "");
      const taskStatus = String(task?.status || "").trim().toLowerCase();
      const taskPriority = String(task?.priority || "").trim().toLowerCase();

      const matchesSearch =
        !searchValue ||
        title.toLowerCase().includes(searchValue) ||
        description.toLowerCase().includes(searchValue) ||
        assignedName.toLowerCase().includes(searchValue) ||
        assignedEmail.toLowerCase().includes(searchValue);

      const matchesStatus =
        !normalizedStatus || taskStatus === normalizedStatus;
      const matchesPriority =
        !normalizedPriority || taskPriority === normalizedPriority;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, search, status, priority]);

  const taskStats = useMemo(() => {
    const total = tasks.length;
    let completed = 0;
    let inProgress = 0;
    let pending = 0;

    tasks.forEach((task) => {
      const normalized = String(task?.status || "").trim().toLowerCase();
      if (normalized === "completed") {
        completed += 1;
      } else if (
        ["in progress", "in-progress", "in_progress"].includes(normalized)
      ) {
        inProgress += 1;
      } else {
        pending += 1;
      }
    });

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, pending, completionRate };
  }, [tasks]);

  const getAssignedUserName = useCallback((task) => {
    const assignedUser = task?.assignedTo;
    if (assignedUser && typeof assignedUser === "object") {
      return assignedUser?.name || assignedUser?.email || "Unassigned";
    }
    if (assignedUser) return String(assignedUser);
    return "Unassigned";
  }, []);

  const getAssignedUserEmail = useCallback((task) => {
    const assignedUser = task?.assignedTo;
    if (assignedUser && typeof assignedUser === "object") {
      return assignedUser?.email || "";
    }
    return "";
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-900 animate-fadeIn">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-[1600px] space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        {/* =========================================================
            HEADER
        ========================================================= */}
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-violet-50/80 px-3 py-1 text-xs font-bold text-violet-700">
              <ShieldCheck size={14} />
              ADMINISTRATION
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Tasks Overview
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Track assignments, supervise task status changes, and configure organization workflows.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => loadTasks(true)}
              disabled={refreshing}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/50 hover:text-violet-700 disabled:opacity-60"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin text-violet-600" : ""} />
              Refresh
            </button>

            <Link
              href="/admin/tasks/new"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition duration-150 hover:-translate-y-0.5 hover:bg-violet-700 active:translate-y-0"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>Add Task</span>
            </Link>
          </div>
        </section>

        {/* ERROR ALERT */}
        {error && (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-100 bg-amber-50/90 p-4 text-amber-800 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle size={19} className="shrink-0 text-amber-600" />
              <p className="text-sm font-medium">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => loadTasks(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        {/* =========================================================
            STATS SECTION
        ========================================================= */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Tasks"
            value={taskStats.total}
            subtitle="All assigned tasks"
            icon={ClipboardList}
            gradient="from-violet-600 to-purple-500"
          />
          <StatCard
            title="Completed"
            value={taskStats.completed}
            subtitle={`${taskStats.completionRate}% completion rate`}
            icon={CheckCircle2}
            gradient="from-emerald-500 to-teal-400"
          />
          <StatCard
            title="In Progress"
            value={taskStats.inProgress}
            subtitle="Actively worked on"
            icon={Zap}
            gradient="from-orange-500 to-amber-400"
          />
          <StatCard
            title="Pending / Queued"
            value={taskStats.pending}
            subtitle="Awaiting action"
            icon={Clock3}
            gradient="from-pink-500 to-fuchsia-500"
          />
        </section>

        {/* =========================================================
            FILTERS SECTION
        ========================================================= */}
        <section className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(45,35,100,0.05)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, description, or assigned user..."
                className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 pl-11 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-11 rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 text-sm font-medium text-slate-600 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="h-11 rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 text-sm font-medium text-slate-600 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
              >
                <option value="">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>

              {(search || status || priority) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-11 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-500 transition hover:border-violet-200 hover:bg-violet-50/50 hover:text-violet-600"
                >
                  <SlidersHorizontal size={14} />
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </section>

        {/* =========================================================
            TASK TABLE
        ========================================================= */}
        <section className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Task Records</h2>
                <p className="text-xs text-slate-500">
                  {loading && tasks.length === 0
                    ? "Loading tasks..."
                    : `${filteredTasks.length} of ${tasks.length} total tasks shown`}
                </p>
              </div>

              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-600">
                {filteredTasks.length} Listed
              </span>
            </div>
          </div>

          {loading && tasks.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center p-8">
              <Loader2 size={32} className="animate-spin text-violet-600" />
              <p className="mt-3 text-sm font-semibold text-slate-600">Loading task data...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-6 py-4">Task Details</th>
                    <th className="px-6 py-4">Assigned To</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Priority</th>
                    <th className="px-6 py-4">Due Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80 text-sm">
                  {filteredTasks.length > 0 ? (
                    filteredTasks.map((task, index) => {
                      const taskId = task?._id || task?.id;
                      const rowKey = taskId || `task-row-${index}`;
                      const assignedName = getAssignedUserName(task);
                      const assignedEmail = getAssignedUserEmail(task);

                      return (
                        <tr
                          key={rowKey}
                          className="transition hover:bg-violet-50/30"
                        >
                          <td className="px-6 py-4">
                            <div className="min-w-0 max-w-sm">
                              <p className="truncate font-bold text-slate-900">
                                {task?.title || "Untitled Task"}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-slate-400">
                                {task?.description || "No description provided."}
                              </p>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                                {assignedName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-bold text-slate-800">
                                  {assignedName}
                                </p>
                                {assignedEmail ? (
                                  <p className="truncate text-[11px] text-slate-400">
                                    {assignedEmail}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${getStatusBadgeStyle(
                                task?.status
                              )}`}
                            >
                              {formatTaskStatus(task?.status)}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${getPriorityBadgeStyle(
                                task?.priority
                              )}`}
                            >
                              {formatPriority(task?.priority)}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-slate-500">
                            {formatDate(task?.dueDate)}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedTask(task)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                            >
                              <Eye size={13} />
                              Quick View
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">
                          <ClipboardList size={22} />
                        </div>
                        <h3 className="mt-3 text-sm font-bold text-slate-800">
                          {tasks.length === 0 ? "No tasks found" : "No matching tasks"}
                        </h3>
                        <p className="mt-1 text-xs text-slate-400">
                          {tasks.length === 0
                            ? "No tasks are currently available in the organization."
                            : "Try adjusting your search criteria or filter options."}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* =========================================================
          TASK QUICK VIEW MODAL
      ========================================================= */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedTask(null);
            }
          }}
        >
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-slate-200/80 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-gradient-to-r from-violet-50/50 via-purple-50/30 to-white px-6 py-5">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {selectedTask._id || selectedTask.id}
                </span>
                <h3 className="mt-0.5 text-lg font-bold text-slate-900">
                  {selectedTask.title || "Untitled Task"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-violet-600">
                  Task Description
                </h4>
                <div className="mt-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-sm leading-relaxed text-slate-700">
                  {selectedTask.description || "No description provided for this task."}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-100 bg-slate-50/40 p-4 sm:grid-cols-4">
                <div>
                  <span className="block text-xs font-semibold text-slate-400">Assigned To</span>
                  <p className="mt-1 truncate text-xs font-bold text-slate-800">
                    {getAssignedUserName(selectedTask)}
                  </p>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-400">Due Date</span>
                  <p className="mt-1 text-xs font-bold text-slate-800">
                    {formatDate(selectedTask.dueDate)}
                  </p>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-400">Priority</span>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${getPriorityBadgeStyle(
                      selectedTask.priority
                    )}`}
                  >
                    {formatPriority(selectedTask.priority)}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-400">Category</span>
                  <p className="mt-1 truncate text-xs font-bold text-slate-800">
                    {selectedTask.category || "General"}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                  Update Task Status
                </h4>
                <div className="flex flex-wrap gap-2">
                  {["Pending", "In Progress", "Completed", "Cancelled"].map((chipStatus) => {
                    const currentStatus = String(selectedTask.status || "")
                      .trim()
                      .toLowerCase();
                    const buttonStatus = chipStatus.trim().toLowerCase();
                    const isCurrent = currentStatus === buttonStatus;

                    return (
                      <button
                        key={chipStatus}
                        type="button"
                        disabled={isUpdatingStatus || isCurrent}
                        onClick={() =>
                          handleQuickStatusUpdate(
                            selectedTask._id || selectedTask.id,
                            chipStatus
                          )
                        }
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                          isCurrent
                            ? "border-violet-600 bg-violet-600 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-violet-200 hover:bg-violet-50/50"
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {isCurrent ? <CheckCircle2 size={13} /> : null}
                        {chipStatus}
                      </button>
                    );
                  })}
                </div>
              </div>

              {Array.isArray(selectedTask.comments) && selectedTask.comments.length > 0 ? (
                <div>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                    Task Comments ({selectedTask.comments.length})
                  </h4>
                  <div className="max-h-40 space-y-2 overflow-y-auto">
                    {selectedTask.comments.map((comment, index) => (
                      <div
                        key={comment?._id || index}
                        className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs"
                      >
                        <div className="mb-1 flex justify-between gap-3 font-semibold text-slate-400">
                          <span>{comment?.user?.name || "User"}</span>
                          <span>{formatDate(comment?.createdAt)}</span>
                        </div>
                        <p className="text-slate-700">{comment?.text || ""}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="sticky bottom-0 flex items-center justify-end border-t border-slate-100 bg-slate-50/50 px-6 py-4">
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="h-10 rounded-xl bg-slate-200/80 px-6 text-xs font-bold text-slate-700 transition hover:bg-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}