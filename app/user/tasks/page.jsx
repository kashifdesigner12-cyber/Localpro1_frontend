"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Paperclip,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  User,
  Bell,
  MessageSquare,
  UserRound,
  X,
} from "lucide-react";

import { authService } from "@/services/authService";

/* =========================================================
   API CONFIG
========================================================= */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api";

const BACKEND_BASE_URL = API_URL.replace(/\/api\/?$/, "");

/* =========================================================
   NAVIGATION
========================================================= */

const navigation = [
  {
    label: "Dashboard",
    href: "/user",
    icon: LayoutDashboard,
  },
  {
    label: "My Tasks",
    href: "/user/tasks",
    icon: ClipboardList,
  },
  {
    label: "Calendar",
    href: "/user/calendar",
    icon: CalendarDays,
  },
  {
    label: "Attendance",
    href: "/user/attendance",
    icon: Clock3,
  },
  {
    label: "Messages",
    href: "/user/messages",
    icon: MessageSquare,
  },
  {
    label: "Notifications",
    href: "/user/notifications",
    icon: Bell,
  },
  {
    label: "Leave Requests",
    href: "/user/leave-requests",
    icon: FileText,
  },
  {
    label: "Activity",
    href: "/user/activity",
    icon: Activity,
  },
  {
    label: "Profile",
    href: "/user/profile",
    icon: UserRound,
  },
  {
    label: "Settings",
    href: "/user/settings",
    icon: Settings,
  },
  {
    label: "Policies",
    href: "/user/policies",
    icon: ShieldCheck,
  },
];

