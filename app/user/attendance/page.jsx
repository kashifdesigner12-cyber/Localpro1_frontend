"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Clock3,
  LogIn,
  LogOut,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  LayoutDashboard,
  UserRound,
  ClipboardList,
  Bell,
  Settings,
  Menu,
  X,
  MessageSquare,
  MapPin,
  FileText,
  Activity,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.localpro1.net/api";

const navigation = [
  { name: "Dashboard", href: "/user", icon: LayoutDashboard },
  { name: "My Tasks", href: "/user/tasks", icon: ClipboardList },
  { name: "Calendar", href: "/user/calendar", icon: CalendarDays },
  { name: "Attendance", href: "/user/attendance", icon: Clock3, active: true },
  { name: "Messages", href: "/user/messages", icon: MessageSquare },
  { name: "Notifications", href: "/user/notifications", icon: Bell },
  { name: "Leave Requests", href: "/user/leave-requests", icon: FileText },
  { name: "Profile", href: "/user/profile", icon: UserRound },
  { name: "Settings", href: "/user/settings", icon: Settings },
  { name: "Policies", href: "/user/policies", icon: ShieldCheck },
];

export default function UserAttendancePage() {
  const [user, setUser] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [liveSettings, setLiveSettings] = useState(null);

  const [loading, setLoading] = useState(false); // Instant render enabled
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [attendanceWindowExpired, setAttendanceWindowExpired] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadPage = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setError("");

      const timestamp = Date.now();
      const [profileRes, attendanceRes, settingsRes] = await Promise.allSettled([
        apiRequest(`/users/profile?_t=${timestamp}`),
        apiRequest(`/attendance/today?_t=${timestamp}`),
        apiRequest(`/attendance/settings?_t=${timestamp}`),
      ]);

      let currentUser = null;
      if (profileRes.status === "fulfilled" && profileRes.value) {
        currentUser =
          profileRes.value?.user ||
          profileRes.value?.data?.user ||
          profileRes.value?.data ||
          profileRes.value;
      }

      if (currentUser) {
        setUser(currentUser);
        try {
          localStorage.setItem("user", JSON.stringify(currentUser));
        } catch {}
      }

      const role = String(currentUser?.role || "").trim().toLowerCase();
      if (currentUser && role !== "user") {
        if (role === "admin") window.location.href = "/admin";
        else if (role === "manager") window.location.href = "/manager";
        else window.location.href = "/login";
        return;
      }

      let attendanceRecord = null;
      let extractedSchedule = null;

      if (attendanceRes.status === "fulfilled" && attendanceRes.value) {
        const attData = attendanceRes.value;

        attendanceRecord =
          attData?.attendance ||
          attData?.data?.attendance ||
          attData?.record ||
          attData?.data?.record ||
          (attData?.checkIn || attData?.status ? attData : null);

        const attendanceMessage = String(
          attData?.message || attData?.data?.message || attData?.error || ""
        ).toLowerCase();

        const attendanceStatus = String(
          attendanceRecord?.status || attData?.status || attData?.data?.status || ""
        ).toLowerCase();

        const windowAlreadyExpired =
          attendanceStatus === "absent" ||
          attendanceMessage.includes("attendance window") ||
          attendanceMessage.includes("window has expired") ||
          attendanceMessage.includes("marked absent") ||
          Boolean(
            attendanceRecord?.windowExpired ||
              attData?.windowExpired ||
              attData?.data?.windowExpired
          );

        setAttendanceWindowExpired(windowAlreadyExpired);

        extractedSchedule =
          attData?.schedule ||
          attData?.todaySchedule ||
          attData?.userSchedule ||
          attData?.settings ||
          attData?.shift ||
          attData?.data?.schedule ||
          attData?.data?.settings ||
          null;

        const nestedUser = attData?.user || attData?.data?.user;
        if (nestedUser && typeof nestedUser === "object") {
          setUser((prev) => ({ ...(prev || {}), ...nestedUser }));
        }
      }

      if (settingsRes.status === "fulfilled" && settingsRes.value) {
        const setVal = settingsRes.value;
        const extraSettings =
          setVal?.settings ||
          setVal?.data?.settings ||
          setVal?.schedule ||
          setVal?.data ||
          setVal;

        if (extraSettings && typeof extraSettings === "object") {
          extractedSchedule = {
            ...(extractedSchedule || {}),
            ...extraSettings,
          };
        }
      }

      setAttendance(attendanceRecord || null);
      if (extractedSchedule) setLiveSettings(extractedSchedule);
    } catch (err) {
      console.error("Attendance page load error:", err);
      if (err?.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!isSilent) {
        setError(err?.message || "Unable to load today's attendance.");
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage(false);

    const interval = setInterval(() => {
      loadPage(true);
    }, 6000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        loadPage(true);
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [loadPage]);

  function getCurrentGPSPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(
          new Error("Your browser or device does not support GPS location.")
        );
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (geoError) => {
          if (geoError.code === 1) {
            reject(
              new Error(
                "GPS Location permission denied. Please enable location permissions."
              )
            );
          } else if (geoError.code === 2) {
            reject(
              new Error("Location unavailable. Check your GPS signal.")
            );
          } else {
            reject(new Error("Location request timed out. Please try again."));
          }
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });
  }

  async function handleCheckIn() {
    if (checkingIn || checkingOut) return;

    try {
      setCheckingIn(true);
      setError("");
      setSuccess("");

      let coords = null;
      try {
        coords = await getCurrentGPSPosition();
      } catch (gpsError) {
        throw new Error(gpsError.message);
      }

      const response = await apiRequest("/attendance/check-in", {
        method: "POST",
        body: JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
        }),
      });

      const record =
        response?.attendance ||
        response?.record ||
        response?.data?.attendance ||
        response?.data?.record ||
        response?.data ||
        response;

      setAttendance(record);
      setAttendanceWindowExpired(false);
      setSuccess(response?.message || "Checked in successfully from verified location.");
    } catch (err) {
      if (err?.status === 401) {
        window.location.href = "/login";
        return;
      }

      const message = String(err?.message || "").toLowerCase();
      const isExpiredWindow =
        message.includes("attendance window") ||
        message.includes("window has expired") ||
        message.includes("marked absent") ||
        message.includes("expired");

      if (isExpiredWindow) {
        setAttendance((prev) => ({ ...(prev || {}), status: "Absent" }));
        setAttendanceWindowExpired(true);
        setError("Today's check-in window has expired. You have been marked absent.");
        return;
      }

      setError(err?.message || "Unable to check in. Please try again.");
    } finally {
      setCheckingIn(false);
    }
  }

  async function handleCheckOut() {
    if (checkingIn || checkingOut) return;

    try {
      setCheckingOut(true);
      setError("");
      setSuccess("");

      let coords = null;
      try {
        coords = await getCurrentGPSPosition();
      } catch {}

      const response = await apiRequest("/attendance/check-out", {
        method: "POST",
        body: JSON.stringify(
          coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}
        ),
      });

      const record =
        response?.attendance ||
        response?.record ||
        response?.data?.attendance ||
        response?.data?.record ||
        response?.data ||
        response;

      setAttendance(record);
      setSuccess(response?.message || "Checked out successfully.");
    } catch (err) {
      if (err?.status === 401) {
        window.location.href = "/login";
        return;
      }
      setError(err?.message || "Unable to check out.");
    } finally {
      setCheckingOut(false);
    }
  }

  async function handleRefresh() {
    setSuccess("");
    setError("");
    await loadPage(false);
  }

  const resolveActiveSchedule = () => {
    const dayOfWeek = new Date().getDay();
    const daysLong = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const daysShort = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

    const dayLong = daysLong[dayOfWeek];
    const dayShort = daysShort[dayOfWeek];
    const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;

    const candidateSources = [
      liveSettings?.schedule,
      liveSettings?.todaySchedule,
      liveSettings?.userSchedule,
      liveSettings,
      user?.attendanceSchedule,
      user?.schedule,
      user?.workSchedule,
      user?.attendanceSettings?.schedule,
      user?.attendanceSettings?.weeklySchedule,
      user?.attendanceSettings,
      attendance?.schedule,
    ];

    for (const raw of candidateSources) {
      if (!raw) continue;
      if (Array.isArray(raw)) {
        const found = raw.find((item) => {
          if (!item || typeof item !== "object") return false;
          const dow = item.dayOfWeek ?? item.day_of_week ?? item.dayIndex;
          if (dow !== undefined && dow !== null) {
            const dowStr = String(dow).trim().toLowerCase();
            if (dowStr === String(dayOfWeek) || dowStr === String(isoDay) || dowStr === dayLong || dowStr === dayShort) {
              return true;
            }
          }
          const dName = String(item.day || item.dayName || item.name || "").trim().toLowerCase();
          if (dName === dayLong || dName === dayShort) return true;
          return false;
        });
        if (found) return found;
      }
      if (typeof raw === "object" && !Array.isArray(raw)) {
        const keyed = raw[dayLong] || raw[dayShort] || raw[String(dayOfWeek)];
        if (keyed && typeof keyed === "object") return keyed;
        if (raw.startTime || raw.start || raw.time || raw.scheduledTime) return raw;
      }
    }
    return null;
  };

  const userSchedule = resolveActiveSchedule();
  const checkIn = attendance?.checkIn || attendance?.checkInTime || attendance?.clockIn || null;
  const checkOut = attendance?.checkOut || attendance?.checkOutTime || attendance?.clockOut || null;

  const scheduledTime =
    userSchedule?.startTime ||
    userSchedule?.scheduledTime ||
    userSchedule?.time ||
    liveSettings?.startTime ||
    user?.attendanceSettings?.startTime ||
    null;

  const windowStart = userSchedule?.windowStart || liveSettings?.windowStart || null;
  const windowEnd = userSchedule?.windowEnd || liveSettings?.windowEnd || null;

  const status = attendance?.status || "Pending";
  const isCheckedIn = Boolean(checkIn) && !Boolean(checkOut);
  const isCheckedOut = Boolean(checkIn) && Boolean(checkOut);
  const userName = user?.name || user?.fullName || user?.email || "User";
  const hasSchedule = Boolean(scheduledTime || windowStart);

  return (
    <div className="relative min-h-screen w-full bg-[#f7f8fc] text-slate-900 animate-fadeIn">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#171B3A] text-white shadow-2xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <Link href="/user" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-md shadow-purple-600/20">
              <ShieldCheck size={21} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">Local Pro 1</p>
              <p className="text-[11px] font-semibold text-violet-400">User Workspace</p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Workspace
          </p>
          <div className="space-y-1.5">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold transition duration-150 ${
                    item.active
                      ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={18} className={`transition duration-150 ${item.active ? "text-white" : "text-slate-400 group-hover:text-white"}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="min-h-screen w-full lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-5 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <div>
              <p className="text-xs font-semibold text-slate-400">Workspace</p>
              <p className="text-sm font-bold text-slate-900">Attendance</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/user/notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-600 transition hover:bg-violet-100"
            >
              <Bell size={17} />
            </Link>
            <button
              type="button"
              onClick={handleRefresh}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-violet-50 hover:text-violet-600"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin text-violet-600" : ""} />
            </button>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 animate-slideUp">
          <div className="mx-auto w-full max-w-5xl space-y-6">
            
            {/* CLEAN BANNER HEADER */}
            <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/80 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-violet-700">
                  <ShieldCheck size={13} />
                  TIME & ATTENDANCE
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  My Attendance
                </h1>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  Check in when you start work and check out when you finish.
                </p>
              </div>
            </section>

            {error && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-rose-700 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-600" />
                  <div>
                    <p className="text-xs font-bold">Attendance Error</p>
                    <p className="mt-1 text-xs">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {success && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-700 shadow-sm">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
                  <p className="text-xs font-bold">{success}</p>
                </div>
              </div>
            )}

            {attendanceWindowExpired && !success && (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-amber-800 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-xs font-bold">Check-in window closed</p>
                    <p className="mt-1 text-xs">The attendance window for today has expired. Marked absent.</p>
                  </div>
                </div>
              </div>
            )}

            {/* MAIN ATTENDANCE CARD */}
            <div className="rounded-[26px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_35px_rgba(45,35,100,0.05)] sm:p-8">
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                  <Clock3 size={24} />
                </div>
                <h2 className="mt-3 text-lg font-extrabold text-slate-900">{userName}</h2>
                <p className="text-xs text-slate-400">{formatDate(new Date())}</p>
              </div>

              <div className="mx-auto mt-6 max-w-xl rounded-2xl bg-slate-50/70 p-4 text-center border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Today&apos;s Status</p>
                <p className={`mt-1 text-base font-extrabold ${
                  isCheckedOut ? "text-emerald-600" : isCheckedIn ? "text-violet-600" : status === "Absent" ? "text-rose-600" : "text-slate-700"
                }`}>
                  {isCheckedOut ? "Checked Out" : isCheckedIn ? "Checked In" : status === "Absent" ? "Absent" : "Not Checked In"}
                </p>
              </div>

              {hasSchedule && (
                <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                      <Clock3 size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Shift Schedule</p>
                      <p className="text-sm font-extrabold text-slate-900">{scheduledTime ? formatTime(scheduledTime) : "Not assigned"}</p>
                    </div>
                  </div>
                  {windowStart && windowEnd && (
                    <p className="mt-2 text-xs text-slate-500">
                      Window: <span className="font-bold text-slate-700">{formatTime(windowStart)}</span> to <span className="font-bold text-slate-700">{formatTime(windowEnd)}</span>
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-violet-700">
                    <MapPin size={13} className="shrink-0" />
                    <span>GPS location verification required.</span>
                  </div>
                </div>
              )}

              <div className="mx-auto mt-6 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <LogIn size={17} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400">Check In</p>
                      <p className="text-sm font-extrabold text-slate-900">{formatTime(checkIn) || "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                      <LogOut size={17} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400">Check Out</p>
                      <p className="text-sm font-extrabold text-slate-900">{formatTime(checkOut) || "—"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mx-auto mt-6 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={checkingIn || checkingOut || isCheckedIn || isCheckedOut || attendanceWindowExpired}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 text-xs font-bold text-white shadow-md shadow-violet-600/25 transition hover:bg-violet-700 disabled:opacity-50"
                >
                  {checkingIn ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      Verifying GPS...
                    </>
                  ) : (
                    <>
                      <LogIn size={16} />
                      Check In (GPS)
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCheckOut}
                  disabled={checkingIn || checkingOut || !isCheckedIn}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {checkingOut ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      Checking Out...
                    </>
                  ) : (
                    <>
                      <LogOut size={16} />
                      Check Out
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

async function apiRequest(endpoint, options = {}) {
  let token = null;
  try {
    if (typeof window !== "undefined") {
      token = localStorage.getItem("token") || localStorage.getItem("authToken");
    }
  } catch {}

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  let data = null;
  try {
    const text = await response.text();
    if (text) data = JSON.parse(text);
  } catch {}

  if (!response.ok) {
    const message = data?.message || data?.error || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

function formatTime(value) {
  if (!value) return "";
  const str = String(value).trim();
  if (/(am|pm)/i.test(str)) return str;
  if (/^([01]?\d|2[0-3]):([0-5]\d)/.test(str)) {
    const [h, m] = str.split(":");
    const date = new Date();
    date.setHours(Number(h), Number(m), 0, 0);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return str;
  return parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}