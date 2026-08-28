"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  Activity,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import { authService } from "@/services/authService";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api";

const navigation = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: Users,
  },
  {
    label: "Tasks",
    href: "/admin/tasks",
    icon: ClipboardList,
  },
  {
    label: "Leave Requests",
    href: "/admin/leave-requests",
    icon: ClipboardCheck,
  },
  {
    label: "Conversations",
    href: "/admin/conversations",
    icon: MessageSquare,
  },
  {
    label: "Calendar",
    href: "/admin/calendar",
    icon: CalendarDays,
  },
  {
    label: "Activity",
    href: "/admin/activity",
    icon: Activity,
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

export default function AdminLeaveRequestsPage() {
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [actionType, setActionType] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [counts, setCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  /*
   * ============================================================
   * LOAD LEAVE REQUESTS
   * ============================================================
   */

  const loadLeaveRequests = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        setError("");

        const response = await fetch(
          `${API_URL}/leave-requests`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            credentials: "include",
            cache: "no-store",
          }
        );

        const result = await parseResponse(response);

        if (response.status === 401) {
          await authService.logout().catch(() => {});
          router.replace("/login");
          return;
        }

        if (response.status === 403) {
          throw new Error(
            result?.message ||
              "You do not have permission to view leave requests."
          );
        }

        if (
          !response.ok ||
          result?.success === false
        ) {
          throw new Error(
            result?.message ||
              result?.error ||
              `Failed to load leave requests. Status: ${response.status}`
          );
        }

        const requests = extractRequests(result);

        setLeaveRequests(requests);
        setCounts(
          calculateRequestCounts(requests)
        );
      } catch (requestError) {
        console.error(
          "Load leave requests error:",
          requestError
        );

        setError(
          requestError?.message ||
            "Unable to load leave requests. Please try again."
        );
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [router]
  );

  /*
   * ============================================================
   * INITIAL LOAD
   * ============================================================
   */

  useEffect(() => {
    loadLeaveRequests(true);
  }, [loadLeaveRequests]);

  /*
   * ============================================================
   * APPROVE / REJECT
   * ============================================================
   */

  async function handleLeaveAction(
    requestId,
    type
  ) {
    if (!requestId || actionId) {
      return;
    }

    try {
      setActionId(requestId);
      setActionType(type);

      setError("");
      setSuccess("");

      const endpoint =
        type === "approve"
          ? `${API_URL}/leave-requests/${requestId}/approve`
          : `${API_URL}/leave-requests/${requestId}/reject`;

      const response = await fetch(
        endpoint,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );

      const result = await parseResponse(response);

      if (response.status === 401) {
        await authService.logout().catch(() => {});
        router.replace("/login");
        return;
      }

      if (response.status === 403) {
        throw new Error(
          result?.message ||
            `You do not have permission to ${
              type === "approve"
                ? "approve"
                : "reject"
            } this leave request.`
        );
      }

      if (
        !response.ok ||
        result?.success === false
      ) {
        throw new Error(
          result?.message ||
            result?.error ||
            `Failed to ${
              type === "approve"
                ? "approve"
                : "reject"
            } leave request.`
        );
      }

      setSuccess(
        type === "approve"
          ? "Leave request approved successfully."
          : "Leave request rejected successfully."
      );

      await loadLeaveRequests(false);
    } catch (requestError) {
      console.error(
        `${type} leave request error:`,
        requestError
      );

      setError(
        requestError?.message ||
          `Unable to ${
            type === "approve"
              ? "approve"
              : "reject"
          } leave request.`
      );
    } finally {
      setActionId(null);
      setActionType("");
    }
  }

  /*
   * ============================================================
   * LOGOUT
   * ============================================================
   */

  async function handleLogout() {
    try {
      await authService.logout();
    } catch (logoutError) {
      console.error(
        "Admin logout error:",
        logoutError
      );
    } finally {
      setSidebarOpen(false);
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC]">

      {/* ======================================================
          MOBILE SIDEBAR OVERLAY
      ====================================================== */}

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() =>
            setSidebarOpen(false)
          }
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* ======================================================
          SIDEBAR
      ====================================================== */}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#171B3A] shadow-xl transition-transform duration-300 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        } lg:translate-x-0`}
      >
        {/* Sidebar Header */}

        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <div className="flex min-w-0 items-center gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white">
              <ShieldCheck size={22} />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-white">
                Local Pro 1
              </h1>

              <p className="truncate text-[11px] font-medium text-slate-300">
                Admin Workspace
              </p>
            </div>

          </div>

          <button
            type="button"
            onClick={() =>
              setSidebarOpen(false)
            }
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/10 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation */}

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-300">
            Administration
          </p>

          <div className="space-y-1.5">
            {navigation.map((item) => (
              <AdminNavItem
                key={item.href}
                item={item}
                onNavigate={() =>
                  setSidebarOpen(false)
                }
              />
            ))}
          </div>
        </nav>

        {/* Profile */}

        <div className="shrink-0 border-t border-white/10 p-3">

          <div className="mb-1 flex items-center gap-3 rounded-xl px-3 py-3">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-xs font-bold text-white">
              A
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                Administrator
              </p>

              <p className="truncate text-xs font-medium text-slate-300">
                Admin Account
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

      {/* ======================================================
          MAIN CONTENT

          EXACT SAME STRUCTURE AS TASK PAGE
          NO lg:pl-64
          FULL WIDTH
      ====================================================== */}

      <div className="min-h-screen w-full">

        {/* Mobile Menu */}

        <div className="flex w-full items-center border-b border-slate-200 bg-white px-5 py-3 lg:hidden">
          <button
            type="button"
            onClick={() =>
              setSidebarOpen(true)
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-[#26344D] transition hover:bg-slate-50"
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* ====================================================
            PAGE CONTENT
        ==================================================== */}

        <main className="w-full p-5 sm:p-6 lg:p-8">

          <div className="w-full max-w-none space-y-6">

            {/* ==================================================
                PAGE HEADER
            ================================================== */}

            <section className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

              <div>
                <p className="text-sm font-semibold text-[#2563EB]">
                  ADMINISTRATION
                </p>

                <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
                  Leave Requests
                </h1>

                <p className="mt-2 text-sm text-[#64748B]">
                  Review and manage leave requests
                  submitted by workspace users.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">

                <button
                  type="button"
                  onClick={() =>
                    loadLeaveRequests(true)
                  }
                  disabled={loading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#26344D] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Clock3 size={17} />
                  )}

                  {loading
                    ? "Loading..."
                    : "Refresh"}
                </button>

              </div>

            </section>

            {/* ==================================================
                SUCCESS
            ================================================== */}

            {success && (
              <section className="w-full rounded-2xl border border-green-100 bg-green-50 p-5">

                <div className="flex items-center justify-between gap-4">

                  <div className="flex items-center gap-3">

                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
                      <Check size={16} />
                    </div>

                    <p className="text-sm font-semibold text-green-700">
                      {success}
                    </p>

                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSuccess("")
                    }
                    className="text-green-600 transition hover:text-green-800"
                    aria-label="Close success message"
                  >
                    <X size={17} />
                  </button>

                </div>

              </section>
            )}

            {/* ==================================================
                ERROR
            ================================================== */}

            {error && (
              <section className="w-full rounded-2xl border border-red-100 bg-red-50 p-5">

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                  <div>
                    <h2 className="text-sm font-bold text-red-700">
                      Unable to process request
                    </h2>

                    <p className="mt-1 text-sm text-red-600">
                      {error}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setError("")
                    }
                    className="inline-flex h-9 w-fit items-center justify-center rounded-lg px-3 text-red-500 transition hover:bg-red-100 hover:text-red-700"
                    aria-label="Close error"
                  >
                    <X size={17} />
                  </button>

                </div>

              </section>
            )}

            {/* ==================================================
                SUMMARY CARDS
            ================================================== */}

            <section className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">

              <SummaryCard
                icon={Clock3}
                title="Pending Requests"
                value={counts.pending}
              />

              <SummaryCard
                icon={CheckCircle2}
                title="Approved Requests"
                value={counts.approved}
              />

              <SummaryCard
                icon={X}
                title="Rejected Requests"
                value={counts.rejected}
              />

            </section>

            {/* ==================================================
                REQUEST TABLE
            ================================================== */}

            <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

              {/* Table Header */}

              <div className="border-b border-slate-100 px-5 py-5 sm:px-6">

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                  <div>
                    <h2 className="text-base font-bold text-[#171B3A]">
                      Workspace Leave Requests
                    </h2>

                    <p className="mt-1 text-sm text-[#64748B]">
                      {loading
                        ? "Loading leave requests from backend..."
                        : `${leaveRequests.length} request${
                            leaveRequests.length !==
                            1
                              ? "s"
                              : ""
                          } displayed.`}
                    </p>
                  </div>

                  {!loading && (
                    <span className="inline-flex w-fit rounded-full bg-[#EEF4FF] px-3 py-1 text-xs font-bold text-[#2563EB]">
                      {leaveRequests.length} Total
                    </span>
                  )}

                </div>

              </div>

              {/* Loading */}

              {loading ? (
                <div className="flex min-h-[360px] w-full flex-col items-center justify-center px-6 text-center">

                  <Loader2
                    size={30}
                    className="animate-spin text-[#2563EB]"
                  />

                  <h3 className="mt-4 text-sm font-bold text-[#171B3A]">
                    Loading leave requests
                  </h3>

                  <p className="mt-2 text-sm text-[#64748B]">
                    Fetching real leave request
                    records from the backend.
                  </p>

                </div>
              ) : leaveRequests.length > 0 ? (

                <div className="w-full overflow-x-auto">

                  <table className="w-full min-w-[1050px]">

                    <thead>

                      <tr className="border-b border-slate-100 bg-slate-50/70">

                        <TableHeader>
                          User
                        </TableHeader>

                        <TableHeader>
                          Leave Type
                        </TableHeader>

                        <TableHeader>
                          Start Date
                        </TableHeader>

                        <TableHeader>
                          End Date
                        </TableHeader>

                        <TableHeader>
                          Reason
                        </TableHeader>

                        <TableHeader>
                          Status
                        </TableHeader>

                        <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-400 sm:px-6">
                          Actions
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {leaveRequests.map(
                        (request, index) => {

                          const requestId =
                            request?._id ||
                            request?.id;

                          const rowKey =
                            requestId ||
                            `leave-row-${index}`;

                          return (
                            <LeaveRequestRow
                              key={rowKey}
                              request={request}
                              actionId={actionId}
                              actionType={actionType}
                              onAction={
                                handleLeaveAction
                              }
                            />
                          );
                        }
                      )}

                    </tbody>

                  </table>

                </div>

              ) : (

                <div className="flex min-h-[360px] w-full flex-col items-center justify-center px-6 text-center">

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                    <ClipboardCheck size={25} />
                  </div>

                  <h3 className="mt-4 text-sm font-bold text-[#171B3A]">
                    No leave requests available
                  </h3>

                  <p className="mt-2 max-w-sm text-sm leading-6 text-[#64748B]">
                    There are currently no leave
                    request records available from
                    the backend.
                  </p>

                </div>

              )}

            </section>

            {/* ==================================================
                RESULTS FOOTER
            ================================================== */}

            <section className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

              <p className="text-xs text-slate-400">
                {loading
                  ? "Loading leave request records..."
                  : `${leaveRequests.length} leave request${
                      leaveRequests.length !== 1
                        ? "s"
                        : ""
                    } displayed`}
              </p>

              <button
                type="button"
                onClick={() =>
                  loadLeaveRequests(true)
                }
                disabled={loading}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#26344D] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Clock3
                  size={14}
                  className={
                    loading
                      ? "animate-spin"
                      : ""
                  }
                />

                Refresh Requests
              </button>

            </section>

          </div>

        </main>

      </div>

    </div>
  );
}

