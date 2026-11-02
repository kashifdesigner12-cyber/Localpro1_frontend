import { useEffect, useState } from "react";
import {
  Bell,
  Mail,
  ShieldCheck,
  LockKeyhole,
  Eye,
  EyeOff,
  Save,
  Smartphone,
  AlertCircle,
  CheckCircle2,
  BellRing,
  CalendarDays,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import api from "../../services/api";
import {
  enablePushNotifications,
  disablePushNotifications,
} from "../../services/pushNotifications";

const defaultPreferences = {
  emailNotifications: true,
  taskNotifications: true,
  attendanceNotifications: true,
};

export default function UserSettings() {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [loading, setLoading] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(
    typeof Notification !== "undefined" &&
      Notification.permission === "granted",
  );
  const [pushLoading, setPushLoading] = useState(false);

  const todayHeader = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  useEffect(() => {
    let cancelled = false;

    const loadPreferences = async () => {
      try {
        const response = await api.get("/auth/preferences");
        const data = response.data?.preferences;

        if (!cancelled && data) {
          setPreferences({
            emailNotifications:
              data.emailNotifications ?? defaultPreferences.emailNotifications,
            taskNotifications:
              data.taskNotifications ?? defaultPreferences.taskNotifications,
            attendanceNotifications:
              data.attendanceNotifications ??
              defaultPreferences.attendanceNotifications,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error.message || "Failed to load preferences.");
          setMessageType("error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPreferences();

    return () => {
      cancelled = true;
    };
  }, []);

  const showMessage = (text, type = "info") => {
    setMessage(text);
    setMessageType(type);
  };

  const updatePreference = (name, value) => {
    setPreferences((current) => ({ ...current, [name]: value }));
    setMessage("");
  };

  const updatePassword = (event) => {
    const { name, value } = event.target;
    setPasswords((current) => ({ ...current, [name]: value }));
    setMessage("");
  };

  const handleDesktopNotifications = async () => {
    setPushLoading(true);
    setMessage("");

    try {
      if (pushEnabled) {
        await disablePushNotifications();
        setPushEnabled(false);
        showMessage("Desktop notifications disabled.", "success");
      } else {
        await enablePushNotifications();
        setPushEnabled(true);
        showMessage("Desktop notifications enabled.", "success");
      }
    } catch (error) {
      showMessage(
        error.message || "Could not update desktop notifications.",
        "error",
      );
      setPushEnabled(
        typeof Notification !== "undefined" &&
          Notification.permission === "granted",
      );
    } finally {
      setPushLoading(false);
    }
  };

  const handleSavePreferences = async (event) => {
    event.preventDefault();
    setSavingPreferences(true);
    setMessage("");

    try {
      await api.patch("/auth/preferences", preferences);
      showMessage("Preferences saved successfully.", "success");
    } catch (error) {
      showMessage(error.message || "Failed to save preferences.", "error");
    } finally {
      setSavingPreferences(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (passwords.next.length < 8) {
      showMessage("Your new password must be at least 8 characters.", "error");
      return;
    }

    if (passwords.next.length > 128) {
      showMessage("Your new password cannot exceed 128 characters.", "error");
      return;
    }

    if (passwords.next !== passwords.confirm) {
      showMessage("New password and confirmation do not match.", "error");
      return;
    }

    if (passwords.current === passwords.next) {
      showMessage(
        "Your new password must be different from your current password.",
        "error",
      );
      return;
    }

    setSavingPassword(true);

    try {
      await api.patch("/auth/change-password", {
        currentPassword: passwords.current,
        newPassword: passwords.next,
      });

      setPasswords({ current: "", next: "", confirm: "" });
      showMessage("Password changed successfully.", "success");
    } catch (error) {
      showMessage(error.message || "Failed to change password.", "error");
    } finally {
      setSavingPassword(false);
    }
  };

  const toggleItems = [
    {
      name: "emailNotifications",
      title: "Email Notifications",
      description: "Receive account updates by email.",
      icon: Mail,
    },
    {
      name: "taskNotifications",
      title: "Task Notifications",
      description: "Get notified about task assignments and updates.",
      icon: Bell,
    },
    {
      name: "attendanceNotifications",
      title: "Attendance Notifications",
      description: "Receive attendance-related reminders and updates.",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header Section matching Ventes clean style */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-3xl p-6 shadow-xs border border-slate-100">
        <div>
          <span className="text-xs font-bold tracking-wider text-violet-600 uppercase">
            My Workspace
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Settings
          </h1>
        </div>
        <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs">
          <CalendarDays size={17} className="text-violet-600" />
          <span>{todayHeader}</span>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-2xl border px-5 py-3.5 text-sm font-medium shadow-2xs ${
            messageType === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : messageType === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          {messageType === "success" ? (
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0 text-emerald-600"
            />
          ) : (
            <AlertCircle
              size={18}
              className={`mt-0.5 shrink-0 ${
                messageType === "error" ? "text-rose-600" : "text-slate-400"
              }`}
            />
          )}
          <p className="text-sm leading-relaxed">{message}</p>
        </div>
      )}

      {/* Desktop Notifications Card */}
      <section className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <BellRing size={22} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">
                Desktop Notifications
              </h2>
              <p className="mt-0.5 text-xs text-slate-400 leading-relaxed max-w-xl">
                Receive task assignments and attendance reminders as desktop notifications, even when you are on another page.
              </p>
              <p className="mt-2 text-xs font-semibold text-slate-600">
                Status:{" "}
                <span
                  className={
                    pushEnabled ? "text-emerald-600 font-bold" : "text-slate-400"
                  }
                >
                  {pushEnabled ? "Permission granted" : "Not enabled"}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDesktopNotifications}
            disabled={pushLoading}
            className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 shadow-sm active:scale-95 ${
              pushEnabled
                ? "bg-slate-700 hover:bg-slate-800"
                : "bg-violet-600 hover:bg-violet-700"
            }`}
          >
            <BellRing size={17} />
            {pushLoading
              ? "Please wait..."
              : pushEnabled
                ? "Disable Notifications"
                : "Enable Notifications"}
          </button>
        </div>

        {typeof Notification !== "undefined" &&
          Notification.permission === "denied" && (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-800">
              Notifications are blocked by your browser. Allow notifications for this site in your browser's site settings, then try again.
            </p>
          )}

        <p className="mt-4 text-xs text-slate-400 leading-relaxed">
          Notifications require browser permission and a saved push subscription. Delivery also depends on your browser, operating system notification settings, network connection, and whether your device is awake.
        </p>
      </section>

      {/* Notification Preferences Form */}
      <form onSubmit={handleSavePreferences} className="space-y-6">
        <section className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-xs">
          <div className="flex items-center gap-4 border-b border-slate-100 pb-6 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <Bell size={22} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">
                Notification Preferences
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Choose which notifications you want to receive.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {toggleItems.map((item) => {
              const Icon = item.icon;
              const enabled = preferences[item.name];

              return (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-4 py-5 first:pt-0 last:pb-0"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="mt-0.5 text-slate-400">
                      <Icon size={19} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">
                        {item.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={item.title}
                    disabled={loading || savingPreferences}
                    onClick={() => updatePreference(item.name, !enabled)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                      enabled ? "bg-violet-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                        enabled ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || savingPreferences}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 active:scale-95"
          >
            <Save size={18} />
            {savingPreferences ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </form>

      {/* Change Password Section */}
      <section className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-4 border-b border-slate-100 pb-6 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <LockKeyhole size={22} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Change Password</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Use a strong password to help protect your account.
            </p>
          </div>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-5">
          {[
            {
              name: "current",
              label: "Current Password",
              placeholder: "Enter current password",
              autoComplete: "current-password",
            },
            {
              name: "next",
              label: "New Password",
              placeholder: "Enter new password (minimum 8 characters)",
              autoComplete: "new-password",
            },
            {
              name: "confirm",
              label: "Confirm New Password",
              placeholder: "Re-enter new password",
              autoComplete: "new-password",
            },
          ].map((field) => (
            <div key={field.name}>
              <label
                htmlFor={field.name}
                className="mb-2 block text-sm font-bold text-slate-800"
              >
                {field.label}
              </label>
              <div className="relative">
                <input
                  id={field.name}
                  name={field.name}
                  type={showPasswords ? "text" : "password"}
                  autoComplete={field.autoComplete}
                  value={passwords[field.name]}
                  onChange={updatePassword}
                  placeholder={field.placeholder}
                  required
                  minLength={field.name === "current" ? undefined : 8}
                  maxLength={128}
                  disabled={savingPassword}
                  className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 px-4 pr-12 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((value) => !value)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-xl p-1 text-slate-400 hover:text-slate-700 transition"
                  aria-label={
                    showPasswords ? "Hide passwords" : "Show passwords"
                  }
                >
                  {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          ))}

          <button
            type="submit"
            disabled={savingPassword}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-6 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 active:scale-95"
          >
            <LockKeyhole size={17} className="text-violet-600" />
            {savingPassword ? "Updating..." : "Update Password"}
          </button>
        </form>
      </section>

      {/* Account Security Information Footer */}
      <section className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-7 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            <Smartphone size={22} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Account Security</h2>
            <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">
              Your account access and security policies are managed through the LocalPro account system.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}