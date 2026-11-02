import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

import api from "./services/api";
import Login from "./pages/auth/Login";
import ProtectedRoute from "./routes/ProtectedRoute";
import MainLayout from "./components/layout/MainLayout";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminTasks from "./pages/admin/AdminTasks";
import AdminUsers from "./pages/admin/Users";
import AdminAttendance from "./pages/admin/Attendance";
import AttendanceReports from "./pages/admin/AttendanceReports";
import AdminLeaves from "./pages/admin/AdminLeaves";
import AdminProfile from "./pages/admin/Profile";
import AdminSettings from "./pages/admin/Settings";

import UserDashboard from "./pages/user/UserDashboard";
import UserTasks from "./pages/user/UserTasks";
import UserAttendance from "./pages/user/UserAttendance";
import UserLeaves from "./pages/user/UserLeaves";
import UserProfile from "./pages/user/UserProfile";
import UserSettings from "./pages/user/UserSettings";
import ChatPage from "./pages/chat/ChatPage"; // <-- ChatPage imported

function getDashboardPath(user) {
  return user?.role === "user"
    ? "/user/dashboard"
    : "/admin/dashboard";
}

function RoleRoutes({ user, loading, onLogout, setUser }) {
  if (!user && !loading) {
    return <Navigate to="/login" replace />;
  }

  if (loading && !user) {
    return null;
  }

  const isUser = user?.role === "user";
  const isAdminRole = ["admin", "manager"].includes(user?.role);

  if (!isUser && !isAdminRole) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ProtectedRoute
      user={user}
      loading={false}
      allowedRoles={isUser ? ["user"] : ["admin", "manager"]}
    >
      <Routes>
        {isUser ? (
          <Route
            path="/user"
            element={
              <MainLayout
                user={user}
                role="user"
                onLogout={onLogout}
              />
            }
          >
            <Route
              index
              element={<Navigate to="/user/dashboard" replace />}
            />
            <Route
              path="dashboard"
              element={
                <UserDashboard user={user} onLogout={onLogout} />
              }
            />
            <Route path="chat" element={<ChatPage user={user} />} />
            <Route path="tasks" element={<UserTasks />} />
            <Route path="attendance" element={<UserAttendance />} />
            <Route path="leaves" element={<UserLeaves />} />
            <Route
              path="profile"
              element={
                <UserProfile
                  user={user}
                  onUserUpdate={setUser}
                />
              }
            />
            <Route path="settings" element={<UserSettings />} />
          </Route>
        ) : (
          <Route
            path="/admin"
            element={
              <MainLayout
                user={user}
                role={user.role}
                onLogout={onLogout}
              />
            }
          >
            <Route
              index
              element={<Navigate to="/admin/dashboard" replace />}
            />
            <Route
              path="dashboard"
              element={
                <AdminDashboard user={user} onLogout={onLogout} />
              }
            />
            <Route path="chat" element={<ChatPage user={user} />} />
            <Route path="tasks" element={<AdminTasks />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="attendance" element={<AdminAttendance />} />
            <Route
              path="attendance-reports"
              element={<AttendanceReports />}
            />
            <Route path="leaves" element={<AdminLeaves />} />
            <Route
              path="profile"
              element={
                <AdminProfile
                  user={user}
                  onUserUpdate={setUser}
                />
              }
            />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        )}

        <Route
          path="*"
          element={<Navigate to={getDashboardPath(user)} replace />}
        />
      </Routes>
    </ProtectedRoute>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem("localpro_user");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  
  const [loading, setLoading] = useState(!user);
  const navigate = useNavigate();

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

  const verifySession = useCallback(async () => {
    try {
      const response = await api.get("/auth/me");
      const authenticatedUser = response.data?.user;

      if (
        authenticatedUser &&
        ["admin", "manager", "user"].includes(authenticatedUser.role)
      ) {
        setUser(authenticatedUser);
        localStorage.setItem("localpro_user", JSON.stringify(authenticatedUser));
      } else {
        setUser(null);
        localStorage.removeItem("localpro_user");
      }
    } catch {
      // Keep cached user temporarily on network failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  const handleLogin = useCallback(
    (authenticatedUser) => {
      if (
        !authenticatedUser ||
        !["admin", "manager", "user"].includes(authenticatedUser.role)
      ) {
        setUser(null);
        localStorage.removeItem("localpro_user");
        return;
      }

      setUser(authenticatedUser);
      localStorage.setItem("localpro_user", JSON.stringify(authenticatedUser));
      navigate(getDashboardPath(authenticatedUser), {
        replace: true,
      });
    },
    [navigate],
  );

  const handleLogout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout request failed:", error.message);
    } finally {
      setUser(null);
      localStorage.removeItem("localpro_user");
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to={getDashboardPath(user)} replace />
          ) : (
            <Login onLogin={handleLogin} />
          )
        }
      />

      <Route
        path="/*"
        element={
          <RoleRoutes
            user={user}
            loading={loading}
            onLogout={handleLogout}
            setUser={(updatedUser) => {
              setUser(updatedUser);
              if (updatedUser) {
                localStorage.setItem("localpro_user", JSON.stringify(updatedUser));
              } else {
                localStorage.removeItem("localpro_user");
              }
            }}
          />
        }
      />
    </Routes>
  );
}