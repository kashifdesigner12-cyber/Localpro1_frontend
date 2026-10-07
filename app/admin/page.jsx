"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";

/* =========================================================
   API CONFIG
========================================================= */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.localpro1.net/api";

/* =========================================================
   HELPERS
========================================================= */

const getAuthToken = () => {
  if (typeof window === "undefined") return null;

  return (
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("authToken")
  );
};

const safeFetchJson = async (endpoint, fallback) => {
  try {
    const token = getAuthToken();

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      return fallback;
    }

    const data = await response.json();

    if (data?.success === false) {
      return fallback;
    }

    return data;
  } catch (error) {
    console.error(`Dashboard API error: ${endpoint}`, error);
    return fallback;
  }
};

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  trend,
  trendUp,
  href,
}) {
  const content = (
    <div className="group relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(15,23,42,0.10)]">
      <div
        className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} opacity-[0.08] blur-2xl`}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <div className="mt-2 flex items-end gap-2">
            <h3 className="text-3xl font-bold tracking-tight text-slate-900">
              {value}
            </h3>
          </div>

          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>

          {trend && (
            <div
              className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                trendUp
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {trendUp && <TrendingUp className="h-3 w-3" />}
              {trend}
            </div>
          )}
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

/* =========================================================
   DASHBOARD PAGE
========================================================= */

export default function DashboardPage() {
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* =======================================================
     LOAD DASHBOARD
  ======================================================= */

  const loadDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [usersResponse, tasksResponse] = await Promise.all([
        safeFetchJson("/users", []),
        safeFetchJson("/tasks?limit=100", []),
      ]);

      const usersData =
        usersResponse?.users ||
        usersResponse?.data ||
        (Array.isArray(usersResponse) ? usersResponse : []);

      const tasksData =
        tasksResponse?.tasks ||
        tasksResponse?.data ||
        (Array.isArray(tasksResponse) ? tasksResponse : []);

      setUsers(Array.isArray(usersData) ? usersData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (err) {
      console.error("Dashboard loading error:", err);
      setError("Unable to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  /* =======================================================
     DASHBOARD STATS
  ======================================================= */

  const dashboardStats = useMemo(() => {
    const totalUsers = users.length;

    const activeUsers = users.filter((user) => {
      const status = String(user?.status || "").toLowerCase();
      return status === "active";
    }).length;

    const totalTasks = tasks.length;

    const completedTasks = tasks.filter((task) => {
      const status = String(task?.status || "").toLowerCase();

      return (
        status === "completed" ||
        status === "complete" ||
        status === "done"
      );
    }).length;

    const taskCompletion =
      totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;

    return {
      totalUsers,
      activeUsers,
      totalTasks,
      completedTasks,
      taskCompletion,
    };
  }, [users, tasks]);

  /* =======================================================
     RECENT USERS
  ======================================================= */

  const recentUsers = useMemo(() => {
    return [...users]
      .sort((a, b) => {
        const dateA = new Date(
          a?.createdAt || a?.updatedAt || 0
        ).getTime();

        const dateB = new Date(
          b?.createdAt || b?.updatedAt || 0
        ).getTime();

        return dateB - dateA;
      })
      .slice(0, 5);
  }, [users]);

  /* =======================================================
     RECENT TASKS
  ======================================================= */

  const recentTasks = useMemo(() => {
    return [...tasks]
      .sort((a, b) => {
        const dateA = new Date(
          a?.createdAt || a?.updatedAt || 0
        ).getTime();

        const dateB = new Date(
          b?.createdAt || b?.updatedAt || 0
        ).getTime();

        return dateB - dateA;
      })
      .slice(0, 5);
  }, [tasks]);

  /* =======================================================
     FORMAT DATE
  ======================================================= */

  const formatDate = (date) => {
    if (!date) return "—";

    try {
      return new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  /* =======================================================
     USER NAME
  ======================================================= */

  const getUserName = (user) => {
    return (
      user?.name ||
      user?.fullName ||
      `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
      user?.email ||
      "Unknown User"
    );
  };

  /* =======================================================
     TASK STATUS
  ======================================================= */

  const getTaskStatus = (task) => {
    const status = String(task?.status || "pending").toLowerCase();

    if (
      status === "completed" ||
      status === "complete" ||
      status === "done"
    ) {
      return {
        label: "Completed",
        className: "bg-emerald-50 text-emerald-600",
        icon: CheckCircle2,
      };
    }

    if (
      status === "cancelled" ||
      status === "canceled" ||
      status === "blocked"
    ) {
      return {
        label: status === "blocked" ? "Blocked" : "Cancelled",
        className: "bg-red-50 text-red-600",
        icon: XCircle,
      };
    }

    if (
      status === "in-progress" ||
      status === "in progress" ||
      status === "ongoing"
    ) {
      return {
        label: "In Progress",
        className: "bg-blue-50 text-blue-600",
        icon: Activity,
      };
    }

    return {
      label: "Pending",
      className: "bg-amber-50 text-amber-600",
      icon: Clock3,
    };
  };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
          </div>

          <p className="text-sm font-medium text-slate-500">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <div className="space-y-6 pb-8">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <ShieldCheck className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                Admin Panel
              </p>

              <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Welcome back, Local Pro1
              </h1>
            </div>
          </div>

          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Here&apos;s what&apos;s happening with your system today.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadDashboard(true)}
          disabled={refreshing}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          <XCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* =====================================================
          STATS
      ===================================================== */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Users"
          value={dashboardStats.totalUsers}
          subtitle="Registered users"
          icon={Users}
          gradient="from-blue-500 to-cyan-500"
          trend={`${dashboardStats.activeUsers} active`}
          trendUp={dashboardStats.activeUsers > 0}
          href="/admin/users"
        />

        <StatCard
          title="Active Users"
          value={dashboardStats.activeUsers}
          subtitle="Currently active"
          icon={UserCheck}
          gradient="from-emerald-500 to-teal-500"
          trend={
            dashboardStats.totalUsers > 0
              ? `${Math.round(
                  (dashboardStats.activeUsers /
                    dashboardStats.totalUsers) *
                    100
                )}% of users`
              : "0% of users"
          }
          trendUp={dashboardStats.activeUsers > 0}
          href="/admin/users"
        />

        <StatCard
          title="Total Tasks"
          value={dashboardStats.totalTasks}
          subtitle="All assigned tasks"
          icon={ClipboardList}
          gradient="from-violet-500 to-purple-500"
          trend={`${dashboardStats.completedTasks} completed`}
          trendUp={dashboardStats.completedTasks > 0}
          href="/admin/tasks"
        />

        <StatCard
          title="Task Completion"
          value={`${dashboardStats.taskCompletion}%`}
          subtitle="Overall completion rate"
          icon={CheckCircle2}
          gradient="from-orange-500 to-amber-500"
          trend={
            dashboardStats.taskCompletion >= 50
              ? "Good progress"
              : "Needs attention"
          }
          trendUp={dashboardStats.taskCompletion >= 50}
          href="/admin/tasks"
        />
      </div>

      {/* =====================================================
          RECENT USERS + RECENT TASKS
      ===================================================== */}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* ===================================================
            RECENT USERS
        =================================================== */}

        <div className="w-full min-w-0 rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Recent Users
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Latest users added to the system
              </p>
            </div>

            <Link
              href="/admin/users"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
            >
              View All
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {recentUsers.length > 0 ? (
              recentUsers.map((user, index) => {
                const status = String(
                  user?.status || "active"
                ).toLowerCase();

                const isActive = status === "active";

                return (
                  <div
                    key={user?.id || user?._id || index}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 transition hover:border-blue-100 hover:bg-blue-50/40"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-100 text-blue-600">
                      {user?.avatar || user?.profileImage ? (
                        <img
                          src={user.avatar || user.profileImage}
                          alt={getUserName(user)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserRound className="h-5 w-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {getUserName(user)}
                      </p>

                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {user?.email || "No email available"}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${
                          isActive
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {user?.status || "Active"}
                      </span>

                      <p className="mt-1 text-[10px] text-slate-400">
                        {formatDate(user?.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                <Users className="h-8 w-8 text-slate-300" />

                <p className="mt-2 text-sm font-medium text-slate-500">
                  No users found
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  New users will appear here.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ===================================================
            RECENT TASKS
        =================================================== */}

        <div className="w-full min-w-0 rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Recent Tasks
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Latest tasks and their current status
              </p>
            </div>

            <Link
              href="/admin/tasks"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
            >
              View All
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {recentTasks.length > 0 ? (
              recentTasks.map((task, index) => {
                const taskStatus = getTaskStatus(task);
                const StatusIcon = taskStatus.icon;

                return (
                  <div
                    key={task?.id || task?._id || index}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 transition hover:border-violet-100 hover:bg-violet-50/30"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                      <ClipboardList className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {task?.title ||
                          task?.name ||
                          task?.taskName ||
                          "Untitled Task"}
                      </p>

                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {formatDate(task?.createdAt)}
                        </span>

                        {task?.assignedTo?.name && (
                          <>
                            <span>•</span>
                            <span className="truncate">
                              {task.assignedTo.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${taskStatus.className}`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {taskStatus.label}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                <ClipboardList className="h-8 w-8 text-slate-300" />

                <p className="mt-2 text-sm font-medium text-slate-500">
                  No tasks found
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  New tasks will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================
          QUICK ACTIONS
      ===================================================== */}

      <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Quick Actions
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Quickly access the most commonly used sections.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/admin/users"
            className="group rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:-translate-y-0.5 hover:border-blue-100 hover:bg-blue-50/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
              <Users className="h-5 w-5" />
            </div>

            <p className="mt-3 text-sm font-semibold text-slate-800">
              Manage Users
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Add and manage users
            </p>
          </Link>

          <Link
            href="/admin/tasks"
            className="group rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:-translate-y-0.5 hover:border-violet-100 hover:bg-violet-50/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600 transition group-hover:bg-violet-600 group-hover:text-white">
              <ClipboardList className="h-5 w-5" />
            </div>

            <p className="mt-3 text-sm font-semibold text-slate-800">
              Manage Tasks
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Create and track tasks
            </p>
          </Link>

          <Link
            href="/admin/appointments"
            className="group rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:-translate-y-0.5 hover:border-emerald-100 hover:bg-emerald-50/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 transition group-hover:bg-emerald-600 group-hover:text-white">
              <CalendarDays className="h-5 w-5" />
            </div>

            <p className="mt-3 text-sm font-semibold text-slate-800">
              Appointments
            </p>

            <p className="mt-1 text-xs text-slate-500">
              View scheduled appointments
            </p>
          </Link>

          <Link
            href="/admin/settings"
            className="group rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:-translate-y-0.5 hover:border-orange-100 hover:bg-orange-50/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600 transition group-hover:bg-orange-600 group-hover:text-white">
              <SettingsIcon />
            </div>

            <p className="mt-3 text-sm font-semibold text-slate-800">
              Settings
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Manage system settings
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   SETTINGS ICON
========================================================= */

function SettingsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
