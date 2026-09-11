"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Settings,
  ShieldCheck,
  Clock3,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  XCircle,
  UserRound,
} from "lucide-react";

const navigation = [
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
    label: "Notifications",
    href: "/user/notifications",
    icon: Bell,
  },
  {
    label: "Leave Requests",
    href: "/user/leave-requests",
    icon: FileText,
  },
  {
    label: "Activity",
    href: "/user/activity",
    icon: Activity,
  },
  {
    label: "Profile",
    href: "/user/profile",
    icon: UserRound,
  },
  {
    label: "Settings",
    href: "/user/settings",
    icon: Settings,
  },
  {
    label: "Policies",
    href: "/user/policies",
    icon: ShieldCheck,
  },
];

const LEAVE_TYPES = [
  {
    value: "Annual",
    label: "Annual Leave",
  },
  {
    value: "Sick",
    label: "Sick Leave",
  },
  {
    value: "Casual",
    label: "Casual Leave",
  },
  {
    value: "Emergency",
    label: "Emergency Leave",
  },
  {
    value: "Maternity",
    label: "Maternity Leave",
  },
  {
    value: "Paternity",
    label: "Paternity Leave",
  },
  {
    value: "Unpaid",
    label: "Unpaid Leave",
  },
  {
    value: "Other",
    label: "Other",
  },
];

