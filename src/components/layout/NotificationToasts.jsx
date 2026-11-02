
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ClipboardList, CalendarCheck, X } from "lucide-react";

export default function NotificationToasts({ role = "user" }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const navigate = useNavigate();

  const isAdmin = ["admin", "manager"].includes(role);
  const tasksPath = isAdmin ? "/admin/tasks" : "/user/tasks";
  const attendancePath = isAdmin
    ? "/admin/attendance"
    : "/user/attendance";

  useEffect(() => {
    const handleToast = (event) => {
      const notification = event.detail;
      if (!notification?._id) return;

      const type = notification.type;
      if (!["task", "attendance"].includes(type)) return;

      const id = String(notification._id);

      setToasts((current) => {
        if (current.some((item) => String(item._id) === id)) {
          return current;
        }

        return [...current, notification].slice(-4);
      });

      const oldTimer = timersRef.current.get(id);
      if (oldTimer) window.clearTimeout(oldTimer);

      const timer = window.setTimeout(() => {
        setToasts((current) =>
          current.filter((item) => String(item._id) !== id)
        );
        timersRef.current.delete(id);
      }, 7000);

      timersRef.current.set(id, timer);
    };

    window.addEventListener("localpro:notification-toast", handleToast);

    return () => {
      window.removeEventListener(
        "localpro:notification-toast",
        handleToast
      );

      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const openNotification = (notification) => {
    const path =
      notification.type === "attendance"
        ? attendancePath
        : tasksPath;

    const timer = timersRef.current.get(String(notification._id));
    if (timer) window.clearTimeout(timer);

    timersRef.current.delete(String(notification._id));
    setToasts((current) =>
      current.filter((item) => item._id !== notification._id)
    );

    navigate(path);
  };

  const dismissToast = (event, id) => {
    event.stopPropagation();

    const timer = timersRef.current.get(String(id));
    if (timer) window.clearTimeout(timer);

    timersRef.current.delete(String(id));
    setToasts((current) =>
      current.filter((item) => String(item._id) !== String(id))
    );
  };

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[100] flex w-[min(380px,calc(100vw-32px))] flex-col gap-3">
      {toasts.map((notification) => {
        const isAttendance = notification.type === "attendance";
        const Icon = isAttendance ? CalendarCheck : ClipboardList;

        return (
          <div
            key={notification._id}
            role="status"
            className="pointer-events-auto animate-in slide-in-from-right-4 fade-in duration-200"
          >
            <button
              type="button"
              onClick={() => openNotification(notification)}
              className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xl shadow-slate-900/10 transition hover:border-violet-300"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <Icon size={21} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Bell size={15} className="shrink-0 text-violet-600" />
                  {notification.title || "New notification"}
                </span>

                <span className="mt-1 block text-sm leading-5 text-slate-600">
                  {notification.message}
                </span>

                <span className="mt-2 block text-xs font-semibold text-violet-700">
                  Click to open {isAttendance ? "Attendance" : "Tasks"}
                </span>
              </span>

              <span
                role="button"
                tabIndex={0}
                aria-label="Dismiss notification"
                onClick={(event) =>
                  dismissToast(event, notification._id)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    dismissToast(event, notification._id);
                  }
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={17} />
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
