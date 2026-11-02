import { useEffect, useState } from "react";
import {
  Users,
  CalendarCheck,
  CheckSquare,
  Clock3,
  ArrowRight,
  ClipboardList,
  Activity,
  UserCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../components/layout/PageHeader";
import StatCard from "../../components/common/StatCard";
import api from "../../services/api";

const statConfig = [
  {
    title: "Total Users",
    description: "Team members",
    icon: Users,
    color: "violet",
    path: "/admin/users",
  },
  {
    title: "Present Today",
    description: "Today's attendance",
    icon: UserCheck,
    color: "green",
    path: "/admin/attendance",
  },
  {
    title: "Pending Tasks",
    description: "Tasks awaiting completion",
    icon: Clock3,
    color: "orange",
    path: "/admin/tasks",
  },
  {
    title: "Completed Tasks",
    description: "Tasks marked complete",
    icon: CheckSquare,
    color: "blue",
    path: "/admin/tasks",
  },
];

const quickActions = [
  {
    title: "Manage Users",
    description: "Create and manage team accounts.",
    icon: Users,
    path: "/admin/users",
    color: "violet",
  },
  {
    title: "Manage Attendance",
    description: "Review check-ins and attendance records.",
    icon: CalendarCheck,
    path: "/admin/attendance",
    color: "green",
  },
  {
    title: "Assign Tasks",
    description: "Create tasks and assign team members.",
    icon: ClipboardList,
    path: "/admin/tasks",
    color: "blue",
  },
];

const getList = (response, key) => {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  return [];
};

const getPersonName = (person) => {
  if (!person) return "Unassigned";
  if (typeof person === "string") return person;
  return person.name || person.email || "Unknown";
};

const formatDate = (date) => {
  if (!date) return "Date unavailable";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
};

const statusStyles = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200/50",
  in_progress: "bg-blue-50 text-blue-700 border border-blue-200/50",
  submitted: "bg-violet-50 text-violet-700 border border-violet-200/50",
  approved: "bg-emerald-50 text-emerald-700 border border-emerald-200/50",
  rejected: "bg-rose-50 text-rose-700 border border-rose-200/50",
  completed: "bg-emerald-50 text-emerald-700 border border-emerald-200/50",
};

