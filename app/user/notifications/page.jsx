"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  ClipboardList,
  Clock3,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
  Sparkles,
  ExternalLink,
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

export default function UserNotificationsPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [currentUser, setCurrentUser] = useState(() => extractUser(authService?.getUser?.()));

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const cacheRef = useRef({ timestamp: 0, data: null });
  const loadingRef = useRef(false);

  /* =========================================================
     API HELPER
  ========================================================= */

  const apiRequest = useCallback(async (endpoint, options = {}) => {
    let token = null;
    try {
      if (typeof window !== "undefined") {
        token =
          localStorage.getItem("token") ||
          localStorage.getItem("authToken") ||
          sessionStorage.getItem("token");
      }
      if (!token && typeof authService?.getToken === "function") {
        token = authService.getToken();
      }
    } catch (e) {}

    const cleanEndpoint = endpoint.startsWith("/api/")
      ? endpoint.replace(/^\/api/, "")
      : endpoint;
    const finalPath = cleanEndpoint.startsWith("/") ? cleanEndpoint : `/${cleanEndpoint}`;

    const response = await fetch(`${API_URL}${finalPath}`, {
      ...options,
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      cache: "no-store",
    });

    let data = null;
    try {
      const text = await response.text();
      if (text) data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        router.replace("/login");
      }
      throw new Error(
        data?.message || data?.error || `Request failed with status ${response.status}`
      );
    }

    return data;
  }, [router]);

  /* =========================================================
     LOAD NOTIFICATIONS (Speed Optimized & Cached)
  ========================================================= */

  const loadNotifications = useCallback(
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

        const me = await authService.me();
        const user = extractUser(me);
        if (user) setCurrentUser(user);

        const data = await apiRequest("/notifications?limit=100");
        const notificationData = normalizeNotifications(data);

        setNotifications(notificationData);

        cacheRef.current = {
          timestamp: Date.now(),
          data: notificationData,
        };
      } catch (err) {
        console.error("Failed to load notifications:", err);
        setError(err?.message || "Unable to load notifications.");
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiRequest]
  );

  useEffect(() => {
    loadNotifications(false);
  }, [loadNotifications]);

  /* =========================================================
     STATISTICS & FILTERS
  ========================================================= */

  const unreadNotifications = useMemo(() => {
    return notifications.filter((n) => !n.isRead && !n.read).length;
  }, [notifications]);

  const readNotifications = notifications.length - unreadNotifications;

  const filteredNotifications = useMemo(() => {
    let result = [...notifications];

    if (filter === "unread") {
      result = result.filter((n) => !n.isRead && !n.read);
    } else if (filter === "read") {
      result = result.filter((n) => n.isRead || n.read);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((n) => {
        const title = n.title?.toLowerCase() || "";
        const message = n.message?.toLowerCase() || "";
        const type = n.type?.toLowerCase() || "";
        return title.includes(q) || message.includes(q) || type.includes(q);
      });
    }

    return result;
  }, [notifications, filter, search]);

  /* =========================================================
     ACTIONS
  ========================================================= */

  async function handleMarkAsRead(notification) {
    const notificationId = notification?.id || notification?._id;
    if (!notificationId || notification.isRead || notification.read) return;

    try {
      setActionLoading(true);
      await apiRequest(`/notifications/${notificationId}/read`, { method: "PATCH" });

      setNotifications((current) =>
        current.map((item) =>
          (item.id || item._id) === notificationId
            ? { ...item, isRead: true, read: true, readAt: new Date().toISOString() }
            : item
        )
      );
    } catch (err) {
      setError(err?.message || "Unable to mark notification as read.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkAllRead() {
    if (unreadNotifications === 0) return;

    try {
      setActionLoading(true);
      setError("");
      await apiRequest("/notifications/read-all", { method: "PATCH" });

      const now = new Date().toISOString();
      setNotifications((current) =>
        current.map((n) => ({ ...n, isRead: true, read: true, readAt: n.readAt || now }))
      );
    } catch (err) {
      setError(err?.message || "Unable to mark all notifications as read.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteNotification(notificationId) {
    if (!notificationId) return;

    try {
      setActionLoading(true);
      setError("");
      await apiRequest(`/notifications/${notificationId}`, { method: "DELETE" });

      setNotifications((current) =>
        current.filter((n) => (n.id || n._id) !== notificationId)
      );
    } catch (err) {
      setError(err?.message || "Unable to delete notification.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleClearAll() {
    if (readNotifications === 0) return;

    try {
      setActionLoading(true);
      setError("");
      await apiRequest("/notifications/read", { method: "DELETE" });

      setNotifications((current) => current.filter((n) => !n.isRead && !n.read));
    } catch (err) {
      setError(err?.message || "Unable to clear read notifications.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLogout() {
    try {
      setActionLoading(true);
      if (typeof authService?.logout === "function") {
        await authService.logout();
      }
    } catch {} finally {
      setActionLoading(false);
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
            disabled={actionLoading}
            className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-60"
          >
            {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
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
              <p className="text-sm font-bold text-slate-900">Notifications</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => loadNotifications(true)}
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

        {/* CONTENT - FACEBOOK STYLE FEED */}
        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 animate-slideUp">
          <div className="mx-auto w-full max-w-3xl space-y-6">

            {/* HEADER CONTROLS FEED STYLE */}
            <section className="flex flex-col gap-4 rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(45,35,100,0.05)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/80 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-violet-700">
                  <Sparkles size={12} />
                  FEED STREAM
                </div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                  Notifications
                </h1>
                <p className="text-xs text-slate-400">
                  {unreadNotifications} unread notification{unreadNotifications !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={actionLoading || unreadNotifications === 0}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <CheckCheck size={14} className="text-violet-600" /> Mark All Read
                </button>

                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={actionLoading || readNotifications === 0}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 px-3 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
                >
                  <Trash2 size={14} /> Clear Read
                </button>
              </div>
            </section>

            {error && (
              <section className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs font-bold text-rose-700 shadow-sm">
                <div className="flex items-center justify-between">
                  <p>{error}</p>
                  <button onClick={() => setError("")} className="text-rose-400 hover:text-rose-600">
                    <X size={15} />
                  </button>
                </div>
              </section>
            )}

            {/* FILTER & SEARCH TABS */}
            <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1.5 rounded-2xl bg-white p-1.5 border border-slate-200/80 shadow-xs">
                {[
                  { key: "all", label: "All" },
                  { key: "unread", label: `Unread (${unreadNotifications})` },
                  { key: "read", label: "Read" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setFilter(tab.key)}
                    className={`rounded-xl px-4 py-2 text-xs font-bold transition duration-150 ${
                      filter === tab.key
                        ? "bg-violet-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative min-w-0 sm:w-64">
                <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search alerts..."
                  className="h-10 w-full rounded-2xl border border-slate-200/90 bg-white pl-9 pr-8 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </section>

            {/* NOTIFICATIONS FEED STREAM */}
            <section className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]">
              {loading && notifications.length === 0 ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
                  <Loader2 size={28} className="animate-spin text-violet-600" />
                  <p className="mt-3 text-xs font-semibold text-slate-400">Loading your notifications feed...</p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                    <Bell size={22} />
                  </div>
                  <h3 className="mt-3 text-xs font-bold text-slate-900">
                    {search || filter !== "all" ? "No matching notifications" : "No notifications right now"}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 max-w-xs">
                    {search || filter !== "all" ? "Try adjusting your search criteria." : "You are completely up to date with workspace events."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredNotifications.map((notification) => {
                    const Icon = getNotificationIcon(notification.type);
                    const typeLabel = getNotificationTypeLabel(notification.type);
                    const isRead = Boolean(notification.isRead || notification.read);
                    const actionUrl = getNotificationActionUrl(notification);

                    return (
                      <FacebookFeedItem
                        key={notification.id || notification._id}
                        notification={notification}
                        Icon={Icon}
                        typeLabel={typeLabel}
                        onRead={handleMarkAsRead}
                        onDelete={handleDeleteNotification}
                        formatDate={formatNotificationDate}
                        actionLoading={actionLoading}
                        actionUrl={actionUrl}
                        isRead={isRead}
                      />
                    );
                  })}
                </div>
              )}
            </section>

          </div>
        </main>
      </div>
    </div>
  );
}

/* =========================================================
   SUB COMPONENTS (Facebook Feed Style Card)
========================================================= */

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

function FacebookFeedItem({
  notification,
  Icon,
  typeLabel,
  onRead,
  onDelete,
  formatDate,
  actionLoading,
  actionUrl,
  isRead,
}) {
  const notificationId = notification.id || notification._id;

  return (
    <div className={`group relative p-5 sm:p-6 transition hover:bg-slate-50/70 ${!isRead ? "bg-violet-50/40" : "bg-white"}`}>
      <div className="flex items-start gap-4">
        {/* Avatar / Icon badge */}
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-xs ${
          isRead ? "bg-slate-100 text-slate-500" : "bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-violet-600/20"
        }`}>
          <Icon size={19} />
        </div>

        {/* Main Body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                  {typeLabel}
                </span>
                {!isRead && (
                  <span className="flex h-2 w-2 rounded-full bg-violet-600 shadow-sm shadow-violet-600/50" />
                )}
              </div>

              <h3 className={`mt-1.5 text-xs sm:text-sm ${!isRead ? "font-extrabold text-slate-900" : "font-bold text-slate-800"}`}>
                {notification.title || "Workspace Alert"}
              </h3>
            </div>

            <span className="shrink-0 text-[11px] font-medium text-slate-400">
              {formatDate(notification.createdAt)}
            </span>
          </div>

          <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-600">
            {notification.message || "No description provided."}
          </p>

          {/* Action Row */}
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            {!isRead && (
              <button
                type="button"
                onClick={() => onRead(notification)}
                disabled={actionLoading}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
              >
                <Check size={13} /> Mark Read
              </button>
            )}

            {actionUrl && (
              <Link
                href={actionUrl}
                onClick={() => !isRead && onRead(notification)}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-violet-700"
              >
                <ExternalLink size={13} /> View Details
              </Link>
            )}

            <button
              type="button"
              onClick={() => onDelete(notificationId)}
              disabled={actionLoading}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 px-3 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   HELPERS & NORMALIZERS
========================================================= */

function normalizeNotifications(response) {
  const possible =
    response?.notifications ||
    response?.data?.notifications ||
    response?.results ||
    response?.data ||
    [];
  return Array.isArray(possible) ? possible : [];
}

function getNotificationIcon(type) {
  switch (type) {
    case "task": return ClipboardList;
    case "message": return MessageSquare;
    case "leave": return FileText;
    case "appointment": case "event": return CalendarDays;
    case "attendance": return CheckCheck;
    default: return Bell;
  }
}

function getNotificationTypeLabel(type) {
  switch (type) {
    case "task": return "Task";
    case "message": return "Message";
    case "leave": return "Leave Request";
    case "appointment": return "Appointment";
    case "event": return "Event";
    case "attendance": return "Attendance";
    case "mention": return "Mention";
    case "alert": return "Alert";
    case "system": return "System";
    default: return "Notification";
  }
}

function formatNotificationDate(date) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  const now = new Date();
  const diffHours = Math.abs(now - parsed) / 36e5;

  if (diffHours < 24 && parsed.getDate() === now.getDate()) {
    return parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(parsed);
}

function getNotificationActionUrl(notification) {
  if (!notification) return null;
  if (notification.type === "task") return "/user/tasks";
  if (notification.type === "leave") return "/user/leave-requests";
  if (notification.type === "message") return "/user/messages";
  return notification.actionUrl || null;
}

function extractUser(response) {
  return response?.user || response?.data?.user || response?.data || response || null;
}