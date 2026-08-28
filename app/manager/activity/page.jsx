"use client";

import {
  Activity as ActivityIcon,
  CheckCircle2,
  Clock3,
  UserPlus,
} from "lucide-react";

export default function ManagerActivityPage() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#F8FAFC]">
      {/* ========================================
          FULL SCREEN PAGE
      ======================================== */}

      <main className="min-h-screen w-full p-4 sm:p-6 lg:p-8">
        <div className="w-full space-y-6">
          {/* ==================================
              PAGE HEADING
          ================================== */}

          <section className="w-full">
            <p className="text-sm font-semibold text-[#2563EB]">
              MANAGEMENT
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
              Activity
            </h1>

            <p className="mt-2 text-sm text-[#64748B]">
              Monitor recent activity across your team and
              workspace.
            </p>
          </section>

          {/* ==================================
              RECENT ACTIVITY
          ================================== */}

          <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Card Header */}

            <div className="flex w-full flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:px-6 lg:px-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                  <ActivityIcon size={19} />
                </div>

                <div className="min-w-0">
                  <h2 className="text-base font-bold text-[#171B3A]">
                    Recent Activity
                  </h2>

                  <p className="mt-1 text-sm text-[#64748B]">
                    Workspace activity will appear here.
                  </p>
                </div>
              </div>

              {/* Filter */}

              <select
                defaultValue="all"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#64748B] outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 sm:w-auto"
              >
                <option value="all">
                  All Activity
                </option>

                <option value="tasks">
                  Tasks
                </option>

                <option value="team">
                  Team
                </option>

                <option value="calendar">
                  Calendar
                </option>
              </select>
            </div>

            {/* Empty State */}

            <div className="flex min-h-[420px] w-full flex-col items-center justify-center px-6 py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                <ActivityIcon size={28} />
              </div>

              <h3 className="mt-5 text-base font-bold text-[#171B3A]">
                No activity available
              </h3>

              <p className="mt-2 max-w-md text-sm leading-6 text-[#64748B]">
                Recent team actions, task updates, assignments,
                and calendar changes will appear here after the
                backend is connected.
              </p>
            </div>
          </section>

          {/* ==================================
              ACTIVITY TYPES
          ================================== */}

          <section className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ActivityTypeCard
              icon={CheckCircle2}
              title="Task Updates"
              description="Task status and completion activity will be displayed here."
            />

            <ActivityTypeCard
              icon={UserPlus}
              title="Team Activity"
              description="Team member assignments and changes will appear here."
            />

            <ActivityTypeCard
              icon={Clock3}
              title="Recent Actions"
              description="Recent workspace actions will be loaded from the backend."
            />
          </section>

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
                  This page is currently frontend-only. No fake
                  activity data is displayed and nothing is stored
                  in localStorage or sessionStorage. Activity
                  records will be fetched from the backend after
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

/* =========================================
   ACTIVITY TYPE CARD
========================================= */

function ActivityTypeCard({
  icon: Icon,
  title,
  description,
}) {
  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
        <Icon size={19} />
      </div>

      <h3 className="mt-4 text-sm font-bold text-[#171B3A]">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-5 text-[#64748B]">
        {description}
      </p>
    </div>
  );
}