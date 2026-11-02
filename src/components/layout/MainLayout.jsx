import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import Sidebar from "./Sidebar";
import Header from "./Header";
import NotificationToasts from "./NotificationToasts";
import api from "../../services/api";

export default function MainLayout({ user, role, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const currentRole = role || user?.role || "user";

  const closeMobileSidebar = () => {
    setMobileOpen(false);
  };

  // Real-time socket listener for any logged-in user (including newly created ones)
  useEffect(() => {
    if (!user?._id) return;

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const backendUrl = api.defaults.baseURL
      ? api.defaults.baseURL.replace(/\/api$/, "")
      : "http://localhost:5000";

    const socket = io(backendUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("notification:new", (notification) => {
      if (!notification) return;

      if ("Notification" in window && Notification.permission === "granted") {
        try {
          const notifTitle = notification.title || "LocalPro Notification";
          const notifBody = notification.message || "You have a new update.";
          
          const browserNotification = new Notification(notifTitle, {
            body: notifBody,
            icon: "/favicon.ico",
            tag: `localpro-${notification._id}`,
          });

          browserNotification.onclick = () => {
            window.focus();
            if (notification.link) {
              navigate(notification.link);
            }
            browserNotification.close();
          };
        } catch (err) {
          console.error("Browser notification error:", err);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user?._id, navigate]);

  return (
    <div className="min-h-screen bg-[#F7F8FC]">
      <Sidebar
        role={currentRole}
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        mobileOpen={mobileOpen}
        onClose={closeMobileSidebar}
      />

      <div
        className={`min-h-screen transition-[padding] duration-300 ${
          collapsed ? "lg:pl-[82px]" : "lg:pl-[260px]"
        }`}
      >
        <Header
          user={user}
          role={currentRole}
          onMenuClick={() => setMobileOpen(true)}
          onLogout={onLogout}
        />

        <NotificationToasts role={currentRole} />

        <main className="min-h-[calc(100vh-76px)] p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}