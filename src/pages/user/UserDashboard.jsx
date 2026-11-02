import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  CheckSquare,
  Clock3,
  UserRound,
  ArrowRight,
  CircleAlert,
  ClipboardCheck,
  CalendarDays,
  RefreshCw,
  CheckCircle2,
  LogIn,
  LogOut,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import StatCard from "../../components/common/StatCard";
import api from "../../services/api";

const quickActions = [
  {
    title: "My Attendance",
    description: "Check in, check out, and view attendance history.",
    icon: CalendarCheck,
    path: "/user/attendance",
    color: "violet",
  },
  {
    title: "My Tasks",
    description: "Review assigned tasks and update their status.",
    icon: CheckSquare,
    path: "/user/tasks",
    color: "blue",
  },
  {
    title: "My Profile",
    description: "View and update your profile information.",
    icon: UserRound,
    path: "/user/profile",
    color: "green",
  },
];

const getTime = (value) => {
  if (!value) return "Not recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  return date.toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Karachi",
  });
};

const getStatusLabel = (status) => {
  const labels = {
    pending: "Pending",
    in_progress: "In progress",
    submitted: "Submitted",
    approved: "Approved",
    rejected: "Rejected",
    completed: "Completed",
  };

  return labels[status] || status || "Unknown";
};

const getStatusStyle = (status) => {
  if (["completed", "approved"].includes(status)) {
    return "bg-emerald-50 text-emerald-700 border border-emerald-200/60";
  }

  if (status === "rejected") {
    return "bg-rose-50 text-rose-700 border border-rose-200/60";
  }

  if (status === "in_progress") {
    return "bg-blue-50 text-blue-700 border border-blue-200/60";
  }

  if (status === "submitted") {
    return "bg-violet-50 text-violet-700 border border-violet-200/60";
  }

  return "bg-amber-50 text-amber-700 border border-amber-200/60";
};

