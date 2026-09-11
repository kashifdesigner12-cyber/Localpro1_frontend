"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Loader2,
  Users,
} from "lucide-react";

import { authService } from "@/services/authService";
import { dashboardService } from "@/services/dashboardService";

// Global persistent cache so data loads only once per session and doesn't re-fetch on tab switches
let managerDashboardCache = {
  stats: null,
  activity: {
    tasks: [],
    leaveRequests: [],
    events: [],
  },
  manager: null,
  loaded: false,
};

export default function ManagerDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(!managerDashboardCache.loaded);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(managerDashboardCache.stats);

  const [activity, setActivity] = useState(managerDashboardCache.activity);
  const [manager, setManager] = useState(managerDashboardCache.manager);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      // If data is already cached globally, skip network re-fetch completely
      if (managerDashboardCache.loaded) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const meResponse = await authService.me();

        if (!mounted) return;

        if (!meResponse) {
          router.replace("/login");
          return;
        }

        const authenticatedUser =
          meResponse?.user ||
          meResponse?.data?.user ||
          meResponse?.data ||
          meResponse ||
          null;

        if (!authenticatedUser) {
          router.replace("/login");
          return;
        }

        setManager(authenticatedUser);

        const [
          statsResponse,
          activityResponse,
        ] = await Promise.all([
          dashboardService.getStats(),
          dashboardService.getActivity(),
        ]);

        if (!mounted) return;

        const resolvedStats =
          statsResponse?.stats ||
          statsResponse?.data?.stats ||
          statsResponse?.data ||
          null;

        const resolvedActivity =
          activityResponse?.recentActivity ||
          activityResponse?.data?.recentActivity ||
          activityResponse?.data ||
          {
            tasks: [],
            leaveRequests: [],
            events: [],
          };

        setStats(resolvedStats);
        setActivity(resolvedActivity);

        // Store into global cache
        managerDashboardCache = {
          stats: resolvedStats,
          activity: resolvedActivity,
          manager: authenticatedUser,
          loaded: true,
        };
      } catch (err) {
        console.error(
          "Manager dashboard error:",
          err
        );

        if (!mounted) return;

        if (
          err?.message === "UNAUTHORIZED"
        ) {
          router.replace("/login");
          return;
        }

        if (
          err?.message === "FORBIDDEN"
        ) {
          setError(
            "You do not have permission to load the manager dashboard."
          );
          return;
        }

        setError(
          err?.message ||
            "Unable to load manager dashboard."
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, [router]);

  const totalTasks =
    stats?.totalTasks ?? null;

  const pendingTasks =
    stats?.pendingTasks ?? null;

  const completedTasks =
    stats?.completedTasks ?? null;

  const teamMembers =
    stats?.totalUsers ?? null;

  const managerName =
    manager?.name ||
    manager?.fullName ||
    manager?.email ||
    "Manager";

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] p-5 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* =====================================================
            PAGE HEADING
        ===================================================== */}

        <section>
          <p className="text-sm font-semibold text-[#2563EB]">
            MANAGER WORKSPACE
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
            Dashboard
          </h1>

          <p className="mt-2 text-sm text-[#64748B]">
            Monitor your team, tasks, and workspace activity.
          </p>
        </section>

        {/* =====================================================
            ERROR
        ===================================================== */}

        {error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>
          </section>
        )}

        {/* =====================================================
            LOADING
        ===================================================== */}

        {loading ? (
          <section className="flex min-h-[500px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col items-center gap-3">

              <Loader2
                size={30}
                className="animate-spin text-[#2563EB]"
              />

              <p className="text-sm font-medium text-[#64748B]">
                Loading manager dashboard...
              </p>

            </div>
          </section>
        ) : (
          <>
            {/* =================================================
                STATS
            ================================================= */}

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

              <DashboardStat
                label="Total Tasks"
                value={totalTasks}
                icon={ClipboardList}
              />

              <DashboardStat
                label="Pending Tasks"
                value={pendingTasks}
                icon={Clock3}
              />

              <DashboardStat
                label="Completed Tasks"
                value={completedTasks}
                icon={CheckCircle2}
              />

              <DashboardStat
                label="Team Members"
                value={teamMembers}
                icon={Users}
              />

            </section>

            {/* =================================================
                TASKS + TEAM
            ================================================= */}

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">

              {/* Recent Tasks */}

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">

                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">

                  <div>
                    <h2 className="text-base font-bold text-[#171B3A]">
                      Recent Tasks
                    </h2>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Your team&apos;s latest task activity.
                    </p>
                  </div>

                  <Link
                    href="/manager/tasks"
                    className="text-sm font-bold text-[#2563EB] hover:underline"
                  >
                    View All
                  </Link>

                </div>

                {(!activity?.tasks || activity.tasks.length === 0) ? (
                  <EmptyState
                    icon={ClipboardList}
                    title="No task data available"
                    description="There are no recent tasks available from the backend."
                  />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {activity.tasks
                      .slice(0, 5)
                      .map((task) => (
                        <TaskRow
                          key={
                            task._id ||
                            task.id
                          }
                          task={task}
                        />
                      ))}
                  </div>
                )}

              </div>

              {/* Team */}

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">

                  <div>
                    <h2 className="text-base font-bold text-[#171B3A]">
                      Team
                    </h2>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Workspace members.
                    </p>
                  </div>

                  <Link
                    href="/manager/team"
                    className="text-sm font-bold text-[#2563EB] hover:underline"
                  >
                    View
                  </Link>

                </div>

                <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                    <Users size={25} />
                  </div>

                  <h3 className="mt-4 text-sm font-bold text-[#171B3A]">
                    {teamMembers === 0
                      ? "No team members"
                      : teamMembers === null
                      ? "No team data available"
                      : `${teamMembers} team members`}
                  </h3>

                  <p className="mt-2 max-w-xs text-sm leading-6 text-[#64748B]">
                    Team member details will be available on the Team page.
                  </p>

                </div>

              </div>

            </section>

            {/* =================================================
                ACTIVITY + CALENDAR
            ================================================= */}

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">

              {/* Recent Activity */}

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">

                  <div>
                    <h2 className="text-base font-bold text-[#171B3A]">
                      Recent Activity
                    </h2>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Latest workspace activity.
                    </p>
                  </div>

                  <Link
                    href="/manager/activity"
                    className="text-sm font-bold text-[#2563EB] hover:underline"
                  >
                    View All
                  </Link>

                </div>

                {(!activity?.tasks || activity.tasks.length === 0) &&
                (!activity?.leaveRequests || activity.leaveRequests.length === 0) &&
                (!activity?.events || activity.events.length === 0) ? (
                  <EmptyState
                    icon={Activity}
                    title="No activity available"
                    description="There is no recent workspace activity available."
                    minHeight="220px"
                  />
                ) : (
                  <div className="divide-y divide-slate-100">

                    {Array.isArray(activity?.tasks) && activity.tasks
                      .slice(0, 3)
                      .map((task) => (
                        <ActivityRow
                          key={`task-${
                            task._id ||
                            task.id
                          }`}
                          title={
                            task.title ||
                            "Task updated"
                          }
                          description={`Task status: ${
                            task.status ||
                            "Unknown"
                          }`}
                          date={task.createdAt}
                        />
                      ))}

                    {Array.isArray(activity?.leaveRequests) && activity.leaveRequests
                      .slice(0, 2)
                      .map((leave) => (
                        <ActivityRow
                          key={`leave-${
                            leave._id ||
                            leave.id
                          }`}
                          title="Leave request"
                          description={`Status: ${
                            leave.status ||
                            "Pending"
                          }`}
                          date={leave.createdAt}
                        />
                      ))}

                    {Array.isArray(activity?.events) && activity.events
                      .slice(0, 2)
                      .map((event) => (
                        <ActivityRow
                          key={`event-${
                            event._id ||
                            event.id
                          }`}
                          title={
                            event.title ||
                            event.name ||
                            "Calendar event"
                          }
                          description="Workspace event"
                          date={event.createdAt}
                        />
                      ))}

                  </div>
                )}

              </div>

              {/* Upcoming Calendar */}

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">

                  <div>
                    <h2 className="text-base font-bold text-[#171B3A]">
                      Upcoming Calendar
                    </h2>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Upcoming workspace events.
                    </p>
                  </div>

                  <Link
                    href="/manager/calendar"
                    className="text-sm font-bold text-[#2563EB] hover:underline"
                  >
                    Calendar
                  </Link>

                </div>

                {(!activity?.events || activity.events.length === 0) ? (
                  <EmptyState
                    icon={CalendarDays}
                    title="No events available"
                    description="There are no recent event records available from the backend."
                    minHeight="220px"
                  />
                ) : (
                  <div className="divide-y divide-slate-100">

                    {Array.isArray(activity?.events) && activity.events
                      .slice(0, 5)
                      .map((event) => (
                        <EventRow
                          key={
                            event._id ||
                            event.id
                          }
                          event={event}
                        />
                      ))}

                  </div>
                )}

              </div>

            </section>
          </>
        )}

      </div>
    </main>
  );
}

