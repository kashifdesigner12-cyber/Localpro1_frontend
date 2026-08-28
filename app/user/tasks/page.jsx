"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock,
  ClipboardList,
  Clock3,
  Eye,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  User,
  X,
} from "lucide-react";

import { authService } from "@/services/authService";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api";

const navigation = [
  {
    label: "Dashboard",
    href: "/user",
    icon: LayoutDashboard,
  },
  {
    label: "Tasks",
    href: "/user/tasks",
    icon: ClipboardList,
  },
  {
    label: "Calendar",
    href: "/user/calendar",
    icon: CalendarDays,
  },
  {
    label: "Activity",
    href: "/user/activity",
    icon: Activity,
  },
  {
    label: "Settings",
    href: "/user/settings",
    icon: Settings,
  },
];

/* =========================================================
   USER TASKS PAGE
========================================================= */

export default function UserTasksPage() {
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [tasks, setTasks] = useState([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");

  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const [error, setError] = useState("");
  const [updateError, setUpdateError] = useState("");

  const [currentUser, setCurrentUser] = useState(null);

  // Quick View Modal States
  const [selectedTask, setSelectedTask] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  /* =======================================================
     LOAD USER + TASKS
  ======================================================= */

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      /* -----------------------------------------------
          Verify logged-in user
      ------------------------------------------------ */

      const me = await authService.me();

      if (!me) {
        router.replace("/login");
        return;
      }

      const user =
        me?.user ||
        me?.data?.user ||
        me?.data ||
        me;

      const role = String(
        user?.role ||
          me?.role ||
          me?.data?.role ||
          ""
      )
        .trim()
        .toLowerCase();

      setCurrentUser(user);

      /* -----------------------------------------------
          Role protection
      ------------------------------------------------ */

      if (role !== "user" && role !== "admin" && role !== "manager") {
        router.replace("/login");
        return;
      }

      /* -----------------------------------------------
          GET MY TASKS: GET /api/tasks/my
      ------------------------------------------------ */

      const response = await apiRequest(
        "/tasks/my",
        {
          method: "GET",
        }
      );

      const normalized =
        normalizeTasks(response);

      setTasks(normalized);
    } catch (err) {
      console.error(
        "User tasks load error:",
        err
      );

      if (err?.status === 401) {
        router.replace("/login");
        return;
      }

      setError(
        err?.message ||
          "Unable to load your tasks."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  /* =======================================================
     LOGOUT HANDLER
  ======================================================= */

  async function handleSignOut() {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      if (typeof authService.logout === "function") {
        await authService.logout();
      }
    } catch (logoutError) {
      console.error(
        "Logout error:",
        logoutError
      );
    } finally {
      setSidebarOpen(false);
      setLoggingOut(false);
      router.replace("/login");
    }
  }

  /* =======================================================
     CLEAR FILTERS
  ======================================================= */

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setPriority("all");
  }

  /* =======================================================
     FILTERED TASKS
  ======================================================= */

  const filteredTasks = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return tasks.filter((task) => {
      const taskTitle =
        getTaskTitle(task).toLowerCase();

      const description =
        getTaskDescription(task).toLowerCase();

      const taskStatus =
        normalizeStatus(
          getTaskStatus(task)
        );

      const taskPriority =
        normalizePriority(
          getTaskPriority(task)
        );

      const matchesSearch =
        !query ||
        taskTitle.includes(query) ||
        description.includes(query);

      const matchesStatus =
        status === "all" ||
        taskStatus ===
          normalizeStatus(status);

      const matchesPriority =
        priority === "all" ||
        taskPriority ===
          normalizePriority(priority);

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

  /* =======================================================
     SUMMARY COUNTS
  ======================================================= */

  const summary = useMemo(() => {
    const total = tasks.length;

    const pending = tasks.filter(
      (task) =>
        normalizeStatus(
          getTaskStatus(task)
        ) === "pending"
    ).length;

    const inProgress = tasks.filter(
      (task) =>
        normalizeStatus(
          getTaskStatus(task)
        ) === "in progress"
    ).length;

    const completed = tasks.filter(
      (task) =>
        normalizeStatus(
          getTaskStatus(task)
        ) === "completed"
    ).length;

    return {
      total,
      pending,
      inProgress,
      completed,
    };
  }, [tasks]);

  /* =======================================================
     UPDATE TASK STATUS (PATCH /api/tasks/:id/status)
  ======================================================= */

  async function handleStatusChange(
    task,
    nextStatus
  ) {
    const taskId = getTaskId(task);

    if (!taskId) {
      setUpdateError(
        "Unable to update this task because its ID is missing."
      );
      return;
    }

    const currentStatus =
      getTaskStatus(task);

    if (
      normalizeStatus(currentStatus) ===
      normalizeStatus(nextStatus)
    ) {
      return;
    }

    try {
      setUpdatingTaskId(taskId);
      setIsUpdatingStatus(true);
      setUpdateError("");

      const response = await apiRequest(
        `/tasks/${taskId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      const updatedTask =
        extractTask(response);

      setTasks((current) =>
        current.map((item) =>
          getTaskId(item) === taskId
            ? {
                ...item,
                status: nextStatus,
                ...(updatedTask || {}),
              }
            : item
        )
      );

      if (selectedTask && getTaskId(selectedTask) === taskId) {
        setSelectedTask((prev) => ({
          ...prev,
          status: nextStatus,
          ...(updatedTask || {}),
        }));
      }
    } catch (err) {
      console.error(
        "Task status update error:",
        err
      );

      if (err?.status === 401) {
        router.replace("/login");
        return;
      }

      setUpdateError(
        err?.message ||
          "Unable to update task status."
      );
    } finally {
      setUpdatingTaskId(null);
      setIsUpdatingStatus(false);
    }
  }

  /* =======================================================
     USER DISPLAY
  ======================================================= */

  const userName =
    currentUser?.name ||
    currentUser?.fullName ||
    currentUser?.username ||
    "User";

  const userInitial =
    String(userName)
      .trim()
      .charAt(0)
      .toUpperCase() || "U";

  /* =======================================================
     RENDER (FLEX FULL SCREEN WITH SIDEBAR & TOP HEADER)
  ======================================================= */

  return (
    <div className="flex min-h-screen w-full bg-[#F8FAFC]">

      {/* =================================================
          MOBILE OVERLAY
      ================================================= */}

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() =>
            setSidebarOpen(false)
          }
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#171B3A] shadow-xl transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header / Logo */}

        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-sm">
              <ShieldCheck size={22} />
            </div>

            <div>
              <h1 className="text-sm font-bold text-white">
                Local Pro 1
              </h1>

              <p className="text-[11px] font-medium text-slate-300">
                User Workspace
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setSidebarOpen(false)
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation */}

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-300">
            Workspace
          </p>

          <div className="space-y-1.5">
            {navigation.map((item) => (
              <UserNavItem
                key={item.href}
                item={item}
                onNavigate={() =>
                  setSidebarOpen(false)
                }
              />
            ))}
          </div>
        </nav>

        {/* User Account Info In Sidebar */}

        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-xl px-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2563EB] text-xs font-bold text-white">
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={userName}
                  className="h-full w-full object-cover"
                />
              ) : (
                userInitial
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {userName}
              </p>

              <p className="truncate text-xs font-medium text-slate-300">
                User Account
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
          >
            {loggingOut ? (
              <Loader2
                size={17}
                className="animate-spin"
              />
            ) : (
              <LogOut size={17} />
            )}
            <span>
              {loggingOut
                ? "Signing Out..."
                : "Sign Out"}
            </span>
          </button>
        </div>
      </aside>

      {/* =================================================
          MAIN CONTENT AREA (WITH TOP HEADER)
      ================================================= */}

      <div className="flex min-w-0 flex-1 flex-col">

        {/* TOP HEADER BAR */}

        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-[#26344D] transition hover:bg-slate-50 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

            <div>
              <p className="text-xs font-medium text-[#64748B]">
                Workspace
              </p>

              <p className="text-sm font-bold text-[#171B3A]">
                My Tasks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#EEF4FF] text-xs font-bold text-[#2563EB]">
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={userName}
                  className="h-full w-full object-cover"
                />
              ) : (
                userInitial
              )}
            </div>
          </div>
        </header>

        {/* Page Content Body */}

        <main className="w-full flex-1 p-4 sm:p-6 lg:p-8">
          <div className="w-full space-y-6">

            {/* Heading Section */}

            <section className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#2563EB]">
                  WORKSPACE
                </p>

                <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
                  My Tasks
                </h1>

                <p className="mt-2 text-sm text-[#64748B]">
                  View and manage the tasks assigned to you.
                </p>
              </div>

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
            </section>

            {/* Error Notifications */}

            {error && (
              <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />

                  <div>
                    <h2 className="text-sm font-bold text-red-700">
                      Unable to load tasks
                    </h2>

                    <p className="mt-1 text-xs leading-5 text-red-600">
                      {error}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {updateError && (
              <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">
                  {updateError}
                </p>
              </section>
            )}

            {/* SUMMARY CARDS */}

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TaskSummaryCard
                icon={ClipboardList}
                label="Total Tasks"
                value={
                  loading
                    ? "..."
                    : summary.total
                }
              />

              <TaskSummaryCard
                icon={Clock3}
                label="Pending"
                value={
                  loading
                    ? "..."
                    : summary.pending
                }
              />

              <TaskSummaryCard
                icon={Activity}
                label="In Progress"
                value={
                  loading
                    ? "..."
                    : summary.inProgress
                }
              />

              <TaskSummaryCard
                icon={CheckCircle2}
                label="Completed"
                value={
                  loading
                    ? "..."
                    : summary.completed
                }
              />
            </section>

            {/* FILTERS */}

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row">
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
                    placeholder="Search by title or description..."
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
                  <option value="all">
                    All Statuses
                  </option>
                  <option value="Pending">
                    Pending
                  </option>
                  <option value="In Progress">
                    In Progress
                  </option>
                  <option value="Completed">
                    Completed
                  </option>
                  <option value="Cancelled">
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
                  <option value="all">
                    All Priorities
                  </option>
                  <option value="Low">
                    Low
                  </option>
                  <option value="Medium">
                    Medium
                  </option>
                  <option value="High">
                    High
                  </option>
                  <option value="Urgent">
                    Urgent
                  </option>
                </select>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D]"
                >
                  <SlidersHorizontal
                    size={17}
                  />
                  Clear Filters
                </button>
              </div>
            </section>

            {/* TASK TABLE */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-bold text-[#171B3A]">
                      Assigned Tasks
                    </h2>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Tasks assigned to your account from workspace.
                    </p>
                  </div>

                  {!loading && (
                    <span className="text-xs font-semibold text-slate-400">
                      Showing{" "}
                      {filteredTasks.length}{" "}
                      of {tasks.length}
                    </span>
                  )}
                </div>
              </div>

              {loading ? (
                <TasksLoading />
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70">
                        <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-slate-400 sm:px-6">
                          Task
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
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredTasks.length === 0 ? (
                        <tr>
                          <td colSpan="5">
                            <EmptyTasks
                              hasFilters={
                                Boolean(
                                  search.trim()
                                ) ||
                                status !== "all" ||
                                priority !== "all"
                              }
                              clearFilters={
                                clearFilters
                              }
                            />
                          </td>
                        </tr>
                      ) : (
                        filteredTasks.map(
                          (task) => (
                            <TaskRow
                              key={getTaskId(
                                task
                              )}
                              task={task}
                              updating={
                                updatingTaskId ===
                                getTaskId(task)
                              }
                              onStatusChange={
                                handleStatusChange
                              }
                              onViewDetails={() =>
                                setSelectedTask(
                                  task
                                )
                              }
                            />
                          )
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

          </div>
        </main>
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
                  {getTaskId(selectedTask)}
                </span>
                <h3 className="mt-0.5 text-lg font-bold text-[#171B3A]">
                  {getTaskTitle(selectedTask)}
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
                  {getTaskDescription(selectedTask) || "No description provided for this task."}
                </div>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-slate-100 p-4 bg-white">
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Created By</span>
                  <div className="flex items-center gap-2">
                    <User size={15} className="text-[#2563EB]" />
                    <span className="text-sm font-semibold text-[#171B3A]">
                      {selectedTask?.createdBy?.name || selectedTask?.createdBy?.email || "Manager / Admin"}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block mb-1">Due Date</span>
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-amber-500" />
                    <span className="text-sm font-semibold text-[#171B3A]">
                      {formatDueDate(getTaskDueDate(selectedTask))}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block mb-1">Priority</span>
                  <PriorityBadge priority={getTaskPriority(selectedTask)} />
                </div>

                <div>
                  <span className="text-xs text-slate-400 block mb-1">Category</span>
                  <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {selectedTask?.category || "General"}
                  </span>
                </div>
              </div>

              {/* Status Update Quick Selector */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Update Status
                </h4>
                <div className="flex flex-wrap gap-2">
                  {["Pending", "In Progress", "Completed"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={isUpdatingStatus || getStatusSelectValue(getTaskStatus(selectedTask)) === st}
                      onClick={() => handleStatusChange(selectedTask, st)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                        getStatusSelectValue(getTaskStatus(selectedTask)) === st
                          ? "bg-[#2563EB] text-white border-[#2563EB]"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      } disabled:opacity-50`}
                    >
                      {getStatusSelectValue(getTaskStatus(selectedTask)) === st && <CheckCircle2 size={13} />}
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comments Preview */}
              {Array.isArray(selectedTask?.comments) && selectedTask.comments.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Comments ({selectedTask.comments.length})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedTask.comments.map((c, i) => (
                      <div key={c._id || i} className="rounded-lg bg-slate-50 p-3 text-xs border border-slate-100">
                        <div className="flex justify-between text-slate-500 font-semibold mb-1">
                          <span>{c.user?.name || "User"}</span>
                          <span>{formatDueDate(c.createdAt)}</span>
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

/* =========================================================
   SIDEBAR NAV ITEM
========================================================= */

function UserNavItem({
  item,
  onNavigate,
}) {
  const pathname = usePathname();
  const Icon = item.icon;

  const isActive =
    pathname === item.href ||
    (item.href !== "/user" &&
      pathname.startsWith(
        `${item.href}/`
      ));

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
        isActive
          ? "bg-[#2563EB] text-white shadow-sm"
          : "bg-transparent text-white hover:bg-white/10"
      }`}
    >
      <Icon
        size={18}
        strokeWidth={2}
        className="shrink-0 text-white"
      />

      <span className="text-white">
        {item.label}
      </span>
    </Link>
  );
}

/* =========================================================
   TASK ROW
========================================================= */

function TaskRow({
  task,
  updating,
  onStatusChange,
  onViewDetails,
}) {
  const title = getTaskTitle(task);
  const description = getTaskDescription(task);
  const taskStatus = getTaskStatus(task);
  const taskPriority = getTaskPriority(task);
  const dueDate = getTaskDueDate(task);
  const statusKey = normalizeStatus(taskStatus);
  const overdue = isOverdue(dueDate, statusKey);

  return (
    <tr className="border-b border-slate-100 transition last:border-b-0 hover:bg-slate-50/60">
      {/* Task */}
      <td className="px-5 py-4 sm:px-6">
        <div className="flex min-w-[280px] items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
            <ClipboardList size={18} />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#171B3A]">
              {title}
            </p>

            {description && (
              <p className="mt-1 line-clamp-2 max-w-md text-xs leading-5 text-[#64748B]">
                {description}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-5 py-4">
        <StatusBadge status={taskStatus} />
      </td>

      {/* Priority */}
      <td className="px-5 py-4">
        <PriorityBadge priority={taskPriority} />
      </td>

      {/* Due Date */}
      <td className="px-5 py-4">
        <div
          className={`flex items-center gap-2 text-xs font-semibold ${
            overdue ? "text-red-600" : "text-[#64748B]"
          }`}
        >
          <CalendarDays size={14} />
          <span>{formatDueDate(dueDate)}</span>
        </div>

        {overdue && (
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-red-500">
            Overdue
          </p>
        )}
      </td>

      {/* Action */}
      <td className="px-5 py-4 text-right sm:pr-6">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onViewDetails}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#26344D] shadow-2xs transition hover:bg-slate-50"
          >
            <Eye size={13} />
            View
          </button>

          {updating ? (
            <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-[#64748B]">
              <Loader2 size={14} className="animate-spin" />
              Saving...
            </div>
          ) : (
            <select
              value={getStatusSelectValue(taskStatus)}
              onChange={(event) =>
                onStatusChange(task, event.target.value)
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#26344D] outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
              aria-label={`Update status for ${title}`}
            >
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          )}
        </div>
      </td>
    </tr>
  );
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({ status }) {
  const normalized = normalizeStatus(status);

  let className = "bg-slate-100 text-slate-600 border border-slate-200";

  if (normalized === "pending") {
    className = "bg-amber-50 text-amber-700 border border-amber-200";
  }

  if (normalized === "in progress") {
    className = "bg-blue-50 text-blue-700 border border-blue-200";
  }

  if (normalized === "completed") {
    className = "bg-emerald-50 text-emerald-700 border border-emerald-200";
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${className}`}
    >
      {formatStatus(status)}
    </span>
  );
}

/* =========================================================
   PRIORITY BADGE
========================================================= */

function PriorityBadge({ priority }) {
  const normalized = normalizePriority(priority);

  let className = "bg-slate-100 text-slate-600 border border-slate-200";

  if (normalized === "low") {
    className = "bg-green-50 text-green-700 border border-green-200";
  }

  if (normalized === "medium") {
    className = "bg-amber-50 text-amber-700 border border-amber-200";
  }

  if (normalized === "high") {
    className = "bg-orange-50 text-orange-700 border border-orange-200";
  }

  if (normalized === "urgent") {
    className = "bg-red-50 text-red-700 border border-red-200";
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${className}`}
    >
      {formatPriority(priority)}
    </span>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function TaskSummaryCard({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
          <Icon size={19} />
        </div>

        <span className="text-2xl font-bold text-[#171B3A]">
          {value}
        </span>
      </div>

      <p className="mt-4 text-sm font-semibold text-[#64748B]">
        {label}
      </p>
    </div>
  );
}

/* =========================================================
   EMPTY TASKS
========================================================= */

function EmptyTasks({
  hasFilters,
  clearFilters,
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
        <ClipboardList size={25} />
      </div>

      <h3 className="mt-4 text-sm font-bold text-[#171B3A]">
        {hasFilters
          ? "No matching tasks"
          : "No tasks available"}
      </h3>

      <p className="mt-2 max-w-sm text-sm leading-6 text-[#64748B]">
        {hasFilters
          ? "No assigned task matches your current search or filters."
          : "Tasks assigned to your account will appear here when they are assigned by an administrator or manager."}
      </p>

      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="mt-4 rounded-xl bg-[#2563EB] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#1D4ED8]"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}

/* =========================================================
   LOADING
========================================================= */

function TasksLoading() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3">
      <Loader2
        size={28}
        className="animate-spin text-[#2563EB]"
      />

      <p className="text-sm font-medium text-[#64748B]">
        Loading your tasks...
      </p>
    </div>
  );
}

/* =========================================================
   TASK NORMALIZATION
========================================================= */

function normalizeTasks(response) {
  const possible =
    response?.tasks ||
    response?.data?.tasks ||
    response?.results ||
    response?.data?.results ||
    response?.items ||
    response?.data ||
    [];

  if (!Array.isArray(possible)) {
    return [];
  }

  return possible;
}

function extractTask(response) {
  return (
    response?.task ||
    response?.data?.task ||
    response?.result?.task ||
    response?.data ||
    null
  );
}

/* =========================================================
   TASK HELPERS
========================================================= */

function getTaskId(task) {
  return (
    task?._id ||
    task?.id ||
    task?.taskId ||
    null
  );
}

function getTaskTitle(task) {
  return (
    task?.title ||
    task?.name ||
    task?.taskName ||
    "Untitled Task"
  );
}

function getTaskDescription(task) {
  return (
    task?.description ||
    task?.details ||
    task?.content ||
    ""
  );
}

function getTaskStatus(task) {
  return (
    task?.status ||
    task?.taskStatus ||
    "Pending"
  );
}

function getTaskPriority(task) {
  return (
    task?.priority ||
    task?.taskPriority ||
    "Medium"
  );
}

function getTaskDueDate(task) {
  return (
    task?.dueDate ||
    task?.deadline ||
    task?.due ||
    null
  );
}

/* =========================================================
   STATUS NORMALIZATION
========================================================= */

function normalizeStatus(value) {
  const raw = String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (
    raw === "inprogress" ||
    raw === "in progress"
  ) {
    return "in progress";
  }

  if (
    raw === "done" ||
    raw === "complete" ||
    raw === "completed" ||
    raw === "finished"
  ) {
    return "completed";
  }

  if (
    raw === "todo" ||
    raw === "to do" ||
    raw === "pending"
  ) {
    return "pending";
  }

  return raw;
}

function formatStatus(value) {
  const normalized =
    normalizeStatus(value);

  if (normalized === "in progress") {
    return "In Progress";
  }

  if (normalized === "completed") {
    return "Completed";
  }

  if (normalized === "pending") {
    return "Pending";
  }

  return (
    String(value || "Pending")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) =>
        char.toUpperCase()
      )
  );
}

function getStatusSelectValue(
  value
) {
  const normalized =
    normalizeStatus(value);

  if (normalized === "completed") {
    return "Completed";
  }

  if (normalized === "in progress") {
    return "In Progress";
  }

  return "Pending";
}

/* =========================================================
   PRIORITY NORMALIZATION
========================================================= */

function normalizePriority(value) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function formatPriority(value) {
  const normalized =
    normalizePriority(value);

  if (normalized === "urgent") {
    return "Urgent";
  }

  if (normalized === "high") {
    return "High";
  }

  if (normalized === "low") {
    return "Low";
  }

  if (normalized === "medium") {
    return "Medium";
  }

  return (
    String(value || "Medium")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) =>
        char.toUpperCase()
      )
  );
}

/* =========================================================
   DATES
========================================================= */

function formatDueDate(date) {
  if (!date) {
    return "No due date";
  }

  const parsed = new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "No due date";
  }

  return parsed.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

function isOverdue(
  date,
  status
) {
  if (
    !date ||
    status === "completed"
  ) {
    return false;
  }

  const parsed = new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return false;
  }

  return parsed.getTime() < Date.now();
}

/* =========================================================
   API REQUEST
========================================================= */

async function apiRequest(
  endpoint,
  options = {}
) {
  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type":
          "application/json",
        ...(options.headers || {}),
      },
    }
  );

  let data = null;

  try {
    data =
      await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(
      data?.message ||
        data?.error ||
        data?.errors?.[0]
          ?.message ||
        `Request failed with status ${response.status}`
    );

    error.status =
      response.status;

    throw error;
  }

  return data;
}