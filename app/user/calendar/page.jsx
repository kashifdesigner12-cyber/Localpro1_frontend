"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  RefreshCw,
  Settings,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
  Sparkles,
} from "lucide-react";

import { authService } from "@/services/authService";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.localpro1.net/api";

const CACHE_TIME = 60 * 1000;

const navigation = [
  { label: "Dashboard", href: "/user", icon: LayoutDashboard },
  { label: "My Tasks", href: "/user/tasks", icon: ClipboardList },
  { label: "Calendar", href: "/user/calendar", icon: CalendarDays },
  { label: "Attendance", href: "/user/attendance", icon: Clock3 },
  { label: "Messages", href: "/user/messages", icon: MessageSquare },
  { label: "Notifications", href: "/user/notifications", icon: Bell },
  { label: "Leave Requests", href: "/user/leave-requests", icon: FileText },
  { label: "Activity", href: "/user/activity", icon: Activity },
  { label: "Profile", href: "/user/profile", icon: UserRound },
  { label: "Settings", href: "/user/settings", icon: Settings },
  { label: "Policies", href: "/user/policies", icon: ShieldCheck },
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
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date();
  });

  const [user, setUser] = useState(() => extractUser(authService?.getUser?.()));
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [loading, setLoading] = useState(false); // Instant render
  const [refreshing, setRefreshing] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const cacheRef = useRef({ timestamp: 0, data: null });
  const loadingRef = useRef(false);

  /* ============================================================
     API HELPER
  ============================================================ */

  const apiRequest = useCallback(async (endpoint, options = {}) => {
    let token = null;
    try {
      if (typeof window !== "undefined") {
        token =
          localStorage.getItem("token") ||
          localStorage.getItem("authToken") ||
          sessionStorage.getItem("token");
      }
      if (!token && typeof authService?.getToken === "function") {
        token = authService.getToken();
      }
    } catch (e) {}

    const cleanEndpoint = endpoint.startsWith("/api/")
      ? endpoint.replace(/^\/api/, "")
      : endpoint;
    const finalPath = cleanEndpoint.startsWith("/") ? cleanEndpoint : `/${cleanEndpoint}`;

    const response = await fetch(`${API_URL}${finalPath}`, {
      ...options,
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      cache: "no-store",
    });

    let data = null;
    try {
      const text = await response.text();
      if (text) data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        router.replace("/login");
      }
      throw new Error(
        data?.message || data?.error || `Request failed with status ${response.status}`
      );
    }

    return data;
  }, [router]);

  /* ============================================================
     DATE HELPERS
  ============================================================ */

  const formatDateKey = useCallback((date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const formatApiDate = useCallback((date) => {
    return formatDateKey(date);
  }, [formatDateKey]);

  const monthStart = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  }, [currentDate]);

  const monthEnd = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  }, [currentDate]);

  /* ============================================================
     LOAD CURRENT USER
  ============================================================ */

  const loadCurrentUser = useCallback(async () => {
    try {
      const response = await authService.me();
      const currentUser = extractUser(response);
      if (currentUser) setUser(currentUser);
    } catch (err) {
      console.error("loadCurrentUser error:", err);
    }
  }, []);

  /* ============================================================
     LOAD MONTH EVENTS (Speed Optimized & Cached)
  ============================================================ */

  const loadMonthEvents = useCallback(
    async (force = false) => {
      if (loadingRef.current) return;

      const now = Date.now();
      const cacheKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;

      if (
        !force &&
        cacheRef.current.data &&
        cacheRef.current.key === cacheKey &&
        now - cacheRef.current.timestamp < CACHE_TIME
      ) {
        return;
      }

      loadingRef.current = true;
      if (force) setRefreshing(true);

      try {
        setError("");
        const startDate = formatApiDate(monthStart);
        const endDate = formatApiDate(monthEnd);

        const [eventsResponse, tasksResponse] = await Promise.all([
          apiRequest(`/events?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&limit=200`).catch(() => ({ events: [] })),
          apiRequest(`/calendar/tasks?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`).catch(() => ({ tasks: [] })),
        ]);

        const receivedEvents =
          Array.isArray(eventsResponse?.events) ? eventsResponse.events :
          Array.isArray(eventsResponse?.data) ? eventsResponse.data :
          Array.isArray(eventsResponse) ? eventsResponse : [];

        const receivedTasks =
          Array.isArray(tasksResponse?.tasks) ? tasksResponse.tasks :
          Array.isArray(tasksResponse?.data?.tasks) ? tasksResponse.data.tasks :
          Array.isArray(tasksResponse?.data) ? tasksResponse.data :
          Array.isArray(tasksResponse) ? tasksResponse : [];

        setEvents(receivedEvents);
        setTasks(receivedTasks);

        cacheRef.current = {
          key: cacheKey,
          timestamp: Date.now(),
          data: { events: receivedEvents, tasks: receivedTasks },
        };
      } catch (err) {
        console.error("loadMonthEvents error:", err);
        setError(err?.message || "Unable to load calendar data.");
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiRequest, formatApiDate, monthStart, monthEnd, currentDate]
  );

  const loadSelectedDay = useCallback(async (date) => {
    if (!date) return;
    try {
      setSelectedLoading(true);
      const dateKey = formatDateKey(date);

      const [eventsResponse, tasksResponse] = await Promise.all([
        apiRequest(`/events?startDate=${encodeURIComponent(dateKey)}&endDate=${encodeURIComponent(dateKey)}&limit=200`).catch(() => ({ events: [] })),
        apiRequest(`/calendar/day/${encodeURIComponent(dateKey)}`).catch(() => ({ tasks: [] })),
      ]);

      const receivedEvents = Array.isArray(eventsResponse?.events) ? eventsResponse.events : [];
      const receivedTasks = Array.isArray(tasksResponse?.tasks) ? tasksResponse.tasks : [];

      if (receivedEvents.length > 0 || receivedTasks.length > 0) {
        setEvents((prev) => {
          const filtered = prev.filter((e) => getEventDateKey(e) !== dateKey);
          return [...filtered, ...receivedEvents];
        });
        setTasks((prev) => {
          const filtered = prev.filter((t) => getTaskDateKey(t) !== dateKey);
          return [...filtered, ...receivedTasks];
        });
      }
    } catch {} finally {
      setSelectedLoading(false);
    }
  }, [apiRequest, formatDateKey]);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    loadMonthEvents(false);
  }, [loadMonthEvents]);

  useEffect(() => {
    if (!selectedDate) return;
    loadSelectedDay(selectedDate);
  }, [selectedDate, loadSelectedDay]);

  /* ============================================================
     CALENDAR DAYS GRID
  ============================================================ */

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const previousMonthLastDay = new Date(year, month, 0).getDate();

    const days = [];

    for (let i = firstDay.getDay() - 1; i >= 0; i -= 1) {
      days.push({
        date: previousMonthLastDay - i,
        fullDate: new Date(year, month - 1, previousMonthLastDay - i),
        currentMonth: false,
      });
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      days.push({
        date: day,
        fullDate: new Date(year, month, day),
        currentMonth: true,
      });
    }

    let nextDay = 1;
    while (days.length < 42) {
      days.push({
        date: nextDay,
        fullDate: new Date(year, month + 1, nextDay),
        currentMonth: false,
      });
      nextDay += 1;
    }

    return days;
  }, [currentDate]);

  const monthLabel = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function getEventDateKey(event) {
    if (!event?.startDate) return null;
    const date = new Date(event.startDate);
    if (Number.isNaN(date.getTime())) return null;
    return formatDateKey(date);
  }

  function getTaskDateKey(task) {
    if (!task?.dueDateKey && !task?.dueDate) return null;
    if (task.dueDateKey) return task.dueDateKey;
    const date = new Date(task.dueDate);
    if (Number.isNaN(date.getTime())) return null;
    return formatDateKey(date);
  }

  const eventsByDate = useMemo(() => {
    const grouped = {};
    events.forEach((event) => {
      const key = getEventDateKey(event);
      if (!key) return;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(event);
    });
    return grouped;
  }, [events]);

  const tasksByDate = useMemo(() => {
    const grouped = {};
    tasks.forEach((task) => {
      const key = getTaskDateKey(task);
      if (!key) return;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });
    return grouped;
  }, [tasks]);

  const selectedDateKey = selectedDate ? formatDateKey(selectedDate) : null;
  const selectedEvents = selectedDateKey ? eventsByDate[selectedDateKey] || [] : [];
  const selectedTasks = selectedDateKey ? tasksByDate[selectedDateKey] || [] : [];

  const selectedItems = useMemo(() => {
    const eventItems = selectedEvents.map((event) => ({
      kind: "event",
      id: event.id || event._id,
      data: event,
      date: event.startDate,
    }));

    const taskItems = selectedTasks.map((task) => ({
      kind: "task",
      id: task.id || task._id,
      data: task,
      date: task.dueDate,
    }));

    return [...eventItems, ...taskItems].sort(
      (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
    );
  }, [selectedEvents, selectedTasks]);

  function goToPreviousMonth() {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setSelectedDate(null);
  }

  function goToNextMonth() {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedDate(null);
  }

  function goToToday() {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  }

  function handleDateClick(day) {
    setSelectedDate(day.fullDate);
    if (!day.currentMonth) {
      setCurrentDate(new Date(day.fullDate.getFullYear(), day.fullDate.getMonth(), 1));
    }
  }

  function isToday(date) {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  function isSelected(date) {
    if (!selectedDate) return false;
    return (
      date.getFullYear() === selectedDate.getFullYear() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getDate() === selectedDate.getDate()
    );
  }

  async function handleSignOut() {
    if (signingOut) return;
    try {
      setSigningOut(true);
      if (typeof authService?.logout === "function") {
        await authService.logout();
      }
    } catch {} finally {
      setSigningOut(false);
      router.replace("/login");
    }
  }

  const userName = user?.name || user?.fullName || user?.email || "User";
  const userInitial = String(userName).trim().charAt(0).toUpperCase() || "U";
  const userEmail = user?.email || "User Account";

  return (
    <div className="relative min-h-screen w-full bg-[#f7f8fc] text-slate-900 animate-fadeIn">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl animate-pulse" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* SIDEBAR (Matching Admin Dark Theme & Animations) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#171B3A] text-white shadow-2xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <Link
            href="/user"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 text-white"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-md shadow-purple-600/20">
              <ShieldCheck size={22} />
            </div>

            <div>
              <h1 className="text-sm font-bold text-white">Local Pro 1</h1>
              <p className="text-[11px] font-semibold text-violet-400">
                User Workspace
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Workspace
          </p>

          <div className="space-y-1.5">
            {navigation.map((item) => (
              <UserNavItem
                key={item.href}
                item={item}
                onNavigate={() => setSidebarOpen(false)}
              />
            ))}
          </div>
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-600 text-xs font-bold text-white">
              {user?.avatar ? (
                <img src={user.avatar} alt={userName} className="h-full w-full object-cover" />
              ) : (
                userInitial
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{userName}</p>
              <p className="truncate text-xs font-medium text-slate-400">{userEmail}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-60"
          >
            {signingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="min-h-screen w-full lg:pl-64">
        {/* TOP BAR */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-5 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

            <div>
              <p className="text-xs font-semibold text-slate-400">Workspace</p>
              <p className="text-sm font-bold text-slate-900">Calendar</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => loadMonthEvents(true)}
              disabled={refreshing}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-violet-50 hover:text-violet-600 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin text-violet-600" : ""} />
            </button>

            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-sm">
              {user?.avatar ? (
                <img src={user.avatar} alt={userName} className="h-full w-full object-cover" />
              ) : (
                userInitial
              )}
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 animate-slideUp">
          <div className="mx-auto max-w-7xl space-y-6">

            {/* HEADER SECTION (NO BANNER) */}
            <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/80 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-violet-700">
                  <ShieldCheck size={13} />
                  SCHEDULE & EVENTS
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  Calendar
                </h1>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  View your assigned tasks, deadlines, appointments, and scheduled events.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goToToday}
                  className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200/90 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Today
                </button>
              </div>
            </section>

            {error && (
              <section className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs font-bold text-rose-700 shadow-sm">
                <div className="flex items-center justify-between">
                  <p>{error}</p>
                  <button onClick={() => setError("")} className="text-rose-400 hover:text-rose-600">
                    <X size={16} />
                  </button>
                </div>
              </section>
            )}

            {/* CALENDAR CARD */}
            <section className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]">
              {/* Toolbar */}
              <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/50 px-6 py-4.5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={goToPreviousMonth}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-700 transition hover:bg-slate-50"
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={17} />
                  </button>

                  <h2 className="min-w-[160px] text-center text-base font-extrabold text-slate-900">
                    {monthLabel}
                  </h2>

                  <button
                    type="button"
                    onClick={goToNextMonth}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-700 transition hover:bg-slate-50"
                    aria-label="Next month"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>

                {loading && (
                  <div className="flex items-center gap-2 text-xs font-bold text-violet-600">
                    <Loader2 size={15} className="animate-spin" />
                    Loading month data...
                  </div>
                )}
              </div>

              {/* Grid */}
              <div className="overflow-x-auto">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/30">
                    {weekDays.map((day) => (
                      <div
                        key={day}
                        className="border-r border-slate-100 px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 last:border-r-0"
                      >
                        {day.slice(0, 3)}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7">
                    {calendarDays.map((day, index) => {
                      const today = isToday(day.fullDate);
                      const selected = isSelected(day.fullDate);
                      const dateKey = formatDateKey(day.fullDate);
                      const dayEvents = eventsByDate[dateKey] || [];
                      const dayTasks = tasksByDate[dateKey] || [];
                      const totalItems = dayEvents.length + dayTasks.length;

                      return (
                        <button
                          key={`${day.fullDate.toISOString()}-${index}`}
                          type="button"
                          onClick={() => handleDateClick(day)}
                          className={`relative min-h-[135px] border-b border-r border-slate-100 p-3 text-left transition hover:bg-slate-50/80 ${
                            !day.currentMonth ? "bg-slate-50/30 opacity-60" : "bg-white"
                          } ${selected ? "ring-2 ring-inset ring-violet-600" : ""}`}
                        >
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-xl text-xs font-bold ${
                              today
                                ? "bg-violet-600 text-white shadow-sm"
                                : day.currentMonth
                                ? "text-slate-900"
                                : "text-slate-400"
                            }`}
                          >
                            {day.date}
                          </span>

                          {totalItems > 0 && (
                            <div className="mt-2 space-y-1">
                              {dayEvents.slice(0, 2).map((event) => (
                                <div
                                  key={event.id || event._id}
                                  className="truncate rounded-lg px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs"
                                  style={{ backgroundColor: event?.color || "#7c3aed" }}
                                  title={event?.title || "Event"}
                                >
                                  {event?.title || "Event"}
                                </div>
                              ))}

                              {dayTasks.slice(0, Math.max(0, 2 - dayEvents.length)).map((task) => (
                                <div
                                  key={task.id || task._id}
                                  className="truncate rounded-lg border border-violet-100 bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold text-violet-700"
                                  title={task?.title || "Task"}
                                >
                                  {task?.title || "Task"}
                                </div>
                              ))}

                              {totalItems > 2 && (
                                <p className="px-1 text-[9px] font-bold text-slate-400">
                                  +{totalItems - 2} more
                                </p>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* SELECTED DATE DETAILS */}
            <section className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)] p-6 sm:p-8">
              {selectedDate ? (
                <div>
                  <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                        <CalendarDays size={20} />
                      </div>
                      <div>
                        <h2 className="text-base font-extrabold text-slate-900">
                          {selectedDate.toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </h2>
                        <p className="text-xs text-slate-400">Scheduled items for this date.</p>
                      </div>
                    </div>

                    {selectedLoading && (
                      <div className="flex items-center gap-2 text-xs font-bold text-violet-600">
                        <Loader2 size={15} className="animate-spin" />
                        Loading items...
                      </div>
                    )}
                  </div>

                  {selectedItems.length === 0 ? (
                    <div className="flex min-h-[180px] flex-col items-center justify-center py-10 text-center">
                      <CalendarDays size={28} className="text-slate-300" />
                      <p className="mt-3 text-xs font-bold text-slate-800">No events or tasks</p>
                      <p className="mt-1 text-xs text-slate-400">Nothing scheduled for this date.</p>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {selectedItems.map((item) =>
                        item.kind === "event" ? (
                          <EventListItem key={`event-${item.id}`} event={item.data} />
                        ) : (
                          <TaskListItem key={`task-${item.id}`} task={item.data} />
                        )
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-10">
                  <CalendarDays size={26} className="mx-auto text-slate-300" />
                  <h3 className="mt-3 text-xs font-bold text-slate-800">Select a date</h3>
                  <p className="mt-1 text-xs text-slate-400">Click any day above to review scheduled tasks and events.</p>
                </div>
              )}
            </section>

          </div>
        </main>
      </div>
    </div>
  );
}

function UserNavItem({ item, onNavigate }) {
  const pathname = usePathname();
  const Icon = item.icon;
  const isActive =
    pathname === item.href ||
    (item.href !== "/user" && pathname.startsWith(`${item.href}/`));

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold transition duration-150 ${
        isActive
          ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon size={18} className={`transition duration-150 ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`} />
      <span>{item.label}</span>
    </Link>
  );
}

function EventListItem({ event }) {
  const eventType = event?.type || event?.eventType || "meeting";
  const status = event?.status || "scheduled";
  const color = event?.color || "#7c3aed";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 transition hover:border-violet-200 hover:shadow-sm">
      <div className="flex items-start gap-3.5">
        <div className="mt-1 h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900">{event?.title || "Untitled Event"}</h3>
              {event?.description && (
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{event.description}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[10px] font-bold text-violet-700">
                {eventTypeLabels[eventType] || "Event"}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                status === "completed" ? "bg-emerald-50 text-emerald-600" : status === "cancelled" ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"
              }`}>
                {statusLabels[status] || status}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
            {(event?.startTime || event?.endTime) && (
              <div className="flex items-center gap-1.5">
                <Clock3 size={13} className="text-violet-600" />
                <span>{event?.startTime || "--:--"}{event?.endTime ? ` - ${event.endTime}` : ""}</span>
              </div>
            )}
            {event?.location && (
              <div className="flex items-center gap-1.5">
                <MapPin size={13} className="text-violet-600" />
                <span>{event.location}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskListItem({ task }) {
  const completed = task?.isCompleted || task?.status === "Completed";
  const cancelled = task?.isCancelled || task?.status === "Cancelled";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 transition hover:border-violet-200 hover:shadow-sm">
      <div className="flex items-start gap-3.5">
        <div className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
          task?.overdue ? "bg-rose-50 text-rose-500" : completed ? "bg-emerald-50 text-emerald-500" : "bg-violet-50 text-violet-600"
        }`}>
          {completed ? <CheckCircle2 size={17} /> : <ClipboardList size={17} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900">{task?.title || "Untitled Task"}</h3>
              {task?.description && (
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{task.description}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                task?.overdue ? "bg-rose-50 text-rose-600" : completed ? "bg-emerald-50 text-emerald-600" : cancelled ? "bg-slate-100 text-slate-500" : "bg-violet-50 text-violet-700"
              }`}>
                {task?.overdue ? "Overdue" : task?.status || "Pending"}
              </span>
              {task?.priority && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                  {task.priority}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function extractUser(response) {
  return response?.user || response?.data?.user || response?.data || response || null;
}