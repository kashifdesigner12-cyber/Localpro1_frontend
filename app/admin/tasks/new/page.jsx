"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Check,
  ClipboardList,
  FileText,
  Flag,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Paperclip,
  Save,
  Settings,
  ShieldCheck,
  UploadCloud,
  User,
  Users,
  X,
} from "lucide-react";
import { authService } from "@/services/authService";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.localpro1.net/api";

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

export default function AdminNewTaskPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    status: "Pending",
    priority: "Medium",
    dueDate: "",
  });

  // Task Attachment State
  const [selectedFile, setSelectedFile] = useState(null);

  /*
   * ============================================================
   * AUTH HEADERS
   * ============================================================
   */

  function getAuthHeaders(includeJson = false) {
    const headers = {
      Accept: "application/json",
    };

    if (includeJson) {
      headers["Content-Type"] = "application/json";
    }

    let token = null;

    try {
      token = authService.getToken();
    } catch (error) {
      console.error(
        "Unable to read authentication token:",
        error
      );
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  /*
   * ============================================================
   * LOAD USERS
   * ============================================================
   */

  useEffect(() => {
    let mounted = true;

    async function loadUsers() {
      try {
        setLoadingUsers(true);
        setError("");

        const response = await fetch(
          `${API_URL}/users`,
          {
            method: "GET",
            credentials: "include",
            headers: getAuthHeaders(false),
            cache: "no-store",
          }
        );

        let result = null;

        try {
          result = await response.json();
        } catch {
          result = null;
        }

        if (response.status === 401) {
          try {
            authService.clearToken();
          } catch (error) {
            console.error(
              "Clear token error:",
              error
            );
          }

          if (mounted) {
            setError(
              "Your login session has expired. Please login again."
            );
          }

          router.replace("/login");
          return;
        }

        if (response.status === 403) {
          throw new Error(
            result?.message ||
              "You do not have permission to view workspace users."
          );
        }

        if (
          !response.ok ||
          result?.success === false
        ) {
          throw new Error(
            result?.message ||
              result?.error ||
              `Failed to load users. Status: ${response.status}`
          );
        }

        const fetchedUsers = Array.isArray(result)
          ? result
          : Array.isArray(result?.users)
          ? result.users
          : Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result?.data?.users)
          ? result.data.users
          : [];

        if (mounted) {
          setUsers(fetchedUsers);
        }
      } catch (requestError) {
        console.error(
          "Load users error:",
          requestError
        );

        if (mounted) {
          setUsers([]);

          setError(
            requestError?.message ||
              "Unable to load users. Please try again."
          );
        }
      } finally {
        if (mounted) {
          setLoadingUsers(false);
        }
      }
    }

    loadUsers();

    return () => {
      mounted = false;
    };
  }, [router]);

  /*
   * ============================================================
   * FORM CHANGE
   * ============================================================
   */

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setSaved(false);
    setError("");
  }

  /*
   * ============================================================
   * FILE CHANGE & REMOVE
   * ============================================================
   */

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    // 10MB limit check
    if (file.size > 10 * 1024 * 1024) {
      setError("File size cannot exceed 10MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    setSaved(false);
    setError("");
  }

  function handleRemoveFile() {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // Format file size
  function formatBytes(bytes) {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /*
   * ============================================================
   * CREATE TASK
   * ============================================================
   */

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaved(false);
    setError("");

    const trimmedTitle = form.title.trim();
    const trimmedDescription =
      form.description.trim();

    if (!trimmedTitle) {
      setError("Task title is required.");
      return;
    }

    if (!form.assignedTo) {
      setError(
        "Please select a user to assign the task to."
      );
      return;
    }

    if (!form.dueDate) {
      setError("Due date is required.");
      return;
    }

    // --------------------------------------------------------
    // FORMDATA PAYLOAD (MULTIPART/FORM-DATA FOR FILE UPLOAD)
    // --------------------------------------------------------

    const formData = new FormData();
    formData.append("title", trimmedTitle);
    formData.append("description", trimmedDescription);
    formData.append("assignedTo", form.assignedTo);
    formData.append("status", form.status);
    formData.append("priority", form.priority);
    formData.append("dueDate", form.dueDate);

    if (selectedFile) {
      formData.append("file", selectedFile);
    }

    try {
      setSaving(true);

      const response = await fetch(
        `${API_URL}/tasks`,
        {
          method: "POST",
          credentials: "include",
          // Content-Type manual nahi set karna, browser boundary khud lagata hai
          headers: getAuthHeaders(false),
          body: formData,
          cache: "no-store",
        }
      );

      let result = null;

      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (response.status === 401) {
        try {
          authService.clearToken();
        } catch (error) {
          console.error(
            "Clear token error:",
            error
          );
        }

        setError(
          "Your login session has expired. Please login again."
        );

        router.replace("/login");
        return;
      }

      if (response.status === 403) {
        throw new Error(
          result?.message ||
            "You do not have permission to create tasks."
        );
      }

      if (
        !response.ok ||
        result?.success === false
      ) {
        throw new Error(
          result?.message ||
            result?.error ||
            `Failed to create task. Status: ${response.status}`
        );
      }

      setSaved(true);

      setForm({
        title: "",
        description: "",
        assignedTo: "",
        status: "Pending",
        priority: "Medium",
        dueDate: "",
      });

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setTimeout(() => {
        router.push("/admin/tasks");
        router.refresh();
      }, 800);
    } catch (requestError) {
      console.error(
        "Create task error:",
        requestError
      );

      setError(
        requestError?.message ||
          "Unable to create task. Please try again."
      );
    } finally {
      setSaving(false);
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

      try {
        authService.clearToken();
      } catch (error) {
        console.error(
          "Clear token error:",
          error
        );
      }
    } finally {
      setSidebarOpen(false);

      router.replace("/login");
      router.refresh();
    }
  }

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC]">

      {/* ======================================================
          MOBILE OVERLAY
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
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#171B3A] shadow-xl transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header */}

        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-sm">
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition hover:bg-white/10 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        {/* Sidebar Navigation */}

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

        {/* ====================================================
            PROFILE
        ==================================================== */}

        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-xl px-3 py-3">
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
          FULL WIDTH MAIN AREA
      ====================================================== */}

      <div className="min-h-screen w-full">

        {/* ====================================================
            PAGE CONTENT
        ==================================================== */}

        <main className="min-h-screen w-full p-5 sm:p-6 lg:p-8">

          <div className="w-full max-w-none space-y-6">

            {/* ==================================================
                MOBILE / PAGE TOP CONTROLS
            ================================================== */}

            <div className="flex items-center gap-3">

              {/* Mobile Menu */}

              <button
                type="button"
                onClick={() =>
                  setSidebarOpen(true)
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#26344D] transition hover:bg-slate-50 lg:hidden"
                aria-label="Open sidebar"
              >
                <Menu size={20} />
              </button>

              {/* Back */}

              <Link
                href="/admin/tasks"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#26344D] transition hover:bg-slate-50"
                aria-label="Back to tasks"
              >
                <ArrowLeft size={19} />
              </Link>

              <div>
                <p className="text-xs font-medium text-[#64748B]">
                  Administration
                </p>

                <p className="text-sm font-bold text-[#171B3A]">
                  Add Task
                </p>
              </div>
            </div>

            {/* ==================================================
                PAGE HEADER
            ================================================== */}

            <section className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

              <div>
                <p className="text-sm font-semibold text-[#2563EB]">
                  ADMINISTRATION
                </p>

                <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
                  Add New Task
                </h1>

                <p className="mt-2 text-sm text-[#64748B]">
                  Create a new task and assign it
                  to a workspace user.
                </p>
              </div>

              <Link
                href="/admin/tasks"
                className="inline-flex h-11 w-fit items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D]"
              >
                Cancel
              </Link>
            </section>

            {/* ==================================================
                SUCCESS
            ================================================== */}

            {saved && (
              <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
                  <Check size={13} />
                </div>

                <div>
                  <p>
                    Task created successfully.
                  </p>

                  <p className="mt-0.5 text-xs font-medium text-green-600">
                    The task has been saved to the
                    backend.
                  </p>
                </div>
              </div>
            )}

            {/* ==================================================
                ERROR
            ================================================== */}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-semibold text-red-700">
                  Unable to create task
                </p>

                <p className="mt-1 text-xs font-medium text-red-600">
                  {error}
                </p>
              </div>
            )}

            {/* ==================================================
                FORM
            ================================================== */}

            <form
              onSubmit={handleSubmit}
              className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm"
            >

              {/* Form Header */}

              <div className="border-b border-slate-100 px-5 py-5 sm:px-6 lg:px-8">
                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                    <ClipboardList size={19} />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-[#171B3A]">
                      Task Information
                    </h2>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Enter the details for the new
                      task.
                    </p>
                  </div>

                </div>
              </div>

              <div className="space-y-6 p-5 sm:p-6 lg:p-8">

                {/* Task Title */}

                <div>
                  <label
                    htmlFor="title"
                    className="mb-2 block text-sm font-semibold text-[#26344D]"
                  >
                    Task Title
                  </label>

                  <input
                    id="title"
                    name="title"
                    type="text"
                    required
                    disabled={saving}
                    value={form.title}
                    onChange={handleChange}
                    placeholder="e.g. Complete client onboarding"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />
                </div>

                {/* Description */}

                <div>
                  <label
                    htmlFor="description"
                    className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]"
                  >
                    <FileText size={16} />
                    Description
                  </label>

                  <textarea
                    id="description"
                    name="description"
                    disabled={saving}
                    value={form.description}
                    onChange={handleChange}
                    maxLength={500}
                    rows={5}
                    placeholder="Add task details or instructions..."
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />

                  <p className="mt-1 text-right text-xs text-slate-400">
                    {form.description.length}/500
                  </p>
                </div>

                {/* ==================================================
                    ATTACHMENT (NEW)
                ================================================== */}

                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]">
                    <Paperclip size={16} />
                    Task Attachment (Optional)
                  </label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    id="adminTaskFile"
                    className="hidden"
                    disabled={saving}
                    onChange={handleFileChange}
                  />

                  {!selectedFile ? (
                    <div
                      onClick={() => !saving && fileInputRef.current?.click()}
                      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-6 transition hover:border-[#2563EB] hover:bg-blue-50/20 ${
                        saving ? "cursor-not-allowed opacity-60" : ""
                      }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm text-[#2563EB]">
                        <UploadCloud size={20} />
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[#26344D]">
                        Click to upload file
                      </p>
                      <p className="text-xs text-[#64748B]">
                        PDF, Images, Documents up to 10MB
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-[#EEF4FF] p-3.5">
                      <div className="flex items-center gap-3 truncate">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2563EB] text-white">
                          <Paperclip size={17} />
                        </div>
                        <div className="truncate">
                          <p className="truncate text-sm font-semibold text-[#171B3A]">
                            {selectedFile.name}
                          </p>
                          <p className="text-xs text-[#64748B]">
                            {formatBytes(selectedFile.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleRemoveFile}
                        className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-red-600 disabled:opacity-50"
                      >
                        <X size={17} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Assigned To */}

                <div>
                  <label
                    htmlFor="assignedTo"
                    className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]"
                  >
                    <User size={16} />
                    Assigned To
                  </label>

                  <select
                    id="assignedTo"
                    name="assignedTo"
                    required
                    disabled={
                      saving || loadingUsers
                    }
                    value={form.assignedTo}
                    onChange={handleChange}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                  >
                    <option value="">
                      {loadingUsers
                        ? "Loading users..."
                        : users.length > 0
                        ? "Select a user"
                        : "No users available"}
                    </option>

                    {users.map((user) => {
                      const userId =
                        user?._id ||
                        user?.id;

                      if (!userId) {
                        return null;
                      }

                      const userName =
                        user?.name ||
                        user?.fullName ||
                        user?.username ||
                        user?.email ||
                        "Unnamed User";

                      return (
                        <option
                          key={userId}
                          value={userId}
                        >
                          {userName}

                          {user?.email
                            ? ` — ${user.email}`
                            : ""}
                        </option>
                      );
                    })}
                  </select>

                  {!loadingUsers &&
                    users.length === 0 &&
                    !error && (
                      <p className="mt-2 text-xs font-medium text-amber-600">
                        No users were returned by
                        the backend.
                      </p>
                    )}
                </div>

                {/* Status + Priority */}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

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
                      disabled={saving}
                      value={form.status}
                      onChange={handleChange}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                    >
                      <option value="Pending">
                        Pending
                      </option>

                      <option value="In Progress">
                        In Progress
                      </option>

                      <option value="Completed">
                        Completed
                      </option>
                    </select>
                  </div>

                  {/* Priority */}

                  <div>
                    <label
                      htmlFor="priority"
                      className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]"
                    >
                      <Flag size={16} />
                      Priority
                    </label>

                    <select
                      id="priority"
                      name="priority"
                      disabled={saving}
                      value={form.priority}
                      onChange={handleChange}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                    >
                      <option value="Low">
                        Low
                      </option>

                      <option value="Medium">
                        Medium
                      </option>

                      <option value="High">
                        High
                      </option>

                      <option value="Urgent">
                        Urgent
                      </option>
                    </select>
                  </div>
                </div>

                {/* Due Date */}

                <div>
                  <label
                    htmlFor="dueDate"
                    className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]"
                  >
                    <CalendarDays size={16} />
                    Due Date
                  </label>

                  <input
                    id="dueDate"
                    name="dueDate"
                    type="date"
                    required
                    disabled={saving}
                    value={form.dueDate}
                    onChange={handleChange}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />
                </div>

                {/* ==================================================
                    TASK PREVIEW
                ================================================== */}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">

                  <div className="mb-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#2563EB]">
                      Task Preview
                    </p>

                    <p className="mt-1 text-xs text-[#64748B]">
                      Current task configuration
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">

                    <PreviewItem
                      label="Status"
                      value={form.status}
                    />

                    <PreviewItem
                      label="Priority"
                      value={form.priority}
                    />

                    <PreviewItem
                      label="Assigned To"
                      value={
                        getSelectedUserName(
                          users,
                          form.assignedTo
                        ) || "Not assigned"
                      }
                    />

                    <PreviewItem
                      label="Attachment"
                      value={
                        selectedFile ? selectedFile.name : "None"
                      }
                    />

                  </div>

                  {form.title && (
                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Task Title
                      </p>

                      <p className="mt-1 text-sm font-bold text-[#171B3A]">
                        {form.title}
                      </p>
                    </div>
                  )}

                  {form.dueDate && (
                    <div className="mt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Due Date
                      </p>

                      <p className="mt-1 text-sm font-semibold text-[#26344D]">
                        {form.dueDate}
                      </p>
                    </div>
                  )}

                </div>

                {/* ==================================================
                    ACTIONS
                ================================================== */}

                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-end">

                  <Link
                    href="/admin/tasks"
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-semibold text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D]"
                  >
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    disabled={
                      saving ||
                      loadingUsers ||
                      users.length === 0
                    }
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#1D4ED8] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {saving ? (
                      <>
                        <Loader2
                          size={17}
                          className="animate-spin"
                        />
                        Creating Task...
                      </>
                    ) : (
                      <>
                        <Save size={17} />
                        Save Task
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

/* ============================================================
   ADMIN SIDEBAR NAVIGATION
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
   SELECTED USER NAME
============================================================ */

function getSelectedUserName(
  users,
  selectedId
) {
  if (!selectedId) {
    return "";
  }

  const selectedUser = users.find(
    (user) =>
      String(user?._id || user?.id) ===
      String(selectedId)
  );

  if (!selectedUser) {
    return "";
  }

  return (
    selectedUser?.name ||
    selectedUser?.fullName ||
    selectedUser?.username ||
    selectedUser?.email ||
    ""
  );
}

/* ============================================================
   PREVIEW ITEM
============================================================ */

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