const initialForm = {
  leaveType: "",
  startDate: "",
  endDate: "",
  reason: "",
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.localpro1.net";

export default function UserLeaveRequestsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);

  const [leaveRequests, setLeaveRequests] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  /*
    ==========================================================
    LOAD USER LEAVE REQUESTS
    ==========================================================
  */

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/api/leave-requests/my`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.message || "Failed to load leave requests."
        );
      }

      const requests = Array.isArray(data)
        ? data
        : Array.isArray(data?.leaveRequests)
        ? data.leaveRequests
        : Array.isArray(data?.requests)
        ? data.requests
        : Array.isArray(data?.data)
        ? data.data
        : [];

      setLeaveRequests(requests);
    } catch (error) {
      console.error("Fetch leave requests error:", error);

      setLeaveRequests([]);

      setError(
        error?.message || "Unable to load leave requests."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  /*
    ==========================================================
    FORM CHANGE
    ==========================================================
  */

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setSubmitted(false);
    setSubmitError("");
  }

  /*
    ==========================================================
    CREATE LEAVE REQUEST
    ==========================================================
  */

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
        throw new Error(
          "End date cannot be before start date."
        );
      }

      const response = await fetch(
        `${API_BASE_URL}/api/leave-requests`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.message || "Failed to submit leave request."
        );
      }

      setSubmitted(true);

      setForm(initialForm);

      await fetchLeaveRequests();

      setTimeout(() => {
        setShowForm(false);
        setSubmitted(false);
      }, 700);
    } catch (error) {
      console.error("Create leave request error:", error);

      setSubmitError(
        error?.message || "Unable to submit leave request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  /*
    ==========================================================
    OPEN FORM
    ==========================================================
  */

  function openForm() {
    setShowForm(true);
    setSubmitted(false);
    setSubmitError("");
    setForm(initialForm);
  }

  /*
    ==========================================================
    CLOSE FORM
    ==========================================================
  */

  function closeForm() {
    if (submitting) {
      return;
    }

    setShowForm(false);
    setSubmitted(false);
    setSubmitError("");
    setForm(initialForm);
  }

  /*
    ==========================================================
    CANCEL LEAVE REQUEST
    ==========================================================
  */

  async function handleCancelRequest(id) {
    if (!id || cancellingId) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to cancel this leave request?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setCancellingId(id);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/api/leave-requests/${id}/cancel`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }
      );

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Failed to cancel leave request."
        );
      }

      await fetchLeaveRequests();
    } catch (error) {
      console.error(
        "Cancel leave request error:",
        error
      );

      setError(
        error?.message ||
          "Unable to cancel leave request."
      );
    } finally {
      setCancellingId(null);
    }
  }

  /*
    ==========================================================
    STATS
    ==========================================================
  */

  const stats = useMemo(() => {
    const pending = leaveRequests.filter(
      (request) =>
        String(request.status).toLowerCase() ===
        "pending"
    ).length;

    const approved = leaveRequests.filter(
      (request) =>
        String(request.status).toLowerCase() ===
        "approved"
    ).length;

    return {
      pending,
      approved,
      total: leaveRequests.length,
    };
  }, [leaveRequests]);

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

      {/* Sidebar */}
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
            Workspace
          </p>

          <div className="space-y-1.5">
            {navigation.map((item) => (
              <UserNavItem
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
              U
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                User
              </p>

              <p className="truncate text-xs font-medium text-slate-300">
                User Account
              </p>
            </div>
          </div>

          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <LogOut size={17} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="lg:pl-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
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
                Leave Requests
              </p>
            </div>
          </div>

          <Link
            href="/user/notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#EEF4FF] text-[#2563EB] transition hover:bg-blue-100"
            aria-label="Notifications"
          >
            <Bell size={17} />
          </Link>
        </header>

        {/* Page Content */}
        <main className="min-h-[calc(100vh-4rem)] p-5 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Heading */}
            <section>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#2563EB]">
                    WORKSPACE
                  </p>

                  <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
                    Leave Requests
                  </h1>

                  <p className="mt-2 text-sm text-[#64748B]">
                    Submit and track your leave requests.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openForm}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#1D4ED8]"
                >
                  <Plus size={18} />
                  New Leave Request
                </button>
              </div>
            </section>

            {/* Error */}
            {error && (
              <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle
                    size={18}
                    className="mt-0.5 shrink-0 text-red-500"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-red-700">
                      Unable to load leave requests
                    </p>

                    <p className="mt-1 text-xs leading-5 text-red-600">
                      {error}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={fetchLeaveRequests}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-red-600 shadow-sm transition hover:bg-red-100"
                  >
                    <RefreshCw size={14} />
                    Retry
                  </button>
                </div>
              </section>
            )}

            {/* Stats */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <LeaveStatCard
                icon={Clock3}
                label="Pending"
                value={loading ? "—" : stats.pending}
                description="Requests awaiting review"
              />

              <LeaveStatCard
                icon={CheckCircle2}
                label="Approved"
                value={loading ? "—" : stats.approved}
                description="Approved leave requests"
              />

              <LeaveStatCard
                icon={FileText}
                label="Total Requests"
                value={loading ? "—" : stats.total}
                description="All submitted requests"
              />
            </section>

            {/* Requests Table */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <h2 className="text-base font-bold text-[#171B3A]">
                    My Leave Requests
                  </h2>

                  <p className="mt-1 text-sm text-[#64748B]">
                    Track the status of your submitted requests.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openForm}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-[#2563EB] transition hover:bg-[#EEF4FF]"
                >
                  <Plus size={16} />
                  New Request
                </button>
              </div>

              {/* Loading */}
              {loading ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                    <Loader2
                      size={28}
                      className="animate-spin"
                    />
                  </div>

                  <h3 className="mt-5 text-base font-bold text-[#171B3A]">
                    Loading leave requests
                  </h3>

                  <p className="mt-2 max-w-md text-sm leading-6 text-[#64748B]">
                    Fetching your leave requests from the backend.
                  </p>
                </div>
              ) : leaveRequests.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70">
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#64748B] sm:px-6">
                          Leave Type
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#64748B]">
                          Start Date
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#64748B]">
                          End Date
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#64748B]">
                          Reason
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#64748B]">
                          Status
                        </th>

                        <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-[#64748B]">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {leaveRequests.map((request) => {
                        const requestId =
                          request._id || request.id;

                        return (
                          <LeaveRequestRow
                            key={requestId}
                            request={request}
                            cancelling={
                              cancellingId === requestId
                            }
                            onCancel={
                              handleCancelRequest
                            }
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                    <FileText size={28} />
                  </div>

                  <h3 className="mt-5 text-base font-bold text-[#171B3A]">
                    No leave requests yet
                  </h3>

                  <p className="mt-2 max-w-md text-sm leading-6 text-[#64748B]">
                    Your submitted leave requests will appear here
                    once they are created and loaded from the backend.
                  </p>

                  <button
                    type="button"
                    onClick={openForm}
                    className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 text-xs font-bold text-white transition hover:bg-[#1D4ED8]"
                  >
                    <Plus size={16} />
                    Submit Leave Request
                  </button>
                </div>
              )}
            </section>

            {/* Backend Notice */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />

                <div>
                  <h2 className="text-sm font-bold text-[#171B3A]">
                    
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-[#64748B]">
                    Leave requests are loaded and submitted through
                    the authenticated backend. No fake requests,
                    localStorage, or sessionStorage is being used.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* New Leave Request Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-request-title"
            className="w-full max-w-xl rounded-2xl bg-white shadow-2xl"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#2563EB]">
                  Request Leave
                </p>

                <h2
                  id="leave-request-title"
                  className="mt-1 text-lg font-bold text-[#171B3A]"
                >
                  New Leave Request
                </h2>

                <p className="mt-1 text-sm text-[#64748B]">
                  Submit your leave request for manager review.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={submitting}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="space-y-5 p-5 sm:p-6">
                {submitted && (
                  <div
                    role="status"
                    className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700"
                  >
                    Leave request submitted successfully.
                  </div>
                )}

                {submitError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
                  >
                    {submitError}
                  </div>
                )}

                {/* Leave Type */}
                <div>
                  <label
                    htmlFor="leaveType"
                    className="mb-2 block text-sm font-semibold text-[#26344D]"
                  >
                    Leave Type
                  </label>

                  <select
                    id="leaveType"
                    name="leaveType"
                    value={form.leaveType}
                    onChange={handleChange}
                    required
                    disabled={submitting}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
                  >
                    <option value="">
                      Select leave type
                    </option>

                    {LEAVE_TYPES.map((type) => (
                      <option
                        key={type.value}
                        value={type.value}
                      >
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="startDate"
                      className="mb-2 block text-sm font-semibold text-[#26344D]"
                    >
                      Start Date
                    </label>

                    <div className="relative">
                      <CalendarDays
                        size={17}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        id="startDate"
                        name="startDate"
                        type="date"
                        value={form.startDate}
                        onChange={handleChange}
                        required
                        disabled={submitting}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-[#26344D] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="endDate"
                      className="mb-2 block text-sm font-semibold text-[#26344D]"
                    >
                      End Date
                    </label>

                    <div className="relative">
                      <CalendarDays
                        size={17}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        id="endDate"
                        name="endDate"
                        type="date"
                        value={form.endDate}
                        onChange={handleChange}
                        required
                        disabled={submitting}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-[#26344D] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label
                    htmlFor="reason"
                    className="mb-2 block text-sm font-semibold text-[#26344D]"
                  >
                    Reason
                  </label>

                  <textarea
                    id="reason"
                    name="reason"
                    value={form.reason}
                    onChange={handleChange}
                    required
                    rows={5}
                    disabled={submitting}
                    placeholder="Enter the reason for your leave request..."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={submitting}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-semibold text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? (
                      <>
                        <Loader2
                          size={17}
                          className="animate-spin"
                        />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={17} />
                        Submit Request
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================
   Sidebar Navigation
========================================= */

function UserNavItem({
  item,
  onNavigate,
}) {
  const pathname = usePathname();
  const Icon = item.icon;

  const isActive =
    pathname === item.href ||
    (item.href !== "/user" &&
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

/* =========================================
   Leave Stat Card
========================================= */

function LeaveStatCard({
  icon: Icon,
  label,
  value,
  description,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#64748B]">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold text-[#171B3A]">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
          <Icon size={19} />
        </div>
      </div>

      <p className="mt-4 text-xs text-[#64748B]">
        {description}
      </p>
    </div>
  );
}

/* =========================================
   Leave Request Row
========================================= */

function LeaveRequestRow({
  request,
  cancelling,
  onCancel,
}) {
  const id = request._id || request.id;

  const status = request.status || "Pending";

  const normalizedStatus =
    String(status).toLowerCase();

  const canCancel =
    normalizedStatus === "pending";

  const startDate = formatDate(
    request.startDate
  );

  const endDate = formatDate(
    request.endDate
  );

  const leaveType = request.leaveType || request.type || "—";

  const leaveTypeLabel =
    LEAVE_TYPES.find(
      (type) => type.value === leaveType
    )?.label || leaveType;

  return (
    <tr className="transition hover:bg-slate-50/70">
      <td className="px-5 py-5 sm:px-6">
        <p className="text-sm font-bold text-[#171B3A]">
          {leaveTypeLabel}
        </p>
      </td>

      <td className="px-5 py-5 text-sm text-[#64748B]">
        {startDate}
      </td>

      <td className="px-5 py-5 text-sm text-[#64748B]">
        {endDate}
      </td>

      <td className="max-w-[260px] px-5 py-5">
        <p
          className="truncate text-sm text-[#64748B]"
          title={request.reason || ""}
        >
          {request.reason || "—"}
        </p>
      </td>

      <td className="px-5 py-5">
        <StatusBadge status={status} />
      </td>

      <td className="px-5 py-5 text-right">
        {canCancel ? (
          <button
            type="button"
            onClick={() => onCancel(id)}
            disabled={cancelling}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelling ? (
              <Loader2
                size={14}
                className="animate-spin"
              />
            ) : (
              <XCircle size={14} />
            )}

            {cancelling
              ? "Cancelling..."
              : "Cancel"}
          </button>
        ) : (
          <span className="text-xs font-medium text-slate-400">
            —
          </span>
        )}
      </td>
    </tr>
  );
}

/* =========================================
   Status Badge
========================================= */

function StatusBadge({ status }) {
  const normalizedStatus =
    String(status).toLowerCase();

  let className =
    "bg-slate-100 text-slate-600";

  if (normalizedStatus === "pending") {
    className =
      "bg-amber-50 text-amber-700";
  }

  if (normalizedStatus === "approved") {
    className =
      "bg-green-50 text-green-700";
  }

  if (
    normalizedStatus === "rejected" ||
    normalizedStatus === "declined"
  ) {
    className =
      "bg-red-50 text-red-700";
  }

  if (
    normalizedStatus === "cancelled" ||
    normalizedStatus === "canceled"
  ) {
    className =
      "bg-slate-100 text-slate-600";
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${className}`}
    >
      {status}
    </span>
  );
}

/* =========================================
   Date Formatter
========================================= */

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}