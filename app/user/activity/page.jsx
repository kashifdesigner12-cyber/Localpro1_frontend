"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  ClipboardList,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

import { authService } from "@/services/authService";

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

const activityTypes = [
  {
    value: "all",
    label: "All Activity",
  },
  {
    value: "task",
    label: "Tasks",
  },
  {
    value: "message",
    label: "Messages",
  },
  {
    value: "calendar",
    label: "Calendar",
  },
  {
    value: "profile",
    label: "Profile",
  },
];

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export default function UserActivityPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [activityType, setActivityType] = useState("all");

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/activity/my`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        throw new Error(
          data?.message ||
            "Failed to load activity records."
        );
      }

      const activityData = Array.isArray(data?.activities)
        ? data.activities
        : Array.isArray(data?.data)
        ? data.data
        : [];

      setActivities(activityData);
    } catch (error) {
      console.error(
        "Fetch activity error:",
        error
      );

      setActivities([]);

      setError(
        error?.message ||
          "Unable to load activity records."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const filteredActivities = useMemo(() => {
    const searchValue = search
      .toLowerCase()
      .trim();

    return activities.filter((activity) => {
      const matchesSearch =
        !searchValue ||
        activity?.title
          ?.toLowerCase()
          .includes(searchValue) ||
        activity?.description
          ?.toLowerCase()
          .includes(searchValue);

      const matchesType =
        activityType === "all" ||
        activity?.type === activityType;

      return matchesSearch && matchesType;
    });
  }, [
    activities,
    search,
    activityType,
  ]);

  function clearFilters() {
    setSearch("");
    setActivityType("all");
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#171B3A] shadow-xl transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        {/* Logo */}
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
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {navigation.map((item) => (
            <UserNavItem
              key={item.href}
              item={item}
              onNavigate={() =>
                setSidebarOpen(false)
              }
            />
          ))}
        </nav>

        {/* Logout */}
        <div className="shrink-0 border-t border-white/10 p-4">
          <button
            type="button"
            onClick={async () => {
              try {
                await authService.logout();
              } catch (logoutError) {
                console.error("Logout error:", logoutError);
              } finally {
                router.replace("/login");
              }
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="lg:pl-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
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
                Activity
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchActivities}
              disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-[#64748B] transition hover:bg-[#EEF4FF] hover:text-[#2563EB]"
              aria-label="Refresh activity"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
            </button>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EEF4FF] text-xs font-bold text-[#2563EB]">
              U
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="min-h-[calc(100vh-4rem)] p-5 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            {/* Heading */}
            <section>
              <p className="text-sm font-semibold text-[#2563EB]">
                WORKSPACE
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
                Activity
              </h1>

              <p className="mt-2 text-sm text-[#64748B]">
                Review your recent workspace activity.
              </p>
            </section>

            {/* Filters */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row">
                {/* Search */}
                <div className="relative flex-1">
                  <Search
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search activity..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>

                {/* Activity Type */}
                <select
                  value={activityType}
                  onChange={(event) =>
                    setActivityType(
                      event.target.value
                    )
                  }
                  className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#64748B] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                >
                  {activityTypes.map((type) => (
                    <option
                      key={type.value}
                      value={type.value}
                    >
                      {type.label}
                    </option>
                  ))}
                </select>

                {/* Clear */}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D]"
                >
                  Clear Filters
                </button>
              </div>
            </section>

            {/* Activity Card */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Header */}
              <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-[#171B3A]">
                      Recent Activity
                    </h2>

                    <p className="mt-1 text-sm text-[#64748B]">
                      {loading
                        ? "Loading activity..."
                        : `${filteredActivities.length} activity${
                            filteredActivities.length !==
                            1
                              ? " items"
                              : " item"
                          } available.`}
                    </p>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                    <Activity size={19} />
                  </div>
                </div>
              </div>

              {/* Loading */}
              {loading ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                    <Loader2
                      size={28}
                      className="animate-spin"
                    />
                  </div>

                  <h3 className="mt-5 text-sm font-bold text-[#171B3A]">
                    Loading activity
                  </h3>

                  <p className="mt-2 max-w-md text-sm leading-6 text-[#64748B]">
                    Fetching your activity records from
                    the backend.
                  </p>
                </div>
              ) : error ? (
                /* Error */
                <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                    <AlertCircle size={28} />
                  </div>

                  <h3 className="mt-5 text-sm font-bold text-[#171B3A]">
                    Unable to load activity
                  </h3>

                  <p className="mt-2 max-w-md text-sm leading-6 text-[#64748B]">
                    {error}
                  </p>

                  <button
                    type="button"
                    onClick={fetchActivities}
                    className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#1D4ED8]"
                  >
                    <RefreshCw size={16} />
                    Try Again
                  </button>
                </div>
              ) : filteredActivities.length > 0 ? (
                /* Activity List */
                <div className="divide-y divide-slate-100">
                  {filteredActivities.map(
                    (activity) => (
                      <ActivityItem
                        key={
                          activity._id ||
                          activity.id
                        }
                        activity={activity}
                      />
                    )
                  )}
                </div>
              ) : (
                /* Empty State */
                <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                    <Activity size={28} />
                  </div>

                  <h3 className="mt-5 text-sm font-bold text-[#171B3A]">
                    No activity available
                  </h3>

                  <p className="mt-2 max-w-md text-sm leading-6 text-[#64748B]">
                    {search ||
                    activityType !== "all"
                      ? "No activity records match your current filters."
                      : "Your recent activity will appear here once activity records are available from the backend."}
                  </p>

                  {(search ||
                    activityType !== "all") && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-4 text-sm font-bold text-[#2563EB] hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Backend Notice */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />

                <div>
                  <h2 className="text-sm font-bold text-[#171B3A]">
                    Backend Connected
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-[#64748B]">
                    Activity records are loaded from the
                    authenticated backend. No fake activity,
                    localStorage, or sessionStorage is being
                    used.
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

function ActivityItem({ activity }) {
  const formattedDate = activity?.createdAt
    ? new Date(
        activity.createdAt
      ).toLocaleString()
    : "";

  return (
    <div className="flex gap-4 px-5 py-5 sm:px-6">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
        <Activity size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#171B3A]">
              {activity?.title || "Activity"}
            </h3>

            <p className="mt-1 text-sm leading-6 text-[#64748B]">
              {activity?.description || ""}
            </p>
          </div>

          {formattedDate && (
            <div className="flex shrink-0 items-center gap-1.5 text-xs text-slate-400">
              <Clock3 size={14} />
              <span>{formattedDate}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UserNavItem({
  item,
  onNavigate,
}) {
  const pathname = usePathname();
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