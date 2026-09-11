"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  Camera,
  Check,
  Loader2,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { authService } from "@/services/authService";

export default function ManagerSettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    avatar: "",
  });

  /* =====================================================
     LOAD MANAGER PROFILE
  ===================================================== */

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        setLoading(true);
        setError("");

        const response = await authService.me();

        if (!mounted) return;

        if (!response) {
          router.replace("/login");
          return;
        }

        const user =
          response?.user ||
          response?.data?.user ||
          response?.data ||
          response;

        if (!user) {
          router.replace("/login");
          return;
        }

        const role = String(user?.role || "")
          .trim()
          .toLowerCase();

        if (role !== "manager") {
          if (role === "admin") {
            router.replace("/admin");
          } else {
            router.replace("/user");
          }

          return;
        }

        setProfile({
          name: user?.name || user?.fullName || "",
          email: user?.email || "",
          avatar:
            user?.avatar ||
            user?.profileImage ||
            user?.profilePicture ||
            user?.image ||
            "",
        });
      } catch (err) {
        if (!mounted) return;

        if (err?.message === "UNAUTHORIZED") {
          router.replace("/login");
          return;
        }

        setError(
          err?.message ||
            "Unable to load your manager profile."
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [router]);

  /* =====================================================
     PROFILE CHANGE
  ===================================================== */

  function handleProfileChange(event) {
    const { name, value } = event.target;

    setProfile((previous) => ({
      ...previous,
      [name]: value,
    }));

    setSaved(false);
    setError("");
  }

  /* =====================================================
     IMAGE SELECT
  ===================================================== */

  function handleProfileImageClick() {
    fileInputRef.current?.click();
  }

  /* =====================================================
     IMAGE COMPRESSION
  ===================================================== */

  function compressImage(
    file,
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.8
  ) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);

      image.onload = () => {
        URL.revokeObjectURL(objectUrl);

        let width = image.width;
        let height = image.height;

        const ratio = Math.min(
          maxWidth / width,
          maxHeight / height,
          1
        );

        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        const canvas = document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");

        if (!context) {
          reject(
            new Error(
              "Unable to process the selected image."
            )
          );
          return;
        }

        context.drawImage(
          image,
          0,
          0,
          width,
          height
        );

        resolve(
          canvas.toDataURL("image/jpeg", quality)
        );
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);

        reject(
          new Error(
            "The selected image could not be processed."
          )
        );
      };

      image.src = objectUrl;
    });
  }

  /* =====================================================
     IMAGE CHANGE
  ===================================================== */

  async function handleProfileImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setSaved(false);

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(
        "Profile picture must be smaller than 5MB."
      );
      event.target.value = "";
      return;
    }

    try {
      const compressedImage =
        await compressImage(file);

      setProfile((previous) => ({
        ...previous,
        avatar: compressedImage,
      }));
    } catch (err) {
      setError(
        err?.message ||
          "Unable to process profile picture."
      );
    }
  }

  /* =====================================================
     REMOVE IMAGE
  ===================================================== */

  function handleRemoveProfileImage() {
    setProfile((previous) => ({
      ...previous,
      avatar: "",
    }));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setSaved(false);
    setError("");
  }

  /* =====================================================
     SAVE SETTINGS
  ===================================================== */

  async function handleSave(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setSaved(false);
      setError("");

      const response =
        await authService.updateProfile({
          name: profile.name.trim(),
          email: profile.email.trim(),
          avatar: profile.avatar || "",
        });

      const updatedUser =
        response?.user ||
        response?.data?.user ||
        response?.data ||
        null;

      if (updatedUser) {
        setProfile((previous) => ({
          ...previous,

          name:
            updatedUser?.name ||
            updatedUser?.fullName ||
            previous.name,

          email:
            updatedUser?.email ||
            previous.email,

          avatar:
            updatedUser?.avatar ||
            updatedUser?.profileImage ||
            updatedUser?.profilePicture ||
            updatedUser?.image ||
            previous.avatar,
        }));
      }

      setSaved(true);
    } catch (err) {
      if (err?.message === "UNAUTHORIZED") {
        router.replace("/login");
        return;
      }

      setError(
        err?.message ||
          "Unable to save profile settings."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =====================================================
     INITIALS
  ===================================================== */

  const initials =
    profile.name
      ?.trim()
      ?.charAt(0)
      ?.toUpperCase() || "M";

  /* =====================================================
     PAGE
  ===================================================== */

  return (
    <main className="min-h-[calc(100vh-4rem)] w-full bg-[#F8FAFC] p-5 sm:p-6 lg:p-8">
      <div className="w-full space-y-6">

        {/* =================================================
            PAGE HEADING
        ================================================= */}

        <section className="w-full">
          <p className="text-sm font-semibold text-[#2563EB]">
            MANAGER WORKSPACE
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
            Settings
          </h1>

          <p className="mt-2 text-sm text-[#64748B]">
            Manage your manager account and workspace
            preferences.
          </p>
        </section>

        {/* =================================================
            ERROR
        ================================================= */}

        {!loading && error && (
          <section className="w-full rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>
          </section>
        )}

        {/* =================================================
            SUCCESS
        ================================================= */}

        {!loading && saved && !error && (
          <section className="flex w-full items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4">
            <Check
              size={18}
              className="shrink-0 text-green-600"
            />

            <p className="text-sm font-semibold text-green-700">
              Profile settings saved successfully.
            </p>
          </section>
        )}

        {/* =================================================
            LOADING
        ================================================= */}

        {loading ? (
          <section className="flex min-h-[500px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2
                size={30}
                className="animate-spin text-[#2563EB]"
              />

              <p className="text-sm font-medium text-[#64748B]">
                Loading your settings...
              </p>
            </div>
          </section>
        ) : (
          <form
            onSubmit={handleSave}
            className="w-full space-y-6"
          >

            {/* =================================================
                PROFILE SETTINGS
            ================================================= */}

            <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

              <div className="border-b border-slate-100 px-5 py-5 sm:px-6 lg:px-8">
                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                    <UserRound size={19} />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-[#171B3A]">
                      Profile Settings
                    </h2>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Manage your manager profile
                      information.
                    </p>
                  </div>

                </div>
              </div>

              {/* =================================================
                  PROFILE IMAGE
              ================================================= */}

              <div className="border-b border-slate-100 px-5 py-7 sm:px-6 lg:px-8">

                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">

                  <div className="relative shrink-0">

                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-[#EEF4FF] bg-[#2563EB] text-2xl font-bold text-white shadow-sm">

                      {profile.avatar ? (
                        <img
                          src={profile.avatar}
                          alt="Manager profile"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials
                      )}

                    </div>

                    <button
                      type="button"
                      onClick={handleProfileImageClick}
                      className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#2563EB] text-white shadow-md transition hover:bg-[#1D4ED8]"
                      aria-label="Change profile picture"
                    >
                      <Camera size={16} />
                    </button>

                  </div>

                  <div className="min-w-0">

                    <h3 className="text-sm font-bold text-[#171B3A]">
                      Profile Picture
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-[#64748B]">
                      Upload a profile picture for your
                      manager account.
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">

                      <button
                        type="button"
                        onClick={handleProfileImageClick}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#1D4ED8]"
                      >
                        <Camera size={16} />
                        Upload Photo
                      </button>

                      {profile.avatar && (
                        <button
                          type="button"
                          onClick={
                            handleRemoveProfileImage
                          }
                          className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D]"
                        >
                          Remove Photo
                        </button>
                      )}

                    </div>

                    <p className="mt-2 text-[11px] text-slate-400">
                      JPG, JPEG, PNG or WEBP · Maximum 5MB
                    </p>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleProfileImageChange}
                      className="hidden"
                    />

                  </div>

                </div>

              </div>

              {/* =================================================
                  NAME / EMAIL
              ================================================= */}

              <div className="grid w-full grid-cols-1 gap-5 p-5 sm:p-6 lg:grid-cols-2 lg:p-8">

                <div className="w-full">
                  <label
                    htmlFor="name"
                    className="mb-2 block text-sm font-semibold text-[#26344D]"
                  >
                    Name
                  </label>

                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={profile.name}
                    onChange={handleProfileChange}
                    placeholder="Manager name"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>

                <div className="w-full">
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-[#26344D]"
                  >
                    Email Address
                  </label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={profile.email}
                    onChange={handleProfileChange}
                    placeholder="manager@example.com"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>

              </div>

            </section>

            {/* =================================================
                ACCOUNT INFORMATION
            ================================================= */}

            <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

              <div className="border-b border-slate-100 px-5 py-5 sm:px-6 lg:px-8">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                    <ShieldCheck size={19} />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-[#171B3A]">
                      Account Information
                    </h2>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Your workspace role and access
                      information.
                    </p>
                  </div>

                </div>

              </div>

              <div className="grid w-full grid-cols-1 gap-5 p-5 sm:p-6 lg:grid-cols-2 lg:p-8">

                <InfoItem
                  label="Workspace Role"
                  value="Manager"
                />

                <InfoItem
                  label="Account Status"
                  value="Active"
                />

              </div>

            </section>

            {/* =================================================
                ACTIONS
            ================================================= */}

            <div className="flex w-full flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">

              <Link
                href="/manager"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-6 text-sm font-semibold text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D]"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-6 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Save size={17} />
                )}

                {saving
                  ? "Saving..."
                  : "Save Settings"}
              </button>

            </div>

          </form>
        )}

        {/* =================================================
            BACKEND STATUS
        ================================================= */}

        {!loading && (
          <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-8">

            <div className="flex items-start gap-3">

              <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />

              <div className="min-w-0">

                <h2 className="text-sm font-bold text-[#171B3A]">
                  
                </h2>

                <p className="mt-1 text-xs leading-5 text-[#64748B]">
                  Manager profile is loaded from the
                  authenticated backend account. Name,
                  email and profile picture are saved
                  through the authenticated profile API.
                </p>

              </div>

            </div>

          </section>
        )}

      </div>
    </main>
  );
}

/* =====================================================
   INFO ITEM
===================================================== */

function InfoItem({ label, value }) {
  return (
    <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold text-[#26344D]">
        {value}
      </p>
    </div>
  );
}