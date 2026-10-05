"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Save,
  Shield,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.localpro1.net/api";

function PreviewCard({ label, value, subtitle }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white/80 p-3.5 backdrop-blur-sm transition duration-150 hover:border-violet-100">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-bold text-slate-900">
        {value}
      </p>
      {subtitle ? (
        <p className="mt-0.5 truncate text-[11px] text-slate-400">{subtitle}</p>
      ) : null}
    </div>
  );
}

export default function AdminNewUserPage() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "user",
    status: "Active",
    password: "",
    confirmPassword: "",
  });

  const handleChange = useCallback((event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setSaved(false);
    setError("");
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    setSaved(false);
    setError("");

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();

    if (!name) {
      setError("Full name is required.");
      return;
    }

    if (!email) {
      setError("Email address is required.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name,
        email,
        role: form.role,
        status: form.status,
        password: form.password,
      };

      const response = await fetch(`${API_URL}/users`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let result = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (response.status === 401) {
        setError(
          result?.message || "Session expired. Redirecting to login..."
        );
        setTimeout(() => {
          window.location.replace("/login");
        }, 800);
        return;
      }

      if (response.status === 403) {
        setError(
          result?.message || "You do not have permission to create users."
        );
        return;
      }

      if (!response.ok || result?.success === false) {
        throw new Error(
          result?.message ||
            result?.error ||
            `Failed to create user. Status: ${response.status}`
        );
      }

      setSaved(true);
      setError("");
      setForm({
        name: "",
        email: "",
        role: "user",
        status: "Active",
        password: "",
        confirmPassword: "",
      });

      setTimeout(() => {
        window.location.replace("/admin/users");
      }, 900);
    } catch (err) {
      console.error("[Admin Users] Create user error:", err);
      setError(
        err?.message || "Unable to create user. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const passwordMismatch =
    form.confirmPassword.length > 0 &&
    form.password !== form.confirmPassword;

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-900">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* =========================================================
            HEADER
        ========================================================= */}
        <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <Link
              href="/admin/users"
              className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-slate-600 shadow-sm transition duration-200 hover:-translate-x-0.5 hover:border-violet-200 hover:bg-violet-50/50 hover:text-violet-700 active:translate-x-0"
              title="Back to Users"
            >
              <ArrowLeft
                size={18}
                className="transition duration-200 group-hover:-translate-x-0.5"
              />
            </Link>

            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/80 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-violet-700">
                <ShieldCheck size={13} />
                ADMINISTRATION
              </div>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Add New User
              </h1>
              <p className="mt-0.5 text-xs font-medium text-slate-500 sm:text-sm">
                Create a workspace account and configure user permissions.
              </p>
            </div>
          </div>
        </section>

        {/* =========================================================
            ALERTS (Success / Error)
        ========================================================= */}
        {saved ? (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/90 p-4 text-emerald-700 shadow-sm">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
              <Check size={15} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-bold">User created successfully!</p>
              <p className="text-xs text-emerald-600">
                Redirecting back to workspace users...
              </p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50/90 p-4 text-rose-700 shadow-sm">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white">
              <span className="text-xs font-bold">!</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold">Unable to create user</p>
              <p className="mt-0.5 break-words text-xs font-medium text-rose-600">
                {error}
              </p>
            </div>
          </div>
        ) : null}

        {/* =========================================================
            FORM CARD
        ========================================================= */}
        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]"
        >
          {/* Card Subheader */}
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4.5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-500 text-white shadow-md shadow-purple-500/10">
                <User size={19} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Account Information
                </h2>
                <p className="text-xs text-slate-400">
                  Fill in the credentials and assign access level for the new user.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6 sm:p-7">
            {/* FULL NAME */}
            <div>
              <label
                htmlFor="name"
                className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600"
              >
                <User size={14} className="text-violet-500" />
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                autoComplete="name"
                value={form.name}
                onChange={handleChange}
                disabled={saving}
                placeholder="e.g. John Doe"
                className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 disabled:bg-slate-100"
              />
            </div>

            {/* EMAIL ADDRESS */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600"
              >
                <Mail size={14} className="text-violet-500" />
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                disabled={saving}
                placeholder="e.g. john@example.com"
                className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 disabled:bg-slate-100"
              />
            </div>

            {/* ROLE & STATUS */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="role"
                  className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  <Shield size={14} className="text-violet-500" />
                  Role Assignment
                </label>
                <select
                  id="role"
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  disabled={saving}
                  className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 disabled:bg-slate-100"
                >
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="status"
                  className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  <UserCheck size={14} className="text-emerald-500" />
                  Account Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  disabled={saving}
                  className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 disabled:bg-slate-100"
                >
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                  <option value="Blocked">Blocked</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* PASSWORDS */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  <KeyRound size={14} className="text-orange-500" />
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={handleChange}
                    disabled={saving}
                    placeholder="Min 6 characters"
                    className={`h-11 w-full rounded-2xl border bg-slate-50/50 pl-4 pr-11 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 disabled:bg-slate-100 ${
                      passwordMismatch
                        ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10"
                        : "border-slate-200/90 focus:border-violet-500 focus:ring-violet-500/10"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  <KeyRound size={14} className="text-orange-500" />
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    disabled={saving}
                    placeholder="Repeat password"
                    className={`h-11 w-full rounded-2xl border bg-slate-50/50 pl-4 pr-11 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 disabled:bg-slate-100 ${
                      passwordMismatch
                        ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10"
                        : "border-slate-200/90 focus:border-violet-500 focus:ring-violet-500/10"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                    aria-label={
                      showConfirmPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>
                {passwordMismatch ? (
                  <p className="mt-1.5 text-xs font-semibold text-rose-500">
                    Passwords do not match.
                  </p>
                ) : null}
              </div>
            </div>

            {/* LIVE PREVIEW BOX */}
            <div className="rounded-[22px] border border-slate-200/80 bg-gradient-to-r from-violet-50/40 via-purple-50/30 to-pink-50/30 p-4.5">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles size={14} className="text-violet-600" />
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Live Preview
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <PreviewCard
                  label="Name"
                  value={form.name || "—"}
                  subtitle={form.email || "No email"}
                />
                <PreviewCard
                  label="Role"
                  value={form.role.toUpperCase()}
                  subtitle="Workspace Access"
                />
                <PreviewCard
                  label="Status"
                  value={form.status}
                  subtitle="Account State"
                />
              </div>
            </div>

            {/* FORM FOOTER BUTTONS */}
            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
              <Link
                href="/admin/users"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition duration-150 hover:bg-slate-50 hover:text-slate-900"
              >
                Cancel
              </Link>

              {/* High contrast bold button */}
              <button
                type="submit"
                disabled={saving || passwordMismatch}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition duration-150 hover:-translate-y-0.5 hover:bg-violet-700 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Creating User...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save User</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}