/* ============================================================
   PARSE RESPONSE
============================================================ */

async function parseResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/* ============================================================
   EXTRACT REQUESTS
============================================================ */

function extractRequests(result) {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.requests)) {
    return result.requests;
  }

  if (Array.isArray(result?.leaveRequests)) {
    return result.leaveRequests;
  }

  if (Array.isArray(result?.data)) {
    return result.data;
  }

  if (Array.isArray(result?.data?.requests)) {
    return result.data.requests;
  }

  if (
    Array.isArray(
      result?.data?.leaveRequests
    )
  ) {
    return result.data.leaveRequests;
  }

  return [];
}

/* ============================================================
   CALCULATE COUNTS
============================================================ */

function calculateRequestCounts(requests) {
  let pending = 0;
  let approved = 0;
  let rejected = 0;

  requests.forEach((request) => {
    const status = normalizeStatus(
      request?.status
    );

    if (status === "pending") {
      pending += 1;
    } else if (status === "approved") {
      approved += 1;
    } else if (status === "rejected") {
      rejected += 1;
    }
  });

  return {
    pending,
    approved,
    rejected,
  };
}

/* ============================================================
   STATUS NORMALIZER
============================================================ */

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase();
}

/* ============================================================
   SIDEBAR NAV ITEM
============================================================ */

