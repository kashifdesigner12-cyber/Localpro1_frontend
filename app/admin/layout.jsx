"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  ShieldCheck,
  Users,
  X,
  UserCheck,
} from "lucide-react";

import { authService } from "@/services/authService";

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
    label: "Attendance",
    href: "/admin/attendance",
    icon: UserCheck,
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

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  const mountedRef = useRef(false);
  const checkingAuthRef = useRef(false);
  const redirectingRef = useRef(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (checkingAuthRef.current) {
      return;
    }

    let cancelled = false;

    checkingAuthRef.current = true;

    const checkAdmin = async () => {
      try {
        if (!cancelled && mountedRef.current) {
          setLoading(true);
        }

        const response = await authService.me();

        if (cancelled || !mountedRef.current) {
          return;
        }

        const user = response?.user;

        if (!user) {
          redirectToLogin();
          return;
        }

        const role = String(user?.role || "")
          .trim()
          .toLowerCase();

        if (role !== "admin") {
          redirectToLogin();
          return;
        }

        setCurrentUser({
          ...user,
          avatar: user?.avatar || null,
        });
      } catch (error) {
        if (!cancelled && mountedRef.current) {
          console.error(
            "Admin authentication check failed:",
            error
          );

          redirectToLogin();
        }
      } finally {
        checkingAuthRef.current = false;

        if (!cancelled && mountedRef.current) {
          setLoading(false);
        }
      }
    };

    checkAdmin();

    return () => {
      cancelled = true;
      checkingAuthRef.current = false;
    };
  }, []);

  function redirectToLogin() {
    if (redirectingRef.current) {
      return;
    }

    redirectingRef.current = true;

    try {
      if (typeof authService.clearToken === "function") {
        authService.clearToken();
      }
    } catch (error) {
      console.error(
        "Failed to clear authentication token:",
        error
      );
    }

    router.replace("/login");
  }

  async function handleSignOut() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      if (typeof authService.logout === "function") {
        await authService.logout();
      }
    } catch (error) {
      console.error(
        "Admin logout error:",
        error
      );
    } finally {
      try {
        if (typeof authService.clearToken === "function") {
          authService.clearToken();
        }
      } catch (error) {
        console.error(
          "Failed to clear authentication token:",
          error
        );
      }

      if (mountedRef.current) {
        setSidebarOpen(false);
        setLoggingOut(false);
      }

      router.replace("/login");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <Loader2
            size={30}
            className="animate-spin text-[#2563EB]"
          />

          <p className="text-sm font-medium text-[#64748B]">
            Loading admin workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#F8FAFC]">
      {/* =====================================================
          MOBILE OVERLAY
      ===================================================== */}

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        className={`
          fixed
          inset-y-0
          left-0
          z-50
          flex
          w-64
          flex-col
          bg-[#171B3A]
          shadow-xl
          transition-transform
          duration-300
          ${
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }
          lg:translate-x-0
        `}
      >
        {/* Logo */}

        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-sm">
              <ShieldCheck size={22} />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-white">
                Local Pro 1
              </h1>

              <p className="truncate text-[11px] font-medium text-slate-300">
                Admin Workspace
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition hover:bg-white/10 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation */}

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-300">
            Administration
          </p>

          <div className="space-y-1.5">
            {navigation.map((item) => {
              const Icon = item.icon;

              const isActive =
                pathname === item.href ||
                (item.href !== "/admin" &&
                  pathname.startsWith(
                    `${item.href}/`
                  ));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() =>
                    setSidebarOpen(false)
                  }
                  className={`
                    flex
                    w-full
                    items-center
                    gap-3
                    rounded-xl
                    px-3
                    py-3
                    text-sm
                    font-semibold
                    transition
                    ${
                      isActive
                        ? "bg-[#2563EB] text-white shadow-sm"
                        : "bg-transparent text-white hover:bg-white/10"
                    }
                  `}
                >
                  <Icon
                    size={18}
                    strokeWidth={2}
                    className="shrink-0 text-white"
                  />

                  <span className="truncate text-white">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Sidebar User */}

        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-xl px-3 py-3">
            <ProfileAvatar
              user={currentUser}
              size="small"
            />

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {currentUser?.name ||
                  "Administrator"}
              </p>

              <p className="truncate text-xs font-medium text-slate-300">
                Admin Account
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOut ? (
              <Loader2
                size={17}
                className="animate-spin"
              />
            ) : (
              <LogOut size={17} />
            )}

            <span>
              {loggingOut
                ? "Signing Out..."
                : "Sign Out"}
            </span>
          </button>
        </div>
      </aside>

      {/* =====================================================
          MAIN AREA
      ===================================================== */}

      <div className="min-h-screen w-full lg:pl-64">
        {/* Header */}

        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-6 lg:px-8">
          {/* Left */}

          <div className="flex min-w-0 items-center gap-3">
            {/* Mobile Menu */}

            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-[#26344D] transition hover:bg-slate-50 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

            <div className="min-w-0">
              <p className="text-xs font-medium text-[#64748B]">
                Administration
              </p>

              <p className="truncate text-sm font-bold text-[#171B3A]">
                {getPageTitle(pathname)}
              </p>
            </div>
          </div>

          {/* Header Profile */}

          <ProfileAvatar
            user={currentUser}
            size="header"
          />
        </header>

        {/* =================================================
            CHILD PAGE
        ================================================= */}

        <main className="min-h-[calc(100vh-4rem)] w-full">
          {children}
        </main>
      </div>
    </div>
  );
}

/* =========================================================
   PROFILE AVATAR
========================================================= */

function ProfileAvatar({
  user,
  size = "header",
}) {
  const avatar = user?.avatar;
  const name =
    user?.name || "Administrator";

  const firstLetter =
    name.trim().charAt(0).toUpperCase() || "A";

  if (size === "small") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2563EB] text-xs font-bold text-white">
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          firstLetter
        )}
      </div>
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EEF4FF] text-xs font-bold text-[#2563EB]">
      {avatar ? (
        <img
          src={avatar}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : (
        firstLetter
      )}
    </div>
  );
}

/* =========================================================
   PAGE TITLE
========================================================= */

function getPageTitle(pathname) {
  if (pathname === "/admin") {
    return "Admin Dashboard";
  }

  if (pathname.startsWith("/admin/users")) {
    return "Users";
  }

  if (pathname.startsWith("/admin/tasks")) {
    return "Tasks";
  }

  if (pathname.startsWith("/admin/attendance")) {
    return "Attendance";
  }

  if (
    pathname.startsWith(
      "/admin/leave-requests"
    )
  ) {
    return "Leave Requests";
  }

  if (
    pathname.startsWith(
      "/admin/conversations"
    )
  ) {
    return "Conversations";
  }

  if (
    pathname.startsWith("/admin/calendar")
  ) {
    return "Calendar";
  }

  if (
    pathname.startsWith("/admin/activity")
  ) {
    return "Activity";
  }

  if (
    pathname.startsWith("/admin/settings")
  ) {
    return "Settings";
  }

  return "Admin Workspace";
}