"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
  Save,
  UserCheck,
  UserX,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.localpro1.net/api";

const CACHE_TIME = 30 * 1000;

// Global cache for instant 1-second loading
let globalAdminUsersCache = {
  data: [],
  timestamp: 0,
};

// ============================================================
// MONGODB OBJECT ID VALIDATION & RESOLUTION
// ============================================================

function isValidMongoId(value) {
  if (value === null || value === undefined) return false;
  const id = String(value).trim();
  return /^[a-fA-F0-9]{24}$/.test(id);
}

function resolveMongoId(value, depth = 0) {
  if (depth > 5 || value === null || value === undefined) return "";

  if (typeof value === "string") {
    const id = value.trim();
    return isValidMongoId(id) ? id : "";
  }

  if (typeof value === "number") {
    const id = String(value).trim();
    return isValidMongoId(id) ? id : "";
  }

  if (typeof value === "object") {
    if (value.$oid) {
      const id = resolveMongoId(value.$oid, depth + 1);
      if (id) return id;
    }

    const possibleFields = [
      "_id",
      "id",
      "userId",
      "user_id",
      "mongoId",
      "mongoID",
      "objectId",
      "objectID",
    ];

    for (const field of possibleFields) {
      if (value[field] !== undefined && value[field] !== null) {
        const id = resolveMongoId(value[field], depth + 1);
        if (id) return id;
      }
    }

    try {
      const stringValue = String(value);
      if (stringValue !== "[object Object]" && isValidMongoId(stringValue)) {
        return stringValue;
      }
    } catch {}
  }

  return "";
}

function getUserId(user) {
  if (!user) return "";

  if (typeof user === "string") {
    const trimmed = user.trim();
    return isValidMongoId(trimmed) ? trimmed : trimmed;
  }

  const directCandidate =
    user._id ||
    user.id ||
    user.userId ||
    user.user_id ||
    (user.user && (user.user._id || user.user.id));

  if (directCandidate) {
    if (typeof directCandidate === "object" && directCandidate.$oid) {
      return String(directCandidate.$oid).trim();
    }
    const strCandidate = String(directCandidate).trim();
    if (isValidMongoId(strCandidate)) {
      return strCandidate;
    }
  }

  const directId = resolveMongoId(user);
  if (directId) return directId;

  const nestedFields = ["user", "profile", "account", "data"];
  for (const field of nestedFields) {
    if (user[field]) {
      const id = resolveMongoId(user[field]);
      if (id) return id;
    }
  }

  return "";
}

