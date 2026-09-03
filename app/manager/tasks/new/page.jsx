"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";

import {
  CalendarDays,
  ClipboardList,
  FileText,
  Flag,
  Loader2,
  Paperclip,
  Save,
  Trash2,
  UploadCloud,
  User,
  UserCheck,
  X,
} from "lucide-react";

import { authService } from "@/services/authService";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.localpro1.net/api";

// =====================================================
// MANAGER NEW TASK PAGE
// =====================================================

export default function ManagerNewTaskPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [teamMembers, setTeamMembers] = useState([]);
  const [currentManager, setCurrentManager] = useState(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    assignedToName: "",
    status: "Pending",
    priority: "Medium",
    dueDate: "",
  });

  // Task Attachment State
  const [selectedFile, setSelectedFile] = useState(null);

  // =====================================================
  // LOAD AUTH + TEAM MEMBERS
  // =====================================================

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError("");

        // -----------------------------------------------
        // CHECK CURRENT SESSION
        // -----------------------------------------------

        const meData = await authService.me();

        if (!mounted) {
          return;
        }

        if (!meData) {
          router.replace("/login");
          return;
        }

        const authenticatedUser =
          meData?.user ||
          meData?.data?.user ||
          meData?.data ||
          null;

        if (!authenticatedUser) {
          router.replace("/login");
          return;
        }

        // -----------------------------------------------
        // MANAGER ROLE CHECK
        // -----------------------------------------------

        const role = String(
          authenticatedUser.role || ""
        )
          .trim()
          .toLowerCase();

        if (role !== "manager") {
          setError(
            "You are not authorized to access the manager workspace."
          );

          setTimeout(() => {
            if (mounted) {
              router.replace("/login");
            }
          }, 800);

          return;
        }

        setCurrentManager(authenticatedUser);

        // -----------------------------------------------
        // LOAD ACTIVE USERS
        // -----------------------------------------------

        let usersResponse;

        try {
          usersResponse = await fetch(
            `${API_URL}/users?status=Active&limit=100`,
            {
              method: "GET",
              credentials: "include",
              headers: {
                Accept: "application/json",
              },
              cache: "no-store",
            }
          );
        } catch (usersError) {
          console.error(
            "Team members request failed:",
            usersError
          );

          if (mounted) {
            setError(
              "Unable to connect to the backend while loading team members."
            );
          }

          return;
        }

        if (!mounted) {
          return;
        }

        // -----------------------------------------------
        // 401
        // -----------------------------------------------

        if (usersResponse.status === 401) {
          const verifyMe = await authService.me();

          if (!verifyMe) {
            router.replace("/login");
            return;
          }

          setError(
            "Your session is authenticated, but team members could not be loaded."
          );

          setTeamMembers([]);

          return;
        }

        // -----------------------------------------------
        // 403
        // -----------------------------------------------

        if (usersResponse.status === 403) {
          setError(
            "Your account is authenticated, but you do not have permission to load team members."
          );

          setTeamMembers([]);

          return;
        }

        // -----------------------------------------------
        // PARSE RESPONSE
        // -----------------------------------------------

        const usersData =
          await parseResponse(usersResponse);

        if (!usersResponse.ok) {
          throw new Error(
            usersData?.message ||
              usersData?.error ||
              "Unable to load team members."
          );
        }

        const backendUsers =
          usersData?.users ||
          usersData?.data?.users ||
          usersData?.data ||
          [];

        if (!Array.isArray(backendUsers)) {
          setTeamMembers([]);
          return;
        }

        // -----------------------------------------------
        // NORMALIZE USERS
        // -----------------------------------------------

        const normalizedUsers = backendUsers
          .filter((user) => {
            if (!user) {
              return false;
            }

            const userId =
              user.id || user._id;

            if (!userId) {
              return false;
            }

            const userStatus = String(
              user.status || "Active"
            )
              .trim()
              .toLowerCase();

            if (
              userStatus === "blocked" ||
              userStatus === "inactive"
            ) {
              return false;
            }

            return true;
          })
          .map((user) => ({
            id:
              user.id ||
              user._id,

            name:
              user.name ||
              user.fullName ||
              user.email ||
              "Unnamed User",

            email:
              user.email || "",

            role:
              user.role || "",

            status:
              user.status || "Active",
          }));

        setTeamMembers(normalizedUsers);
      } catch (err) {
        console.error(
          "Manager new task load error:",
          err
        );

        if (!mounted) {
          return;
        }

        setError(
          err?.message ||
            "Unable to load task form."
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [router]);

  // =====================================================
  // FORM CHANGE
  // =====================================================

  function handleChange(event) {
    const {
      name,
      value,
    } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  }

  // =====================================================
  // FILE CHANGE & REMOVE
  // =====================================================

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
    setError("");
  }

  function handleRemoveFile() {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // =====================================================
  // ASSIGN TEAM MEMBER
  // =====================================================

  function handleAssignTo(event) {
    const selectedId =
      event.target.value;

    const selectedMember =
      teamMembers.find(
        (member) =>
          String(member.id) ===
          String(selectedId)
      );

    setForm((previous) => ({
      ...previous,

      assignedTo:
        selectedMember?.id || "",

      assignedToName:
        selectedMember?.name || "",
    }));

    setError("");
    setSuccess("");
  }

  // =====================================================
  // ASSIGN TO CURRENT MANAGER
  // =====================================================

  function handleAssignToMe() {
    if (!currentManager) {
      setError(
        "Authenticated manager information is not available."
      );

      return;
    }

    const managerId =
      currentManager.id ||
      currentManager._id;

    if (!managerId) {
      setError(
        "Authenticated manager ID is not available."
      );

      return;
    }

    const managerName =
      currentManager.name ||
      currentManager.fullName ||
      currentManager.email ||
      "Manager";

    setForm((previous) => ({
      ...previous,

      assignedTo: managerId,

      assignedToName:
        managerName,
    }));

    setError("");
    setSuccess("");
  }

  // =====================================================
  // CREATE TASK
  // =====================================================

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError("");
    setSuccess("");

    const title =
      form.title.trim();

    const description =
      form.description.trim();

    // -----------------------------------------------
    // VALIDATION
    // -----------------------------------------------

    if (!title) {
      setError(
        "Please enter a task title."
      );

      return;
    }

    if (title.length < 3) {
      setError(
        "Task title must be at least 3 characters long."
      );

      return;
    }

    if (title.length > 200) {
      setError(
        "Task title cannot exceed 200 characters."
      );

      return;
    }

    if (!form.assignedTo) {
      setError(
        "Please select a team member."
      );

      return;
    }

    if (!form.dueDate) {
      setError(
        "Please select a due date."
      );

      return;
    }

    try {
      setSubmitting(true);

      // -----------------------------------------------
      // FORMDATA PAYLOAD (FOR MULTIPART/FILE UPLOAD)
      // -----------------------------------------------

      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("assignedTo", form.assignedTo);
      formData.append("priority", form.priority);
      formData.append("dueDate", form.dueDate);

      if (selectedFile) {
        formData.append("file", selectedFile);
      }

      const response =
        await fetch(
          `${API_URL}/tasks`,
          {
            method: "POST",
            credentials: "include",
            // Note: Don't set Content-Type header manually; browser sets boundary
            headers: {
              Accept: "application/json",
            },
            body: formData,
          }
        );

      const data =
        await parseResponse(
          response
        );

      // -----------------------------------------------
      // 401
      // -----------------------------------------------

      if (response.status === 401) {
        const verifyMe =
          await authService.me();

        if (!verifyMe) {
          router.replace("/login");
          return;
        }

        throw new Error(
          "Your session is active, but the task request was not authenticated correctly."
        );
      }

      // -----------------------------------------------
      // 403
      // -----------------------------------------------

      if (response.status === 403) {
        throw new Error(
          data?.message ||
            data?.error ||
            "You do not have permission to create tasks."
        );
      }

      // -----------------------------------------------
      // OTHER ERROR
      // -----------------------------------------------

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Unable to create task."
        );
      }

      // -----------------------------------------------
      // SUCCESS
      // -----------------------------------------------

      setSuccess(
        data?.message ||
          "Task created successfully."
      );

      setForm({
        title: "",
        description: "",
        assignedTo: "",
        assignedToName: "",
        status: "Pending",
        priority: "Medium",
        dueDate: "",
      });

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setTimeout(() => {
        router.push(
          "/manager/tasks"
        );
      }, 700);
    } catch (err) {
      console.error(
        "Create task error:",
        err
      );

      setError(
        err?.message ||
          "Unable to create task."
      );
    } finally {
      setSubmitting(false);
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

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <Loader2
            size={32}
            className="animate-spin text-[#2563EB]"
          />

          <p className="text-sm font-semibold text-[#64748B]">
            Loading task form...
          </p>
        </div>
      </div>
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC]">
      <main className="min-h-screen w-full p-5 sm:p-6 lg:p-8">
        <div className="w-full space-y-6">

          {/* =================================================
              PAGE TITLE
              ================================================= */}

          <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#2563EB]">
                MANAGEMENT
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
                Add New Task
              </h1>

              <p className="mt-2 text-sm text-[#64748B]">
                Create a task and assign it
                to a member of your team.
              </p>
            </div>

            <Link
              href="/manager/tasks"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D]"
            >
              <span>
                ←
              </span>

              Back to Tasks
            </Link>
          </section>

          {/* =================================================
              ERROR
              ================================================= */}

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
            >
              {error}
            </div>
          )}

          {/* =================================================
              SUCCESS
              ================================================= */}

          {success && (
            <div
              role="status"
              className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700"
            >
              {success}
            </div>
          )}

          {/* =================================================
              NO TEAM MEMBERS
              ================================================= */}

          {teamMembers.length ===
            0 &&
            !error && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                No active team members are
                currently available for
                assignment.
              </div>
            )}

          {/* =================================================
              FORM
              ================================================= */}

          <form
            onSubmit={
              handleSubmit
            }
            className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            {/* =================================================
                FORM HEADER
                ================================================= */}

            <div className="border-b border-slate-100 px-5 py-5 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                  <ClipboardList
                    size={19}
                  />
                </div>

                <div>
                  <h2 className="text-base font-bold text-[#171B3A]">
                    Task Information
                  </h2>

                  <p className="mt-1 text-sm text-[#64748B]">
                    Enter the details for
                    the new task.
                  </p>
                </div>
              </div>
            </div>

            {/* =================================================
                FORM BODY
                ================================================= */}

            <div className="w-full space-y-6 p-5 sm:p-6 lg:px-8">

              {/* =================================================
                  TITLE
                  ================================================= */}

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
                  minLength={3}
                  maxLength={200}
                  value={
                    form.title
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="e.g. Complete client onboarding"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              {/* =================================================
                  DESCRIPTION
                  ================================================= */}

              <div>
                <label
                  htmlFor="description"
                  className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]"
                >
                  <FileText
                    size={16}
                  />

                  Description
                </label>

                <textarea
                  id="description"
                  name="description"
                  value={
                    form.description
                  }
                  onChange={
                    handleChange
                  }
                  maxLength={500}
                  rows={5}
                  placeholder="Add task details or instructions..."
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                />

                <p className="mt-1 text-right text-xs text-slate-400">
                  {
                    form.description
                      .length
                  }
                  /500
                </p>
              </div>

              {/* =================================================
                  FILE ATTACHMENT (NEW)
                  ================================================= */}

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]">
                  <Paperclip size={16} />
                  Task Attachment (Optional)
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  id="taskFile"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {!selectedFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-6 transition hover:border-[#2563EB] hover:bg-blue-50/20"
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
                      onClick={handleRemoveFile}
                      className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-red-600"
                    >
                      <X size={17} />
                    </button>
                  </div>
                )}
              </div>

              {/* =================================================
                  ASSIGNED TO
                  ================================================= */}

              <div>
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label
                    htmlFor="assignedTo"
                    className="flex items-center gap-2 text-sm font-semibold text-[#26344D]"
                  >
                    <User
                      size={16}
                    />

                    Assigned To
                  </label>

                  <button
                    type="button"
                    onClick={
                      handleAssignToMe
                    }
                    disabled={
                      !currentManager
                    }
                    className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold transition ${
                      currentManager
                        ? "bg-[#EEF4FF] text-[#2563EB] hover:bg-blue-100"
                        : "cursor-not-allowed bg-slate-100 text-slate-400"
                    }`}
                  >
                    <UserCheck
                      size={15}
                    />

                    Assign to me
                  </button>
                </div>

                <select
                  id="assignedTo"
                  name="assignedTo"
                  value={
                    form.assignedTo
                  }
                  onChange={
                    handleAssignTo
                  }
                  disabled={
                    teamMembers.length ===
                    0
                  }
                  required
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="">
                    {teamMembers.length ===
                    0
                      ? "No active team members available"
                      : "Select a team member"}
                  </option>

                  {teamMembers.map(
                    (member) => (
                      <option
                        key={
                          member.id
                        }
                        value={
                          member.id
                        }
                      >
                        {member.name}

                        {member.email
                          ? ` — ${member.email}`
                          : ""}
                      </option>
                    )
                  )}
                </select>

                {form.assignedToName && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-[#EEF4FF] px-3 py-2 text-xs font-semibold text-[#2563EB]">
                    <UserCheck
                      size={14}
                    />

                    <span>
                      Assigned to:{" "}
                      {
                        form.assignedToName
                      }
                    </span>
                  </div>
                )}

                <p className="mt-2 text-xs text-[#64748B]">
                  Team members are loaded
                  directly from the backend.
                </p>
              </div>

              {/* =================================================
                  STATUS + PRIORITY
                  ================================================= */}

              <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2">

                {/* STATUS */}

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
                    value={
                      form.status
                    }
                    onChange={
                      handleChange
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
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

                    <option value="Cancelled">
                      Cancelled
                    </option>
                  </select>

                  <p className="mt-2 text-xs text-[#64748B]">
                    New tasks are created as
                    Pending by the backend.
                  </p>
                </div>

                {/* PRIORITY */}

                <div>
                  <label
                    htmlFor="priority"
                    className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]"
                  >
                    <Flag
                      size={16}
                    />

                    Priority
                  </label>

                  <select
                    id="priority"
                    name="priority"
                    value={
                      form.priority
                    }
                    onChange={
                      handleChange
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
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

              {/* =================================================
                  DUE DATE
                  ================================================= */}

              <div>
                <label
                  htmlFor="dueDate"
                  className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#26344D]"
                >
                  <CalendarDays
                    size={16}
                  />

                  Due Date
                </label>

                <input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                  required
                  min={getToday()}
                  value={
                    form.dueDate
                  }
                  onChange={
                    handleChange
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#26344D] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              {/* =================================================
                  SUMMARY
                  ================================================= */}

              <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-4">

                  <PreviewItem
                    label="Status"
                    value={
                      form.status
                    }
                  />

                  <PreviewItem
                    label="Priority"
                    value={
                      form.priority
                    }
                  />

                  <PreviewItem
                    label="Assigned To"
                    value={
                      form.assignedToName ||
                      "Not assigned"
                    }
                  />

                  <PreviewItem
                    label="Attachment"
                    value={
                      selectedFile ? selectedFile.name : "None"
                    }
                  />

                </div>
              </div>

              {/* =================================================
                  ACTIONS
                  ================================================= */}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-end">

                <Link
                  href="/manager/tasks"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-semibold text-[#64748B] transition hover:bg-slate-50 hover:text-[#26344D]"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    teamMembers.length ===
                      0
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />

                      Creating Task...
                    </>
                  ) : (
                    <>
                      <Save
                        size={17}
                      />

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
  );
}

// =====================================================
// PREVIEW ITEM
// =====================================================

function PreviewItem({
  label,
  value,
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 truncate text-sm font-semibold text-[#26344D]">
        {value}
      </p>
    </div>
  );
}

// =====================================================
// RESPONSE PARSER
// =====================================================

async function parseResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// =====================================================
// GET TODAY
// =====================================================

function getToday() {
  const date = new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}