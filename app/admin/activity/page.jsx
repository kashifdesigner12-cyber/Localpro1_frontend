"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";

const navigation = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: Users,
  },
  {
    label: "Tasks",
    href: "/admin/tasks",
    icon: ClipboardList,
  },
  {
    label: "Leave Requests",
    href: "/admin/leave-requests",
    icon: ClipboardCheck,
  },
  {
    label: "Conversations",
    href: "/admin/conversations",
    icon: MessageSquare,
  },
  {
    label: "Calendar",
    href: "/admin/calendar",
    icon: CalendarDays,
  },
  {
    label: "Activity",
    href: "/admin/activity",
    icon: Activity,
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

export default function AdminActivityPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [activityType, setActivityType] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC]">
      {/* =========================================
          MOBILE OVERLAY
      ========================================= */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* =========================================
          SIDEBAR
      ========================================= */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#171B3A] shadow-xl transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
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
                Admin Workspace
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition hover:bg-white/10 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-300">
            Administration
          </p>

          <div className="space-y-1.5">
            {navigation.map((item) => (
              <AdminNavItem
                key={item.href}
                item={item}
                onNavigate={() => setSidebarOpen(false)}
              />
            ))}
          </div>
        </nav>

        {/* User Area */}
        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-xl px-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-xs font-bold text-white">
              A
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                Administrator
              </p>

              <p className="truncate text-xs font-medium text-slate-300">
                Admin Account
              </p>
            </div>
          </div>

          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <LogOut size={17} className="text-white" />

            <span className="text-white">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* =========================================
          FULL SCREEN MAIN AREA
          HEADER REMOVED
      ========================================= */}
      <main className="min-h-screen w-full p-5 sm:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-7xl space-y-6">
          {/* =========================================
              MOBILE MENU
          ========================================= */}
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#26344D] shadow-sm transition hover:bg-slate-50"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
          </div>

          {/* =========================================
              PAGE HEADER
          ========================================= */}
          <section>
            <p className="text-sm font-semibold text-[#2563EB]">
              ADMINISTRATION
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
              Activity
            </h1>

            <p className="mt-2 text-sm text-[#64748B]">
              Monitor activity and events across your workspace.
            </p>
          </section>

          {/* =========================================
              FILTERS
          ========================================= */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              {/* Search */}
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search activity..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              {/* Activity Type */}
              <select
                value={activityType}
                onChange={(event) =>
                  setActivityType(event.target.value)
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#64748B] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 lg:w-48"
                aria-label="Activity type"
              >
                <option value="all">All Activity</option>
                <option value="users">Users</option>
                <option value="tasks">Tasks</option>
                <option value="leave">Leave Requests</option>
                <option value="calendar">Calendar</option>
                <option value="conversations">
                  Conversations
                </option>
                <option value="system">System</option>
              </select>

              {/* Date Range */}
              <select
                value={dateRange}
                onChange={(event) =>
                  setDateRange(event.target.value)
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#64748B] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 lg:w-40"
                aria-label="Date range"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>

              {/* Filters Button */}
              <button
                type="button"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D] lg:w-auto"
              >
                <SlidersHorizontal size={17} />
                Filters
              </button>
            </div>
          </section>

          {/* =========================================
              ACTIVITY PANEL
          ========================================= */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Panel Header */}
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                  <Activity size={19} />
                </div>

                <div>
                  <h2 className="text-base font-bold text-[#171B3A]">
                    Workspace Activity
                  </h2>

                  <p className="mt-1 text-sm text-[#64748B]">
                    Activity records will be loaded from the backend.
                  </p>
                </div>
              </div>
            </div>

            {/* Empty State */}
            <div className="flex min-h-[430px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                <Activity size={28} />
              </div>

              <h3 className="mt-5 text-base font-bold text-[#171B3A]">
                No activity available
              </h3>

              <p className="mt-2 max-w-md text-sm leading-6 text-[#64748B]">
                Workspace activity records will appear here after
                the backend is connected.
              </p>
            </div>
          </section>

          {/* =========================================
              ACTIVITY STATUS
          ========================================= */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-[#171B3A]">
                  Activity Status
                </h2>

                <p className="mt-1 text-sm text-[#64748B]">
                  Activity information will be loaded from the backend.
                </p>
              </div>

              <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-100 px-4 py-2">
                <span className="h-2 w-2 rounded-full bg-slate-300" />

                <span className="text-xs font-medium text-[#64748B]">
                  Waiting for connection
                </span>
              </div>
            </div>
          </section>

          {/* =========================================
              BACKEND NOTICE
          ========================================= */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300" />

              <div>
                <h2 className="text-sm font-bold text-[#171B3A]">
                  Backend Integration Pending
                </h2>

                <p className="mt-1 text-xs leading-5 text-[#64748B]">
                  This page is currently frontend-only. No fake
                  activity data, API requests, localStorage, or
                  sessionStorage are being used. Backend
                  integration will be connected later.
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
   ADMIN SIDEBAR NAV ITEM
========================================= */

function AdminNavItem({ item, onNavigate }) {
  const pathname = usePathname();
  const Icon = item.icon;

  const isActive =
    pathname === item.href ||
    (item.href !== "/admin" &&
      pathname.startsWith(`${item.href}/`));

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
        isActive
          ? "bg-[#2563EB] text-white shadow-sm"
          : "text-white hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon
        size={18}
        strokeWidth={2}
        className="shrink-0 text-white"
      />

      <span className="text-white">{item.label}</span>
    </Link>
  );
}