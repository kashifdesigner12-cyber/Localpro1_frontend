"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  UserRound,
  X,
} from "lucide-react";

import { authService } from "@/services/authService";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api";

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
   USER DASHBOARD
========================================================= */

export default function UserDashboardPage() {
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [user, setUser] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [conversations, setConversations] =
    useState([]);
  const [notifications, setNotifications] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  /* =======================================================
     LOAD DASHBOARD
  ======================================================= */

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        /* -----------------------------------------------
           AUTH
        ------------------------------------------------ */

        const meResponse =
          await authService.me();

        const currentUser =
          extractUser(meResponse);

        if (!currentUser) {
          router.replace("/login");
          return;
        }

        const role = String(
          currentUser?.role || ""
        )
          .trim()
          .toLowerCase();

        if (role !== "user") {
          if (role === "admin") {
            router.replace("/admin");
          } else if (role === "manager") {
            router.replace("/manager");
          } else {
            router.replace("/login");
          }

          return;
        }

        setUser(currentUser);

        /* -----------------------------------------------
           LIVE BACKEND DATA
        ------------------------------------------------ */

        const [
          tasksResponse,
          conversationsResponse,
          notificationsResponse,
        ] = await Promise.all([
          apiRequest("/tasks/my", {
            method: "GET",
          }),

          apiRequest("/conversations", {
            method: "GET",
          }),

          apiRequest("/notifications", {
            method: "GET",
          }),
        ]);

        setTasks(
          normalizeTasks(tasksResponse)
        );

        setConversations(
          normalizeConversations(
            conversationsResponse
          )
        );

        setNotifications(
          normalizeNotifications(
            notificationsResponse
          )
        );
      } catch (err) {
        console.error(
          "User dashboard load error:",
          err
        );

        if (err?.status === 401) {
          router.replace("/login");
          return;
        }

        setError(
          err?.message ||
            "Unable to load dashboard data."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  /* =======================================================
     STATS
  ======================================================= */

  const stats = useMemo(() => {
    const total = tasks.length;

    const pending = tasks.filter(
      (task) => {
        const status =
          normalizeStatus(task.status);

        return (
          status === "pending" ||
          status === "todo" ||
          status === "new"
        );
      }
    ).length;

    const inProgress = tasks.filter(
      (task) => {
        const status =
          normalizeStatus(task.status);

        return (
          status === "in progress" ||
          status === "in_progress" ||
          status === "inprogress"
        );
      }
    ).length;

    const completed = tasks.filter(
      (task) =>
        normalizeStatus(task.status) ===
        "completed"
    ).length;

    return {
      total,
      pending,
      inProgress,
      completed,
    };
  }, [tasks]);

  /* =======================================================
     UNREAD NOTIFICATIONS
  ======================================================= */

  const unreadNotifications =
    useMemo(() => {
      return notifications.filter(
        (notification) => {
          return !(
            notification?.read ||
            notification?.isRead
          );
        }
      ).length;
    }, [notifications]);

  /* =======================================================
     CONVERSATION COUNT
  ======================================================= */

  const conversationCount =
    conversations.length;

  /* =======================================================
     RECENT TASKS
  ======================================================= */

  const recentTasks = useMemo(() => {
    return [...tasks]
      .sort((a, b) => {
        const dateA =
          new Date(
            a?.updatedAt ||
              a?.createdAt ||
              a?.dueDate ||
              0
          ).getTime();

        const dateB =
          new Date(
            b?.updatedAt ||
              b?.createdAt ||
              b?.dueDate ||
              0
          ).getTime();

        return dateB - dateA;
      })
      .slice(0, 5);
  }, [tasks]);

  /* =======================================================
     RECENT NOTIFICATIONS
  ======================================================= */

  const recentNotifications =
    useMemo(() => {
      return [...notifications]
        .sort((a, b) => {
          const dateA =
            new Date(
              a?.createdAt ||
                a?.updatedAt ||
                0
            ).getTime();

          const dateB =
            new Date(
              b?.createdAt ||
                b?.updatedAt ||
                0
            ).getTime();

          return dateB - dateA;
        })
        .slice(0, 4);
    }, [notifications]);

  /* =======================================================
     USER NAME
  ======================================================= */

  const userName =
    user?.name ||
    user?.fullName ||
    user?.displayName ||
    user?.email ||
    "User";

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

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
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#171B3A] shadow-xl transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >

        {/* =================================================
            SIDEBAR HEADER
        ================================================= */}

        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-5">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-sm">
              <ShieldCheck size={22} />
            </div>

            <div>
              <h1 className="text-sm font-bold text-white">
                Local Pro 1
              </h1>

              <p className="text-[11px] font-medium text-white/70">
                User Workspace
              </p>
            </div>

          </div>

          <button
            type="button"
            onClick={() =>
              setSidebarOpen(false)
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>

        </div>

        {/* =================================================
            NAVIGATION
        ================================================= */}

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">

          {navigation.map((item) => (
            <UserNavItem
              key={item.href}
              item={item}
              onNavigate={() =>
                setSidebarOpen(false)
              }
            />
          ))}

        </nav>

        {/* =================================================
            LOGOUT
        ================================================= */}

        <div className="shrink-0 border-t border-white/10 p-4">

          <button
            type="button"
            onClick={async () => {
              try {
                await authService.logout();
              } catch (logoutError) {
                console.error(
                  "Logout error:",
                  logoutError
                );
              } finally {
                router.replace("/login");
              }
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <LogOut size={18} />

            <span className="text-white">
              Logout
            </span>
          </button>

        </div>

      </aside>

      {/* =================================================
          MAIN AREA
      ================================================= */}

      <div className="lg:pl-64">

        {/* =================================================
            TOP BAR
        ================================================= */}

        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-6 lg:px-8">

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
                Dashboard
              </p>
            </div>

          </div>

          <div className="flex items-center gap-3">

            {/* Refresh */}

            <button
              type="button"
              onClick={() =>
                loadDashboard(true)
              }
              disabled={
                loading || refreshing
              }
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-[#64748B] transition hover:bg-[#EEF4FF] hover:text-[#2563EB] disabled:cursor-not-allowed"
              aria-label="Refresh dashboard"
            >
              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />
            </button>

            {/* Notifications */}

            <Link
              href="/user/notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#EEF4FF] text-[#2563EB] transition hover:bg-blue-100"
              aria-label="Notifications"
            >
              <Bell size={17} />

              {unreadNotifications > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2563EB] px-1 text-[9px] font-bold text-white">
                  {unreadNotifications > 99
                    ? "99+"
                    : unreadNotifications}
                </span>
              )}
            </Link>

            {/* User */}

            <div className="hidden items-center gap-2 sm:flex">

              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#EEF4FF] text-[#2563EB]">

                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={userName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserRound size={17} />
                )}

              </div>

              <div className="max-w-[150px]">

                <p className="truncate text-xs font-bold text-[#171B3A]">
                  {userName}
                </p>

                <p className="text-[10px] capitalize text-[#64748B]">
                  {user?.role || "user"}
                </p>

              </div>

            </div>

          </div>

        </header>

        {/* =================================================
            PAGE CONTENT
        ================================================= */}

        <main className="min-h-[calc(100vh-4rem)] p-5 sm:p-6 lg:p-8">

          <div className="mx-auto w-full max-w-7xl space-y-6">

            {/* =================================================
                HEADING
            ================================================= */}

            <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

              <div>

                <p className="text-sm font-semibold text-[#2563EB]">
                  USER WORKSPACE
                </p>

                <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
                  Welcome, {userName}
                </h1>

                <p className="mt-2 text-sm text-[#64748B]">
                  Your live workspace overview.
                </p>

              </div>

              {loading && (
                <div className="flex items-center gap-2 text-xs font-medium text-[#64748B]">

                  <Loader2
                    size={15}
                    className="animate-spin text-[#2563EB]"
                  />

                  Loading backend data...

                </div>
              )}

            </section>

            {/* =================================================
                ERROR
            ================================================= */}

            {error && (
              <section className="rounded-2xl border border-red-200 bg-red-50 p-4">

                <div className="flex items-start justify-between gap-4">

                  <div>

                    <h2 className="text-sm font-bold text-red-700">
                      Unable to load dashboard
                    </h2>

                    <p className="mt-1 text-sm text-red-600">
                      {error}
                    </p>

                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      loadDashboard(true)
                    }
                    className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-bold text-red-700 shadow-sm transition hover:bg-red-100"
                  >
                    Retry
                  </button>

                </div>

              </section>
            )}

            {/* =================================================
                STATS
            ================================================= */}

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

              <StatCard
                icon={ClipboardList}
                label="Total Tasks"
                value={
                  loading
                    ? "—"
                    : stats.total
                }
                description="Tasks assigned to your account."
              />

              <StatCard
                icon={Clock3}
                label="Pending"
                value={
                  loading
                    ? "—"
                    : stats.pending
                }
                description="Tasks waiting to be started."
              />

              <StatCard
                icon={Activity}
                label="In Progress"
                value={
                  loading
                    ? "—"
                    : stats.inProgress
                }
                description="Tasks currently being worked on."
              />

              <StatCard
                icon={CheckCircle2}
                label="Completed"
                value={
                  loading
                    ? "—"
                    : stats.completed
                }
                description="Tasks completed by you."
              />

            </section>

            {/* =================================================
                WORKSPACE SUMMARY
            ================================================= */}

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">

              <SummaryCard
                icon={MessageSquare}
                title="Conversations"
                value={
                  loading
                    ? "—"
                    : conversationCount
                }
                description="Your available conversations."
                href="/user/messages"
              />

              <SummaryCard
                icon={Bell}
                title="Unread Notifications"
                value={
                  loading
                    ? "—"
                    : unreadNotifications
                }
                description="Notifications that still need your attention."
                href="/user/notifications"
              />

            </section>

            {/* =================================================
                MAIN GRID
            ================================================= */}

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">

              {/* MY TASKS */}

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">

                  <div>

                    <h2 className="text-base font-bold text-[#171B3A]">
                      My Tasks
                    </h2>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Tasks assigned to your account.
                    </p>

                  </div>

                  <Link
                    href="/user/tasks"
                    className="text-xs font-bold text-[#2563EB] transition hover:underline"
                  >
                    View All
                  </Link>

                </div>

                {loading ? (
                  <TaskListLoading />
                ) : recentTasks.length === 0 ? (
                  <EmptyTasks />
                ) : (
                  <div className="divide-y divide-slate-100">

                    {recentTasks.map(
                      (task) => (
                        <TaskRow
                          key={
                            task?._id ||
                            task?.id
                          }
                          task={task}
                        />
                      )
                    )}

                  </div>
                )}

              </section>

              {/* NOTIFICATIONS */}

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">

                  <div>

                    <h2 className="text-base font-bold text-[#171B3A]">
                      Recent Notifications
                    </h2>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Latest updates from your workspace.
                    </p>

                  </div>

                  <Link
                    href="/user/notifications"
                    className="text-xs font-bold text-[#2563EB] transition hover:underline"
                  >
                    View All
                  </Link>

                </div>

                {loading ? (
                  <NotificationLoading />
                ) : recentNotifications.length ===
                  0 ? (
                  <EmptyNotifications />
                ) : (
                  <div className="divide-y divide-slate-100">

                    {recentNotifications.map(
                      (notification) => (
                        <NotificationRow
                          key={
                            notification?._id ||
                            notification?.id
                          }
                          notification={
                            notification
                          }
                        />
                      )
                    )}

                  </div>
                )}

              </section>

            </section>

            {/* =================================================
                UPCOMING
            ================================================= */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

              <div className="border-b border-slate-100 px-5 py-5 sm:px-6">

                <div className="flex items-center justify-between gap-4">

                  <div>

                    <h2 className="text-base font-bold text-[#171B3A]">
                      Upcoming Deadlines
                    </h2>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Tasks with upcoming due dates.
                    </p>

                  </div>

                  <CalendarDays
                    size={20}
                    className="text-[#2563EB]"
                  />

                </div>

              </div>

              <UpcomingTasks tasks={tasks} />

            </section>

            {/* =================================================
                QUICK ACCESS
            ================================================= */}

            <section>

              <h2 className="mb-4 text-base font-bold text-[#171B3A]">
                Quick Access
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

                <QuickLink
                  href="/user/tasks"
                  icon={ClipboardList}
                  title="My Tasks"
                  description="View your assigned tasks."
                />

                <QuickLink
                  href="/user/messages"
                  icon={MessageSquare}
                  title="Messages"
                  description="View your conversations."
                />

                <QuickLink
                  href="/user/notifications"
                  icon={Bell}
                  title="Notifications"
                  description="View your notifications."
                />

                <QuickLink
                  href="/user/attendance"
                  icon={Clock3}
                  title="Attendance"
                  description="View your attendance and work hours."
                />

              </div>

            </section>

          </div>

        </main>

      </div>

    </div>
  );
}

/* =========================================================
   SIDEBAR ITEM
========================================================= */

function UserNavItem({
  item,
  onNavigate,
}) {
  const pathname = usePathname();

  const Icon = item.icon;

  const isActive =
    pathname === item.href ||
    (
      item.href !== "/user" &&
      pathname.startsWith(
        `${item.href}/`
      )
    );

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
        isActive
          ? "bg-[#2563EB] text-white shadow-sm"
          : "bg-transparent text-white hover:bg-white/10 hover:text-white"
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
   STAT CARD
========================================================= */

function StatCard({
  icon: Icon,
  label,
  value,
  description,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">

      <div className="flex items-start justify-between gap-4">

        <div>

          <p className="text-xs font-semibold text-[#64748B]">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold text-[#171B3A]">
            {value}
          </p>

        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">

          <Icon size={19} />

        </div>

      </div>

      <p className="mt-4 text-xs text-[#64748B]">
        {description}
      </p>

    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  icon: Icon,
  title,
  value,
  description,
  href,
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >

      <div className="flex items-start justify-between gap-4">

        <div>

          <p className="text-xs font-semibold text-[#64748B]">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-[#171B3A]">
            {value}
          </p>

        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB] transition group-hover:bg-blue-100">

          <Icon size={19} />

        </div>

      </div>

      <p className="mt-4 text-xs text-[#64748B]">
        {description}
      </p>

    </Link>
  );
}

/* =========================================================
   TASK ROW
========================================================= */

function TaskRow({ task }) {
  const title =
    task?.title ||
    "Untitled Task";

  const status =
    task?.status ||
    "Pending";

  const priority =
    task?.priority ||
    "";

  const dueDate =
    task?.dueDate;

  return (
    <div className="flex items-center gap-4 px-5 py-4 sm:px-6">

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
        <ClipboardList size={18} />
      </div>

      <div className="min-w-0 flex-1">

        <p className="truncate text-sm font-semibold text-[#171B3A]">
          {title}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-2">

          <StatusBadge
            status={status}
          />

          {priority && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold capitalize text-slate-600">
              {priority}
            </span>
          )}

        </div>

      </div>

      <div className="hidden shrink-0 text-right sm:block">

        <p className="text-[10px] font-semibold uppercase text-slate-400">
          Due
        </p>

        <p className="mt-1 text-xs font-semibold text-[#26344D]">
          {formatDate(dueDate) ||
            "No date"}
        </p>

      </div>

    </div>
  );
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({ status }) {
  const normalized =
    normalizeStatus(status);

  let classes =
    "bg-slate-100 text-slate-600";

  if (
    normalized === "completed"
  ) {
    classes =
      "bg-emerald-50 text-emerald-700";
  } else if (
    normalized === "in progress" ||
    normalized === "in_progress" ||
    normalized === "inprogress"
  ) {
    classes =
      "bg-blue-50 text-blue-700";
  } else if (
    normalized === "pending" ||
    normalized === "todo" ||
    normalized === "new"
  ) {
    classes =
      "bg-amber-50 text-amber-700";
  }

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${classes}`}
    >
      {status}
    </span>
  );
}

/* =========================================================
   NOTIFICATION ROW
========================================================= */

function NotificationRow({
  notification,
}) {
  const read =
    notification?.read ||
    notification?.isRead;

  return (
    <Link
      href="/user/notifications"
      className={`block px-5 py-4 transition hover:bg-slate-50 sm:px-6 ${
        !read
          ? "bg-[#F8FAFF]"
          : ""
      }`}
    >

      <div className="flex gap-3">

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
          <Bell size={16} />
        </div>

        <div className="min-w-0 flex-1">

          <div className="flex items-start justify-between gap-3">

            <p
              className={`truncate text-sm ${
                read
                  ? "font-semibold text-[#26344D]"
                  : "font-bold text-[#171B3A]"
              }`}
            >
              {notification?.title ||
                "Notification"}
            </p>

            {!read && (
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#2563EB]" />
            )}

          </div>

          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#64748B]">
            {notification?.message ||
              "You have a new notification."}
          </p>

          <p className="mt-2 text-[10px] text-slate-400">
            {formatDateTime(
              notification?.createdAt ||
                notification?.updatedAt
            )}
          </p>

        </div>

      </div>

    </Link>
  );
}

/* =========================================================
   UPCOMING TASKS
========================================================= */

function UpcomingTasks({ tasks }) {
  const upcoming = useMemo(() => {
    const now = new Date();

    return tasks
      .filter((task) => {
        if (!task?.dueDate) {
          return false;
        }

        const due =
          new Date(task.dueDate);

        if (
          Number.isNaN(
            due.getTime()
          )
        ) {
          return false;
        }

        return (
          due >= now &&
          normalizeStatus(
            task?.status
          ) !== "completed"
        );
      })
      .sort(
        (a, b) =>
          new Date(a.dueDate) -
          new Date(b.dueDate)
      )
      .slice(0, 5);
  }, [tasks]);

  if (upcoming.length === 0) {
    return (
      <div className="flex min-h-[180px] flex-col items-center justify-center px-6 py-10 text-center">

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
          <CalendarDays size={22} />
        </div>

        <h3 className="mt-4 text-sm font-bold text-[#171B3A]">
          Nothing scheduled
        </h3>

        <p className="mt-2 max-w-sm text-sm text-[#64748B]">
          No upcoming task deadlines were returned by the backend.
        </p>

      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">

      {upcoming.map((task) => (
        <div
          key={
            task?._id ||
            task?.id
          }
          className="flex items-center gap-4 px-5 py-4 sm:px-6"
        >

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
            <Clock3 size={18} />
          </div>

          <div className="min-w-0 flex-1">

            <p className="truncate text-sm font-semibold text-[#171B3A]">
              {task?.title ||
                "Untitled Task"}
            </p>

            <p className="mt-1 text-xs text-[#64748B]">
              Due{" "}
              {formatDate(
                task?.dueDate
              )}
            </p>

          </div>

          <StatusBadge
            status={
              task?.status ||
              "Pending"
            }
          />

        </div>
      ))}

    </div>
  );
}

/* =========================================================
   QUICK LINK
========================================================= */

function QuickLink({
  href,
  icon: Icon,
  title,
  description,
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >

      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB] transition group-hover:bg-blue-100">
        <Icon size={19} />
      </div>

      <h3 className="mt-4 text-sm font-bold text-[#171B3A]">
        {title}
      </h3>

      <p className="mt-1 text-xs leading-5 text-[#64748B]">
        {description}
      </p>

    </Link>
  );
}

/* =========================================================
   EMPTY TASKS
========================================================= */

function EmptyTasks() {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-10 text-center">

      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
        <ClipboardList size={25} />
      </div>

      <h3 className="mt-4 text-sm font-bold text-[#171B3A]">
        No tasks available
      </h3>

      <p className="mt-2 max-w-sm text-sm leading-6 text-[#64748B]">
        No tasks are currently assigned to your account.
      </p>

      <Link
        href="/user/tasks"
        className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-xs font-bold text-[#2563EB] transition hover:bg-[#EEF4FF]"
      >
        Open My Tasks
      </Link>

    </div>
  );
}

/* =========================================================
   EMPTY NOTIFICATIONS
========================================================= */

function EmptyNotifications() {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-10 text-center">

      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
        <Bell size={25} />
      </div>

      <h3 className="mt-4 text-sm font-bold text-[#171B3A]">
        You're all caught up
      </h3>

      <p className="mt-2 max-w-sm text-sm leading-6 text-[#64748B]">
        No notifications were returned by the backend.
      </p>

      <Link
        href="/user/notifications"
        className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-xs font-bold text-[#2563EB] transition hover:bg-[#EEF4FF]"
      >
        Open Notifications
      </Link>

    </div>
  );
}

/* =========================================================
   TASK LOADING
========================================================= */

function TaskListLoading() {
  return (
    <div className="space-y-4 p-5 sm:p-6">

      {[1, 2, 3, 4].map(
        (item) => (
          <div
            key={item}
            className="flex items-center gap-4"
          >

            <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />

            <div className="min-w-0 flex-1">

              <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />

              <div className="mt-2 h-2.5 w-1/3 animate-pulse rounded bg-slate-100" />

            </div>

          </div>
        )
      )}

    </div>
  );
}

/* =========================================================
   NOTIFICATION LOADING
========================================================= */

function NotificationLoading() {
  return (
    <div className="space-y-5 p-5 sm:p-6">

      {[1, 2, 3, 4].map(
        (item) => (
          <div
            key={item}
            className="flex gap-3"
          >

            <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />

            <div className="flex-1">

              <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />

              <div className="mt-2 h-2.5 w-full animate-pulse rounded bg-slate-100" />

              <div className="mt-2 h-2.5 w-1/3 animate-pulse rounded bg-slate-100" />

            </div>

          </div>
        )
      )}

    </div>
  );
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
    const error =
      new Error(
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

/* =========================================================
   USER NORMALIZER
========================================================= */

function extractUser(response) {
  return (
    response?.user ||
    response?.data?.user ||
    response?.data ||
    response ||
    null
  );
}

/* =========================================================
   TASK NORMALIZER
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
   CONVERSATION NORMALIZER
========================================================= */

function normalizeConversations(
  response
) {
  const possible =
    response?.conversations ||
    response?.data?.conversations ||
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
   NOTIFICATION NORMALIZER
========================================================= */

function normalizeNotifications(
  response
) {
  const possible =
    response?.notifications ||
    response?.data?.notifications ||
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
   STATUS NORMALIZER
========================================================= */

function normalizeStatus(
  status
) {
  return String(
    status || ""
  )
    .trim()
    .toLowerCase();
}

/* =========================================================
   DATE
========================================================= */

function formatDate(date) {
  if (!date) {
    return "";
  }

  const parsed =
    new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "";
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

/* =========================================================
   DATE + TIME
========================================================= */

function formatDateTime(
  date
) {
  if (!date) {
    return "Recently";
  }

  const parsed =
    new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "Recently";
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