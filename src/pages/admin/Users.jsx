import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Users,
  UserCheck,
  UserRoundX,
  RefreshCw,
  ShieldCheck,
  X,
  Check,
  UserRound,
  Filter,
  Download,
  Pencil,
  Trash2,
  Building2,
  CalendarDays,
  AlertCircle,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import api from "../../services/api";

const emptyForm = {
  username: "",
  password: "",
  role: "user",
  jobTitle: "",
  department: "",
  phone: "",
};

const statusStyles = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
  pending: "bg-amber-50 text-amber-700 border border-amber-200/60",
  blocked: "bg-rose-50 text-rose-700 border border-rose-200/60",
  inactive: "bg-slate-100 text-slate-600 border border-slate-200/60",
};

const roleStyles = {
  admin: "bg-violet-50 text-violet-700 border border-violet-200/60",
  manager: "bg-blue-50 text-blue-700 border border-blue-200/60",
  user: "bg-purple-50 text-purple-700 border border-purple-200/60",
};

const titleCase = (value = "") =>
  value.charAt(0).toUpperCase() + value.slice(1);

const getUserId = (user) => user?._id || user?.id || "";

const inputClass =
  "mt-2 min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100 disabled:bg-slate-50";

function ModalShell({ children, onClose, wide = false }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className={`my-auto w-full ${wide ? "max-w-xl" : "max-w-md"} overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl`}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ icon: Icon, title, description, onClose, danger }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 px-6 py-5">
      <div className="flex min-w-0 items-center gap-3.5">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            danger
              ? "bg-rose-50 text-rose-600 border border-rose-100"
              : "bg-violet-50 text-violet-600"
          }`}
        >
          <Icon size={21} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-400">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close dialog"
        className="shrink-0 rounded-2xl p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <X size={19} />
      </button>
    </div>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const [statusTarget, setStatusTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("en", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    []
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/users");
      const data = response.data;

      const list = Array.isArray(data?.users)
        ? data.users
        : Array.isArray(data?.data?.users)
          ? data.data.users
          : Array.isArray(data?.data)
            ? data.data
            : [];

      setUsers(list);
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Unable to load users."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Instant client-side filtering to eliminate lag during search and dropdown filtering
  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const username = String(user.username || user.name || "").toLowerCase();
      const department = String(user.department || "").toLowerCase();
      const matchesSearch = !query || username.includes(query) || department.includes(query);

      const matchesRole = roleFilter === "All" || user.role === roleFilter;
      const matchesStatus = statusFilter === "All" || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const stats = useMemo(
    () => [
      {
        label: "Total Users",
        value: users.length,
        icon: Users,
        color: "bg-violet-50 text-violet-600",
      },
      {
        label: "Active Accounts",
        value: users.filter((user) => user.status === "active").length,
        icon: UserCheck,
        color: "bg-emerald-50 text-emerald-600",
      },
      {
        label: "Pending Accounts",
        value: users.filter((user) => user.status === "pending").length,
        icon: UserRoundX,
        color: "bg-amber-50 text-amber-600",
      },
    ],
    [users],
  );

  function openCreateModal() {
    setEditingUser(null);
    setForm({ ...emptyForm });
    setError("");
    setNotice("");
    setModalOpen(true);
  }

  function openEditModal(user) {
    setEditingUser(user);
    setForm({
      username: user.username || "",
      password: "",
      role: user.role || "user",
      jobTitle: user.jobTitle || "",
      department: user.department || "",
      phone: user.phone || "",
    });
    setError("");
    setNotice("");
    setModalOpen(true);
  }

  function closeFormModal() {
    if (saving) return;
    setModalOpen(false);
    setEditingUser(null);
    setForm({ ...emptyForm });
    setError("");
  }

  async function saveUser(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        username: form.username.trim().toLowerCase(),
        role: form.role,
        jobTitle: form.jobTitle.trim(),
        department: form.department.trim(),
        phone: form.phone.trim(),
      };

      const response = editingUser
        ? await api.patch(`/users/${getUserId(editingUser)}`, payload)
        : await api.post("/users", {
            ...payload,
            password: form.password,
          });

      setModalOpen(false);
      setEditingUser(null);
      setForm({ ...emptyForm });
      setNotice(
        response.data?.message ||
          (editingUser
            ? "User updated successfully."
            : "User created successfully."),
      );

      await loadUsers();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          (editingUser ? "Unable to update user." : "Unable to create user."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(user, status) {
    const id = getUserId(user);
    if (!id) return;

    setUpdatingId(id);
    setError("");
    setNotice("");

    try {
      const response = await api.patch(`/users/${id}/status`, { status });

      setUsers((current) =>
        current.map((item) =>
          getUserId(item) === id
            ? { ...item, status: response.data?.user?.status || status }
            : item,
        ),
      );

      setNotice(response.data?.message || "Account status updated.");
      setStatusTarget(null);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to update account status.",
      );
    } finally {
      setUpdatingId("");
    }
  }

  async function deleteUser() {
    const id = getUserId(deleteTarget);
    if (!id) return;

    setDeletingId(id);
    setError("");
    setNotice("");

    try {
      const response = await api.delete(`/users/${id}`);

      setUsers((current) =>
        current.filter((user) => getUserId(user) !== id),
      );

      setNotice(response.data?.message || "User deleted successfully.");
      setDeleteTarget(null);
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Unable to delete user.",
      );
    } finally {
      setDeletingId("");
    }
  }

  function exportUsers() {
    const data = users.map(
      ({
        username,
        name,
        role,
        status,
        jobTitle,
        department,
        phone,
        createdAt,
        lastLoginAt,
      }) => ({
        username,
        name,
        role,
        status,
        jobTitle,
        department,
        phone,
        createdAt,
        lastLoginAt,
      }),
    );

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "localpro-users.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-3xl p-6 shadow-xs border border-slate-100">
        <div>
          <span className="text-xs font-bold tracking-wider text-violet-600 uppercase">
            Admin Workspace
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Users Management
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs">
            <CalendarDays size={17} className="text-violet-600" />
            <span>{today}</span>
          </div>

          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-95"
          >
            <Plus size={18} />
            Add User
          </button>
        </div>
      </div>

      {(notice || error) && (
        <div
          role={error ? "alert" : "status"}
          className={`flex items-start justify-between gap-3 rounded-2xl border px-5 py-3.5 text-sm font-medium shadow-2xs ${
            error
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          <div className="flex min-w-0 items-start gap-2.5">
            {error && <AlertCircle size={18} className="mt-0.5 shrink-0" />}
            <span>{error || notice}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setNotice("");
              setError("");
            }}
            aria-label="Dismiss message"
            className="rounded-xl p-1.5 transition hover:bg-black/5"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Stats Cards Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article
              key={stat.label}
              className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs transition hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-500">
                    {stat.label}
                  </p>
                  <p className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
                    {loading ? "—" : stat.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {loading ? "Loading..." : "Current filtered results"}
                  </p>
                </div>
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${stat.color}`}
                >
                  <Icon size={22} />
                </span>
              </div>
            </article>
          );
        })}
      </section>

      {/* Filter / Search Bar Container */}
      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs sm:p-6">
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-900">Find Users</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Search accounts and filter by role or status instantly.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_200px_200px]">
          <div className="relative min-w-0">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by username or department..."
              aria-label="Search users"
              className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
            />
          </div>

          <div className="relative">
            <Filter
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              aria-label="Filter by role"
              className="min-h-11 w-full appearance-none rounded-2xl border border-slate-200/80 bg-slate-50/40 py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100 cursor-pointer"
            >
              <option value="All">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="user">User</option>
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by status"
            className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100 cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="blocked">Blocked</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </section>

      {/* Users Table Container */}
      <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Workspace Accounts
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Showing {filteredUsers.length} of {users.length} account(s)
            </p>
          </div>
          <button
            type="button"
            onClick={exportUsers}
            disabled={!users.length}
            className="inline-flex min-h-10 w-fit items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={16} />
            Export JSON
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw
              size={28}
              className="mx-auto animate-spin text-violet-600"
            />
            <p className="mt-3 text-sm text-slate-400">Loading users...</p>
          </div>
        ) : filteredUsers.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead className="bg-slate-50/50 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-bold">User</th>
                  <th className="px-5 py-4 font-bold">Role</th>
                  <th className="px-5 py-4 font-bold">Status</th>
                  <th className="px-5 py-4 font-bold">Department</th>
                  <th className="px-5 py-4 font-bold">Joined</th>
                  <th className="px-5 py-4 font-bold">Change Status</th>
                  <th className="px-5 py-4 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const id = getUserId(user);
                  const username = user.username || user.name || "Unknown user";
                  const isAdmin = user.role === "admin";

                  return (
                    <tr
                      key={id || username}
                      className="transition-colors hover:bg-slate-50/50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3.5">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-sm font-extrabold uppercase text-violet-600">
                            {username.slice(0, 2)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800">
                              {username}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              {user.jobTitle || "Workspace member"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${roleStyles[user.role] || roleStyles.user}`}
                        >
                          {titleCase(user.role || "user")}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${statusStyles[user.status] || statusStyles.inactive}`}
                        >
                          {titleCase(user.status || "inactive")}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <Building2 size={14} className="text-slate-400" />
                          {user.department || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-slate-500">
                          <CalendarDays size={14} className="text-slate-400" />
                          {user.createdAt
                            ? new Date(user.createdAt).toLocaleDateString()
                            : "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <select
                          value={user.status || "inactive"}
                          disabled={updatingId === id || isAdmin || !id}
                          onChange={(event) =>
                            setStatusTarget({
                              user,
                              status: event.target.value,
                            })
                          }
                          aria-label={`Change status for ${username}`}
                          className="min-h-9 rounded-xl border border-slate-200/80 bg-slate-50/40 px-3 text-xs font-bold text-slate-700 outline-none transition focus:border-violet-300 focus:bg-white disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                        >
                          <option value="active">Active</option>
                          <option value="pending">Pending</option>
                          <option value="blocked">Blocked</option>
                          <option value="inactive">Inactive</option>
                        </select>
                        {updatingId === id && (
                          <span className="mt-1 block text-xs text-slate-400">
                            Saving...
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(user)}
                            disabled={!id || saving || deletingId === id}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(user)}
                            disabled={!id || isAdmin || deletingId === id}
                            title={
                              isAdmin
                                ? "Admin accounts cannot be deleted here"
                                : "Delete user"
                            }
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                            {deletingId === id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 border border-violet-100">
              <Users size={27} />
            </span>
            <h3 className="mt-4 text-lg font-bold text-slate-900">
              No users found
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-slate-400">
              {search || roleFilter !== "All" || statusFilter !== "All"
                ? "Try changing your search or filters."
                : "Create a user account to get started."}
            </p>
          </div>
        )}
      </section>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <ModalShell onClose={closeFormModal} wide>
          <ModalHeader
            icon={UserRound}
            title={editingUser ? "Edit User" : "Add User"}
            description={
              editingUser
                ? "Update this account's details."
                : "Create a username and password for this account."
            }
            onClose={closeFormModal}
          />

          <form onSubmit={saveUser} className="space-y-4 p-6 sm:p-7">
            {error && (
              <p
                role="alert"
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
              >
                {error}
              </p>
            )}

            <label className="block text-sm font-bold text-slate-800">
              Username *
              <input
                required
                autoFocus
                minLength={3}
                maxLength={50}
                pattern="[a-zA-Z0-9._\-]+"
                title="Use letters, numbers, dots, underscores or hyphens."
                autoComplete="off"
                value={form.username}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    username: event.target.value,
                  }))
                }
                className={inputClass}
                placeholder="Enter username"
              />
              <span className="mt-1 block text-xs font-normal text-slate-400">
                Use letters, numbers, dots, underscores or hyphens.
              </span>
            </label>

            {!editingUser && (
              <label className="block text-sm font-bold text-slate-800">
                Password *
                <input
                  required
                  type="password"
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Minimum 8 characters"
                />
              </label>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-bold text-slate-800">
                Role *
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      role: event.target.value,
                    }))
                  }
                  className={inputClass}
                >
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                </select>
              </label>

              <label className="block text-sm font-bold text-slate-800">
                Job Title
                <input
                  maxLength={100}
                  value={form.jobTitle}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      jobTitle: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="e.g. Support Officer"
                />
              </label>

              <label className="block text-sm font-bold text-slate-800">
                Department
                <input
                  maxLength={100}
                  value={form.department}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      department: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="e.g. Operations"
                />
              </label>

              <label className="block text-sm font-bold text-slate-800">
                Phone
                <input
                  type="tel"
                  maxLength={30}
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Phone number"
                />
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={closeFormModal}
                disabled={saving}
                className="min-h-11 rounded-2xl border border-slate-200/80 bg-slate-50 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 active:scale-95 shadow-sm"
              >
                {saving ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Check size={17} />
                )}
                {saving
                  ? editingUser
                    ? "Saving Changes..."
                    : "Creating User..."
                  : editingUser
                    ? "Save Changes"
                    : "Create User"}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* Status Confirmation Modal */}
      {statusTarget && (
        <ModalShell onClose={() => setStatusTarget(null)}>
          <ModalHeader
            icon={ShieldCheck}
            title="Confirm account status"
            description="Review this account status change."
            onClose={() => setStatusTarget(null)}
          />
          <div className="p-6">
            <p className="text-sm leading-relaxed text-slate-600">
              Change{" "}
              <strong className="text-slate-900 font-bold">
                {statusTarget.user.username || statusTarget.user.name}
              </strong>
              's status to{" "}
              <strong className="text-violet-600 font-bold">
                {titleCase(statusTarget.status)}
              </strong>
              ?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setStatusTarget(null)}
                className="rounded-2xl border border-slate-200/80 bg-slate-50 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  updateStatus(statusTarget.user, statusTarget.status)
                }
                disabled={Boolean(updatingId)}
                className="rounded-2xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-50 active:scale-95 shadow-sm"
              >
                {updatingId ? "Updating..." : "Confirm Change"}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ModalShell onClose={() => !deletingId && setDeleteTarget(null)}>
          <ModalHeader
            icon={Trash2}
            title="Delete user?"
            description="This action cannot be undone."
            danger
            onClose={() => !deletingId && setDeleteTarget(null)}
          />
          <div className="p-6">
            <p className="text-sm leading-relaxed text-slate-600">
              Are you sure you want to delete{" "}
              <strong className="text-slate-900 font-bold">
                {deleteTarget.username || deleteTarget.name || "this user"}
              </strong>
              ? Confirm that historical attendance and task records are
              preserved by your backend before deleting accounts.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(deletingId)}
                className="rounded-2xl border border-slate-200/80 bg-slate-50 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteUser}
                disabled={Boolean(deletingId)}
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50 active:scale-95 shadow-sm"
              >
                {deletingId ? (
                  <RefreshCw size={15} className="animate-spin" />
                ) : (
                  <Trash2 size={15} />
                )}
                {deletingId ? "Deleting..." : "Delete User"}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}