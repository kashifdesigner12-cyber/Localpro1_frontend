"use client";

import Link from "next/link";

import { usePathname, useRouter } from "next/navigation";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";

import { authService } from "@/services/authService";

/* ============================================================
   API URL
============================================================ */

const RAW_API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.localpro1.net/api";

const CLEAN_API_URL = RAW_API_URL.replace(/\/+$/, "");

const API_URL = CLEAN_API_URL.endsWith("/api")
  ? CLEAN_API_URL
  : `${CLEAN_API_URL}/api`;

const CACHE_TIME = 30 * 1000;

/* ============================================================
   NAVIGATION
============================================================ */

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
    label: "Attendance",
    href: "/admin/attendance",
    icon: UserCheck,
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
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

/* ============================================================
   STAT CARD & SKELETON COMPONENTS
============================================================ */

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
}) {
  return (
    <div className="group relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(45,35,100,0.06)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(45,35,100,0.10)]">
      <div
        className={`absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${gradient} opacity-[0.08] transition duration-300 group-hover:scale-125`}
      />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[13px] font-semibold text-slate-500">
            {title}
          </p>

          <h3 className="mt-2 text-[28px] font-bold tracking-tight text-slate-900">
            {value}
          </h3>

          <p className="mt-2 text-[11px] font-medium text-slate-400">
            {subtitle}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg`}
        >
          <Icon size={21} strokeWidth={2.2} />
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex justify-between">
        <div>
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="mt-3 h-8 w-20 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-28 rounded bg-slate-100" />
        </div>

        <div className="h-12 w-12 rounded-2xl bg-slate-200" />
      </div>
    </div>
  );
}

/* ============================================================
   MAIN PAGE
============================================================ */

export default function AdminLeaveRequestsPage() {
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [actionType, setActionType] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [counts, setCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  const mountedRef = useRef(false);
  const loadingRef = useRef(false);
  const cacheRef = useRef({
    timestamp: 0,
    data: null,
  });

  /* ==========================================================
     MOUNT CHECK
  ========================================================== */

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ==========================================================
     LOAD LEAVE REQUESTS
  ========================================================== */

  const loadLeaveRequests = useCallback(
    async (force = false) => {
      if (loadingRef.current) {
        return;
      }

      const now = Date.now();

      if (
        !force &&
        cacheRef.current.data &&
        now - cacheRef.current.timestamp < CACHE_TIME
      ) {
        setLeaveRequests(cacheRef.current.data);
        setCounts(
          calculateRequestCounts(cacheRef.current.data)
        );
        setLoading(false);
        return;
      }

      loadingRef.current = true;

      try {
        if (mountedRef.current) {
          if (force) {
            setRefreshing(true);
          }

          setError("");
          setLoading(true);
        }

        const response = await fetch(
          `${API_URL}/leave-requests`,
          {
            method: "GET",
            headers: getAuthHeaders(),
            credentials: "include",
            cache: "no-store",
          }
        );

        const result = await parseResponse(response);

        if (response.status === 401) {
          if (mountedRef.current) {
            setError(
              "Authentication failed. Your session or token may have expired. Please sign in again."
            );
          }

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

        if (!mountedRef.current) {
          return;
        }

        const safeRequests = Array.isArray(requests)
          ? requests
          : [];

        setLeaveRequests(safeRequests);
        setCounts(
          calculateRequestCounts(safeRequests)
        );

        cacheRef.current = {
          timestamp: Date.now(),
          data: safeRequests,
        };
      } catch (requestError) {
        console.error(
          "Load leave requests error:",
          requestError
        );

        if (!mountedRef.current) {
          return;
        }

        setError(
          requestError?.message ||
            "Unable to load leave requests. Please try again."
        );
      } finally {
        loadingRef.current = false;

        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  /* ==========================================================
     INITIAL LOAD
  ========================================================== */

  useEffect(() => {
    loadLeaveRequests(false);
  }, [loadLeaveRequests]);

  /* ==========================================================
     APPROVE / REJECT
  ========================================================== */

  const handleLeaveAction = useCallback(
    async (requestId, type) => {
      if (!requestId || actionId) {
        return;
      }

      if (
        type !== "approve" &&
        type !== "reject"
      ) {
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

        const response = await fetch(endpoint, {
          method: "PUT",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({}),
        });

        const result = await parseResponse(response);

        if (response.status === 401) {
          if (mountedRef.current) {
            setError(
              "Authentication failed. Your session or token may have expired. Please sign in again."
            );
          }

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

        if (!mountedRef.current) {
          return;
        }

        setSuccess(
          type === "approve"
            ? "Leave request approved successfully."
            : "Leave request rejected successfully."
        );

        setTimeout(() => {
          if (mountedRef.current) {
            setSuccess("");
          }
        }, 4000);

        cacheRef.current.timestamp = 0;

        await loadLeaveRequests(true);
      } catch (requestError) {
        console.error(
          `${type} leave request error:`,
          requestError
        );

        if (!mountedRef.current) {
          return;
        }

        setError(
          requestError?.message ||
            `Unable to ${
              type === "approve"
                ? "approve"
                : "reject"
            } leave request.`
        );
      } finally {
        if (mountedRef.current) {
          setActionId(null);
          setActionType("");
        }
      }
    },
    [actionId, loadLeaveRequests]
  );

  /* ==========================================================
     LOGOUT
  ========================================================== */

  const handleLogout = useCallback(async () => {
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
  }, [router]);

  /* ==========================================================
     FILTERED LEAVE REQUESTS
  ========================================================== */

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sf = statusFilter.trim().toLowerCase();

    return leaveRequests.filter((req) => {
      const user =
        req?.user ||
        req?.requestedBy ||
        req?.employee ||
        req?.createdBy ||
        {};

      const uName = String(
        req?.userName ||
          req?.fullName ||
          req?.name ||
          user?.name ||
          user?.fullName ||
          user?.username ||
          ""
      ).toLowerCase();

      const uEmail = String(
        req?.userEmail ||
          req?.email ||
          user?.email ||
          ""
      ).toLowerCase();

      const reason = String(
        req?.reason ||
          req?.description ||
          ""
      ).toLowerCase();

      const leaveType = String(
        req?.leaveType ||
          req?.type ||
          ""
      ).toLowerCase();

      const status = normalizeStatus(
        req?.status
      );

      const matchesSearch =
        !q ||
        uName.includes(q) ||
        uEmail.includes(q) ||
        reason.includes(q) ||
        leaveType.includes(q);

      const matchesStatus =
        sf === "all" || status === sf;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    leaveRequests,
    search,
    statusFilter,
  ]);

  return (
    <div className="relative min-h-screen w-full bg-[#f7f8fc] text-slate-900 animate-fadeIn">
      {/* Background ambient lighting */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      {/* ======================================================
          MOBILE SIDEBAR OVERLAY
      ====================================================== */}

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* ======================================================
          SIDEBAR
      ====================================================== */}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#171B3A] text-white shadow-2xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header */}

        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-md shadow-blue-600/20">
              <ShieldCheck size={22} />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-white">
                Local Pro 1
              </h1>

              <p className="truncate text-[11px] font-semibold text-blue-400">
                Admin Workspace
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setSidebarOpen(false)
            }
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation */}

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
          <div className="mb-2 flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-600 text-xs font-bold text-white shadow-sm">
              A
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">
                Administrator
              </p>

              <p className="truncate text-xs font-medium text-slate-400">
                Admin Account
              </p>
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

      {/* ======================================================
          MAIN CONTENT
      ====================================================== */}

      <div className="min-h-screen w-full">
        {/* Mobile Header */}

        <div className="flex w-full items-center border-b border-slate-200/80 bg-white/80 px-5 py-3 backdrop-blur-sm lg:hidden">
          <button
            type="button"
            onClick={() =>
              setSidebarOpen(true)
            }
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Page Main Content Area */}

        <main className="w-full p-4 sm:p-6 lg:p-8 animate-slideUp">
          <div className="w-full space-y-6">
            {/* PAGE HEADER */}

            <section className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/80 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-violet-700">
                  <ShieldCheck size={13} />
                  ADMINISTRATION
                </div>

                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  Leave Requests
                </h1>

                <p className="mt-0.5 text-xs font-medium text-slate-500">
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
                  disabled={refreshing}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/50 hover:text-violet-700 disabled:opacity-60"
                >
                  <RefreshCw
                    size={15}
                    className={
                      refreshing
                        ? "animate-spin text-violet-600"
                        : ""
                    }
                  />
                  Refresh
                </button>
              </div>
            </section>

            {/* SUCCESS ALERT */}

            {success && (
              <section className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/90 p-4 text-emerald-700 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                    <Check
                      size={15}
                      strokeWidth={2.5}
                    />
                  </div>

                  <p className="text-xs font-bold">
                    {success}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSuccess("")
                  }
                  className="rounded-lg p-1 text-emerald-600 transition hover:bg-emerald-100 hover:text-emerald-800"
                >
                  <X size={15} />
                </button>
              </section>
            )}

            {/* ERROR ALERT */}

            {error && (
              <section className="flex items-center justify-between gap-4 rounded-2xl border border-rose-100 bg-rose-50/90 p-4 text-rose-700 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm">
                    <X
                      size={15}
                      strokeWidth={2.5}
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-bold">
                      Unable to process request
                    </p>

                    <p className="mt-0.5 break-words text-xs font-medium text-rose-600">
                      {error}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setError("")
                  }
                  className="rounded-lg p-1 text-rose-500 transition hover:bg-rose-100 hover:text-rose-700"
                >
                  <X size={15} />
                </button>
              </section>
            )}

            {/* SUMMARY STAT CARDS */}

            <section className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
              {loading &&
              leaveRequests.length === 0 ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : (
                <>
                  <StatCard
                    title="Pending Requests"
                    value={counts.pending}
                    subtitle="Awaiting administrative action"
                    icon={Clock3}
                    gradient="from-amber-500 to-orange-400"
                  />

                  <StatCard
                    title="Approved Requests"
                    value={counts.approved}
                    subtitle="Granted employee leaves"
                    icon={CheckCircle2}
                    gradient="from-emerald-500 to-teal-400"
                  />

                  <StatCard
                    title="Rejected Requests"
                    value={counts.rejected}
                    subtitle="Declined leave submissions"
                    icon={XCircle}
                    gradient="from-rose-500 to-red-400"
                  />
                </>
              )}
            </section>

            {/* FILTERS SECTION */}

            <section className="w-full rounded-[26px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_35px_rgba(45,35,100,0.05)] sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="text"
                    value={search}
                    onChange={(e) =>
                      setSearch(e.target.value)
                    }
                    placeholder="Search by employee name, email, leave type, or reason..."
                    className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 pl-10 pr-4 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(
                        e.target.value
                      )
                    }
                    className="h-11 rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 text-xs font-bold text-slate-600 outline-none transition focus:border-violet-500 focus:bg-white"
                  >
                    <option value="all">
                      All Statuses
                    </option>
                    <option value="pending">
                      Pending
                    </option>
                    <option value="approved">
                      Approved
                    </option>
                    <option value="rejected">
                      Rejected
                    </option>
                  </select>

                  {(search ||
                    statusFilter !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setStatusFilter("all");
                      }}
                      className="inline-flex h-11 items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
                    >
                      <SlidersHorizontal
                        size={15}
                      />
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* REQUEST TABLE */}

            <section className="w-full overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]">
              <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4.5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Workspace Leave Requests
                    </h2>

                    <p className="text-xs text-slate-500">
                      {loading &&
                      leaveRequests.length ===
                        0
                        ? "Loading leave requests..."
                        : `${filteredRequests.length} of ${leaveRequests.length} requests displayed`}
                    </p>
                  </div>

                  {!loading && (
                    <span className="text-xs font-semibold text-slate-400">
                      {leaveRequests.length} Total
                      Records
                    </span>
                  )}
                </div>
              </div>

              {loading &&
              leaveRequests.length === 0 ? (
                <div className="flex min-h-[300px] w-full flex-col items-center justify-center p-8 text-center">
                  <Loader2
                    size={28}
                    className="animate-spin text-violet-600"
                  />

                  <p className="mt-3 text-xs font-semibold text-slate-400">
                    Loading leave requests...
                  </p>
                </div>
              ) : filteredRequests.length >
                0 ? (
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[1000px] text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/30">
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

                        <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredRequests.map(
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
                <div className="flex min-h-[260px] w-full flex-col items-center justify-center px-6 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                    <ClipboardCheck size={22} />
                  </div>

                  <h3 className="mt-3 text-xs font-bold text-slate-900">
                    {leaveRequests.length ===
                    0
                      ? "No leave requests available"
                      : "No matching leave requests"}
                  </h3>

                  <p className="mt-1 max-w-xs text-xs text-slate-400">
                    {leaveRequests.length ===
                    0
                      ? "There are currently no leave requests submitted."
                      : "Try clearing filters to see results."}
                  </p>

                  {(search ||
                    statusFilter !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setStatusFilter("all");
                      }}
                      className="mt-4 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ============================================================
   AUTH HEADERS
============================================================ */

function getAuthHeaders() {
  const headers = {
    Accept: "application/json",
  };

  if (typeof window === "undefined") {
    return headers;
  }

  const tokenKeys = [
    "token",
    "accessToken",
    "access_token",
    "authToken",
    "auth_token",
    "jwt",
  ];

  let token = null;

  for (const key of tokenKeys) {
    try {
      const localToken =
        localStorage.getItem(key);

      const sessionToken =
        sessionStorage.getItem(key);

      token =
        localToken ||
        sessionToken ||
        null;

      if (token) {
        break;
      }
    } catch {}
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/* ============================================================
   PARSE RESPONSE
============================================================ */

async function parseResponse(response) {
  try {
    const text = await response.text();

    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return {
        success: false,
        message: text,
      };
    }
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

  if (
    Array.isArray(result?.leaveRequests)
  ) {
    return result.leaveRequests;
  }

  if (Array.isArray(result?.data)) {
    return result.data;
  }

  if (
    Array.isArray(result?.data?.requests)
  ) {
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

function calculateRequestCounts(
  requests
) {
  let pending = 0;
  let approved = 0;
  let rejected = 0;

  if (!Array.isArray(requests)) {
    return {
      pending: 0,
      approved: 0,
      rejected: 0,
    };
  }

  requests.forEach((request) => {
    const status = normalizeStatus(
      request?.status
    );

    if (status === "pending") {
      pending += 1;
    }

    if (status === "approved") {
      approved += 1;
    }

    if (status === "rejected") {
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
      className={`group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold transition duration-150 ${
        isActive
          ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon
        size={18}
        className={`transition duration-150 ${
          isActive
            ? "text-white"
            : "text-slate-400 group-hover:text-white"
        }`}
      />

      <span>{item.label}</span>
    </Link>
  );
}

/* ============================================================
   TABLE HEADER
============================================================ */

function TableHeader({ children }) {
  return (
    <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
      {children}
    </th>
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
    request?._id || request?.id;

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
    request?.status || "Pending";

  const normalizedStatus =
    normalizeStatus(status);

  const isPending =
    normalizedStatus === "pending";

  const isProcessing =
    String(actionId) === String(id);

  return (
    <tr className="border-b border-slate-100 last:border-b-0 transition hover:bg-slate-50/50">
      {/* User */}

      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-sm">
            {userName
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-slate-900">
              {userName}
            </p>

            {userEmail && (
              <p className="truncate text-[10px] text-slate-400">
                {userEmail}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Leave Type */}

      <td className="px-6 py-4">
        <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-0.5 text-[10px] font-bold text-violet-700">
          {leaveType}
        </span>
      </td>

      {/* Start Date */}

      <td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-slate-600">
        {formatDate(startDate)}
      </td>

      {/* End Date */}

      <td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-slate-600">
        {formatDate(endDate)}
      </td>

      {/* Reason */}

      <td className="max-w-xs px-6 py-4 text-xs text-slate-500">
        <p
          className="max-w-xs truncate"
          title={String(reason)}
        >
          {reason}
        </p>
      </td>

      {/* Status */}

      <td className="px-6 py-4">
        <StatusBadge status={status} />
      </td>

      {/* Actions */}

      <td className="px-6 py-4 text-right sm:pr-6">
        {isPending ? (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={
                Boolean(actionId) || !id
              }
              onClick={() =>
                onAction(
                  id,
                  "approve"
                )
              }
              className="inline-flex h-8 items-center gap-1 rounded-xl bg-violet-600 px-3 text-xs font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
            >
              {isProcessing &&
              actionType ===
                "approve" ? (
                <Loader2
                  size={13}
                  className="animate-spin"
                />
              ) : (
                <Check
                  size={13}
                  strokeWidth={2.5}
                />
              )}

              <span>
                {isProcessing &&
                actionType ===
                  "approve"
                  ? "Approving..."
                  : "Approve"}
              </span>
            </button>

            <button
              type="button"
              disabled={
                Boolean(actionId) || !id
              }
              onClick={() =>
                onAction(
                  id,
                  "reject"
                )
              }
              className="inline-flex h-8 items-center gap-1 rounded-xl border border-rose-100 bg-rose-50 px-3 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
            >
              {isProcessing &&
              actionType ===
                "reject" ? (
                <Loader2
                  size={13}
                  className="animate-spin"
                />
              ) : (
                <X
                  size={13}
                  strokeWidth={2.5}
                />
              )}

              <span>
                {isProcessing &&
                actionType ===
                  "reject"
                  ? "Rejecting..."
                  : "Reject"}
              </span>
            </button>
          </div>
        ) : (
          <span className="text-xs font-medium text-slate-300">
            —
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

  let classes =
    "bg-slate-100 text-slate-600 border border-slate-200";

  if (normalized === "approved") {
    classes =
      "bg-emerald-50 text-emerald-700 border border-emerald-200";
  } else if (
    normalized === "rejected"
  ) {
    classes =
      "bg-rose-50 text-rose-700 border border-rose-200";
  } else if (
    normalized === "pending"
  ) {
    classes =
      "bg-amber-50 text-amber-700 border border-amber-200";
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${classes}`}
    >
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
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}