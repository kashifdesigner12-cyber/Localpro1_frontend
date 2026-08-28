"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  FileText,
  MapPin,
  Save,
  User,
} from "lucide-react";

export default function AdminNewCalendarEventPage() {
  const [form, setForm] = useState({
    title: "",
    date: "",
    startTime: "",
    endTime: "",
    location: "",
    description: "",
    attendee: "",
    type: "Meeting",
  });

  const [saved, setSaved] = useState(false);

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

      No localStorage.
      No sessionStorage.
      No API call.
      No backend integration.

      Backend integration will be added later.
    */

    setSaved(true);
  }

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC]">
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
                  Add Calendar Event
                </h1>

                <p className="mt-2 text-sm text-[#64748B]">
                  Create a new workspace event or appointment.
                </p>
              </div>

              <Link
                href="/admin/calendar"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#26344D] shadow-sm transition hover:bg-slate-50"
              >
                <ArrowLeft size={17} />
                Back to Calendar
              </Link>
            </div>
          </section>

          {/* SUCCESS MESSAGE */}
          {saved && (
            <section className="w-full rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
              Event form submitted successfully. Backend saving will be
              connected later.
            </section>
          )}

          {/* EVENT FORM */}
          <form
            onSubmit={handleSubmit}
            className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            {/* FORM HEADER */}
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                  <CalendarDays size={19} />
                </div>

                <div>
                  <h2 className="text-base font-bold text-[#171B3A]">
                    Event Information
                  </h2>

                  <p className="mt-1 text-sm text-[#64748B]">
                    Enter the details for this calendar event.
                  </p>
                </div>
              </div>
            </div>

            {/* FORM BODY */}
            <div className="space-y-6 p-5 sm:p-6 lg:p-8">
              {/* TITLE */}
              <div>
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
                  placeholder="e.g. Client Meeting"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              {/* EVENT TYPE */}
              <div>
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
                  <option value="Appointment">Appointment</option>
                  <option value="Call">Call</option>
                  <option value="Task">Task</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* DATE */}
              <div>
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

              {/* TIME */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="startTime"
                    className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]"
                  >
                    <Clock3 size={16} />
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

                <div>
                  <label
                    htmlFor="endTime"
                    className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]"
                  >
                    <Clock3 size={16} />
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

              {/* LOCATION */}
              <div>
                <label
                  htmlFor="location"
                  className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]"
                >
                  <MapPin size={16} />
                  Location
                </label>

                <input
                  id="location"
                  name="location"
                  type="text"
                  value={form.location}
                  onChange={handleChange}
                  placeholder="Enter event location"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              {/* ATTENDEE */}
              <div>
                <label
                  htmlFor="attendee"
                  className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]"
                >
                  <User size={16} />
                  Attendee
                </label>

                <input
                  id="attendee"
                  name="attendee"
                  type="text"
                  value={form.attendee}
                  onChange={handleChange}
                  placeholder="Enter attendee name or email"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              {/* DESCRIPTION */}
              <div>
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
                  rows={5}
                  placeholder="Add notes or additional information..."
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              {/* ACTIONS */}
              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
                <Link
                  href="/admin/calendar"
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

          {/* BACKEND NOTICE */}
          <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300" />

              <div>
                <h2 className="text-sm font-bold text-[#171B3A]">
                  Backend Integration Pending
                </h2>

                <p className="mt-1 text-xs leading-5 text-[#64748B]">
                  This page is currently frontend-only. Event data is not
                  stored in localStorage or sessionStorage, and no API
                  request is being made. Backend database integration will
                  be added later.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}