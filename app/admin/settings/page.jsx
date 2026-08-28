"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  Camera,
  ClipboardList,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Menu,
  Save,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";

import { authService } from "@/services/authService";

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
    label: "Calendar",
    href: "/admin/calendar",
    icon: CalendarDays,
  },
  {
    label: "Activity",
    href: "/admin/activity",
    icon: Activity,
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

const defaultNotifications = {
  taskUpdates: true,
  appointmentAlerts: true,
  messageAlerts: true,
};

export default function AdminSettingsPage() {
  const pathname = usePathname();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [profile, setProfile] = useState({
    id: "",
    name: "",
    email: "",
    phone: "",
    avatar: null,
    role: "",
    status: "",
  });

  const [notifications, setNotifications] = useState(
    defaultNotifications
  );

  const [imagePreview, setImagePreview] = useState("");
  const [imageFile, setImageFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingNotification, setSavingNotification] =
    useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const fileInputRef = useRef(null);

  // =========================================
  // LOAD CURRENT ADMIN
  // =========================================

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        setLoading(true);

        const response = await authService.me();

        if (!response?.user) {
          router.replace("/login");
          return;
        }

        const user = response.user;

        if (user.role !== "admin") {
          router.replace("/login");
          return;
        }

        if (!mounted) {
          return;
        }

        setProfile({
          id: user.id || "",
          name: user.name || "",
          email: user.email || "",
          phone: user.phone || "",
          avatar: user.avatar || null,
          role: user.role || "",
          status: user.status || "",
        });

        setNotifications({
          taskUpdates:
            user.notificationPreferences?.taskUpdates ?? true,

          appointmentAlerts:
            user.notificationPreferences?.appointmentAlerts ?? true,

          messageAlerts:
            user.notificationPreferences?.messageAlerts ?? true,
        });

        if (user.avatar) {
          setImagePreview(user.avatar);
        }
      } catch (error) {
        console.error(
          "Failed to load admin profile:",
          error
        );

        if (mounted) {
          setMessageType("error");
          setMessage("Unable to load your profile.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [router]);

  // =========================================
  // INPUT CHANGE
  // =========================================

  function handleChange(event) {
    const { name, value } = event.target;

    setProfile((previous) => ({
      ...previous,
      [name]: value,
    }));

    setMessage("");
  }

  // =========================================
  // IMAGE CHANGE
  // =========================================

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessageType("error");
      setMessage("Please select a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessageType("error");
      setMessage("Image size must be less than 5MB.");
      return;
    }

    if (imagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    const previewUrl = URL.createObjectURL(file);

    setImageFile(file);
    setImagePreview(previewUrl);
    setMessage("");
  }

  // =========================================
  // FILE TO DATA URL
  // =========================================

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(reader.result);
      };

      reader.onerror = () => {
        reject(
          new Error("Unable to process profile image.")
        );
      };

      reader.readAsDataURL(file);
    });
  }

  // =========================================
  // SAVE PROFILE
  // =========================================

  async function handleSave(event) {
    event.preventDefault();

    if (!profile.name.trim()) {
      setMessageType("error");
      setMessage("Full name is required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      let avatar = profile.avatar;

      if (imageFile) {
        avatar = await fileToDataUrl(imageFile);
      }

      const response = await authService.updateProfile({
        name: profile.name.trim(),
        phone: profile.phone.trim(),
        ...(avatar ? { avatar } : {}),
      });

      const updatedUser = response?.user;

      if (updatedUser) {
        setProfile((previous) => ({
          ...previous,
          id: updatedUser.id || previous.id,
          name: updatedUser.name || previous.name,
          email: updatedUser.email || previous.email,
          phone: updatedUser.phone || "",
          avatar: updatedUser.avatar || null,
          role: updatedUser.role || previous.role,
          status: updatedUser.status || previous.status,
        }));

        if (updatedUser.avatar) {
          setImagePreview(updatedUser.avatar);
        }
      }

      setImageFile(null);

      setMessageType("success");
      setMessage(
        response?.message ||
          "Profile updated successfully."
      );
    } catch (error) {
      console.error("Profile update failed:", error);

      setMessageType("error");
      setMessage(
        error.message || "Unable to update profile."
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================================
  // NOTIFICATION TOGGLE
  // =========================================

  async function handleNotificationToggle(field) {
    const previousValue = notifications[field];
    const newValue = !previousValue;

    setNotifications((previous) => ({
      ...previous,
      [field]: newValue,
    }));

    try {
      setSavingNotification(true);
      setMessage("");

      await authService.updateProfile({
        notificationPreferences: {
          [field]: newValue,
        },
      });

      setMessageType("success");
      setMessage("Notification preference updated.");
    } catch (error) {
      console.error(
        "Notification preference update failed:",
        error
      );

      setNotifications((previous) => ({
        ...previous,
        [field]: previousValue,
      }));

      setMessageType("error");
      setMessage(
        error.message ||
          "Unable to update notification preference."
      );
    } finally {
      setSavingNotification(false);
    }
  }

  // =========================================
  // SIGN OUT
  // =========================================

  async function handleSignOut() {
    try {
      setMessage("");

      await authService.logout();

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Sign out failed:", error);

      setMessageType("error");
      setMessage(
        error.message || "Unable to sign out."
      );
    }
  }

  // =========================================
  // LOADING
  // =========================================

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2
            size={30}
            className="animate-spin text-[#2563EB]"
          />

          <p className="text-sm font-medium text-[#64748B]">
            Loading settings...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC]">
      {/* =========================================
          MOBILE OVERLAY
      ========================================= */}

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* =========================================
          SIDEBAR
      ========================================= */}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#171B3A] shadow-xl transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        {/* Logo */}

        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-white">
              <ShieldCheck size={22} />
            </div>

            <div>
              <h1 className="text-sm font-bold text-white">
                Local Pro 1
              </h1>

              <p className="text-[11px] font-medium text-slate-300">
                Admin Workspace
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition hover:bg-white/10 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation */}

        <nav className="flex-1 overflow-y-auto px-3 py-5">
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
                  onClick={() => setSidebarOpen(false)}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-[#2563EB] text-white shadow-sm"
                      : "text-white hover:bg-white/10"
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
            })}
          </div>
        </nav>

        {/* Sidebar Account */}

        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-xl px-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2563EB] text-xs font-bold text-white">
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt="Administrator"
                  className="h-full w-full object-cover"
                />
              ) : profile.name ? (
                profile.name
                  .charAt(0)
                  .toUpperCase()
              ) : (
                "A"
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {profile.name || "Administrator"}
              </p>

              <p className="truncate text-xs font-medium text-slate-300">
                Admin Account
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <LogOut
              size={17}
              className="text-white"
            />

            <span className="text-white">
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      {/* =========================================
          FULL SCREEN MAIN AREA
          SIDEBAR DOES NOT PUSH CONTENT
      ========================================= */}

      <div className="min-h-screen w-full">
        {/* Mobile Menu */}

        <div className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-200 bg-white px-5 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-[#26344D] transition hover:bg-slate-50"
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* =========================================
            FULL WIDTH CONTENT
        ========================================= */}

        <main className="w-full p-5 sm:p-6 lg:p-8">
          <div className="w-full space-y-6">
            {/* PAGE HEADING */}

            <section className="w-full">
              <p className="text-sm font-semibold text-[#2563EB]">
                ADMINISTRATION
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
                Settings
              </h1>

              <p className="mt-2 text-sm text-[#64748B]">
                Manage your administrator profile and workspace preferences.
              </p>
            </section>

            {/* MESSAGE */}

            {message && (
              <div
                className={`w-full rounded-xl border px-4 py-3 text-sm font-medium ${
                  messageType === "error"
                    ? "border-red-100 bg-red-50 text-red-600"
                    : "border-blue-100 bg-[#EEF4FF] text-[#2563EB]"
                }`}
              >
                {message}
              </div>
            )}

            {/* =========================================
                ADMINISTRATOR PROFILE
            ========================================= */}

            <form
              onSubmit={handleSave}
              className="w-full"
            >
              <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Section Header */}

                <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                      <UserCog size={19} />
                    </div>

                    <div>
                      <h2 className="text-base font-bold text-[#171B3A]">
                        Administrator Profile
                      </h2>

                      <p className="mt-1 text-sm text-[#64748B]">
                        Update your administrator account information.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 p-5 sm:p-6">
                  {/* Profile Image */}

                  <div className="flex w-full flex-col gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center">
                    <div className="relative h-24 w-24 shrink-0">
                      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-[#EEF4FF] text-2xl font-bold text-[#2563EB]">
                        {imagePreview ? (
                          <img
                            src={imagePreview}
                            alt="Administrator profile"
                            className="h-full w-full object-cover"
                          />
                        ) : profile.name ? (
                          profile.name
                            .charAt(0)
                            .toUpperCase()
                        ) : (
                          "A"
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          fileInputRef.current?.click()
                        }
                        className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-md transition hover:bg-[#1D4ED8]"
                        aria-label="Upload profile image"
                      >
                        <Camera size={17} />
                      </button>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-[#171B3A]">
                        Profile Image
                      </h3>

                      <p className="mt-1 text-xs leading-5 text-[#64748B]">
                        Upload a profile image for your administrator account.
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        JPG, PNG or WEBP. Maximum 5MB.
                      </p>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleImageChange}
                        className="hidden"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          fileInputRef.current?.click()
                        }
                        className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#26344D] transition hover:bg-slate-50"
                      >
                        <Camera size={15} />
                        Choose Image
                      </button>
                    </div>
                  </div>

                  {/* Name */}

                  <div className="w-full">
                    <label
                      htmlFor="admin-name"
                      className="mb-2 block text-sm font-semibold text-[#26344D]"
                    >
                      Full Name
                    </label>

                    <input
                      id="admin-name"
                      name="name"
                      type="text"
                      value={profile.name}
                      onChange={handleChange}
                      placeholder="Enter administrator name"
                      autoComplete="name"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>

                  {/* Email */}

                  <div className="w-full">
                    <label
                      htmlFor="admin-email"
                      className="mb-2 block text-sm font-semibold text-[#26344D]"
                    >
                      Email Address
                    </label>

                    <input
                      id="admin-email"
                      name="email"
                      type="email"
                      value={profile.email}
                      readOnly
                      autoComplete="email"
                      className="h-11 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-[#64748B] outline-none"
                    />

                    <p className="mt-1.5 text-xs text-slate-400">
                      Email address is managed by the authentication system.
                    </p>
                  </div>

                  {/* Phone */}

                  <div className="w-full">
                    <label
                      htmlFor="admin-phone"
                      className="mb-2 block text-sm font-semibold text-[#26344D]"
                    >
                      Phone Number
                    </label>

                    <input
                      id="admin-phone"
                      name="phone"
                      type="tel"
                      value={profile.phone}
                      onChange={handleChange}
                      placeholder="Enter phone number"
                      autoComplete="tel"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>

                  {/* Save */}

                  <div className="flex justify-end border-t border-slate-100 pt-5">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? (
                        <>
                          <Loader2
                            size={17}
                            className="animate-spin"
                          />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save size={17} />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </section>
            </form>

            {/* =========================================
                NOTIFICATIONS
            ========================================= */}

            <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                    <Bell size={19} />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-[#171B3A]">
                      Notification Settings
                    </h2>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Manage your notification preferences.
                    </p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                <SettingRow
                  title="Task Notifications"
                  description="Receive notifications when tasks are created or updated."
                  enabled={notifications.taskUpdates}
                  disabled={savingNotification}
                  onToggle={() =>
                    handleNotificationToggle(
                      "taskUpdates"
                    )
                  }
                />

                <SettingRow
                  title="Calendar Notifications"
                  description="Receive notifications for upcoming calendar events."
                  enabled={
                    notifications.appointmentAlerts
                  }
                  disabled={savingNotification}
                  onToggle={() =>
                    handleNotificationToggle(
                      "appointmentAlerts"
                    )
                  }
                />

                <SettingRow
                  title="User Notifications"
                  description="Receive notifications for workspace messages and user activity."
                  enabled={
                    notifications.messageAlerts
                  }
                  disabled={savingNotification}
                  onToggle={() =>
                    handleNotificationToggle(
                      "messageAlerts"
                    )
                  }
                />
              </div>
            </section>

            {/* =========================================
                SECURITY
            ========================================= */}

            <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                    <Lock size={19} />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-[#171B3A]">
                      Security
                    </h2>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Manage your account authentication settings.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <div className="flex w-full flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#171B3A]">
                      Password & Authentication
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-[#64748B]">
                      Password management is handled by the backend authentication system.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMessageType("success");
                      setMessage(
                        "Password management is available through the backend change-password endpoint."
                      );
                    }}
                    className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#26344D] transition hover:bg-slate-50"
                  >
                    Manage Security
                  </button>
                </div>
              </div>
            </section>

            {/* =========================================
                BACKEND STATUS
            ========================================= */}

            <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#171B3A]">
                    Configuration Status
                  </h2>

                  <p className="mt-1 text-sm text-[#64748B]">
                    Settings are connected to the Local Pro 1 backend.
                  </p>
                </div>

                <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-blue-100 bg-[#EEF4FF] px-4 py-2">
                  <span className="h-2 w-2 rounded-full bg-[#2563EB]" />

                  <span className="text-xs font-semibold text-[#2563EB]">
                    Backend Connected
                  </span>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

/* =========================================
   SETTING ROW
========================================= */

function SettingRow({
  title,
  description,
  enabled,
  disabled,
  onToggle,
}) {
  return (
    <div className="flex w-full flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <h3 className="text-sm font-semibold text-[#171B3A]">
          {title}
        </h3>

        <p className="mt-1 max-w-2xl text-xs leading-5 text-[#64748B]">
          {description}
        </p>
      </div>

      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={enabled}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
          enabled
            ? "bg-[#2563EB]"
            : "bg-slate-200"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
            enabled ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}