"use client";

import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  SlidersHorizontal,
} from "lucide-react";

export default function AdminCalendarPage() {
  return (
    <div className="min-h-screen w-full bg-[#F8FAFC]">
      {/* PAGE CONTENT */}
      <main className="w-full p-5 sm:p-6 lg:p-8">
        <div className="w-full space-y-6">
          {/* PAGE HEADER */}
          <section className="w-full">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#2563EB]">
                  ADMINISTRATION
                </p>

                <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
                  Calendar
                </h1>

                <p className="mt-2 text-sm text-[#64748B]">
                  Manage and monitor workspace events and appointments.
                </p>
              </div>

              <Link
                href="/admin/calendar/new"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#1D4ED8]"
              >
                <Plus size={18} />
                Add Event
              </Link>
            </div>
          </section>

          {/* CALENDAR TOOLBAR */}
          <section className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* LEFT CONTROLS */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D]"
                  aria-label="Previous period"
                >
                  <ChevronLeft size={18} />
                </button>

                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D]"
                  aria-label="Next period"
                >
                  <ChevronRight size={18} />
                </button>

                <button
                  type="button"
                  className="ml-1 h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D]"
                >
                  Today
                </button>
              </div>

              {/* CENTER TITLE */}
              <div className="flex items-center justify-center gap-2">
                <CalendarDays
                  size={18}
                  className="text-[#2563EB]"
                />

                <span className="text-base font-bold text-[#171B3A]">
                  Calendar
                </span>
              </div>

              {/* RIGHT CONTROLS */}
              <div className="flex items-center gap-2">
                <select
                  defaultValue="month"
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-[#64748B] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="month">Month</option>
                  <option value="week">Week</option>
                  <option value="day">Day</option>
                </select>

                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D]"
                >
                  <SlidersHorizontal size={16} />
                  Filters
                </button>
              </div>
            </div>
          </section>

          {/* CALENDAR */}
          <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* DAYS HEADER */}
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/70">
              {[
                "Sun",
                "Mon",
                "Tue",
                "Wed",
                "Thu",
                "Fri",
                "Sat",
              ].map((day) => (
                <div
                  key={day}
                  className="border-r border-slate-100 px-2 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-400 last:border-r-0"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* EMPTY STATE */}
            <div className="flex min-h-[520px] w-full flex-col items-center justify-center px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                <CalendarDays size={28} />
              </div>

              <h2 className="mt-5 text-base font-bold text-[#171B3A]">
                No calendar events
              </h2>

              <p className="mt-2 max-w-md text-sm leading-6 text-[#64748B]">
                Events created through the Add Event page will appear here
                once backend integration is added.
              </p>

              <Link
                href="/admin/calendar/new"
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
              >
                <Plus size={17} />
                Create Event
              </Link>
            </div>
          </section>

          {/* UPCOMING EVENTS */}
          <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                <CalendarDays size={19} />
              </div>

              <div>
                <h2 className="text-base font-bold text-[#171B3A]">
                  Upcoming Events
                </h2>

                <p className="mt-1 text-sm text-[#64748B]">
                  Upcoming events will be loaded from the backend.
                </p>
              </div>
            </div>

            <div className="flex min-h-[180px] items-center justify-center">
              <p className="text-sm text-slate-400">
                No events available
              </p>
            </div>
          </section>

          {/* BACKEND NOTICE */}
          <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300" />

              <div>
                <h2 className="text-sm font-bold text-[#171B3A]">
                  Backend Integration Pending
                </h2>

                <p className="mt-1 text-xs leading-5 text-[#64748B]">
                  This calendar is currently frontend-only. No fake event
                  data, API calls, localStorage, or sessionStorage data
                  are being used.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}