"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  Camera,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Phone,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Clock3,
  UserRound,
  X,
  Sparkles,
  Loader2,
} from "lucide-react";

import { authService } from "@/services/authService";

const CACHE_TIME = 60 * 1000;

const navigation = [
  { label: "Dashboard", href: "/user", icon: LayoutDashboard },
  { label: "My Tasks", href: "/user/tasks", icon: ClipboardList },
  { label: "Calendar", href: "/user/calendar", icon: CalendarDays },
  { label: "Attendance", href: "/user/attendance", icon: Clock3 },
  { label: "Messages", href: "/user/messages", icon: MessageSquare },
  { label: "Notifications", href: "/user/notifications", icon: Bell },
  { label: "Leave Requests", href: "/user/leave-requests", icon: FileText },
  { label: "Profile", href: "/user/profile", icon: UserRound },
  { label: "Settings", href: "/user/settings", icon: Settings },
  { label: "Policies", href: "/user/policies", icon: ShieldCheck },
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

  const [loading, setLoading] = useState(false); // Instant render
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [user, setUser] = useState(() => extractUser(authService?.getUser?.()));

  const cacheRef = useRef({ timestamp: 0, data: null });
  const loadingRef = useRef(false);

  /* =========================================================
     LOAD PROFILE (Speed Optimized & Cached)
  ========================================================= */

  const loadProfile = useCallback(
    async (force = false) => {
      if (loadingRef.current) return;

      const now = Date.now();
      if (
        !force &&
        cacheRef.current.data &&
        now - cacheRef.current.timestamp < CACHE_TIME
      ) {
        return;
      }

      loadingRef.current = true;
      if (force) setRefreshing(true);

      try {
        setError("");
        const response = await authService.me();
        const currentUser = extractUser(response);

        if (!currentUser) {
          router.replace("/login");
          return;
        }

        setUser(currentUser);
        setForm({
          name: currentUser.name || "",
          email: currentUser.email || "",
          phone: currentUser.phone || "",
        });
        setImagePreview(currentUser.avatar || "");

        cacheRef.current = {
          timestamp: Date.now(),
          data: currentUser,
        };
      } catch (err) {
        console.error("Profile load error:", err);
        if (err?.status === 401 || err?.status === 403) {
          router.replace("/login");
          return;
        }
        setError(err?.message || "Unable to load your profile.");
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    loadProfile(false);
  }, [loadProfile]);

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
    setSaved(false);
    setError("");
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    const maxSize = 1 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("Profile image must be smaller than 1MB.");
      return;
    }

    setProfileImage(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setSaved(false);
    setError("");
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Unable to process profile image."));
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setSaved(false);
    setError("");

    try {
      let avatar = user?.avatar || null;

      if (profileImage) {
        avatar = await fileToDataUrl(profileImage);
      }

      const response = await authService.updateProfile({
        name: form.name,
        phone: form.phone,
        avatar,
      });

      const updatedUser = extractUser(response);
      if (!updatedUser) {
        throw new Error("Profile was saved but no updated user was returned.");
      }

      setUser(updatedUser);
      setForm({
        name: updatedUser.name || "",
        email: updatedUser.email || "",
        phone: updatedUser.phone || "",
      });

      setImagePreview(updatedUser.avatar || "");
      setProfileImage(null);
      setSaved(true);

      cacheRef.current.timestamp = 0; // Invalidate cache

      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    } catch (err) {
      console.error("Profile save error:", err);
      setError(err?.message || "Unable to save profile changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    if (loggingOut) return;

    try {
      setLoggingOut(true);
      await authService.logout();
      router.replace("/login");
    } catch (err) {
      console.error("Logout error:", err);
      setError(err?.message || "Unable to logout.");
      setLoggingOut(false);
    }
  }

  const userName = user?.name || form.name || "User";
  const userInitial = String(userName).trim().charAt(0).toUpperCase() || "U";
  const userEmail = user?.email || form.email || "User Account";

  return (
    <div className="relative min-h-screen w-full bg-[#f7f8fc] text-slate-900 animate-fadeIn">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl animate-pulse" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* SIDEBAR (Matching Admin Dark Theme & Animations) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#171B3A] text-white shadow-2xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <Link
            href="/user"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 text-white"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-md shadow-purple-600/20">
              <ShieldCheck size={22} />
            </div>

            <div>
              <h1 className="text-sm font-bold text-white">Local Pro 1</h1>
              <p className="text-[11px] font-semibold text-violet-400">
                User Workspace
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Workspace
          </p>

          <div className="space-y-1.5">
            {navigation.map((item) => (
              <UserNavItem
                key={item.href}
                item={item}
                pathname={pathname}
                onNavigate={() => setSidebarOpen(false)}
              />
            ))}
          </div>
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-600 text-xs font-bold text-white">
              {user?.avatar ? (
                <img src={user.avatar} alt={userName} className="h-full w-full object-cover" />
              ) : (
                userInitial
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{userName}</p>
              <p className="truncate text-xs font-medium text-slate-400">{userEmail}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-60"
          >
            {loggingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="min-h-screen w-full lg:pl-64">
        {/* TOP BAR */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-5 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

            <div>
              <p className="text-xs font-semibold text-slate-400">Workspace</p>
              <p className="text-sm font-bold text-slate-900">Profile</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => loadProfile(true)}
              disabled={refreshing}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-violet-50 hover:text-violet-600 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin text-violet-600" : ""} />
            </button>

            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-sm">
              {user?.avatar ? (
                <img src={user.avatar} alt={userName} className="h-full w-full object-cover" />
              ) : (
                userInitial
              )}
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 animate-slideUp">
          <div className="mx-auto max-w-5xl space-y-6">

            {/* HEADER SECTION (NO BANNER) */}
            <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/80 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-violet-700">
                  <ShieldCheck size={13} />
                  ACCOUNT DETAILS
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  My Profile
                </h1>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  View and manage your personal account information and avatar.
                </p>
              </div>
            </section>

            {error && (
              <section className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs font-bold text-rose-700 shadow-sm">
                <div className="flex items-center justify-between">
                  <p>{error}</p>
                  <button onClick={() => setError("")} className="text-rose-400 hover:text-rose-600">
                    <X size={16} />
                  </button>
                </div>
              </section>
            )}

            {saved && (
              <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs font-bold text-emerald-700 shadow-sm">
                Profile updated successfully.
              </section>
            )}

            {/* PROFILE HEADER CARD */}
            <section className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]">
              <div className="h-32 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-500" />

              <div className="px-6 pb-6 sm:px-8">
                <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex items-end gap-4">
                    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[24px] border-4 border-white bg-violet-50 text-violet-600 shadow-md">
                      {imagePreview ? (
                        <img src={imagePreview} alt={userName} className="h-full w-full object-cover" />
                      ) : (
                        <UserRound size={36} />
                      )}

                      <label
                        htmlFor="profileImage"
                        className="absolute bottom-1 right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-white bg-violet-600 text-white shadow-sm transition hover:bg-violet-700"
                        title="Change profile picture"
                      >
                        <Camera size={14} />
                        <input
                          id="profileImage"
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="pb-1">
                      <h2 className="text-lg font-extrabold text-slate-900">{userName}</h2>
                      <p className="mt-0.5 text-xs font-semibold capitalize text-violet-600">
                        {user?.role || "user"} Workspace Member
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-600 border border-emerald-100">
                    {user?.status || "Active"} Account
                  </span>
                </div>
              </div>
            </section>

            {/* PROFILE FORM */}
            <form onSubmit={handleSubmit} className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]">
              <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4.5">
                <h2 className="text-base font-bold text-slate-900">Personal Information</h2>
                <p className="text-xs text-slate-500">Update your account settings below.</p>
              </div>

              <div className="space-y-4 p-6 sm:p-8">
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserRound size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="name"
                      name="name"
                      type="text"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Your full name"
                      required
                      className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 pl-11 pr-4 text-xs font-medium text-slate-700 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      readOnly
                      className="h-11 w-full cursor-not-allowed rounded-2xl border border-slate-200/90 bg-slate-100/70 pl-11 pr-4 text-xs font-medium text-slate-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="phone" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="Your phone number"
                      className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 pl-11 pr-4 text-xs font-medium text-slate-700 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 text-xs font-bold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>{saving ? "Saving changes..." : "Save Changes"}</span>
                  </button>
                </div>
              </div>
            </form>

            {/* CONTACT CARDS */}
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ProfileInfoCard icon={Mail} title="Email" value={user?.email || "No email available"} />
              <ProfileInfoCard icon={Phone} title="Phone" value={user?.phone || "No phone number added"} />
            </section>

          </div>
        </main>
      </div>
    </div>
  );
}

function UserNavItem({ item, pathname, onNavigate }) {
  const Icon = item.icon;
  const isActive =
    pathname === item.href ||
    (item.href !== "/user" && pathname.startsWith(`${item.href}/`));

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold transition duration-150 ${
        isActive
          ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon size={18} className={`transition duration-150 ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`} />
      <span>{item.label}</span>
    </Link>
  );
}

function ProfileInfoCard({ icon: Icon, title, value }) {
  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(45,35,100,0.06)]">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <Icon size={19} />
        </div>
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-slate-400">{title}</h3>
          <p className="mt-1 break-words text-sm font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function extractUser(response) {
  return response?.user || response?.data?.user || response?.data || response || null;
}