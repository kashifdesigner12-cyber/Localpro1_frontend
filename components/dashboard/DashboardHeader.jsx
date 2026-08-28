"use client";

import {
  Bell,
  Menu,
  Search,
  UserCircle,
} from "lucide-react";

export default function DashboardHeader({
  title = "Dashboard",
  subtitle = "",
  onMenuClick,
  userName = "User",
  userRole = "User",
}) {
  return (
    <header className="sticky top-0 z-30 h-[82px] border-b border-slate-200 bg-white">
      <div className="flex h-full items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={21} />
          </button>

          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-[#171B3A]">
              {title}
            </h2>

            {subtitle && (
              <p className="hidden truncate text-sm text-[#64748B] sm:block">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            className="hidden h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 sm:flex"
            aria-label="Search"
          >
            <Search size={19} />
          </button>

          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
            aria-label="Notifications"
          >
            <Bell size={19} />

            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#2563EB]" />
          </button>

          <div className="hidden h-8 w-px bg-slate-200 sm:block" />

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