"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";

import { authService } from "@/services/authService";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.localpro1.net/api";

function getToken() {
  try {
    return authService?.getToken?.() || "";
  } catch {
    return "";
  }
}

function getUser() {
  try {
    return authService?.getUser?.() || null;
  } catch {
    return null;
  }
}

async function fetchJson(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      `Request failed with status ${response.status}`;

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

async function safeFetchJson(endpoint, fallback = null) {
  try {
    return await fetchJson(endpoint);
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      throw error;
    }

    return fallback;
  }
}

function getArray(data, keys = []) {
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data?.[key])) return data.data[key];
  }

  if (Array.isArray(data?.data)) return data.data;

  return [];
}

function formatDate(dateValue) {
  if (!dateValue) return "—";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateValue) {
  if (!dateValue) return "";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getName(user) {
  return (
    user?.name ||
    user?.fullName ||
    user?.username ||
    user?.email?.split("@")?.[0] ||
    "Admin"
  );
}

function getInitials(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "AD"
  );
}

function getStatusColor(status) {
  const value = String(status || "").toLowerCase();

  if (
    value.includes("complete") ||
    value.includes("success") ||
    value.includes("active") ||
    value.includes("done")
  ) {
    return "green";
  }

  if (
    value.includes("pending") ||
    value.includes("progress") ||
    value.includes("waiting")
  ) {
    return "orange";
  }

  if (
    value.includes("cancel") ||
    value.includes("fail") ||
    value.includes("inactive")
  ) {
    return "red";
  }

  return "purple";
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  trend,
  trendUp = true,
  href,
}) {
  const content = (
    <div className="group relative w-full overflow-hidden rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(45,35,100,0.06)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(45,35,100,0.10)]">
      <div
        className={`absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${gradient} opacity-[0.08] transition duration-300 group-hover:scale-125`}
      />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[13px] font-semibold text-slate-500">
            {title}
          </p>

          <h3 className="mt-2 text-[28px] font-bold tracking-tight text-slate-900">
            {value}
          </h3>

          <div className="mt-2 flex items-center gap-2">
            {trend ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${
                  trendUp
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                {trendUp ? (
                  <ArrowUpRight size={12} />
                ) : (
                  <ArrowDownRight size={12} />
                )}
                {trend}
              </span>
            ) : null}

            <span className="text-[11px] text-slate-400">
              {subtitle}
            </span>
          </div>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg`}
        >
          <Icon size={21} strokeWidth={2.2} />
        </div>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block w-full">
      {content}
    </Link>
  ) : (
    content
  );
}

function MiniBarChart({ values = [] }) {
  const normalized =
    values.length > 0
      ? values
      : [42, 58, 46, 72, 63, 84, 68, 92, 76, 88, 71, 96];

  const max = Math.max(...normalized, 1);

  return (
    <div className="flex h-40 w-full items-end gap-2">
      {normalized.map((value, index) => {
        const height = Math.max(14, (value / max) * 100);

        return (
          <div
            key={`${value}-${index}`}
            className="group flex h-full flex-1 items-end"
          >
            <div
              className="w-full rounded-t-xl bg-gradient-to-t from-violet-600 via-purple-500 to-fuchsia-400 transition-all duration-200 group-hover:from-violet-700 group-hover:via-purple-600 group-hover:to-pink-400"
              style={{ height: `${height}%` }}
              title={`${value}`}
            />
          </div>
        );
      })}
    </div>
  );
}

function ProgressBar({ value = 0 }) {
  const safeValue = Math.min(100, Math.max(0, Number(value) || 0));

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-gradient-to-r from-violet-600 via-purple-500 to-pink-500 transition-all duration-500"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="flex min-h-[150px] w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 text-center">
      <div>
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-violet-50 text-violet-500">
          <Sparkles size={17} />
        </div>

        <p className="mt-3 text-sm font-medium text-slate-500">
          {text}
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const [currentUser] = useState(() => getUser());

  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");

  const loadingRef = useRef(false);

  const loadDashboard = useCallback(
    async (force = false) => {
      if (loadingRef.current) return;

      loadingRef.current = true;

      if (force) {
        setRefreshing(true);
      }

      try {
        const [
          usersResult,
          tasksResult,
          notificationsResult,
        ] = await Promise.all([
          safeFetchJson("/users", []),
          safeFetchJson("/tasks?limit=100", []),
          safeFetchJson("/notifications", []),
        ]);

        setUsers(getArray(usersResult, ["users"]));
        setTasks(getArray(tasksResult, ["tasks"]));
        setNotifications(
          getArray(notificationsResult, ["notifications"])
        );
        setError("");
      } catch (err) {
        console.error("Dashboard loading error:", err);

        if (err?.status === 401 || err?.status === 403) {
          try {
            authService?.logout?.();
          } catch {}

          router.replace("/login");
          return;
        }

        setError("Unable to load dashboard data.");
      } finally {
        loadingRef.current = false;
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  const dashboardStats = useMemo(() => {
    const activeUsers = users.filter((user) => {
      const status = String(user?.status || "").toLowerCase();

      return (
        user?.isActive === true ||
        status === "active" ||
        status === "approved"
      );
    }).length;

    const completedTasks = tasks.filter((task) => {
      const status = String(task?.status || "").toLowerCase();

      return (
        status.includes("complete") ||
        status.includes("done") ||
        status === "completed"
      );
    }).length;

    const unreadNotifications = notifications.filter(
      (notification) =>
        notification?.read === false ||
        notification?.isRead === false
    ).length;

    const taskCompletion =
      tasks.length > 0
        ? Math.round(
            (completedTasks / tasks.length) * 100
          )
        : 0;

    return {
      totalUsers: users.length,
      activeUsers,
      totalTasks: tasks.length,
      completedTasks,
      unreadNotifications,
      taskCompletion,
    };
  }, [users, tasks, notifications]);

  const recentUsers = useMemo(
    () =>
      [...users]
        .sort(
          (a, b) =>
            new Date(b?.createdAt || 0) -
            new Date(a?.createdAt || 0)
        )
        .slice(0, 5),
    [users]
  );

  const recentTasks = useMemo(
    () =>
      [...tasks]
        .sort(
          (a, b) =>
            new Date(
              b?.createdAt || b?.updatedAt || 0
            ) -
            new Date(
              a?.createdAt || a?.updatedAt || 0
            )
        )
        .slice(0, 5),
    [tasks]
  );

  const recentNotifications = useMemo(
    () =>
      [...notifications]
        .sort(
          (a, b) =>
            new Date(
              b?.createdAt || b?.updatedAt || 0
            ) -
            new Date(
              a?.createdAt || a?.updatedAt || 0
            )
        )
        .slice(0, 5),
    [notifications]
  );

  const displayName = getName(currentUser);

  const today = new Date().toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }
  );

  return (
    <div className="relative w-full min-w-0 overflow-x-hidden bg-[#f7f8fc] text-slate-900">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      <main className="relative w-full min-w-0 p-4 sm:p-6 lg:p-8">
        <div className="w-full min-w-0 space-y-6">
          <section className="relative w-full overflow-hidden rounded-[30px] bg-gradient-to-br from-[#4211b8] via-[#6414d8] to-[#a617c8] p-6 text-white shadow-[0_25px_70px_rgba(93,36,190,0.25)] sm:p-8 lg:p-10">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-32 left-[35%] h-72 w-72 rounded-full bg-orange-400/20 blur-3xl" />
            <div className="pointer-events-none absolute right-[17%] top-0 h-40 w-72 rotate-45 rounded-[40px] bg-white/[0.07]" />
            <div className="pointer-events-none absolute right-[7%] top-20 h-32 w-64 rotate-[-22deg] rounded-[40px] bg-pink-400/[0.12]" />

            <div className="relative grid w-full items-center lg:grid-cols-[1fr_auto]">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-md">
                  <Sparkles size={13} />
                  Admin Dashboard
                </div>

                <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                  Welcome back, {displayName}
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
                  Manage your platform, monitor activity and keep everything
                  moving from one beautiful workspace.
                </p>
              </div>

              <div className="hidden lg:block">
                <div className="relative flex h-52 w-52 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-white/10" />
                  <div className="absolute inset-5 rounded-full border border-white/10" />
                  <div className="absolute inset-10 rounded-full border border-white/10" />

                  <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-2xl shadow-purple-950/30">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white">
                      <Zap size={32} fill="currentColor" />
                    </div>
                  </div>

                  <div className="absolute right-0 top-10 h-3 w-3 rounded-full bg-orange-300 shadow-lg shadow-orange-300/60" />
                  <div className="absolute bottom-8 left-5 h-2.5 w-2.5 rounded-full bg-pink-300 shadow-lg shadow-pink-300/60" />
                  <div className="absolute left-8 top-5 h-2 w-2 rounded-full bg-white/60" />
                </div>
              </div>
            </div>
          </section>

          <div className="flex w-full flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CalendarDays size={16} className="text-violet-500" />
              <span>{today}</span>
            </div>

            {error ? (
              <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600">
                {error}
              </div>
            ) : null}
          </div>

          <section className="grid w-full gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Users"
              value={dashboardStats.totalUsers}
              subtitle="Registered accounts"
              icon={Users}
              gradient="from-violet-600 to-purple-500"
              trend="Live"
              href="/admin/users"
            />

            <StatCard
              title="Active Users"
              value={dashboardStats.activeUsers}
              subtitle="Currently active"
              icon={Activity}
              gradient="from-emerald-500 to-teal-400"
              trend="Active"
              href="/admin/users"
            />

            <StatCard
              title="Total Tasks"
              value={dashboardStats.totalTasks}
              subtitle={`${dashboardStats.completedTasks} completed`}
              icon={Target}
              gradient="from-orange-500 to-amber-400"
              trend={`${dashboardStats.taskCompletion}%`}
              href="/admin/tasks"
            />

            <StatCard
              title="Notifications"
              value={dashboardStats.unreadNotifications}
              subtitle="Unread notifications"
              icon={Bell}
              gradient="from-pink-500 to-fuchsia-500"
              trend={
                dashboardStats.unreadNotifications > 0
                  ? "New"
                  : "Clear"
              }
              trendUp={
                dashboardStats.unreadNotifications === 0
              }
              href="/admin/notifications"
            />
          </section>

          <section className="grid w-full gap-5 xl:grid-cols-[1.45fr_0.8fr]">
            <div className="w-full min-w-0 overflow-hidden rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(45,35,100,0.05)] sm:p-6">
              <div className="flex w-full flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-500">
                    Overview
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    Platform activity
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    A quick visual overview of your workspace.
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 self-start rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-600">
                  <TrendingUp size={14} />
                  Growing steadily
                </div>
              </div>

              <div className="mt-7 w-full">
                <MiniBarChart />
              </div>

              <div className="mt-3 flex w-full justify-between text-[11px] font-medium text-slate-400">
                <span>Jan</span>
                <span>Feb</span>
                <span>Mar</span>
                <span>Apr</span>
                <span>May</span>
                <span>Jun</span>
                <span>Jul</span>
                <span>Aug</span>
                <span>Sep</span>
                <span>Oct</span>
                <span>Nov</span>
                <span>Dec</span>
              </div>
            </div>

            <div className="w-full min-w-0 rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(45,35,100,0.05)] sm:p-6">
              <div className="flex w-full items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-500">
                    Performance
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    Task progress
                  </h2>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-pink-500 text-white shadow-lg shadow-orange-500/20">
                  <Target size={19} />
                </div>
              </div>

              <div className="mt-8 flex w-full items-center gap-5">
                <div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-pink-100">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-sm">
                    <div className="text-center">
                      <p className="text-2xl font-extrabold text-slate-900">
                        {dashboardStats.taskCompletion}%
                      </p>

                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Complete
                      </p>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex w-full items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">
                      Completed
                    </span>

                    <span className="font-bold text-slate-900">
                      {dashboardStats.completedTasks}
                    </span>
                  </div>

                  <div className="mt-2 w-full">
                    <ProgressBar
                      value={dashboardStats.taskCompletion}
                    />
                  </div>

                  <div className="mt-5 flex w-full items-center justify-between text-sm">
                    <span className="font-semibold text-slate-500">
                      Remaining
                    </span>

                    <span className="font-bold text-slate-800">
                      {Math.max(
                        0,
                        dashboardStats.totalTasks -
                          dashboardStats.completedTasks
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-7 w-full rounded-2xl bg-gradient-to-r from-violet-50 via-purple-50 to-pink-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm">
                    <Sparkles size={16} />
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Keep the momentum
                    </p>

                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Complete your pending tasks to improve overall
                      progress.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid w-full gap-5 lg:grid-cols-3">
            <div className="w-full min-w-0 rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(45,35,100,0.05)] sm:p-6">
              <div className="flex w-full items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-500">
                    Users
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    Recent users
                  </h2>
                </div>

                <Link
                  href="/admin/users"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 transition hover:bg-violet-100"
                >
                  <ChevronRight size={17} />
                </Link>
              </div>

              <div className="mt-5 w-full space-y-3">
                {recentUsers.length === 0 ? (
                  <EmptyState text="No users available yet." />
                ) : (
                  recentUsers.map((user, index) => {
                    const name = getName(user);
                    const status = user?.status || "Active";

                    return (
                      <div
                        key={user?._id || user?.id || index}
                        className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 p-3 transition hover:border-violet-100 hover:bg-violet-50/40"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white">
                          {getInitials(name)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-800">
                            {name}
                          </p>

                          <p className="truncate text-[11px] text-slate-400">
                            {user?.email || "No email available"}
                          </p>
                        </div>

                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold capitalize text-emerald-600">
                          {status}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="w-full min-w-0 rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(45,35,100,0.05)] sm:p-6">
              <div className="flex w-full items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-500">
                    Tasks
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    Recent tasks
                  </h2>
                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                  <Clock3 size={17} />
                </div>
              </div>

              <div className="mt-5 w-full space-y-3">
                {recentTasks.length === 0 ? (
                  <EmptyState text="No tasks available yet." />
                ) : (
                  recentTasks.map((task, index) => {
                    const status = task?.status || "Pending";
                    const statusColor =
                      getStatusColor(status);

                    const colorClasses = {
                      green:
                        "bg-emerald-50 text-emerald-600",
                      orange:
                        "bg-orange-50 text-orange-600",
                      red: "bg-rose-50 text-rose-600",
                      purple:
                        "bg-violet-50 text-violet-600",
                    };

                    return (
                      <div
                        key={task?._id || task?.id || index}
                        className="w-full rounded-2xl border border-slate-100 p-3 transition hover:border-orange-100 hover:bg-orange-50/30"
                      >
                        <div className="flex w-full items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-slate-800">
                              {task?.title ||
                                task?.name ||
                                task?.task ||
                                "Untitled task"}
                            </p>

                            <p className="mt-1 text-[11px] text-slate-400">
                              {formatDate(
                                task?.createdAt ||
                                  task?.updatedAt
                              )}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold capitalize ${colorClasses[statusColor]}`}
                          >
                            {status}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="w-full min-w-0 rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(45,35,100,0.05)] sm:p-6">
              <div className="flex w-full items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-pink-500">
                    Updates
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    Notifications
                  </h2>
                </div>

                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-pink-50 text-pink-500">
                  <Bell size={17} />

                  {dashboardStats.unreadNotifications > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink-500 px-1 text-[9px] font-bold text-white">
                      {dashboardStats.unreadNotifications > 9
                        ? "9+"
                        : dashboardStats.unreadNotifications}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 w-full space-y-3">
                {recentNotifications.length === 0 ? (
                  <EmptyState text="You're all caught up." />
                ) : (
                  recentNotifications.map(
                    (notification, index) => {
                      const read =
                        notification?.read === true ||
                        notification?.isRead === true;

                      return (
                        <div
                          key={
                            notification?._id ||
                            notification?.id ||
                            index
                          }
                          className={`flex w-full gap-3 rounded-2xl border p-3 transition ${
                            read
                              ? "border-slate-100 bg-white"
                              : "border-pink-100 bg-pink-50/40"
                          }`}
                        >
                          <div
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                              read
                                ? "bg-slate-100 text-slate-500"
                                : "bg-gradient-to-br from-pink-500 to-fuchsia-500 text-white"
                            }`}
                          >
                            {read ? (
                              <CheckCircle2 size={15} />
                            ) : (
                              <Bell size={15} />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-xs font-bold leading-5 text-slate-800">
                              {notification?.title ||
                                notification?.message ||
                                notification?.text ||
                                "New notification"}
                            </p>

                            <p className="mt-1 text-[10px] text-slate-400">
                              {formatTime(
                                notification?.createdAt ||
                                  notification?.updatedAt
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    }
                  )
                )}
              </div>
            </div>
          </section>

          <section className="w-full overflow-hidden rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(45,35,100,0.05)] sm:p-6">
            <div className="flex w-full flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-500">
                  Quick actions
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Get things done faster
                </h2>
              </div>

              <div className="hidden h-px flex-1 bg-slate-100 sm:ml-6 sm:block" />
            </div>

            <div className="mt-5 grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Link
                href="/admin/users"
                className="group flex w-full items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition hover:-translate-y-0.5 hover:border-violet-100 hover:bg-violet-50/50"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-500 text-white shadow-lg shadow-violet-500/20">
                  <Users size={19} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">
                    Manage Users
                  </p>

                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Add and manage accounts
                  </p>
                </div>

                <ChevronRight
                  size={17}
                  className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-violet-500"
                />
              </Link>

              <Link
                href="/admin/tasks"
                className="group flex w-full items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition hover:-translate-y-0.5 hover:border-orange-100 hover:bg-orange-50/50"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-500/20">
                  <Target size={19} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">
                    Manage Tasks
                  </p>

                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Track your work
                  </p>
                </div>

                <ChevronRight
                  size={17}
                  className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-orange-500"
                />
              </Link>

              <Link
                href="/admin/notifications"
                className="group flex w-full items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition hover:-translate-y-0.5 hover:border-pink-100 hover:bg-pink-50/50"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-500 text-white shadow-lg shadow-pink-500/20">
                  <Bell size={19} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">
                    Notifications
                  </p>

                  <p className="mt-0.5 text-[11px] text-slate-400">
                    View latest updates
                  </p>
                </div>

                <ChevronRight
                  size={17}
                  className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-pink-500"
                />
              </Link>

              <button
                type="button"
                onClick={() => loadDashboard(true)}
                disabled={refreshing}
                className="group flex w-full items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-100 hover:bg-emerald-50/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-500/20">
                  <RefreshCw
                    size={19}
                    className={
                      refreshing ? "animate-spin" : ""
                    }
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">
                    Refresh Data
                  </p>

                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Get latest information
                  </p>
                </div>

                {refreshing ? (
                  <Loader2
                    size={17}
                    className="animate-spin text-emerald-500"
                  />
                ) : (
                  <ChevronRight
                    size={17}
                    className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-500"
                  />
                )}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}