/* =====================================================
   DASHBOARD STAT
===================================================== */

function DashboardStat({
  label,
  value,
  icon: Icon,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <div className="flex items-start justify-between">

        <div>
          <p className="text-sm font-medium text-[#64748B]">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold text-[#171B3A]">
            {value ?? "—"}
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
          <Icon size={20} />
        </div>

      </div>

      <p className="mt-3 text-xs text-slate-400">
        Live backend data
      </p>

    </div>
  );
}

/* =====================================================
   TASK ROW
===================================================== */

function TaskRow({ task }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">

      <div className="min-w-0">

        <p className="truncate text-sm font-semibold text-[#171B3A]">
          {task.title || "Untitled Task"}
        </p>

        <p className="mt-1 text-xs text-[#64748B]">
          Assigned to:{" "}
          {task.assignedTo?.name ||
            task.assignedTo?.email ||
            "Unknown"}
        </p>

      </div>

      <div className="shrink-0 text-right">

        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
          {task.status || "Unknown"}
        </span>

        <p className="mt-1 text-[10px] text-slate-400">
          {formatDate(task.createdAt)}
        </p>

      </div>

    </div>
  );
}

/* =====================================================
   ACTIVITY ROW
===================================================== */

function ActivityRow({
  title,
  description,
  date,
}) {
  return (
    <div className="flex gap-3 px-5 py-4 sm:px-6">

      <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#2563EB]" />

      <div className="min-w-0">

        <p className="text-sm font-semibold text-[#171B3A]">
          {title}
        </p>

        <p className="mt-1 text-xs text-[#64748B]">
          {description}
        </p>

        <p className="mt-1 text-[10px] text-slate-400">
          {formatDate(date)}
        </p>

      </div>

    </div>
  );
}

