"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  process.env.NEXT_PUBLIC_API_URL || "https://api.localpro1.net/api";

const BACKEND_BASE_URL = API_URL.replace(/\/api\/?$/, "");

const CACHE_TIME = 60 * 1000;

/* =========================================================
   NAVIGATION
========================================================= */

const navigation = [
  { label: "Dashboard", href: "/user", icon: LayoutDashboard },
  { label: "My Tasks", href: "/user/tasks", icon: ClipboardList },
  { label: "Attendance", href: "/user/attendance", icon: Clock3 },
  { label: "Messages", href: "/user/messages", icon: MessageSquare },
  { label: "Notifications", href: "/user/notifications", icon: Bell },
  { label: "Leave Requests", href: "/user/leave-requests", icon: FileText },
  { label: "Profile", href: "/user/profile", icon: UserRound },
  { label: "Settings", href: "/user/settings", icon: Settings },
  { label: "Policies", href: "/user/policies", icon: ShieldCheck },
];

/* =========================================================
   PAGE
========================================================= */

export default function UserTasksPage() {
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [currentUser, setCurrentUser] = useState(() => extractUser(authService?.getUser?.()));

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const [error, setError] = useState("");
  const [updateError, setUpdateError] = useState("");

  const [selectedTask, setSelectedTask] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const cacheRef = useRef({ timestamp: 0, data: null });
  const loadingRef = useRef(false);

  /* =======================================================
     LOAD USER + TASKS (Speed Optimized & Cached)
  ====================================================== */

  const loadTasks = useCallback(async (force = false) => {
    if (loadingRef.current) return;

    const now = Date.now();
    if (
      !force &&
      cacheRef.current.data &&
      now - cacheRef.current.timestamp < CACHE_TIME
    ) {
      return;
    }

    loadingRef.current = true;
    if (force) setRefreshing(true);

    try {
      setError("");
      setUpdateError("");

      const me = await authService.me();
      const user = extractUser(me);

      if (!user) {
        router.replace("/login");
        return;
      }

      const role = String(user?.role || "").trim().toLowerCase();
      setCurrentUser(user);

      if (role !== "user" && role !== "admin" && role !== "manager") {
        router.replace("/login");
        return;
      }

      const response = await safeApiRequest("/tasks/my", []);
      const normalizedTasks = normalizeTasks(response);

      setTasks(normalizedTasks);

      cacheRef.current = {
        timestamp: Date.now(),
        data: { currentUser: user, tasks: normalizedTasks },
      };

      setSelectedTask((previous) => {
        if (!previous) return null;
        const selectedId = getTaskId(previous);
        return normalizedTasks.find((task) => getTaskId(task) === selectedId) || previous;
      });
    } catch (err) {
      console.error("User tasks load error:", err);
      if (err?.status === 401 || err?.status === 403) {
        router.replace("/login");
        return;
      }
      setError(err?.message || "Unable to load your tasks.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadTasks(false);
  }, [loadTasks]);

  /* =======================================================
     LOGOUT
  ====================================================== */

  async function handleSignOut() {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      if (typeof authService.logout === "function") {
        await authService.logout();
      }
    } catch (logoutError) {
      console.error("Logout error:", logoutError);
    } finally {
      setSidebarOpen(false);
      setLoggingOut(false);
      router.replace("/login");
    }
  }

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setPriority("all");
  }

  /* =======================================================
     FILTER TASKS
  ====================================================== */

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const title = getTaskTitle(task).toLowerCase();
      const description = getTaskDescription(task).toLowerCase();
      const taskStatus = normalizeStatus(getTaskStatus(task));
      const taskPriority = normalizePriority(getTaskPriority(task));

      const matchesSearch =
        !query || title.includes(query) || description.includes(query);

      const matchesStatus =
        status === "all" || taskStatus === normalizeStatus(status);

      const matchesPriority =
        priority === "all" || taskPriority === normalizePriority(priority);

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, search, status, priority]);

  /* =======================================================
     SUMMARY
  ====================================================== */

  const summary = useMemo(() => {
    const total = tasks.length;
    const pending = tasks.filter(
      (task) => normalizeStatus(getTaskStatus(task)) === "pending"
    ).length;
    const inProgress = tasks.filter(
      (task) => normalizeStatus(getTaskStatus(task)) === "in progress"
    ).length;
    const completed = tasks.filter(
      (task) => normalizeStatus(getTaskStatus(task)) === "completed"
    ).length;

    return { total, pending, inProgress, completed };
  }, [tasks]);

  /* =======================================================
     UPDATE TASK STATUS
  ====================================================== */

  async function handleStatusChange(task, nextStatus) {
    const taskId = getTaskId(task);
    if (!taskId) {
      setUpdateError("Unable to update this task because its ID is missing.");
      return;
    }

    const currentStatus = getTaskStatus(task);
    if (normalizeStatus(currentStatus) === normalizeStatus(nextStatus)) {
      return;
    }

    try {
      setUpdatingTaskId(taskId);
      setIsUpdatingStatus(true);
      setUpdateError("");

      const response = await apiRequest(`/tasks/${taskId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });

      const updatedTask = extractTask(response);

      setTasks((currentTasks) =>
        currentTasks.map((item) => {
          if (getTaskId(item) !== taskId) return item;
          return { ...item, ...(updatedTask || {}), status: nextStatus };
        })
      );

      setSelectedTask((previous) => {
        if (!previous || getTaskId(previous) !== taskId) return previous;
        return { ...previous, ...(updatedTask || {}), status: nextStatus };
      });
    } catch (err) {
      console.error("Task status update error:", err);
      if (err?.status === 401 || err?.status === 403) {
        router.replace("/login");
        return;
      }
      setUpdateError(err?.message || "Unable to update task status.");
    } finally {
      setUpdatingTaskId(null);
      setIsUpdatingStatus(false);
    }
  }

  const userName = currentUser?.name || currentUser?.fullName || currentUser?.email || "User";
  const userInitial = String(userName).trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="relative min-h-screen w-full bg-[#f7f8fc] text-slate-950 animate-fadeIn">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl animate-pulse" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden transition-opacity duration-300"
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#171B3A] text-white shadow-2xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-md shadow-purple-600/20">
              <ShieldCheck size={22} />
            </div>

            <div>
              <h1 className="text-sm font-bold text-white">Local Pro 1</h1>
              <p className="text-[11px] font-semibold text-violet-400">
                User Workspace
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Workspace
          </p>

          <div className="space-y-1.5">
            {navigation.map((item) => (
              <UserNavItem
                key={item.href}
                item={item}
                onNavigate={() => setSidebarOpen(false)}
              />
            ))}
          </div>
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-60"
          >
            {loggingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
            <span>{loggingOut ? "Signing Out..." : "Logout"}</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="min-h-screen w-full lg:pl-64">
        {/* TOP HEADER BAR */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-5 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

            <div>
              <p className="text-xs font-semibold text-slate-400">Workspace</p>
              <p className="text-sm font-bold text-slate-900">My Tasks</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => loadTasks(true)}
              disabled={refreshing}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-violet-50 hover:text-violet-600 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin text-violet-600" : ""} />
            </button>

            <Link
              href="/user/notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-600 transition hover:bg-violet-100"
              title="Notifications"
            >
              <Bell size={17} />
            </Link>

            <div className="hidden items-center gap-2.5 border-l border-slate-200 pl-3 sm:flex">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-sm">
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt={userName} className="h-full w-full object-cover" />
                ) : (
                  userInitial
                )}
              </div>
              <div className="max-w-[150px]">
                <p className="truncate text-xs font-bold text-slate-900">{userName}</p>
                <p className="text-[10px] font-semibold capitalize text-violet-600">
                  {currentUser?.role || "user"}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 animate-slideUp">
          <div className="mx-auto w-full max-w-7xl space-y-6">

            {/* CLEAN HEADER SECTION (NO BANNER) */}
            <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/80 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-violet-700">
                  <ShieldCheck size={13} />
                  WORKSPACE
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  My Tasks
                </h1>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  View, filter, and update the status of tasks assigned to your workspace account.
                </p>
              </div>

              <button
                type="button"
                onClick={() => loadTasks(true)}
                disabled={refreshing}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/50 hover:text-violet-700 disabled:opacity-60"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin text-violet-600" : ""} />
                Refresh Tasks
              </button>
            </section>

            {error && (
              <section className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-rose-700 shadow-sm">
                <h2 className="text-sm font-bold">Unable to load tasks</h2>
                <p className="mt-1 text-xs">{error}</p>
                <button
                  type="button"
                  onClick={() => loadTasks(true)}
                  className="mt-3 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
                >
                  Try Again
                </button>
              </section>
            )}

            {updateError && (
              <section className="rounded-2xl border border-rose-100 bg-rose-50 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-rose-700">{updateError}</p>
                  <button type="button" onClick={() => setUpdateError("")} className="text-rose-400 hover:text-rose-600">
                    <X size={16} />
                  </button>
                </div>
              </section>
            )}

            {/* SUMMARY CARDS */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TaskSummaryCard icon={ClipboardList} label="Total Tasks" value={loading ? "..." : summary.total} />
              <TaskSummaryCard icon={Clock3} label="Pending" value={loading ? "..." : summary.pending} />
              <TaskSummaryCard icon={Activity} label="In Progress" value={loading ? "..." : summary.inProgress} />
              <TaskSummaryCard icon={CheckCircle2} label="Completed" value={loading ? "..." : summary.completed} />
            </section>

            {/* FILTERS */}
            <section className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_35px_rgba(45,35,100,0.05)] sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by title or description..."
                    className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 pl-10 pr-4 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                  />
                </div>

                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-11 rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 text-xs font-bold text-slate-600 outline-none focus:border-violet-500 focus:bg-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>

                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="h-11 rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 text-xs font-bold text-slate-600 outline-none focus:border-violet-500 focus:bg-white"
                >
                  <option value="all">All Priorities</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  <SlidersHorizontal size={15} />
                  Clear
                </button>
              </div>
            </section>

            {/* TABLE SECTION */}
            <section className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]">
              <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4.5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Assigned Tasks List</h2>
                    <p className="text-xs text-slate-500">Manage work items assigned to your profile.</p>
                  </div>
                  {!loading && (
                    <span className="text-xs font-semibold text-slate-400">
                      Showing {filteredTasks.length} of {tasks.length} tasks
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
                      <tr className="border-b border-slate-100 bg-slate-50/30">
                        <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Task</th>
                        <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                        <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Priority</th>
                        <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Due Date</th>
                        <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400 sm:pr-6">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTasks.length === 0 ? (
                        <tr>
                          <td colSpan="5">
                            <EmptyTasks
                              hasFilters={Boolean(search.trim()) || status !== "all" || priority !== "all"}
                              clearFilters={clearFilters}
                            />
                          </td>
                        </tr>
                      ) : (
                        filteredTasks.map((task) => (
                          <TaskRow
                            key={getTaskId(task)}
                            task={task}
                            updating={updatingTaskId === getTaskId(task)}
                            onStatusChange={handleStatusChange}
                            onViewDetails={() => setSelectedTask(task)}
                          />
                        ))
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-violet-600">
                  ID: {getTaskId(selectedTask)}
                </span>
                <h3 className="mt-1 text-lg font-extrabold text-slate-900">
                  {getTaskTitle(selectedTask)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6 pt-5">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Description</h4>
                <div className="mt-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-xs font-medium leading-relaxed text-slate-700">
                  {getTaskDescription(selectedTask) || "No description provided for this task."}
                </div>
              </div>

              {/* Attachments */}
              {getTaskAttachments(selectedTask).length > 0 && (
                <div>
                  <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <Paperclip size={14} className="text-violet-600" />
                    Task Attachments
                  </h4>
                  <div className="space-y-2">
                    {getTaskAttachments(selectedTask).map((att, idx) => {
                      const fileUrl = getFullFileUrl(att.url);
                      const displayName = att.originalName || att.filename || "Attached File";
                      return (
                        <div key={idx} className="flex items-center justify-between rounded-2xl border border-violet-100 bg-violet-50/40 p-3">
                          <div className="flex items-center gap-3 truncate">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                              <FileText size={16} />
                            </div>
                            <div className="truncate">
                              <p className="truncate text-xs font-bold text-slate-900">{displayName}</p>
                              <p className="text-[10px] font-medium text-slate-400">{att.size ? formatBytes(att.size) : "Document"}</p>
                            </div>
                          </div>
                          <div className="ml-3 flex shrink-0 items-center gap-2">
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
                            >
                              <ExternalLink size={12} /> Open
                            </a>
                            <a
                              href={fileUrl}
                              download={displayName}
                              className="inline-flex h-8 items-center gap-1 rounded-xl bg-violet-600 px-3 text-xs font-bold text-white shadow-sm hover:bg-violet-700"
                            >
                              <Download size={12} /> Download
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Meta information */}
              <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 sm:grid-cols-2">
                <div>
                  <span className="mb-1 block text-[11px] font-semibold text-slate-400">Created By</span>
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-violet-600" />
                    <span className="text-xs font-bold text-slate-800">{getCreatedByName(selectedTask)}</span>
                  </div>
                </div>
                <div>
                  <span className="mb-1 block text-[11px] font-semibold text-slate-400">Due Date</span>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-amber-500" />
                    <span className="text-xs font-bold text-slate-800">{formatDueDate(getTaskDueDate(selectedTask))}</span>
                  </div>
                </div>
              </div>

              {/* Status Update Options */}
              <div>
                <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-400">Change Status</h4>
                <div className="flex flex-wrap gap-2">
                  {["Pending", "In Progress", "Completed"].map((statusOpt) => {
                    const active = getStatusSelectValue(getTaskStatus(selectedTask)) === statusOpt;
                    return (
                      <button
                        key={statusOpt}
                        type="button"
                        disabled={isUpdatingStatus || active}
                        onClick={() => handleStatusChange(selectedTask, statusOpt)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition duration-150 ${
                          active
                            ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {active && <CheckCircle2 size={13} />}
                        {statusOpt}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="h-10 rounded-2xl bg-slate-100 px-6 text-xs font-bold text-slate-700 hover:bg-slate-200"
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
   SUB COMPONENTS & HELPERS
========================================================= */

function UserNavItem({ item, onNavigate }) {
  const pathname = usePathname();
  const Icon = item.icon;
  const isActive =
    pathname === item.href ||
    (item.href !== "/user" && pathname.startsWith(`${item.href}/`));

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold transition duration-150 ${
        isActive
          ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon size={18} className={`transition duration-150 ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`} />
      <span>{item.label}</span>
    </Link>
  );
}

function TaskRow({ task, updating, onStatusChange, onViewDetails }) {
  const title = getTaskTitle(task);
  const description = getTaskDescription(task);
  const taskStatus = getTaskStatus(task);
  const taskPriority = getTaskPriority(task);
  const dueDate = getTaskDueDate(task);
  const attachments = getTaskAttachments(task);
  const statusKey = normalizeStatus(taskStatus);
  const overdue = isOverdue(dueDate, statusKey);

  return (
    <tr className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition">
      <td className="px-6 py-4">
        <div className="flex min-w-[260px] items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <ClipboardList size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-xs font-bold text-slate-900">{title}</p>
              {attachments.length > 0 && (
                <span title="File Attached" className="inline-flex shrink-0 items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">
                  <Paperclip size={10} /> File
                </span>
              )}
            </div>
            {description && (
              <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">{description}</p>
            )}
          </div>
        </div>
      </td>

      <td className="px-6 py-4">
        <StatusBadge status={taskStatus} />
      </td>

      <td className="px-6 py-4">
        <PriorityBadge priority={taskPriority} />
      </td>

      <td className="px-6 py-4">
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${overdue ? "text-rose-600" : "text-slate-500"}`}>
          <CalendarDays size={13} />
          <span>{formatDueDate(dueDate)}</span>
        </div>
        {overdue && <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-500">Overdue</p>}
      </td>

      <td className="px-6 py-4 text-right sm:pr-6">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onViewDetails}
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200/90 bg-white px-3 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
          >
            <Eye size={13} /> View
          </button>

          {updating ? (
            <div className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-500">
              <Loader2 size={13} className="animate-spin text-violet-600" /> Saving...
            </div>
          ) : (
            <select
              value={getStatusSelectValue(taskStatus)}
              onChange={(e) => onStatusChange(task, e.target.value)}
              className="h-9 rounded-xl border border-slate-200/90 bg-slate-50/50 px-3 text-xs font-bold text-slate-700 outline-none focus:border-violet-500 focus:bg-white"
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

function StatusBadge({ status }) {
  const normalized = normalizeStatus(status);
  let classes = "bg-slate-100 text-slate-600 border border-slate-200";

  if (normalized === "pending") classes = "bg-amber-50 text-amber-700 border border-amber-200";
  else if (normalized === "in progress") classes = "bg-blue-50 text-blue-700 border border-blue-200";
  else if (normalized === "completed") classes = "bg-emerald-50 text-emerald-700 border border-emerald-200";
  else if (normalized === "cancelled") classes = "bg-rose-50 text-rose-700 border border-rose-200";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${classes}`}>
      {formatStatus(status)}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const normalized = normalizePriority(priority);
  let classes = "bg-slate-100 text-slate-600 border border-slate-200";

  if (normalized === "low") classes = "bg-emerald-50 text-emerald-700 border border-emerald-200";
  else if (normalized === "medium") classes = "bg-amber-50 text-amber-700 border border-amber-200";
  else if (normalized === "high") classes = "bg-orange-50 text-orange-700 border border-orange-200";
  else if (normalized === "urgent") classes = "bg-rose-50 text-rose-700 border border-rose-200";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${classes}`}>
      {formatPriority(priority)}
    </span>
  );
}

function TaskSummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(45,35,100,0.06)]">
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <Icon size={19} />
        </div>
        <span className="text-2xl font-extrabold text-slate-900">{value}</span>
      </div>
      <p className="mt-4 text-xs font-semibold text-slate-400">{label}</p>
    </div>
  );
}

