"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import { authService } from "@/services/authService";

const navigation = [
  {
    label: "Dashboard",
    href: "/manager",
    icon: LayoutDashboard,
  },
  {
    label: "Team",
    href: "/manager/team",
    icon: Users,
  },
  {
    label: "Tasks",
    href: "/manager/tasks",
    icon: ClipboardList,
  },
  {
    label: "Calendar",
    href: "/manager/calendar",
    icon: CalendarDays,
  },
  {
    label: "Activity",
    href: "/manager/activity",
    icon: Activity,
  },
  {
    label: "Settings",
    href: "/manager/settings",
    icon: Settings,
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

export default function ManagerCalendarPage() {
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const previousMonthLastDay = new Date(
      year,
      month,
      0
    ).getDate();

    const days = [];

    // Previous month visible days
    for (
      let i = firstDay.getDay() - 1;
      i >= 0;
      i -= 1
    ) {
      days.push({
        date: previousMonthLastDay - i,
        fullDate: new Date(
          year,
          month - 1,
          previousMonthLastDay - i
        ),
        currentMonth: false,
      });
    }

    // Current month days
    for (
      let day = 1;
      day <= lastDay.getDate();
      day += 1
    ) {
      days.push({
        date: day,
        fullDate: new Date(year, month, day),
        currentMonth: true,
      });
    }

    // Next month visible days
    let nextDay = 1;

    while (days.length < 42) {
      days.push({
        date: nextDay,
        fullDate: new Date(
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

  const monthLabel = currentDate.toLocaleDateString(
    "en-US",
    {
      month: "long",
      year: "numeric",
    }
  );

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

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);

      await authService.logout();
    } catch (error) {
      console.error(
        "MANAGER LOGOUT ERROR:",
        error
      );
    } finally {
      router.replace("/login");
    }
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#F8FAFC]">

      {/* =====================================================
          MOBILE OVERLAY
      ===================================================== */}

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#171B3A] shadow-xl transition-transform duration-300 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        } lg:translate-x-0`}
      >
        {/* Logo */}

        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-sm">
              <ShieldCheck size={22} />
            </div>

            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white">
                Local Pro 1
              </h1>

              <p className="text-[11px] font-medium text-slate-300">
                Manager Workspace
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation */}

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-300">
            Management
          </p>

          <div className="space-y-1.5">
            {navigation.map((item) => (
              <ManagerNavItem
                key={item.href}
                item={item}
                onNavigate={() =>
                  setSidebarOpen(false)
                }
              />
            ))}
          </div>
        </nav>

        {/* User Area */}

        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-xl px-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-xs font-bold text-white">
              M
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                Manager
              </p>

              <p className="truncate text-xs font-medium text-slate-300">
                Manager Account
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut size={17} />

            <span>
              {loggingOut
                ? "Signing Out..."
                : "Sign Out"}
            </span>
          </button>
        </div>
      </aside>

      {/* =====================================================
          FULL SCREEN MAIN CONTENT
          
          IMPORTANT:
          NO lg:pl-64
          NO max-width
      ===================================================== */}

      <main className="min-h-screen w-full">

        {/* =================================================
            MOBILE MENU
        ================================================= */}

        <div className="w-full px-4 pt-4 sm:px-6 lg:hidden">
          <button
            type="button"
            onClick={() =>
              setSidebarOpen(true)
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#26344D] shadow-sm transition hover:bg-slate-50"
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* =================================================
            PAGE CONTENT
        ================================================= */}

        <div className="w-full space-y-6 p-4 sm:p-6 lg:p-8">

          {/* Heading */}

          <section className="w-full">
            <p className="text-sm font-semibold text-[#2563EB]">
              MANAGEMENT
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
              Calendar
            </h1>

            <p className="mt-2 text-sm text-[#64748B]">
              View team tasks, schedules,
              deadlines, and upcoming events.
            </p>
          </section>

          {/* =================================================
              CALENDAR CARD
          ================================================= */}

          <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

            {/* Toolbar */}

            <div className="flex w-full flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={
                    goToPreviousMonth
                  }
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-[#26344D] transition hover:bg-slate-50"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={19} />
                </button>

                <h2 className="min-w-[170px] text-center text-lg font-bold text-[#171B3A]">
                  {monthLabel}
                </h2>

                <button
                  type="button"
                  onClick={goToNextMonth}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-[#26344D] transition hover:bg-slate-50"
                  aria-label="Next month"
                >
                  <ChevronRight size={19} />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={goToToday}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-[#26344D] transition hover:bg-slate-50"
                >
                  Today
                </button>

                <Link
                  href="/manager/calendar/new"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#1D4ED8]"
                >
                  <CalendarDays size={17} />
                  Add Event
                </Link>
              </div>
            </div>

            {/* =================================================
                FULL WIDTH CALENDAR
            ================================================= */}

            <div className="w-full overflow-x-auto">
              <div className="w-full min-w-[760px]">

                {/* Week Header */}

                <div className="grid w-full grid-cols-7 border-b border-slate-100 bg-slate-50/70">
                  {weekDays.map((day) => (
                    <div
                      key={day}
                      className="border-r border-slate-100 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400 last:border-r-0"
                    >
                      {day.slice(0, 3)}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}

                <div className="grid w-full grid-cols-7">
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

                      return (
                        <button
                          key={`${day.fullDate.toISOString()}-${index}`}
                          type="button"
                          onClick={() =>
                            handleDateClick(
                              day
                            )
                          }
                          className={`relative min-h-[140px] w-full border-b border-r border-slate-100 p-3 text-left transition hover:bg-slate-50 ${
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

                          {/* Backend events will appear here */}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* =================================================
              SELECTED DATE
          ================================================= */}

          <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

            {selectedDate ? (
              <div className="w-full">

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                    <CalendarDays size={19} />
                  </div>

                  <div className="min-w-0">
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
                      Calendar events for
                      this date will appear
                      here.
                    </p>
                  </div>
                </div>

                <div className="mt-5 w-full rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                  <CalendarDays
                    size={25}
                    className="mx-auto text-slate-300"
                  />

                  <p className="mt-3 text-sm font-semibold text-[#171B3A]">
                    No events available
                  </p>

                  <p className="mt-1 text-xs text-[#64748B]">
                    Events will be loaded
                    from the backend after
                    integration.
                  </p>
                </div>
              </div>
            ) : (
              <div className="w-full text-center">

                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                  <CalendarDays size={22} />
                </div>

                <h2 className="mt-4 text-sm font-bold text-[#171B3A]">
                  Select a date
                </h2>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#64748B]">
                  Select a date from the
                  calendar to view its tasks
                  and scheduled events.
                </p>
              </div>
            )}
          </section>

          {/* =================================================
              BACKEND NOTICE
          ================================================= */}

          <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

            <div className="flex w-full items-start gap-3">

              <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300" />

              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[#171B3A]">
                  Backend Integration Pending
                </h2>

                <p className="mt-1 text-xs leading-5 text-[#64748B]">
                  This calendar is currently
                  frontend-only. No fake events
                  are being displayed and no
                  browser storage is being used.
                  Tasks and events will be loaded
                  from the backend after
                  integration.
                </p>
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}

/* =========================================================
   MANAGER SIDEBAR NAVIGATION
========================================================= */

function ManagerNavItem({
  item,
  onNavigate,
}) {
  const pathname = usePathname();
  const Icon = item.icon;

  const isActive =
    pathname === item.href ||
    (item.href !== "/manager" &&
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
          : "bg-transparent text-white hover:bg-white/10 hover:text-white"
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