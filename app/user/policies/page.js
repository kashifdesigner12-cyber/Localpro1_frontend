"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  ShieldCheck,
  User,
  X,
} from "lucide-react";

export default function PoliciesPage() {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const policies = [
    "Employees should be entitled to 8 Casual Leaves and 8 Sick Leaves annually.",
    "All leave requests should be sent via email to hr@localpro1.com.",
    "Leave should only be approved after confirmation from HR.",
    "Any leave taken without prior information or approval should be marked as absent.",
    "If leaves exceed the annual limit, salary should be deducted for the extra days.",
    "In case of sickness for more than 2 days, a medical certificate should be provided if required.",
    "Employees should inform HR in case of emergency leave as soon as possible.",
  ];

  const navItems = [
    {
      label: "Dashboard",
      href: "/user",
      icon: LayoutDashboard,
    },
    {
      label: "My Tasks",
      href: "/user/tasks",
      icon: ClipboardList,
    },
    {
      label: "Attendance",
      href: "/user/attendance",
      icon: CalendarDays,
    },
    {
      label: "Conversations",
      href: "/user/conversations",
      icon: MessageSquare,
    },
    {
      label: "Profile",
      href: "/user/profile",
      icon: User,
    },
    {
      label: "Settings",
      href: "/user/settings",
      icon: Settings,
    },
    {
      label: "Policies",
      href: "/user/policies",
      icon: FileText,
    },
  ];

  const isActive = (href) => {
    if (href === "/user") {
      return pathname === "/user";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* =====================================================
          MOBILE OVERLAY
      ===================================================== */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={closeSidebar}
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
        />
      )}

      {/* =====================================================
          SIDEBAR
      ===================================================== */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[270px] flex-col bg-[#171B3A] shadow-xl transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-[82px] shrink-0 items-center justify-between border-b border-white/10 px-5">
          <Link
            href="/user"
            onClick={closeSidebar}
            className="flex items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-lg shadow-blue-950/20">
              <ShieldCheck size={22} />
            </div>

            <div>
              <p className="text-sm font-bold leading-none text-white">
                Local Pro 1
              </p>

              <p className="mt-1.5 text-[10px] font-medium text-white/60">
                Business Workspace
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={closeSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white transition hover:bg-white/10 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">
            Workspace
          </p>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeSidebar}
                  className={`group flex min-h-[44px] items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition ${
                    active
                      ? "bg-[#2563EB] text-white shadow-lg shadow-blue-950/20"
                      : "text-white hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon
                    size={18}
                    className={`shrink-0 ${
                      active
                        ? "text-white"
                        : "text-white group-hover:text-white"
                    }`}
                  />

                  <span className="text-white">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom */}
        <div className="shrink-0 border-t border-white/10 p-4">
          <Link
            href="/login"
            className="flex min-h-[44px] items-center gap-3 rounded-xl px-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <LogOut size={18} className="text-white" />
            <span className="text-white">Logout</span>
          </Link>
        </div>
      </aside>

      {/* =====================================================
          MAIN AREA
      ===================================================== */}
      <div className="min-h-screen lg:pl-[270px]">
        {/* ===================================================
            HEADER
        =================================================== */}
        <header className="sticky top-0 z-30 h-[82px] border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-full items-center justify-between px-5 sm:px-6 lg:px-8">
            {/* Mobile Menu */}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#26344D] transition hover:border-blue-200 hover:bg-[#EEF4FF] hover:text-[#2563EB] lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu size={21} />
            </button>

            {/* Page title */}
            <div className="hidden lg:block">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
                Employee Workspace
              </p>

              <h2 className="mt-0.5 text-lg font-bold text-[#171B3A]">
                Policies
              </h2>
            </div>

            {/* Mobile title */}
            <div className="lg:hidden">
              <p className="text-sm font-bold text-[#171B3A]">
                Policies
              </p>

              <p className="text-[10px] font-medium text-[#64748B]">
                Local Pro 1
              </p>
            </div>

            {/* Back */}
            <Link
              href="/user"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-[#26344D] transition hover:border-blue-200 hover:bg-[#EEF4FF] hover:text-[#2563EB] sm:px-4"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">
                Back to Dashboard
              </span>
              <span className="sm:hidden">Back</span>
            </Link>
          </div>
        </header>

        {/* ===================================================
            PAGE CONTENT
        =================================================== */}
        <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <div className="mx-auto w-full max-w-6xl">
            {/* =================================================
                HERO
            ================================================= */}
            <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              {/* Decorative elements */}
              <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full bg-[#EEF4FF] blur-3xl" />

              <div className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-blue-50 blur-3xl" />

              <div className="relative px-6 py-9 sm:px-8 sm:py-11 lg:px-12 lg:py-12">
                <div className="max-w-3xl">
                  {/* Badge */}
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-[#EEF4FF] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#2563EB]">
                    <FileText size={13} />
                    Employee Policy
                  </div>

                  {/* Title */}
                  <h1 className="text-3xl font-bold tracking-tight text-[#171B3A] sm:text-4xl lg:text-[44px]">
                    Employee&apos;s Leave Policy
                  </h1>

                  <p className="mt-3 text-base font-bold text-[#2563EB]">
                    Localpro1 2026
                  </p>

                  <p className="mt-4 max-w-2xl text-sm leading-7 text-[#64748B] sm:text-[15px]">
                    Please review the following employee leave
                    policy applicable to Localpro1 for 2026.
                  </p>

                  {/* Meta */}
                  <div className="mt-6 flex flex-wrap gap-3">
                    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-[#64748B]">
                      <FileText
                        size={14}
                        className="text-[#2563EB]"
                      />
                      Effective: 2026
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 size={14} />
                      Employee Guidelines
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* =================================================
                POLICY CARD
            ================================================= */}
            <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Card Header */}
              <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                    <FileText size={20} />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-[#171B3A] sm:text-lg">
                      Employee&apos;s Leave Policy Localpro1 2026
                    </h2>

                    <p className="mt-1 text-xs text-[#64748B]">
                      Leave and attendance guidelines
                    </p>
                  </div>
                </div>
              </div>

              {/* Policy List */}
              <div className="px-5 py-6 sm:px-8 sm:py-8">
                <div className="space-y-4">
                  {policies.map((policy, index) => (
                    <div
                      key={index}
                      className="group flex gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-5 transition duration-200 hover:border-blue-100 hover:bg-[#F8FAFF] hover:shadow-sm"
                    >
                      {/* Number/Icon */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB] transition group-hover:bg-[#2563EB] group-hover:text-white">
                        <CheckCircle2 size={18} />
                      </div>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#2563EB]">
                          Policy {index + 1}
                        </p>

                        <p className="text-sm leading-7 text-[#26344D] sm:text-[15px]">
                          {policy}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* =================================================
                FOOTER
            ================================================= */}
            <footer className="mt-8 border-t border-slate-200 pt-6">
              <div className="flex flex-col gap-3 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
                <p>
                  © {new Date().getFullYear()} Local Pro 1. All
                  rights reserved.
                </p>

                <div className="flex items-center gap-4">
                  <span>Employee Policy</span>

                  <span className="text-slate-300">•</span>

                  <Link
                    href="/user"
                    className="font-semibold text-[#2563EB] hover:underline"
                  >
                    Back to Dashboard
                  </Link>
                </div>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

