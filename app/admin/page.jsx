"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  CalendarDays,
  ClipboardList,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";

import { authService } from "@/services/authService";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.localpro1.net/api";

export default function AdminDashboardPage() {
  const mountedRef = useRef(false);
  const loadingRef = useRef(false);
  const redirectingRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isAuthError = useCallback((message = "") => {
    const text = String(message).toLowerCase();

    return (
      text.includes("authentication") ||
      text.includes("unauthorized") ||
      text.includes("no token") ||
      text.includes("invalid token") ||
      text.includes("token expired") ||
      text.includes("jwt") ||
      text.includes("401")
    );
  }, []);

  const redirectToLogin = useCallback(() => {
    if (redirectingRef.current) {
      return;
    }

    redirectingRef.current = true;

    try {
      if (typeof authService.clearToken === "function") {
        authService.clearToken();
      }
    } catch (error) {
      console.error("Unable to clear auth token:", error);
    }

    window.location.replace("/login");
  }, []);

  const fetchJson = useCallback(async (url, options = {}) => {
    let token = null;

    try {
      if (typeof authService.getToken === "function") {
        token = authService.getToken();
      }
    } catch (error) {
      console.error("Unable to get auth token:", error);
    }

    const response = await fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        Accept: "application/json",

        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),

        ...(options.headers || {}),
      },
    });

    let result = null;

    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (response.status === 401) {
      throw new Error(
        result?.message ||
          result?.error ||
          "Authentication failed. Please login again."
      );
    }

    if (response.status === 403) {
      throw new Error(
        result?.message ||
          result?.error ||
          "You do not have permission to access this resource."
      );
    }

    if (!response.ok || result?.success === false) {
      throw new Error(
        result?.message ||
          result?.error ||
          `Request failed with status ${response.status}.`
      );
    }

    return result;
  }, []);

  const extractArray = useCallback((result, keys = []) => {
    if (Array.isArray(result)) {
      return result;
    }

    for (const key of keys) {
      if (Array.isArray(result?.[key])) {
        return result[key];
      }

      if (Array.isArray(result?.data?.[key])) {
        return result.data[key];
      }
    }

    if (Array.isArray(result?.data)) {
      return result.data;
    }

    return [];
  }, []);

  const extractCurrentUser = useCallback((result) => {
    if (!result) {
      return null;
    }

    if (result?.user && !Array.isArray(result.user)) {
      return result.user;
    }

    if (result?.data?.user && !Array.isArray(result.data.user)) {
      return result.data.user;
    }

    if (result?.data && !Array.isArray(result.data)) {
      return result.data;
    }

    return null;
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!mountedRef.current || loadingRef.current) {
      return;
    }

    loadingRef.current = true;

    setLoading(true);
    setError("");

    try {
      let meResult;

      try {
        if (typeof authService.me === "function") {
          meResult = await authService.me();
        } else {
          meResult = await fetchJson(`${API_URL}/auth/me`);
        }
      } catch (authError) {
        console.error("Admin auth check failed:", authError);

        if (isAuthError(authError?.message || "")) {
          redirectToLogin();
          return;
        }

        throw authError;
      }

      const user = extractCurrentUser(meResult);

      if (!user) {
        redirectToLogin();
        return;
      }

      const role = String(user?.role || "")
        .trim()
        .toLowerCase();

      if (role !== "admin") {
        redirectToLogin();
        return;
      }

      if (!mountedRef.current) {
        return;
      }

      setCurrentUser({
        ...user,
        avatar: user?.avatar || null,
      });

      // OPTIMIZED: Fetch sequentially one by one instead of Promise.allSettled
      // to eliminate heavy concurrent load and reduce memory spike.
      let loadedUsers = [];
      let loadedTasks = [];
      let loadedNotifications = [];
      let requestErrorMsg = "";

      try {
        const usersRes = await fetchJson(`${API_URL}/users`);
        loadedUsers = extractArray(usersRes, ["users"]);
      } catch (err) {
        if (isAuthError(err?.message || "")) {
          redirectToLogin();
          return;
        }
        requestErrorMsg = requestErrorMsg || err?.message;
      }

      try {
        const tasksRes = await fetchJson(`${API_URL}/tasks?limit=100`);
        loadedTasks = extractArray(tasksRes, ["tasks"]);
      } catch (err) {
        if (isAuthError(err?.message || "")) {
          redirectToLogin();
          return;
        }
        requestErrorMsg = requestErrorMsg || err?.message;
      }

      try {
        const notifRes = await fetchJson(`${API_URL}/notifications`);
        loadedNotifications = extractArray(notifRes, ["notifications"]);
      } catch (err) {
        if (isAuthError(err?.message || "")) {
          redirectToLogin();
          return;
        }
        requestErrorMsg = requestErrorMsg || err?.message;
      }

      if (!mountedRef.current) {
        return;
      }

      if (requestErrorMsg) {
        setError(requestErrorMsg);
      } else {
        setError("");
      }

      setUsers(loadedUsers);
      setTasks(loadedTasks);
      setNotifications(loadedNotifications);
    } catch (requestError) {
      console.error(
        "Admin dashboard loading error:",
        requestError
      );

      if (!mountedRef.current) {
        return;
      }

      const message =
        requestError?.message ||
        "Unable to load dashboard data from the backend.";

      if (isAuthError(message)) {
        redirectToLogin();
        return;
      }

      setError(message);
    } finally {
      loadingRef.current = false;

      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [
    extractArray,
    extractCurrentUser,
    fetchJson,
    isAuthError,
    redirectToLogin,
  ]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const activeTasks = tasks.filter((task) => {
    const status = String(task?.status || "")
      .trim()
      .toLowerCase();

    return (
      status === "pending" ||
      status === "in progress"
    );
  });

  const recentUsers = [...users]
    .sort((a, b) => {
      const first = new Date(
        a?.createdAt || 0
      ).getTime();

      const second = new Date(
        b?.createdAt || 0
      ).getTime();

      return second - first;
    })
    .slice(0, 5);

  const recentTasks = [...tasks]
    .sort((a, b) => {
      const first = new Date(
        a?.createdAt || 0
      ).getTime();

      const second = new Date(
        b?.createdAt || 0
      ).getTime();

      return second - first;
    })
    .slice(0, 5);

  const recentActivity = [...notifications]
    .sort((a, b) => {
      const first = new Date(
        a?.createdAt || 0
      ).getTime();

      const second = new Date(
        b?.createdAt || 0
      ).getTime();

      return second - first;
    })
    .slice(0, 5);

  return (
    <main className="w-full p-5 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page Header */}
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#2563EB]">
              ADMINISTRATION
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
              Admin Dashboard
            </h1>

            <p className="mt-2 text-sm text-[#64748B]">
              {currentUser?.name
                ? `Welcome back, ${currentUser.name}. Manage and monitor your Local Pro 1 workspace.`
                : "Manage and monitor your Local Pro 1 workspace."}
            </p>
          </div>

          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#26344D] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <Loader2
                size={16}
                className="animate-spin"
              />
            ) : (
              <RefreshCw size={16} />
            )}

            Refresh
          </button>
        </section>

        {/* Error */}
        {error && (
          <section className="rounded-2xl border border-red-100 bg-red-50 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                onClick={loadDashboard}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <RefreshCw size={16} />
                Try Again
              </button>
            </div>
          </section>
        )}

        {/* Stats */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <BackendStat
            icon={Users}
            title="Total Users"
            value={users.length}
            loading={loading}
            description={
              users.length === 0
                ? "No users available"
                : "Users in workspace"
            }
          />

          <BackendStat
            icon={ClipboardList}
            title="Active Tasks"
            value={activeTasks.length}
            loading={loading}
            description={
              activeTasks.length === 0
                ? "No active tasks"
                : "Pending or in progress"
            }
          />

          <BackendStat
            icon={CalendarDays}
            title="Appointments"
            value="—"
            loading={false}
            description="Calendar backend not connected"
          />

          <BackendStat
            icon={Activity}
            title="System Activity"
            value={notifications.length}
            loading={loading}
            description={
              notifications.length === 0
                ? "No activity available"
                : "Recent notifications"
            }
          />
        </section>

        {/* Dashboard Panels */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <BackendPanel
            icon={Activity}
            title="Workspace Activity"
            description="Recent activity loaded from the backend."
            loading={loading}
            empty={
              !loading &&
              recentActivity.length === 0
            }
          >
            {recentActivity.length > 0 && (
              <div className="mt-6 space-y-3">
                {recentActivity.map(
                  (notification, index) => (
                    <ActivityItem
                      key={
                        notification?._id ||
                        notification?.id ||
                        `notification-${index}`
                      }
                      notification={notification}
                    />
                  )
                )}
              </div>
            )}
          </BackendPanel>

          <BackendPanel
            icon={Users}
            title="Recent Users"
            description="Recently created workspace users."
            loading={loading}
            empty={
              !loading &&
              recentUsers.length === 0
            }
          >
            {recentUsers.length > 0 && (
              <div className="mt-6 space-y-3">
                {recentUsers.map((user, index) => (
                  <UserItem
                    key={
                      user?._id ||
                      user?.id ||
                      `user-${index}`
                    }
                    user={user}
                  />
                ))}
              </div>
            )}
          </BackendPanel>

          <BackendPanel
            icon={ClipboardList}
            title="Task Overview"
            description="Recent tasks loaded from the backend."
            loading={loading}
            empty={
              !loading &&
              recentTasks.length === 0
            }
          >
            {recentTasks.length > 0 && (
              <div className="mt-6 space-y-3">
                {recentTasks.map((task, index) => (
                  <TaskItem
                    key={
                      task?._id ||
                      task?.id ||
                      `task-${index}`
                    }
                    task={task}
                  />
                ))}
              </div>
            )}
          </BackendPanel>

          <BackendPanel
            icon={CalendarDays}
            title="Upcoming Events"
            description="Calendar backend is not connected yet."
            loading={false}
            empty={false}
          >
            <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-5 text-center">
              <p className="text-sm text-slate-400">
                No calendar events available
              </p>

              <Link
                href="/admin/calendar"
                className="mt-3 inline-flex text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
              >
                Open Calendar
              </Link>
            </div>
          </BackendPanel>
        </section>

        {/* System Status */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-[#171B3A]">
                System Status
              </h2>

              <p className="mt-1 text-sm text-[#64748B]">
                Backend connection status.
              </p>
            </div>

            <div
              className={`inline-flex w-fit items-center gap-2 rounded-xl border px-4 py-2 ${
                loading
                  ? "border-blue-100 bg-[#EEF4FF]"
                  : error
                    ? "border-red-100 bg-red-50"
                    : "border-emerald-100 bg-emerald-50"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  loading
                    ? "bg-[#2563EB]"
                    : error
                      ? "bg-red-500"
                      : "bg-emerald-500"
                }`}
              />

              <span
                className={`text-xs font-medium ${
                  loading
                    ? "text-[#2563EB]"
                    : error
                      ? "text-red-600"
                      : "text-emerald-600"
                }`}
              >
                {loading
                  ? "Connecting..."
                  : error
                    ? "Connection Error"
                    : "Backend Connected"}
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/* =========================================================
   Backend Stat
========================================================= */

function BackendStat({
  icon: Icon,
  title,
  value,
  loading,
  description,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
        <Icon size={21} />
      </div>

      <p className="mt-5 text-sm font-medium text-[#64748B]">
        {title}
      </p>

      <div className="mt-1 flex h-9 items-center">
        {loading ? (
          <Loader2
            size={22}
            className="animate-spin text-[#2563EB]"
          />
        ) : (
          <p className="text-2xl font-bold text-[#171B3A]">
            {value}
          </p>
        )}
      </div>

      <p className="mt-1 text-xs text-slate-400">
        {description}
      </p>
    </div>
  );
}

/* =========================================================
   Backend Panel
========================================================= */

function BackendPanel({
  icon: Icon,
  title,
  description,
  loading,
  empty,
  children,
}) {
  return (
    <div className="min-h-[280px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
          <Icon size={19} />
        </div>

        <div>
          <h2 className="text-base font-bold text-[#171B3A]">
            {title}
          </h2>

          <p className="mt-1 text-sm text-[#64748B]">
            {description}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : empty ? (
        <div className="flex min-h-[190px] items-center justify-center">
          <p className="text-sm text-slate-400">
            No data available
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/* =========================================================
   Skeleton
========================================================= */

function SkeletonRow() {
  return (
    <div className="flex animate-pulse items-center gap-3 rounded-xl border border-slate-100 p-3">
      <div className="h-9 w-9 rounded-full bg-slate-100" />

      <div className="flex-1 space-y-2">
        <div className="h-3 w-2/3 rounded bg-slate-100" />
        <div className="h-2.5 w-1/2 rounded bg-slate-100" />
      </div>
    </div>
  );
}

/* =========================================================
   Activity Item
========================================================= */

function ActivityItem({ notification }) {
  const title =
    notification?.title || "Workspace Activity";

  const message =
    notification?.message || "Activity recorded.";

  const date = notification?.createdAt
    ? formatDate(notification.createdAt)
    : "Recently";

  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-[#2563EB]">
        <Activity size={16} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#171B3A]">
          {title}
        </p>

        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#64748B]">
          {message}
        </p>

        <p className="mt-1 text-[11px] text-slate-400">
          {date}
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   User Item
========================================================= */

function UserItem({ user }) {
  const name = user?.name || "Unnamed User";
  const email =
    user?.email || "No email available";
  const role = user?.role || "user";

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EEF4FF] text-xs font-bold text-[#2563EB]">
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#171B3A]">
          {name}
        </p>

        <p className="truncate text-xs text-[#64748B]">
          {email}
        </p>
      </div>

      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-500">
        {role}
      </span>
    </div>
  );
}

/* =========================================================
   Task Item
========================================================= */

function TaskItem({ task }) {
  const status = task?.status || "Pending";
  const priority = task?.priority || "Medium";

  const normalizedStatus = String(status)
    .trim()
    .toLowerCase();

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
        <ClipboardList size={16} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#171B3A]">
          {task?.title || "Untitled Task"}
        </p>

        <p className="mt-1 text-xs text-[#64748B]">
          {task?.assignedTo?.name
            ? `Assigned to ${task.assignedTo.name}`
            : "No assignee"}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
            normalizedStatus === "completed"
              ? "bg-emerald-50 text-emerald-600"
              : normalizedStatus === "in progress"
                ? "bg-blue-50 text-blue-600"
                : "bg-slate-100 text-slate-500"
          }`}
        >
          {status}
        </span>

        <span className="text-[10px] font-medium text-slate-400">
          {priority}
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   Date Helper
========================================================= */

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}