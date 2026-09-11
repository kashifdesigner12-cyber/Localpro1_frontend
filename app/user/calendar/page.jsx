"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Settings,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.localpro1.net/api";

const navigation = [
  {
    label: "Dashboard",
    href: "/user",
    icon: LayoutDashboard,
  },
  {
    label: "My Tasks",
    href: "/user/tasks",
    icon: ClipboardList,
  },
  {
    label: "Calendar",
    href: "/user/calendar",
    icon: CalendarDays,
  },
  {
    label: "Attendance",
    href: "/user/attendance",
    icon: Clock3,
  },
  {
    label: "Messages",
    href: "/user/messages",
    icon: MessageSquare,
  },
  {
    label: "Notifications",
    href: "/user/notifications",
    icon: Bell,
  },
  {
    label: "Leave Requests",
    href: "/user/leave-requests",
    icon: FileText,
  },
  {
    label: "Activity",
    href: "/user/activity",
    icon: Activity,
  },
  {
    label: "Profile",
    href: "/user/profile",
    icon: UserRound,
  },
  {
    label: "Settings",
    href: "/user/settings",
    icon: Settings,
  },
  {
    label: "Policies",
    href: "/user/policies",
    icon: ShieldCheck,
  },
];

const weekDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const eventTypeLabels = {
  meeting: "Meeting",
  task: "Task",
  reminder: "Reminder",
  call: "Call",
  holiday: "Holiday",
  appointment: "Appointment",
  other: "Event",
};

