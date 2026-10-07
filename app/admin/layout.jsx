"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
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
  AlertCircle,
  CalendarDays,
  Phone,
  Clock3,
} from "lucide-react";

import { authService } from "@/services/authService";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.localpro1.net/api";

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
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

let globalAdminUserCache = {
  user: null,
  loaded: false,
};

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

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  const mountedRef = useRef(false);
  const checkingAuthRef = useRef(false);
  const redirectingRef = useRef(false);

  const notificationRef = useRef(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [loading, setLoading] = useState(
    !globalAdminUserCache.loaded
  );

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [currentUser, setCurrentUser] =
    useState(
      globalAdminUserCache.user
    );

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

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (globalAdminUserCache.loaded) {
      setLoading(false);
      return;
    }

    if (checkingAuthRef.current) {
      return;
    }

    let cancelled = false;
    checkingAuthRef.current = true;

    const checkAdmin = async () => {
      try {
        const response = await authService.me();

        if (cancelled || !mountedRef.current) {
          return;
        }

        const user =
          response?.user ||
          response?.data ||
          response;

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

        const formattedUser = {
          ...user,
          avatar: user?.avatar || null,
        };

        globalAdminUserCache = {
          user: formattedUser,
          loaded: true,
        };

        setCurrentUser(formattedUser);
      } catch (error) {
        if (
          !cancelled &&
          mountedRef.current
        ) {
          console.error(
            "Admin authentication check failed:",
            error
          );

          redirectToLogin();
        }
      } finally {
        checkingAuthRef.current = false;

        if (
          !cancelled &&
          mountedRef.current
        ) {
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
    globalAdminUserCache = {
      user: null,
      loaded: false,
    };

    if (redirectingRef.current) {
      return;
    }

    redirectingRef.current = true;

    try {
      if (
        typeof authService.clearToken ===
        "function"
      ) {
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
      if (
        typeof authService.logout ===
        "function"
      ) {
        await authService.logout();
      }
    } catch (error) {
      console.error(
        "Admin logout error:",
        error
      );
    } finally {
      globalAdminUserCache = {
        user: null,
        loaded: false,
      };

      try {
        if (
          typeof authService.clearToken ===
          "function"
        ) {
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
    if (loading) {
      return;
    }

    loadNotifications(false);

    const interval =
      setInterval(() => {
        loadNotifications(false);
      }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [
    loading,
    loadNotifications,
  ]);

  // ============================================================
  // LOAD WHEN OPEN
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
  // OUTSIDE CLICK
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
  // MARK SINGLE AS READ
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
          current.map(
            (notification) => ({
              ...notification,
              isRead: true,
            })
          )
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

  const handleNotificationClick =
    async (notification) => {
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
          actionUrl.startsWith(
            "http://"
          ) ||
          actionUrl.startsWith(
            "https://"
          )
        ) {
          window.location.href =
            actionUrl;
          return;
        }

        if (
          actionUrl.startsWith("/")
        ) {
          router.push(actionUrl);
        }
      }
    };

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#F8FAFC]">
        <Loader2
          size={30}
          className="animate-spin text-[#2563EB]"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#F8FAFC]">

      {/* MOBILE OVERLAY */}

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

      {/* SIDEBAR */}

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
            onClick={() =>
              setSidebarOpen(false)
            }
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition hover:bg-white/10 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        {/* NAVIGATION */}

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

        {/* SIDEBAR USER */}

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

      {/* MAIN AREA */}

      <div className="min-h-screen w-full lg:pl-64">

        {/* HEADER */}

        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-6 lg:px-8">

          {/* LEFT */}

          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
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

          {/* RIGHT */}

          <div className="flex items-center gap-2 sm:gap-4">

            {/* ==================================================
                NOTIFICATION BUTTON
            ================================================== */}

            <div
              ref={notificationRef}
              className="relative z-[100]"
            >
              <button
                type="button"
                onClick={() =>
                  setNotificationsOpen(
                    (current) =>
                      !current
                  )
                }
                className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 ${
                  notificationsOpen
                    ? "border-[#2563EB] bg-[#EEF4FF] text-[#2563EB]"
                    : "border-slate-200 bg-white text-[#475569] hover:border-[#2563EB] hover:bg-[#EEF4FF] hover:text-[#2563EB]"
                }`}
                aria-label="Notifications"
                aria-expanded={
                  notificationsOpen
                }
              >
                <Bell
                  size={20}
                  strokeWidth={2}
                />

                {unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-white bg-[#2563EB] px-1 text-[9px] font-bold leading-none text-white shadow-sm">
                    {unreadCount > 99
                      ? "99+"
                      : unreadCount}
                  </span>
                )}
              </button>

              {/* ==================================================
                  NOTIFICATION DROPDOWN
              ================================================== */}

              {notificationsOpen && (
                <div className="absolute right-0 top-[50px] z-[200] w-[380px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">

                  {/* DROPDOWN HEADER */}

                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
                    <div>
                      <h3 className="text-sm font-bold text-[#171B3A]">
                        Notifications
                      </h3>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {unreadCount > 0
                          ? `${unreadCount} unread notification${
                              unreadCount !==
                              1
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

                  {/* LIST */}

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
                              {/* ICON */}

                              <div
                                className={`relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                  !notification.isRead
                                    ? "bg-[#EEF4FF] text-[#2563EB]"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                <Icon size={18} />

                                {!notification.isRead && (
                                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#2563EB]" />
                                )}
                              </div>

                              {/* CONTENT */}

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
                          notifications
                          right now.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* FOOTER */}

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

            {/* PROFILE */}

            <ProfileAvatar
              user={currentUser}
              size="header"
            />
          </div>
        </header>

        {/* CHILD PAGE */}

        <main className="min-h-[calc(100vh-4rem)] w-full">
          <div className="w-full max-w-none">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ============================================================
   PROFILE AVATAR
============================================================ */

function ProfileAvatar({
  user,
  size = "header",
}) {
  const avatar = user?.avatar;
  const name =
    user?.name || "Administrator";

  const firstLetter =
    name.trim().charAt(0).toUpperCase() ||
    "A";

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

/* ============================================================
   PAGE TITLE
============================================================ */

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

  if (pathname.startsWith("/admin/leave-requests")) {
    return "Leave Requests";
  }

  if (pathname.startsWith("/admin/conversations")) {
    return "Conversations";
  }

  if (pathname.startsWith("/admin/settings")) {
    return "Settings";
  }

  return "Admin Workspace";
}