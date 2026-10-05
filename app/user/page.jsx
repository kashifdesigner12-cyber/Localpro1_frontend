"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

import { authService } from "@/services/authService";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.localpro1.net/api";

const CACHE_TIME = 60 * 1000;

/* =========================================================
   NAVIGATION (Sidebar items)
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
   USER DASHBOARD PAGE
========================================================= */

export default function UserDashboardPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(() => extractUser(authService?.getUser?.()));
  const [tasks, setTasks] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const cacheRef = useRef({ timestamp: 0, data: null });
  const loadingRef = useRef(false);

  const loadDashboard = useCallback(
    async (force = false) => {
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
        const meResponse = await authService.me();
        const currentUser = extractUser(meResponse);

        if (!currentUser) {
          router.replace("/login");
          return;
        }

        const role = String(currentUser?.role || "").trim().toLowerCase();
        if (role !== "user") {
          if (role === "admin") router.replace("/admin");
          else if (role === "manager") router.replace("/manager");
          else router.replace("/login");
          return;
        }

        setUser(currentUser);

        const [tasksRes, convRes, notifRes] = await Promise.all([
          safeApiRequest("/tasks/my", []),
          safeApiRequest("/conversations", []),
          safeApiRequest("/notifications", []),
        ]);

        const nextTasks = normalizeTasks(tasksRes);
        const nextConversations = normalizeConversations(convRes);
        const nextNotifications = normalizeNotifications(notifRes);

        setTasks(nextTasks);
        setConversations(nextConversations);
        setNotifications(nextNotifications);

        cacheRef.current = {
          timestamp: Date.now(),
          data: {
            currentUser,
            tasks: nextTasks,
            conversations: nextConversations,
            notifications: nextNotifications,
          },
        };
      } catch (err) {
        console.error("User dashboard load error:", err);
        if (err?.status === 401 || err?.status === 403) {
          try {
            authService?.logout?.();
          } catch {}
          router.replace("/login");
        }
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const pending = tasks.filter((task) => {
      const status = normalizeStatus(task.status);
      return status === "pending" || status === "todo" || status === "new";
    }).length;

    const inProgress = tasks.filter((task) => {
      const status = normalizeStatus(task.status);
      return (
        status === "in progress" ||
        status === "in_progress" ||
        status === "inprogress"
      );
    }).length;

    const completed = tasks.filter(
      (task) => normalizeStatus(task.status) === "completed"
    ).length;

    return { total, pending, inProgress, completed };
  }, [tasks]);

  const unreadNotifications = useMemo(() => {
    return notifications.filter((n) => !(n?.read || n?.isRead)).length;
  }, [notifications]);

  const conversationCount = conversations.length;

  const recentTasks = useMemo(() => {
    return [...tasks]
      .sort(
        (a, b) =>
          new Date(b?.updatedAt || b?.createdAt || b?.dueDate || 0) -
          new Date(a?.updatedAt || a?.createdAt || a?.dueDate || 0)
      )
      .slice(0, 5);
  }, [tasks]);

  const recentNotifications = useMemo(() => {
    return [...notifications]
      .sort(
        (a, b) =>
          new Date(b?.createdAt || b?.updatedAt || 0) -
          new Date(a?.createdAt || a?.updatedAt || 0)
      )
      .slice(0, 4);
  }, [notifications]);

  const userName =
    user?.name || user?.fullName || user?.email?.split("@")?.[0] || "User";

  return (
    <div className="relative min-h-screen w-full bg-[#f7f8fc] text-slate-900">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      {/* =================================================
          MOBILE OVERLAY
      ================================================= */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* =================================================
          SIDEBAR (Matching Admin Dark Theme & Animations)
      ================================================= */}
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
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/user" && pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold transition duration-150 ${
                    isActive
                      ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon
                    size={18}
                    className={`transition duration-150 ${
                      isActive ? "text-white" : "text-slate-400 group-hover:text-white"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={async () => {
              try {
                await authService.logout();
              } catch {}
              router.replace("/login");
              router.refresh();
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* =================================================
          MAIN AREA CONTENT
      ================================================= */}
      <div className="min-h-screen w-full lg:pl-64">
        {/* Top Header Bar */}
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
              <p className="text-sm font-bold text-slate-900">Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-violet-50 hover:text-violet-600 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin text-violet-600" : ""}
              />
            </button>

            <Link
              href="/user/notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-600 transition hover:bg-violet-100"
              title="Notifications"
            >
              <Bell size={17} />
              {unreadNotifications > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white shadow-sm">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
            </Link>

            <div className="hidden items-center gap-2.5 border-l border-slate-200 pl-3 sm:flex">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-sm">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={userName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  userName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="max-w-[150px]">
                <p className="truncate text-xs font-bold text-slate-900">
                  {userName}
                </p>
                <p className="text-[10px] font-semibold capitalize text-violet-600">
                  {user?.role || "user"}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl space-y-6">
            {/* Hero / Greeting section matching Admin style */}
            <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#4211b8] via-[#6414d8] to-[#a617c8] p-6 text-white shadow-[0_25px_70px_rgba(93,36,190,0.25)] sm:p-8">
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-2xl" />
              <div className="relative z-10">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md">
                  <Sparkles size={13} />
                  User Portal
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
                  Welcome back, {userName}
                </h1>
                <p className="mt-2 max-w-xl text-sm text-white/80">
                  Here is a quick overview of your assigned tasks, attendance, and workspace messages.
                </p>
              </div>
            </section>

            {error && (
              <section className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-rose-700 shadow-sm">
                <h2 className="text-sm font-bold">Notice</h2>
                <p className="mt-1 text-xs">{error}</p>
              </section>
            )}

            {/* Stat Cards */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={ClipboardList}
                label="Total Tasks"
                value={loading ? "—" : stats.total}
                description="Assigned tasks"
              />
              <StatCard
                icon={Clock3}
                label="Pending"
                value={loading ? "—" : stats.pending}
                description="Waiting to start"
              />
              <StatCard
                icon={Activity}
                label="In Progress"
                value={loading ? "—" : stats.inProgress}
                description="Active work items"
              />
              <StatCard
                icon={CheckCircle2}
                label="Completed"
                value={loading ? "—" : stats.completed}
                description="Finished successfully"
              />
            </section>

            {/* Summary Highlights */}
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SummaryCard
                icon={MessageSquare}
                title="Conversations"
                value={loading ? "—" : conversationCount}
                description="Active team channels."
                href="/user/messages"
              />
              <SummaryCard
                icon={Bell}
                title="Unread Notifications"
                value={loading ? "—" : unreadNotifications}
                description="Items requiring attention."
                href="/user/notifications"
              />
            </section>

            {/* Main Tables Grid */}
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {/* Recent Tasks */}
              <div className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4.5">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">My Tasks</h2>
                    <p className="text-xs text-slate-500">Recently updated tasks assigned to you.</p>
                  </div>
                  <Link href="/user/tasks" className="text-xs font-bold text-violet-600 transition hover:underline">
                    View All
                  </Link>
                </div>

                {recentTasks.length === 0 ? (
                  <EmptyTasks />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {recentTasks.map((task) => (
                      <TaskRow key={task?._id || task?.id} task={task} />
                    ))}
                  </div>
                )}
              </div>

              {/* Notifications */}
              <div className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4.5">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Recent Notifications</h2>
                    <p className="text-xs text-slate-500">Latest alerts from your workspace.</p>
                  </div>
                  <Link href="/user/notifications" className="text-xs font-bold text-violet-600 transition hover:underline">
                    View All
                  </Link>
                </div>

                {recentNotifications.length === 0 ? (
                  <EmptyNotifications />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {recentNotifications.map((notification) => (
                      <NotificationRow
                        key={notification?._id || notification?.id}
                        notification={notification}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Upcoming Deadlines */}
            <section className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]">
              <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4.5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Upcoming Deadlines</h2>
                    <p className="text-xs text-slate-500">Tasks with pending due dates.</p>
                  </div>
                  <CalendarDays size={20} className="text-violet-600" />
                </div>
              </div>
              <UpcomingTasks tasks={tasks} />
            </section>

            {/* Quick Access Grid */}
            <section>
              <h2 className="mb-4 text-base font-bold text-slate-900">Quick Access</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <QuickLink href="/user/tasks" icon={ClipboardList} title="My Tasks" description="View your assigned tasks." />
                <QuickLink href="/user/messages" icon={MessageSquare} title="Messages" description="View your conversations." />
                <QuickLink href="/user/notifications" icon={Bell} title="Notifications" description="View your notifications." />
                <QuickLink href="/user/attendance" icon={Clock3} title="Attendance" description="View work hours and records." />
              </div>
            </section>

          </div>
        </main>
      </div>
    </div>
  );
}

/* =========================================================
   SUB COMPONENTS (Themed)
========================================================= */

function StatCard({ icon: Icon, label, value, description }) {
  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(45,35,100,0.06)] transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <Icon size={19} />
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-400">{description}</p>
    </div>
  );
}

function SummaryCard({ icon: Icon, title, value, description, href }) {
  return (
    <Link
      href={href}
      className="group rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(45,35,100,0.06)] transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-400">{title}</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 transition group-hover:bg-violet-100">
          <Icon size={19} />
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-400">{description}</p>
    </Link>
  );
}

function TaskRow({ task }) {
  const title = task?.title || "Untitled Task";
  const status = task?.status || "Pending";
  const priority = task?.priority || "";
  const dueDate = task?.dueDate;

  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
        <ClipboardList size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-900">{title}</p>
        <div className="mt-1 flex items-center gap-2">
          <StatusBadge status={status} />
          {priority && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
              {priority}
            </span>
          )}
        </div>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-[10px] font-semibold uppercase text-slate-400">Due</p>
        <p className="mt-0.5 text-xs font-semibold text-slate-700">{formatDate(dueDate) || "No date"}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = normalizeStatus(status);
  let classes = "bg-slate-100 text-slate-600 border border-slate-200";

  if (normalized === "completed") {
    classes = "bg-emerald-50 text-emerald-600 border border-emerald-100";
  } else if (["in progress", "in_progress", "inprogress"].includes(normalized)) {
    classes = "bg-violet-50 text-violet-600 border border-violet-100";
  } else if (["pending", "todo", "new"].includes(normalized)) {
    classes = "bg-amber-50 text-amber-600 border border-amber-100";
  }

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${classes}`}>
      {status}
    </span>
  );
}

