"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Camera,
  CheckCircle2,
  Lock,
  Loader2,
  Save,
  ShieldCheck,
  UserCog,
  AlertCircle,
} from "lucide-react";

import { authService } from "@/services/authService";

const defaultNotifications = {
  taskUpdates: true,
  appointmentAlerts: true,
  messageAlerts: true,
};

// Global cache for instant settings/profile load
let globalAdminProfileCache = {
  profile: {
    id: "",
    name: "",
    email: "",
    phone: "",
    avatar: null,
    role: "",
    status: "",
  },
  notifications: defaultNotifications,
  loaded: false,
};

export default function AdminSettingsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState(
    globalAdminProfileCache.profile
  );

  const [notifications, setNotifications] = useState(
    globalAdminProfileCache.notifications
  );

  const [imagePreview, setImagePreview] = useState(
    globalAdminProfileCache.profile.avatar || ""
  );
  const [imageFile, setImageFile] = useState(null);

  // FIX: Start with loading false if cache exists for instant render
  const [loading, setLoading] = useState(
    !globalAdminProfileCache.loaded
  );
  const [saving, setSaving] = useState(false);
  const [savingNotification, setSavingNotification] =
    useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const fileInputRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
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

        const updatedProfile = {
          id: user.id || user._id || "",
          name: user.name || "",
          email: user.email || "",
          phone: user.phone || "",
          avatar: user.avatar || null,
          role: user.role || "",
          status: user.status || "",
        };

        const updatedNotifications = {
          taskUpdates:
            user.notificationPreferences?.taskUpdates ??
            true,
          appointmentAlerts:
            user.notificationPreferences
              ?.appointmentAlerts ?? true,
          messageAlerts:
            user.notificationPreferences
              ?.messageAlerts ?? true,
        };

        globalAdminProfileCache = {
          profile: updatedProfile,
          notifications: updatedNotifications,
          loaded: true,
        };

        setProfile(updatedProfile);
        setNotifications(updatedNotifications);

        if (user.avatar && !imageFile) {
          setImagePreview(user.avatar);
        }
      } catch (error) {
        console.error(
          "Failed to load admin profile:",
          error
        );

        if (mounted && !globalAdminProfileCache.loaded) {
          setMessageType("error");
          setMessage("Unable to load your profile.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (!globalAdminProfileCache.loaded) {
      loadProfile();
    } else {
      loadProfile(); // Background sync
    }

    return () => {
      mounted = false;
    };
  }, [router, imageFile]);

  const handleChange = useCallback((event) => {
    const { name, value } = event.target;

    setProfile((previous) => ({
      ...previous,
      [name]: value,
    }));

    setMessage("");
  }, []);

  const handleImageChange = useCallback((event) => {
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

    setImagePreview((previous) => {
      if (previous?.startsWith("blob:")) {
        URL.revokeObjectURL(previous);
      }

      return URL.createObjectURL(file);
    });

    setImageFile(file);
    setMessage("");
  }, []);

  const fileToDataUrl = useCallback((file) => {
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
  }, []);

  const handleSave = useCallback(
    async (event) => {
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

        const response =
          await authService.updateProfile({
            name: profile.name.trim(),
            phone: profile.phone.trim(),
            ...(avatar ? { avatar } : {}),
          });

        const updatedUser = response?.user;

        if (updatedUser) {
          const newProfile = {
            ...profile,
            id:
              updatedUser.id ||
              updatedUser._id ||
              profile.id,
            name:
              updatedUser.name || profile.name,
            email:
              updatedUser.email || profile.email,
            phone: updatedUser.phone || "",
            avatar: updatedUser.avatar || null,
            role:
              updatedUser.role || profile.role,
            status:
              updatedUser.status ||
              profile.status,
          };

          setProfile(newProfile);
          globalAdminProfileCache.profile = newProfile;

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
        console.error(
          "Profile update failed:",
          error
        );

        setMessageType("error");
        setMessage(
          error.message ||
            "Unable to update profile."
        );
      } finally {
        setSaving(false);
      }
    },
    [
      profile,
      imageFile,
      fileToDataUrl,
    ]
  );

  const handleNotificationToggle = useCallback(
    async (field) => {
      const previousValue = notifications[field];
      const newValue = !previousValue;

      const updatedNotifs = {
        ...notifications,
        [field]: newValue,
      };

      setNotifications(updatedNotifs);
      globalAdminProfileCache.notifications = updatedNotifs;

      try {
        setSavingNotification(true);
        setMessage("");

        await authService.updateProfile({
          notificationPreferences: {
            [field]: newValue,
          },
        });

        setMessageType("success");
        setMessage(
          "Notification preference updated."
        );
      } catch (error) {
        console.error(
          "Notification preference update failed:",
          error
        );

        const revertedNotifs = {
          ...notifications,
          [field]: previousValue,
        };

        setNotifications(revertedNotifs);
        globalAdminProfileCache.notifications = revertedNotifs;

        setMessageType("error");
        setMessage(
          error.message ||
            "Unable to update notification preference."
        );
      } finally {
        setSavingNotification(false);
      }
    },
    [notifications]
  );

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center bg-[#f7f8fc]">
        <div className="flex flex-col items-center gap-3">
          <Loader2
            size={32}
            className="animate-spin text-violet-600"
          />

          <p className="text-sm font-semibold text-slate-500">
            Loading settings...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-x-hidden bg-[#f7f8fc] text-slate-900">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      <main className="relative w-full p-5 sm:p-6 lg:p-8">
        <div className="w-full space-y-6">
          <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-violet-50/80 px-3 py-1 text-xs font-bold text-violet-700">
                <ShieldCheck size={14} />
                ADMINISTRATION
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Settings
              </h1>

              <p className="mt-1 text-sm font-medium text-slate-500">
                Manage your administrator profile,
                notifications, and security preferences.
              </p>
            </div>
          </section>

          {message && (
            <div
              className={`flex items-center gap-3 rounded-2xl border p-4 shadow-sm ${
                messageType === "error"
                  ? "border-rose-100 bg-rose-50/90 text-rose-700"
                  : "border-emerald-100 bg-emerald-50/90 text-emerald-700"
              }`}
            >
              {messageType === "error" ? (
                <AlertCircle
                  size={18}
                  className="shrink-0 text-rose-600"
                />
              ) : (
                <CheckCircle2
                  size={18}
                  className="shrink-0 text-emerald-600"
                />
              )}

              <p className="text-sm font-bold">
                {message}
              </p>
            </div>
          )}

          <form
            onSubmit={handleSave}
            className="w-full"
          >
            <section className="w-full overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]">
              <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4.5 sm:px-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-500 text-white shadow-md shadow-purple-500/10">
                    <UserCog size={19} />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Administrator Profile
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-400">
                      Update your administrator account
                      information.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6 p-6 sm:p-8">
                <div className="flex w-full flex-col gap-5 rounded-2xl border border-slate-200/80 bg-gradient-to-r from-violet-50/40 via-purple-50/30 to-pink-50/30 p-5 sm:flex-row sm:items-center">
                  <div className="relative h-24 w-24 shrink-0">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-white text-2xl font-extrabold text-violet-600 shadow-md">
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
                      className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md transition duration-150 hover:bg-violet-700 active:scale-95"
                      aria-label="Upload profile image"
                    >
                      <Camera size={15} />
                    </button>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Profile Image
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Upload a profile image for your
                      administrator account.
                    </p>

                    <p className="mt-1 text-[11px] font-medium text-slate-400">
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
                      className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                    >
                      <Camera size={14} />
                      Choose Image
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="w-full">
                    <label
                      htmlFor="admin-name"
                      className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600"
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
                      className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                    />
                  </div>

                  <div className="w-full">
                    <label
                      htmlFor="admin-email"
                      className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600"
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
                      className="h-11 w-full cursor-not-allowed rounded-2xl border border-slate-200/80 bg-slate-100/70 px-4 text-sm font-medium text-slate-400 outline-none"
                    />

                    <p className="mt-1 text-[11px] font-medium text-slate-400">
                      Email address is managed by the
                      authentication system.
                    </p>
                  </div>

                  <div className="w-full">
                    <label
                      htmlFor="admin-phone"
                      className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600"
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
                      className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                    />
                  </div>

                  <div className="w-full">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                      Assigned Role
                    </label>

                    <input
                      type="text"
                      value={
                        profile.role?.toUpperCase() ||
                        "ADMIN"
                      }
                      readOnly
                      className="h-11 w-full cursor-not-allowed rounded-2xl border border-slate-200/80 bg-slate-100/70 px-4 text-sm font-bold text-violet-700 outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end border-t border-slate-100 pt-5">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition duration-150 hover:-translate-y-0.5 hover:bg-violet-700 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <Loader2
                          size={16}
                          className="animate-spin"
                        />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>
          </form>

          <section className="w-full overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]">
            <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4.5 sm:px-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-500 text-white shadow-md shadow-purple-500/10">
                  <Bell size={19} />
                </div>

                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Notification Settings
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-400">
                    Manage your workspace notification
                    preferences.
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

          <section className="w-full overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]">
            <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4.5 sm:px-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-500 text-white shadow-md shadow-purple-500/10">
                  <Lock size={19} />
                </div>

                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Security
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-400">
                    Manage your account authentication
                    settings.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex w-full flex-col gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Password & Authentication
                  </h3>

                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    Password management is handled by the
                    backend authentication system.
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
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                >
                  Manage Security
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function SettingRow({
  title,
  description,
  enabled,
  disabled,
  onToggle,
}) {
  return (
    <div className="flex w-full flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <div>
        <h3 className="text-sm font-bold text-slate-900">
          {title}
        </h3>

        <p className="mt-0.5 max-w-2xl text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>

      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={enabled}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 ${
          enabled ? "bg-violet-600" : "bg-slate-200"
        }`}
      >
        <span
          className={`mt-1 inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
            enabled
              ? "translate-x-6"
              : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}