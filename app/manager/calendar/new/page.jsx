"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  FileText,
  Save,
  User,
} from "lucide-react";
import { useState } from "react";

export default function ManagerNewEventPage() {
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    startTime: "",
    endTime: "",
    assignedTo: "",
    type: "Meeting",
  });

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setSaved(false);
  }

  function handleSubmit(event) {
    event.preventDefault();

    /*
      FRONTEND ONLY

      No API request.
      No fetch.
      No axios.
      No localStorage.
      No sessionStorage.
      No backend integration.
    */

    setSaved(true);
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#F8FAFC]">
      {/* ========================================
          TOP PAGE BAR
      ======================================== */}

      <header className="sticky top-0 z-30 flex h-16 w-full items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/manager/calendar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-[#26344D] transition hover:bg-slate-50"
            aria-label="Back to calendar"
          >
            <ArrowLeft size={19} />
          </Link>

          <div className="min-w-0">
            <p className="text-xs font-medium text-[#64748B]">
              Management
            </p>

            <p className="text-sm font-bold text-[#171B3A]">
              Add Event
            </p>
          </div>
        </div>
      </header>

      {/* ========================================
          FULL WIDTH PAGE CONTENT
      ======================================== */}

      <main className="min-h-[calc(100vh-4rem)] w-full p-4 sm:p-6 lg:p-8">
        <div className="w-full space-y-6">
          {/* ==================================
              PAGE HEADING
          ================================== */}

          <section className="w-full">
            <p className="text-sm font-semibold text-[#2563EB]">
              MANAGEMENT
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
              Add New Event
            </h1>

            <p className="mt-2 text-sm text-[#64748B]">
              Create a calendar event for your team.
            </p>
          </section>

          {/* ==================================
              SUCCESS MESSAGE
          ================================== */}

          {saved && (
            <div
              role="status"
              className="w-full rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700"
            >
              Event form submitted successfully.
              Backend saving will be connected later.
            </div>
          )}

          {/* ==================================
              FORM
          ================================== */}

          <form
            onSubmit={handleSubmit}
            className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            {/* Form Header */}

            <div className="w-full border-b border-slate-100 px-5 py-5 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                  <CalendarDays size={19} />
                </div>

                <div className="min-w-0">
                  <h2 className="text-base font-bold text-[#171B3A]">
                    Event Information
                  </h2>

                  <p className="mt-1 text-sm text-[#64748B]">
                    Enter the details for the calendar event.
                  </p>
                </div>
              </div>
            </div>

            {/* Form Body */}

            <div className="w-full space-y-6 p-5 sm:p-6 lg:p-8">
              {/* Event Title */}

              <div className="w-full">
                <label
                  htmlFor="title"
                  className="mb-2 block text-sm font-semibold text-[#26344D]"
                >
                  Event Title
                </label>

                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  value={form.title}
                  onChange={handleChange}
                  placeholder="e.g. Team Meeting"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              {/* Description */}

              <div className="w-full">
                <label
                  htmlFor="description"
                  className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]"
                >
                  <FileText size={16} />

                  Description
                </label>

                <textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  maxLength={500}
                  rows={5}
                  placeholder="Add event details or instructions..."
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                />

                <p className="mt-1 text-right text-xs text-slate-400">
                  {form.description.length}/500
                </p>
              </div>

              {/* Event Type */}

              <div className="w-full">
                <label
                  htmlFor="type"
                  className="mb-2 block text-sm font-semibold text-[#26344D]"
                >
                  Event Type
                </label>

                <select
                  id="type"
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="Meeting">Meeting</option>
                  <option value="Deadline">Deadline</option>
                  <option value="Review">Review</option>
                  <option value="Call">Call</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Date */}

              <div className="w-full">
                <label
                  htmlFor="date"
                  className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]"
                >
                  <CalendarDays size={16} />

                  Date
                </label>

                <input
                  id="date"
                  name="date"
                  type="date"
                  required
                  value={form.date}
                  onChange={handleChange}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              {/* Time */}

              <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="w-full">
                  <label
                    htmlFor="startTime"
                    className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]"
                  >
                    <Clock size={16} />

                    Start Time
                  </label>

                  <input
                    id="startTime"
                    name="startTime"
                    type="time"
                    required
                    value={form.startTime}
                    onChange={handleChange}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>

                <div className="w-full">
                  <label
                    htmlFor="endTime"
                    className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]"
                  >
                    <Clock size={16} />

                    End Time
                  </label>

                  <input
                    id="endTime"
                    name="endTime"
                    type="time"
                    required
                    value={form.endTime}
                    onChange={handleChange}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              {/* Assigned To */}

              <div className="w-full">
                <label
                  htmlFor="assignedTo"
                  className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]"
                >
                  <User size={16} />

                  Assigned To
                </label>

                <select
                  id="assignedTo"
                  name="assignedTo"
                  value={form.assignedTo}
                  onChange={handleChange}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="">
                    Select a team member
                  </option>
                </select>

                <p className="mt-2 text-xs text-[#64748B]">
                  Team members will be loaded from the backend
                  after integration.
                </p>
              </div>

              {/* Preview */}

              <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
                  <PreviewItem
                    label="Event Type"
                    value={form.type}
                  />

                  <PreviewItem
                    label="Date"
                    value={form.date || "Not selected"}
                  />

                  <PreviewItem
                    label="Assigned To"
                    value={form.assignedTo || "Not assigned"}
                  />
                </div>
              </div>

              {/* Actions */}

              <div className="flex w-full flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
                <Link
                  href="/manager/calendar"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-semibold text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D]"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#1D4ED8]"
                >
                  <Save size={17} />

                  Save Event
                </button>
              </div>
            </div>
          </form>

          {/* ==================================
              BACKEND NOTICE
          ================================== */}

          <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex w-full items-start gap-3">
              <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300" />

              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[#171B3A]">
                  Backend Integration Pending
                </h2>

                <p className="mt-1 text-xs leading-5 text-[#64748B]">
                  This page is currently frontend-only. No event
                  data is being sent to an API and no browser
                  storage is being used. Events and team members
                  will be loaded from the backend after integration.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/* =========================================
   PREVIEW ITEM
========================================= */

function PreviewItem({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 truncate text-sm font-semibold text-[#26344D]">
        {value}
      </p>
    </div>
  );
}