function NotificationRow({ notification }) {
  const read = notification?.read || notification?.isRead;

  return (
    <Link
      href="/user/notifications"
      className={`block px-6 py-4 transition hover:bg-slate-50 ${!read ? "bg-violet-50/30" : ""}`}
    >
      <div className="flex gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
          read ? "bg-slate-100 text-slate-500" : "bg-gradient-to-br from-pink-500 to-fuchsia-500 text-white"
        }`}>
          <Bell size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className={`truncate text-xs ${read ? "font-semibold text-slate-700" : "font-bold text-slate-900"}`}>
              {notification?.title || "Notification"}
            </p>
            {!read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet-600" />}
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
            {notification?.message || "You have a new notification."}
          </p>
          <p className="mt-2 text-[10px] text-slate-400">
            {formatDateTime(notification?.createdAt || notification?.updatedAt)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function UpcomingTasks({ tasks }) {
  const upcoming = useMemo(() => {
    const now = new Date();
    return tasks
      .filter((task) => {
        if (!task?.dueDate) return false;
        const due = new Date(task.dueDate);
        if (Number.isNaN(due.getTime())) return false;
        return due >= now && normalizeStatus(task?.status) !== "completed";
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 5);
  }, [tasks]);

  if (upcoming.length === 0) {
    return (
      <div className="flex min-h-[160px] flex-col items-center justify-center px-6 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <CalendarDays size={20} />
        </div>
        <h3 className="mt-3 text-xs font-bold text-slate-800">Nothing scheduled</h3>
        <p className="mt-1 text-xs text-slate-400">No upcoming task deadlines assigned.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {upcoming.map((task) => (
        <div key={task?._id || task?.id} className="flex items-center gap-4 px-6 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <Clock3 size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">
              {task?.title || "Untitled Task"}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Due {formatDate(task?.dueDate)}
            </p>
          </div>
          <StatusBadge status={task?.status || "Pending"} />
        </div>
      ))}
    </div>
  );
}

function QuickLink({ href, icon: Icon, title, description }) {
  return (
    <Link
      href={href}
      className="group rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(45,35,100,0.06)] transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 transition group-hover:bg-violet-600 group-hover:text-white">
        <Icon size={19} />
      </div>
      <h3 className="mt-4 text-sm font-bold text-slate-900">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
    </Link>
  );
}

function EmptyTasks() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
        <ClipboardList size={22} />
      </div>
      <h3 className="mt-3 text-xs font-bold text-slate-800">No tasks available</h3>
      <p className="mt-1 text-xs text-slate-400">There are currently no tasks assigned to your account.</p>
    </div>
  );
}

function EmptyNotifications() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
        <Bell size={22} />
      </div>
      <h3 className="mt-3 text-xs font-bold text-slate-800">You're all caught up</h3>
      <p className="mt-1 text-xs text-slate-400">No pending notifications at the moment.</p>
    </div>
  );
}

/* =========================================================
   UTILS & NORMALIZERS
========================================================= */

async function safeApiRequest(endpoint, fallback = null) {
  try {
    let token = null;
    try {
      if (typeof authService.getToken === "function") {
        token = authService.getToken();
      }
    } catch {}

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
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

function extractUser(response) {
  return response?.user || response?.data?.user || response?.data || response || null;
}

function normalizeTasks(response) {
  const possible =
    response?.tasks ||
    response?.data?.tasks ||
    response?.results ||
    response?.data?.results ||
    response?.items ||
    response?.data ||
    [];
  return Array.isArray(possible) ? possible : [];
}

function normalizeConversations(response) {
  const possible =
    response?.conversations ||
    response?.data?.conversations ||
    response?.results ||
    response?.data?.results ||
    response?.items ||
    response?.data ||
    [];
  return Array.isArray(possible) ? possible : [];
}

function normalizeNotifications(response) {
  const possible =
    response?.notifications ||
    response?.data?.notifications ||
    response?.results ||
    response?.data?.results ||
    response?.items ||
    response?.data ||
    [];
  return Array.isArray(possible) ? possible : [];
}

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function formatDate(date) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(date) {
  if (!date) return "Recently";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Recently";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}