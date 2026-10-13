"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  ClipboardList,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  RefreshCw,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import { authService } from "@/services/authService";

const navigation = [
  { label: "Dashboard", href: "/user", icon: LayoutDashboard },
  { label: "My Tasks", href: "/user/tasks", icon: ClipboardList },
  { label: "Attendance", href: "/user/attendance", icon: Clock3 },
  { label: "Messages", href: "/user/messages", icon: MessageSquare },
  { label: "Notifications", href: "/user/notifications", icon: Bell },
  { label: "Leave Requests", href: "/user/leave-requests", icon: FileText },
  { label: "Profile", href: "/user/profile", icon: UserRound },
  { label: "Settings", href: "/user/settings", icon: Settings },
  { label: "Policies", href: "/user/policies", icon: ShieldCheck },
];

export default function UserLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const dropdownRef = useRef(null);

  const fetchUserData = useCallback(async () => {
    try {
      const response = await authService.me();
      const currentUser = response?.user || response?.data || response;

      if (!currentUser) {
        router.replace("/login");
        return;
      }

      const role = String(currentUser?.role || "").trim().toLowerCase();
      if (role !== "user") {
        if (role === "admin") router.replace("/admin");
        else if (role === "manager") router.replace("/manager");
        else router.replace("/login");
        return;
      }

      setUser(currentUser);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    }
    if (profileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileDropdownOpen]);

  async function handleLogout() {
    try {
      if (typeof authService?.logout === "function") {
        await authService.logout();
      }
    } catch {}
    router.replace("/login");
    router.refresh();
  }

  const userName =
    user?.name || user?.fullName || user?.email?.split("@")?.[0] || "User";

  return (
    <div className="relative min-h-screen w-full bg-[#f7f8fc] text-slate-900">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* SIDEBAR — Teams Style Icon-Only with White Icons */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-20 flex-col items-center bg-[#171B3A] text-white shadow-2xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 w-full shrink-0 items-center justify-center border-b border-white/10 px-2">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
            <ShieldCheck size={24} />
          </div>
        </div>

        <nav className="min-h-0 flex-1 w-full overflow-y-auto px-2 py-5 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/user" && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                onClick={() => setSidebarOpen(false)}
                className={`group relative flex h-12 w-full items-center justify-center rounded-xl transition ${
                  isActive
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-white hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={20} strokeWidth={2} className="shrink-0 text-white" />
                <span className="absolute left-full ml-3 hidden rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-md group-hover:block z-50 whitespace-nowrap">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 w-full border-t border-white/10 p-3 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleLogout}
            title="Sign Out"
            className="flex h-11 w-full items-center justify-center rounded-xl text-white transition hover:bg-white/10 hover:text-white"
          >
            <LogOut size={18} className="text-white" />
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER AREA */}
      <div className="min-h-screen w-full lg:pl-20">
        {/* HEADER BAR WITH PROFILE DROPDOWN */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-5 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

            <div>
              <p className="text-xs font-semibold text-slate-400">User Workspace</p>
              <p className="text-sm font-bold text-slate-900">Dashboard Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/user/notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-600 transition hover:bg-violet-100"
              title="Notifications"
            >
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white shadow-sm">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>

            {/* Profile Dropdown Container */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white p-1 pr-3 shadow-xs transition hover:bg-slate-50 focus:outline-none"
              >
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-sm">
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={userName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    userName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="hidden max-w-[120px] text-left sm:block">
                  <p className="truncate text-xs font-bold text-slate-900">
                    {userName}
                  </p>
                </div>
              </button>

              {/* Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200/80 bg-white py-2 shadow-xl animate-fadeIn z-50">
                  <div className="border-b border-slate-100 px-4 py-2.5">
                    <p className="truncate text-xs font-bold text-slate-900">
                      {userName}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">
                      {user?.email || "user@localpro1.net"}
                    </p>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/user/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-violet-50 hover:text-violet-700"
                    >
                      <UserRound size={15} /> My Profile
                    </Link>
                    <Link
                      href="/user/settings"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-violet-50 hover:text-violet-700"
                    >
                      <Settings size={15} /> Settings
                    </Link>
                  </div>

                  <div className="border-t border-slate-100 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        handleLogout();
                      }}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                    >
                      <LogOut size={15} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* DYNAMIC PAGE CONTENT CONTAINER */}
        <main className="min-h-[calc(100vh-4rem)] w-full">
          {children}
        </main>
      </div>
    </div>
  );
}