import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Settings as SettingsIcon,
  Building2,
  Clock3,
  ShieldCheck,
  Bell,
  Save,
  RefreshCw,
  Globe,
  CalendarDays,
  LockKeyhole,
  CheckCircle2,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import api from "../../services/api";

const initialSettings = {
  workspaceName: "",
  timezone: "Asia/Karachi",
  dateFormat: "DD/MM/YYYY",
  workStart: "09:00",
  workEnd: "17:00",
  lateGracePeriod: 10,
  emailNotifications: true,
  attendanceReminders: true,
  securityAlerts: true,
  requireStrongPasswords: true,
};

const booleanFields = [
  "emailNotifications",
  "attendanceReminders",
  "securityAlerts",
  "requireStrongPasswords",
];

const sections = [
  {
    id: "general",
    title: "Workspace Preferences",
    description: "Basic information and regional preferences.",
    icon: Building2,
  },
  {
    id: "attendance",
    title: "Attendance Settings",
    description: "Configure standard working hours and late arrival rules.",
    icon: Clock3,
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Choose which workspace alerts you want enabled.",
    icon: Bell,
  },
  {
    id: "security",
    title: "Security",
    description: "Review basic account and workspace security preferences.",
    icon: ShieldCheck,
  },
];

export default function AdminSettings() {
  const [settings, setSettings] = useState(initialSettings);
  const [savedSettings, setSavedSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const todayHeader = useMemo(
    () =>
      new Intl.DateTimeFormat("en", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    []
  );

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await api.get("/settings");
      const data = response.data?.data;

      if (!data) {
        throw new Error("Settings data was not returned by the server.");
      }

      const loaded = {
        ...initialSettings,
        ...data,
        lateGracePeriod: String(
          data.lateGracePeriod ?? initialSettings.lateGracePeriod
        ),
      };

      setSettings(loaded);
      setSavedSettings(loaded);
    } catch (err) {
      setError(err.message || "Unable to load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  function updateSetting(name, value) {
    setSettings((current) => ({ ...current, [name]: value }));
    setNotice("");
    setError("");
  }

  function resetSettings() {
    setSettings({ ...savedSettings });
    setNotice("");
    setError("");
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    const payload = {
      ...settings,
      lateGracePeriod: Number(settings.lateGracePeriod),
    };

    for (const field of booleanFields) {
      payload[field] = Boolean(settings[field]);
    }

    try {
      const response = await api.patch("/settings", payload);
      const data = response.data?.data;

      if (!data) {
        throw new Error("The server did not return the saved settings.");
      }

      const saved = {
        ...initialSettings,
        ...data,
        lateGracePeriod: String(
          data.lateGracePeriod ?? initialSettings.lateGracePeriod
        ),
      };

      setSettings(saved);
      setSavedSettings(saved);
      setNotice("Settings saved successfully.");
    } catch (err) {
      setError(err.message || "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center max-w-7xl mx-auto">
        <LoaderCircle size={28} className="mx-auto animate-spin text-violet-600" />
        <p className="mt-3 text-sm text-slate-400">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-3xl p-6 shadow-xs border border-slate-100">
        <div>
          <span className="text-xs font-bold tracking-wider text-violet-600 uppercase">
            Admin Workspace
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Settings
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs">
            <CalendarDays size={17} className="text-violet-600" />
            <span>{todayHeader}</span>
          </div>

          <button
            type="button"
            onClick={resetSettings}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
          >
            <RefreshCw size={17} />
            Reset Form
          </button>
        </div>
      </div>

      {/* Quick Jump Navigation Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-xs transition hover:border-violet-200 hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 transition group-hover:bg-violet-100">
                  <Icon size={22} />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-900">
                    {section.title}
                  </h2>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">
                    {section.description}
                  </p>
                </div>
              </div>
            </a>
          );
        })}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Workspace Preferences Section */}
        <section
          id="general"
          className="scroll-mt-6 rounded-3xl border border-slate-100 bg-white shadow-xs overflow-hidden"
        >
          <div className="flex items-center gap-4 border-b border-slate-100 p-6 sm:p-7">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <Building2 size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Workspace Preferences
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Set the workspace name and regional preferences.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2 sm:p-7">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-800">
                Workspace Name
              </span>
              <input
                type="text"
                maxLength={150}
                value={settings.workspaceName}
                onChange={(event) =>
                  updateSetting("workspaceName", event.target.value)
                }
                placeholder="Enter workspace name"
                className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 px-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                <Globe size={16} className="text-violet-600" />
                Timezone
              </span>
              <select
                value={settings.timezone}
                onChange={(event) =>
                  updateSetting("timezone", event.target.value)
                }
                className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100 cursor-pointer"
              >
                <option value="Asia/Karachi">Pakistan (UTC+05:00)</option>
                <option value="Asia/Dubai">Dubai (UTC+04:00)</option>
                <option value="Asia/Kolkata">India (UTC+05:30)</option>
                <option value="Europe/London">London</option>
                <option value="America/New_York">New York</option>
                <option value="UTC">UTC</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                <CalendarDays size={16} className="text-violet-600" />
                Date Format
              </span>
              <select
                value={settings.dateFormat}
                onChange={(event) =>
                  updateSetting("dateFormat", event.target.value)
                }
                className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100 cursor-pointer"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </label>
          </div>
        </section>

        {/* Attendance Settings Section */}
        <section
          id="attendance"
          className="scroll-mt-6 rounded-3xl border border-slate-100 bg-white shadow-xs overflow-hidden"
        >
          <div className="flex items-center gap-4 border-b border-slate-100 p-6 sm:p-7">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Clock3 size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Attendance Settings
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Configure your standard working hours and late arrival grace period.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3 sm:p-7">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-800">
                Work Start Time
              </span>
              <input
                type="time"
                value={settings.workStart}
                onChange={(event) =>
                  updateSetting("workStart", event.target.value)
                }
                className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100 cursor-pointer"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-800">
                Work End Time
              </span>
              <input
                type="time"
                value={settings.workEnd}
                onChange={(event) =>
                  updateSetting("workEnd", event.target.value)
                }
                className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100 cursor-pointer"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-800">
                Late Grace Period (minutes)
              </span>
              <input
                type="number"
                min="0"
                max="180"
                step="1"
                value={settings.lateGracePeriod}
                onChange={(event) =>
                  updateSetting("lateGracePeriod", event.target.value)
                }
                className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
            </label>
          </div>
        </section>

        {/* Notifications Section */}
        <section
          id="notifications"
          className="scroll-mt-6 rounded-3xl border border-slate-100 bg-white shadow-xs overflow-hidden"
        >
          <div className="flex items-center gap-4 border-b border-slate-100 p-6 sm:p-7">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Bell size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Notifications
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Choose the notifications you want to enable.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 px-6 sm:px-7">
            {[
              {
                key: "emailNotifications",
                title: "Email Notifications",
                description: "Receive workspace updates through email.",
              },
              {
                key: "attendanceReminders",
                title: "Attendance Reminders",
                description: "Enable reminders related to attendance.",
              },
              {
                key: "securityAlerts",
                title: "Security Alerts",
                description: "Enable alerts for important security events.",
              },
            ].map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer items-center justify-between gap-4 py-5"
              >
                <span>
                  <span className="block text-sm font-bold text-slate-800">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {item.description}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings[item.key]}
                  onChange={(event) =>
                    updateSetting(item.key, event.target.checked)
                  }
                  className="h-5 w-5 shrink-0 cursor-pointer accent-violet-600 rounded-md"
                />
              </label>
            ))}
          </div>
        </section>

        {/* Security Section */}
        <section
          id="security"
          className="scroll-mt-6 rounded-3xl border border-slate-100 bg-white shadow-xs overflow-hidden"
        >
          <div className="flex items-center gap-4 border-b border-slate-100 p-6 sm:p-7">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <LockKeyhole size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Security</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Configure basic workspace security preferences.
              </p>
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-4 p-6 sm:p-7">
            <span>
              <span className="block text-sm font-bold text-slate-800">
                Require Strong Passwords
              </span>
              <span className="mt-0.5 block text-xs text-slate-400">
                Require users to follow the workspace password policy.
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings.requireStrongPasswords}
              onChange={(event) =>
                updateSetting("requireStrongPasswords", event.target.checked)
              }
              className="h-5 w-5 shrink-0 cursor-pointer accent-violet-600 rounded-md"
            />
          </label>
        </section>

        {/* Bottom Save Action Bar */}
        <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-100 bg-white p-6 sm:flex-row sm:items-center sm:p-7 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">
                Workspace Settings
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Changes are saved securely to the backend database.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              onClick={resetSettings}
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50 px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 active:scale-95"
            >
              {saving ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <Save size={17} />
              )}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-2xl p-4">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {notice && (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <CheckCircle2 size={18} />
            {notice}
          </div>
        )}
      </form>
    </div>
  );
}