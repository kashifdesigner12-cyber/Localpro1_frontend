"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import { userService } from "@/services/userService";
import { useAuth } from "@/hooks/useAuth";

export default function ManagerTeamPage() {
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");

  const [teamMembers, setTeamMembers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ==========================================
  // LOAD TEAM MEMBERS
  // ==========================================

  useEffect(() => {
    let mounted = true;

    const loadTeamMembers = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await userService.getUsers();

        if (!mounted) {
          return;
        }

        let users = [];

        if (Array.isArray(response)) {
          users = response;
        } else if (Array.isArray(response?.users)) {
          users = response.users;
        } else if (Array.isArray(response?.data)) {
          users = response.data;
        } else if (Array.isArray(response?.data?.users)) {
          users = response.data.users;
        }

        const currentUserId =
          user?._id ||
          user?.id ||
          user?.userId;

        const normalizedUsers = users
          .filter((member) => {
            const memberId =
              member?._id ||
              member?.id ||
              member?.userId;

            if (
              currentUserId &&
              memberId &&
              String(memberId) === String(currentUserId)
            ) {
              return false;
            }

            return true;
          })
          .map((member) => {
            const memberId =
              member?._id ||
              member?.id ||
              member?.userId;

            const memberName =
              member?.name ||
              member?.fullName ||
              [member?.firstName, member?.lastName]
                .filter(Boolean)
                .join(" ") ||
              member?.username ||
              "User";

            const memberRole = String(
              member?.role || "user"
            )
              .trim()
              .toLowerCase();

            const rawStatus = String(
              member?.status ||
                (member?.isActive === false
                  ? "inactive"
                  : "active")
            )
              .trim()
              .toLowerCase();

            const joinedDate =
              member?.createdAt ||
              member?.joinedAt ||
              member?.dateJoined;

            return {
              id: memberId,
              name: memberName,
              email: member?.email || "—",

              role:
                memberRole.charAt(0).toUpperCase() +
                memberRole.slice(1),

              status:
                rawStatus === "active"
                  ? "Active"
                  : "Inactive",

              joined: joinedDate
                ? new Date(
                    joinedDate
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—",
            };
          });

        setTeamMembers(normalizedUsers);
      } catch (err) {
        if (!mounted) {
          return;
        }

        console.error(
          "MANAGER TEAM LOAD ERROR:",
          err
        );

        setError(
          err?.message ||
            "Unable to load team members."
        );

        setTeamMembers([]);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadTeamMembers();

    return () => {
      mounted = false;
    };
  }, [user]);

  // ==========================================
  // FILTER TEAM
  // ==========================================

  const filteredMembers = useMemo(() => {
    const searchValue = search
      .toLowerCase()
      .trim();

    return teamMembers.filter((member) => {
      const matchesSearch =
        !searchValue ||
        member.name
          ?.toLowerCase()
          .includes(searchValue) ||
        member.email
          ?.toLowerCase()
          .includes(searchValue);

      const matchesStatus =
        status === "all" ||
        member.status?.toLowerCase() ===
          status.toLowerCase();

      const matchesRole =
        role === "all" ||
        member.role?.toLowerCase() ===
          role.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus &&
        matchesRole
      );
    });
  }, [
    teamMembers,
    search,
    status,
    role,
  ]);

  // ==========================================
  // CLEAR FILTERS
  // ==========================================

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setRole("all");
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <main className="w-full min-h-screen bg-[#F8FAFC]">
      <div className="w-full space-y-6 p-5 sm:p-6 lg:p-8">

        {/* ======================================
            PAGE HEADING
        ====================================== */}

        <section className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#2563EB]">
              MANAGEMENT
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
              Team
            </h1>

            <p className="mt-2 text-sm text-[#64748B]">
              View and manage the members of your
              team.
            </p>
          </div>

          <Link
            href="/manager/team/new"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#1D4ED8]"
          >
            <Plus size={18} />

            Add Member
          </Link>
        </section>

        {/* ======================================
            ERROR
        ====================================== */}

        {error && (
          <section className="w-full rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>
          </section>
        )}

        {/* ======================================
            FILTERS
        ====================================== */}

        <section className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex w-full flex-col gap-3 lg:flex-row">

            {/* SEARCH */}

            <div className="relative min-w-0 flex-1">
              <Search
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search team members..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            {/* ROLE */}

            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value)
              }
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#64748B] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="all">
                All Roles
              </option>

              <option value="user">
                User
              </option>

              <option value="manager">
                Manager
              </option>

              <option value="admin">
                Admin
              </option>
            </select>

            {/* STATUS */}

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#64748B] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="all">
                All Status
              </option>

              <option value="active">
                Active
              </option>

              <option value="inactive">
                Inactive
              </option>
            </select>

            {/* CLEAR */}

            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D]"
            >
              <SlidersHorizontal size={17} />

              Clear Filters
            </button>
          </div>
        </section>

        {/* ======================================
            TEAM TABLE
        ====================================== */}

        <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          {/* TABLE HEADER */}

          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <h2 className="text-base font-bold text-[#171B3A]">
              Team Members
            </h2>

            <p className="mt-1 text-sm text-[#64748B]">
              {loading
                ? "Loading team members..."
                : `${filteredMembers.length} team member${
                    filteredMembers.length !== 1
                      ? "s"
                      : ""
                  } displayed.`}
            </p>
          </div>

          {/* TABLE */}

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[800px]">

              {/* TABLE HEAD */}

              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">

                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400 sm:px-6">
                    Member
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                    Role
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                    Status
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                    Joined
                  </th>

                  <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-400">
                    Actions
                  </th>

                </tr>
              </thead>

              {/* TABLE BODY */}

              <tbody>

                {/* LOADING */}

                {loading ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">

                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF]">
                          <Loader2
                            size={28}
                            className="animate-spin text-[#2563EB]"
                          />
                        </div>

                        <h3 className="mt-4 text-sm font-bold text-[#171B3A]">
                          Loading team members
                        </h3>

                        <p className="mt-2 text-sm text-[#64748B]">
                          Fetching your team from the
                          backend...
                        </p>

                      </div>
                    </td>
                  </tr>
                ) : filteredMembers.length > 0 ? (

                  /* MEMBERS */

                  filteredMembers.map((member) => (
                    <tr
                      key={
                        member.id ||
                        `${member.email}-${member.name}`
                      }
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50"
                    >

                      {/* MEMBER */}

                      <td className="px-5 py-4 sm:px-6">
                        <div className="flex items-center gap-3">

                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-sm font-bold text-[#2563EB]">
                            {member.name
                              ?.charAt(0)
                              ?.toUpperCase() ||
                              "U"}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#171B3A]">
                              {member.name}
                            </p>

                            <p className="truncate text-xs text-[#64748B]">
                              {member.email}
                            </p>
                          </div>

                        </div>
                      </td>

                      {/* ROLE */}

                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-[#26344D]">
                          {member.role}
                        </span>
                      </td>

                      {/* STATUS */}

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                            member.status === "Active"
                              ? "bg-green-50 text-green-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {member.status}
                        </span>
                      </td>

                      {/* JOINED */}

                      <td className="px-5 py-4 text-sm text-[#64748B]">
                        {member.joined}
                      </td>

                      {/* ACTION */}

                      <td className="px-5 py-4 text-right">
                        {member.id ? (
                          <Link
                            href={`/manager/team/${member.id}`}
                            className="rounded-lg px-3 py-2 text-xs font-bold text-[#2563EB] transition hover:bg-[#EEF4FF]"
                          >
                            View
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">
                            —
                          </span>
                        )}
                      </td>

                    </tr>
                  ))

                ) : (

                  /* EMPTY */

                  <tr>
                    <td colSpan={5}>
                      <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">

                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                          <Users size={28} />
                        </div>

                        <h3 className="mt-4 text-sm font-bold text-[#171B3A]">
                          {teamMembers.length === 0
                            ? "No team members available"
                            : "No team members found"}
                        </h3>

                        <p className="mt-2 max-w-md text-sm leading-6 text-[#64748B]">
                          {teamMembers.length === 0
                            ? "No users were returned by the backend."
                            : "Try changing your search or filters to find a team member."}
                        </p>

                        {teamMembers.length > 0 && (
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="mt-4 text-sm font-bold text-[#2563EB] hover:underline"
                          >
                            Clear filters
                          </button>
                        )}

                      </div>
                    </td>
                  </tr>

                )}

              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}