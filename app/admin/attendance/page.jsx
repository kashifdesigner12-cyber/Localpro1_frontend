"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  CalendarDays,
  Search,
  RefreshCw,
  Users,
  UserCheck,
  UserX,
  Clock,
  Hourglass,
  Trash2,
  Pencil,
  X,
  CheckCircle2,
  AlertCircle,
  Settings2,
  UserCog,
  Save,
  Power,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  Loader2,
} from "lucide-react";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "https://api.localpro1.net/api"
).replace(/\/+$/, "");

const CACHE_TIME = 30 * 1000;

// ==========================================================
// HELPERS
// ==========================================================

const getTodayString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatTime = (date) => {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (date) => {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getAuthHeaders = () => {
  let token = null;

  if (typeof window !== "undefined") {
    token =
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("auth_token") ||
      localStorage.getItem("jwt") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("accessToken") ||
      sessionStorage.getItem("access_token") ||
      sessionStorage.getItem("authToken") ||
      sessionStorage.getItem("auth_token") ||
      sessionStorage.getItem("jwt");
  }

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

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

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex justify-between">
        <div>
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="mt-3 h-8 w-20 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-28 rounded bg-slate-100" />
        </div>
        <div className="h-12 w-12 rounded-2xl bg-slate-200" />
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const classes = {
    Present: "bg-emerald-50 text-emerald-600 border-emerald-100",
    Absent: "bg-rose-50 text-rose-600 border-rose-100",
    Late: "bg-orange-50 text-orange-600 border-orange-100",
    Pending: "bg-amber-50 text-amber-600 border-amber-100",
    "Half Day": "bg-purple-50 text-purple-600 border-purple-100",
    Leave: "bg-violet-50 text-violet-600 border-violet-100",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${
        classes[status] || "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      {status || "Pending"}
    </span>
  );
}

// ==========================================================
// MAIN COMPONENT
// ==========================================================

export default function AdminAttendancePage() {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false); // Instant render enabled
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedDate, setSelectedDate] = useState(getTodayString());

  // Edit attendance state
  const [editingAttendance, setEditingAttendance] = useState(null);
  const [editStatus, setEditStatus] = useState("Pending");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Schedule modal state
  const [scheduleUser, setScheduleUser] = useState(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleTime, setScheduleTime] = useState("10:00");
  const [gracePeriod, setGracePeriod] = useState("10");
  const [scheduleTimezone, setScheduleTimezone] = useState("Asia/Karachi");
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const cacheRef = useRef({});
  const loadingRef = useRef(false);

  // ========================================================
  // FETCH ATTENDANCE (SPEED + CACHE OPTIMIZED)
  // ========================================================

  const fetchAttendance = useCallback(
    async (force = false) => {
      if (loadingRef.current) return;

      const now = Date.now();
      const cached = cacheRef.current[selectedDate];

      if (!force && cached && now - cached.timestamp < CACHE_TIME) {
        setAttendance(cached.data);
        return;
      }

      loadingRef.current = true;
      if (force) {
        setRefreshing(true);
      }
      setError("");

      try {
        const response = await fetch(
          `${API_URL}/attendance?startDate=${selectedDate}&endDate=${selectedDate}&limit=100`,
          {
            method: "GET",
            headers: getAuthHeaders(),
            credentials: "include",
            cache: "no-store",
          }
        );

        let data = null;
        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (response.status === 401) {
          window.location.replace("/login");
          return;
        }

        if (!response.ok) {
          throw new Error(data?.message || "Failed to load attendance.");
        }

        const records = Array.isArray(data?.attendance)
          ? data.attendance
          : Array.isArray(data?.data)
          ? data.data
          : [];

        setAttendance(records);
        cacheRef.current[selectedDate] = {
          timestamp: Date.now(),
          data: records,
        };
      } catch (err) {
        console.error("fetchAttendance error:", err);
        setError(err.message || "Unable to load attendance.");
        setAttendance([]);
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedDate]
  );

  useEffect(() => {
    fetchAttendance(false);
  }, [fetchAttendance]);

  // ========================================================
  // FILTER
  // ========================================================

  const filteredAttendance = useMemo(() => {
    const searchValue = search.toLowerCase().trim();

    return attendance.filter((item) => {
      const user = item?.user;
      const name = user?.name?.toLowerCase() || "";
      const email = user?.email?.toLowerCase() || "";

      const matchesSearch =
        !searchValue || name.includes(searchValue) || email.includes(searchValue);

      const matchesStatus =
        statusFilter === "All" || item?.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [attendance, search, statusFilter]);

  // ========================================================
  // SUMMARY
  // ========================================================

  const summary = useMemo(() => {
    const result = {
      total: attendance.length,
      present: 0,
      absent: 0,
      late: 0,
      pending: 0,
    };

    attendance.forEach((item) => {
      switch (item?.status) {
        case "Present":
          result.present++;
          break;
        case "Absent":
          result.absent++;
          break;
        case "Late":
          result.late++;
          break;
        case "Pending":
          result.pending++;
          break;
        default:
          break;
      }
    });

    return result;
  }, [attendance]);

  // ========================================================
  // EDIT ATTENDANCE MODAL
  // ========================================================

  const openEdit = (item) => {
    setEditingAttendance(item);
    setEditStatus(item?.status || "Pending");
    setEditNotes(item?.notes || "");
  };

  const closeEdit = () => {
    if (saving) return;
    setEditingAttendance(null);
    setEditStatus("Pending");
    setEditNotes("");
  };

  const updateAttendance = async () => {
    if (!editingAttendance?.id) return;

    try {
      setSaving(true);

      const response = await fetch(
        `${API_URL}/attendance/${editingAttendance.id}`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          credentials: "include",
          body: JSON.stringify({
            status: editStatus,
            notes: editNotes,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to update attendance.");
      }

      const updated = data?.attendance || data?.data;

      if (updated) {
        setAttendance((prev) => {
          const next = prev.map((item) =>
            item.id === updated.id ? updated : item
          );
          if (cacheRef.current[selectedDate]) {
            cacheRef.current[selectedDate].data = next;
          }
          return next;
        });
      } else {
        await fetchAttendance(true);
      }

      closeEdit();
    } catch (err) {
      console.error("updateAttendance error:", err);
      alert(err.message || "Failed to update attendance.");
    } finally {
      setSaving(false);
    }
  };

  // ========================================================
  // DELETE ATTENDANCE
  // ========================================================

  const deleteAttendance = async (item) => {
    if (!item?.id) return;

    const userName = item?.user?.name || "this user";
    const confirmed = window.confirm(
      `Are you sure you want to delete attendance for ${userName}?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/attendance/${item.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to delete attendance.");
      }

      setAttendance((prev) => {
        const next = prev.filter((record) => record.id !== item.id);
        if (cacheRef.current[selectedDate]) {
          cacheRef.current[selectedDate].data = next;
        }
        return next;
      });
    } catch (err) {
      console.error("deleteAttendance error:", err);
      alert(err.message || "Failed to delete attendance.");
    }
  };

  // ========================================================
  // SCHEDULE MODAL
  // ========================================================

  const openSchedule = async (user) => {
    if (!user?.id) return;

    setScheduleUser(user);
    setScheduleLoading(true);
    setScheduleEnabled(true);
    setScheduleTime("10:00");
    setGracePeriod("10");
    setScheduleTimezone("Asia/Karachi");

    try {
      const response = await fetch(
        `${API_URL}/attendance/user/${user.id}/schedule`,
        {
          method: "GET",
          headers: getAuthHeaders(),
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message || "Failed to load attendance schedule."
        );
      }

      const settings = data?.attendanceSettings || {};
      setScheduleEnabled(settings.enabled !== false);
      setScheduleTime(settings.attendanceTime || "10:00");
      setGracePeriod(String(settings.gracePeriodMinutes ?? 10));
      setScheduleTimezone(settings.timezone || "Asia/Karachi");
    } catch (err) {
      console.error("openSchedule error:", err);
      alert(err.message || "Failed to load user schedule.");
    } finally {
      setScheduleLoading(false);
    }
  };

  const closeSchedule = () => {
    if (scheduleSaving) return;
    setScheduleUser(null);
    setScheduleLoading(false);
  };

  const saveSchedule = async () => {
    if (!scheduleUser?.id) return;

    if (scheduleEnabled && !scheduleTime) {
      alert("Please select attendance time.");
      return;
    }

    const grace = Number(gracePeriod);
    if (!Number.isInteger(grace) || grace < 1 || grace > 60) {
      alert("Grace period must be between 1 and 60 minutes.");
      return;
    }

    try {
      setScheduleSaving(true);

      const response = await fetch(
        `${API_URL}/attendance/user/${scheduleUser.id}/schedule`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          credentials: "include",
          body: JSON.stringify({
            enabled: scheduleEnabled,
            attendanceTime: scheduleEnabled ? scheduleTime : "",
            gracePeriodMinutes: grace,
            timezone: scheduleTimezone || "Asia/Karachi",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message || "Failed to save attendance schedule."
        );
      }

      alert(
        scheduleEnabled
          ? `Attendance schedule saved for ${scheduleUser.name}.`
          : `Attendance schedule disabled for ${scheduleUser.name}.`
      );

      closeSchedule();
      await fetchAttendance(true);
    } catch (err) {
      console.error("saveSchedule error:", err);
      alert(err.message || "Failed to save attendance schedule.");
    } finally {
      setScheduleSaving(false);
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
              Attendance Records
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Manage employee daily sign-ins, configure schedules, and oversee grace periods.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => fetchAttendance(true)}
              disabled={refreshing}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/50 hover:text-violet-700 disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin text-violet-600" : ""}
              />
              Refresh
            </button>
          </div>
        </section>

        {/* =========================================================
            ALERTS
        ========================================================= */}
        {error && (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-100 bg-amber-50/90 p-4 text-amber-800 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle size={19} className="shrink-0 text-amber-600" />
              <p className="text-sm font-medium">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => fetchAttendance(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        {/* =========================================================
            SUMMARY / STATS
        ========================================================= */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {loading && attendance.length === 0 ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <StatCard
                title="Total"
                value={summary.total}
                subtitle="Scheduled today"
                icon={Users}
                gradient="from-violet-600 to-purple-500"
              />
              <StatCard
                title="Present"
                value={summary.present}
                subtitle="On time records"
                icon={UserCheck}
                gradient="from-emerald-500 to-teal-400"
              />
              <StatCard
                title="Absent"
                value={summary.absent}
                subtitle="Missed work shift"
                icon={UserX}
                gradient="from-rose-500 to-red-400"
              />
              <StatCard
                title="Late"
                value={summary.late}
                subtitle="Grace period breached"
                icon={Clock}
                gradient="from-orange-500 to-amber-400"
              />
              <StatCard
                title="Pending"
                value={summary.pending}
                subtitle="Shift active / waiting"
                icon={Hourglass}
                gradient="from-pink-500 to-fuchsia-500"
              />
            </>
          )}
        </section>

        {/* =========================================================
            DATE & FILTERS SECTION
        ========================================================= */}
        <section className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(45,35,100,0.05)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee by name or email..."
                className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 pl-11 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Date Input */}
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-slate-50/50 px-3.5 py-1">
                <CalendarDays size={16} className="text-violet-600" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-sm font-semibold text-slate-700 outline-none"
                />
                {selectedDate === getTodayString() ? (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                    Today
                  </span>
                ) : null}
              </div>

              {/* Status Select */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-11 rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 text-sm font-medium text-slate-600 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
              >
                <option value="All">All Status</option>
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
                <option value="Late">Late</option>
                <option value="Pending">Pending</option>
                <option value="Half Day">Half Day</option>
                <option value="Leave">Leave</option>
              </select>

              {(search || statusFilter !== "All" || selectedDate !== getTodayString()) ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("All");
                    setSelectedDate(getTodayString());
                  }}
                  className="inline-flex h-11 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-500 transition hover:border-violet-200 hover:bg-violet-50/50 hover:text-violet-600"
                >
                  <SlidersHorizontal size={14} />
                  Reset Filters
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {/* =========================================================
            ATTENDANCE TABLE
        ========================================================= */}
        <section className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Attendance Log</h2>
                <p className="text-xs text-slate-500">
                  {formatDate(selectedDate)} · {filteredAttendance.length} record
                  {filteredAttendance.length !== 1 ? "s" : ""} found
                </p>
              </div>

              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-600">
                {filteredAttendance.length} Entries
              </span>
            </div>
          </div>

          {loading && attendance.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center p-8">
              <Loader2 size={32} className="animate-spin text-violet-600" />
              <p className="mt-3 text-sm font-semibold text-slate-600">Loading daily attendance records...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Scheduled Window</th>
                    <th className="px-6 py-4">Check In</th>
                    <th className="px-6 py-4">Check Out</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80 text-sm">
                  {filteredAttendance.length > 0 ? (
                    filteredAttendance.map((item) => {
                      const user = item?.user;
                      return (
                        <tr
                          key={item.id}
                          className="transition hover:bg-violet-50/30"
                        >
                          {/* EMPLOYEE */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {user?.avatar ? (
                                <img
                                  src={user.avatar}
                                  alt={user.name || "User"}
                                  className="h-10 w-10 rounded-2xl object-cover shadow-sm"
                                />
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-md shadow-purple-500/10">
                                  {(user?.name || "U").charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="truncate font-bold text-slate-900">
                                  {user?.name || "Unknown User"}
                                </p>
                                <p className="truncate text-xs text-slate-400">
                                  {user?.email || "—"}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* SCHEDULED */}
                          <td className="px-6 py-4">
                            <div className="text-xs">
                              <span className="font-bold text-slate-800">
                                {formatTime(item.scheduledTime)}
                              </span>
                              {item.windowStart && item.windowEnd ? (
                                <span className="block text-slate-400">
                                  Until {formatTime(item.windowEnd)}
                                </span>
                              ) : null}
                            </div>
                          </td>

                          {/* CHECK IN */}
                          <td className="whitespace-nowrap px-6 py-4 text-xs font-semibold text-slate-700">
                            {formatTime(item.checkIn)}
                          </td>

                          {/* CHECK OUT */}
                          <td className="whitespace-nowrap px-6 py-4 text-xs font-semibold text-slate-700">
                            {formatTime(item.checkOut)}
                          </td>

                          {/* STATUS */}
                          <td className="px-6 py-4">
                            <StatusBadge status={item.status} />
                          </td>

                          {/* ACTIONS */}
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {user?.id ? (
                                <button
                                  type="button"
                                  onClick={() => openSchedule(user)}
                                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                                  title="Configure schedule"
                                >
                                  <Settings2 size={15} />
                                </button>
                              ) : null}

                              <button
                                type="button"
                                onClick={() => openEdit(item)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                                title="Edit record"
                              >
                                <Pencil size={15} />
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteAttendance(item)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 shadow-sm transition hover:bg-rose-100 hover:text-rose-700"
                                title="Delete record"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">
                          <CalendarDays size={22} />
                        </div>
                        <h3 className="mt-3 text-sm font-bold text-slate-800">
                          No attendance records found
                        </h3>
                        <p className="mt-1 text-xs text-slate-400">
                          No check-ins registered for the selected date or current filter set.
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
          EDIT ATTENDANCE MODAL
      ======================================================== */}
      {editingAttendance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-violet-50/50 via-purple-50/30 to-white px-6 py-5">
              <div>
                <h3 className="font-bold text-slate-900">Edit Attendance Record</h3>
                <p className="text-xs text-slate-500">
                  {editingAttendance?.user?.name || "Employee"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                disabled={saving}
                className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                >
                  <option value="Pending">Pending</option>
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="Late">Late</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Leave">Leave</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Notes / Observations
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={4}
                  placeholder="Reason or notes..."
                  className="w-full resize-none rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 text-sm leading-relaxed text-slate-700 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
              <button
                type="button"
                onClick={closeEdit}
                disabled={saving}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={updateAttendance}
                disabled={saving}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-violet-600 px-6 text-sm font-bold text-white shadow-md shadow-violet-600/20 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          USER SCHEDULE CONFIGURATION MODAL
      ======================================================== */}
      {scheduleUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-violet-50/50 via-purple-50/30 to-white px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-md shadow-purple-600/20">
                  <UserCog size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Attendance Schedule</h3>
                  <p className="text-xs text-slate-500">
                    {scheduleUser.name} {scheduleUser.email ? `· ${scheduleUser.email}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeSchedule}
                disabled={scheduleSaving}
                className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Loading */}
            {scheduleLoading ? (
              <div className="flex min-h-[280px] items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <RefreshCw size={20} className="animate-spin text-violet-600" />
                  Loading schedule settings...
                </div>
              </div>
            ) : (
              <>
                {/* Body */}
                <div className="space-y-5 p-6">
                  {/* Enable Switch */}
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            scheduleEnabled
                              ? "bg-emerald-100 text-emerald-600"
                              : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          <Power size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            Automatic Attendance Schedule
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {scheduleEnabled
                              ? "Schedule is actively enforcing deadlines."
                              : "Schedule is currently disabled."}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setScheduleEnabled((prev) => !prev)}
                        className={`relative h-7 w-12 rounded-full transition ${
                          scheduleEnabled ? "bg-violet-600" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                            scheduleEnabled ? "left-6" : "left-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Time & Grace */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                        Check-in Time
                      </label>
                      <div className="relative">
                        <Clock
                          size={16}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          type="time"
                          value={scheduleTime}
                          disabled={!scheduleEnabled}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 pl-10 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                        Grace Period (mins)
                      </label>
                      <div className="relative">
                        <Hourglass
                          size={16}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={gracePeriod}
                          disabled={!scheduleEnabled}
                          onChange={(e) => setGracePeriod(e.target.value)}
                          className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 pl-10 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Timezone */}
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                      Timezone
                    </label>
                    <select
                      value={scheduleTimezone}
                      disabled={!scheduleEnabled}
                      onChange={(e) => setScheduleTimezone(e.target.value)}
                      className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      <option value="Asia/Karachi">Asia/Karachi (Pakistan)</option>
                      <option value="UTC">UTC</option>
                      <option value="Asia/Dubai">Asia/Dubai</option>
                      <option value="Asia/Kolkata">Asia/Kolkata</option>
                      <option value="Europe/London">Europe/London</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="America/Los_Angeles">America/Los_Angeles</option>
                    </select>
                  </div>

                  {/* Preview Note */}
                  {scheduleEnabled ? (
                    <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
                      <div className="flex items-start gap-3">
                        <Sparkles size={17} className="mt-0.5 shrink-0 text-violet-600" />
                        <p className="text-xs leading-5 text-slate-600">
                          {scheduleUser.name} can sign in until{" "}
                          <strong className="text-violet-700">
                            {(() => {
                              if (!scheduleTime) return "—";
                              const [hours, minutes] = scheduleTime.split(":").map(Number);
                              const date = new Date();
                              date.setHours(hours, minutes, 0, 0);
                              const grace = Number(gracePeriod) || 0;
                              date.setMinutes(date.getMinutes() + grace);
                              return date.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              });
                            })()}
                          </strong>
                          . Unregistered check-ins after this cutoff will automatically mark as <strong>Absent</strong>.
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                  <button
                    type="button"
                    onClick={closeSchedule}
                    disabled={scheduleSaving}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveSchedule}
                    disabled={scheduleSaving}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl bg-violet-600 px-6 text-sm font-bold text-white shadow-md shadow-violet-600/20 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {scheduleSaving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    {scheduleSaving ? "Saving..." : "Save Schedule"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}