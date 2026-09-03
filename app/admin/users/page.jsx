"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  CalendarClock,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.localpro1.net/api";

// ============================================================
// MONGODB OBJECT ID VALIDATION
// ============================================================

function isValidMongoId(value) {
  if (value === null || value === undefined) {
    return false;
  }

  const id = String(value).trim();

  return /^[a-fA-F0-9]{24}$/.test(id);
}

// ============================================================
// RESOLVE MONGODB ID
// ============================================================

function resolveMongoId(value, depth = 0) {
  if (depth > 5 || value === null || value === undefined) {
    return "";
  }

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
    } catch {
      // Ignore
    }
  }

  return "";
}

// ============================================================
// GET USER MONGODB ID
// ============================================================

function getUserId(user) {
  if (!user) {
    return "";
  }

  if (typeof user === "string") {
    const trimmed = user.trim();
    return isValidMongoId(trimmed) ? trimmed : trimmed;
  }

  // Direct property check first
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
  if (directId) {
    return directId;
  }

  const nestedFields = ["user", "profile", "account", "data"];
  for (const field of nestedFields) {
    if (user[field]) {
      const id = resolveMongoId(user[field]);
      if (id) return id;
    }
  }

  return "";
}

// ============================================================
// GET AUTH HEADERS HELPER
// ============================================================

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
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  return headers;
}

