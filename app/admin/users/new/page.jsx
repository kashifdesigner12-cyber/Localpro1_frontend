"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  Loader2,
  Mail,
  Save,
  User,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api";

export default function AdminNewUserPage() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "user",
    status: "Active",
    password: "",
    confirmPassword: "",
  });

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setSaved(false);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) return;

    setSaved(false);
    setError("");

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();

    // -----------------------------
    // VALIDATION
    // -----------------------------

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
      setError(
        "Password must be at least 6 characters long."
      );
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // -----------------------------
    // CREATE USER
    // -----------------------------

    try {
      setSaving(true);

      const payload = {
        name,
        email,
        role: form.role,
        status: form.status,
        password: form.password,
      };

      console.log(
        "[Admin Users] Creating user:",
        payload
      );

      const response = await fetch(
        `${API_URL}/users`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      let result = null;

      try {
        result = await response.json();
      } catch {
        result = null;
      }

      console.log(
        "[Admin Users] Response:",
        response.status,
        result
      );

      // -----------------------------
      // AUTH ERROR
      // -----------------------------

      if (response.status === 401) {
        setError(
          result?.message ||
            "Your login session has expired. Please login again."
        );

        setTimeout(() => {
          window.location.replace("/login");
        }, 700);

        return;
      }

      // -----------------------------
      // PERMISSION ERROR
      // -----------------------------

      if (response.status === 403) {
        setError(
          result?.message ||
            "You do not have permission to create users."
        );

        return;
      }

      // -----------------------------
      // OTHER ERROR
      // -----------------------------

      if (!response.ok || result?.success === false) {
        throw new Error(
          result?.message ||
            result?.error ||
            `Failed to create user. Status: ${response.status}`
        );
      }

      // -----------------------------
      // SUCCESS
      // -----------------------------

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
      console.error(
        "[Admin Users] Create user error:",
        err
      );

      setError(
        err?.message ||
          "Unable to create user. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  const passwordMismatch =
    form.confirmPassword.length > 0 &&
    form.password !== form.confirmPassword;

  return (
    <main className="min-h-[calc(100vh-4rem)] w-full p-5 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* HEADER */}

        <section>
          <div className="flex items-start gap-3">
            <Link
              href="/admin/users"
              className="mt-1 hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#26344D] transition hover:bg-slate-50 sm:flex"
            >
              <ArrowLeft size={19} />
            </Link>

            <div>
              <p className="text-sm font-semibold text-[#2563EB]">
                ADMINISTRATION
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
                Add New User
              </h1>

              <p className="mt-2 text-sm text-[#64748B]">
                Create a workspace user and configure
                their account details.
              </p>
            </div>
          </div>
        </section>

        {/* SUCCESS */}

        {saved && (
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
              <Check size={13} />
            </div>

            <div>
              <p>User created successfully.</p>

              <p className="mt-0.5 text-xs font-medium text-green-600">
                Redirecting to users...
              </p>
            </div>
          </div>
        )}

        {/* ERROR */}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-semibold text-red-700">
              Unable to create user
            </p>

            <p className="mt-1 break-words text-xs font-medium text-red-600">
              {error}
            </p>
          </div>
        )}

        {/* FORM */}

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          {/* FORM HEADER */}

          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                <User size={19} />
              </div>

              <div>
                <h2 className="text-base font-bold text-[#171B3A]">
                  User Information
                </h2>

                <p className="mt-1 text-sm text-[#64748B]">
                  Enter the account details for the new user.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-5 sm:p-6">

            {/* NAME */}

            <div>
              <label
                htmlFor="name"
                className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]"
              >
                <User size={16} />
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
                placeholder="e.g. John Smith"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
              />
            </div>

            {/* EMAIL */}

            <div>
              <label
                htmlFor="email"
                className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]"
              >
                <Mail size={16} />
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
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
              />
            </div>

            {/* ROLE + STATUS */}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

              <div>
                <label
                  htmlFor="role"
                  className="mb-2 block text-sm font-semibold text-[#26344D]"
                >
                  Role
                </label>

                <select
                  id="role"
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  disabled={saving}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
                >
                  <option value="admin">
                    Admin
                  </option>

                  <option value="manager">
                    Manager
                  </option>

                  <option value="user">
                    User
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="status"
                  className="mb-2 block text-sm font-semibold text-[#26344D]"
                >
                  Account Status
                </label>

                <select
                  id="status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  disabled={saving}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
                >
                  <option value="Active">
                    Active
                  </option>

                  <option value="Pending">
                    Pending
                  </option>

                  <option value="Blocked">
                    Blocked
                  </option>

                  <option value="Inactive">
                    Inactive
                  </option>
                </select>
              </div>
            </div>

            {/* PASSWORD */}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-[#26344D]"
                >
                  Password
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handleChange}
                  disabled={saving}
                  placeholder="Minimum 6 characters"
                  className={`h-11 w-full rounded-xl border bg-white px-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 ${
                    passwordMismatch
                      ? "border-red-300 focus:border-red-400"
                      : "border-slate-200 focus:border-[#2563EB]"
                  }`}
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-semibold text-[#26344D]"
                >
                  Confirm Password
                </label>

                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  disabled={saving}
                  placeholder="Repeat password"
                  className={`h-11 w-full rounded-xl border bg-white px-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 ${
                    passwordMismatch
                      ? "border-red-300 focus:border-red-400"
                      : "border-slate-200 focus:border-[#2563EB]"
                  }`}
                />

                {passwordMismatch && (
                  <p className="mt-2 text-xs font-medium text-red-600">
                    Passwords do not match.
                  </p>
                )}
              </div>
            </div>

            {/* PREVIEW */}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                Account Preview
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

                <PreviewItem
                  label="Name"
                  value={form.name || "Not provided"}
                />

                <PreviewItem
                  label="Role"
                  value={
                    form.role.charAt(0).toUpperCase() +
                    form.role.slice(1)
                  }
                />

                <PreviewItem
                  label="Status"
                  value={form.status}
                />

              </div>
            </div>

            {/* ACTIONS */}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-end">

              <Link
                href="/admin/users"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-semibold text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D]"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={
                  saving || passwordMismatch
                }
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {saving ? (
                  <>
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                    Creating User...
                  </>
                ) : (
                  <>
                    <Save size={17} />
                    Save User
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

function PreviewItem({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 truncate text-sm font-semibold text-[#26344D]">
        {value}
      </p>
    </div>
  );
}