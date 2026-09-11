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
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.localpro1.net/api";

const navigation = [
  {
    name: "Dashboard",
    href: "/user",
    icon: LayoutDashboard,
  },
  {
    name: "My Tasks",
    href: "/user/tasks",
    icon: ClipboardList,
  },
  {
    name: "Calendar",
    href: "/user/calendar",
    icon: CalendarDays,
  },
  {
    name: "Attendance",
    href: "/user/attendance",
    icon: Clock3,
    active: true,
  },
  {
    name: "Messages",
    href: "/user/messages",
    icon: MessageSquare,
  },
  {
    name: "Notifications",
    href: "/user/notifications",
    icon: Bell,
  },
  {
    name: "Leave Requests",
    href: "/user/leave-requests",
    icon: FileText,
  },
  {
    name: "Activity",
    href: "/user/activity",
    icon: Activity,
  },
  {
    name: "Profile",
    href: "/user/profile",
    icon: UserRound,
  },
  {
    name: "Settings",
    href: "/user/settings",
    icon: Settings,
  },
  {
    name: "Policies",
    href: "/user/policies",
    icon: ShieldCheck,
  },
];

export default function UserAttendancePage() {
  const [user, setUser] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [liveSettings, setLiveSettings] = useState(null);

  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [attendanceWindowExpired, setAttendanceWindowExpired] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadPage = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) {
        setLoading(true);
      }
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

      const role = String(currentUser?.role || "")
        .trim()
        .toLowerCase();

      if (currentUser && role !== "user") {
        if (role === "admin") {
          window.location.href = "/admin";
        } else if (role === "manager") {
          window.location.href = "/manager";
        } else {
          window.location.href = "/login";
        }
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
          attData?.message ||
          attData?.data?.message ||
          attData?.error ||
          ""
        ).toLowerCase();

        const attendanceStatus = String(
          attendanceRecord?.status ||
          attData?.status ||
          attData?.data?.status ||
          ""
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
      if (extractedSchedule) {
        setLiveSettings(extractedSchedule);
      }
    } catch (err) {
      console.error("Attendance page load error:", err);

      if (err?.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!isSilent) {
        setError(
          err?.message || "Unable to load today's attendance."
        );
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadPage();

    const interval = setInterval(() => {
      loadPage(true);
    }, 5000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        loadPage(true);
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("storage", handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("storage", handleVisibilityOrFocus);
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
                "GPS Location permission denied. Please enable device location / GPS permissions in your browser to check in."
              )
            );
          } else if (geoError.code === 2) {
            reject(
              new Error(
                "Location unavailable. Please check if your GPS signal / Location service is turned on."
              )
            );
          } else {
            reject(
              new Error(
                "Location request timed out. Please try again."
              )
            );
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        }
      );
    });
  }

  async function handleCheckIn() {
    if (checkingIn || checkingOut) {
      return;
    }

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

      setSuccess(
        response?.message ||
          "Checked in successfully from verified office location."
      );
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
        const errorData = err?.data || {};
        const expiredRecord =
          errorData?.attendance ||
          errorData?.record ||
          errorData?.data?.attendance ||
          errorData?.data?.record ||
          errorData?.data;

        if (expiredRecord && typeof expiredRecord === "object") {
          setAttendance((prev) => ({
            ...(prev || {}),
            ...expiredRecord,
            status: expiredRecord.status || "Absent",
          }));
        } else {
          setAttendance((prev) => ({
            ...(prev || {}),
            status: "Absent",
          }));
        }

        setAttendanceWindowExpired(true);
        setError(
          "Today's check-in window has expired. You have been marked absent for today. Check-in is no longer available."
        );
        return;
      }

      setError(err?.message || "Unable to check in. Please try again.");
    } finally {
      setCheckingIn(false);
    }
  }

  async function handleCheckOut() {
    if (checkingIn || checkingOut) {
      return;
    }

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
          coords
            ? { latitude: coords.latitude, longitude: coords.longitude }
            : {}
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
      console.error("Check-out error:", err);

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
    const daysLong = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const daysShort = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

    const dayLong = daysLong[dayOfWeek];
    const dayShort = daysShort[dayOfWeek];
    const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
    const sun1Day = dayOfWeek + 1;

    const candidateSources = [
      liveSettings?.schedule,
      liveSettings?.todaySchedule,
      liveSettings?.userSchedule,
      liveSettings,
      user?.attendanceSchedule,
      user?.schedule,
      user?.workSchedule,
      user?.attendanceSettings?.schedule,
      user?.attendanceSettings?.attendanceSchedule,
      user?.attendanceSettings?.weeklySchedule,
      user?.attendanceSettings?.workSchedule,
      user?.attendanceSettings,
      user?.preferences?.attendanceSchedule,
      user?.preferences?.workSchedule,
      user?.preferences?.schedule,
      user?.shift?.schedule,
      user?.shift,
      user?.weeklySchedule,
      attendance?.schedule,
      attendance?.userSchedule,
      attendance?.user?.attendanceSchedule,
      attendance?.user?.workSchedule,
      attendance?.user?.attendanceSettings,
    ];

    for (const raw of candidateSources) {
      if (!raw) continue;

      if (Array.isArray(raw)) {
        const found = raw.find((item) => {
          if (!item || typeof item !== "object") return false;

          const dow = item.dayOfWeek ?? item.day_of_week ?? item.dayIndex;
          if (dow !== undefined && dow !== null) {
            const dowStr = String(dow).trim().toLowerCase();
            if (
              dowStr === String(dayOfWeek) ||
              dowStr === String(isoDay) ||
              dowStr === String(sun1Day) ||
              dowStr === dayLong ||
              dowStr === dayShort
            ) {
              return true;
            }
          }

          const dName = String(
            item.day || item.dayName || item.name || item.weekday || ""
          )
            .trim()
            .toLowerCase();

          if (
            dName === dayLong ||
            dName === dayShort ||
            dName === String(dayOfWeek) ||
            dName === String(isoDay)
          ) {
            return true;
          }

          return false;
        });

        if (found) return found;
      }

      if (typeof raw === "object" && !Array.isArray(raw)) {
        const keyed =
          raw[dayLong] ||
          raw[dayShort] ||
          raw[String(dayOfWeek)] ||
          raw[String(isoDay)] ||
          raw[dayOfWeek];

        if (keyed && typeof keyed === "object") {
          return keyed;
        }

        if (
          raw.startTime ||
          raw.start ||
          raw.time ||
          raw.scheduledTime ||
          raw.attendanceTime ||
          raw.windowStart
        ) {
          return raw;
        }
      }
    }

    return null;
  };

  const userSchedule = resolveActiveSchedule();

  const checkIn =
    attendance?.checkIn ||
    attendance?.checkInTime ||
    attendance?.clockIn ||
    null;

  const checkOut =
    attendance?.checkOut ||
    attendance?.checkOutTime ||
    attendance?.clockOut ||
    null;

  const scheduledTime =
    userSchedule?.startTime ||
    userSchedule?.scheduledTime ||
    userSchedule?.attendanceTime ||
    userSchedule?.time ||
    userSchedule?.start ||
    userSchedule?.shiftStart ||
    liveSettings?.attendanceTime ||
    liveSettings?.startTime ||
    liveSettings?.scheduledTime ||
    user?.attendanceSettings?.attendanceTime ||
    user?.attendanceSettings?.startTime ||
    user?.attendanceSettings?.scheduledTime ||
    user?.attendanceSettings?.time ||
    user?.attendanceTime ||
    user?.scheduledTime ||
    attendance?.schedule?.startTime ||
    attendance?.scheduledTime ||
    null;

  const windowStart =
    userSchedule?.windowStart ||
    userSchedule?.checkInWindowStart ||
    userSchedule?.startWindow ||
    userSchedule?.window_start ||
    liveSettings?.windowStart ||
    user?.attendanceSettings?.windowStart ||
    attendance?.schedule?.windowStart ||
    attendance?.windowStart ||
    null;

  const windowEnd =
    userSchedule?.windowEnd ||
    userSchedule?.checkInWindowEnd ||
    userSchedule?.endWindow ||
    userSchedule?.window_end ||
    liveSettings?.windowEnd ||
    user?.attendanceSettings?.windowEnd ||
    attendance?.schedule?.windowEnd ||
    attendance?.windowEnd ||
    null;

  const status = attendance?.status || "Pending";

  const isAbsent =
    attendanceWindowExpired ||
    String(status).trim().toLowerCase() === "absent";

  const isCheckedIn = Boolean(checkIn) && !Boolean(checkOut);
  const isCheckedOut = Boolean(checkIn) && Boolean(checkOut);

  const userName =
    user?.name ||
    user?.fullName ||
    user?.displayName ||
    user?.email ||
    "User";

  const hasSchedule = Boolean(scheduledTime || windowStart);

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC]">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-[999] bg-black/50 lg:hidden"
        />
      )}

      <aside
        className={`
          fixed
          inset-y-0
          left-0
          z-[1000]
          flex
          h-screen
          w-64
          flex-col
          bg-[#171B3A]
          shadow-2xl
          transition-transform
          duration-300
          lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex h-[82px] shrink-0 items-center justify-between border-b border-white/10 px-5">
          <Link
            href="/user"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-sm">
              <ShieldIcon />
            </div>

            <div className="min-w-0">
              <p className="text-sm font-bold text-white">Local Pro 1</p>
              <p className="text-[11px] font-medium text-white/70">
                User Workspace
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
            Navigation
          </p>

          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    group
                    flex
                    w-full
                    items-center
                    gap-3
                    rounded-xl
                    px-3
                    py-3
                    text-sm
                    font-semibold
                    transition-all
                    duration-200
                    ${
                      item.active
                        ? "bg-[#2563EB] text-white shadow-md"
                        : "bg-transparent text-white hover:bg-white/10 hover:text-white"
                    }
                  `}
                >
                  <Icon
                    size={18}
                    strokeWidth={2}
                    className={
                      item.active
                        ? "shrink-0 text-white"
                        : "shrink-0 text-white group-hover:text-white"
                    }
                  />
                  <span className="text-white">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/5 p-3">
            <div className="flex items-center gap-2">
              <Clock3 size={15} className="text-white" />
              <p className="text-xs font-semibold text-white">Attendance</p>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-white/60">
              Manage your daily check-in and check-out.
            </p>
          </div>
        </div>
      </aside>

      <div className="min-h-screen w-full lg:ml-64 lg:w-[calc(100%-16rem)]">
        <header className="sticky top-0 z-[900] flex h-[82px] items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#26344D] shadow-sm transition hover:bg-slate-50 lg:hidden"
            >
              <Menu size={20} />
            </button>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                User Workspace
              </p>
              <p className="text-sm font-bold text-[#171B3A]">Attendance</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/user/notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB] transition hover:bg-blue-100"
              aria-label="Notifications"
            >
              <Bell size={18} />
            </Link>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-[#26344D] shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        <main className="min-h-[calc(100vh-82px)] bg-[#F8FAFC] px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-6">
              <p className="text-sm font-semibold text-[#2563EB]">
                ATTENDANCE
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
                My Attendance
              </h1>
              <p className="mt-2 text-sm text-[#64748B]">
                Check in when you start work and check out when you finish.
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle
                    size={18}
                    className="mt-0.5 shrink-0 text-red-600"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-red-700">
                      Attendance Error
                    </p>
                    <p className="mt-1 text-sm text-red-600">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {success && (
              <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2
                    size={18}
                    className="shrink-0 text-emerald-600"
                  />
                  <p className="text-sm font-semibold text-emerald-700">
                    {success}
                  </p>
                </div>
              </div>
            )}

            {attendanceWindowExpired && !success && (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle
                    size={18}
                    className="mt-0.5 shrink-0 text-amber-600"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-amber-800">
                      Check-in window closed
                    </p>
                    <p className="mt-1 text-sm text-amber-700">
                      The attendance window for today has expired. Your attendance
                      is marked absent and check-in is disabled for today.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                  <Clock3 size={28} />
                </div>

                <h2 className="mt-4 text-xl font-bold text-[#171B3A]">
                  {loading ? "Loading..." : userName}
                </h2>

                <p className="mt-1 text-sm text-[#64748B]">
                  {formatDate(new Date())}
                </p>
              </div>

              <div className="mx-auto mt-8 max-w-2xl rounded-2xl bg-slate-50 p-5 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Today&apos;s Status
                </p>

                <p
                  className={`
                    mt-2
                    text-lg
                    font-bold
                    ${
                      isCheckedOut
                        ? "text-emerald-600"
                        : isCheckedIn
                        ? "text-[#2563EB]"
                        : status === "Absent"
                        ? "text-red-600"
                        : status === "Late"
                        ? "text-amber-600"
                        : "text-slate-600"
                    }
                  `}
                >
                  {isCheckedOut
                    ? "Checked Out"
                    : isCheckedIn
                    ? "Checked In"
                    : status === "Absent"
                    ? "Absent"
                    : status === "Late"
                    ? "Late"
                    : "Not Checked In"}
                </p>
              </div>

              {hasSchedule && (
                <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-blue-100 bg-[#EEF4FF] p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#2563EB]">
                      <Clock3 size={19} />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                        Attendance Schedule
                      </p>

                      <p className="mt-1 text-base font-bold text-[#171B3A]">
                        {scheduledTime
                          ? formatTime(scheduledTime)
                          : "Not assigned"}
                      </p>
                    </div>
                  </div>

                  {windowStart && windowEnd && (
                    <p className="mt-3 text-sm text-[#64748B]">
                      Check-in window:{" "}
                      <span className="font-semibold text-[#26344D]">
                        {formatTime(windowStart)}
                      </span>{" "}
                      to{" "}
                      <span className="font-semibold text-[#26344D]">
                        {formatTime(windowEnd)}
                      </span>
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-1.5 text-xs text-[#2563EB]">
                    <MapPin size={14} className="shrink-0" />
                    <span>Location verification required during check-in.</span>
                  </div>
                </div>
              )}

              <div className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <LogIn size={19} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#64748B]">
                        Check In
                      </p>
                      <p className="mt-1 text-lg font-bold text-[#171B3A]">
                        {formatTime(checkIn) || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-500">
                      <LogOut size={19} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#64748B]">
                        Check Out
                      </p>
                      <p className="mt-1 text-lg font-bold text-[#171B3A]">
                        {formatTime(checkOut) || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mx-auto mt-8 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={
                    loading ||
                    checkingIn ||
                    checkingOut ||
                    isCheckedIn ||
                    isCheckedOut ||
                    attendanceWindowExpired ||
                    String(status).toLowerCase() === "absent"
                  }
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {checkingIn ? (
                    <>
                      <RefreshCw size={17} className="animate-spin" />
                      Verifying GPS & Checking In...
                    </>
                  ) : (
                    <>
                      <LogIn size={18} />
                      Check In (GPS)
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCheckOut}
                  disabled={
                    loading || checkingIn || checkingOut || !isCheckedIn
                  }
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-[#26344D] transition hover:-translate-y-0.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {checkingOut ? (
                    <>
                      <RefreshCw size={17} className="animate-spin" />
                      Checking Out...
                    </>
                  ) : (
                    <>
                      <LogOut size={18} />
                      Check Out
                    </>
                  )}
                </button>
              </div>

              {!loading && !hasSchedule && (
                <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle
                      size={18}
                      className="mt-0.5 shrink-0 text-amber-600"
                    />
                    <div>
                      <p className="text-sm font-bold text-amber-800">
                        Attendance schedule not available
                      </p>
                      <p className="mt-1 text-sm text-amber-700">
                        Your administrator has not assigned an attendance
                        schedule for today yet.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 3L20 6V11.5C20 16.5 16.8 20.1 12 21C7.2 20.1 4 16.5 4 11.5V6L12 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 12L10.8 14.3L15.5 9.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

async function apiRequest(endpoint, options = {}) {
  let token = null;
  try {
    if (typeof window !== "undefined") {
      token =
        localStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("token");
    }
  } catch (e) {}

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const cleanEndpoint = endpoint.startsWith("/api/")
    ? endpoint.replace(/^\/api/, "")
    : endpoint;
  const finalPath = cleanEndpoint.startsWith("/") ? cleanEndpoint : `/${cleanEndpoint}`;

  const response = await fetch(`${API_URL}${finalPath}`, {
    ...options,
    credentials: "include",
    cache: "no-store",
    headers,
  });

  let data = null;

  try {
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    const message =
      data?.message ||
      data?.error ||
      data?.errors?.[0]?.message ||
      (typeof data === "string" ? data : null) ||
      `Request failed with status ${response.status}`;

    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function formatTime(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (
      lower.includes("expired") ||
      lower.includes("absent") ||
      lower.includes("error") ||
      lower.includes("window") ||
      value.length > 25
    ) {
      return "";
    }
  }

  const str = String(value).trim();

  if (/(am|pm)/i.test(str)) {
    return str;
  }

  if (/^([01]?\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/.test(str)) {
    const parts = str.split(":");
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    const date = new Date();
    date.setHours(h, m, 0, 0);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return str;
  }

  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}