"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
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

const getStoredToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const tokenKeys = [
    "token",
    "accessToken",
    "access_token",
    "authToken",
    "auth_token",
    "jwt",
  ];

  for (const key of tokenKeys) {
    const localValue = window.localStorage.getItem(key);

    if (localValue) {
      return localValue;
    }

    const sessionValue = window.sessionStorage.getItem(key);

    if (sessionValue) {
      return sessionValue;
    }
  }

  return null;
};

const normalizeApiUrl = (url) => {
  return String(url || "").replace(/\/+$/, "");
};

const BASE_API_URL = normalizeApiUrl(API_URL);

export default function AdminTasksPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [tasks, setTasks] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  /*
   * ============================================================
   * AUTHENTICATED API REQUEST
   * ============================================================
   */

  const fetchJson = useCallback(async (url, options = {}) => {
    const token = getStoredToken();

    const headers = {
      Accept: "application/json",
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers || {}),
    };

    /*
     * Support both:
     *
     * 1. HttpOnly / cookie authentication
     * 2. Bearer token authentication
     */

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
      const requestError = new Error(
        result?.message ||
          result?.error ||
          `Request failed with status ${response.status}.`
      );

      requestError.status = response.status;
      requestError.response = result;

      throw requestError;
    }

    return result;
  }, []);

  /*
   * ============================================================
   * CURRENT USER EXTRACTION
   * ============================================================
   */

  const extractCurrentUser = useCallback((result) => {
    if (!result) {
      return null;
    }

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
   * TASK EXTRACTION
   * ============================================================
   */

  const extractTasks = useCallback((result) => {
    if (!result) {
      return [];
    }

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

    if (Array.isArray(result?.data?.items)) {
      return result.data.items;
    }

    if (Array.isArray(result?.items)) {
      return result.items;
    }

    return [];
  }, []);

  /*
   * ============================================================
   * LOGOUT / AUTH FAILURE
   * ============================================================
   */

  const handleAuthFailure = useCallback(() => {
    if (typeof window !== "undefined") {
      const tokenKeys = [
        "token",
        "accessToken",
        "access_token",
        "authToken",
        "auth_token",
        "jwt",
      ];

      tokenKeys.forEach((key) => {
        window.localStorage.removeItem(key);
        window.sessionStorage.removeItem(key);
      });
    }

    router.replace("/login");
  }, [router]);

  /*
   * ============================================================
   * LOAD TASKS
   * ============================================================
   */

  const loadTasks = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setLoading(true);
      }

      setError("");

      try {
        /*
         * STEP 1:
         * Verify current session/token.
         */

        const meResult = await fetchJson(
          `${BASE_API_URL}/auth/me`
        );

        const authenticatedUser =
          extractCurrentUser(meResult);

        if (!authenticatedUser) {
          handleAuthFailure();
          return;
        }

        const authenticatedRole = String(
          authenticatedUser?.role || ""
        )
          .trim()
          .toLowerCase();

        /*
         * Admin only.
         */

        if (authenticatedRole !== "admin") {
          setError(
            "You do not have permission to access the admin tasks page."
          );
          return;
        }

        setCurrentUser(authenticatedUser);

        /*
         * STEP 2:
         * Load tasks after authentication succeeds.
         */

        const tasksResult = await fetchJson(
          `${BASE_API_URL}/tasks`
        );

        const loadedTasks = extractTasks(tasksResult);

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
          handleAuthFailure();
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
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [
      fetchJson,
      extractCurrentUser,
      extractTasks,
      handleAuthFailure,
    ]
  );

  /*
   * ============================================================
   * INITIAL LOAD
   * ============================================================
   */

  useEffect(() => {
    let mounted = true;

    const runInitialLoad = async () => {
      if (!mounted) {
        return;
      }

      await loadTasks(true);
    };

    runInitialLoad();

    return () => {
      mounted = false;
    };
  }, [loadTasks]);

  /*
   * ============================================================
   * CLEAR FILTERS
   * ============================================================
   */

  const clearFilters = useCallback(() => {
    setSearch("");
    setStatus("");
    setPriority("");
  }, []);

  /*
   * ============================================================
   * QUICK STATUS UPDATE
   * ============================================================
   */

  const handleQuickStatusUpdate = useCallback(
    async (taskId, newStatus) => {
      if (!taskId || !newStatus) {
        return;
      }

      setIsUpdatingStatus(true);

      try {
        const result = await fetchJson(
          `${BASE_API_URL}/tasks/${taskId}/status`,
          {
            method: "PATCH",
            body: JSON.stringify({
              status: newStatus,
            }),
          }
        );

        const updatedTask =
          result?.task ||
          result?.data?.task ||
          result?.data;

        setTasks((previousTasks) =>
          previousTasks.map((task) => {
            const currentId =
              task?._id || task?.id;

            if (
              String(currentId) !== String(taskId)
            ) {
              return task;
            }

            return {
              ...task,
              status: newStatus,
              ...(updatedTask &&
              typeof updatedTask === "object"
                ? updatedTask
                : {}),
            };
          })
        );

        setSelectedTask((previousTask) => {
          if (!previousTask) {
            return previousTask;
          }

          const previousId =
            previousTask?._id ||
            previousTask?.id;

          if (
            String(previousId) !== String(taskId)
          ) {
            return previousTask;
          }

          return {
            ...previousTask,
            status: newStatus,
            ...(updatedTask &&
            typeof updatedTask === "object"
              ? updatedTask
              : {}),
          };
        });
      } catch (requestError) {
        console.error(
          "Failed to update task status:",
          requestError
        );

        if (requestError?.status === 401) {
          handleAuthFailure();
          return;
        }

        alert(
          requestError?.message ||
            "Could not update task status."
        );
      } finally {
        setIsUpdatingStatus(false);
      }
    },
    [fetchJson, handleAuthFailure]
  );

  /*
   * ============================================================
   * FILTERED TASKS
   * ============================================================
   */

  const filteredTasks = useMemo(() => {
    const searchValue = search
      .toLowerCase()
      .trim();

    const normalizedStatus = status
      .toLowerCase()
      .trim();

    const normalizedPriority = priority
      .toLowerCase()
      .trim();

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
      )
        .trim()
        .toLowerCase();

      const taskPriority = String(
        task?.priority || ""
      )
        .trim()
        .toLowerCase();

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
        !normalizedStatus ||
        taskStatus === normalizedStatus;

      const matchesPriority =
        !normalizedPriority ||
        taskPriority === normalizedPriority;

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

  const getAssignedUserName = useCallback(
    (task) => {
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
    },
    []
  );

  const getAssignedUserEmail = useCallback(
    (task) => {
      const assignedUser =
        task?.assignedTo;

      if (
        assignedUser &&
        typeof assignedUser === "object"
      ) {
        return assignedUser?.email || "";
      }

      return "";
    },
    []
  );

  const formatTaskStatus = useCallback(
    (value) => {
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
    },
    []
  );

  const formatPriority = useCallback(
    (value) => {
      if (!value) {
        return "Unknown";
      }

      return String(value)
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (letter) =>
          letter.toUpperCase()
        );
    },
    []
  );

  const formatDate = useCallback(
    (value) => {
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
    },
    []
  );

  const getStatusClasses = useCallback(
    (value) => {
      const normalized = String(
        value || ""
      )
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
    },
    []
  );

  const getPriorityClasses = useCallback(
    (value) => {
      const normalized = String(
        value || ""
      )
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
    },
    []
  );

  /*
   * ============================================================
   * RENDER
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
              onClick={() => loadTasks(true)}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#26344D] shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                onClick={() => loadTasks(true)}
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
                  setSearch(event.target.value)
                }
                placeholder="Search by title, description, or assigned user..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
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
                setPriority(event.target.value)
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

        {/* TASK TABLE */}

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
                        filteredTasks.length !== 1
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
                Verifying your session and fetching real task records.
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

                        const assignedName =
                          getAssignedUserName(task);

                        const assignedEmail =
                          getAssignedUserEmail(task);

                        return (
                          <tr
                            key={rowKey}
                            className="border-b border-slate-100 transition last:border-b-0 hover:bg-slate-50/60"
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

                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                                  {assignedName
                                    .charAt(0)
                                    .toUpperCase()}
                                </div>

                                <div>
                                  <p className="text-sm font-semibold text-[#26344D]">
                                    {assignedName}
                                  </p>

                                  {assignedEmail && (
                                    <p className="text-[11px] text-[#64748B]">
                                      {assignedEmail}
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

                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedTask(task)
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#26344D] shadow-sm transition hover:bg-slate-50"
                                >
                                  <Eye size={13} />
                                  View
                                </button>

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
                            <ClipboardList size={25} />
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
                              onClick={clearFilters}
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
            onClick={() => loadTasks(true)}
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedTask(null);
            }
          }}
        >
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl">

            {/* MODAL HEADER */}

            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 py-4">

              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  {selectedTask._id ||
                    selectedTask.id}
                </span>

                <h3 className="mt-0.5 text-lg font-bold text-[#171B3A]">
                  {selectedTask.title ||
                    "Untitled Task"}
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedTask(null)
                }
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>

            </div>

            {/* MODAL BODY */}

            <div className="space-y-6 p-6">

              {/* DESCRIPTION */}

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Description
                </h4>

                <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm leading-relaxed text-[#26344D]">
                  {selectedTask.description ||
                    "No description provided for this task."}
                </div>
              </div>

              {/* META */}

              <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-white p-4 sm:grid-cols-2">

                <div>
                  <span className="mb-1 block text-xs text-slate-400">
                    Assigned User
                  </span>

                  <div className="flex items-center gap-2">
                    <User
                      size={15}
                      className="text-[#2563EB]"
                    />

                    <span className="text-sm font-semibold text-[#171B3A]">
                      {getAssignedUserName(
                        selectedTask
                      )}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="mb-1 block text-xs text-slate-400">
                    Due Date
                  </span>

                  <div className="flex items-center gap-2">
                    <Clock
                      size={15}
                      className="text-amber-500"
                    />

                    <span className="text-sm font-semibold text-[#171B3A]">
                      {formatDate(
                        selectedTask.dueDate
                      )}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="mb-1 block text-xs text-slate-400">
                    Priority
                  </span>

                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${getPriorityClasses(
                      selectedTask.priority
                    )}`}
                  >
                    {formatPriority(
                      selectedTask.priority
                    )}
                  </span>
                </div>

                <div>
                  <span className="mb-1 block text-xs text-slate-400">
                    Category
                  </span>

                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {selectedTask.category ||
                      "General"}
                  </span>
                </div>

              </div>

              {/* STATUS */}

              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Update Task Status
                </h4>

                <div className="flex flex-wrap gap-2">
                  {[
                    "Pending",
                    "In Progress",
                    "Completed",
                    "Cancelled",
                  ].map((taskStatus) => {
                    const currentStatus =
                      String(
                        selectedTask.status ||
                          ""
                      )
                        .trim()
                        .toLowerCase();

                    const buttonStatus =
                      taskStatus
                        .trim()
                        .toLowerCase();

                    const isCurrent =
                      currentStatus ===
                      buttonStatus;

                    return (
                      <button
                        key={taskStatus}
                        type="button"
                        disabled={
                          isUpdatingStatus ||
                          isCurrent
                        }
                        onClick={() =>
                          handleQuickStatusUpdate(
                            selectedTask._id ||
                              selectedTask.id,
                            taskStatus
                          )
                        }
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                          isCurrent
                            ? "border-[#2563EB] bg-[#2563EB] text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {isCurrent && (
                          <CheckCircle2
                            size={13}
                          />
                        )}

                        {taskStatus}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* COMMENTS */}

              {Array.isArray(
                selectedTask.comments
              ) &&
                selectedTask.comments.length >
                  0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                      Comments (
                      {
                        selectedTask.comments
                          .length
                      }
                      )
                    </h4>

                    <div className="max-h-40 space-y-2 overflow-y-auto">
                      {selectedTask.comments.map(
                        (comment, index) => (
                          <div
                            key={
                              comment?._id ||
                              index
                            }
                            className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs"
                          >
                            <div className="mb-1 flex justify-between gap-3 font-semibold text-slate-500">
                              <span>
                                {comment?.user
                                  ?.name ||
                                  "User"}
                              </span>

                              <span>
                                {formatDate(
                                  comment?.createdAt
                                )}
                              </span>
                            </div>

                            <p className="text-slate-800">
                              {comment?.text ||
                                ""}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
            </div>

            {/* MODAL FOOTER */}

            <div className="sticky bottom-0 flex items-center justify-end border-t border-slate-100 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() =>
                  setSelectedTask(null)
                }
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