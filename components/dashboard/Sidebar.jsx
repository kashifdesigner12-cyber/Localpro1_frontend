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
  ShieldCheck,
} from "lucide-react";

const defaultItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Messages", href: "/messages", icon: MessageSquare },
  { label: "Notifications", href: "/notifications", icon: Bell },
];

const adminItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Tasks", href: "/admin/tasks", icon: CheckSquare },
  { label: "Calendar", href: "/admin/calendar", icon: CalendarDays },
  { label: "Messages", href: "/admin/messages", icon: MessageSquare },
  { label: "Notifications", href: "/admin/notifications", icon: Bell },
];

const managerItems = [
  { label: "Dashboard", href: "/manager", icon: LayoutDashboard },
  { label: "Team", href: "/manager/team", icon: Users },
  { label: "Tasks", href: "/manager/tasks", icon: ClipboardList },
  { label: "Calendar", href: "/manager/calendar", icon: CalendarDays },
  { label: "Messages", href: "/manager/messages", icon: MessageSquare },
  { label: "Notifications", href: "/manager/notifications", icon: Bell },
];

const userItems = [
  { label: "Dashboard", href: "/user", icon: LayoutDashboard },
  { label: "My Tasks", href: "/user/tasks", icon: CheckSquare },
  { label: "Calendar", href: "/user/calendar", icon: CalendarDays },
  { label: "Messages", href: "/user/messages", icon: MessageSquare },
  { label: "Notifications", href: "/user/notifications", icon: Bell },
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
  if (role === "admin") items = adminItems;
  else if (role === "manager") items = managerItems;
  else if (role === "user") items = userItems;

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden transition-opacity duration-300"
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-50 flex h-screen flex-col
          border-r border-white/10 bg-[#171B3A] text-white
          transition-all duration-300 ease-in-out shadow-[4px_0_35px_rgba(23,27,58,0.25)]
          ${collapsed ? "w-[80px]" : "w-[260px]"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Ambient background glow inside sidebar */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
          <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="absolute -right-16 bottom-0 h-48 w-48 rounded-full bg-pink-500/20 blur-3xl" />
        </div>

        {/* Logo / Header */}
        <div className="relative z-10 flex h-[82px] items-center border-b border-white/10 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-purple-950/30">
              <ShieldCheck size={21} />
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <h1 className="truncate text-base font-extrabold tracking-tight text-white">
                  Local Pro 1
                </h1>
                <p className="truncate text-xs font-semibold text-violet-400">
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
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="relative z-10 flex-1 overflow-y-auto px-3 py-5">
          <p
            className={`mb-3 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 ${
              collapsed ? "hidden" : ""
            }`}
          >
            Menu
          </p>

          <div className="space-y-1.5">
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
                    group relative flex h-11 items-center gap-3 rounded-2xl px-3
                    text-sm font-bold transition duration-200
                    ${
                      active
                        ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-purple-950/30"
                        : "text-slate-300 hover:bg-white/[0.08] hover:text-white"
                    }
                    ${collapsed ? "justify-center" : ""}
                  `}
                >
                  <Icon
                    size={19}
                    className={`transition duration-200 ${
                      active ? "text-white" : "text-slate-400 group-hover:text-white"
                    }`}
                  />

                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom Panel */}
        <div className="relative z-10 border-t border-white/10 p-3 space-y-1.5 bg-[#12152d]/60">
          <Link
            href="/settings"
            className={`
              flex h-11 items-center gap-3 rounded-2xl px-3
              text-sm font-bold text-slate-300
              transition duration-200 hover:bg-white/[0.08] hover:text-white
              ${collapsed ? "justify-center" : ""}
            `}
          >
            <Settings size={19} className="text-slate-400" />
            {!collapsed && <span>Settings</span>}
          </Link>

          <button
            type="button"
            className={`
              flex h-11 w-full items-center gap-3 rounded-2xl px-3
              text-sm font-bold text-rose-400
              transition duration-200 hover:bg-rose-500/10 hover:text-rose-300
              ${collapsed ? "justify-center" : ""}
            `}
          >
            <LogOut size={19} className="text-rose-400" />
            {!collapsed && <span>Logout</span>}
          </button>

          <button
            type="button"
            onClick={onToggle}
            className="mt-1 hidden h-10 w-full items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white lg:flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight size={18} />
            ) : (
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <ChevronLeft size={18} />
                <span>Collapse</span>
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}