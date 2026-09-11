"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";

import {
  Activity,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/authService";

// =====================================================
// MANAGER NAVIGATION
// =====================================================

const navigation = [
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
    label: "Conversations",
    href: "/manager/conversations",
    icon: MessageSquare,
  },
  {
    label: "Calendar",
    href: "/manager/calendar",
    icon: CalendarDays,
  },
  {
    label: "Activity",
    href: "/manager/activity",
    icon: Activity,
  },
  {
    label: "Settings",
    href: "/manager/settings",
    icon: SettingsIcon,
  },
];

// Global persistent cache for manager layout session state
let globalManagerUserCache = {
  user: null,
  loaded: false,
};

export const invalidateManagerUserCache = () => {
  globalManagerUserCache = {
    user: null,
    loaded: false,
  };
};

// =====================================================
// MANAGER LAYOUT
// =====================================================

export default function ManagerLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const { user: authUser, loading: authLoading, checkAuth } = useAuth();

  const redirectingRef = useRef(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState(globalManagerUserCache.user || authUser);
  const [loading, setLoading] = useState(!globalManagerUserCache.loaded && authLoading);

  const [profile, setProfile] = useState({
    name: currentUser?.name || currentUser?.fullName || "",
    email: currentUser?.email || "",
    avatar: currentUser?.avatar || currentUser?.profileImage || currentUser?.profilePicture || currentUser?.image || "",
  });

  const [loggingOut, setLoggingOut] = useState(false);

  // Sync profile state whenever cache or authUser updates
  const syncProfileData = useCallback((activeUser) => {
    if (!activeUser) return;
    setProfile({
      name: activeUser?.name || activeUser?.fullName || "",
      email: activeUser?.email || "",
      avatar: activeUser?.avatar || activeUser?.profileImage || activeUser?.profilePicture || activeUser?.image || "",
    });
    setCurrentUser(activeUser);
  }, []);

  // Listen for custom profile update events across the app for instantaneous UI refresh without full page reloads
  useEffect(() => {
    const handleProfileUpdate = (e) => {
      const freshUser = e.detail;
      if (freshUser) {
        globalManagerUserCache = {
          user: freshUser,
          loaded: true,
        };
        syncProfileData(freshUser);
      }
    };

    window.addEventListener("manager_profile_updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("manager_profile_updated", handleProfileUpdate);
    };
  }, [syncProfileData]);

  // ===================================================
  // AUTH + PROFILE
  // ===================================================

  useEffect(() => {
    if (globalManagerUserCache.loaded && globalManagerUserCache.user) {
      syncProfileData(globalManagerUserCache.user);
      setLoading(false);
      return;
    }

    if (authLoading) return;

    if (redirectingRef.current) return;

    const activeUser = authUser;

    // -------------------------------------------------
    // NOT AUTHENTICATED
    // -------------------------------------------------

    if (!activeUser) {
      redirectingRef.current = true;
      globalManagerUserCache = { user: null, loaded: false };

      router.replace(
        `/login?redirect=${encodeURIComponent(
          pathname || "/manager"
        )}`
      );

      return;
    }

    // -------------------------------------------------
    // ROLE
    // -------------------------------------------------

    const currentRole = String(activeUser?.role || "")
      .trim()
      .toLowerCase();

    // -------------------------------------------------
    // ADMIN
    // -------------------------------------------------

    if (currentRole === "admin") {
      redirectingRef.current = true;
      router.replace("/admin");
      return;
    }

    // -------------------------------------------------
    // USER
    // -------------------------------------------------

    if (currentRole === "user") {
      redirectingRef.current = true;
      router.replace("/user");
      return;
    }

    // -------------------------------------------------
    // UNKNOWN ROLE
    // -------------------------------------------------

    if (currentRole !== "manager") {
      redirectingRef.current = true;
      globalManagerUserCache = { user: null, loaded: false };
      router.replace("/login");
      return;
    }

    // -------------------------------------------------
    // MANAGER PROFILE & CACHE SAVE
    // -------------------------------------------------

    syncProfileData(activeUser);

    globalManagerUserCache = {
      user: activeUser,
      loaded: true,
    };

    setLoading(false);
  }, [
    authLoading,
    authUser,
    router,
    pathname,
    syncProfileData,
  ]);

  // ===================================================
  // CLOSE MOBILE SIDEBAR
  // ===================================================

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // ===================================================
  // LOGOUT
  // ===================================================

  async function handleLogout() {
    if (loggingOut) return;

    try {
      setLoggingOut(true);
      globalManagerUserCache = { user: null, loaded: false };
      await authService.logout();
    } catch (error) {
      console.error(
        "Manager logout error:",
        error
      );
    } finally {
      router.replace("/login");
    }
  }

  // ===================================================
  // INITIALS
  // ===================================================

  const initials =
    profile.name
      ?.trim()
      ?.charAt(0)
      ?.toUpperCase() || "M";

  // ===================================================
  // AUTH LOADING (Only on initial hard load if no cache)
  // ===================================================

  if (loading && !globalManagerUserCache.loaded) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF4FF]">
            <Loader2
              size={28}
              className="animate-spin text-[#2563EB]"
            />
          </div>

          <p className="text-sm font-semibold text-[#64748B]">
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  const activeUser = currentUser || authUser;

  // ===================================================
  // REDIRECT LOADING
  // ===================================================

  if (!activeUser && !globalManagerUserCache.loaded) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF4FF]">
            <Loader2
              size={28}
              className="animate-spin text-[#2563EB]"
            />
          </div>

          <p className="text-sm font-semibold text-[#64748B]">
            Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  // ===================================================
  // MAIN MANAGER LAYOUT
  // ===================================================

  return (
    <div className="flex min-h-screen w-full bg-[#F8FAFC]">

      {/* =================================================
          MOBILE OVERLAY
      ================================================= */}

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* =================================================
          SINGLE SIDEBAR
      ================================================= */}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          flex w-64 shrink-0 flex-col
          bg-[#171B3A]
          shadow-xl
          transition-transform duration-300

          ${
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }

          lg:sticky
          lg:top-0
          lg:h-screen
          lg:translate-x-0
        `}
      >

        {/* =================================================
            LOGO
        ================================================= */}

        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-5">

          <div className="flex min-w-0 items-center gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-sm">
              <ShieldCheck size={22} />
            </div>

            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white">
                Local Pro 1
              </h1>

              <p className="text-[11px] font-medium text-slate-300">
                Manager Workspace
              </p>
            </div>

          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>

        </div>

        {/* =================================================
            NAVIGATION
        ================================================= */}

        <nav className="flex-1 overflow-y-auto px-3 py-5">

          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-300">
            Management
          </p>

          <div className="space-y-1.5">
            {navigation.map((item) => (
              <ManagerNavItem
                key={item.href}
                item={item}
                onNavigate={() =>
                  setSidebarOpen(false)
                }
              />
            ))}
          </div>

        </nav>

        {/* =================================================
            PROFILE + LOGOUT
        ================================================= */}

        <div className="shrink-0 border-t border-white/10 p-3">

          <div className="mb-2 flex items-center gap-3 rounded-xl px-3 py-3">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2563EB] text-xs font-bold text-white">

              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt="Manager profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}

            </div>

            <div className="min-w-0">

              <p className="truncate text-sm font-semibold text-white">
                {profile.name || "Manager"}
              </p>

              <p className="truncate text-xs font-medium text-slate-300">
                Manager Account
              </p>

            </div>

          </div>

          <button
            type="button"
            onClick={handleLogout}
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

      {/* =================================================
          RIGHT SIDE
          FULL REMAINING WIDTH
      ================================================= */}

      <div className="min-w-0 flex-1 w-full">

        {/* =================================================
            SHARED HEADER
        ================================================= */}

        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">

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
                Management
              </p>

              <p className="text-sm font-bold text-[#171B3A]">
                {getPageTitle(pathname)}
              </p>
            </div>

          </div>

          {/* =================================================
              HEADER PROFILE
          ================================================= */}

          <Link
            href="/manager/settings"
            title="Manager Settings"
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EEF4FF] text-xs font-bold text-[#2563EB] transition hover:ring-2 hover:ring-blue-500/20"
          >

            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt="Manager profile"
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}

          </Link>

        </header>

        {/* =================================================
            FULL WIDTH PAGE CONTENT
        ================================================= */}

        <main className="min-h-[calc(100vh-4rem)] w-full">
          <div className="w-full min-w-0">
            {children}
          </div>
        </main>

      </div>

    </div>
  );
}

// =====================================================
// NAV ITEM
// =====================================================

function ManagerNavItem({
  item,
  onNavigate,
}) {
  const pathname = usePathname();

  const Icon = item.icon;

  const isActive =
    pathname === item.href ||
    (item.href !== "/manager" &&
      pathname.startsWith(
        `${item.href}/`
      ));

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`
        group flex w-full items-center gap-3
        rounded-xl px-3 py-3
        text-sm font-semibold transition

        ${
          isActive
            ? "bg-[#2563EB] text-white shadow-sm"
            : "bg-transparent text-white hover:bg-white/10 hover:text-white"
        }
      `}
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

// =====================================================
// PAGE TITLE
// =====================================================

function getPageTitle(pathname) {
  if (pathname === "/manager") {
    return "Dashboard";
  }

  if (pathname.startsWith("/manager/team")) {
    return "Team";
  }

  if (pathname.startsWith("/manager/tasks")) {
    return "Tasks";
  }

  if (
    pathname.startsWith(
      "/manager/conversations"
    )
  ) {
    return "Conversations";
  }

  if (pathname.startsWith("/manager/calendar")) {
    return "Calendar";
  }

  if (pathname.startsWith("/manager/activity")) {
    return "Activity";
  }

  if (pathname.startsWith("/manager/settings")) {
    return "Settings";
  }

  return "Manager Workspace";
}