import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  CheckSquare,
  Users,
  CalendarCheck,
  Settings,
  ClipboardList,
  UserRound,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  X,
  CalendarRange,
} from "lucide-react";

const adminLinks = [
  {
    label: "Dashboard",
    path: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Chat",
    path: "/admin/chat",
    icon: MessageSquare,
  },
  {
    label: "Tasks",
    path: "/admin/tasks",
    icon: CheckSquare,
  },
  {
    label: "Users",
    path: "/admin/users",
    icon: Users,
  },
  {
    label: "Attendance",
    path: "/admin/attendance",
    icon: CalendarCheck,
  },
  {
    label: "Leaves",
    path: "/admin/leaves",
    icon: CalendarRange,
  },
  {
    label: "Attendance Reports",
    path: "/admin/attendance-reports",
    icon: ClipboardList,
  },
  {
    label: "Profile",
    path: "/admin/profile",
    icon: UserRound,
  },
  {
    label: "Settings",
    path: "/admin/settings",
    icon: Settings,
  },
];

const userLinks = [
  {
    label: "Dashboard",
    path: "/user/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Chat",
    path: "/user/chat",
    icon: MessageSquare,
  },
  {
    label: "My Tasks",
    path: "/user/tasks",
    icon: CheckSquare,
  },
  {
    label: "My Attendance",
    path: "/user/attendance",
    icon: CalendarCheck,
  },
  {
    label: "My Leaves",
    path: "/user/leaves",
    icon: CalendarRange,
  },
  {
    label: "My Profile",
    path: "/user/profile",
    icon: UserRound,
  },
  {
    label: "Settings",
    path: "/user/settings",
    icon: Settings,
  },
];

export default function Sidebar({
  role = "admin",
  collapsed = false,
  onToggle,
  mobileOpen = false,
  onClose,
}) {
  const isAdmin = ["admin", "manager"].includes(role);
  const links = isAdmin ? adminLinks : userLinks;

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs transition-opacity lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-800 bg-slate-900 text-slate-200 shadow-2xl transition-all duration-300 ease-in-out lg:translate-x-0 ${
          collapsed ? "w-[88px]" : "w-[270px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Sidebar Brand Header */}
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-slate-800/80 px-6">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-950/50 ring-1 ring-violet-400/30">
              <ShieldCheck size={24} strokeWidth={2.2} />
            </div>

            {!collapsed && (
              <div className="min-w-0 transition-all animate-fadeIn">
                <h1 className="truncate text-base font-extrabold tracking-tight text-white">
                  LocalPro1
                </h1>
                <p className="text-[11px] font-semibold text-violet-400">
                  Workspace Portal
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {!collapsed && (
          <div className="px-6 pb-2 pt-6">
            <p className="text-[10px] font-extrabold uppercase tracking-[2px] text-slate-500">
              Workspace Menu
            </p>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3.5 py-4 scrollbar-none">
          {links.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `group relative flex min-h-[48px] items-center gap-3.5 rounded-2xl px-3.5 text-sm font-bold transition-all duration-300 ${
                    isActive
                      ? "bg-violet-600 text-white shadow-lg shadow-violet-900/30 scale-[1.02]"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 hover:translate-x-1"
                  } ${collapsed ? "justify-center px-0" : ""}`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={20}
                      strokeWidth={2}
                      className={`shrink-0 transition-transform duration-300 group-hover:scale-110 ${
                        isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                      }`}
                    />

                    {!collapsed && (
                      <span className="truncate transition-colors">
                        {item.label}
                      </span>
                    )}

                    {collapsed && (
                      <div className="absolute left-full ml-3 hidden rounded-xl bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xl whitespace-nowrap group-hover:block z-50 pointer-events-none">
                        {item.label}
                      </div>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Collapse Toggle */}
        <div className="shrink-0 border-t border-slate-800/80 p-4 bg-slate-950/20">
          <button
            type="button"
            onClick={onToggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`hidden h-11 w-full items-center rounded-2xl text-slate-400 transition hover:bg-slate-800 hover:text-white lg:flex ${
              collapsed ? "justify-center" : "justify-end px-4"
            }`}
          >
            {collapsed ? (
              <ChevronRight size={20} className="transition-transform hover:scale-110" />
            ) : (
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                <span>Collapse</span>
                <ChevronLeft size={18} className="transition-transform hover:scale-110" />
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}