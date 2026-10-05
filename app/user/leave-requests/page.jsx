"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Clock3,
  X,
  AlertCircle,
  XCircle,
  UserRound,
  Sparkles,
} from "lucide-react";

import { authService } from "@/services/authService";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.localpro1.net/api";

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

const LEAVE_TYPES = [
  { value: "Annual", label: "Annual Leave" },
  { value: "Sick", label: "Sick Leave" },
  { value: "Casual", label: "Casual Leave" },
  { value: "Emergency", label: "Emergency Leave" },
  { value: "Maternity", label: "Maternity Leave" },
  { value: "Paternity", label: "Paternity Leave" },
  { value: "Unpaid", label: "Unpaid Leave" },
  { value: "Other", label: "Other" },
];

const initialForm = {
  leaveType: "",
  startDate: "",
  endDate: "",
  reason: "",
};

export default function UserLeaveRequestsPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [currentUser, setCurrentUser] = useState(() => extractUser(authService?.getUser?.()));

  const [loading, setLoading] = useState(false); // Instant render enabled
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const cacheRef = useRef({ timestamp: 0, data: null });
  const loadingRef = useRef(false);

  /* =========================================================
     API HELPER
  ========================================================= */

  const apiRequest = useCallback(async (endpoint, options = {}) => {
    let token = null;
    try {
      if (typeof window !== "undefined") {
        token =
          localStorage.getItem("token") ||
          localStorage.getItem("authToken") ||
          sessionStorage.getItem("token");
      }
      if (!token && typeof authService?.getToken === "function") {
        token = authService.getToken();
      }
    } catch (e) {}

    const cleanEndpoint = endpoint.startsWith("/api/")
      ? endpoint.replace(/^\/api/, "")
      : endpoint;
    const finalPath = cleanEndpoint.startsWith("/") ? cleanEndpoint : `/${cleanEndpoint}`;

    const response = await fetch(`${API_URL}${finalPath}`, {
      ...options,
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      cache: "no-store",
    });

    let data = null;
    try {
      const text = await response.text();
      if (text) data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        router.replace("/login");
      }
      throw new Error(
        data?.message || data?.error || `Request failed with status ${response.status}`
      );
    }

    return data;
  }, [router]);

  /* =========================================================
     LOAD LEAVE REQUESTS (Speed Optimized & Cached)
  ========================================================= */

  const fetchLeaveRequests = useCallback(
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

        const me = await authService.me();
        const user = extractUser(me);
        if (user) setCurrentUser(user);

        const data = await apiRequest("/leave-requests/my");
        const requests = normalizeRequests(data);

        setLeaveRequests(requests);

        cacheRef.current = {
          timestamp: Date.now(),
          data: requests,
        };
      } catch (err) {
        console.error("Fetch leave requests error:", err);
        setError(err?.message || "Unable to load leave requests.");
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiRequest]
  );

  useEffect(() => {
    fetchLeaveRequests(false);
  }, [fetchLeaveRequests]);

  /* =========================================================
     FORM ACTIONS
  ========================================================= */

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
    setSubmitted(false);
    setSubmitError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setSubmitError("");
      setSubmitted(false);

      const payload = {
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim(),
      };

      const validLeaveType = LEAVE_TYPES.some(
        (type) => type.value === payload.leaveType
      );

      if (!validLeaveType) {
        throw new Error("Please select a valid leave type.");
      }

      if (!payload.startDate) {
        throw new Error("Please select a start date.");
      }

      if (!payload.endDate) {
        throw new Error("Please select an end date.");
      }

      if (!payload.reason) {
        throw new Error("Please enter a reason for your leave.");
      }

      if (new Date(payload.endDate) < new Date(payload.startDate)) {
        throw new Error("End date cannot be before start date.");
      }

      await apiRequest("/leave-requests", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSubmitted(true);
      setForm(initialForm);

      cacheRef.current.timestamp = 0; // Invalidate cache
      await fetchLeaveRequests(true);

      setTimeout(() => {
        setShowForm(false);
        setSubmitted(false);
      }, 700);
    } catch (error) {
      console.error("Create leave request error:", error);
      setSubmitError(error?.message || "Unable to submit leave request.");
    } finally {
      setSubmitting(false);
    }
  }

  function openForm() {
    setShowForm(true);
    setSubmitted(false);
    setSubmitError("");
    setForm(initialForm);
  }

  function closeForm() {
    if (submitting) return;
    setShowForm(false);
    setSubmitted(false);
    setSubmitError("");
    setForm(initialForm);
  }

  async function handleCancelRequest(id) {
    if (!id || cancellingId) return;

    const confirmed = window.confirm(
      "Are you sure you want to cancel this leave request?"
    );

    if (!confirmed) return;

    try {
      setCancellingId(id);
      setError("");

      await apiRequest(`/leave-requests/${id}/cancel`, {
        method: "PATCH",
      });

      cacheRef.current.timestamp = 0;
      await fetchLeaveRequests(true);
    } catch (error) {
      console.error("Cancel leave request error:", error);
      setError(error?.message || "Unable to cancel leave request.");
    } finally {
      setCancellingId(null);
    }
  }

  async function handleLogout() {
    try {
      if (typeof authService?.logout === "function") {
        await authService.logout();
      }
    } catch {} finally {
      router.replace("/login");
    }
  }

  const stats = useMemo(() => {
    const pending = leaveRequests.filter(
      (request) => String(request.status).toLowerCase() === "pending"
    ).length;

    const approved = leaveRequests.filter(
      (request) => String(request.status).toLowerCase() === "approved"
    ).length;

    return {
      pending,
      approved,
      total: leaveRequests.length,
    };
  }, [leaveRequests]);

  const userName = currentUser?.name || currentUser?.fullName || currentUser?.email || "User";
  const userInitial = String(userName).trim().charAt(0).toUpperCase() || "U";
  const userEmail = currentUser?.email || "User Account";

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
                onNavigate={() => setSidebarOpen(false)}
              />
            ))}
          </div>
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-600 text-xs font-bold text-white">
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt={userName} className="h-full w-full object-cover" />
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
            className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut size={18} />
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
              <p className="text-sm font-bold text-slate-900">Leave Requests</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fetchLeaveRequests(true)}
              disabled={refreshing}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-violet-50 hover:text-violet-600 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin text-violet-600" : ""} />
            </button>

            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-sm">
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt={userName} className="h-full w-full object-cover" />
              ) : (
                userInitial
              )}
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 animate-slideUp">
          <div className="mx-auto max-w-7xl space-y-6">

            {/* HEADER SECTION (NO BANNER) */}
            <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/80 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-violet-700">
                  <ShieldCheck size={13} />
                  TIME OFF
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  Leave Requests
                </h1>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  Submit and track your time off and leave requests.
                </p>
              </div>

              <button
                type="button"
                onClick={openForm}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 text-xs font-bold text-white shadow-md shadow-violet-600/25 transition duration-150 hover:-translate-y-0.5 hover:bg-violet-700 active:translate-y-0"
              >
                <Plus size={17} />
                New Leave Request
              </button>
            </section>

            {error && (
              <section className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-rose-700 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-600" />
                  <div>
                    <p className="text-xs font-bold">Error Loading Leave Requests</p>
                    <p className="mt-1 text-xs">{error}</p>
                  </div>
                </div>
              </section>
            )}

            {/* STAT CARDS */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <LeaveStatCard icon={Clock3} label="Pending" value={loading ? "—" : stats.pending} description="Requests awaiting review" />
              <LeaveStatCard icon={CheckCircle2} label="Approved" value={loading ? "—" : stats.approved} description="Approved leave requests" />
              <LeaveStatCard icon={FileText} label="Total Requests" value={loading ? "—" : stats.total} description="All submitted records" />
            </section>

            {/* REQUESTS TABLE */}
            <section className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]">
              <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">My Leave History</h2>
                    <p className="text-xs text-slate-500">Track status and manage history.</p>
                  </div>
                </div>
              </div>

              {loading && leaveRequests.length === 0 ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
                  <Loader2 size={28} className="animate-spin text-violet-600" />
                  <p className="mt-3 text-xs font-semibold text-slate-400">Loading leave requests...</p>
                </div>
              ) : leaveRequests.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/30">
                        <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Leave Type</th>
                        <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Start Date</th>
                        <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">End Date</th>
                        <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Reason</th>
                        <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                        <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400 sm:pr-6">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {leaveRequests.map((request) => {
                        const requestId = request._id || request.id;
                        return (
                          <LeaveRequestRow
                            key={requestId}
                            request={request}
                            cancelling={cancellingId === requestId}
                            onCancel={handleCancelRequest}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                    <FileText size={22} />
                  </div>
                  <h3 className="mt-3 text-xs font-bold text-slate-900">No leave requests yet</h3>
                  <p className="mt-1 text-xs text-slate-400 max-w-xs">
                    Your submitted leave applications will appear here.
                  </p>
                  <button
                    type="button"
                    onClick={openForm}
                    className="mt-4 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700"
                  >
                    Submit Leave Request
                  </button>
                </div>
              )}
            </section>

          </div>
        </main>
      </div>

      {/* NEW LEAVE REQUEST MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-violet-600">
                  APPLICATION FORM
                </span>
                <h2 className="mt-1 text-lg font-extrabold text-slate-900">
                  New Leave Request
                </h2>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={submitting}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-5">
              {submitted && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
                  Leave request submitted successfully.
                </div>
              )}

              {submitError && (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                  {submitError}
                </div>
              )}

              <div>
                <label htmlFor="leaveType" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Leave Type
                </label>
                <select
                  id="leaveType"
                  name="leaveType"
                  value={form.leaveType}
                  onChange={handleChange}
                  required
                  disabled={submitting}
                  className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 text-xs font-bold text-slate-700 outline-none focus:border-violet-500 focus:bg-white"
                >
                  <option value="">Select leave type</option>
                  {LEAVE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="startDate" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Start Date
                  </label>
                  <div className="relative">
                    <CalendarDays size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="startDate"
                      name="startDate"
                      type="date"
                      value={form.startDate}
                      onChange={handleChange}
                      required
                      disabled={submitting}
                      className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 pl-10 pr-4 text-xs font-medium text-slate-700 outline-none focus:border-violet-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="endDate" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    End Date
                  </label>
                  <div className="relative">
                    <CalendarDays size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="endDate"
                      name="endDate"
                      type="date"
                      value={form.endDate}
                      onChange={handleChange}
                      required
                      disabled={submitting}
                      className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 pl-10 pr-4 text-xs font-medium text-slate-700 outline-none focus:border-violet-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="reason" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Reason for Leave
                </label>
                <textarea
                  id="reason"
                  name="reason"
                  value={form.reason}
                  onChange={handleChange}
                  required
                  rows={4}
                  disabled={submitting}
                  placeholder="Provide brief explanation for leave..."
                  className="w-full resize-none rounded-2xl border border-slate-200/90 bg-slate-50/50 p-3 text-xs font-medium text-slate-700 outline-none focus:border-violet-500 focus:bg-white"
                />
              </div>

              <div className="mt-8 flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={submitting}
                  className="h-10 rounded-2xl border border-slate-200 bg-white px-5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-violet-600 px-5 text-xs font-bold text-white shadow-md shadow-violet-600/25 transition hover:bg-violet-700 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  <span>{submitting ? "Submitting..." : "Submit Request"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   SUB COMPONENTS
========================================================= */

function UserNavItem({ item, onNavigate }) {
  const pathname = usePathname();
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

function LeaveStatCard({ icon: Icon, label, value, description }) {
  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(45,35,100,0.06)]">
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <Icon size={19} />
        </div>
        <span className="text-2xl font-extrabold text-slate-900">{value}</span>
      </div>
      <p className="mt-4 text-xs font-bold text-slate-800">{label}</p>
      <p className="mt-0.5 text-xs text-slate-400">{description}</p>
    </div>
  );
}

