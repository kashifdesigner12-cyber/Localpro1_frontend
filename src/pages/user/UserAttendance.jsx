import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  Clock3,
  LogIn,
  LogOut,
  CalendarDays,
  History,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import api from "../../services/api";

const formatTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Karachi",
  });
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getWorkedMinutes = (record) => {
  if (!record.checkIn || !record.checkOut) return 0;

  const start = new Date(record.checkIn).getTime();
  const end = new Date(record.checkOut).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return 0;
  }

  return Math.floor((end - start) / 60000);
};

const formatHours = (minutes) =>
  `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

const getCurrentLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser does not support location access."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        const messages = {
          1: "Location permission denied. Allow location access in your browser and try again.",
          2: "Your location is currently unavailable. Please try again.",
          3: "Location request timed out. Please try again.",
        };

        reject(
          new Error(messages[error.code] || "Could not get your location.")
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });

const speakGreeting = (text) => {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    typeof window.SpeechSynthesisUtterance === "undefined"
  ) {
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  utterance.pitch = 1.1;
  utterance.volume = 1;

  const voices = window.speechSynthesis.getVoices();
  const femaleVoice = voices.find(
    (voice) =>
      /^en(-|_)/i.test(voice.lang) &&
      /female|samantha|victoria|karen|zira|aria|jenny/i.test(voice.name)
  );

  if (femaleVoice) {
    utterance.voice = femaleVoice;
  }

  window.speechSynthesis.speak(utterance);
};

export default function UserAttendance() {
  const [attendance, setAttendance] = useState([]);
  const [todayRecord, setTodayRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const todayLabel = new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const todayHeader = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [todayResult, historyResult] = await Promise.allSettled([
        api.get("/attendance/today"),
        api.get("/attendance", { params: { limit: 100 } }),
      ]);

      if (todayResult.status === "fulfilled") {
        const records = Array.isArray(todayResult.value.data?.attendance)
          ? todayResult.value.data.attendance
          : [];

        setTodayRecord(
          records.find(
            (record) => String(record.date).slice(0, 10) === today
          ) ||
            records[0] ||
            null
        );
      } else {
        setTodayRecord(null);
      }

      if (historyResult.status === "fulfilled") {
        const records = historyResult.value.data?.attendance;
        setAttendance(Array.isArray(records) ? records : []);
      } else {
        setAttendance([]);
      }

      if (
        todayResult.status === "rejected" &&
        historyResult.status === "rejected"
      ) {
        setError(
          todayResult.reason?.response?.data?.message ||
            "Could not load attendance. Please try again."
        );
      } else if (
        todayResult.status === "rejected" ||
        historyResult.status === "rejected"
      ) {
        setError("Some attendance information could not be loaded.");
      }
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const handleAttendanceAction = async (action) => {
    setActionLoading(action);
    setError("");
    setMessage("");

    try {
      const coordinates = await getCurrentLocation();

      const endpoint =
        action === "check-in"
          ? "/attendance/check-in"
          : "/attendance/check-out";

      const response = await api.post(endpoint, coordinates);

      setMessage(
        response.data?.message ||
          (action === "check-in"
            ? "Checked in successfully."
            : "Checked out successfully.")
      );

      speakGreeting(action === "check-in" ? "Thank you" : "Goodbye");

      await loadAttendance();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Attendance action failed. Please try again."
      );
    } finally {
      setActionLoading("");
    }
  };

  const presentDays = useMemo(
    () => attendance.filter((record) => Boolean(record.checkIn)).length,
    [attendance]
  );

  const totalWorkedMinutes = useMemo(
    () =>
      attendance.reduce(
        (total, record) => total + getWorkedMinutes(record),
        0
      ),
    [attendance]
  );

  const isCheckedIn = Boolean(todayRecord?.checkIn);
  const isCheckedOut = Boolean(todayRecord?.checkOut);

  const summary = [
    { label: "Present Days", value: presentDays, icon: CalendarCheck, color: "bg-emerald-50 text-emerald-600" },
    { label: "Late Arrivals", value: "—", icon: Clock3, color: "bg-amber-50 text-amber-600" },
    {
      label: "Hours Worked",
      value: formatHours(totalWorkedMinutes),
      icon: History,
      color: "bg-violet-50 text-violet-600",
    },
  ];

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header Section matching Ventes clean style */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-3xl p-6 shadow-xs border border-slate-100">
        <div>
          <span className="text-xs font-bold tracking-wider text-violet-600 uppercase">
            My Workspace
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            My Attendance
          </h1>
        </div>
        <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs">
          <CalendarDays size={17} className="text-violet-600" />
          <span>{todayHeader}</span>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3.5 text-sm font-medium text-rose-700 shadow-2xs"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={loadAttendance}
            className="font-bold underline"
          >
            Try again
          </button>
        </div>
      )}

      {message && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm font-bold text-emerald-700 shadow-2xs"
        >
          <CheckCircle2 size={18} />
          {message}
        </div>
      )}

      {/* Today's Status Card Container */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold tracking-wider text-violet-600 uppercase">Today</span>
            <h2 className="mt-0.5 text-xl font-bold text-slate-900">
              {todayLabel}
            </h2>
            <p className="mt-1 text-xs text-slate-400">Attendance status</p>
          </div>

          <span
            className={`inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold ring-1 ring-inset ${
              isCheckedOut
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200/60"
                : isCheckedIn
                  ? "bg-blue-50 text-blue-700 ring-blue-200/60"
                  : "bg-slate-100 text-slate-600 ring-slate-200/60"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isCheckedOut
                  ? "bg-emerald-500 animate-pulse"
                  : isCheckedIn
                    ? "bg-blue-500 animate-pulse"
                    : "bg-slate-400"
              }`}
            />
            {loading
              ? "Loading…"
              : isCheckedOut
                ? "Checked out"
                : isCheckedIn
                  ? "Checked in"
                  : "Not checked in"}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
              <LogIn size={16} className="text-emerald-600" />
              Check-in
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900">
              {loading ? "…" : formatTime(todayRecord?.checkIn)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
              <LogOut size={16} className="text-violet-600" />
              Check-out
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900">
              {loading ? "…" : formatTime(todayRecord?.checkOut)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3.5">
          <button
            type="button"
            disabled={loading || Boolean(actionLoading) || isCheckedIn}
            onClick={() => handleAttendanceAction("check-in")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
          >
            <LogIn size={18} />
            {actionLoading === "check-in" ? "Checking in…" : "Check In"}
          </button>

          <button
            type="button"
            disabled={
              loading ||
              Boolean(actionLoading) ||
              !isCheckedIn ||
              isCheckedOut
            }
            onClick={() => handleAttendanceAction("check-out")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
          >
            <LogOut size={18} />
            {actionLoading === "check-out" ? "Checking out…" : "Check Out"}
          </button>
        </div>
      </div>

      {/* Summary Stat Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summary.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs transition hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-slate-500">
                  {item.label}
                </p>
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.color}`}>
                  <Icon size={22} />
                </div>
              </div>
              <p className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
                {loading ? "…" : item.value}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {item.label === "Late Arrivals" ? "Not calculated by current API" : "Performance metric"}
              </p>
            </div>
          );
        })}
      </div>

      {/* Attendance History Table Container */}
      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Attendance History</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Your previous attendance records.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAttendance}
            disabled={loading}
            aria-label="Refresh history"
            title="Refresh history"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50 text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">
            Loading attendance…
          </div>
        ) : attendance.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {attendance.map((record, index) => {
              const checkedOut = Boolean(record.checkOut);

              return (
                <div
                  key={record._id || record.id || index}
                  className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-4 sm:items-center transition-colors hover:bg-slate-50/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                      <CalendarDays size={18} />
                    </div>
                    <span className="text-sm font-bold text-slate-800">
                      {formatDate(record.date)}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-600">
                    Check-in: <span className="font-bold text-slate-800">{formatTime(record.checkIn)}</span>
                  </p>

                  <p className="text-xs font-semibold text-slate-600">
                    Check-out: <span className="font-bold text-slate-800">{formatTime(record.checkOut)}</span>
                  </p>

                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${
                      checkedOut
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200/60"
                        : record.checkIn
                          ? "bg-blue-50 text-blue-700 ring-blue-200/60"
                          : "bg-slate-100 text-slate-600 ring-slate-200/60"
                    }`}
                  >
                    {checkedOut
                      ? "Completed"
                      : record.checkIn
                        ? "Checked in"
                        : "Incomplete"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 border border-violet-100">
              <CalendarCheck size={28} />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-800">
              No attendance records
            </h3>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-400">
              Your attendance history will appear here when records are available.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}