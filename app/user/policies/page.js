"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  ArrowLeft,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  RefreshCw,
  Settings,
  ShieldCheck,
  UserRound,
  X,
  Sparkles,
} from "lucide-react";

import { authService } from "@/services/authService";

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

export default function PoliciesPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const policies = [
    "Employees should be entitled to 8 Casual Leaves and 8 Sick Leaves annually.",
    "All leave requests should be sent via email to hr@localpro1.com.",
    "Leave should only be approved after confirmation from HR.",
    "Any leave taken without prior information or approval should be marked as absent.",
    "If leaves exceed the annual limit, salary should be deducted for the extra days.",
    "In case of sickness for more than 2 days, a medical certificate should be provided if required.",
    "Employees should inform HR in case of emergency leave as soon as possible.",
  ];

  async function handleLogout() {
    if (loggingOut) return;
    try {
      setLoggingOut(true);
      if (typeof authService?.logout === "function") {
        await authService.logout();
      }
    } catch {} finally {
      setLoggingOut(false);
      router.replace("/login");
    }
  }

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
              <p className="text-sm font-bold text-slate-900">Policies</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/user"
              className="inline-flex h-9 items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-xs transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
            >
              <ArrowLeft size={15} />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </header>

        {/* CONTENT */}
        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 animate-slideUp">
          <div className="mx-auto w-full max-w-5xl space-y-6">

            {/* HERO SECTION */}
            <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#4211b8] via-[#6414d8] to-[#a617c8] p-6 text-white shadow-[0_25px_70px_rgba(93,36,190,0.25)] sm:p-8">
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-2xl" />
              <div className="relative z-10">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md">
                  <Sparkles size={13} />
                  Employee Guidelines
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
                  Employee&apos;s Leave Policy
                </h1>
                <p className="mt-2 text-sm text-white/80 max-w-xl">
                  Localpro1 2026 Guidelines. Please review the official leave rules and policies.
                </p>
              </div>
            </section>

            {/* POLICY LIST CONTAINER */}
            <section className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]">
              <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Official Regulations</h2>
                    <p className="text-xs text-slate-500">Effective for 2026 operations.</p>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <div className="space-y-4">
                  {policies.map((policy, index) => (
                    <div
                      key={index}
                      className="group flex gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 transition duration-150 hover:border-violet-200 hover:bg-violet-50/30"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 transition group-hover:bg-violet-600 group-hover:text-white">
                        <CheckCircle2 size={17} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-violet-600">
                          Policy Rule {index + 1}
                        </p>
                        <p className="text-xs font-medium leading-relaxed text-slate-700 sm:text-sm">
                          {policy}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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