function EmptyTasks({ hasFilters, clearFilters }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
        <ClipboardList size={22} />
      </div>
      <h3 className="mt-3 text-xs font-bold text-slate-900">
        {hasFilters ? "No matching tasks" : "No tasks available"}
      </h3>
      <p className="mt-1 text-xs text-slate-400 max-w-xs">
        {hasFilters ? "Try clearing filters to see results." : "No tasks are currently assigned to you."}
      </p>
      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="mt-4 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}

function TasksLoading() {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3">
      <Loader2 size={28} className="animate-spin text-violet-600" />
      <p className="text-xs font-semibold text-slate-400">Loading your tasks...</p>
    </div>
  );
}

/* =========================================================
   HELPERS & NORMALIZERS
========================================================= */

async function safeApiRequest(endpoint, fallback = null) {
  try {
    let token = null;
    try {
      if (typeof window !== "undefined") {
        token = localStorage.getItem("token") || localStorage.getItem("authToken");
      }
      if (!token && typeof authService?.getToken === "function") {
        token = authService.getToken();
      }
    } catch {}

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    });

    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  }
}

async function apiRequest(endpoint, options = {}) {
  let token = null;
  try {
    if (typeof window !== "undefined") {
      token = localStorage.getItem("token") || localStorage.getItem("authToken");
    }
    if (!token && typeof authService?.getToken === "function") {
      token = authService.getToken();
    }
  } catch {}

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  let data = null;
  try {
    const text = await response.text();
    if (text) data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.message || data?.error || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

function extractUser(response) {
  return response?.user || response?.data?.user || response?.data || response || null;
}

function normalizeTasks(response) {
  const possible = response?.tasks || response?.data?.tasks || response?.results || response?.data || [];
  return Array.isArray(possible) ? possible : [];
}

function extractTask(response) {
  return response?.task || response?.data?.task || response?.data || null;
}

function getTaskId(task) {
  return task?._id || task?.id || task?.taskId || null;
}

function getTaskTitle(task) {
  return task?.title || task?.name || task?.taskName || "Untitled Task";
}

function getTaskDescription(task) {
  return task?.description || task?.details || task?.content || "";
}

function getTaskStatus(task) {
  return task?.status || task?.taskStatus || "Pending";
}

function getTaskPriority(task) {
  return task?.priority || task?.taskPriority || "Medium";
}

function getTaskDueDate(task) {
  return task?.dueDate || task?.deadline || task?.due || null;
}

function getCreatedByName(task) {
  return task?.createdBy?.name || task?.createdBy?.email || task?.assignedBy?.name || "Manager / Admin";
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
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${BACKEND_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

function formatBytes(bytes) {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function normalizeStatus(val) {
  const raw = String(val || "").trim().toLowerCase().replace(/[_-]+/g, " ");
  if (raw === "inprogress" || raw === "in progress") return "in progress";
  if (["done", "complete", "completed", "finished"].includes(raw)) return "completed";
  if (["todo", "to do", "pending"].includes(raw)) return "pending";
  if (["cancelled", "canceled"].includes(raw)) return "cancelled";
  return raw;
}

function formatStatus(val) {
  const norm = normalizeStatus(val);
  if (norm === "in progress") return "In Progress";
  if (norm === "completed") return "Completed";
  if (norm === "pending") return "Pending";
  if (norm === "cancelled") return "Cancelled";
  return String(val || "Pending").replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function getStatusSelectValue(val) {
  const norm = normalizeStatus(val);
  if (norm === "completed") return "Completed";
  if (norm === "in progress") return "In Progress";
  return "Pending";
}

function normalizePriority(val) {
  return String(val || "").trim().toLowerCase();
}

function formatPriority(val) {
  return String(val || "Medium").replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function formatDueDate(date) {
  if (!date) return "No due date";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "No due date";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(date, status) {
  if (!date || status === "completed") return false;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < Date.now();
}