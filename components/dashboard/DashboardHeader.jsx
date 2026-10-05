"use client";

import {
  Bell,
  Menu,
  Search,
  UserCircle,
} from "lucide-react";
import { usePathname } from "next/navigation";

const PAGE_TITLES = {
  "/admin": "Dashboard",
  "/admin/users": "Users",
  "/admin/tasks": "Tasks",
  "/admin/attendance": "Attendance",
  "/admin/leave-requests": "Leave Requests",
  "/admin/conversations": "Conversations",
  "/admin/settings": "Settings",
};

function getPageTitle(pathname) {
  if (!pathname) return "Dashboard";

  // Exact page match first
  if (PAGE_TITLES[pathname]) {
    return PAGE_TITLES[pathname];
  }

  // Handle nested pages
  if (pathname.startsWith("/admin/users/")) {
    return "Users";
  }

  if (pathname.startsWith("/admin/tasks/")) {
    return "Tasks";
  }

  if (pathname.startsWith("/admin/attendance/")) {
    return "Attendance";
  }

  if (pathname.startsWith("/admin/leave-requests/")) {
    return "Leave Requests";
  }

  if (pathname.startsWith("/admin/conversations/")) {
    return "Conversations";
  }

  if (pathname.startsWith("/admin/settings/")) {
    return "Settings";
  }

  return "Dashboard";
}

export default function DashboardHeader({
  title = "",
  subtitle = "",
  onMenuClick,
  userName = "User",
  userRole = "User",
}) {
  const pathname = usePathname();

  const currentPageTitle = title || getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-30 h-[82px] border-b border-slate-200 bg-white">
      <div className="flex h-full items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
        {/* LEFT SIDE */}
        <div className="flex min-w-0 items-center gap-3">
          {/* Mobile Menu */}
          <button
            type="button"
            onClick={onMenuClick}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={21} />
          </button>

          {/* PAGE TITLE */}
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-[#171B3A]">
              {currentPageTitle}
            </h2>

            {subtitle && (
              <p className="hidden truncate text-sm text-[#64748B] sm:block">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Search */}
          <button
            type="button"
            className="hidden h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 sm:flex"
            aria-label="Search"
          >
            <Search size={19} />
          </button>

          {/* Notifications */}
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100"
            aria-label="Notifications"
          >
            <Bell size={19} />

            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#2563EB]" />
          </button>

          {/* Divider */}
          <div className="hidden h-8 w-px bg-slate-200 sm:block" />

          {/* User */}
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF4FF] text-[#2563EB]">
              <UserCircle size={22} />
            </div>

            <div className="hidden min-w-0 md:block">
              <p className="max-w-[140px] truncate text-sm font-semibold text-[#26344D]">
                {userName}
              </p>

              <p className="text-xs capitalize text-[#64748B]">
                {userRole}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