const statusLabels = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function UserCalendarPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();

    return new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );
  });

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();

    return today;
  });

  const [user, setUser] = useState(null);

  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedError, setSelectedError] = useState("");

  const [signingOut, setSigningOut] = useState(false);

  // ============================================================
  // API HELPER
  // ============================================================

  const apiRequest = useCallback(async (endpoint, options = {}) => {
    const response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        ...options,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      }
    );

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
          "Something went wrong while communicating with the server."
      );
    }

    return data;
  }, []);

  // ============================================================
  // DATE HELPERS
  // ============================================================

  const formatDateKey = useCallback((date) => {
    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }, []);

  const formatApiDate = useCallback((date) => {
    return formatDateKey(date);
  }, [formatDateKey]);

  const monthStart = useMemo(() => {
    return new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
  }, [currentDate]);

  const monthEnd = useMemo(() => {
    return new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0
    );
  }, [currentDate]);

  // ============================================================
  // LOAD CURRENT USER
  // ============================================================

  const loadCurrentUser = useCallback(async () => {
    try {
      setUserLoading(true);

      const response = await apiRequest("/auth/me");

      const currentUser =
        response?.user ||
        response?.data?.user ||
        response?.data ||
        null;

      setUser(currentUser);
    } catch (err) {
      console.error("loadCurrentUser error:", err);

      setUser(null);
    } finally {
      setUserLoading(false);
    }
  }, [apiRequest]);

  // ============================================================
  // LOAD MONTH EVENTS
  // ============================================================

  const loadMonthEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const startDate =
        formatApiDate(monthStart);

      const endDate =
        formatApiDate(monthEnd);

      const [
        eventsResponse,
        tasksResponse,
      ] = await Promise.all([
        apiRequest(
          `/events?startDate=${encodeURIComponent(
            startDate
          )}&endDate=${encodeURIComponent(
            endDate
          )}&limit=200`
        ),

        apiRequest(
          `/calendar/tasks?startDate=${encodeURIComponent(
            startDate
          )}&endDate=${encodeURIComponent(
            endDate
          )}`
        ),
      ]);

      const receivedEvents =
        Array.isArray(eventsResponse?.events)
          ? eventsResponse.events
          : Array.isArray(eventsResponse?.data)
          ? eventsResponse.data
          : [];

      const receivedTasks =
        Array.isArray(tasksResponse?.tasks)
          ? tasksResponse.tasks
          : Array.isArray(
              tasksResponse?.data?.tasks
            )
          ? tasksResponse.data.tasks
          : [];

      setEvents(receivedEvents);
      setTasks(receivedTasks);
    } catch (err) {
      console.error("loadMonthEvents error:", err);

      setEvents([]);
      setTasks([]);

      setError(
        err?.message ||
          "Unable to load calendar data."
      );
    } finally {
      setLoading(false);
    }
  }, [
    apiRequest,
    formatApiDate,
    monthStart,
    monthEnd,
  ]);

  // ============================================================
  // LOAD SELECTED DAY
  // ============================================================

  const loadSelectedDay = useCallback(async (date) => {
    if (!date) return;

    try {
      setSelectedLoading(true);
      setSelectedError("");

      const dateKey =
        formatDateKey(date);

      const [
        eventsResponse,
        tasksResponse,
      ] = await Promise.all([
        apiRequest(
          `/events?startDate=${encodeURIComponent(
            dateKey
          )}&endDate=${encodeURIComponent(
            dateKey
          )}&limit=200`
        ),

        apiRequest(
          `/calendar/day/${encodeURIComponent(
            dateKey
          )}`
        ),
      ]);

      const receivedEvents =
        Array.isArray(eventsResponse?.events)
          ? eventsResponse.events
          : Array.isArray(eventsResponse?.data)
          ? eventsResponse.data
          : [];

      const receivedTasks =
        Array.isArray(tasksResponse?.tasks)
          ? tasksResponse.tasks
          : Array.isArray(tasksResponse?.data)
          ? tasksResponse.data
          : [];

      if (
        receivedEvents.length > 0 ||
        receivedTasks.length > 0
      ) {
        setEvents((previousEvents) => {
          const otherMonthEvents =
            previousEvents.filter(
              (event) =>
                getEventDateKey(event) !==
                dateKey
            );

          return [
            ...otherMonthEvents,
            ...receivedEvents,
          ];
        });

        setTasks((previousTasks) => {
          const otherMonthTasks =
            previousTasks.filter(
              (task) =>
                getTaskDateKey(task) !==
                dateKey
            );

          return [
            ...otherMonthTasks,
            ...receivedTasks,
          ];
        });
      }
    } catch (err) {
      console.error(
        "loadSelectedDay error:",
        err
      );

      setSelectedError(
        err?.message ||
          "Unable to load selected date."
      );
    } finally {
      setSelectedLoading(false);
    }
  }, [apiRequest, formatDateKey]);

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  // ============================================================
  // MONTH CHANGE LOAD
  // ============================================================

  useEffect(() => {
    loadMonthEvents();
  }, [loadMonthEvents]);

  // ============================================================
  // SELECTED DAY LOAD
  // ============================================================

  useEffect(() => {
    if (!selectedDate) return;

    loadSelectedDay(selectedDate);
  }, [selectedDate, loadSelectedDay]);

  // ============================================================
  // CALENDAR DAYS
  // ============================================================

  const calendarDays = useMemo(() => {
    const year =
      currentDate.getFullYear();

    const month =
      currentDate.getMonth();

    const firstDay =
      new Date(year, month, 1);

    const lastDay =
      new Date(year, month + 1, 0);

    const previousMonthLastDay =
      new Date(year, month, 0).getDate();

    const days = [];

    // Previous month
    for (
      let i = firstDay.getDay() - 1;
      i >= 0;
      i -= 1
    ) {
      const fullDate =
        new Date(
          year,
          month - 1,
          previousMonthLastDay - i
        );

      days.push({
        date:
          previousMonthLastDay - i,
        fullDate,
        currentMonth: false,
      });
    }

    // Current month
    for (
      let day = 1;
      day <= lastDay.getDate();
      day += 1
    ) {
      days.push({
        date: day,
        fullDate:
          new Date(
            year,
            month,
            day
          ),
        currentMonth: true,
      });
    }

    // Next month
    let nextDay = 1;

    while (days.length < 42) {
      days.push({
        date: nextDay,
        fullDate:
          new Date(
            year,
            month + 1,
            nextDay
          ),
        currentMonth: false,
      });

      nextDay += 1;
    }

    return days;
  }, [currentDate]);

  const monthLabel =
    currentDate.toLocaleDateString(
      "en-US",
      {
        month: "long",
        year: "numeric",
      }
    );

  // ============================================================
  // EVENT/TASK DATE HELPERS
  // ============================================================

  function getEventDateKey(event) {
    if (!event?.startDate) {
      return null;
    }

    const date =
      new Date(event.startDate);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return formatDateKey(date);
  }

  function getTaskDateKey(task) {
    if (!task?.dueDateKey && !task?.dueDate) {
      return null;
    }

    if (task.dueDateKey) {
      return task.dueDateKey;
    }

    const date =
      new Date(task.dueDate);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return formatDateKey(date);
  }

  // ============================================================
  // DATA GROUPING
  // ============================================================

  const eventsByDate = useMemo(() => {
    const grouped = {};

    events.forEach((event) => {
      const key =
        getEventDateKey(event);

      if (!key) return;

      if (!grouped[key]) {
        grouped[key] = [];
      }

      grouped[key].push(event);
    });

    return grouped;
  }, [events]);

  const tasksByDate = useMemo(() => {
    const grouped = {};

    tasks.forEach((task) => {
      const key =
        getTaskDateKey(task);

      if (!key) return;

      if (!grouped[key]) {
        grouped[key] = [];
      }

      grouped[key].push(task);
    });

    return grouped;
  }, [tasks]);

  const selectedDateKey = selectedDate
    ? formatDateKey(selectedDate)
    : null;

  const selectedEvents =
    selectedDateKey
      ? eventsByDate[selectedDateKey] || []
      : [];

  const selectedTasks =
    selectedDateKey
      ? tasksByDate[selectedDateKey] || []
      : [];

  const selectedItems = useMemo(() => {
    const eventItems =
      selectedEvents.map((event) => ({
        kind: "event",
        id:
          event.id ||
          event._id,
        data: event,
        date:
          event.startDate,
      }));

    const taskItems =
      selectedTasks.map((task) => ({
        kind: "task",
        id:
          task.id ||
          task._id,
        data: task,
        date:
          task.dueDate,
      }));

    return [
      ...eventItems,
      ...taskItems,
    ].sort(
      (a, b) =>
        new Date(a.date || 0).getTime() -
        new Date(b.date || 0).getTime()
    );
  }, [
    selectedEvents,
    selectedTasks,
  ]);

  // ============================================================
  // NAVIGATION
  // ============================================================

  function goToPreviousMonth() {
    setCurrentDate(
      (previous) =>
        new Date(
          previous.getFullYear(),
          previous.getMonth() - 1,
          1
        )
    );

    setSelectedDate(null);
  }

  function goToNextMonth() {
    setCurrentDate(
      (previous) =>
        new Date(
          previous.getFullYear(),
          previous.getMonth() + 1,
          1
        )
    );

    setSelectedDate(null);
  }

  function goToToday() {
    const today = new Date();

    setCurrentDate(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
    );

    setSelectedDate(today);
  }

  function handleDateClick(day) {
    setSelectedDate(day.fullDate);

    if (!day.currentMonth) {
      setCurrentDate(
        new Date(
          day.fullDate.getFullYear(),
          day.fullDate.getMonth(),
          1
        )
      );
    }
  }

  function isToday(date) {
    const today = new Date();

    return (
      date.getFullYear() ===
        today.getFullYear() &&
      date.getMonth() ===
        today.getMonth() &&
      date.getDate() ===
        today.getDate()
    );
  }

  function isSelected(date) {
    if (!selectedDate) {
      return false;
    }

    return (
      date.getFullYear() ===
        selectedDate.getFullYear() &&
      date.getMonth() ===
        selectedDate.getMonth() &&
      date.getDate() ===
        selectedDate.getDate()
    );
  }

  // ============================================================
  // SIGN OUT
  // ============================================================

  async function handleSignOut() {
    try {
      setSigningOut(true);

      await apiRequest(
        "/auth/logout",
        {
          method: "POST",
        }
      );
    } catch (err) {
      console.error(
        "logout error:",
        err
      );
    } finally {
      setSigningOut(false);
      router.push("/login");
      router.refresh();
    }
  }

  // ============================================================
  // USER DISPLAY
  // ============================================================

  const userName =
    user?.name ||
    user?.fullName ||
    user?.displayName ||
    user?.email ||
    "User";

  const userRole =
    user?.role
      ? String(user.role)
          .charAt(0)
          .toUpperCase() +
        String(user.role).slice(1)
      : "User Account";

  const userInitial =
    userName
      .trim()
      .charAt(0)
      .toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* ======================================================
          MOBILE OVERLAY
      ======================================================= */}

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() =>
            setSidebarOpen(false)
          }
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* ======================================================
          SIDEBAR
      ======================================================= */}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#171B3A] shadow-xl transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-sm">
              <ShieldCheck size={22} />
            </div>

            <div>
              <h1 className="text-sm font-bold text-white">
                Local Pro 1
              </h1>

              <p className="text-[11px] font-medium text-slate-300">
                User Workspace
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setSidebarOpen(false)
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-300">
            Workspace
          </p>

          <div className="space-y-1.5">
            {navigation.map(
              (item) => (
                <UserNavItem
                  key={item.href}
                  item={item}
                  onNavigate={() =>
                    setSidebarOpen(false)
                  }
                />
              )
            )}
          </div>
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-xl px-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2563EB] text-xs font-bold text-white">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={userName}
                  className="h-full w-full object-cover"
                />
              ) : (
                userInitial
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {userLoading
                  ? "Loading..."
                  : userName}
              </p>

              <p className="truncate text-xs font-medium text-slate-300">
                {userRole}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={signingOut}
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? (
              <Loader2
                size={17}
                className="animate-spin"
              />
            ) : (
              <LogOut size={17} />
            )}

            <span>
              {signingOut
                ? "Signing Out..."
                : "Sign Out"}
            </span>
          </button>
        </div>
      </aside>

      {/* ======================================================
          MAIN
      ======================================================= */}

      <div className="lg:pl-64">
        {/* ====================================================
            TOP BAR
        ===================================================== */}

        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-[#26344D] transition hover:bg-slate-50 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

            <div>
              <p className="text-xs font-medium text-[#64748B]">
                Workspace
              </p>

              <p className="text-sm font-bold text-[#171B3A]">
                Calendar
              </p>
            </div>
          </div>

          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#EEF4FF] text-xs font-bold text-[#2563EB]">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={userName}
                className="h-full w-full object-cover"
              />
            ) : (
              userInitial
            )}
          </div>
        </header>

        {/* ====================================================
            CONTENT
        ===================================================== */}

        <main className="min-h-[calc(100vh-4rem)] p-5 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Heading */}

            <section>
              <p className="text-sm font-semibold text-[#2563EB]">
                WORKSPACE
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
                Calendar
              </h1>

              <p className="mt-2 text-sm text-[#64748B]">
                View your assigned tasks, deadlines,
                appointments, and scheduled events.
              </p>
            </section>

            {/* API ERROR */}

            {error && (
              <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <XCircle
                    size={20}
                    className="mt-0.5 shrink-0 text-red-500"
                  />

                  <div>
                    <p className="text-sm font-bold text-red-700">
                      Calendar data could not be loaded
                    </p>

                    <p className="mt-1 text-xs leading-5 text-red-600">
                      {error}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* ==================================================
                CALENDAR
            ================================================== */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Toolbar */}

              <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={
                      goToPreviousMonth
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-[#26344D] transition hover:bg-slate-50"
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={19} />
                  </button>

                  <h2 className="min-w-[170px] text-center text-lg font-bold text-[#171B3A]">
                    {monthLabel}
                  </h2>

                  <button
                    type="button"
                    onClick={
                      goToNextMonth
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-[#26344D] transition hover:bg-slate-50"
                    aria-label="Next month"
                  >
                    <ChevronRight size={19} />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={goToToday}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-[#26344D] transition hover:bg-slate-50"
                  >
                    Today
                  </button>

                  <button
                    type="button"
                    onClick={
                      loadMonthEvents
                    }
                    disabled={loading}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading && (
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                    )}

                    Refresh
                  </button>
                </div>
              </div>

              {/* Loading */}

              {loading && (
                <div className="flex items-center justify-center gap-3 border-b border-slate-100 bg-[#EEF4FF]/40 px-5 py-3">
                  <Loader2
                    size={17}
                    className="animate-spin text-[#2563EB]"
                  />

                  <span className="text-xs font-semibold text-[#2563EB]">
                    Loading calendar data...
                  </span>
                </div>
              )}

              {/* Calendar Grid */}

              <div className="overflow-x-auto">
                <div className="min-w-[760px]">
                  {/* Week Header */}

                  <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/70">
                    {weekDays.map(
                      (day) => (
                        <div
                          key={day}
                          className="border-r border-slate-100 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400 last:border-r-0"
                        >
                          {day.slice(
                            0,
                            3
                          )}
                        </div>
                      )
                    )}
                  </div>

                  {/* Days */}

                  <div className="grid grid-cols-7">
                    {calendarDays.map(
                      (day, index) => {
                        const today =
                          isToday(
                            day.fullDate
                          );

                        const selected =
                          isSelected(
                            day.fullDate
                          );

                        const dateKey =
                          formatDateKey(
                            day.fullDate
                          );

                        const dayEvents =
                          eventsByDate[
                            dateKey
                          ] || [];

                        const dayTasks =
                          tasksByDate[
                            dateKey
                          ] || [];

                        const totalItems =
                          dayEvents.length +
                          dayTasks.length;

                        return (
                          <button
                            key={`${day.fullDate.toISOString()}-${index}`}
                            type="button"
                            onClick={() =>
                              handleDateClick(
                                day
                              )
                            }
                            className={`relative min-h-[145px] border-b border-r border-slate-100 p-3 text-left transition hover:bg-slate-50 ${
                              !day.currentMonth
                                ? "bg-slate-50/40"
                                : "bg-white"
                            } ${
                              selected
                                ? "ring-2 ring-inset ring-[#2563EB]"
                                : ""
                            }`}
                          >
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                                today
                                  ? "bg-[#2563EB] text-white"
                                  : day.currentMonth
                                  ? "text-[#26344D]"
                                  : "text-slate-300"
                              }`}
                            >
                              {day.date}
                            </span>

                            {totalItems >
                              0 && (
                              <div className="mt-2 space-y-1.5">
                                {dayEvents
                                  .slice(
                                    0,
                                    2
                                  )
                                  .map(
                                    (
                                      event
                                    ) => (
                                      <CalendarEventBadge
                                        key={
                                          event.id ||
                                          event._id
                                        }
                                        event={
                                          event
                                        }
                                      />
                                    )
                                  )}

                                {dayTasks
                                  .slice(
                                    0,
                                    Math.max(
                                      0,
                                      2 -
                                        dayEvents.length
                                    )
                                  )
                                  .map(
                                    (
                                      task
                                    ) => (
                                      <CalendarTaskBadge
                                        key={
                                          task.id ||
                                          task._id
                                        }
                                        task={
                                          task
                                        }
                                      />
                                    )
                                  )}

                                {totalItems >
                                  2 && (
                                  <p className="px-1 text-[10px] font-semibold text-[#64748B]">
                                    +
                                    {totalItems -
                                      2}{" "}
                                    more
                                  </p>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* ==================================================
                SELECTED DATE
            =================================================== */}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              {selectedDate ? (
                <div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                        <CalendarDays
                          size={19}
                        />
                      </div>

                      <div>
                        <h2 className="text-base font-bold text-[#171B3A]">
                          {selectedDate.toLocaleDateString(
                            "en-US",
                            {
                              weekday:
                                "long",
                              month:
                                "long",
                              day: "numeric",
                              year:
                                "numeric",
                            }
                          )}
                        </h2>

                        <p className="mt-1 text-sm text-[#64748B]">
                          Live data from your Local
                          Pro 1 backend.
                        </p>
                      </div>
                    </div>

                    {selectedLoading && (
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#2563EB]">
                        <Loader2
                          size={15}
                          className="animate-spin"
                        />

                        Loading date...
                      </div>
                    )}
                  </div>

                  {selectedError && (
                    <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-600">
                      {selectedError}
                    </div>
                  )}

                  {/* No data */}

                  {!selectedLoading &&
                    selectedItems.length ===
                      0 && (
                      <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                        <CalendarDays
                          size={25}
                          className="mx-auto text-slate-300"
                        />

                        <p className="mt-3 text-sm font-bold text-[#171B3A]">
                          No events or tasks
                        </p>

                        <p className="mt-1 text-xs text-[#64748B]">
                          There are no backend records
                          scheduled for this date.
                        </p>
                      </div>
                    )}

                  {/* Selected data */}

                  {selectedItems.length >
                    0 && (
                    <div className="mt-5 space-y-3">
                      {selectedItems.map(
                        (item) =>
                          item.kind ===
                          "event" ? (
                            <EventListItem
                              key={`event-${item.id}`}
                              event={
                                item.data
                              }
                            />
                          ) : (
                            <TaskListItem
                              key={`task-${item.id}`}
                              task={
                                item.data
                              }
                            />
                          )
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                    <CalendarDays
                      size={22}
                    />
                  </div>

                  <h2 className="mt-4 text-sm font-bold text-[#171B3A]">
                    Select a date
                  </h2>

                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#64748B]">
                    Select a date from the calendar to
                    view your tasks and scheduled events.
                  </p>
                </div>
              )}
            </section>

            {/* ==================================================
                BACKEND STATUS
            =================================================== */}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />

                <div>
                  <h2 className="text-sm font-bold text-[#171B3A]">
                    
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-[#64748B]">
                    Calendar events are loaded from{" "}
                    <span className="font-semibold">
                      /api/events
                    </span>{" "}
                    and task deadlines are loaded from{" "}
                    <span className="font-semibold">
                      /api/calendar/tasks
                    </span>
                    . Authentication uses the existing
                    backend session/cookie.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

// ============================================================
// NAV ITEM
// ============================================================

function UserNavItem({
  item,
  onNavigate,
}) {
  const pathname =
    usePathname();

  const Icon = item.icon;

  const isActive =
    pathname === item.href ||
    (item.href !== "/user" &&
      pathname.startsWith(
        `${item.href}/`
      ));

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
        isActive
          ? "bg-[#2563EB] text-white shadow-sm"
          : "bg-transparent text-white hover:bg-white/10"
      }`}
    >
      <Icon
        size={18}
        strokeWidth={2}
        className="shrink-0 text-white"
      />

      <span className="text-white">
        {item.label}
      </span>
    </Link>
  );
}

// ============================================================
// CALENDAR EVENT BADGE
// ============================================================

function CalendarEventBadge({
  event,
}) {
  const color =
    event?.color || "#2563EB";

  return (
    <div
      className="truncate rounded-md px-1.5 py-1 text-[10px] font-semibold text-white"
      style={{
        backgroundColor: color,
      }}
      title={
        event?.title ||
        "Event"
      }
    >
      {event?.title || "Event"}
    </div>
  );
}

// ============================================================
// CALENDAR TASK BADGE
// ============================================================

function CalendarTaskBadge({
  task,
}) {
  return (
    <div
      className={`truncate rounded-md border px-1.5 py-1 text-[10px] font-semibold ${
        task?.overdue
          ? "border-red-200 bg-red-50 text-red-600"
          : task?.isCompleted
          ? "border-emerald-200 bg-emerald-50 text-emerald-600"
          : "border-blue-200 bg-blue-50 text-blue-600"
      }`}
      title={
        task?.title ||
        "Task"
      }
    >
      {task?.title || "Task"}
    </div>
  );
}

// ============================================================
// EVENT LIST ITEM
// ============================================================

function EventListItem({
  event,
}) {
  const eventType =
    event?.type ||
    event?.eventType ||
    "meeting";

  const status =
    event?.status ||
    "scheduled";

  const color =
    event?.color ||
    "#2563EB";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className="mt-1 h-9 w-1 shrink-0 rounded-full"
          style={{
            backgroundColor: color,
          }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#171B3A]">
                {event?.title ||
                  "Untitled Event"}
              </h3>

              {event?.description && (
                <p className="mt-1 text-xs leading-5 text-[#64748B]">
                  {event.description}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-[#EEF4FF] px-2.5 py-1 text-[10px] font-bold text-[#2563EB]">
                {eventTypeLabels[
                  eventType
                ] || "Event"}
              </span>

              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  status ===
                  "completed"
                    ? "bg-emerald-50 text-emerald-600"
                    : status ===
                      "cancelled"
                    ? "bg-red-50 text-red-600"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {statusLabels[
                  status
                ] || status}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#64748B]">
            {(event?.startTime ||
              event?.endTime) && (
              <div className="flex items-center gap-1.5">
                <Clock3
                  size={14}
                />

                <span>
                  {event?.startTime ||
                    "--:--"}

                  {event?.endTime
                    ? ` - ${event.endTime}`
                    : ""}
                </span>
              </div>
            )}

            {event?.location && (
              <div className="flex items-center gap-1.5">
                <MapPin
                  size={14}
                />

                <span>
                  {event.location}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TASK LIST ITEM
// ============================================================

function TaskListItem({
  task,
}) {
  const completed =
    task?.isCompleted ||
    task?.status ===
      "Completed";

  const cancelled =
    task?.isCancelled ||
    task?.status ===
      "Cancelled";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            task?.overdue
              ? "bg-red-50 text-red-500"
              : completed
              ? "bg-emerald-50 text-emerald-500"
              : "bg-[#EEF4FF] text-[#2563EB]"
          }`}
        >
          {completed ? (
            <CheckCircle2
              size={18}
            />
          ) : (
            <ClipboardList
              size={18}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#171B3A]">
                {task?.title ||
                  "Untitled Task"}
              </h3>

              {task?.description && (
                <p className="mt-1 text-xs leading-5 text-[#64748B]">
                  {task.description}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  task?.overdue
                    ? "bg-red-50 text-red-600"
                    : completed
                    ? "bg-emerald-50 text-emerald-600"
                    : cancelled
                    ? "bg-slate-100 text-slate-500"
                    : "bg-blue-50 text-blue-600"
                }`}
              >
                {task?.overdue
                  ? "Overdue"
                  : task?.status ||
                    "Pending"}
              </span>

              {task?.priority && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                  {task.priority}
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#64748B]">
            {task?.category && (
              <span>
                Category:{" "}
                <span className="font-semibold text-[#26344D]">
                  {task.category}
                </span>
              </span>
            )}

            {task?.assignedTo?.name && (
              <span>
                Assigned to:{" "}
                <span className="font-semibold text-[#26344D]">
                  {
                    task.assignedTo
                      .name
                  }
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}