const formatStatus = (status) =>
  (status || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    users: 0,
    attendance: 0,
    pending: 0,
    completed: 0,
  });
  const [attendance, setAttendance] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const today = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      setLoading(true);
      setError("");

      try {
        // Sequential requests to completely avoid Express session lock & congestion
        let users = [];
        let attendanceRecords = [];
        let taskRecords = [];

        try {
          const usersRes = await api.get("/users");
          users = getList(usersRes, "users");
        } catch {
          // Ignore individual fetch failure to keep dashboard responsive
        }

        if (cancelled) return;

        try {
          const attendanceRes = await api.get("/attendance/today");
          attendanceRecords = getList(attendanceRes, "attendance");
        } catch {
          // Ignore
        }

        if (cancelled) return;

        try {
          const tasksRes = await api.get("/tasks");
          taskRecords = getList(tasksRes, "tasks");
        } catch {
          // Ignore
        }

        if (cancelled) return;

        setStats({
          users: users.length,
          attendance: attendanceRecords.length,
          pending: taskRecords.filter((task) => task.status === "pending").length,
          completed: taskRecords.filter((task) => task.status === "completed").length,
        });

        setAttendance(attendanceRecords);
        setTasks(
          taskRecords
            .slice()
            .sort(
              (a, b) =>
                new Date(b.updatedAt || b.createdAt || 0).getTime() -
                new Date(a.updatedAt || a.createdAt || 0).getTime()
            )
            .slice(0, 5)
        );
      } catch (err) {
        if (!cancelled) {
          setError("Failed to load dashboard data. Please check your connection.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const statItems = statConfig.map((item) => ({
    ...item,
    value: loading
      ? "—"
      : stats[
          {
            "Total Users": "users",
            "Present Today": "attendance",
            "Pending Tasks": "pending",
            "Completed Tasks": "completed",
          }[item.title]
        ] ?? "—",
  }));

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-3xl p-6 shadow-xs border border-slate-100">
        <div>
          <span className="text-xs font-bold tracking-wider text-violet-600 uppercase">
            Admin Workspace
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Overview Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs">
            <CalendarCheck size={17} className="text-violet-600" />
            <span>{today}</span>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm font-medium text-amber-800 shadow-2xs"
        >
          {error}
        </div>
      )}

      {/* Hero Welcome Banner Card */}
      <section className="relative overflow-hidden rounded-3xl bg-white border border-slate-100 p-8 shadow-xs">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-violet-50/60 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Welcome back to LocalPro1
          </h2>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed sm:text-base">
            Monitor real-time team performance, daily attendance records, and active task progress smoothly from one place.
          </p>  

          <div className="mt-6 flex flex-wrap gap-3.5">
            <button
              type="button"
              onClick={() => navigate("/admin/users")}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-violet-600 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-95"
            >
              <Users size={17} />
              Manage Users
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              onClick={() => navigate("/admin/tasks")}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-100 active:scale-95"
            >
              <CheckSquare size={17} className="text-slate-500" />
              View Tasks
            </button>
          </div>
        </div>
      </section>

      {/* Team Overview Stats Grid */}
      <section>
        <div className="mb-4 px-1">
          <h3 className="text-lg font-bold text-slate-900">Team Overview</h3>
          <p className="text-xs text-slate-400">
            Summary metrics updated in real-time
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statItems.map((item) => (
            <div key={item.title} className="w-full">
              <StatCard
                title={item.title}
                value={item.value}
                description={item.description}
                icon={item.icon}
                color={item.color}
                onClick={() => navigate(item.path)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Quick Actions Grid */}
      <section>
        <div className="mb-4 px-1">
          <h3 className="text-lg font-bold text-slate-900">Quick Actions</h3>
          <p className="text-xs text-slate-400">
            Direct shortcuts to core modules
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {quickActions.map((item) => {
            const Icon = item.icon;
            const iconColors = {
              violet: "bg-violet-50 text-violet-600",
              green: "bg-emerald-50 text-emerald-600",
              blue: "bg-blue-50 text-blue-600",
            };

            return (
              <button
                key={item.title}
                type="button"
                onClick={() => navigate(item.path)}
                className="group flex items-start gap-4 rounded-3xl border border-slate-100 bg-white p-6 text-left shadow-xs transition-all hover:border-violet-200 hover:shadow-md"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconColors[item.color]}`}
                >
                  <Icon size={22} />
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-slate-900 group-hover:text-violet-600 transition-colors">
                    {item.title}
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    {item.description}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-violet-600">
                    Open section
                    <ArrowRight
                      size={14}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Two-Column Lists Section */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Today's Attendance Box */}
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs sm:p-7">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CalendarCheck size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Today's Attendance</h3>
                <p className="text-xs text-slate-400">
                  Daily team attendance overview
                </p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-700">
              {attendance.length} Present
            </span>
          </div>

          {loading ? (
            <div className="mt-6 space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-14 w-full animate-pulse rounded-2xl bg-slate-50" />
              ))}
            </div>
          ) : attendance.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
              <UserCheck size={28} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                No attendance records today
              </p>
              <p className="mt-1 text-xs text-slate-400 max-w-xs mx-auto">
                Records will appear here once team members check in.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {attendance.slice(0, 5).map((record, index) => (
                <div
                  key={record._id || record.id || index}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/40 p-3.5 transition-colors hover:bg-slate-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 shadow-2xs">
                      {getPersonName(record.user).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">
                        {getPersonName(record.user)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {record.checkIn
                          ? `Check-in: ${formatDate(record.checkIn)}`
                          : "Attendance recorded"}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    Present
                  </span>
                </div>
              ))}

              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => navigate("/admin/attendance")}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors"
                >
                  View All Attendance <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Recent Task Activity Box */}
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs sm:p-7">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <ClipboardList size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Recent Task Activity</h3>
                <p className="text-xs text-slate-400">
                  Latest updates from your team
                </p>
              </div>
            </div>
            <span className="rounded-full bg-blue-50 px-3.5 py-1 text-xs font-bold text-blue-700">
              {tasks.length} Active
            </span>
          </div>

          {loading ? (
            <div className="mt-6 space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-14 w-full animate-pulse rounded-2xl bg-slate-50" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
              <Activity size={28} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                No tasks to display
              </p>
              <p className="mt-1 text-xs text-slate-400 max-w-xs mx-auto">
                Tasks will appear here once they are created.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {tasks.map((task, index) => (
                <div
                  key={task._id || task.id || index}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/40 p-3.5 transition-colors hover:bg-slate-50"
                >
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-sm font-bold text-slate-800">
                      {task.title || "Untitled task"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {getPersonName(task.assignedTo)} ·{" "}
                      {formatDate(task.updatedAt || task.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                      statusStyles[task.status] || "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {formatStatus(task.status)}
                  </span>
                </div>
              ))}

              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => navigate("/admin/tasks")}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors"
                >
                  Manage Tasks <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}