/* =====================================================
   EVENT ROW
===================================================== */

function EventRow({ event }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 sm:px-6">

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EEF4FF] text-[#2563EB]">
        <CalendarDays size={17} />
      </div>

      <div className="min-w-0">

        <p className="truncate text-sm font-semibold text-[#171B3A]">
          {event.title ||
            event.name ||
            "Calendar Event"}
        </p>

        <p className="mt-1 text-xs text-[#64748B]">
          {formatDate(
            event.startDate ||
              event.createdAt
          )}
        </p>

      </div>

    </div>
  );
}

/* =====================================================
   EMPTY STATE
===================================================== */

function EmptyState({
  icon: Icon,
  title,
  description,
  minHeight = "280px",
}) {
  return (
    <div
      className="flex flex-col items-center justify-center px-6 text-center"
      style={{ minHeight }}
    >

      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
        <Icon size={25} />
      </div>

      <h3 className="mt-4 text-sm font-bold text-[#171B3A]">
        {title}
      </h3>

      <p className="mt-2 max-w-sm text-sm leading-6 text-[#64748B]">
        {description}
      </p>

    </div>
  );
}

/* =====================================================
   DATE FORMAT
===================================================== */

function formatDate(date) {
  if (!date) return "No date";

  try {
    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return "No date";
    }

    return parsed.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    );
  } catch {
    return "No date";
  }
}