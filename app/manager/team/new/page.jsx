"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import {
  Activity,
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  Save,
  Settings,
  ShieldCheck,
  User,
  Users,
  X,
} from "lucide-react";

import { userService } from "@/services/userService";
import { authService } from "@/services/authService";

const navigation = [
  {
    label: "Dashboard",
    href: "/manager",
    icon: LayoutDashboard,
  },
  {
    label: "Team",
    href: "/manager/team",
    icon: Users,
  },
  {
    label: "Tasks",
    href: "/manager/tasks",
    icon: ClipboardList,
  },
  {
    label: "Calendar",
    href: "/manager/calendar",
    icon: CalendarDays,
  },
  {
    label: "Activity",
    href: "/manager/activity",
    icon: Activity,
  },
  {
    label: "Settings",
    href: "/manager/settings",
    icon: Settings,
  },
];

export default function ManagerNewTeamMemberPage() {
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "user",
    status: "active",
    phone: "",
    department: "",
    password: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // ==========================================
  // HANDLE CHANGE
  // ==========================================

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSaved(false);
  }

  // ==========================================
  // SUBMIT
  // ==========================================

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setError("");
    setSaved(false);

    try {
      setSaving(true);

      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        status: form.status,
      };

      if (form.phone.trim()) {
        payload.phone = form.phone.trim();
      }

      if (form.department.trim()) {
        payload.department = form.department.trim();
      }

      if (form.password.trim()) {
        payload.password = form.password;
      }

      console.log("CREATE TEAM MEMBER PAYLOAD:", payload);

      const response = await userService.createUser(payload);

      console.log("CREATE TEAM MEMBER RESPONSE:", response);

      setSaved(true);

      setTimeout(() => {
        router.replace("/manager/team");
      }, 800);
    } catch (err) {
      console.error("CREATE TEAM MEMBER ERROR:", err);

      setError(
        err?.message ||
          "Unable to create team member."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  async function handleLogout() {
    try {
      await authService.logout();
    } catch (err) {
      console.error("MANAGER LOGOUT ERROR:", err);
    } finally {
      router.replace("/login");
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC]">
      {/* ========================================
          MOBILE OVERLAY
      ======================================== */}

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* ========================================
          SIDEBAR
      ======================================== */}

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
                Manager Workspace
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation */}

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-300">
            Management
          </p>

          <div className="space-y-1.5">
            {navigation.map((item) => (
              <ManagerNavItem
                key={item.href}
                item={item}
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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-xs font-bold text-white">
              M
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                Manager
              </p>

              <p className="truncate text-xs font-medium text-slate-300">
                Manager Account
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <LogOut size={17} />

            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ========================================
          MAIN AREA

          IMPORTANT:
          - NO PAGE LEVEL HEADER
          - NO max-width container
          - NO lg:pl-64
          - FULL AVAILABLE WIDTH
          - SHARED MANAGER LAYOUT HANDLES HEADER
      ======================================== */}

      <div className="w-full">
        <main className="min-h-screen w-full p-5 sm:p-6 lg:p-8">
          <div className="w-full space-y-6">
            {/* ======================================
                PAGE HEADING
            ====================================== */}

            <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <Link
                    href="/manager/team"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#26344D] transition hover:bg-slate-50"
                    aria-label="Back to team"
                  >
                    <ArrowLeft size={19} />
                  </Link>

                  <div>
                    <p className="text-sm font-semibold text-[#2563EB]">
                      MANAGEMENT
                    </p>

                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
                      Add Team Member
                    </h1>
                  </div>
                </div>

                <p className="mt-3 text-sm text-[#64748B]">
                  Add a new member to your workspace team.
                </p>
              </div>
            </section>

            {/* ======================================
                ERROR
            ====================================== */}

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
              >
                {error}
              </div>
            )}

            {/* ======================================
                SUCCESS
            ====================================== */}

            {saved && (
              <div
                role="status"
                className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700"
              >
                Team member created successfully.
                Redirecting...
              </div>
            )}

            {/* ======================================
                FORM
            ====================================== */}

            <form
              onSubmit={handleSubmit}
              className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              {/* Form Header */}

              <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                    <Users size={19} />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-[#171B3A]">
                      Member Information
                    </h2>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Enter the details for the new team member.
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Content */}

              <div className="space-y-6 p-5 sm:p-6">
                {/* Name */}

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
                    value={form.name}
                    onChange={handleChange}
                    disabled={saving}
                    placeholder="e.g. John Smith"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />
                </div>

                {/* Email */}

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
                    value={form.email}
                    onChange={handleChange}
                    disabled={saving}
                    placeholder="e.g. john@example.com"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />
                </div>

                {/* Password */}

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
                    value={form.password}
                    onChange={handleChange}
                    disabled={saving}
                    placeholder="Enter password if required"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />
                </div>

                {/* Phone + Department */}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {/* Phone */}

                  <div>
                    <label
                      htmlFor="phone"
                      className="mb-2 block text-sm font-semibold text-[#26344D]"
                    >
                      Phone Number
                    </label>

                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={handleChange}
                      disabled={saving}
                      placeholder="e.g. +92 300 1234567"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
                    />
                  </div>

                  {/* Department */}

                  <div>
                    <label
                      htmlFor="department"
                      className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]"
                    >
                      <FileText size={16} />

                      Department
                    </label>

                    <input
                      id="department"
                      name="department"
                      type="text"
                      value={form.department}
                      onChange={handleChange}
                      disabled={saving}
                      placeholder="e.g. Operations"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
                    />
                  </div>
                </div>

                {/* Role + Status */}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {/* Role */}

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
                      <option value="user">
                        User
                      </option>

                      <option value="manager">
                        Manager
                      </option>
                    </select>
                  </div>

                  {/* Status */}

                  <div>
                    <label
                      htmlFor="status"
                      className="mb-2 block text-sm font-semibold text-[#26344D]"
                    >
                      Status
                    </label>

                    <select
                      id="status"
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                      disabled={saving}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
                    >
                      <option value="active">
                        Active
                      </option>

                      <option value="inactive">
                        Inactive
                      </option>
                    </select>
                  </div>
                </div>

                {/* Preview */}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <PreviewItem
                      label="Name"
                      value={
                        form.name || "Not provided"
                      }
                    />

                    <PreviewItem
                      label="Role"
                      value={
                        form.role === "manager"
                          ? "Manager"
                          : "User"
                      }
                    />

                    <PreviewItem
                      label="Status"
                      value={
                        form.status === "active"
                          ? "Active"
                          : "Inactive"
                      }
                    />
                  </div>
                </div>

                {/* Actions */}

                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
                  <Link
                    href="/manager/team"
                    className={`inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-semibold text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D] ${
                      saving
                        ? "pointer-events-none opacity-50"
                        : ""
                    }`}
                  >
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
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

                        Save Member
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

// ==========================================
// MANAGER NAVIGATION ITEM
// ==========================================

function ManagerNavItem({
  item,
  onNavigate,
}) {
  const pathname = usePathname();
  const Icon = item.icon;

  const isActive =
    pathname === item.href ||
    (item.href !== "/manager" &&
      pathname.startsWith(`${item.href}/`));

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

// ==========================================
// PREVIEW ITEM
// ==========================================

function PreviewItem({
  label,
  value,
}) {
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