function LeaveRequestRow({ request, cancelling, onCancel }) {
  const id = request._id || request.id;
  const status = request.status || "Pending";
  const normalizedStatus = String(status).toLowerCase();
  const canCancel = normalizedStatus === "pending";

  const startDate = formatDate(request.startDate);
  const endDate = formatDate(request.endDate);
  const leaveType = request.leaveType || request.type || "—";
  const leaveTypeLabel =
    LEAVE_TYPES.find((type) => type.value === leaveType)?.label || leaveType;

  return (
    <tr className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition">
      <td className="px-6 py-4">
        <p className="text-xs font-bold text-slate-900">{leaveTypeLabel}</p>
      </td>
      <td className="px-6 py-4 text-xs font-medium text-slate-600">{startDate}</td>
      <td className="px-6 py-4 text-xs font-medium text-slate-600">{endDate}</td>
      <td className="max-w-[240px] px-6 py-4">
        <p className="truncate text-xs text-slate-500" title={request.reason || ""}>
          {request.reason || "—"}
        </p>
      </td>
      <td className="px-6 py-4">
        <StatusBadge status={status} />
      </td>
      <td className="px-6 py-4 text-right sm:pr-6">
        {canCancel ? (
          <button
            type="button"
            onClick={() => onCancel(id)}
            disabled={cancelling}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 px-3 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
          >
            {cancelling ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
            <span>{cancelling ? "Cancelling..." : "Cancel"}</span>
          </button>
        ) : (
          <span className="text-xs font-medium text-slate-300">—</span>
        )}
      </td>
    </tr>
  );
}

function StatusBadge({ status }) {
  const norm = String(status).toLowerCase();
  let classes = "bg-slate-100 text-slate-600 border border-slate-200";

  if (norm === "pending") classes = "bg-amber-50 text-amber-700 border border-amber-200";
  else if (norm === "approved") classes = "bg-emerald-50 text-emerald-700 border border-emerald-200";
  else if (norm === "rejected" || norm === "declined") classes = "bg-rose-50 text-rose-700 border border-rose-200";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${classes}`}>
      {status}
    </span>
  );
}

/* =========================================================
   HELPERS & NORMALIZERS
========================================================= */

function normalizeRequests(data) {
  const possible =
    Array.isArray(data) ? data :
    Array.isArray(data?.leaveRequests) ? data.leaveRequests :
    Array.isArray(data?.requests) ? data.requests :
    Array.isArray(data?.data) ? data.data :
    Array.isArray(data?.data?.leaveRequests) ? data.data.leaveRequests :
    Array.isArray(data?.data?.requests) ? data.data.requests : [];
  return possible;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function extractUser(response) {
  return response?.user || response?.data?.user || response?.data || response || null;
}