import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Save, UserRound, CalendarDays, RefreshCw } from "lucide-react";
import api from "../../services/api";

export default function Profile({ user: initialUser, onUserUpdate }) {
  const [profile, setProfile] = useState({
    name: initialUser?.name || initialUser?.username || "",
    profilePicture: initialUser?.profilePicture || "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [photoFile, setPhotoFile] = useState(null);

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

  const loadProfile = useCallback(async () => {
    try {
      const response = await api.get("/auth/me");
      const user = response.data?.user || response.data?.data || response.data;
      if (!user) return;

      setProfile({
        name: user.name || user.username || "",
        profilePicture: user.profilePicture || "",
      });
    } catch {
      setMessage("Unable to load profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handlePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Please select a valid image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Image must be smaller than 5 MB.");
      return;
    }

    setPhotoFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setProfile((current) => ({
        ...current,
        profilePicture: String(reader.result || ""),
      }));
      setMessage("");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!profile.name.trim()) {
      setMessage("Name is required.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await api.patch("/auth/me", {
        name: profile.name.trim(),
        profilePicture: profile.profilePicture,
      });

      const savedUser =
        response.data?.user ||
        response.data?.data ||
        response.data ||
        {};

      onUserUpdate?.({
        ...(initialUser || {}),
        ...savedUser,
        name: profile.name.trim(),
        profilePicture: profile.profilePicture,
        email: initialUser?.email,
        role: initialUser?.role,
      });

      setPhotoFile(null);
      setMessage("Profile updated successfully.");
    } catch (error) {
      setMessage(
        error?.response?.data?.message || "Unable to save profile."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center max-w-7xl mx-auto">
        <RefreshCw size={28} className="mx-auto animate-spin text-violet-600" />
        <p className="mt-3 text-sm text-slate-400">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-3xl p-6 shadow-xs border border-slate-100">
        <div>
          <span className="text-xs font-bold tracking-wider text-violet-600 uppercase">
            Account Management
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Admin Profile
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
          className="rounded-2xl border border-slate-200/80 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 shadow-xs"
        >
          {message}
        </div>
      )}

      {/* Profile Form Container */}
      <form
        onSubmit={handleSave}
        className="space-y-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-xs sm:p-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 pb-6 border-b border-slate-100">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-50 text-violet-600 border border-violet-100 shadow-xs">
            {profile.profilePicture ? (
              <img
                src={profile.profilePicture}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : (
              <UserRound size={40} />
            )}
          </div>

          <div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100">
              <Camera size={17} className="text-violet-600" />
              Change Photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhoto}
              />
            </label>
            <p className="mt-2 text-xs text-slate-400">
              Recommended: Square image, max 5 MB (PNG, JPG, WEBP).
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label
              htmlFor="admin-profile-name"
              className="mb-2 block text-sm font-bold text-slate-800"
            >
              Full Name *
            </label>
            <input
              id="admin-profile-name"
              value={profile.name}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              required
              className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-800">
              Email Address
            </label>
            <input
              value={initialUser?.email || ""}
              readOnly
              className="min-h-11 w-full rounded-2xl border border-slate-200/60 bg-slate-100/60 px-4 text-sm font-semibold text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-800">
              Account Role
            </label>
            <input
              value={initialUser?.role || ""}
              readOnly
              className="min-h-11 w-full rounded-2xl border border-slate-200/60 bg-slate-100/60 px-4 text-sm font-semibold uppercase text-slate-500 cursor-not-allowed"
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-5">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50 active:scale-95"
          >
            <Save size={18} />
            {saving ? "Saving Changes..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}