function getAuthHeaders() {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (typeof window !== "undefined") {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("token");

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return headers;
}

function getUserStatus(user) {
  if (typeof user?.isActive === "boolean") {
    return user.isActive ? "Active" : "Inactive";
  }

  if (user?.status) {
    const normalized = String(user.status).toLowerCase();
    if (normalized === "active" || normalized === "inactive") {
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }
  }

  return "Active";
}

function getInitials(name = "") {
  if (!name) return "U";
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
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

// ============================================================
// SUB-COMPONENTS
// ============================================================

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

function StatusBadge({ status }) {
  const active = String(status || "").toLowerCase() === "active";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
        active
          ? "border border-emerald-100 bg-emerald-50 text-emerald-600"
          : "border border-slate-200 bg-slate-100 text-slate-500"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-slate-400"
        }`}
      />
      {status}
    </span>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");

  const [users, setUsers] = useState(globalAdminUsersCache.data);
  const [loading, setLoading] = useState(
    globalAdminUsersCache.data.length === 0
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [deletingUserId, setDeletingUserId] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState("");

  const [scheduleUser, setScheduleUser] = useState(null);
  const [scheduleStart, setScheduleStart] = useState("09:00");
  const [scheduleEnd, setScheduleEnd] = useState("17:00");
  const [windowStart, setWindowStart] = useState("08:45");
  const [windowEnd, setWindowEnd] = useState("09:30");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleSuccess, setScheduleSuccess] = useState("");

  const loadingRef = useRef(false);

  /* ==========================================================
     LOAD USERS WITH GLOBAL CACHE & SPEED OPTIMIZATION
  ========================================================== */
  const loadUsers = useCallback(async (force = false) => {
    if (loadingRef.current) return;

    const now = Date.now();
    if (
      !force &&
      globalAdminUsersCache.data.length > 0 &&
      now - globalAdminUsersCache.timestamp < CACHE_TIME
    ) {
      setUsers(globalAdminUsersCache.data);
      setLoading(false);
      return;
    }

    loadingRef.current = true;
    if (force) {
      setRefreshing(true);
    }
    setError("");

    try {
      const response = await fetch(`${API_URL}/users`, {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
        cache: "no-store",
      });

      let result = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      if (response.status === 403) {
        throw new Error(
          result?.message || result?.error || "You do not have permission to access users."
        );
      }

      if (!response.ok || result?.success === false) {
        throw new Error(
          result?.message || result?.error || `Failed to load users. Status: ${response.status}`
        );
      }

      let loadedUsers = [];
      if (Array.isArray(result)) {
        loadedUsers = result;
      } else if (Array.isArray(result?.users)) {
        loadedUsers = result.users;
      } else if (Array.isArray(result?.data)) {
        loadedUsers = result.data;
      } else if (Array.isArray(result?.data?.users)) {
        loadedUsers = result.data.users;
      } else if (result?.data?.user) {
        loadedUsers = [result.data.user];
      }

      setUsers(loadedUsers);
      globalAdminUsersCache = {
        timestamp: Date.now(),
        data: loadedUsers,
      };
    } catch (requestError) {
      console.error("Admin users loading error:", requestError);
      setError(requestError?.message || "Unable to load users from backend.");
      if (globalAdminUsersCache.data.length === 0) {
        setUsers([]);
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUsers(false);
  }, [loadUsers]);

  /* ==========================================================
     DELETE USER
  ========================================================== */
  const handleDeleteUser = async (user) => {
    const userId = getUserId(user);

    if (!userId || !isValidMongoId(userId)) {
      setDeleteError("This user does not have a valid MongoDB ID.");
      setDeleteSuccess("");
      return;
    }

    const userName = user?.name || user?.email || "this user";
    const confirmed = window.confirm(
      `Are you sure you want to delete ${userName}?\n\nThis action will permanently delete the user.`
    );

    if (!confirmed) return;

    try {
      setDeletingUserId(userId);
      setDeleteError("");
      setDeleteSuccess("");

      const response = await fetch(`${API_URL}/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
        headers: getAuthHeaders(),
      });

      let result = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      if (response.status === 403) {
        throw new Error(
          result?.message || result?.error || "You do not have permission to delete users."
        );
      }

      if (!response.ok || result?.success === false) {
        throw new Error(
          result?.message || result?.error || `Failed to delete user. Status: ${response.status}`
        );
      }

      setUsers((prev) => {
        const next = prev.filter((u) => getUserId(u) !== userId);
        globalAdminUsersCache.data = next;
        return next;
      });

      setScheduleUser((prev) => {
        if (!prev) return prev;
        return getUserId(prev) === userId ? null : prev;
      });

      setDeleteSuccess(result?.message || "User deleted successfully.");
      setTimeout(() => setDeleteSuccess(""), 4000);
    } catch (requestError) {
      console.error("DELETE USER ERROR:", requestError);
      setDeleteError(requestError?.message || "Unable to delete user.");
      setDeleteSuccess("");
    } finally {
      setDeletingUserId(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setRole("all");
    setStatus("all");
  };

  /* ==========================================================
     MEMOIZED FILTERING
  ========================================================== */
  const filteredUsers = useMemo(() => {
    const searchValue = search.toLowerCase().trim();

    return users.filter((user) => {
      const userName = String(user?.name || "").toLowerCase();
      const userEmail = String(user?.email || "").toLowerCase();
      const userRole = String(user?.role || "").toLowerCase();
      const userStatus = getUserStatus(user).toLowerCase();

      const matchesSearch =
        !searchValue || userName.includes(searchValue) || userEmail.includes(searchValue);
      const matchesRole = role === "all" || userRole === role.toLowerCase();
      const matchesStatus = status === "all" || userStatus === status.toLowerCase();

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, role, status]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => getUserStatus(u).toLowerCase() === "active").length;
    const inactive = total - active;
    const withSchedule = users.filter((u) => {
      const s =
        u?.attendanceSchedule ||
        u?.preferences?.attendanceSchedule ||
        u?.workSchedule ||
        u?.schedule;
      return Boolean(s?.startTime && s?.endTime);
    }).length;

    return { total, active, inactive, withSchedule };
  }, [users]);

  /* ==========================================================
     SCHEDULE MODAL HANDLERS
  ========================================================== */
  const openSchedule = (user) => {
    const userId = getUserId(user);

    if (!userId || !isValidMongoId(userId)) {
      setScheduleUser(null);
      setScheduleError("This user does not have a valid MongoDB ID.");
      return;
    }

    setScheduleUser(user);
    setScheduleError("");
    setScheduleSuccess("");

    const schedule =
      user?.attendanceSchedule ||
      user?.preferences?.attendanceSchedule ||
      user?.workSchedule ||
      user?.preferences?.workSchedule ||
      user?.schedule ||
      null;

    setScheduleStart(
      schedule?.startTime || user?.attendanceSettings?.attendanceTime || "09:00"
    );
    setScheduleEnd(schedule?.endTime || "17:00");
    setWindowStart(schedule?.windowStart || "08:45");
    setWindowEnd(schedule?.windowEnd || "09:30");
  };

  const closeSchedule = () => {
    if (savingSchedule) return;
    setScheduleUser(null);
    setScheduleError("");
    setScheduleSuccess("");
  };

  const saveSchedule = async () => {
    if (!scheduleUser) {
      setScheduleError("No user selected.");
      return;
    }

    const userId = getUserId(scheduleUser);
    if (!userId || !isValidMongoId(userId)) {
      setScheduleError("Invalid MongoDB user ID.");
      return;
    }

    if (!scheduleStart || !scheduleEnd) {
      setScheduleError("Please select work start and end time.");
      return;
    }

    if (!windowStart || !windowEnd) {
      setScheduleError("Please select attendance window.");
      return;
    }

    if (scheduleStart >= scheduleEnd) {
      setScheduleError("Work start time must be before work end time.");
      return;
    }

    if (windowStart >= windowEnd) {
      setScheduleError("Attendance window start must be before window end.");
      return;
    }

    try {
      setSavingSchedule(true);
      setScheduleError("");
      setScheduleSuccess("");

      const updatedSchedule = {
        startTime: scheduleStart,
        endTime: scheduleEnd,
        windowStart,
        windowEnd,
      };

      const payload = {
        attendanceSchedule: updatedSchedule,
        workSchedule: updatedSchedule,
        attendanceSettings: {
          ...(scheduleUser?.attendanceSettings || {}),
          attendanceTime: scheduleStart,
        },
        preferences: {
          ...(scheduleUser?.preferences || {}),
          attendanceSchedule: updatedSchedule,
          workSchedule: updatedSchedule,
        },
      };

      const authHeaders = getAuthHeaders();
      let response = await fetch(`${API_URL}/users/${userId}`, {
        method: "PUT",
        credentials: "include",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      let result = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (response.status === 404) {
        response = await fetch(`${API_URL}/users/${userId}/attendance-schedule`, {
          method: "PUT",
          credentials: "include",
          headers: authHeaders,
          body: JSON.stringify(payload),
        });
        try {
          result = await response.json();
        } catch {
          result = null;
        }
      }

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      if (response.status === 403) {
        throw new Error(
          result?.message || result?.error || "You do not have permission to update this schedule."
        );
      }

      if (!response.ok || result?.success === false) {
        throw new Error(
          result?.message || result?.error || `Failed to save schedule. Status: ${response.status}`
        );
      }

      const updateUserObj = (u) => ({
        ...u,
        attendanceSchedule: updatedSchedule,
        workSchedule: updatedSchedule,
        attendanceSettings: {
          ...(u?.attendanceSettings || {}),
          attendanceTime: scheduleStart,
        },
        preferences: {
          ...(u?.preferences || {}),
          attendanceSchedule: updatedSchedule,
          workSchedule: updatedSchedule,
        },
      });

      setUsers((prev) => {
        const next = prev.map((u) => (getUserId(u) === userId ? updateUserObj(u) : u));
        globalAdminUsersCache.data = next;
        return next;
      });

      setScheduleUser((prev) => (prev ? updateUserObj(prev) : null));
      setScheduleSuccess("Attendance schedule saved successfully.");
      setTimeout(() => closeSchedule(), 1200);
    } catch (requestError) {
      console.error("SAVE ATTENDANCE SCHEDULE ERROR:", requestError);
      setScheduleError(requestError?.message || "Unable to save attendance schedule.");
    } finally {
      setSavingSchedule(false);
    }
  };

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
            CLEAN TEXT HEADER
        ========================================================= */}
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-violet-50/80 px-3 py-1 text-xs font-bold text-violet-700">
              <ShieldCheck size={14} />
              ADMINISTRATION
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Users Management
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Manage accounts, assign roles, configure check-in windows, and supervise attendance policies.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => loadUsers(true)}
              disabled={refreshing}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/50 hover:text-violet-700 disabled:opacity-60"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin text-violet-600" : ""} />
              Refresh
            </button>

            <Link
              href="/admin/users/new"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition duration-150 hover:-translate-y-0.5 hover:bg-violet-700 active:translate-y-0"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>Add User</span>
            </Link>
          </div>
        </section>

        {/* =========================================================
            ALERTS
        ========================================================= */}
        {deleteSuccess && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/90 p-4 text-emerald-700 shadow-sm">
            <CheckCircle2 size={19} className="shrink-0 text-emerald-600" />
            <p className="text-sm font-medium">{deleteSuccess}</p>
          </div>
        )}

        {deleteError && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50/90 p-4 text-rose-700 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle size={19} className="shrink-0 text-rose-600" />
              <p className="text-sm font-medium">{deleteError}</p>
            </div>
            <button
              type="button"
              onClick={() => setDeleteError("")}
              className="rounded-lg p-1 text-rose-500 hover:bg-rose-100"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-100 bg-amber-50/90 p-4 text-amber-800 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle size={19} className="shrink-0 text-amber-600" />
              <p className="text-sm font-medium">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => loadUsers(true)}
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
            title="Total Users"
            value={stats.total}
            subtitle="All workspace accounts"
            icon={Users}
            gradient="from-violet-600 to-purple-500"
          />
          <StatCard
            title="Active Accounts"
            value={stats.active}
            subtitle="Currently active"
            icon={UserCheck}
            gradient="from-emerald-500 to-teal-400"
          />
          <StatCard
            title="Inactive Accounts"
            value={stats.inactive}
            subtitle="Suspended or pending"
            icon={UserX}
            gradient="from-orange-500 to-amber-400"
          />
          <StatCard
            title="Scheduled Users"
            value={stats.withSchedule}
            subtitle="With shift timing assigned"
            icon={CalendarClock}
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
                placeholder="Search users by name, email..."
                className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 pl-11 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-11 rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 text-sm font-medium text-slate-600 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="user">User</option>
              </select>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-11 rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 text-sm font-medium text-slate-600 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              {(search || role !== "all" || status !== "all") && (
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
            USERS TABLE
        ========================================================= */}
        <section className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Workspace Accounts</h2>
                <p className="text-xs text-slate-500">
                  {loading
                    ? "Loading users..."
                    : `${filteredUsers.length} of ${users.length} total users shown`}
                </p>
              </div>

              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-600">
                {filteredUsers.length} Listed
              </span>
            </div>
          </div>

          {loading && users.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center p-8">
              <Loader2 size={32} className="animate-spin text-violet-600" />
              <p className="mt-3 text-sm font-semibold text-slate-600">Loading user records...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Shift Schedule</th>
                    <th className="px-6 py-4">Joined Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80 text-sm">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user, index) => {
                      const realUserId = getUserId(user);
                      const rowKey = realUserId || user?.email || `user-${index}`;

                      const userSchedule =
                        user?.attendanceSchedule ||
                        user?.preferences?.attendanceSchedule ||
                        user?.workSchedule ||
                        user?.preferences?.workSchedule ||
                        user?.schedule ||
                        null;

                      const hasSchedule = Boolean(
                        userSchedule?.startTime && userSchedule?.endTime
                      );
                      const canSchedule = Boolean(realUserId && isValidMongoId(realUserId));
                      const isDeleting = deletingUserId === realUserId;

                      return (
                        <tr
                          key={rowKey}
                          className="transition hover:bg-violet-50/30"
                        >
                          {/* USER INFO */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-md shadow-purple-500/10">
                                {user?.avatar ? (
                                  <img
                                    src={user.avatar}
                                    alt={user?.name || "User"}
                                    className="h-full w-full rounded-2xl object-cover"
                                  />
                                ) : (
                                  getInitials(user?.name)
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-bold text-slate-900">
                                  {user?.name || "Unnamed User"}
                                </p>
                                <p className="truncate text-xs text-slate-400">
                                  {user?.email || "No email available"}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* ROLE */}
                          <td className="px-6 py-4">
                            <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold capitalize text-violet-600">
                              {user?.role || "user"}
                            </span>
                          </td>

                          {/* STATUS */}
                          <td className="px-6 py-4">
                            <StatusBadge status={getUserStatus(user)} />
                          </td>

                          {/* SCHEDULE */}
                          <td className="px-6 py-4">
                            {hasSchedule ? (
                              <div className="text-xs">
                                <span className="font-bold text-slate-800">
                                  {userSchedule.startTime} - {userSchedule.endTime}
                                </span>
                                <span className="block text-slate-400">
                                  Window: {userSchedule.windowStart || "—"} - {userSchedule.windowEnd || "—"}
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-600">
                                Not Assigned
                              </span>
                            )}
                          </td>

                          {/* JOINED */}
                          <td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-slate-500">
                            {formatDate(user?.createdAt)}
                          </td>

                          {/* ACTIONS */}
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {canSchedule ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openSchedule(user)}
                                    disabled={isDeleting}
                                    className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold text-violet-600 transition hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50"
                                  >
                                    <CalendarClock size={14} />
                                    Schedule
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(user)}
                                    disabled={isDeleting || savingSchedule}
                                    className="inline-flex items-center gap-1 rounded-xl border border-rose-100 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50"
                                    title="Delete User"
                                  >
                                    {isDeleting ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <Trash2 size={13} />
                                    )}
                                    {isDeleting ? "..." : "Delete"}
                                  </button>
                                </>
                              ) : (
                                <span className="text-xs font-medium text-rose-400">
                                  Unavailable
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">
                          <Users size={22} />
                        </div>
                        <h3 className="mt-3 text-sm font-bold text-slate-800">
                          {users.length === 0 ? "No users found" : "No matching users"}
                        </h3>
                        <p className="mt-1 text-xs text-slate-400">
                          {users.length === 0
                            ? "No accounts found on the backend."
                            : "Try updating your search query or filter settings."}
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

      {/* ========================================================
          SCHEDULE MODAL
      ======================================================== */}
      {scheduleUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-2xl">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-violet-50/50 via-purple-50/30 to-white px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-md shadow-purple-600/20">
                  <CalendarClock size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Configure Shift Schedule</h3>
                  <p className="text-xs text-slate-500">
                    {scheduleUser?.name || "Workspace Employee"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeSchedule}
                disabled={savingSchedule}
                className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="space-y-5 p-6">
              {scheduleError && (
                <div className="flex items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 p-3.5 text-xs font-semibold text-rose-600">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{scheduleError}</span>
                </div>
              )}

              {scheduleSuccess && (
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-600">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>{scheduleSuccess}</span>
                </div>
              )}

              {/* SHIFT TIMINGS */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-violet-600">
                  Working Shift Hours
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600">Start Time</label>
                    <input
                      type="time"
                      value={scheduleStart}
                      onChange={(e) => setScheduleStart(e.target.value)}
                      disabled={savingSchedule}
                      className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">End Time</label>
                    <input
                      type="time"
                      value={scheduleEnd}
                      onChange={(e) => setScheduleEnd(e.target.value)}
                      disabled={savingSchedule}
                      className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                    />
                  </div>
                </div>
              </div>

              {/* CHECK-IN WINDOW */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-pink-600">
                  Attendance Check-in Window
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600">Window Open</label>
                    <input
                      type="time"
                      value={windowStart}
                      onChange={(e) => setWindowStart(e.target.value)}
                      disabled={savingSchedule}
                      className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">Window Close</label>
                    <input
                      type="time"
                      value={windowEnd}
                      onChange={(e) => setWindowEnd(e.target.value)}
                      disabled={savingSchedule}
                      className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                    />
                  </div>
                </div>
              </div>

              {/* HELPER BOX */}
              <div className="flex gap-3 rounded-2xl bg-violet-50/60 p-4">
                <Clock3 size={18} className="shrink-0 text-violet-600" />
                <p className="text-xs leading-5 text-slate-500">
                  Attendance checks outside the allowed window will automatically register as late or unauthorized check-ins.
                </p>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
              <button
                type="button"
                onClick={closeSchedule}
                disabled={savingSchedule}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveSchedule}
                disabled={savingSchedule}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-violet-600 px-6 text-sm font-bold text-white shadow-md shadow-violet-600/20 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingSchedule ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {savingSchedule ? "Saving..." : "Save Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}