export default function UserDashboard() {
  const navigate = useNavigate();

  const [attendance, setAttendance] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const today = new Intl.DateTimeFormat("en-PK", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Karachi",
  }).format(new Date());

  const loadDashboard = async () => {
    setLoading(true);
    setError("");

    try {
      const [attendanceResult, tasksResult] = await Promise.allSettled([
        api.get("/attendance/today"),
        api.get("/tasks"),
      ]);

      if (attendanceResult.status === "fulfilled") {
        const response = attendanceResult.value.data;
        const records = response?.attendance || [];
        setAttendance(records[0] || null);
      } else {
        setAttendance(null);
      }

      if (tasksResult.status === "fulfilled") {
        const response = tasksResult.value.data;
        const records = Array.isArray(response?.tasks)
          ? response.tasks
          : Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response)
              ? response
              : [];

        setTasks(records);
      } else {
        setTasks([]);
      }

      if (
        attendanceResult.status === "rejected" &&
        tasksResult.status === "rejected"
      ) {
        setError("Dashboard data could not be loaded. Please try again.");
      } else if (
        attendanceResult.status === "rejected" ||
        tasksResult.status === "rejected"
      ) {
        setError("Some dashboard information could not be loaded.");
      }
    } catch {
      setError("Dashboard data could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const pendingTasks = tasks.filter((task) =>
    ["pending", "in_progress", "rejected"].includes(
      String(task.status || "").toLowerCase()
    )
  ).length;

  const completedTasks = tasks.filter((task) =>
    ["completed", "approved"].includes(
      String(task.status || "").toLowerCase()
    )
  ).length;

  const statItems = [
    {
      title: "Today's Attendance",
      value: loading ? "…" : attendance ? "Recorded" : "—",
      description: attendance
        ? attendance.checkOut
          ? "Checked out for today"
          : "Checked in; checkout pending"
        : "No attendance record loaded",
      icon: CalendarCheck,
      color: "violet",
      path: "/user/attendance",
    },
    {
      title: "Pending Tasks",
      value: loading ? "…" : pendingTasks,
      description: "Tasks awaiting your action",
      icon: Clock3,
      color: "orange",
      path: "/user/tasks",
    },
    {
      title: "Completed Tasks",
      value: loading ? "…" : completedTasks,
      description: "Completed or approved tasks",
      icon: ClipboardCheck,
      color: "green",
      path: "/user/tasks",
    },
  ];

  const iconColors = {
    violet: "bg-violet-50 text-violet-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header Section matching Ventes clean style */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-3xl p-6 shadow-xs border border-slate-100">
        <div>
          <span className="text-xs font-bold tracking-wider text-violet-600 uppercase">
            My Workspace
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            My Dashboard
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs">
            <CalendarDays size={17} className="text-violet-600" />
            <span>{today}</span>
          </div>

          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50 text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            aria-label="Refresh dashboard"
            title="Refresh dashboard"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm font-medium text-amber-800 shadow-2xs"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={loadDashboard}
            className="font-bold underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Hero Welcome Banner Card (Clean White Container) */}
      <section className="relative overflow-hidden rounded-3xl bg-white border border-slate-100 p-8 shadow-xs">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-violet-50/60 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <span className="text-xs font-bold tracking-wider text-violet-600 uppercase">
            Personal Workspace
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl mt-0.5">
            Welcome to your workspace
          </h2>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed sm:text-base">
            Everything you need for your daily work, from attendance to task updates, is available here.
          </p>

          <div className="mt-6 flex flex-wrap gap-3.5">
            <button
              type="button"
              onClick={() => navigate("/user/attendance")}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-violet-600 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-95"
            >
              <CalendarCheck size={17} />
              My Attendance
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              onClick={() => navigate("/user/tasks")}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-100 active:scale-95"
            >
              <CheckSquare size={17} className="text-slate-500" />
              View My Tasks
            </button>
          </div>
        </div>
      </section>

      {/* My Overview Stat Cards Grid */}
      <section>
        <div className="mb-4 px-1">
          <h2 className="text-lg font-bold text-slate-900">My Overview</h2>
          <p className="text-xs text-slate-400">
            A quick look at your attendance and tasks.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {statItems.map((item) => (
            <StatCard
              key={item.title}
              title={item.title}
              value={item.value}
              description={item.description}
              icon={item.icon}
              color={item.color}
              onClick={() => navigate(item.path)}
            />
          ))}
        </div>
      </section>

      {/* Two-Column Section for Attendance and Tasks */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Today's Attendance Box */}
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <CalendarCheck size={22} />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-slate-900">
                  Today's Attendance
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Your attendance status for today.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="mt-6 rounded-2xl bg-slate-50/50 p-6 text-center text-sm text-slate-400">
                Loading attendance…
              </div>
            ) : attendance ? (
              <div className="mt-6 space-y-3.5">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/40 p-4">
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-600">
                    <LogIn size={17} className="text-emerald-600" />
                    Check-in
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    {getTime(attendance.checkIn)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/40 p-4">
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-600">
                    <LogOut size={17} className="text-violet-600" />
                    Check-out
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    {getTime(attendance.checkOut)}
                  </span>
                </div>

                <p className="flex items-center gap-2 text-xs font-bold text-emerald-700 pt-1">
                  <CheckCircle2 size={16} />
                  {attendance.checkOut
                    ? "Attendance completed for today"
                    : "You are checked in"}
                </p>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6">
                <div className="flex items-start gap-3">
                  <CircleAlert
                    size={19}
                    className="mt-0.5 shrink-0 text-slate-400"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      No attendance record found
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      This does not automatically mean you are absent.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-6">
            <button
              type="button"
              onClick={() => navigate("/user/attendance")}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors"
            >
              Open Attendance <ArrowRight size={15} />
            </button>
          </div>
        </div>

        {/* My Tasks Box */}
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <CheckSquare size={22} />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-900">My Tasks</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Your assigned work and progress
                </p>
              </div>
            </div>

            {loading ? (
              <div className="mt-6 rounded-2xl bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-400">
                Loading tasks…
              </div>
            ) : tasks.length > 0 ? (
              <div className="mt-6 space-y-3.5">
                {tasks.slice(0, 4).map((task, index) => (
                  <div
                    key={task._id || task.id || index}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/40 p-4"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-sm font-bold text-slate-800">
                        {task.title || "Untitled task"}
                      </p>
                      {task.dueDate && (
                        <p className="mt-0.5 text-xs font-medium text-slate-400">
                          Due:{" "}
                          {new Date(task.dueDate).toLocaleDateString("en-PK", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            timeZone: "Asia/Karachi",
                          })}
                        </p>
                      )}
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${getStatusStyle(
                        String(task.status || "").toLowerCase()
                      )}`}
                    >
                      {getStatusLabel(String(task.status || "").toLowerCase())}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
                <ClipboardCheck
                  size={28}
                  className="mx-auto text-slate-300"
                />
                <p className="mt-3 text-sm font-bold text-slate-800">
                  No assigned tasks found
                </p>
                <p className="mt-1 text-xs text-slate-400 max-w-xs mx-auto">
                  Newly assigned tasks will appear here.
                </p>
              </div>
            )}
          </div>

          <div className="pt-6">
            <button
              type="button"
              onClick={() => navigate("/user/tasks")}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors"
            >
              View all tasks <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* Quick Access Section */}
      <section>
        <div className="mb-4 px-1">
          <h2 className="text-lg font-bold text-slate-900">Quick Access</h2>
          <p className="text-xs text-slate-400">
            Go directly to the section you need.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {quickActions.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.title}
                type="button"
                onClick={() => navigate(item.path)}
                className="group flex items-start gap-4 rounded-3xl border border-slate-100 bg-white p-6 text-left shadow-xs transition-all hover:border-violet-200 hover:shadow-md"
              >
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${iconColors[item.color]}`}
                >
                  <Icon size={24} />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-900 group-hover:text-violet-600 transition-colors">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {item.description}
                  </p>
                  <span className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 transition-transform group-hover:translate-x-1">
                    Open section
                    <ArrowRight size={14} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}