// ============================================================
// PAGE
// ============================================================

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ==========================================================
  // SCHEDULE STATE
  // ==========================================================

  const [scheduleUser, setScheduleUser] = useState(null);
  const [scheduleStart, setScheduleStart] = useState("09:00");
  const [scheduleEnd, setScheduleEnd] = useState("17:00");
  const [windowStart, setWindowStart] = useState("08:45");
  const [windowEnd, setWindowEnd] = useState("09:30");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleSuccess, setScheduleSuccess] = useState("");

  // ==========================================================
  // LOAD USERS
  // ==========================================================

  const loadUsers = useCallback(async () => {
    setLoading(true);
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
          result?.message ||
            result?.error ||
            "You do not have permission to access users."
        );
      }

      if (!response.ok || result?.success === false) {
        throw new Error(
          result?.message ||
            result?.error ||
            `Failed to load users. Status: ${response.status}`
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
    } catch (requestError) {
      console.error("Admin users loading error:", requestError);
      setError(
        requestError?.message || "Unable to load users from backend."
      );
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const clearFilters = () => {
    setSearch("");
    setRole("all");
    setStatus("all");
  };

  const filteredUsers = useMemo(() => {
    const searchValue = search.toLowerCase().trim();

    return users.filter((user) => {
      const userName = String(user?.name || "").toLowerCase();
      const userEmail = String(user?.email || "").toLowerCase();
      const userRole = String(user?.role || "").toLowerCase();
      const userStatus = getUserStatus(user).toLowerCase();

      const matchesSearch =
        !searchValue ||
        userName.includes(searchValue) ||
        userEmail.includes(searchValue);

      const matchesRole =
        role === "all" || userRole === role.toLowerCase();

      const matchesStatus =
        status === "all" || userStatus === status.toLowerCase();

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, role, status]);

  const totalUsers = users.length;
  const activeUsers = users.filter(
    (user) => getUserStatus(user).toLowerCase() === "active"
  ).length;

  // ==========================================================
  // OPEN SCHEDULE
  // ==========================================================

  const openSchedule = (user) => {
    const userId = getUserId(user);

    if (!userId || !isValidMongoId(userId)) {
      setScheduleUser(null);
      setScheduleError(
        "This user does not have a valid MongoDB ID. Please check the backend /api/users response."
      );
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

    setScheduleStart(schedule?.startTime || user?.attendanceSettings?.attendanceTime || "09:00");
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

  // ==========================================================
  // SAVE SCHEDULE (SYNCS ALL RELEVANT USER FIELDS)
  // ==========================================================

  const saveSchedule = async () => {
    if (!scheduleUser) {
      setScheduleError("No user selected.");
      return;
    }

    const userId = getUserId(scheduleUser);

    if (!userId || !isValidMongoId(userId)) {
      setScheduleError(
        "Invalid MongoDB user ID. The backend must return the user's _id."
      );
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

      // Comprehensive payload supporting every schema variation
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

      // First attempt: Update user directly via PUT /api/users/:id
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

      // Fallback attempt: if PUT /users/:id returned 404, try /users/:id/attendance-schedule
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
          result?.message ||
            result?.error ||
            "You do not have permission to update this schedule."
        );
      }

      if (!response.ok || result?.success === false) {
        throw new Error(
          result?.message ||
            result?.error ||
            `Failed to save schedule. Status: ${response.status}`
        );
      }

      // Update in local state immediately
      setUsers((previousUsers) =>
        previousUsers.map((user) => {
          const currentId = getUserId(user);
          if (currentId !== userId) {
            return user;
          }
          return {
            ...user,
            attendanceSchedule: updatedSchedule,
            workSchedule: updatedSchedule,
            attendanceSettings: {
              ...(user?.attendanceSettings || {}),
              attendanceTime: scheduleStart,
            },
            preferences: {
              ...(user?.preferences || {}),
              attendanceSchedule: updatedSchedule,
              workSchedule: updatedSchedule,
            },
          };
        })
      );

      setScheduleUser((previousUser) => {
        if (!previousUser) return previousUser;
        return {
          ...previousUser,
          attendanceSchedule: updatedSchedule,
          workSchedule: updatedSchedule,
          attendanceSettings: {
            ...(previousUser?.attendanceSettings || {}),
            attendanceTime: scheduleStart,
          },
          preferences: {
            ...(previousUser?.preferences || {}),
            attendanceSchedule: updatedSchedule,
            workSchedule: updatedSchedule,
          },
        };
      });

      setScheduleSuccess("Attendance schedule saved successfully.");
    } catch (requestError) {
      console.error("SAVE ATTENDANCE SCHEDULE ERROR:", requestError);
      setScheduleError(
        requestError?.message || "Unable to save attendance schedule."
      );
    } finally {
      setSavingSchedule(false);
    }
  };

  return (
    <>
      <main className="w-full min-w-0 p-5 sm:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-7xl space-y-6">
          {/* PAGE HEADER */}
          <section className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#2563EB]">
                ADMINISTRATION
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
                Users
              </h1>
              <p className="mt-2 text-sm text-[#64748B]">
                Manage users, workspace roles and attendance schedules.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-3">
              <button
                type="button"
                onClick={loadUsers}
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#26344D] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <RefreshCw size={17} />
                )}
                Refresh
              </button>

              <Link
                href="/admin/users/new"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#1D4ED8]"
              >
                <Plus size={18} />
                Add User
              </Link>
            </div>
          </section>

          {/* ERROR */}
          {error && (
            <section className="rounded-2xl border border-red-100 bg-red-50 p-5">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-red-700">
                    Unable to load users
                  </h2>
                  <p className="mt-1 break-words text-sm text-red-600">
                    {error}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadUsers}
                  disabled={loading}
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                >
                  <RefreshCw size={16} />
                  Try Again
                </button>
              </div>
            </section>
          )}

          {/* STATS */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UserStat
              icon={Users}
              title="Total Users"
              value={totalUsers}
              loading={loading}
              description="Users returned by backend"
            />

            <UserStat
              icon={ShieldCheck}
              title="Active Users"
              value={activeUsers}
              loading={loading}
              description="Currently active accounts"
            />
          </section>

          {/* FILTERS */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search users..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="h-11 w-full shrink-0 rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#64748B] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 sm:w-auto"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="user">User</option>
              </select>

              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-11 w-full shrink-0 rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#64748B] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 sm:w-auto"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D]"
              >
                <SlidersHorizontal size={17} />
                Clear Filters
              </button>
            </div>
          </section>

          {/* USERS TABLE */}
          <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-[#171B3A]">
                    Workspace Users
                  </h2>
                  <p className="mt-1 text-sm text-[#64748B]">
                    {loading
                      ? "Loading users from backend..."
                      : `${filteredUsers.length} user${
                          filteredUsers.length !== 1 ? "s" : ""
                        } displayed.`}
                  </p>
                </div>

                {!loading && (
                  <span className="inline-flex w-fit shrink-0 rounded-full bg-[#EEF4FF] px-3 py-1 text-xs font-bold text-[#2563EB]">
                    {users.length} Total
                  </span>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
                <Loader2 size={30} className="animate-spin text-[#2563EB]" />
                <h3 className="mt-4 text-sm font-bold text-[#171B3A]">
                  Loading users
                </h3>
                <p className="mt-2 text-sm text-[#64748B]">
                  Fetching real user records from the backend.
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[950px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400 sm:px-6">
                        User
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                        Role
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                        Status
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                        Schedule
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                        Joined
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user, index) => {
                        const realUserId = getUserId(user);
                        const rowKey =
                          realUserId || user?.email || `user-${index}`;

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

                        const canSchedule = Boolean(
                          realUserId && isValidMongoId(realUserId)
                        );

                        return (
                          <tr
                            key={rowKey}
                            className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50"
                          >
                            {/* USER */}
                            <td className="px-5 py-4 sm:px-6">
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EEF4FF] text-sm font-bold text-[#2563EB]">
                                  {user?.avatar ? (
                                    <img
                                      src={user.avatar}
                                      alt={user?.name || "User"}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    getInitials(user?.name)
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-[#171B3A]">
                                    {user?.name || "Unnamed User"}
                                  </p>
                                  <p className="truncate text-xs text-[#64748B]">
                                    {user?.email || "No email available"}
                                  </p>
                                  {!realUserId && (
                                    <p className="mt-1 text-[10px] font-semibold text-red-500">
                                      Backend did not return a valid MongoDB ID
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* ROLE */}
                            <td className="px-5 py-4">
                              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-[#26344D]">
                                {user?.role || "user"}
                              </span>
                            </td>

                            {/* STATUS */}
                            <td className="px-5 py-4">
                              <StatusBadge status={getUserStatus(user)} />
                            </td>

                            {/* SCHEDULE */}
                            <td className="px-5 py-4">
                              {hasSchedule ? (
                                <div>
                                  <p className="text-sm font-semibold text-[#26344D]">
                                    {userSchedule.startTime}
                                    {" - "}
                                    {userSchedule.endTime}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-400">
                                    Window:{" "}
                                    {userSchedule.windowStart || "—"}
                                    {" - "}
                                    {userSchedule.windowEnd || "—"}
                                  </p>
                                </div>
                              ) : (
                                <span className="inline-flex rounded-full bg-yellow-50 px-3 py-1 text-xs font-bold text-yellow-700">
                                  Not Set
                                </span>
                              )}
                            </td>

                            {/* JOINED */}
                            <td className="whitespace-nowrap px-5 py-4 text-sm text-[#64748B]">
                              {formatDate(user?.createdAt)}
                            </td>

                            {/* ACTIONS */}
                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {canSchedule ? (
                                  <>
                                    <Link
                                      href={`/admin/users/${realUserId}`}
                                      className="rounded-lg px-3 py-2 text-xs font-bold text-[#2563EB] transition hover:bg-[#EEF4FF]"
                                    >
                                      View
                                    </Link>

                                    <button
                                      type="button"
                                      onClick={() => openSchedule(user)}
                                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-[#2563EB] transition hover:bg-[#EEF4FF]"
                                    >
                                      <CalendarClock size={15} />
                                      Schedule
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-xs font-semibold text-red-500">
                                    Invalid User ID
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6}>
                          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                              <Users size={25} />
                            </div>

                            <h3 className="mt-4 text-sm font-bold text-[#171B3A]">
                              {users.length === 0
                                ? "No users available"
                                : "No matching users"}
                            </h3>

                            <p className="mt-2 max-w-sm text-sm leading-6 text-[#64748B]">
                              {users.length === 0
                                ? "There are currently no user records available from the backend."
                                : "Try changing your search or filters."}
                            </p>

                            {(search ||
                              role !== "all" ||
                              status !== "all") && (
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
        </div>
      </main>

      {/* ========================================================
          SCHEDULE MODAL
      ======================================================== */}
      {scheduleUser && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                    <CalendarClock size={19} />
                  </div>

                  <div className="min-w-0">
                    <h2 className="truncate font-bold text-[#171B3A]">
                      Attendance Schedule
                    </h2>
                    <p className="truncate text-xs text-slate-500">
                      {scheduleUser?.name || "User"}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={closeSchedule}
                disabled={savingSchedule}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
                aria-label="Close schedule"
              >
                <X size={19} />
              </button>
            </div>

            {/* BODY */}
            <div className="space-y-5 p-5">
              {/* ERROR */}
              {scheduleError && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <p className="text-sm font-medium">{scheduleError}</p>
                </div>
              )}

              {/* SUCCESS */}
              {scheduleSuccess && (
                <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-3 text-green-700">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                  <p className="text-sm font-medium">{scheduleSuccess}</p>
                </div>
              )}

              {/* WORK SCHEDULE */}
              <div>
                <div className="mb-3">
                  <h3 className="text-sm font-bold text-[#26344D]">
                    Work Schedule
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Set the employee's normal working hours.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#26344D]">
                      Work Start
                    </label>
                    <input
                      type="time"
                      value={scheduleStart}
                      onChange={(event) =>
                        setScheduleStart(event.target.value)
                      }
                      disabled={savingSchedule}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#26344D]">
                      Work End
                    </label>
                    <input
                      type="time"
                      value={scheduleEnd}
                      onChange={(event) =>
                        setScheduleEnd(event.target.value)
                      }
                      disabled={savingSchedule}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
                    />
                  </div>
                </div>
              </div>

              {/* ATTENDANCE WINDOW */}
              <div>
                <div className="mb-3">
                  <h3 className="text-sm font-bold text-[#26344D]">
                    Attendance Check-in Window
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Define the allowed check-in time window.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#26344D]">
                      Window Start
                    </label>
                    <input
                      type="time"
                      value={windowStart}
                      onChange={(event) =>
                        setWindowStart(event.target.value)
                      }
                      disabled={savingSchedule}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#26344D]">
                      Window End
                    </label>
                    <input
                      type="time"
                      value={windowEnd}
                      onChange={(event) =>
                        setWindowEnd(event.target.value)
                      }
                      disabled={savingSchedule}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
                    />
                  </div>
                </div>
              </div>

              {/* INFO */}
              <div className="rounded-xl bg-[#EEF4FF] p-4">
                <p className="text-xs leading-5 text-[#26344D]">
                  <span className="font-bold">Example:</span> Work time 09:00 -
                  17:00 and check-in window 08:45 - 09:30. The attendance system
                  can use this schedule to determine whether the employee is on
                  time or late.
                </p>
              </div>
            </div>

            {/* FOOTER */}
            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeSchedule}
                disabled={savingSchedule}
                className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveSchedule}
                disabled={savingSchedule}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingSchedule ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Save size={17} />
                )}
                {savingSchedule ? "Saving..." : "Save Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// USER STAT
// ============================================================

function UserStat({ icon: Icon, title, value, loading, description }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
        <Icon size={21} />
      </div>

      <p className="mt-5 text-sm font-medium text-[#64748B]">{title}</p>

      <div className="mt-1 flex h-9 items-center">
        {loading ? (
          <Loader2 size={22} className="animate-spin text-[#2563EB]" />
        ) : (
          <p className="text-2xl font-bold text-[#171B3A]">{value}</p>
        )}
      </div>

      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </div>
  );
}

// ============================================================
// USER STATUS
// ============================================================

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

// ============================================================
// INITIALS
// ============================================================

function getInitials(name) {
  if (!name) {
    return "U";
  }

  const words = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }

  return (
    words[0].charAt(0) + words[words.length - 1].charAt(0)
  ).toUpperCase();
}

// ============================================================
// STATUS BADGE
// ============================================================

function StatusBadge({ status }) {
  const active = String(status || "").toLowerCase() === "active";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
        active
          ? "bg-green-50 text-green-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      {status}
    </span>
  );
}

// ============================================================
// DATE FORMAT
// ============================================================

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}