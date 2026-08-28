"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  Users,
  X,
} from "lucide-react";

const defaultItems = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Tasks",
    href: "/tasks",
    icon: CheckSquare,
  },
  {
    label: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
  },
  {
    label: "Messages",
    href: "/messages",
    icon: MessageSquare,
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: Bell,
  },
];

const adminItems = [
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
    icon: CheckSquare,
  },
  {
    label: "Calendar",
    href: "/admin/calendar",
    icon: CalendarDays,
  },
  {
    label: "Messages",
    href: "/admin/messages",
    icon: MessageSquare,
  },
  {
    label: "Notifications",
    href: "/admin/notifications",
    icon: Bell,
  },
];

const managerItems = [
  {
    label: "Dashboard",
    href: "/manager",
    icon: LayoutDashboard,
  },
  {
    label: "Team",
    href: "/manager/team",
    icon: Users,
  },
  {
    label: "Tasks",
    href: "/manager/tasks",
    icon: ClipboardList,
  },
  {
    label: "Calendar",
    href: "/manager/calendar",
    icon: CalendarDays,
  },
  {
    label: "Messages",
    href: "/manager/messages",
    icon: MessageSquare,
  },
  {
    label: "Notifications",
    href: "/manager/notifications",
    icon: Bell,
  },
];

const userItems = [
  {
    label: "Dashboard",
    href: "/user",
    icon: LayoutDashboard,
  },
  {
    label: "My Tasks",
    href: "/user/tasks",
    icon: CheckSquare,
  },
  {
    label: "Calendar",
    href: "/user/calendar",
    icon: CalendarDays,
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
];

export default function Sidebar({
  role = "user",
  collapsed = false,
  mobileOpen = false,
  onToggle,
  onClose,
}) {
  const pathname = usePathname();

  let items = defaultItems;

  if (role === "admin") {
    items = adminItems;
  } else if (role === "manager") {
    items = managerItems;
  } else if (role === "user") {
    items = userItems;
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-50 flex h-screen flex-col
          border-r border-slate-200 bg-white
          transition-all duration-300
          ${collapsed ? "w-[80px]" : "w-[260px]"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div className="flex h-[82px] items-center border-b border-slate-100 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white">
              <LayoutDashboard size={21} />
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold text-[#171B3A]">
                  Local Pro 1
                </h1>

                <p className="truncate text-xs text-[#64748B]">
                  {role === "admin"
                    ? "Admin Panel"
                    : role === "manager"
                      ? "Manager Panel"
                      : "Workspace"}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Close menu"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p
            className={`mb-3 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 ${
              collapsed ? "hidden" : ""
            }`}
          >
            Menu
          </p>

          <div className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon;

              const active =
                pathname === item.href ||
                (item.href !== "/admin" &&
                  item.href !== "/manager" &&
                  item.href !== "/user" &&
                  pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  className={`
                    flex h-11 items-center gap-3 rounded-xl px-3
                    text-sm font-medium transition
                    ${
                      active
                        ? "bg-[#EEF4FF] text-[#2563EB]"
                        : "text-[#64748B] hover:bg-slate-50 hover:text-[#26344D]"
                    }
                    ${collapsed ? "justify-center" : ""}
                  `}
                >
                  <Icon size={19} />

                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom */}
        <div className="border-t border-slate-100 p-3">
          <Link
            href="/settings"
            className={`
              flex h-11 items-center gap-3 rounded-xl px-3
              text-sm font-medium text-[#64748B]
              transition hover:bg-slate-50 hover:text-[#26344D]
              ${collapsed ? "justify-center" : ""}
            `}
          >
            <Settings size={19} />

            {!collapsed && <span>Settings</span>}
          </Link>

          <button
            type="button"
            className={`
              mt-1 flex h-11 w-full items-center gap-3 rounded-xl px-3
              text-sm font-medium text-slate-500
              transition hover:bg-red-50 hover:text-red-600
              ${collapsed ? "justify-center" : ""}
            `}
          >
            <LogOut size={19} />

            {!collapsed && <span>Logout</span>}
          </button>

          <button
            type="button"
            onClick={onToggle}
            className="mt-2 hidden h-9 w-full items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 lg:flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight size={18} />
            ) : (
              <ChevronLeft size={18} />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}