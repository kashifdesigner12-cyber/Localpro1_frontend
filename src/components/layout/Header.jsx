import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  ChevronDown,
  UserRound,
  Settings,
  LogOut,
  Menu,
  CheckCheck,
  X,
  LoaderCircle,
  Check,
} from "lucide-react";
import { io } from "socket.io-client";
import api from "../../services/api";

export default function Header({
  user,
  role = "admin",
  onMenuClick,
  onLogout,
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState("");

  const headerRef = useRef(null);
  const previousIdsRef = useRef(null);
  const audioContextRef = useRef(null);
  const soundEnabledRef = useRef(true);
  const navigate = useNavigate();

  const isAdmin = ["admin", "manager"].includes(role);

  const displayName =
    user?.username || user?.name || (isAdmin ? "Admin" : "User");

  const profilePicture = user?.profilePicture || "";

  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  const tasksPath = isAdmin ? "/admin/tasks" : "/user/tasks";
  const attendancePath = isAdmin
    ? "/admin/attendance"
    : "/user/attendance";
  const settingsPath = isAdmin ? "/admin/settings" : "/user/settings";
  const profilePath = isAdmin ? "/admin/profile" : "/user/profile";

  const playBell = useCallback(async () => {
    if (!soundEnabledRef.current) return;

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return;

      if (
        !audioContextRef.current ||
        audioContextRef.current.state === "closed"
      ) {
        audioContextRef.current = new AudioContextClass();
      }

      const context = audioContextRef.current;

      if (context.state !== "running") {
        await context.resume();
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startTime = context.currentTime;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, startTime);
      oscillator.frequency.setValueAtTime(1174, startTime + 0.12);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.025);
      gain.gain.setValueAtTime(0.12, startTime + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.5);

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.51);
    } catch (error) {
      console.warn("Notification sound could not play:", error);
    }
  }, []);

  // Unlock audio after the user's first interaction with the page.
  useEffect(() => {
    const unlockAudio = async () => {
      try {
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) return;

        if (
          !audioContextRef.current ||
          audioContextRef.current.state === "closed"
        ) {
          audioContextRef.current = new AudioContextClass();
        }

        if (audioContextRef.current.state !== "running") {
          await audioContextRef.current.resume();
        }
      } catch {
        // Audio will retry on a later user interaction.
      }
    };

    document.addEventListener("pointerdown", unlockAudio, {
      once: true,
    });
    document.addEventListener("keydown", unlockAudio, {
      once: true,
    });

    return () => {
      document.removeEventListener("pointerdown", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  // Optimized fast non-blocking notification loader
  const loadNotifications = useCallback(
    async ({ playSound: shouldPlaySound = false, background = false } = {}) => {
      if (!background) setLoadingNotifications(true);
      setNotificationError("");

      try {
        const response = await api.get("/notifications?limit=20");
        const result = response.data;
        const list = Array.isArray(result.data) ? result.data : [];

        if (previousIdsRef.current !== null && shouldPlaySound) {
          const knownIds = previousIdsRef.current;

          const hasNewUnread = list.some(
            (item) =>
              !item.isRead && !knownIds.has(String(item._id))
          );

          if (hasNewUnread) playBell();
        }

        previousIdsRef.current = new Set(
          list.map((item) => String(item._id))
        );

        setNotifications(list);
        setUnreadCount(Number(result.unreadCount) || 0);
      } catch (error) {
        setNotificationError(
          error.message || "Unable to load notifications."
        );
      } finally {
        if (!background) setLoadingNotifications(false);
      }
    },
    [playBell]
  );

  // Lazy load notifications on demand rather than heavy blocking on mount
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadNotifications({ background: true });
    }, 1000);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadNotifications({ playSound: true, background: true });
      }
    }, 60000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [loadNotifications]);

  // Instant notifications through persistent Socket.IO connection.
  useEffect(() => {
    const apiBaseUrl =
      api.defaults.baseURL || "http://localhost:5000/api";

    const socketUrl = apiBaseUrl.replace(/\/api\/?$/, "");

    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on("notification:new", (notification) => {
      if (!notification?._id) return;

      const notificationId = String(notification._id);
      const knownIds = previousIdsRef.current;

      if (knownIds?.has(notificationId)) return;

      if (previousIdsRef.current === null) {
        previousIdsRef.current = new Set();
      }

      previousIdsRef.current.add(notificationId);

      setNotifications((current) => {
        if (
          current.some(
            (item) => String(item._id) === notificationId
          )
        ) {
          return current;
        }

        return [notification, ...current].slice(0, 20);
      });

      if (!notification.isRead) {
        setUnreadCount((count) => count + 1);
        playBell();
      }

      if (["task", "attendance"].includes(notification.type)) {
        window.dispatchEvent(
          new CustomEvent("localpro:notification-toast", {
            detail: notification,
          })
        );
      }
    });

    return () => {
      socket.off("notification:new");
      socket.disconnect();
    };
  }, [playBell]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        headerRef.current &&
        !headerRef.current.contains(event.target)
      ) {
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const handleLogout = () => {
    setProfileOpen(false);

    if (onLogout) {
      onLogout();
    } else {
      navigate("/login");
    }
  };

  const handleNotificationClick = async (notification) => {
    setNotificationsOpen(false);

    if (!notification.isRead) {
      setNotifications((current) =>
        current.map((item) =>
          String(item._id) === String(notification._id)
            ? { ...item, isRead: true }
            : item
        )
      );

      setUnreadCount((count) => Math.max(0, count - 1));

      try {
        await api.patch(`/notifications/${notification._id}/read`);
      } catch {
        loadNotifications({ background: true });
      }
    }

    const title = notification.title?.toLowerCase() || "";
    const message = notification.message?.toLowerCase() || "";

    const isTaskNotification =
      notification.type === "task" ||
      title.includes("task assigned") ||
      title.includes("new task") ||
      title.includes("task status") ||
      message.includes("assigned:");

    if (isTaskNotification) {
      navigate(tasksPath);
      return;
    }

    const link = notification.link?.trim();

    if (link && link.startsWith("/") && !link.startsWith("//")) {
      if (link === "/tasks" || link.startsWith("/tasks?")) {
        navigate(tasksPath);
        return;
      }

      if (link === "/attendance") {
        navigate(attendancePath);
        return;
      }

      navigate(link);
      return;
    }

    if (notification.type === "attendance") {
      navigate(attendancePath);
    }
  };

  const handleMarkAllRead = async () => {
    if (!unreadCount) return;

    try {
      await api.patch("/notifications/read-all");

      setNotifications((current) =>
        current.map((item) => ({ ...item, isRead: true }))
      );

      setUnreadCount(0);
    } catch (error) {
      setNotificationError(
        error.message || "Unable to mark notifications as read."
      );
    }
  };

  const formatDate = (date) => {
    if (!date) return "";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) return "";

    return parsedDate.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const Avatar = ({ size = "small" }) => (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-violet-50 font-bold text-violet-600 border border-violet-100 shadow-2xs ${
        size === "large"
          ? "h-12 w-12 text-base"
          : "h-11 w-11 text-sm"
      }`}
    >
      {profilePicture ? (
        <img
          src={profilePicture}
          alt={`${displayName} profile`}
          className="h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : (
        initials || <UserRound size={size === "large" ? 22 : 20} />
      )}
    </div>
  );

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-30 flex h-20 items-center justify-between gap-4 border-b border-slate-100 bg-white/90 px-6 backdrop-blur-md sm:px-8 lg:px-10 shadow-2xs max-w-7xl mx-auto rounded-b-3xl my-2"
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50 text-slate-700 transition hover:bg-slate-100 lg:hidden"
        >
          <Menu size={22} />
        </button>

        <div className="relative hidden w-full max-w-[390px] sm:block">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search your workspace..."
            aria-label="Search workspace"
            className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
          />
        </div>

        <div className="min-w-0 sm:hidden">
          <p className="truncate text-base font-extrabold text-slate-900">
            LocalPro
          </p>
          <p className="text-xs text-slate-400 font-semibold">
            {isAdmin ? "Admin workspace" : "My workspace"}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 sm:gap-4">
        {/* Notifications Bell Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen((open) => !open);
              setProfileOpen(false);

              if (!notificationsOpen && notifications.length === 0) {
                loadNotifications();
              }
            }}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            title="Notifications"
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50 text-slate-700 transition hover:bg-slate-100 active:scale-95"
          >
            <Bell size={20} strokeWidth={2} />

            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-[calc(100%+14px)] z-50 w-[min(380px,calc(100vw-32px))] overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Notifications
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {unreadCount} unread message{unreadCount === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={!unreadCount}
                    title="Mark all as read"
                    aria-label="Mark all as read"
                    className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CheckCheck size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(false)}
                    aria-label="Close notifications"
                    className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
                {loadingNotifications && notifications.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-12 text-xs font-semibold text-slate-400">
                    <LoaderCircle size={18} className="animate-spin text-violet-600" />
                    Loading notifications...
                  </div>
                ) : notificationError ? (
                  <div className="px-5 py-10 text-center">
                    <p className="text-xs font-semibold text-rose-600">
                      {notificationError}
                    </p>

                    <button
                      type="button"
                      onClick={() => loadNotifications()}
                      className="mt-3 text-xs font-bold text-violet-600 hover:underline"
                    >
                      Try again
                    </button>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <Bell
                      size={28}
                      className="mx-auto mb-2.5 text-slate-300"
                    />
                    <p className="text-sm font-bold text-slate-800">
                      No notifications yet
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      New updates will appear here automatically.
                    </p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <button
                      key={notification._id}
                      type="button"
                      onClick={() =>
                        handleNotificationClick(notification)
                      }
                      className={`flex w-full gap-3.5 px-5 py-3.5 text-left transition hover:bg-slate-50 ${
                        !notification.isRead ? "bg-violet-50/40" : ""
                      }`}
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 border border-violet-100">
                        {notification.isRead ? (
                          <Check size={16} />
                        ) : (
                          <Bell size={16} />
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800">
                            {notification.title}
                          </span>

                          {!notification.isRead && (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet-600" />
                          )}
                        </span>

                        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                          {notification.message}
                        </span>

                        <span className="mt-1.5 block text-[11px] font-medium text-slate-400">
                          {formatDate(notification.createdAt)}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>

              <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => loadNotifications()}
                  className="w-full rounded-xl py-2 text-xs font-bold text-violet-600 transition hover:bg-violet-100/50"
                >
                  Refresh notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileOpen((open) => !open);
              setNotificationsOpen(false);
            }}
            aria-expanded={profileOpen}
            aria-label="Open profile menu"
            className="flex items-center gap-2.5 rounded-2xl p-1.5 transition hover:bg-slate-50 sm:gap-3 sm:pl-2"
          >
            <Avatar />

            <div className="hidden text-left sm:block">
              <p className="max-w-[130px] truncate text-sm font-bold text-slate-800">
                {displayName}
              </p>
              <p className="text-xs font-semibold capitalize text-slate-400">
                {role}
              </p>
            </div>

            <ChevronDown
              size={16}
              className={`hidden text-slate-400 transition sm:block ${
                profileOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-[calc(100%+14px)] z-50 w-64 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl animate-fadeIn">
              <div className="border-b border-slate-100 bg-slate-50/50 p-5">
                <div className="flex items-center gap-3.5">
                  <Avatar size="large" />

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {displayName}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold capitalize text-slate-400">
                      {role} account
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate(profilePath);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-violet-50 hover:text-violet-700"
                >
                  <UserRound size={17} />
                  My Profile
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate(settingsPath);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-violet-50 hover:text-violet-700"
                >
                  <Settings size={17} />
                  Settings
                </button>

                <div className="my-1.5 border-t border-slate-100" />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-rose-600 transition hover:bg-rose-50"
                >
                  <LogOut size={17} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}