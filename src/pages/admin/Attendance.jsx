import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarDays,
  Clock3,
  Search,
  Download,
  RefreshCw,
  Users,
  Filter,
  AlertCircle,
} from "lucide-react";
import api from "../../services/api";

const todayInPakistan = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const getEmployeeName = (record) =>
  record.user?.name ||
  record.user?.fullName ||
  record.user?.email ||
  "Unknown employee";

const getStatus = (record) => {
  if (record.status) return String(record.status).toLowerCase();

  if (!record.checkIn) return "absent";
  if (record.checkOut) {
    const hours =
      (new Date(record.checkOut) - new Date(record.checkIn)) / 3600000;

    if (hours < 4) return "half_day";
  }

  return "present";
};

const formatTime = (value) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleTimeString("en-PK", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const getWorkingHours = (record) => {
  if (!record.checkIn) return "—";

  const start = new Date(record.checkIn).getTime();
  const end = record.checkOut
    ? new Date(record.checkOut).getTime()
    : Date.now();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return "—";
  }

  const minutes = Math.floor((end - start) / 60000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const statusLabel = (status) =>
  ({
    present: "Present",
    absent: "Absent",
    late: "Late",
    half_day: "Half Day",
    leave: "Leave",
  })[status] || status.replaceAll("_", " ");

const escapeCsv = (value) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

export default function AdminAttendance() {
  const [selectedDate, setSelectedDate] = useState(todayInPakistan);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const todayHeader = useMemo(
    () =>
      new Intl.DateTimeFormat("en", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    []
  );

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/attendance", {
        params: {
          startDate: selectedDate,
          endDate: selectedDate,
          limit: 200,
        },
      });

      const data = response.data;
      const attendance = Array.isArray(data?.attendance)
        ? data.attendance
        : Array.isArray(data?.data)
          ? data.data
          : [];

      setRecords(attendance);
    } catch (err) {
      setRecords([]);
      setError(err.message || "Unable to load attendance records.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const employee = getEmployeeName(record).toLowerCase();
      const email = String(record.user?.email || "").toLowerCase();
      const recordStatus = getStatus(record);

      return (
        (!query || employee.includes(query) || email.includes(query)) &&
        (status === "all" || recordStatus === status)
      );
    });
  }, [records, search, status]);

  const stats = useMemo(() => {
    const counts = {
      present: 0,
      absent: 0,
      late: 0,
      total: records.length,
    };

    records.forEach((record) => {
      const recordStatus = getStatus(record);

      if (recordStatus === "present") counts.present += 1;
      if (recordStatus === "absent") counts.absent += 1;
      if (recordStatus === "late") counts.late += 1;
    });

    return [
      {
        label: "Present",
        value: counts.present,
        icon: CalendarCheck,
        color: "bg-emerald-50 text-emerald-600",
      },
      {
        label: "Absent",
        value: counts.absent,
        icon: Users,
        color: "bg-rose-50 text-rose-600",
      },
      {
        label: "Late Arrivals",
        value: counts.late,
        icon: Clock3,
        color: "bg-amber-50 text-amber-600",
      },
      {
        label: "Total Records",
        value: counts.total,
        icon: CalendarDays,
        color: "bg-violet-50 text-violet-600",
      },
    ];
  }, [records]);

  function resetFilters() {
    setSelectedDate(todayInPakistan());
    setSearch("");
    setStatus("all");
  }

  function exportCsv() {
    if (!filteredRecords.length) return;

    const rows = [
      [
        "Employee",
        "Email",
        "Date",
        "Check In",
        "Check Out",
        "Working Hours",
        "Status",
      ],
      ...filteredRecords.map((record) => [
        getEmployeeName(record),
        record.user?.email || "",
        record.date || selectedDate,
        formatTime(record.checkIn),
        formatTime(record.checkOut),
        getWorkingHours(record),
        statusLabel(getStatus(record)),
      ]),
    ];

    const csv = "\uFEFF" + rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    );
    const link = document.createElement("a");

    link.href = url;
    link.download = `attendance-${selectedDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-3xl p-6 shadow-xs border border-slate-100">
        <div>
          <span className="text-xs font-bold tracking-wider text-violet-600 uppercase">
            Admin Workspace
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Attendance Management
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs">
            <CalendarCheck size={17} className="text-violet-600" />
            <span>{todayHeader}</span>
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
          >
            <RefreshCw size={17} />
            Reset
          </button>

          <button
            type="button"
            onClick={exportCsv}
            disabled={!filteredRecords.length}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs transition hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-500">{item.label}</p>
                  <p className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
                    {loading ? "…" : item.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Date: {selectedDate}
                  </p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.color}`}>
                  <Icon size={22} />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Attendance Records Table Container */}
      <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xs">
        <div className="border-b border-slate-100 p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Attendance Records</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Search and filter records by date, employee, or status.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="relative min-w-0 flex-1 sm:min-w-[220px]">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search employee..."
                  className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 pl-10 pr-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
                />
              </label>

              <label className="relative">
                <CalendarDays size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="min-h-11 rounded-2xl border border-slate-200/80 bg-slate-50/40 pl-10 pr-4 text-sm font-semibold text-slate-700 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100 cursor-pointer"
                  aria-label="Attendance date"
                />
              </label>

              <label className="relative">
                <Filter size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="min-h-11 rounded-2xl border border-slate-200/80 bg-slate-50/40 pl-10 pr-8 text-sm font-semibold text-slate-700 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100 cursor-pointer"
                  aria-label="Filter by attendance status"
                >
                  <option value="all">All Statuses</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="half_day">Half Day</option>
                  <option value="leave">Leave</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {error && (
          <div className="m-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-bold">Unable to load attendance</p>
              <p className="mt-0.5">{error}</p>
            </div>
            <button
              type="button"
              onClick={loadAttendance}
              className="font-bold underline"
            >
              Retry
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-xs uppercase tracking-wider text-slate-400">
                {["Employee", "Date", "Check In", "Check Out", "Working Hours", "Status"].map((heading) => (
                  <th key={heading} className="px-6 py-4 font-bold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-400">
                    Loading attendance records…
                  </td>
                </tr>
              ) : filteredRecords.length ? (
                filteredRecords.map((record, index) => {
                  const recordStatus = getStatus(record);

                  return (
                    <tr
                      key={record._id || `${record.user?._id || "user"}-${record.date}-${index}`}
                      className="transition-colors hover:bg-slate-50/50"
                    >
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{getEmployeeName(record)}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{record.user?.email || ""}</p>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-600">{record.date || "—"}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-600">{formatTime(record.checkIn)}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-600">{formatTime(record.checkOut)}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-600">{getWorkingHours(record)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${
                          recordStatus === "present" ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60" :
                          recordStatus === "late" ? "bg-amber-50 text-amber-700 border border-amber-200/60" :
                          recordStatus === "absent" ? "bg-rose-50 text-rose-700 border border-rose-200/60" :
                          "bg-violet-50 text-violet-700 border border-violet-200/60"
                        }`}>
                          {statusLabel(recordStatus)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 border border-violet-100">
                      <CalendarCheck size={28} />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-slate-800">
                      {error ? "Attendance unavailable" : "No attendance records found"}
                    </h3>
                    <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-400">
                      {error
                        ? "Check your connection and try again."
                        : "No records match the selected date and filters."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4 sm:flex-row sm:items-center">
          <p className="text-xs text-slate-400">
            {loading ? "Loading records…" : `${filteredRecords.length} record(s) displayed`}
          </p>
          <p className="text-xs text-slate-400">
            Maximum 200 records per request.
          </p>
        </div>
      </section>
    </div>
  );
}