function AdminNavItem({
  item,
  onNavigate,
}) {
  const pathname = usePathname();

  const Icon = item.icon;

  const isActive =
    pathname === item.href ||
    (item.href !== "/admin" &&
      pathname.startsWith(
        `${item.href}/`
      ));

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
        isActive
          ? "bg-[#2563EB] text-white shadow-sm"
          : "bg-transparent text-white hover:bg-white/10"
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

/* ============================================================
   TABLE HEADER
============================================================ */

function TableHeader({ children }) {
  return (
    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400 sm:px-6">
      {children}
    </th>
  );
}

/* ============================================================
   SUMMARY CARD
============================================================ */

function SummaryCard({
  icon: Icon,
  title,
  value,
}) {
  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-sm font-medium text-[#64748B]">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-[#171B3A]">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Live backend data
          </p>

        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
          <Icon size={20} />
        </div>

      </div>

    </div>
  );
}

/* ============================================================
   LEAVE REQUEST ROW
============================================================ */

function LeaveRequestRow({
  request,
  actionId,
  actionType,
  onAction,
}) {
  const id =
    request?._id ||
    request?.id;

  const user =
    request?.user ||
    request?.requestedBy ||
    request?.employee ||
    request?.createdBy ||
    {};

  const userName =
    request?.userName ||
    request?.fullName ||
    request?.name ||
    user?.name ||
    user?.fullName ||
    user?.username ||
    user?.email ||
    "Unknown User";

  const userEmail =
    request?.userEmail ||
    request?.email ||
    user?.email ||
    "";

  const leaveType =
    request?.leaveType ||
    request?.type ||
    request?.leave_type ||
    "—";

  const startDate =
    request?.startDate ||
    request?.start_date ||
    request?.fromDate ||
    request?.from ||
    "—";

  const endDate =
    request?.endDate ||
    request?.end_date ||
    request?.toDate ||
    request?.to ||
    "—";

  const reason =
    request?.reason ||
    request?.description ||
    "—";

  const status =
    request?.status ||
    "Pending";

  const normalizedStatus =
    normalizeStatus(status);

  const isPending =
    normalizedStatus === "pending";

  const isProcessing =
    String(actionId) === String(id);

  return (
    <tr className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">

      {/* User */}

      <td className="px-5 py-4 sm:px-6">
        <div>

          <p className="text-sm font-bold text-[#171B3A]">
            {userName}
          </p>

          {userEmail && (
            <p className="mt-1 text-xs text-[#64748B]">
              {userEmail}
            </p>
          )}

        </div>
      </td>

      {/* Leave Type */}

      <td className="px-5 py-4 text-sm text-[#26344D]">
        {leaveType}
      </td>

      {/* Start Date */}

      <td className="px-5 py-4 text-sm text-[#26344D]">
        {formatDate(startDate)}
      </td>

      {/* End Date */}

      <td className="px-5 py-4 text-sm text-[#26344D]">
        {formatDate(endDate)}
      </td>

      {/* Reason */}

      <td className="max-w-xs px-5 py-4 text-sm text-[#64748B]">
        <p
          className="max-w-xs truncate"
          title={reason}
        >
          {reason}
        </p>
      </td>

      {/* Status */}

      <td className="px-5 py-4">
        <StatusBadge status={status} />
      </td>

      {/* Actions */}

      <td className="px-5 py-4 text-right">

        {isPending ? (

          <div className="flex justify-end gap-2">

            <button
              type="button"
              disabled={Boolean(actionId)}
              onClick={() =>
                onAction(
                  id,
                  "approve"
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isProcessing &&
              actionType ===
                "approve" ? (
                <Loader2
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <Check size={14} />
              )}

              {isProcessing &&
              actionType ===
                "approve"
                ? "Approving..."
                : "Approve"}
            </button>

            <button
              type="button"
              disabled={Boolean(actionId)}
              onClick={() =>
                onAction(
                  id,
                  "reject"
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isProcessing &&
              actionType ===
                "reject" ? (
                <Loader2
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <X size={14} />
              )}

              {isProcessing &&
              actionType ===
                "reject"
                ? "Rejecting..."
                : "Reject"}
            </button>

          </div>

        ) : (

          <span className="text-xs font-semibold text-slate-400">
            No action required
          </span>

        )}

      </td>

    </tr>
  );
}

/* ============================================================
   STATUS BADGE
============================================================ */

function StatusBadge({ status }) {
  const normalized =
    normalizeStatus(status);

  if (normalized === "approved") {
    return (
      <span className="inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
        Approved
      </span>
    );
  }

  if (normalized === "rejected") {
    return (
      <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
        Rejected
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
      {status || "Pending"}
    </span>
  );
}

/* ============================================================
   DATE FORMAT
============================================================ */

function formatDate(value) {
  if (!value || value === "—") {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }
  );
}