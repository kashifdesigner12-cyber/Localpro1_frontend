import { useCallback, useMemo, useState } from "react";
import {
  ClipboardList,
  CalendarDays,
  Download,
  RefreshCw,
  Users,
  Clock3,
  CalendarCheck,
  TrendingUp,
  Search,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import api from "../../services/api";

const getToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const getEmployee = (record) =>
  record.user?.name ||
  record.user?.fullName ||
  record.user?.email ||
  "Unknown employee";

const getStatus = (record) => {
  const status = String(record.status || "").toLowerCase();
  if (status) return status;

  if (!record.checkIn) return "absent";

  if (record.checkOut) {
    const hours =
      (new Date(record.checkOut) - new Date(record.checkIn)) / 3600000;

    if (hours < 4) return "half_day";
  }

  return "present";
};

const getHours = (record) => {
  if (!record.checkIn) return 0;

  const start = new Date(record.checkIn).getTime();
  const end = record.checkOut
    ? new Date(record.checkOut).getTime()
    : Date.now();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return 0;
  }

  return (end - start) / 3600000;
};

const formatHours = (hours) => {
  if (!Number.isFinite(hours) || hours <= 0) return "—";

  const minutes = Math.floor(hours * 60);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
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

const labelStatus = (status) =>
  ({
    present: "Present",
    absent: "Absent",
    late: "Late",
    half_day: "Half Day",
    leave: "Leave",
  })[status] || status.replaceAll("_", " ");

const csvCell = (value) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

const localDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDefaultRange = (type) => {
  const today = getToday();
  const end = new Date(`${today}T12:00:00`);

  if (type === "daily") return [today, today];

  if (type === "weekly") {
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return [localDate(start), today];
  }

  if (type === "monthly") {
    return [`${today.slice(0, 7)}-01`, today];
  }

  return ["", today];
};

export default function AttendanceReports() {
  const [dateFrom, setDateFrom] = useState(getToday);
  const [dateTo, setDateTo] = useState(getToday);
  const [search, setSearch] = useState("");
  const [reportType, setReportType] = useState("daily");
  const [records, setRecords] = useState([]);
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
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

  const generateReport = useCallback(async () => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError("From Date cannot be after To Date.");
      return;
    }

    setLoading(true);
    setError("");
    setGenerated(false);

    try {
      const params = { limit: 200 };

      if (dateFrom) params.startDate = dateFrom;
      if (dateTo) params.endDate = dateTo;

      const response = await api.get("/attendance", { params });
      const data = response.data;

      const attendance = Array.isArray(data?.attendance)
        ? data.attendance
        : Array.isArray(data?.data)
          ? data.data
          : [];

      setRecords(attendance);
      setGenerated(true);
    } catch (err) {
      setRecords([]);
      setError(err.message || "Unable to generate attendance report.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const name = getEmployee(record).toLowerCase();
      const email = String(record.user?.email || "").toLowerCase();

      return !query || name.includes(query) || email.includes(query);
    });
  }, [records, search]);

  const summaryCards = useMemo(() => {
    const employeeIds = new Set();
    let present = 0;
    let late = 0;
    let presentDays = 0;

    filteredRecords.forEach((record) => {
      const userId = record.user?._id || record.user?.email || getEmployee(record);
      employeeIds.add(userId);

      const status = getStatus(record);
      if (["present", "late", "half_day"].includes(status)) presentDays++;
      if (status === "late") late++;
      if (status === "present") present++;
    });

    const attendanceRate = filteredRecords.length
      ? Math.round((presentDays / filteredRecords.length) * 100)
      : 0;

    return [
      {
        label: "Employees in Results",
        value: employeeIds.size,
        icon: Users,
        color: "bg-violet-50 text-violet-600",
      },
      {
        label: "Attendance Rate",
        value: `${attendanceRate}%`,
        icon: TrendingUp,
        color: "bg-emerald-50 text-emerald-600",
      },
      {
        label: "Present Days",
        value: presentDays,
        icon: CalendarCheck,
        color: "bg-blue-50 text-blue-600",
      },
      {
        label: "Late Arrivals",
        value: late,
        icon: Clock3,
        color: "bg-amber-50 text-amber-600",
      },
    ];
  }, [filteredRecords]);

  function resetFilters() {
    setReportType("daily");
    const [from, to] = getDefaultRange("daily");
    setDateFrom(from);
    setDateTo(to);
    setSearch("");
    setRecords([]);
    setGenerated(false);
    setError("");
  }

  function changeReportType(type) {
    setReportType(type);

    if (type !== "employee") {
      const [from, to] = getDefaultRange(type);
      setDateFrom(from);
      setDateTo(to);
    }
  }

  function exportReport() {
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
        getEmployee(record),
        record.user?.email || "",
        record.date || "",
        formatTime(record.checkIn),
        formatTime(record.checkOut),
        formatHours(getHours(record)),
        labelStatus(getStatus(record)),
      ]),
    ];

    const csv =
      "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-report-${dateFrom || "all"}-${dateTo || "all"}.csv`;
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
            Attendance Reports
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs">
            <CalendarDays size={17} className="text-violet-600" />
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
            onClick={exportReport}
            disabled={!generated || !filteredRecords.length}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
          >
            <Download size={18} />
            Export Report
          </button>
        </div>
      </div>

      {/* Summary Stat Cards Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <div key={card.label} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs transition hover:shadow-md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-500">{card.label}</p>
                  <p className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
                    {generated ? card.value : "—"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {generated ? "Based on filtered records" : "Generate a report to view"}
                  </p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.color}`}>
                  <Icon size={22} />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Generate Report Controls Section */}
      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs sm:p-7">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-900">Generate Report</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Select the report type and date range you want to review.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-800">Report Type</span>
            <select
              value={reportType}
              onChange={(event) => changeReportType(event.target.value)}
              className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100 cursor-pointer"
            >
              <option value="daily">Daily Attendance</option>
              <option value="weekly">Weekly Attendance</option>
              <option value="monthly">Monthly Attendance</option>
              <option value="employee">Employee Summary</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-800">From Date</span>
            <div className="relative">
              <CalendarDays size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => setDateFrom(event.target.value)}
                className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 pl-10 pr-4 text-sm font-semibold text-slate-700 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100 cursor-pointer"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-800">To Date</span>
            <div className="relative">
              <CalendarDays size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => setDateTo(event.target.value)}
                className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 pl-10 pr-4 text-sm font-semibold text-slate-700 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100 cursor-pointer"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-800">Search Employee</span>
            <div className="relative">
              <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Employee name or email"
                className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 pl-10 pr-4 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
            </div>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <p className="text-xs text-slate-400">
            {generated
              ? `${filteredRecords.length} matching attendance record(s)`
              : "Choose your filters and generate the report."}
          </p>
          <button
            type="button"
            onClick={generateReport}
            disabled={loading}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-60 active:scale-95 shadow-sm"
          >
            <FileSpreadsheet size={17} />
            {loading ? "Generating..." : "Generate Report"}
          </button>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700 shadow-2xs">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">Report error</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Report Results Table Section */}
      <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xs">
        <div className="border-b border-slate-100 p-6">
          <h2 className="text-lg font-bold text-slate-900">Report Results</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Attendance results for your selected filters.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left">
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
                    Loading report...
                  </td>
                </tr>
              ) : !generated ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-400">
                    Generate a report to display attendance records.
                  </td>
                </tr>
              ) : filteredRecords.length ? (
                filteredRecords.map((record, index) => {
                  const status = getStatus(record);

                  return (
                    <tr key={record._id || `${record.date}-${index}`} className="transition-colors hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{getEmployee(record)}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{record.user?.email || ""}</p>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-600">{record.date || "—"}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-600">{formatTime(record.checkIn)}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-600">{formatTime(record.checkOut)}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-600">{formatHours(getHours(record))}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${
                          status === "present" ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60" :
                          status === "late" ? "bg-amber-50 text-amber-700 border border-amber-200/60" :
                          status === "absent" ? "bg-rose-50 text-rose-700 border border-rose-200/60" :
                          "bg-violet-50 text-violet-700 border border-violet-200/60"
                        }`}>
                          {labelStatus(status)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 border border-violet-100">
                      <ClipboardList size={28} />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-slate-800">No report data available</h3>
                    <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-400">
                      No attendance records match the selected period and employee search.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <p className="text-xs text-slate-400">
            {generated ? `${filteredRecords.length} record(s) · Maximum 200 records returned by API` : "No report generated yet."}
          </p>
        </div>
      </section>
    </div>
  );
}