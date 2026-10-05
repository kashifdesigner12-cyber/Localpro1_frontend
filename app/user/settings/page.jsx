"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Clock3,
  UserRound,
  X,
  Sparkles,
} from "lucide-react";

import { authService } from "@/services/authService";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.localpro1.net/api";

const CACHE_TIME = 60 * 1000;

const navigation = [
  { label: "Dashboard", href: "/user", icon: LayoutDashboard },
  { label: "My Tasks", href: "/user/tasks", icon: ClipboardList },
  { label: "Calendar", href: "/user/calendar", icon: CalendarDays },
  { label: "Attendance", href: "/user/attendance", icon: Clock3 },
  { label: "Messages", href: "/user/messages", icon: MessageSquare },
  { label: "Notifications", href: "/user/notifications", icon: Bell },
  { label: "Leave Requests", href: "/user/leave-requests", icon: FileText },
  { label: "Profile", href: "/user/profile", icon: UserRound },
  { label: "Settings", href: "/user/settings", icon: Settings },
  { label: "Policies", href: "/user/policies", icon: ShieldCheck },
];

const defaultSettings = {
  emailNotifications: true,
  pushNotifications: true,
  taskUpdates: true,
  appointmentAlerts: true,
  messageAlerts: true,
};

export default function UserSettingsPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [settings, setSettings] = useState(defaultSettings);
  const [currentUser, setCurrentUser] = useState(() => extractUser(authService?.getUser?.()));

  const [loading, setLoading] = useState(false); // Instant render
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const cacheRef = useRef({ timestamp: 0, data: null });
  const loadingRef = useRef(false);

  /* =========================================================
     LOAD SETTINGS (Speed Optimized & Cached)
  ========================================================= */

  const loadSettings = useCallback(
    async (force = false) => {
      if (loadingRef.current) return;

      const now = Date.now();
      if (
        !force &&
        cacheRef.current.data &&
        now - cacheRef.current.timestamp < CACHE_TIME
      ) {
        return;
      }

      loadingRef.current = true;
      if (force) setRefreshing(true);

      try {
        setError("");
        setSaved(false);

        const response = await fetch(`${API_URL}/users/profile`, {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "include",
          cache: "no-store",
        });

        let data = null;
        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (response.status === 403) {
          setError(data?.message || "You do not have permission to access your settings.");
          return;
        }

        if (!response.ok || data?.success === false) {
          throw new Error(data?.message || "Unable to load your settings.");
        }

        const user = data?.user || data?.data || null;
        if (user) setCurrentUser(user);

        const backendPreferences = user?.notificationPreferences || {};

        const nextSettings = {
          emailNotifications: backendPreferences.emailNotifications ?? true,
          pushNotifications: backendPreferences.pushNotifications ?? true,
          taskUpdates: backendPreferences.taskUpdates ?? true,
          appointmentAlerts: backendPreferences.appointmentAlerts ?? true,
          messageAlerts: backendPreferences.messageAlerts ?? true,
        };

        setSettings(nextSettings);

        cacheRef.current = {
          timestamp: Date.now(),
          data: { user, settings: nextSettings },
        };
      } catch (err) {
        console.error("Load settings error:", err);
        setError(err?.message || "Unable to load settings.");
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    loadSettings(false);
  }, [loadSettings]);

  function handleToggle(name) {
    if (saving) return;

    setSettings((previous) => ({
      ...previous,
      [name]: !previous[name],
    }));

    setSaved(false);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    try {
      setSaving(true);
      setSaved(false);
      setError("");

      const response = await fetch(`${API_URL}/users/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          notificationPreferences: {
            emailNotifications: settings.emailNotifications,
            pushNotifications: settings.pushNotifications,
            taskUpdates: settings.taskUpdates,
            appointmentAlerts: settings.appointmentAlerts,
            messageAlerts: settings.messageAlerts,
          },
        }),
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (response.status === 403) {
        throw new Error(data?.message || "You do not have permission to update your settings.");
      }

      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || "Unable to update settings.");
      }

      const updatedUser = data?.user || data?.data || null;
      const updatedPreferences = updatedUser?.notificationPreferences;

      if (updatedPreferences) {
        setSettings({
          emailNotifications: updatedPreferences.emailNotifications ?? true,
          pushNotifications: updatedPreferences.pushNotifications ?? true,
          taskUpdates: updatedPreferences.taskUpdates ?? true,
          appointmentAlerts: updatedPreferences.appointmentAlerts ?? true,
          messageAlerts: updatedPreferences.messageAlerts ?? true,
        });
      }

      setSaved(true);
      cacheRef.current.timestamp = 0; // Invalidate cache
    } catch (err) {
      console.error("Save settings error:", err);
      setError(err?.message || "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    if (loggingOut) return;

    try {
      setLoggingOut(true);
      await authService.logout();
    } catch {} finally {
      router.replace("/login");
    }
  }

  const userName = currentUser?.name || currentUser?.fullName || currentUser?.email || "User";
  const userInitial = String(userName).trim().charAt(0).toUpperCase() || "U";
  const userEmail = currentUser?.email || "User Account";

  return (
    <div className="relative min-h-screen w-full bg-[#f7f8fc] text-slate-900 animate-fadeIn">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl animate-pulse" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* SIDEBAR (Matching Admin Dark Theme & Animations) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#171B3A] text-white shadow-2xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <Link
            href="/user"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 text-white"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-md shadow-purple-600/20">
              <ShieldCheck size={22} />
            </div>

            <div>
              <h1 className="text-sm font-bold text-white">Local Pro 1</h1>
              <p className="text-[11px] font-semibold text-violet-400">
                User Workspace
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Workspace
          </p>

          <div className="space-y-1.5">
            {navigation.map((item) => (
              <UserNavItem
                key={item.href}
                item={item}
                onNavigate={() => setSidebarOpen(false)}
              />
            ))}
          </div>
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-600 text-xs font-bold text-white">
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt={userName} className="h-full w-full object-cover" />
              ) : (
                userInitial
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{userName}</p>
              <p className="truncate text-xs font-medium text-slate-400">{userEmail}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-60"
          >
            {loggingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="min-h-screen w-full lg:pl-64">
        {/* TOP BAR */}
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
              <p className="text-xs font-semibold text-slate-400">Workspace</p>
              <p className="text-sm font-bold text-slate-900">Settings</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => loadSettings(true)}
              disabled={refreshing}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-violet-50 hover:text-violet-600 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin text-violet-600" : ""} />
            </button>

            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-sm">
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt={userName} className="h-full w-full object-cover" />
              ) : (
                userInitial
              )}
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 animate-slideUp">
          <div className="mx-auto max-w-4xl space-y-6">

            {/* HEADER SECTION (NO BANNER) */}
            <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/80 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-violet-700">
                  <ShieldCheck size={13} />
                  PREFERENCES
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  Settings
                </h1>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  Manage your notification preferences and account alerts.
                </p>
              </div>
            </section>

            {error && (
              <section className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs font-bold text-rose-700 shadow-sm">
                <div className="flex items-center justify-between">
                  <p>{error}</p>
                  <button onClick={() => setError("")} className="text-rose-400 hover:text-rose-600">
                    <X size={16} />
                  </button>
                </div>
              </section>
            )}

            {saved && (
              <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs font-bold text-emerald-700 shadow-sm">
                Settings updated successfully.
              </section>
            )}

            {/* NOTIFICATION PREFERENCES FORM */}
            <form onSubmit={handleSubmit} className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]">
              <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                    <Bell size={19} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Notification Preferences</h2>
                    <p className="text-xs text-slate-500">Select alerts you wish to receive.</p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                <PreferenceRow
                  icon={Mail}
                  title="Email Notifications"
                  description="Receive important workspace updates by email."
                  checked={settings.emailNotifications}
                  onChange={() => handleToggle("emailNotifications")}
                  disabled={saving}
                />

                <PreferenceRow
                  icon={Bell}
                  title="Push Notifications"
                  description="Receive important notifications and workspace alerts."
                  checked={settings.pushNotifications}
                  onChange={() => handleToggle("pushNotifications")}
                  disabled={saving}
                />

                <PreferenceRow
                  icon={ClipboardList}
                  title="Task Updates"
                  description="Get notified when a task is assigned or updated."
                  checked={settings.taskUpdates}
                  onChange={() => handleToggle("taskUpdates")}
                  disabled={saving}
                />

                <PreferenceRow
                  icon={CalendarDays}
                  title="Appointment Alerts"
                  description="Receive alerts related to upcoming appointments."
                  checked={settings.appointmentAlerts}
                  onChange={() => handleToggle("appointmentAlerts")}
                  disabled={saving}
                />

                <PreferenceRow
                  icon={MessageSquare}
                  title="Message Alerts"
                  description="Receive notifications when you receive a new message."
                  checked={settings.messageAlerts}
                  onChange={() => handleToggle("messageAlerts")}
                  disabled={saving}
                />
              </div>

              <div className="flex items-center justify-end border-t border-slate-100 p-6">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 text-xs font-bold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{saving ? "Saving settings..." : "Save Settings"}</span>
                </button>
              </div>
            </form>

            {/* ACCOUNT SHORTCUTS */}
            <section className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]">
              <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                    <UserRound size={19} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Account Security</h2>
                    <p className="text-xs text-slate-500">Manage profile and credentials.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
                <Link
                  href="/user/profile"
                  className="group rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition hover:border-violet-200 hover:bg-violet-50/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                      <UserRound size={17} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">My Profile</h3>
                      <p className="text-[11px] text-slate-400">View and update personal details.</p>
                    </div>
                  </div>
                </Link>

                <Link
                  href="/user/profile"
                  className="group rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition hover:border-violet-200 hover:bg-violet-50/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                      <ShieldCheck size={17} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">Security</h3>
                      <p className="text-[11px] text-slate-400">Manage account password.</p>
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

function UserNavItem({ item, onNavigate }) {
  const pathname = usePathname();
  const Icon = item.icon;
  const isActive =
    pathname === item.href ||
    (item.href !== "/user" && pathname.startsWith(`${item.href}/`));

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold transition duration-150 ${
        isActive
          ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon size={18} className={`transition duration-150 ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`} />
      <span>{item.label}</span>
    </Link>
  );
}

function PreferenceRow({ icon: Icon, title, description, checked, onChange, disabled }) {
  return (
    <label className={`flex items-center justify-between gap-5 px-6 py-4.5 transition ${
      disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-slate-50/60"
    }`}>
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-400">{description}</p>
        </div>
      </div>

      <div className="relative shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="peer sr-only"
        />
        <div className={`flex h-6 w-6 items-center justify-center rounded-lg border-2 transition ${
          checked ? "border-violet-600 bg-violet-600" : "border-slate-300 bg-white"
        }`}>
          {checked && <Check size={14} strokeWidth={3} className="text-white" />}
        </div>
      </div>
    </label>
  );
}

function extractUser(response) {
  return response?.user || response?.data?.user || response?.data || response || null;
}