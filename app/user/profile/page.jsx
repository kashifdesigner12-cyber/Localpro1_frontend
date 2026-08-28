"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  Camera,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Phone,
  Save,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import { authService } from "@/services/authService";

const navigation = [
  {
    label: "Dashboard",
    href: "/user",
    icon: LayoutDashboard,
  },
  {
    label: "Tasks",
    href: "/user/tasks",
    icon: ClipboardList,
  },
  {
    label: "Calendar",
    href: "/user/calendar",
    icon: CalendarDays,
  },
  {
    label: "Messages",
    href: "/user/messages",
    icon: MessageSquare,
  },
  {
    label: "Activity",
    href: "/user/activity",
    icon: Activity,
  },
  {
    label: "Settings",
    href: "/user/settings",
    icon: Settings,
  },
];

export default function UserProfilePage() {
  const pathname = usePathname();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [profileImage, setProfileImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [user, setUser] = useState(null);

  // =====================================================
  // LOAD CURRENT USER PROFILE
  // GET /api/auth/me
  // =====================================================

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await authService.me();

        if (!mounted) {
          return;
        }

        if (!response?.user) {
          router.replace("/login");
          return;
        }

        const currentUser = response.user;

        setUser(currentUser);

        setForm({
          name: currentUser.name || "",
          email: currentUser.email || "",
          phone: currentUser.phone || "",
        });

        setImagePreview(currentUser.avatar || "");
      } catch (err) {
        if (!mounted) {
          return;
        }

        console.error("Profile load error:", err);

        setError(
          err?.message ||
            "Unable to load your profile."
        );
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

  // =====================================================
  // CLEANUP IMAGE PREVIEW
  // =====================================================

  useEffect(() => {
    return () => {
      if (
        imagePreview &&
        imagePreview.startsWith("blob:")
      ) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // =====================================================
  // FORM CHANGE
  // =====================================================

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setSaved(false);
    setError("");
  }

  // =====================================================
  // IMAGE SELECT
  // =====================================================

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    const maxSize = 1 * 1024 * 1024;

    if (file.size > maxSize) {
      setError(
        "Profile image must be smaller than 1MB."
      );
      return;
    }

    setProfileImage(file);

    const previewUrl = URL.createObjectURL(file);

    setImagePreview(previewUrl);
    setSaved(false);
    setError("");
  }

  // =====================================================
  // CONVERT IMAGE TO DATA URL
  //
  // Current backend has no upload endpoint.
  // avatar is a String field.
  //
  // Therefore this temporarily converts the selected
  // image into a data URL so the existing avatar field
  // can persist it.
  // =====================================================

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

  // =====================================================
  // SAVE PROFILE
  // PUT /api/auth/me
  // =====================================================

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaving(true);
    setSaved(false);
    setError("");

    try {
      let avatar = user?.avatar || null;

      // Convert newly selected image into a string
      // because backend currently accepts avatar as String.
      if (profileImage) {
        avatar = await fileToDataUrl(profileImage);
      }

      const response =
        await authService.updateProfile({
          name: form.name,
          phone: form.phone,
          avatar,
        });

      if (!response?.user) {
        throw new Error(
          "Profile was saved but no updated user was returned."
        );
      }

      const updatedUser = response.user;

      // Update local React state with actual backend response.
      setUser(updatedUser);

      setForm({
        name: updatedUser.name || "",
        email: updatedUser.email || "",
        phone: updatedUser.phone || "",
      });

      setImagePreview(updatedUser.avatar || "");
      setProfileImage(null);

      setSaved(true);

      // Remove temporary blob preview if needed.
      if (
        imagePreview &&
        imagePreview.startsWith("blob:")
      ) {
        URL.revokeObjectURL(imagePreview);
      }
    } catch (err) {
      console.error("Profile save error:", err);

      setError(
        err?.message ||
          "Unable to save profile changes."
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // LOGOUT
  // =====================================================

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);

      await authService.logout();

      router.replace("/login");
    } catch (err) {
      console.error("Logout error:", err);

      setError(
        err?.message ||
          "Unable to logout."
      );

      setLoggingOut(false);
    }
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#EEF4FF] border-t-[#2563EB]" />

          <p className="mt-4 text-sm font-semibold text-[#64748B]">
            Loading your profile...
          </p>
        </div>
      </div>
    );
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#171B3A] shadow-xl transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-sm">
              <ShieldCheck size={22} />
            </div>

            <div>
              <h1 className="text-sm font-bold text-white">
                Local Pro 1
              </h1>

              <p className="text-[11px] font-medium text-slate-300">
                User Workspace
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setSidebarOpen(false)
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-300">
            Workspace
          </p>

          <div className="space-y-1.5">
            {navigation.map((item) => (
              <UserNavItem
                key={item.href}
                item={item}
                pathname={pathname}
                onNavigate={() =>
                  setSidebarOpen(false)
                }
              />
            ))}
          </div>
        </nav>

        {/* User Area */}
        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-xl px-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2563EB] text-xs font-bold text-white">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name || "User"}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(user?.name)
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {user?.name || "User"}
              </p>

              <p className="truncate text-xs font-medium capitalize text-slate-300">
                {user?.role || "user"} Account
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut size={17} />

            <span>
              {loggingOut
                ? "Signing Out..."
                : "Sign Out"}
            </span>
          </button>
        </div>
      </aside>

      {/* =================================================
          MAIN AREA
      ================================================= */}

      <div className="lg:pl-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-[#26344D] transition hover:bg-slate-50 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

            <div>
              <p className="text-xs font-medium text-[#64748B]">
                Workspace
              </p>

              <p className="text-sm font-bold text-[#171B3A]">
                Profile
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#64748B] transition hover:bg-slate-100 hover:text-[#26344D]"
              aria-label="Notifications"
            >
              <Bell size={18} />
            </button>

            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#EEF4FF] text-xs font-bold text-[#2563EB]">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name || "User"}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(user?.name)
              )}
            </div>
          </div>
        </header>

        {/* =================================================
            CONTENT
        ================================================= */}

        <main className="min-h-[calc(100vh-4rem)] p-5 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-5xl space-y-6">
            {/* Heading */}
            <section>
              <p className="text-sm font-semibold text-[#2563EB]">
                ACCOUNT
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
                My Profile
              </h1>

              <p className="mt-2 text-sm text-[#64748B]">
                View and manage your personal account
                information.
              </p>
            </section>

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
              >
                {error}
              </div>
            )}

            {/* Success */}
            {saved && (
              <div
                role="status"
                className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700"
              >
                Profile updated successfully.
              </div>
            )}

            {/* =================================================
                PROFILE HEADER
            ================================================= */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-28 bg-[#171B3A]" />

              <div className="px-5 pb-5 sm:px-6 sm:pb-6">
                <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex items-end gap-4">
                    {/* Profile Image */}
                    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-[#EEF4FF] text-[#2563EB] shadow-sm">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt={
                            user?.name ||
                            "Profile"
                          }
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserRound size={38} />
                      )}

                      {/* Image Upload */}
                      <label
                        htmlFor="profileImage"
                        className="absolute bottom-0 right-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-[#2563EB] text-white shadow-sm transition hover:bg-[#1D4ED8]"
                        title="Change profile picture"
                      >
                        <Camera size={16} />

                        <input
                          id="profileImage"
                          type="file"
                          accept="image/*"
                          onChange={
                            handleImageChange
                          }
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="pb-1">
                      <h2 className="text-lg font-bold text-[#171B3A]">
                        {user?.name ||
                          "User Profile"}
                      </h2>

                      <p className="mt-1 text-sm capitalize text-[#64748B]">
                        {user?.role ||
                          "user"}{" "}
                        Workspace Member
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-bold ${
                      user?.status ===
                      "Active"
                        ? "bg-green-50 text-green-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {user?.status ||
                      "Active"}{" "}
                    Account
                  </span>
                </div>

                <p className="mt-4 text-xs text-slate-400">
                  Profile information is loaded from
                  your backend account.
                </p>
              </div>
            </section>

            {/* =================================================
                PROFILE FORM
            ================================================= */}

            <form
              onSubmit={handleSubmit}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                    <UserRound size={19} />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-[#171B3A]">
                      Personal Information
                    </h2>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Update your profile information
                      below.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                {/* Name */}
                <div>
                  <label
                    htmlFor="name"
                    className="mb-2 block text-sm font-semibold text-[#26344D]"
                  >
                    Full Name
                  </label>

                  <div className="relative">
                    <UserRound
                      size={17}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="name"
                      name="name"
                      type="text"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Your full name"
                      required
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-[#26344D]"
                  >
                    Email Address
                  </label>

                  <div className="relative">
                    <Mail
                      size={17}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      readOnly
                      className="h-11 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-[#64748B] outline-none"
                    />
                  </div>

                  <p className="mt-2 text-xs text-slate-400">
                    Email is managed through your
                    authenticated account.
                  </p>
                </div>

                {/* Phone */}
                <div>
                  <label
                    htmlFor="phone"
                    className="mb-2 block text-sm font-semibold text-[#26344D]"
                  >
                    Phone Number
                  </label>

                  <div className="relative">
                    <Phone
                      size={17}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="Your phone number"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#26344D]">
                    Workspace Role
                  </label>

                  <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4">
                    <span className="text-sm font-semibold capitalize text-[#64748B]">
                      {user?.role ||
                        "user"}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-400">
                    Your workspace role is managed by
                    an administrator.
                  </p>
                </div>

                {/* Status */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#26344D]">
                    Account Status
                  </label>

                  <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4">
                    <span className="text-sm font-semibold text-[#64748B]">
                      {user?.status ||
                        "Active"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                  <Link
                    href="/user"
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-semibold text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D]"
                  >
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save size={17} />

                    {saving
                      ? "Saving..."
                      : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>

            {/* =================================================
                CONTACT INFORMATION
            ================================================= */}

            <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <ProfileInfoCard
                icon={Mail}
                title="Email"
                value={
                  user?.email ||
                  "No email available"
                }
              />

              <ProfileInfoCard
                icon={Phone}
                title="Phone"
                value={
                  user?.phone ||
                  "No phone number added"
                }
              />
            </section>

            {/* =================================================
                BACKEND STATUS
            ================================================= */}

            <section className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />

                <div>
                  <h2 className="text-sm font-bold text-green-800">
                    Profile Connected
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-green-700">
                    Your profile is connected to the
                    backend. Changes are saved to the
                    authenticated user's database record
                    and will be loaded again when you
                    refresh the page.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

// =====================================================
// NAV ITEM
// =====================================================

function UserNavItem({
  item,
  pathname,
  onNavigate,
}) {
  const Icon = item.icon;

  const isActive =
    pathname === item.href ||
    (item.href !== "/user" &&
      pathname.startsWith(
        `${item.href}/`
      ));

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
        isActive
          ? "bg-[#2563EB] text-white shadow-sm"
          : "bg-transparent text-white hover:bg-white/10 hover:text-white"
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
}

// =====================================================
// INFO CARD
// =====================================================

function ProfileInfoCard({
  icon: Icon,
  title,
  value,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
          <Icon size={18} />
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#171B3A]">
            {title}
          </h3>

          <p className="mt-1 break-words text-sm text-[#64748B]">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// INITIALS
// =====================================================

function getInitials(name) {
  if (!name) {
    return "U";
  }

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}