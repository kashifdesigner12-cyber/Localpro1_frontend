"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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
  if (!date) return "-";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (date) => {
  if (!date) return "-";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getAuthHeaders = () => {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token")
      : null;

  return {
    "Content-Type": "application/json",
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
};

// ==========================================================
// MAIN
// ==========================================================

export default function AdminAttendancePage() {
  const [attendance, setAttendance] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [selectedDate, setSelectedDate] =
    useState(getTodayString());

  // ========================================================
  // EDIT ATTENDANCE
  // ========================================================

  const [editingAttendance, setEditingAttendance] =
    useState(null);

  const [editStatus, setEditStatus] =
    useState("Pending");

  const [editNotes, setEditNotes] =
    useState("");

  const [saving, setSaving] = useState(false);

  // ========================================================
  // SCHEDULE MODAL
  // ========================================================

  const [scheduleUser, setScheduleUser] =
    useState(null);

  const [scheduleEnabled, setScheduleEnabled] =
    useState(true);

  const [scheduleTime, setScheduleTime] =
    useState("10:00");

  const [gracePeriod, setGracePeriod] =
    useState("10");

  const [scheduleTimezone, setScheduleTimezone] =
    useState("Asia/Karachi");

  const [scheduleLoading, setScheduleLoading] =
    useState(false);

  const [scheduleSaving, setScheduleSaving] =
    useState(false);

  // ========================================================
  // FETCH ATTENDANCE
  // ========================================================

  const fetchAttendance = async (
    showRefresh = false
  ) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await fetch(
        `${API_URL}/api/attendance?startDate=${selectedDate}&endDate=${selectedDate}&limit=100`,
        {
          method: "GET",
          headers: getAuthHeaders(),
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Failed to load attendance."
        );
      }

      setAttendance(
        Array.isArray(data?.attendance)
          ? data.attendance
          : Array.isArray(data?.data)
          ? data.data
          : []
      );
    } catch (err) {
      console.error(
        "fetchAttendance error:",
        err
      );

      setError(
        err.message ||
          "Unable to load attendance."
      );

      setAttendance([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [selectedDate]);

  // ========================================================
  // FILTER
  // ========================================================

  const filteredAttendance = useMemo(() => {
    return attendance.filter((item) => {
      const user = item?.user;

      const name =
        user?.name?.toLowerCase() || "";

      const email =
        user?.email?.toLowerCase() || "";

      const searchValue =
        search.toLowerCase().trim();

      const matchesSearch =
        !searchValue ||
        name.includes(searchValue) ||
        email.includes(searchValue);

      const matchesStatus =
        statusFilter === "All" ||
        item?.status === statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    attendance,
    search,
    statusFilter,
  ]);

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
      halfDay: 0,
      leave: 0,
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

        case "Half Day":
          result.halfDay++;
          break;

        case "Leave":
          result.leave++;
          break;

        default:
          break;
      }
    });

    return result;
  }, [attendance]);

  // ========================================================
  // EDIT ATTENDANCE
  // ========================================================

  const openEdit = (item) => {
    setEditingAttendance(item);

    setEditStatus(
      item?.status || "Pending"
    );

    setEditNotes(
      item?.notes || ""
    );
  };

  const closeEdit = () => {
    if (saving) return;

    setEditingAttendance(null);
    setEditStatus("Pending");
    setEditNotes("");
  };

  // ========================================================
  // UPDATE ATTENDANCE
  // ========================================================

  const updateAttendance = async () => {
    if (!editingAttendance?.id) {
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `${API_URL}/api/attendance/${editingAttendance.id}`,
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
        throw new Error(
          data?.message ||
            "Failed to update attendance."
        );
      }

      const updated =
        data?.attendance ||
        data?.data;

      if (updated) {
        setAttendance((prev) =>
          prev.map((item) =>
            item.id === updated.id
              ? updated
              : item
          )
        );
      } else {
        await fetchAttendance(true);
      }

      closeEdit();
    } catch (err) {
      console.error(
        "updateAttendance error:",
        err
      );

      alert(
        err.message ||
          "Failed to update attendance."
      );
    } finally {
      setSaving(false);
    }
  };

  // ========================================================
  // DELETE ATTENDANCE
  // ========================================================

  const deleteAttendance = async (item) => {
    if (!item?.id) return;

    const userName =
      item?.user?.name ||
      "this user";

    const confirmed =
      window.confirm(
        `Are you sure you want to delete attendance for ${userName}?`
      );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_URL}/api/attendance/${item.id}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Failed to delete attendance."
        );
      }

      setAttendance((prev) =>
        prev.filter(
          (record) =>
            record.id !== item.id
        )
      );
    } catch (err) {
      console.error(
        "deleteAttendance error:",
        err
      );

      alert(
        err.message ||
          "Failed to delete attendance."
      );
    }
  };

  // ========================================================
  // OPEN SCHEDULE
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
        `${API_URL}/api/attendance/user/${user.id}/schedule`,
        {
          method: "GET",
          headers: getAuthHeaders(),
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Failed to load attendance schedule."
        );
      }

      const settings =
        data?.attendanceSettings || {};

      setScheduleEnabled(
        settings.enabled !== false
      );

      setScheduleTime(
        settings.attendanceTime ||
          "10:00"
      );

      setGracePeriod(
        String(
          settings.gracePeriodMinutes ??
            10
        )
      );

      setScheduleTimezone(
        settings.timezone ||
          "Asia/Karachi"
      );
    } catch (err) {
      console.error(
        "openSchedule error:",
        err
      );

      alert(
        err.message ||
          "Failed to load user schedule."
      );
    } finally {
      setScheduleLoading(false);
    }
  };

  const closeSchedule = () => {
    if (scheduleSaving) return;

    setScheduleUser(null);
    setScheduleLoading(false);
  };

  // ========================================================
  // SAVE USER SCHEDULE
  // ========================================================

  const saveSchedule = async () => {
    if (!scheduleUser?.id) {
      return;
    }

    if (
      scheduleEnabled &&
      !scheduleTime
    ) {
      alert(
        "Please select attendance time."
      );

      return;
    }

    const grace =
      Number(gracePeriod);

    if (
      !Number.isInteger(grace) ||
      grace < 1 ||
      grace > 60
    ) {
      alert(
        "Grace period must be between 1 and 60 minutes."
      );

      return;
    }

    try {
      setScheduleSaving(true);

      const response = await fetch(
        `${API_URL}/api/attendance/user/${scheduleUser.id}/schedule`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          credentials: "include",
          body: JSON.stringify({
            enabled: scheduleEnabled,
            attendanceTime:
              scheduleEnabled
                ? scheduleTime
                : "",
            gracePeriodMinutes: grace,
            timezone:
              scheduleTimezone ||
              "Asia/Karachi",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Failed to save attendance schedule."
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
      console.error(
        "saveSchedule error:",
        err
      );

      alert(
        err.message ||
          "Failed to save attendance schedule."
      );
    } finally {
      setScheduleSaving(false);
    }
  };

  // ========================================================
  // STATUS BADGE
  // ========================================================

  const statusBadge = (status) => {
    const classes = {
      Present:
        "bg-green-50 text-green-700 border-green-200",

      Absent:
        "bg-red-50 text-red-700 border-red-200",

      Late:
        "bg-orange-50 text-orange-700 border-orange-200",

      Pending:
        "bg-yellow-50 text-yellow-700 border-yellow-200",

      "Half Day":
        "bg-purple-50 text-purple-700 border-purple-200",

      Leave:
        "bg-blue-50 text-blue-700 border-blue-200",
    };

    return (
      <span
        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
          classes[status] ||
          "bg-gray-50 text-gray-700 border-gray-200"
        }`}
      >
        {status || "Pending"}
      </span>
    );
  };

  // ========================================================
  // STAT CARD
  // ========================================================

  const StatCard = ({
    title,
    value,
    icon: Icon,
  }) => {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              {title}
            </p>

            <h3 className="mt-2 text-3xl font-bold text-[#171B3A]">
              {value}
            </h3>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF4FF]">
            <Icon
              size={23}
              className="text-blue-600"
            />
          </div>
        </div>
      </div>
    );
  };

  // ========================================================
  // RENDER
  // ========================================================

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">

      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#171B3A] md:text-3xl">
            Attendance
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage employee schedules and monitor attendance.
          </p>
        </div>

        <button
          onClick={() =>
            fetchAttendance(true)
          }
          disabled={refreshing}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            size={18}
            className={
              refreshing
                ? "animate-spin"
                : ""
            }
          />

          Refresh
        </button>
      </div>

      {/* ====================================================
          ERROR
      ==================================================== */}

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle
            size={20}
            className="mt-0.5 shrink-0"
          />

          <div>
            <p className="font-semibold">
              Unable to load attendance
            </p>

            <p className="mt-1 text-sm">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* ====================================================
          DATE
      ==================================================== */}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#26344D]">
            <CalendarDays
              size={19}
              className="text-blue-600"
            />

            Attendance Date
          </div>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) =>
              setSelectedDate(
                e.target.value
              )
            }
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          {selectedDate ===
            getTodayString() && (
            <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
              Today
            </span>
          )}
        </div>
      </div>

      {/* ====================================================
          SUMMARY
      ==================================================== */}

      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total"
          value={summary.total}
          icon={Users}
        />

        <StatCard
          title="Present"
          value={summary.present}
          icon={UserCheck}
        />

        <StatCard
          title="Absent"
          value={summary.absent}
          icon={UserX}
        />

        <StatCard
          title="Late"
          value={summary.late}
          icon={Clock}
        />

        <StatCard
          title="Pending"
          value={summary.pending}
          icon={Hourglass}
        />
      </div>

      {/* ====================================================
          FILTERS
      ==================================================== */}

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search
              size={19}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Search by name or email..."
              className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value
              )
            }
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="All">
              All Status
            </option>

            <option value="Present">
              Present
            </option>

            <option value="Absent">
              Absent
            </option>

            <option value="Late">
              Late
            </option>

            <option value="Pending">
              Pending
            </option>

            <option value="Half Day">
              Half Day
            </option>

            <option value="Leave">
              Leave
            </option>
          </select>
        </div>
      </div>

      {/* ====================================================
          TABLE
      ==================================================== */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-[#171B3A]">
                Attendance Records
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {formatDate(selectedDate)} ·{" "}
                {filteredAttendance.length} record
                {filteredAttendance.length !== 1
                  ? "s"
                  : ""}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <RefreshCw
                size={20}
                className="animate-spin text-blue-600"
              />

              Loading attendance...
            </div>
          </div>
        ) : filteredAttendance.length ===
          0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-5 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <CalendarDays
                size={25}
                className="text-slate-400"
              />
            </div>

            <h3 className="mt-4 font-semibold text-[#26344D]">
              No attendance records
            </h3>

            <p className="mt-1 max-w-md text-sm text-slate-500">
              There are no attendance records matching your current filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px]">

              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    Employee
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    Scheduled
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    Check In
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    Check Out
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>

                </tr>
              </thead>

              <tbody>
                {filteredAttendance.map(
                  (item) => {
                    const user =
                      item?.user;

                    return (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 transition hover:bg-slate-50"
                      >

                        {/* EMPLOYEE */}

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">

                            {user?.avatar ? (
                              <img
                                src={
                                  user.avatar
                                }
                                alt={
                                  user.name ||
                                  "User"
                                }
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF4FF] font-bold text-blue-600">
                                {(
                                  user?.name ||
                                  "U"
                                )
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                            )}

                            <div>
                              <p className="font-semibold text-[#26344D]">
                                {user?.name ||
                                  "Unknown User"}
                              </p>

                              <p className="text-xs text-slate-500">
                                {user?.email ||
                                  "-"}
                              </p>
                            </div>

                          </div>
                        </td>

                        {/* SCHEDULED */}

                        <td className="px-5 py-4">
                          <div className="text-sm font-medium text-[#26344D]">
                            {formatTime(
                              item.scheduledTime
                            )}
                          </div>

                          {item.windowStart &&
                            item.windowEnd && (
                              <div className="mt-1 text-xs text-slate-400">
                                Until{" "}
                                {formatTime(
                                  item.windowEnd
                                )}
                              </div>
                            )}
                        </td>

                        {/* CHECK IN */}

                        <td className="px-5 py-4">
                          <span className="text-sm font-medium text-[#26344D]">
                            {formatTime(
                              item.checkIn
                            )}
                          </span>
                        </td>

                        {/* CHECK OUT */}

                        <td className="px-5 py-4">
                          <span className="text-sm font-medium text-[#26344D]">
                            {formatTime(
                              item.checkOut
                            )}
                          </span>
                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-4">
                          {statusBadge(
                            item.status
                          )}
                        </td>

                        {/* ACTIONS */}

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">

                            {/* SET SCHEDULE */}

                            {user?.id && (
                              <button
                                onClick={() =>
                                  openSchedule(
                                    user
                                  )
                                }
                                title="Set attendance schedule"
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                              >
                                <Settings2
                                  size={16}
                                />
                              </button>
                            )}

                            {/* EDIT ATTENDANCE */}

                            <button
                              onClick={() =>
                                openEdit(item)
                              }
                              title="Edit attendance"
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                            >
                              <Pencil
                                size={16}
                              />
                            </button>

                            {/* DELETE */}

                            <button
                              onClick={() =>
                                deleteAttendance(
                                  item
                                )
                              }
                              title="Delete attendance"
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2
                                size={16}
                              />
                            </button>

                          </div>
                        </td>

                      </tr>
                    );
                  }
                )}
              </tbody>

            </table>
          </div>
        )}
      </div>

      {/* ====================================================
          EDIT ATTENDANCE MODAL
      ==================================================== */}

      {editingAttendance && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4">

          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">

            {/* HEADER */}

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">

              <div>
                <h2 className="font-bold text-[#171B3A]">
                  Edit Attendance
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {editingAttendance?.user?.name ||
                    "User"}
                </p>
              </div>

              <button
                onClick={closeEdit}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X size={19} />
              </button>

            </div>

            {/* BODY */}

            <div className="space-y-5 p-5">

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#26344D]">
                  Status
                </label>

                <select
                  value={editStatus}
                  onChange={(e) =>
                    setEditStatus(
                      e.target.value
                    )
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="Pending">
                    Pending
                  </option>

                  <option value="Present">
                    Present
                  </option>

                  <option value="Absent">
                    Absent
                  </option>

                  <option value="Late">
                    Late
                  </option>

                  <option value="Half Day">
                    Half Day
                  </option>

                  <option value="Leave">
                    Leave
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#26344D]">
                  Notes
                </label>

                <textarea
                  value={editNotes}
                  onChange={(e) =>
                    setEditNotes(
                      e.target.value
                    )
                  }
                  rows={4}
                  placeholder="Add attendance notes..."
                  className="w-full resize-none rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

            </div>

            {/* FOOTER */}

            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">

              <button
                onClick={closeEdit}
                disabled={saving}
                className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={updateAttendance}
                disabled={saving}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <RefreshCw
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <CheckCircle2
                    size={17}
                  />
                )}

                {saving
                  ? "Saving..."
                  : "Save Changes"}
              </button>

            </div>

          </div>
        </div>
      )}

      {/* ====================================================
          USER SCHEDULE MODAL
      ==================================================== */}

      {scheduleUser && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/40 p-4">

          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">

            {/* MODAL HEADER */}

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF4FF] text-blue-600">
                  <UserCog size={21} />
                </div>

                <div>
                  <h2 className="font-bold text-[#171B3A]">
                    Attendance Schedule
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    {scheduleUser.name}
                    {scheduleUser.email
                      ? ` · ${scheduleUser.email}`
                      : ""}
                  </p>
                </div>

              </div>

              <button
                onClick={closeSchedule}
                disabled={scheduleSaving}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X size={19} />
              </button>

            </div>

            {/* LOADING */}

            {scheduleLoading ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <RefreshCw
                    size={19}
                    className="animate-spin text-blue-600"
                  />

                  Loading schedule...
                </div>
              </div>
            ) : (
              <>
                {/* BODY */}

                <div className="space-y-5 p-5">

                  {/* ENABLE */}

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

                    <div className="flex items-center justify-between gap-4">

                      <div className="flex items-center gap-3">

                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            scheduleEnabled
                              ? "bg-green-100 text-green-600"
                              : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          <Power size={19} />
                        </div>

                        <div>
                          <p className="text-sm font-bold text-[#26344D]">
                            Attendance Schedule
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {scheduleEnabled
                              ? "User attendance schedule is active."
                              : "User attendance schedule is disabled."}
                          </p>
                        </div>

                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setScheduleEnabled(
                            (prev) => !prev
                          )
                        }
                        className={`relative h-7 w-12 rounded-full transition ${
                          scheduleEnabled
                            ? "bg-blue-600"
                            : "bg-slate-300"
                        }`}
                        aria-label="Toggle attendance schedule"
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                            scheduleEnabled
                              ? "left-6"
                              : "left-1"
                          }`}
                        />
                      </button>

                    </div>

                  </div>

                  {/* TIME */}

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#26344D]">
                      Check-in Time
                    </label>

                    <div className="relative">

                      <Clock
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        type="time"
                        value={
                          scheduleTime
                        }
                        disabled={
                          !scheduleEnabled
                        }
                        onChange={(e) =>
                          setScheduleTime(
                            e.target.value
                          )
                        }
                        className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />

                    </div>

                    <p className="mt-1.5 text-xs text-slate-500">
                      Example: 10:10 AM
                    </p>
                  </div>

                  {/* GRACE PERIOD */}

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#26344D]">
                      Grace Period
                    </label>

                    <div className="relative">

                      <Hourglass
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={
                          gracePeriod
                        }
                        disabled={
                          !scheduleEnabled
                        }
                        onChange={(e) =>
                          setGracePeriod(
                            e.target.value
                          )
                        }
                        className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />

                    </div>

                    <p className="mt-1.5 text-xs text-slate-500">
                      After the grace period expires, Pending attendance will automatically become Absent.
                    </p>
                  </div>

                  {/* TIMEZONE */}

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#26344D]">
                      Timezone
                    </label>

                    <select
                      value={
                        scheduleTimezone
                      }
                      onChange={(e) =>
                        setScheduleTimezone(
                          e.target.value
                        )
                      }
                      disabled={
                        !scheduleEnabled
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      <option value="Asia/Karachi">
                        Asia/Karachi (Pakistan)
                      </option>

                      <option value="UTC">
                        UTC
                      </option>

                      <option value="Asia/Dubai">
                        Asia/Dubai
                      </option>

                      <option value="Asia/Kolkata">
                        Asia/Kolkata
                      </option>

                      <option value="Europe/London">
                        Europe/London
                      </option>

                      <option value="America/New_York">
                        America/New_York
                      </option>

                      <option value="America/Los_Angeles">
                        America/Los_Angeles
                      </option>
                    </select>
                  </div>

                  {/* PREVIEW */}

                  {scheduleEnabled && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">

                      <div className="flex items-start gap-3">

                        <div className="mt-0.5">
                          <CheckCircle2
                            size={19}
                            className="text-blue-600"
                          />
                        </div>

                        <div>
                          <p className="text-sm font-bold text-blue-900">
                            Schedule Preview
                          </p>

                          <p className="mt-1 text-sm text-blue-800">
                            {scheduleUser.name} can check in until{" "}
                            <strong>
                              {(() => {
                                if (
                                  !scheduleTime
                                ) {
                                  return "-";
                                }

                                const [
                                  hours,
                                  minutes,
                                ] =
                                  scheduleTime
                                    .split(
                                      ":"
                                    )
                                    .map(
                                      Number
                                    );

                                const date =
                                  new Date();

                                date.setHours(
                                  hours,
                                  minutes,
                                  0,
                                  0
                                );

                                const grace =
                                  Number(
                                    gracePeriod
                                  ) || 0;

                                date.setMinutes(
                                  date.getMinutes() +
                                    grace
                                );

                                return date.toLocaleTimeString(
                                  [],
                                  {
                                    hour: "2-digit",
                                    minute:
                                      "2-digit",
                                  }
                                );
                              })()}
                            </strong>
                            . After that, the system will mark the attendance as{" "}
                            <strong>
                              Absent
                            </strong>
                            .
                          </p>

                        </div>

                      </div>

                    </div>
                  )}

                </div>

                {/* FOOTER */}

                <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">

                  <button
                    onClick={closeSchedule}
                    disabled={
                      scheduleSaving
                    }
                    className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={saveSchedule}
                    disabled={
                      scheduleSaving
                    }
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {scheduleSaving ? (
                      <RefreshCw
                        size={17}
                        className="animate-spin"
                      />
                    ) : (
                      <Save size={17} />
                    )}

                    {scheduleSaving
                      ? "Saving..."
                      : "Save Schedule"}
                  </button>

                </div>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  );
}