/* =========================================================
   PAGE
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

  const [selectedTask, setSelectedTask] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  /* =======================================================
     LOAD USER + TASKS
  ======================================================= */

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setUpdateError("");

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

      if (
        role !== "user" &&
        role !== "admin" &&
        role !== "manager"
      ) {
        router.replace("/login");
        return;
      }

      const response = await apiRequest(
        "/tasks/my",
        {
          method: "GET",
        }
      );

      const normalizedTasks =
        normalizeTasks(response);

      setTasks(normalizedTasks);

      setSelectedTask((previous) => {
        if (!previous) return null;

        const selectedId =
          getTaskId(previous);

        const freshTask =
          normalizedTasks.find(
            (task) =>
              getTaskId(task) === selectedId
          );

        return freshTask || previous;
      });
    } catch (err) {
      console.error(
        "User tasks load error:",
        err
      );

      if (
        err?.status === 401 ||
        err?.status === 403
      ) {
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
     LOGOUT
  ======================================================= */

  async function handleSignOut() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      if (
        typeof authService.logout ===
        "function"
      ) {
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
     FILTER TASKS
  ======================================================= */

  const filteredTasks = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return tasks.filter((task) => {
      const title =
        getTaskTitle(task).toLowerCase();

      const description =
        getTaskDescription(
          task
        ).toLowerCase();

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
        title.includes(query) ||
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
     SUMMARY
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
     UPDATE TASK STATUS
  ======================================================= */

  async function handleStatusChange(
    task,
    nextStatus
  ) {
    const taskId =
      getTaskId(task);

    if (!taskId) {
      setUpdateError(
        "Unable to update this task because its ID is missing."
      );
      return;
    }

    const currentStatus =
      getTaskStatus(task);

    if (
      normalizeStatus(
        currentStatus
      ) ===
      normalizeStatus(
        nextStatus
      )
    ) {
      return;
    }

    try {
      setUpdatingTaskId(taskId);
      setIsUpdatingStatus(true);
      setUpdateError("");

      const response =
        await apiRequest(
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

      setTasks((currentTasks) =>
        currentTasks.map(
          (item) => {
            if (
              getTaskId(item) !==
              taskId
            ) {
              return item;
            }

            return {
              ...item,
              ...(updatedTask || {}),
              status: nextStatus,
            };
          }
        )
      );

      setSelectedTask(
        (previous) => {
          if (
            !previous ||
            getTaskId(previous) !==
              taskId
          ) {
            return previous;
          }

          return {
            ...previous,
            ...(updatedTask || {}),
            status: nextStatus,
          };
        }
      );
    } catch (err) {
      console.error(
        "Task status update error:",
        err
      );

      if (
        err?.status === 401 ||
        err?.status === 403
      ) {
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
     USER
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
     RENDER
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* MOBILE OVERLAY */}
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

      {/* SIDEBAR - FIXED POSITION */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#171B3A] shadow-xl transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        {/* HEADER */}
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-white">
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
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={19} />
          </button>
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-300">
            Workspace
          </p>

          <div className="space-y-1.5">
            {navigation.map(
              (item) => (
                <UserNavItem
                  key={item.href}
                  item={item}
                  onNavigate={() =>
                    setSidebarOpen(false)
                  }
                />
              )
            )}
          </div>
        </nav>

        {/* ACCOUNT */}
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
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
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

      {/* MAIN CONTAINER */}
      <div className="lg:pl-64">
        {/* TOP HEADER - FIXED POSITION */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-[#26344D] hover:bg-slate-50 lg:hidden"
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
            <Link
              href="/user/notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#EEF4FF] text-[#2563EB] transition hover:bg-blue-100"
              aria-label="Notifications"
            >
              <Bell size={17} />
            </Link>

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

        {/* CONTENT - SCROLLABLE */}
        <main className="h-[calc(100vh-4rem)] overflow-y-auto bg-[#F8FAFC] p-5 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl space-y-6">

            {/* HEADING */}

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
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#26344D] shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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

            {/* LOAD ERROR */}

            {error && (
              <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <h2 className="text-sm font-bold text-red-700">
                  Unable to load tasks
                </h2>

                <p className="mt-1 text-xs leading-5 text-red-600">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={loadTasks}
                  className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                >
                  Try Again
                </button>
              </section>
            )}

            {/* UPDATE ERROR */}

            {updateError && (
              <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-red-700">
                    {updateError}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setUpdateError("")
                    }
                    className="text-red-500 hover:text-red-700"
                  >
                    <X size={17} />
                  </button>
                </div>
              </section>
            )}

            {/* SUMMARY */}

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
                  className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#64748B] outline-none focus:border-[#2563EB]"
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
                  className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#64748B] outline-none focus:border-[#2563EB]"
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
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-[#64748B] hover:bg-slate-50"
                >
                  <SlidersHorizontal
                    size={17}
                  />

                  Clear Filters
                </button>
              </div>
            </section>

            {/* TABLE */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

              <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-bold text-[#171B3A]">
                      Assigned Tasks
                    </h2>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Tasks assigned to your account.
                    </p>
                  </div>

                  {!loading && (
                    <span className="text-xs font-semibold text-slate-400">
                      Showing{" "}
                      {
                        filteredTasks.length
                      }{" "}
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
                      {filteredTasks.length ===
                      0 ? (
                        <tr>
                          <td colSpan="5">
                            <EmptyTasks
                              hasFilters={
                                Boolean(
                                  search.trim()
                                ) ||
                                status !==
                                  "all" ||
                                priority !==
                                  "all"
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
                              key={
                                getTaskId(
                                  task
                                )
                              }
                              task={task}
                              updating={
                                updatingTaskId ===
                                getTaskId(
                                  task
                                )
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

      {/* =====================================================
          TASK DETAILS MODAL
      ===================================================== */}

      {selectedTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl">

            {/* HEADER */}

            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 py-4">
              <div className="min-w-0">
                <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                  {getTaskId(
                    selectedTask
                  )}
                </span>

                <h3 className="mt-1 text-lg font-bold text-[#171B3A]">
                  {getTaskTitle(
                    selectedTask
                  )}
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedTask(null)
                }
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* BODY */}

            <div className="space-y-6 p-6">

              {/* DESCRIPTION */}

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Description
                </h4>

                <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm leading-relaxed text-[#26344D]">
                  {getTaskDescription(
                    selectedTask
                  ) ||
                    "No description provided for this task."}
                </div>
              </div>

              {/* ATTACHMENT / FILE SECTION */}

              {getTaskAttachments(selectedTask).length > 0 && (
                <div>
                  <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <Paperclip size={14} className="text-[#2563EB]" />
                    Task Attachment
                  </h4>

                  <div className="space-y-2">
                    {getTaskAttachments(selectedTask).map((att, idx) => {
                      const fileUrl = getFullFileUrl(att.url);
                      const displayName =
                        att.originalName || att.filename || "Attached File";

                      return (
                        <div
                          key={att.id || att._id || idx}
                          className="flex items-center justify-between rounded-xl border border-blue-100 bg-[#F0F6FF] p-3.5 transition hover:border-blue-300"
                        >
                          <div className="flex items-center gap-3 truncate">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white">
                              <FileText size={18} />
                            </div>

                            <div className="truncate">
                              <p className="truncate text-sm font-bold text-[#171B3A]">
                                {displayName}
                              </p>

                              <p className="text-xs font-medium text-slate-500">
                                {att.size ? formatBytes(att.size) : "Document"}
                                {att.fileType ? ` • ${att.fileType.split("/")[1]?.toUpperCase() || "FILE"}` : ""}
                              </p>
                            </div>
                          </div>

                          <div className="ml-3 flex shrink-0 items-center gap-2">
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-[#26344D] shadow-sm transition hover:bg-slate-50"
                            >
                              <ExternalLink size={13} />
                              Open
                            </a>

                            <a
                              href={fileUrl}
                              download={displayName}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#1D4ED8]"
                            >
                              <Download size={13} />
                              Download
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* META */}

              <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-white p-4 sm:grid-cols-2">

                <div>
                  <span className="mb-1 block text-xs text-slate-400">
                    Created By
                  </span>

                  <div className="flex items-center gap-2">
                    <User
                      size={15}
                      className="text-[#2563EB]"
                    />

                    <span className="text-sm font-semibold text-[#171B3A]">
                      {getCreatedByName(
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
                      {formatDueDate(
                        getTaskDueDate(
                          selectedTask
                        )
                      )}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="mb-1 block text-xs text-slate-400">
                    Priority
                  </span>

                  <PriorityBadge
                    priority={getTaskPriority(
                      selectedTask
                    )}
                  />
                </div>

                <div>
                  <span className="mb-1 block text-xs text-slate-400">
                    Category
                  </span>

                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {selectedTask?.category ||
                      "General"}
                  </span>
                </div>
              </div>

              {/* STATUS */}

              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Update Status
                </h4>

                <div className="flex flex-wrap gap-2">
                  {[
                    "Pending",
                    "In Progress",
                    "Completed",
                  ].map((taskStatus) => {
                    const active =
                      getStatusSelectValue(
                        getTaskStatus(
                          selectedTask
                        )
                      ) ===
                      taskStatus;

                    return (
                      <button
                        key={taskStatus}
                        type="button"
                        disabled={
                          isUpdatingStatus ||
                          active
                        }
                        onClick={() =>
                          handleStatusChange(
                            selectedTask,
                            taskStatus
                          )
                        }
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                          active
                            ? "border-[#2563EB] bg-[#2563EB] text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {active && (
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
                selectedTask?.comments
              ) &&
                selectedTask.comments
                  .length > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                      Comments (
                      {
                        selectedTask
                          .comments
                          .length
                      }
                      )
                    </h4>

                    <div className="max-h-40 space-y-2 overflow-y-auto">
                      {selectedTask.comments.map(
                        (comment, index) => (
                          <div
                            key={
                              comment._id ||
                              index
                            }
                            className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                          >
                            <div className="mb-1 flex justify-between gap-3 text-slate-500">
                              <span className="text-xs font-semibold">
                                {comment?.user
                                  ?.name ||
                                  "User"}
                              </span>

                              <span className="text-[10px]">
                                {formatDueDate(
                                  comment?.createdAt
                                )}
                              </span>
                            </div>

                            <p className="text-xs text-slate-800">
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

            {/* FOOTER */}

            <div className="sticky bottom-0 flex justify-end border-t border-slate-100 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() =>
                  setSelectedTask(null)
                }
                className="h-10 rounded-xl bg-slate-100 px-6 text-xs font-bold text-slate-700 hover:bg-slate-200"
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
   SIDEBAR NAV
========================================================= */

function UserNavItem({
  item,
  onNavigate,
}) {
  const pathname =
    usePathname();

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
          : "text-white hover:bg-white/10"
      }`}
    >
      <Icon
        size={18}
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
  const title =
    getTaskTitle(task);

  const description =
    getTaskDescription(task);

  const taskStatus =
    getTaskStatus(task);

  const taskPriority =
    getTaskPriority(task);

  const dueDate =
    getTaskDueDate(task);

  const attachments =
    getTaskAttachments(task);

  const statusKey =
    normalizeStatus(
      taskStatus
    );

  const overdue =
    isOverdue(
      dueDate,
      statusKey
    );

  return (
    <tr className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60">

      {/* TASK */}

      <td className="px-5 py-4 sm:px-6">
        <div className="flex min-w-[280px] items-start gap-3">

          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
            <ClipboardList size={18} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-bold text-[#171B3A]">
                {title}
              </p>

              {/* Attachment Pill Indicator */}
              {attachments.length > 0 && (
                <span
                  title="Has file attachment"
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-[#2563EB]"
                >
                  <Paperclip size={11} />
                  File
                </span>
              )}
            </div>

            {description && (
              <p className="mt-1 line-clamp-2 max-w-md text-xs leading-5 text-[#64748B]">
                {description}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* STATUS */}

      <td className="px-5 py-4">
        <StatusBadge
          status={taskStatus}
        />
      </td>

      {/* PRIORITY */}

      <td className="px-5 py-4">
        <PriorityBadge
          priority={taskPriority}
        />
      </td>

      {/* DUE */}

      <td className="px-5 py-4">
        <div
          className={`flex items-center gap-2 text-xs font-semibold ${
            overdue
              ? "text-red-600"
              : "text-[#64748B]"
          }`}
        >
          <CalendarDays size={14} />

          <span>
            {formatDueDate(
              dueDate
            )}
          </span>
        </div>

        {overdue && (
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-red-500">
            Overdue
          </p>
        )}
      </td>

      {/* ACTION */}

      <td className="px-5 py-4 text-right sm:pr-6">
        <div className="flex items-center justify-end gap-2">

          <button
            type="button"
            onClick={onViewDetails}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#26344D] hover:bg-slate-50"
          >
            <Eye size={13} />
            View
          </button>

          {updating ? (
            <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-[#64748B]">
              <Loader2
                size={14}
                className="animate-spin"
              />

              Saving...
            </div>
          ) : (
            <select
              value={getStatusSelectValue(
                taskStatus
              )}
              onChange={(event) =>
                onStatusChange(
                  task,
                  event.target.value
                )
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#26344D] outline-none focus:border-[#2563EB]"
            >
              <option value="Pending">
                Pending
              </option>

              <option value="In Progress">
                In Progress
              </option>

              <option value="Completed">
                Completed
              </option>
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

function StatusBadge({
  status,
}) {
  const normalized =
    normalizeStatus(status);

  let className =
    "border-slate-200 bg-slate-100 text-slate-600";

  if (
    normalized === "pending"
  ) {
    className =
      "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (
    normalized === "in progress"
  ) {
    className =
      "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (
    normalized === "completed"
  ) {
    className =
      "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    normalized === "cancelled"
  ) {
    className =
      "border-red-200 bg-red-50 text-red-700";
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${className}`}
    >
      {formatStatus(status)}
    </span>
  );
}

/* =========================================================
   PRIORITY BADGE
========================================================= */

function PriorityBadge({
  priority,
}) {
  const normalized =
    normalizePriority(
      priority
    );

  let className =
    "border-slate-200 bg-slate-100 text-slate-600";

  if (
    normalized === "low"
  ) {
    className =
      "border-green-200 bg-green-50 text-green-700";
  }

  if (
    normalized === "medium"
  ) {
    className =
      "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (
    normalized === "high"
  ) {
    className =
      "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (
    normalized === "urgent"
  ) {
    className =
      "border-red-200 bg-red-50 text-red-700";
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${className}`}
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
   EMPTY
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
          : "Tasks assigned to your account will appear here when they are assigned."}
      </p>

      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="mt-4 rounded-xl bg-[#2563EB] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#1D4ED8]"
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
   NORMALIZE TASKS
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

  return Array.isArray(
    possible
  )
    ? possible
    : [];
}

/* =========================================================
   EXTRACT TASK
========================================================= */

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

function getCreatedByName(task) {
  return (
    task?.createdBy?.name ||
    task?.createdBy?.fullName ||
    task?.createdBy?.email ||
    task?.assignedBy?.name ||
    "Manager / Admin"
  );
}

function getTaskAttachments(task) {
  if (Array.isArray(task?.attachments)) {
    return task.attachments.filter((att) => att && (att.url || att.filename));
  }
  if (task?.attachment && typeof task.attachment === "string") {
    return [{ url: task.attachment, filename: "Attachment" }];
  }
  return [];
}

function getFullFileUrl(path) {
  if (!path) return "#";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${BACKEND_BASE_URL}${cleanPath}`;
}

function formatBytes(bytes) {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/* =========================================================
   STATUS
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

  if (
    raw === "cancelled" ||
    raw === "canceled"
  ) {
    return "cancelled";
  }

  return raw;
}

function formatStatus(value) {
  const normalized =
    normalizeStatus(value);

  if (
    normalized === "in progress"
  ) {
    return "In Progress";
  }

  if (
    normalized === "completed"
  ) {
    return "Completed";
  }

  if (
    normalized === "pending"
  ) {
    return "Pending";
  }

  if (
    normalized === "cancelled"
  ) {
    return "Cancelled";
  }

  return String(
    value || "Pending"
  )
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

function getStatusSelectValue(
  value
) {
  const normalized =
    normalizeStatus(value);

  if (
    normalized === "completed"
  ) {
    return "Completed";
  }

  if (
    normalized === "in progress"
  ) {
    return "In Progress";
  }

  if (
    normalized === "cancelled"
  ) {
    return "Pending";
  }

  return "Pending";
}

/* =========================================================
   PRIORITY
========================================================= */

function normalizePriority(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function formatPriority(value) {
  const normalized =
    normalizePriority(value);

  if (normalized === "urgent")
    return "Urgent";

  if (normalized === "high")
    return "High";

  if (normalized === "low")
    return "Low";

  if (normalized === "medium")
    return "Medium";

  return String(
    value || "Medium"
  )
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

/* =========================================================
   DATE
========================================================= */

function formatDueDate(date) {
  if (!date) {
    return "No due date";
  }

  const parsed =
    new Date(date);

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

  const parsed =
    new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return false;
  }

  return (
    parsed.getTime() <
    Date.now()
  );
}

/* =========================================================
   API REQUEST
========================================================= */

async function apiRequest(
  endpoint,
  options = {}
) {
  const response =
    await fetch(
      `${API_URL}${endpoint}`,
      {
        ...options,

        credentials: "include",

        headers: {
          Accept:
            "application/json",

          "Content-Type":
            "application/json",

          ...(options.headers ||
            {}),
        },

        cache: "no-store",
      }
    );

  let data = null;

  const contentType =
    response.headers.get(
      "content-type"
    );

  if (
    contentType?.includes(
      "application/json"
    )
  ) {
    try {
      data =
        await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      data?.errors?.[0]
        ?.message ||
      `Request failed with status ${response.status}`;

    const error =
      new Error(message);

    error.status =
      response.status;

    error.data = data;

    throw error;
  }

  return data;
}