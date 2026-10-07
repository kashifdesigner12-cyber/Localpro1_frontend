"use client";

import {
  Bell,
  Menu,
  Search,
  UserCircle,
  Check,
  X,
  Loader2,
  ClipboardList,
  MessageSquare,
  AlertCircle,
  CalendarDays,
  Phone,
  Clock3,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.localpro1.net/api";

const PAGE_TITLES = {
  "/admin": "Dashboard",
  "/admin/users": "Users",
  "/admin/tasks": "Tasks",
  "/admin/attendance": "Attendance",
  "/admin/leave-requests": "Leave Requests",
  "/admin/conversations": "Conversations",
  "/admin/settings": "Settings",
};

function getPageTitle(pathname) {
  if (!pathname) return "Dashboard";

  // Exact page match first
  if (PAGE_TITLES[pathname]) {
    return PAGE_TITLES[pathname];
  }

  // Handle nested pages
  if (pathname.startsWith("/admin/users/")) {
    return "Users";
  }

  if (pathname.startsWith("/admin/tasks/")) {
    return "Tasks";
  }

  if (pathname.startsWith("/admin/attendance/")) {
    return "Attendance";
  }

  if (pathname.startsWith("/admin/leave-requests/")) {
    return "Leave Requests";
  }

  if (pathname.startsWith("/admin/conversations/")) {
    return "Conversations";
  }

  if (pathname.startsWith("/admin/settings/")) {
    return "Settings";
  }

  return "Dashboard";
}

function getAuthHeaders() {
  if (typeof window === "undefined") {
    return {};
  }

  const tokenKeys = [
    "token",
    "accessToken",
    "authToken",
  ];

  let token = null;

  for (const key of tokenKeys) {
    const value = localStorage.getItem(key);

    if (value) {
      token = value;
      break;
    }
  }

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

function getNotificationIcon(type) {
  switch (type) {
    case "task":
      return ClipboardList;

    case "message":
    case "mention":
      return MessageSquare;

    case "leave":
      return CalendarDays;

    case "appointment":
    case "event":
      return CalendarDays;

    case "call":
      return Phone;

    case "attendance":
      return Clock3;

    case "alert":
      return AlertCircle;

    default:
      return Bell;
  }
}

function formatNotificationTime(dateValue) {
  if (!dateValue) {
    return "";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();

  const difference =
    now.getTime() - date.getTime();

  const seconds = Math.floor(
    difference / 1000
  );

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(
    seconds / 60
  );

  if (minutes < 60) {
    return `${minutes} minute${
      minutes !== 1 ? "s" : ""
    } ago`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours} hour${
      hours !== 1 ? "s" : ""
    } ago`;
  }

  const days = Math.floor(
    hours / 24
  );

  if (days < 7) {
    return `${days} day${
      days !== 1 ? "s" : ""
    } ago`;
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year:
        date.getFullYear() !==
        now.getFullYear()
          ? "numeric"
          : undefined,
    }
  );
}

export default function DashboardHeader({
  title = "",
  subtitle = "",
  onMenuClick,
  userName = "User",
  userRole = "User",
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

  const [notifications, setNotifications] =
    useState([]);

  const [unreadCount, setUnreadCount] =
    useState(0);

  const [notificationsLoading, setNotificationsLoading] =
    useState(false);

  const [markingAllRead, setMarkingAllRead] =
    useState(false);

  const notificationRef =
    useRef(null);

  const currentPageTitle =
    title || getPageTitle(pathname);

  // ============================================================
  // LOAD NOTIFICATIONS
  // ============================================================

  const loadNotifications = useCallback(
    async (showLoader = false) => {
      try {
        if (showLoader) {
          setNotificationsLoading(true);
        }

        const response = await fetch(
          `${API_URL}/notifications?limit=20`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              ...getAuthHeaders(),
            },
            credentials: "include",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to load notifications: ${response.status}`
          );
        }

        const data =
          await response.json();

        if (data?.success === false) {
          throw new Error(
            data?.message ||
              "Unable to load notifications."
          );
        }

        const notificationList =
          Array.isArray(
            data?.notifications
          )
            ? data.notifications
            : Array.isArray(data?.data)
            ? data.data
            : [];

        setNotifications(
          notificationList
        );

        setUnreadCount(
          Number(
            data?.unreadCount
          ) || 0
        );
      } catch (error) {
        console.error(
          "Load notifications error:",
          error
        );
      } finally {
        if (showLoader) {
          setNotificationsLoading(false);
        }
      }
    },
    []
  );

  // ============================================================
  // INITIAL LOAD + AUTO REFRESH
  // ============================================================

  useEffect(() => {
    loadNotifications(false);

    const interval =
      setInterval(() => {
        loadNotifications(false);
      }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [loadNotifications]);

  // ============================================================
  // LOAD WHEN DROPDOWN OPENS
  // ============================================================

  useEffect(() => {
    if (notificationsOpen) {
      loadNotifications(true);
    }
  }, [
    notificationsOpen,
    loadNotifications,
  ]);

  // ============================================================
  // CLOSE DROPDOWN OUTSIDE CLICK
  // ============================================================

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(
          event.target
        )
      ) {
        setNotificationsOpen(false);
      }
    }

    if (notificationsOpen) {
      document.addEventListener(
        "mousedown",
        handleClickOutside
      );
    }

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, [notificationsOpen]);

  // ============================================================
  // MARK SINGLE NOTIFICATION AS READ
  // ============================================================

  const markAsRead = async (
    notification
  ) => {
    if (!notification?.id) {
      return;
    }

    const notificationId =
      notification.id;

    const wasUnread =
      !notification.isRead;

    // Optimistic UI update
    setNotifications((current) =>
      current.map((item) =>
        item.id === notificationId
          ? {
              ...item,
              isRead: true,
            }
          : item
      )
    );

    if (wasUnread) {
      setUnreadCount((current) =>
        Math.max(0, current - 1)
      );
    }

    try {
      const response = await fetch(
        `${API_URL}/notifications/${notificationId}/read`,
        {
          method: "PATCH",
          headers: {
            Accept:
              "application/json",
            ...getAuthHeaders(),
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to mark notification as read: ${response.status}`
        );
      }

      const data =
        await response.json();

      if (data?.success === false) {
        throw new Error(
          data?.message ||
            "Unable to mark notification as read."
        );
      }
    } catch (error) {
      console.error(
        "Mark notification as read error:",
        error
      );

      // Restore UI if backend update failed
      if (wasUnread) {
        setNotifications((current) =>
          current.map((item) =>
            item.id === notificationId
              ? {
                  ...item,
                  isRead: false,
                }
              : item
          )
        );

        setUnreadCount((current) =>
          current + 1
        );
      }
    }
  };

  // ============================================================
  // MARK ALL AS READ
  // ============================================================

  const markAllAsRead = async () => {
    if (
      markingAllRead ||
      unreadCount <= 0
    ) {
      return;
    }

    try {
      setMarkingAllRead(true);

      const response = await fetch(
        `${API_URL}/notifications/read-all`,
        {
          method: "PATCH",
          headers: {
            Accept:
              "application/json",
            ...getAuthHeaders(),
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to mark all notifications as read: ${response.status}`
        );
      }

      const data =
        await response.json();

      if (data?.success === false) {
        throw new Error(
          data?.message ||
            "Unable to mark all notifications as read."
        );
      }

      setNotifications(
        (current) =>
          current.map((notification) => ({
            ...notification,
            isRead: true,
          }))
      );

      setUnreadCount(0);
    } catch (error) {
      console.error(
        "Mark all notifications as read error:",
        error
      );
    } finally {
      setMarkingAllRead(false);
    }
  };

  // ============================================================
  // NOTIFICATION CLICK
  // ============================================================

  const handleNotificationClick = async (
    notification
  ) => {
    if (!notification) {
      return;
    }

    await markAsRead(
      notification
    );

    const actionUrl =
      notification.actionUrl;

    if (
      actionUrl &&
      typeof actionUrl === "string"
    ) {
      setNotificationsOpen(false);

      if (
        actionUrl.startsWith("http://") ||
        actionUrl.startsWith("https://")
      ) {
        window.location.href =
          actionUrl;
        return;
      }

      if (actionUrl.startsWith("/")) {
        router.push(actionUrl);
      }
    }
  };

  return (
    <header className="sticky top-0 z-30 h-[82px] border-b border-slate-200 bg-white">
      <div className="flex h-full items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
        {/* LEFT SIDE */}
        <div className="flex min-w-0 items-center gap-3">
          {/* Mobile Menu */}
          <button
            type="button"
            onClick={onMenuClick}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={21} />
          </button>

          {/* PAGE TITLE */}
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-[#171B3A]">
              {currentPageTitle}
            </h2>

            {subtitle && (
              <p className="hidden truncate text-sm text-[#64748B] sm:block">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Search */}
          <button
            type="button"
            className="hidden h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 sm:flex"
            aria-label="Search"
          >
            <Search size={19} />
          </button>

          {/* ==================================================
              NOTIFICATIONS
          ================================================== */}
          <div
            className="relative"
            ref={notificationRef}
          >
            <button
              type="button"
              onClick={() =>
                setNotificationsOpen(
                  (current) => !current
                )
              }
              className={`relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition ${
                notificationsOpen
                  ? "bg-[#EEF4FF] text-[#2563EB]"
                  : "hover:bg-slate-100"
              }`}
              aria-label="Notifications"
              aria-expanded={
                notificationsOpen
              }
            >
              <Bell size={19} />

              {/* Unread Dot */}
              {unreadCount > 0 && (
                <>
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#2563EB]" />

                  <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#2563EB] px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99
                      ? "99+"
                      : unreadCount}
                  </span>
                </>
              )}
            </button>

            {/* ==================================================
                NOTIFICATION DROPDOWN
            ================================================== */}
            {notificationsOpen && (
              <div className="absolute right-0 top-[52px] z-50 w-[380px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
                {/* Dropdown Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#171B3A]">
                      Notifications
                    </h3>

                    <p className="mt-0.5 text-xs text-slate-500">
                      {unreadCount > 0
                        ? `${unreadCount} unread notification${
                            unreadCount !== 1
                              ? "s"
                              : ""
                          }`
                        : "You're all caught up"}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={
                          markAllAsRead
                        }
                        disabled={
                          markingAllRead
                        }
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#2563EB] transition hover:bg-[#EEF4FF] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {markingAllRead ? (
                          <Loader2
                            size={14}
                            className="animate-spin"
                          />
                        ) : (
                          <Check
                            size={14}
                          />
                        )}

                        Mark all read
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setNotificationsOpen(
                          false
                        )
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                      aria-label="Close notifications"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Notifications List */}
                <div className="max-h-[420px] overflow-y-auto overscroll-contain">
                  {notificationsLoading ? (
                    <div className="flex items-center justify-center px-6 py-12">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2
                          size={18}
                          className="animate-spin text-[#2563EB]"
                        />

                        Loading notifications...
                      </div>
                    </div>
                  ) : notifications.length >
                    0 ? (
                    notifications.map(
                      (notification) => {
                        const Icon =
                          getNotificationIcon(
                            notification.type
                          );

                        return (
                          <button
                            key={
                              notification.id
                            }
                            type="button"
                            onClick={() =>
                              handleNotificationClick(
                                notification
                              )
                            }
                            className={`flex w-full gap-3 border-b border-slate-100 px-4 py-4 text-left transition last:border-b-0 hover:bg-slate-50 ${
                              !notification.isRead
                                ? "bg-[#F8FAFF]"
                                : "bg-white"
                            }`}
                          >
                            {/* Icon */}
                            <div
                              className={`relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                !notification.isRead
                                  ? "bg-[#EEF4FF] text-[#2563EB]"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              <Icon
                                size={18}
                              />

                              {!notification.isRead && (
                                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#2563EB]" />
                              )}
                            </div>

                            {/* Content */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p
                                  className={`line-clamp-1 text-sm ${
                                    !notification.isRead
                                      ? "font-bold text-[#171B3A]"
                                      : "font-semibold text-slate-700"
                                  }`}
                                >
                                  {
                                    notification.title
                                  }
                                </p>

                                {!notification.isRead && (
                                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#2563EB]" />
                                )}
                              </div>

                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                {
                                  notification.message
                                }
                              </p>

                              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                                <Clock3
                                  size={11}
                                />

                                {formatNotificationTime(
                                  notification.createdAt
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      }
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <Bell size={24} />
                      </div>

                      <p className="mt-3 text-sm font-semibold text-slate-700">
                        No notifications
                      </p>

                      <p className="mt-1 max-w-[240px] text-xs leading-5 text-slate-400">
                        You don't have any
                        notifications right
                        now.
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                {notifications.length >
                  0 && (
                  <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3">
                    <p className="text-center text-[11px] font-medium text-slate-400">
                      Showing your latest
                      notifications
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="hidden h-8 w-px bg-slate-200 sm:block" />

          {/* User */}
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF4FF] text-[#2563EB]">
              <UserCircle size={22} />
            </div>

            <div className="hidden min-w-0 md:block">
              <p className="max-w-[140px] truncate text-sm font-semibold text-[#26344D]">
                {userName}
              </p>

              <p className="text-xs capitalize text-[#64748B]">
                {userRole}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}