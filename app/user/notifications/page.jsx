"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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

export default function UserNotificationsPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  /*
   * =========================================================
   * API HELPER
   * =========================================================
   */

  const apiRequest = useCallback(async (endpoint, options = {}) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
          `Request failed with status ${response.status}`
      );
    }

    return data;
  }, []);

  /*
   * =========================================================
   * LOAD NOTIFICATIONS
   * =========================================================
   */

  const loadNotifications = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        setError("");

        const data = await apiRequest(
          "/api/notifications?limit=100"
        );

        const notificationData =
          Array.isArray(data?.notifications)
            ? data.notifications
            : Array.isArray(data?.data)
            ? data.data
            : [];

        setNotifications(notificationData);
      } catch (err) {
        console.error(
          "Failed to load notifications:",
          err
        );

        setError(
          err?.message ||
            "Unable to load notifications."
        );
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [apiRequest]
  );

  /*
   * =========================================================
   * INITIAL LOAD
   * =========================================================
   */

  useEffect(() => {
    loadNotifications(true);
  }, [loadNotifications]);

  /*
   * =========================================================
   * STATISTICS
   * =========================================================
   */

  const totalNotifications = notifications.length;

  const unreadNotifications = notifications.filter(
    (notification) => !notification.isRead
  ).length;

  const readNotifications =
    totalNotifications - unreadNotifications;

  /*
   * =========================================================
   * FILTERED NOTIFICATIONS
   * =========================================================
   */

  const filteredNotifications = useMemo(() => {
    let result = [...notifications];

    if (filter === "unread") {
      result = result.filter(
        (notification) => !notification.isRead
      );
    }

    if (filter === "read") {
      result = result.filter(
        (notification) => notification.isRead
      );
    }

    if (search.trim()) {
      const searchValue =
        search.trim().toLowerCase();

      result = result.filter((notification) => {
        const title =
          notification.title?.toLowerCase() || "";

        const message =
          notification.message?.toLowerCase() || "";

        const type =
          notification.type?.toLowerCase() || "";

        return (
          title.includes(searchValue) ||
          message.includes(searchValue) ||
          type.includes(searchValue)
        );
      });
    }

    return result;
  }, [notifications, filter, search]);

  /*
   * =========================================================
   * MARK SINGLE NOTIFICATION AS READ
   * =========================================================
   */

  async function handleMarkAsRead(notification) {
    const notificationId =
      notification?.id || notification?._id;

    if (!notificationId || notification.isRead) {
      return;
    }

    try {
      setActionLoading(true);

      await apiRequest(
        `/api/notifications/${notificationId}/read`,
        {
          method: "PATCH",
        }
      );

      setNotifications((current) =>
        current.map((item) => {
          const itemId = item.id || item._id;

          return itemId === notificationId
            ? {
                ...item,
                isRead: true,
                readAt: new Date().toISOString(),
              }
            : item;
        })
      );
    } catch (err) {
      console.error(
        "Failed to mark notification as read:",
        err
      );

      setError(
        err?.message ||
          "Unable to mark notification as read."
      );
    } finally {
      setActionLoading(false);
    }
  }

  /*
   * =========================================================
   * MARK ALL AS READ
   * =========================================================
   */

  async function handleMarkAllRead() {
    if (unreadNotifications === 0) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");

      await apiRequest(
        "/api/notifications/read-all",
        {
          method: "PATCH",
        }
      );

      const now = new Date().toISOString();

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          isRead: true,
          readAt:
            notification.readAt || now,
        }))
      );
    } catch (err) {
      console.error(
        "Failed to mark all notifications as read:",
        err
      );

      setError(
        err?.message ||
          "Unable to mark all notifications as read."
      );
    } finally {
      setActionLoading(false);
    }
  }

  /*
   * =========================================================
   * DELETE SINGLE NOTIFICATION
   * =========================================================
   */

  async function handleDeleteNotification(notificationId) {
    if (!notificationId) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");

      await apiRequest(
        `/api/notifications/${notificationId}`,
        {
          method: "DELETE",
        }
      );

      setNotifications((current) =>
        current.filter((notification) => {
          const id =
            notification.id ||
            notification._id;

          return id !== notificationId;
        })
      );
    } catch (err) {
      console.error(
        "Failed to delete notification:",
        err
      );

      setError(
        err?.message ||
          "Unable to delete notification."
      );
    } finally {
      setActionLoading(false);
    }
  }

  /*
   * =========================================================
   * DELETE READ NOTIFICATIONS
   * =========================================================
   */

  async function handleClearAll() {
    if (readNotifications === 0) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");

      await apiRequest(
        "/api/notifications/read",
        {
          method: "DELETE",
        }
      );

      setNotifications((current) =>
        current.filter(
          (notification) => !notification.isRead
        )
      );
    } catch (err) {
      console.error(
        "Failed to clear notifications:",
        err
      );

      setError(
        err?.message ||
          "Unable to clear read notifications."
      );
    } finally {
      setActionLoading(false);
    }
  }

  /*
   * =========================================================
   * LOGOUT
   * =========================================================
   */

  async function handleLogout() {
    try {
      setActionLoading(true);

      await apiRequest("/api/auth/logout", {
        method: "POST",
      });
    } catch (err) {
      console.error(
        "Logout request failed:",
        err
      );
    } finally {
      setActionLoading(false);
      router.push("/login");
      router.refresh();
    }
  }

  /*
   * =========================================================
   * NAVIGATION / HELPERS
   * =========================================================
   */

  function clearSearch() {
    setSearch("");
  }

  function getNotificationIcon(type) {
    switch (type) {
      case "task":
        return ClipboardList;

      case "message":
        return MessageSquare;

      case "leave":
        return FileText;

      case "appointment":
        return CalendarDays;

      case "event":
        return CalendarDays;

      case "attendance":
        return CheckCheck;

      case "call":
        return Activity;

      default:
        return Bell;
    }
  }

  function getNotificationTypeLabel(type) {
    switch (type) {
      case "task":
        return "Task";

      case "message":
        return "Message";

      case "leave":
        return "Leave Request";

      case "appointment":
        return "Appointment";

      case "event":
        return "Event";

      case "attendance":
        return "Attendance";

      case "call":
        return "Call";

      case "mention":
        return "Mention";

      case "alert":
        return "Alert";

      case "system":
        return "System";

      default:
        return "Notification";
    }
  }

  function formatNotificationDate(date) {
    if (!date) {
      return "";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(parsedDate);
  }

  function getNotificationActionUrl(notification) {
    if (!notification) {
      return null;
    }

    if (notification.type === "task") {
      return "/user/tasks";
    }

    return notification.actionUrl || null;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
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
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#171B3A] shadow-xl transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        {/* Logo */}

        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-sm">
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
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-300">
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

              <p className="truncate text-xs font-medium text-slate-300">
                User Account
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={actionLoading}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionLoading ? (
              <Loader2
                size={17}
                className="animate-spin"
              />
            ) : (
              <LogOut size={17} />
            )}

            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* =====================================================
          MAIN AREA
      ===================================================== */}

      <div className="lg:pl-64">
        {/* ===================================================
            TOP BAR
        =================================================== */}

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
                Notifications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                loadNotifications(false)
              }
              disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#64748B] transition hover:bg-slate-100 hover:text-[#26344D] disabled:opacity-50"
              aria-label="Refresh notifications"
              title="Refresh"
            >
              <RefreshCw
                size={17}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />
            </button>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EEF4FF] text-xs font-bold text-[#2563EB]">
              U
            </div>
          </div>
        </header>

        {/* ===================================================
            PAGE CONTENT
        ================================================   */}

        <main className="min-h-[calc(100vh-4rem)] p-5 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-none space-y-6">
            {/* Heading */}

            <section>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#2563EB]">
                    WORKSPACE
                  </p>

                  <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
                    Notifications
                  </h1>

                  <p className="mt-2 text-sm text-[#64748B]">
                    Stay updated with tasks, leave
                    requests, messages, and other
                    workspace activity.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={
                      actionLoading ||
                      unreadNotifications === 0
                    }
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-[#26344D] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      <CheckCheck size={16} />
                    )}

                    Mark All Read
                  </button>

                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={
                      actionLoading ||
                      readNotifications === 0
                    }
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                    Clear Read
                  </button>
                </div>
              </div>
            </section>

            {/* Error */}

            {error && (
              <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-red-700">
                      Unable to load notifications
                    </p>

                    <p className="mt-1 text-xs leading-5 text-red-600">
                      {error}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setError("")}
                    className="text-red-500 hover:text-red-700"
                    aria-label="Close error"
                  >
                    <X size={17} />
                  </button>
                </div>
              </section>
            )}

            {/* =================================================
                NOTIFICATION SUMMARY
            ================================================= */}

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <NotificationStat
                icon={Bell}
                label="Total"
                value={totalNotifications}
                description="Total notifications"
              />

              <NotificationStat
                icon={Check}
                label="Read"
                value={readNotifications}
                description="Notifications already read"
              />

              <NotificationStat
                icon={Bell}
                label="Unread"
                value={unreadNotifications}
                description="Notifications waiting for you"
              />
            </section>

            {/* =================================================
                NOTIFICATIONS CARD
            ================================================= */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Header */}

              <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                      <Bell size={19} />
                    </div>

                    <div>
                      <h2 className="text-base font-bold text-[#171B3A]">
                        Your Notifications
                      </h2>

                      <p className="mt-1 text-sm text-[#64748B]">
                        Notifications generated by your
                        workspace.
                      </p>
                    </div>
                  </div>

                  {/* Search + Filter */}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative">
                      <input
                        type="text"
                        value={search}
                        onChange={(event) =>
                          setSearch(
                            event.target.value
                          )
                        }
                        placeholder="Search notifications..."
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 sm:w-64"
                      />

                      {search && (
                        <button
                          type="button"
                          onClick={clearSearch}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#26344D]"
                          aria-label="Clear search"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>

                    <select
                      value={filter}
                      onChange={(event) =>
                        setFilter(
                          event.target.value
                        )
                      }
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#26344D] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                    >
                      <option value="all">
                        All
                      </option>

                      <option value="unread">
                        Unread
                      </option>

                      <option value="read">
                        Read
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Loading */}

              {loading ? (
                <div className="flex min-h-[390px] flex-col items-center justify-center px-6 py-12">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                    <Loader2
                      size={28}
                      className="animate-spin"
                    />
                  </div>

                  <h3 className="mt-5 text-base font-bold text-[#171B3A]">
                    Loading notifications
                  </h3>

                  <p className="mt-2 text-sm text-[#64748B]">
                    Getting your latest workspace
                    notifications...
                  </p>
                </div>
              ) : filteredNotifications.length ===
                0 ? (
                /* Empty State */

                <div className="flex min-h-[390px] flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                    <Bell size={28} />
                  </div>

                  <h3 className="mt-5 text-base font-bold text-[#171B3A]">
                    {search ||
                    filter !== "all"
                      ? "No matching notifications"
                      : "No notifications"}
                  </h3>

                  <p className="mt-2 max-w-md text-sm leading-6 text-[#64748B]">
                    {search ||
                    filter !== "all"
                      ? "Try changing your search or notification filter."
                      : "New notifications about assigned tasks, task updates, leave requests, messages, and other workspace activity will appear here."}
                  </p>
                </div>
              ) : (
                /* Notification List */

                <div className="divide-y divide-slate-100">
                  {filteredNotifications.map(
                    (notification) => {
                      const Icon =
                        getNotificationIcon(
                          notification.type
                        );

                      const typeLabel =
                        getNotificationTypeLabel(
                          notification.type
                        );

                      return (
                        <NotificationItem
                          key={
                            notification.id ||
                            notification._id
                          }
                          notification={
                            notification
                          }
                          Icon={Icon}
                          typeLabel={typeLabel}
                          onRead={
                            handleMarkAsRead
                          }
                          onDelete={
                            handleDeleteNotification
                          }
                          formatDate={
                            formatNotificationDate
                          }
                          actionLoading={
                            actionLoading
                          }
                          actionUrl={
                            getNotificationActionUrl(
                              notification
                            )
                          }
                        />
                      );
                    }
                  )}
                </div>
              )}
            </section>

            {/* =================================================
                NOTIFICATION TYPES
            ================================================= */}

            <section>
              <h2 className="mb-4 text-base font-bold text-[#171B3A]">
                Notification Types
              </h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <NotificationTypeCard
                  icon={ClipboardList}
                  title="Task Updates"
                  description="Notifications when tasks are assigned, updated, completed, or reassigned."
                />

                <NotificationTypeCard
                  icon={FileText}
                  title="Leave Requests"
                  description="Updates when your leave request is submitted, approved, or rejected."
                />

                <NotificationTypeCard
                  icon={MessageSquare}
                  title="Messages"
                  description="Notifications related to new conversations and messages."
                />

                <NotificationTypeCard
                  icon={Activity}
                  title="Workspace Activity"
                  description="Important activity and updates related to your workspace."
                />
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

/* =========================================================
   SIDEBAR NAVIGATION
========================================================= */

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

/* =========================================================
   NOTIFICATION STAT
========================================================= */

function NotificationStat({
  icon: Icon,
  label,
  value,
  description,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#64748B]">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold text-[#171B3A]">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
          <Icon size={19} />
        </div>
      </div>

      <p className="mt-4 text-xs text-[#64748B]">
        {description}
      </p>
    </div>
  );
}

/* =========================================================
   NOTIFICATION ITEM
========================================================= */

function NotificationItem({
  notification,
  Icon,
  typeLabel,
  onRead,
  onDelete,
  formatDate,
  actionLoading,
  actionUrl,
}) {
  const notificationId =
    notification.id || notification._id;

  return (
    <div
      className={`group px-5 py-5 transition sm:px-6 ${
        notification.isRead
          ? "bg-white hover:bg-slate-50"
          : "bg-[#EEF4FF]/40 hover:bg-[#EEF4FF]/70"
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            notification.isRead
              ? "bg-slate-100 text-slate-500"
              : "bg-[#EEF4FF] text-[#2563EB]"
          }`}
        >
          <Icon size={19} />
        </div>

        {/* Content */}

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  className={`text-sm ${
                    notification.isRead
                      ? "font-semibold text-[#26344D]"
                      : "font-bold text-[#171B3A]"
                  }`}
                >
                  {notification.title ||
                    "Notification"}
                </h3>

                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {typeLabel}
                </span>

                {!notification.isRead && (
                  <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
                )}
              </div>

              <p className="mt-2 text-sm leading-6 text-[#64748B]">
                {notification.message ||
                  "No notification message available."}
              </p>
            </div>

            <p className="shrink-0 text-[11px] font-medium text-slate-400">
              {formatDate(
                notification.createdAt
              )}
            </p>
          </div>

          {/* Actions */}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!notification.isRead && (
              <button
                type="button"
                onClick={() =>
                  onRead(notification)
                }
                disabled={actionLoading}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 text-[11px] font-bold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check size={14} />
                Mark Read
              </button>
            )}

            {actionUrl && (
              <Link
                href={actionUrl}
                onClick={() =>
                  !notification.isRead &&
                  onRead(notification)
                }
                className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-[#26344D] transition hover:bg-slate-50"
              >
                View
              </Link>
            )}

            <button
              type="button"
              onClick={() =>
                onDelete(notificationId)
              }
              disabled={actionLoading}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={13} />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   NOTIFICATION TYPE CARD
========================================================= */

function NotificationTypeCard({
  icon: Icon,
  title,
  description,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
          <Icon size={19} />
        </div>

        <div>
          <h3 className="text-sm font-bold text-[#171B3A]">
            {title}
          </h3>

          <p className="mt-1 text-xs leading-5 text-[#64748B]">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}