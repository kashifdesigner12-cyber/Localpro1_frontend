"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  Check,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Save,
  Settings,
  ShieldCheck,
  Clock3,
  UserRound,
  X,
} from "lucide-react";

import { authService } from "@/services/authService";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api";

// ==========================================
// NAVIGATION
// ==========================================

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

// ==========================================
// DEFAULT SETTINGS
// ==========================================

const defaultSettings = {
  emailNotifications: true,
  pushNotifications: true,
  taskUpdates: true,
  appointmentAlerts: true,
  messageAlerts: true,
};

// ==========================================
// PAGE
// ==========================================

export default function UserSettingsPage() {
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [settings, setSettings] =
    useState(defaultSettings);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [error, setError] =
    useState("");

  // ==========================================
  // LOAD SETTINGS
  // GET /api/users/profile
  // ==========================================

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      try {
        setLoading(true);
        setError("");
        setSaved(false);

        const response = await fetch(
          `${API_URL}/users/profile`,
          {
            method: "GET",

            headers: {
              Accept: "application/json",
            },

            credentials: "include",

            cache: "no-store",
          }
        );

        let data = null;

        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (!mounted) {
          return;
        }

        // ======================================
        // UNAUTHENTICATED
        // ======================================

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        // ======================================
        // FORBIDDEN
        // ======================================

        if (response.status === 403) {
          setError(
            data?.message ||
              "You do not have permission to access your settings."
          );

          return;
        }

        // ======================================
        // OTHER ERROR
        // ======================================

        if (
          !response.ok ||
          data?.success === false
        ) {
          throw new Error(
            data?.message ||
              "Unable to load your settings."
          );
        }

        // ======================================
        // USER DATA
        // ======================================

        const user =
          data?.user ||
          data?.data ||
          null;

        const backendPreferences =
          user?.notificationPreferences ||
          {};

        // ======================================
        // SET BACKEND VALUES
        // ======================================

        setSettings({
          emailNotifications:
            backendPreferences
              .emailNotifications ??
            true,

          pushNotifications:
            backendPreferences
              .pushNotifications ??
            true,

          taskUpdates:
            backendPreferences
              .taskUpdates ??
            true,

          appointmentAlerts:
            backendPreferences
              .appointmentAlerts ??
            true,

          messageAlerts:
            backendPreferences
              .messageAlerts ??
            true,
        });
      } catch (err) {
        if (!mounted) {
          return;
        }

        console.error(
          "Load settings error:",
          err
        );

        setError(
          err?.message ||
            "Unable to load settings."
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      mounted = false;
    };
  }, [router]);

  // ==========================================
  // TOGGLE SETTING
  // ==========================================

  function handleToggle(name) {
    if (loading || saving) {
      return;
    }

    setSettings((previous) => ({
      ...previous,
      [name]: !previous[name],
    }));

    setSaved(false);
    setError("");
  }

  // ==========================================
  // SAVE SETTINGS
  // PATCH /api/users/profile
  // ==========================================

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading || saving) {
      return;
    }

    try {
      setSaving(true);
      setSaved(false);
      setError("");

      const response = await fetch(
        `${API_URL}/users/profile`,
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },

          credentials: "include",

          body: JSON.stringify({
            notificationPreferences: {
              emailNotifications:
                settings.emailNotifications,

              pushNotifications:
                settings.pushNotifications,

              taskUpdates:
                settings.taskUpdates,

              appointmentAlerts:
                settings.appointmentAlerts,

              messageAlerts:
                settings.messageAlerts,
            },
          }),
        }
      );

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      // ======================================
      // SESSION EXPIRED
      // ======================================

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      // ======================================
      // FORBIDDEN
      // ======================================

      if (response.status === 403) {
        throw new Error(
          data?.message ||
            "You do not have permission to update your settings."
        );
      }

      // ======================================
      // OTHER ERROR
      // ======================================

      if (
        !response.ok ||
        data?.success === false
      ) {
        throw new Error(
          data?.message ||
            "Unable to update settings."
        );
      }

      // ======================================
      // BACKEND RESPONSE
      // USE SERVER VALUES AS SOURCE OF TRUTH
      // ======================================

      const updatedUser =
        data?.user ||
        data?.data ||
        null;

      const updatedPreferences =
        updatedUser?.notificationPreferences;

      if (updatedPreferences) {
        setSettings({
          emailNotifications:
            updatedPreferences
              .emailNotifications ??
            true,

          pushNotifications:
            updatedPreferences
              .pushNotifications ??
            true,

          taskUpdates:
            updatedPreferences
              .taskUpdates ??
            true,

          appointmentAlerts:
            updatedPreferences
              .appointmentAlerts ??
            true,

          messageAlerts:
            updatedPreferences
              .messageAlerts ??
            true,
        });
      }

      setSaved(true);
    } catch (err) {
      console.error(
        "Save settings error:",
        err
      );

      setError(
        err?.message ||
          "Unable to save settings."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================
  // LOGOUT
  // POST /api/auth/logout
  // ==========================================

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);

      await authService.logout();
    } catch (err) {
      console.error(
        "Logout error:",
        err
      );
    } finally {
      router.replace("/login");
    }
  }

  // ==========================================
  // UI
  // ==========================================

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* ==========================================
          MOBILE OVERLAY
      ========================================== */}

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() =>
            setSidebarOpen(false)
          }
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* ==========================================
          SIDEBAR
      ========================================== */}

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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-white">
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
            onClick={() =>
              setSidebarOpen(false)
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation */}

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Workspace
          </p>

          <div className="space-y-1.5">
            {navigation.map((item) => (
              <UserNavItem
                key={item.href}
                item={item}
                onNavigate={() =>
                  setSidebarOpen(false)
                }
              />
            ))}
          </div>
        </nav>

        {/* User Area */}

        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-xl px-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-xs font-bold text-white">
              U
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                User
              </p>

              <p className="truncate text-xs text-slate-400">
                User Account
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

      {/* ==========================================
          MAIN AREA
      ========================================== */}

      <div className="lg:pl-64">
        {/* ==========================================
            TOP BAR
        ========================================== */}

        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
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
                Settings
              </p>
            </div>
          </div>

          <Link
            href="/user/notifications"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EEF4FF] text-[#2563EB] transition hover:bg-blue-100"
            aria-label="Notifications"
          >
            <Bell size={17} />
          </Link>
        </header>

        {/* ==========================================
            PAGE CONTENT
        ========================================== */}

        <main className="min-h-[calc(100vh-4rem)] p-5 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-4xl space-y-6">
            {/* Heading */}

            <section>
              <p className="text-sm font-semibold text-[#2563EB]">
                ACCOUNT
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
                Settings
              </h1>

              <p className="mt-2 text-sm text-[#64748B]">
                Manage your notification preferences
                and account settings.
              </p>
            </section>

            {/* ==========================================
                LOADING
            ========================================== */}

            {loading && (
              <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm font-semibold text-[#2563EB]">
                <Loader2
                  size={18}
                  className="animate-spin"
                />

                <span>
                  Loading your settings...
                </span>
              </div>
            )}

            {/* ==========================================
                ERROR
            ========================================== */}

            {error && !loading && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            {/* ==========================================
                SUCCESS
            ========================================== */}

            {saved && !loading && (
              <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100">
                  <Check size={15} />
                </div>

                <span>
                  Settings updated successfully.
                </span>
              </div>
            )}

            {/* ==========================================
                NOTIFICATION PREFERENCES
            ========================================== */}

            <form
              onSubmit={handleSubmit}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              {/* Section Header */}

              <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                    <Bell size={19} />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-[#171B3A]">
                      Notification Preferences
                    </h2>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Select the notifications you want
                      to receive.
                    </p>
                  </div>
                </div>
              </div>

              {/* Settings */}

              <div className="divide-y divide-slate-100">
                <PreferenceRow
                  icon={Mail}
                  title="Email Notifications"
                  description="Receive important workspace updates by email."
                  checked={
                    settings.emailNotifications
                  }
                  onChange={() =>
                    handleToggle(
                      "emailNotifications"
                    )
                  }
                  disabled={
                    loading || saving
                  }
                />

                <PreferenceRow
                  icon={Bell}
                  title="Push Notifications"
                  description="Receive important notifications and workspace alerts."
                  checked={
                    settings.pushNotifications
                  }
                  onChange={() =>
                    handleToggle(
                      "pushNotifications"
                    )
                  }
                  disabled={
                    loading || saving
                  }
                />

                <PreferenceRow
                  icon={ClipboardList}
                  title="Task Updates"
                  description="Get notified when a task is assigned or updated."
                  checked={
                    settings.taskUpdates
                  }
                  onChange={() =>
                    handleToggle(
                      "taskUpdates"
                    )
                  }
                  disabled={
                    loading || saving
                  }
                />

                <PreferenceRow
                  icon={CalendarDays}
                  title="Appointment Alerts"
                  description="Receive alerts related to upcoming appointments."
                  checked={
                    settings.appointmentAlerts
                  }
                  onChange={() =>
                    handleToggle(
                      "appointmentAlerts"
                    )
                  }
                  disabled={
                    loading || saving
                  }
                />

                <PreferenceRow
                  icon={MessageSquare}
                  title="Message Alerts"
                  description="Receive notifications when you receive a new message."
                  checked={
                    settings.messageAlerts
                  }
                  onChange={() =>
                    handleToggle(
                      "messageAlerts"
                    )
                  }
                  disabled={
                    loading || saving
                  }
                />
              </div>

              {/* Actions */}

              <div className="flex items-center justify-end border-t border-slate-100 p-5 sm:p-6">
                <button
                  type="submit"
                  disabled={
                    loading || saving
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {saving ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Save size={17} />
                  )}

                  {saving
                    ? "Saving..."
                    : "Save Settings"}
                </button>
              </div>
            </form>

            {/* ==========================================
                ACCOUNT
            ========================================== */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                    <UserRound size={19} />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-[#171B3A]">
                      Account
                    </h2>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Manage your profile and account
                      security.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-6">
                {/* Profile */}

                <Link
                  href="/user/profile"
                  className="group rounded-xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-[#EEF4FF]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                      <UserRound size={18} />
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-[#171B3A]">
                        My Profile
                      </h3>

                      <p className="mt-1 text-xs leading-5 text-[#64748B]">
                        View and update your personal
                        information.
                      </p>
                    </div>
                  </div>
                </Link>

                {/* Security */}

                <Link
                  href="/user/profile"
                  className="group rounded-xl border border-slate-200 p-4 text-left transition hover:border-blue-200 hover:bg-[#EEF4FF]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                      <ShieldCheck size={18} />
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-[#171B3A]">
                        Security
                      </h3>

                      <p className="mt-1 text-xs leading-5 text-[#64748B]">
                        Manage your password and account
                        security.
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

/* =========================================
   PREFERENCE ROW
========================================= */

function PreferenceRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
  disabled,
}) {
  return (
    <label
      className={`flex items-center justify-between gap-5 px-5 py-5 transition sm:px-6 ${
        disabled
          ? "cursor-not-allowed opacity-70"
          : "cursor-pointer hover:bg-slate-50"
      }`}
    >
      {/* Left */}

      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
          <Icon size={18} />
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#171B3A]">
            {title}
          </h3>

          <p className="mt-1 text-xs leading-5 text-[#64748B]">
            {description}
          </p>
        </div>
      </div>

      {/* Checkbox */}

      <div className="relative shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="peer sr-only"
        />

        <div
          className={`flex h-6 w-6 items-center justify-center rounded-md border-2 transition ${
            checked
              ? "border-[#2563EB] bg-[#2563EB]"
              : "border-slate-300 bg-white"
          }`}
        >
          {checked && (
            <Check
              size={15}
              strokeWidth={3}
              className="text-white"
            />
          )}
        </div>
      </div>
    </label>
  );
}

/* =========================================
   SIDEBAR NAVIGATION
========================================= */

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
          : "bg-transparent text-white hover:bg-white/10 hover:text-white"
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