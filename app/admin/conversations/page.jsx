"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  File,
  Image as ImageIcon,
  LayoutDashboard,
  Activity,
  MessageSquare,
  Paperclip,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Users,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

const navigation = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Tasks", href: "/admin/tasks", icon: ClipboardList },
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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const BACKEND_BASE_URL =
  API_BASE_URL.replace(/\/api\/?$/, "");

const getApiUrl = (path) => `${API_BASE_URL}${path}`;

const getFileUrl = (url) => {
  if (!url) return "#";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${BACKEND_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const getId = (item) =>
  item?.id ||
  item?._id ||
  item?.userId?._id ||
  item?.userId?.id ||
  null;

const getUserName = (user) =>
  user?.name ||
  user?.fullName ||
  user?.username ||
  user?.email ||
  "Unknown User";

const getRole = (user) => {
  if (!user?.role) return "";

  return (
    String(user.role).charAt(0).toUpperCase() +
    String(user.role).slice(1)
  );
};

const getInitials = (name) => {
  if (!name) return "U";

  return String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

const formatMessageTime = (dateValue) => {
  if (!dateValue) return "";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatConversationTime = (dateValue) => {
  if (!dateValue) return "";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
};

const normalizeUsers = (data) => {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.users)) return data.users;

  if (Array.isArray(data?.data)) return data.data;

  if (Array.isArray(data?.users?.data)) {
    return data.users.data;
  }

  return [];
};

const normalizeConversations = (data) => {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.conversations)) {
    return data.conversations;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
};

export default function AdminConversationsPage() {
  const [search, setSearch] = useState("");

  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedConversationId, setSelectedConversationId] =
    useState(null);
  const [selectedConversation, setSelectedConversation] =
    useState(null);

  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingConversations, setLoadingConversations] =
    useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [startingConversation, setStartingConversation] =
    useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [error, setError] = useState("");
  const [messagesError, setMessagesError] = useState("");

  const [refreshing, setRefreshing] = useState(false);

  const fileInputRef = useRef(null);

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      setError("");

      const response = await fetch(getApiUrl("/users"), {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to load users.");
      }

      const userData = normalizeUsers(data);

      const availableUsers = userData.filter((user) => {
        if (!user) return false;

        const role = String(user?.role || "").toLowerCase();

        return role === "user" || role === "manager";
      });

      setUsers(availableUsers);
    } catch (fetchError) {
      console.error("Admin users fetch error:", fetchError);

      setError(fetchError.message || "Unable to load users.");
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchConversations = async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoadingConversations(true);
      }

      const response = await fetch(getApiUrl("/conversations"), {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message || "Failed to load conversations."
        );
      }

      const conversationData = normalizeConversations(data);

      setConversations(conversationData);

      return conversationData;
    } catch (fetchError) {
      console.error(
        "Admin conversations fetch error:",
        fetchError
      );

      setError(
        fetchError.message || "Unable to load conversations."
      );

      return [];
    } finally {
      setLoadingConversations(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchConversations();
  }, []);

  const findConversationForUser = (
    userId,
    conversationList = conversations
  ) => {
    if (!userId) return null;

    return (
      conversationList.find((conversation) => {
        const participants = Array.isArray(
          conversation?.participants
        )
          ? conversation.participants
          : [];

        return participants.some((participant) => {
          const participantId = getId(participant);

          return (
            participantId &&
            String(participantId) === String(userId)
          );
        });
      }) || null
    );
  };

  const fetchMessages = async (conversationId) => {
    if (!conversationId) return;

    try {
      setLoadingMessages(true);
      setMessagesError("");

      const response = await fetch(
        getApiUrl(
          `/conversations/${conversationId}/messages?limit=100`
        ),
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message || "Failed to load messages."
        );
      }

      const messageData = Array.isArray(data?.messages)
        ? data.messages
        : Array.isArray(data?.data)
        ? data.data
        : [];

      setMessages(messageData);
    } catch (fetchError) {
      console.error(
        "Conversation messages fetch error:",
        fetchError
      );

      setMessagesError(
        fetchError.message || "Unable to load messages."
      );

      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const openConversation = async (
    conversation,
    user = null
  ) => {
    const conversationId =
      conversation?.id || conversation?._id;

    if (!conversationId) return;

    setSelectedUser(user);
    setSelectedConversationId(conversationId);
    setSelectedConversation(conversation);
    setMessages([]);
    setMessagesError("");
    setSelectedFiles([]);

    await fetchMessages(conversationId);

    try {
      const response = await fetch(
        getApiUrl(`/conversations/${conversationId}/read`),
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);

        console.error(
          "Mark conversation read failed:",
          data?.message
        );

        return;
      }

      setConversations((current) =>
        current.map((item) => {
          const id = item?.id || item?._id;

          if (String(id) === String(conversationId)) {
            return {
              ...item,
              unreadCount: 0,
            };
          }

          return item;
        })
      );
    } catch (readError) {
      console.error(
        "Mark conversation read error:",
        readError
      );
    }
  };

  const createNewConversation = async (user) => {
    const userId = getId(user);

    if (!userId || startingConversation) {
      return;
    }

    try {
      setStartingConversation(true);
      setMessagesError("");
      setError("");

      const latestConversations =
        await fetchConversations({
          silent: true,
        });

      const existingConversation =
        findConversationForUser(
          userId,
          latestConversations
        );

      if (existingConversation) {
        await openConversation(
          existingConversation,
          user
        );

        return;
      }

      const response = await fetch(
        getApiUrl("/conversations"),
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipientId: userId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message || "Failed to create conversation."
        );
      }

      const newConversation =
        data?.conversation ||
        data?.data ||
        data;

      const newConversationId =
        newConversation?.id ||
        newConversation?._id;

      if (!newConversationId) {
        const refreshedConversations =
          await fetchConversations({
            silent: true,
          });

        const refreshedConversation =
          findConversationForUser(
            userId,
            refreshedConversations
          );

        if (refreshedConversation) {
          await openConversation(
            refreshedConversation,
            user
          );

          return;
        }

        throw new Error(
          "Conversation was created but no conversation ID was returned."
        );
      }

      setConversations((current) => {
        const alreadyExists = current.some(
          (item) =>
            String(
              item?.id || item?._id
            ) === String(newConversationId)
        );

        if (alreadyExists) {
          return current;
        }

        return [newConversation, ...current];
      });

      await openConversation(
        newConversation,
        user
      );
    } catch (createError) {
      console.error(
        "Create conversation error:",
        createError
      );

      setMessagesError(
        createError.message ||
          "Unable to start conversation."
      );
    } finally {
      setStartingConversation(false);
    }
  };

  const handleSelectUser = async (user) => {
    const userId = getId(user);

    if (!userId) {
      setMessagesError(
        "Selected user does not have a valid user ID."
      );

      return;
    }

    setSelectedUser(user);
    setMessagesError("");

    const existingConversation =
      findConversationForUser(userId);

    if (existingConversation) {
      await openConversation(
        existingConversation,
        user
      );

      return;
    }

    await createNewConversation(user);
  };

  const filteredUsers = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    if (!searchText) {
      return users;
    }

    return users.filter((user) => {
      const text = `
        ${user?.name || ""}
        ${user?.fullName || ""}
        ${user?.email || ""}
        ${user?.phone || ""}
        ${user?.role || ""}
        ${user?.status || ""}
      `.toLowerCase();

      return text.includes(searchText);
    });
  }, [users, search]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setSelectedFiles((prev) => [...prev, ...files].slice(0, 5));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();

    const cleanMessage = message.trim();

    if (
      (!cleanMessage && selectedFiles.length === 0) ||
      !selectedConversationId ||
      !selectedUser ||
      sendingMessage
    ) {
      return;
    }

    const recipientId = getId(selectedUser);

    if (!recipientId) {
      setMessagesError("No valid recipient was found.");
      return;
    }

    try {
      setSendingMessage(true);
      setMessagesError("");

      let response;

      if (selectedFiles.length > 0) {
        const formData = new FormData();
        formData.append("body", cleanMessage);
        formData.append("recipientId", recipientId);
        formData.append("conversationId", selectedConversationId);

        selectedFiles.forEach((file) => {
          formData.append("files", file);
        });

        response = await fetch(getApiUrl("/messages"), {
          method: "POST",
          credentials: "include",
          body: formData,
        });
      } else {
        response = await fetch(
          getApiUrl(
            `/conversations/${selectedConversationId}/messages`
          ),
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              body: cleanMessage,
              recipientId,
            }),
          }
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message || "Failed to send message."
        );
      }

      const newMessage =
        data?.data ||
        data?.messageData ||
        data?.message;

      if (
        newMessage &&
        typeof newMessage === "object"
      ) {
        setMessages((current) => [
          ...current,
          newMessage,
        ]);
      } else {
        await fetchMessages(
          selectedConversationId
        );
      }

      setMessage("");
      setSelectedFiles([]);

      await fetchConversations({
        silent: true,
      });
    } catch (sendError) {
      console.error(
        "Send admin message error:",
        sendError
      );

      setMessagesError(
        sendError.message ||
          "Unable to send message."
      );
    } finally {
      setSendingMessage(false);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([
      fetchUsers(),
      fetchConversations({
        silent: true,
      }),
    ]);

    if (selectedConversationId) {
      await fetchMessages(
        selectedConversationId
      );
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversationId) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this conversation and all of its messages?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        getApiUrl(
          `/conversations/${selectedConversationId}`
        ),
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Failed to delete conversation."
        );
      }

      setConversations((current) =>
        current.filter((conversation) => {
          const id =
            conversation?.id ||
            conversation?._id;

          return (
            String(id) !==
            String(selectedConversationId)
          );
        })
      );

      setSelectedConversationId(null);
      setSelectedConversation(null);
      setSelectedUser(null);
      setMessages([]);
      setMessage("");
      setSelectedFiles([]);
      setMessagesError("");
    } catch (deleteError) {
      console.error(
        "Delete conversation error:",
        deleteError
      );

      setMessagesError(
        deleteError.message ||
          "Unable to delete conversation."
      );
    }
  };

  return (
    <main className="w-full min-w-0">
      <div className="w-full space-y-6 p-5 sm:p-6 lg:p-8">
        {/* PAGE HEADER */}
        <section className="w-full">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#2563EB]">
                ADMINISTRATION
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B3A] sm:text-3xl">
                Conversations
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748B]">
                Select any user or manager to view an
                existing conversation or start a new
                conversation.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#26344D] shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw
                  size={16}
                  className={
                    refreshing
                      ? "animate-spin"
                      : ""
                  }
                />

                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </button>

              <Link
                href="/admin"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#26344D] shadow-sm transition hover:bg-slate-50"
              >
                <ArrowLeft size={17} />
                Dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* GLOBAL ERROR */}
        {error && (
          <section className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </section>
        )}

        {/* CONVERSATION WORKSPACE */}
        <section className="grid min-h-[680px] w-full grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[370px_minmax(0,1fr)]">
          {/* USERS */}
          <aside className="min-w-0 border-b border-slate-200 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-100 p-4 sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[#171B3A]">
                    All Users
                  </h2>

                  <p className="mt-1 text-xs text-[#64748B]">
                    {users.length} user
                    {users.length !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                  <Users size={18} />
                </div>
              </div>

              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search users or managers..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] pl-9 pr-3 text-sm text-[#26344D] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="max-h-[590px] overflow-y-auto">
              {loadingUsers ? (
                <div className="flex min-h-[420px] items-center justify-center px-6 text-center">
                  <div>
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#2563EB]" />

                    <p className="mt-4 text-sm font-medium text-[#64748B]">
                      Loading users...
                    </p>
                  </div>
                </div>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const userId = getId(user);

                  const existingConversation =
                    findConversationForUser(userId);

                  const isSelected =
                    String(getId(selectedUser)) ===
                    String(userId);

                  return (
                    <button
                      key={userId}
                      type="button"
                      onClick={() =>
                        handleSelectUser(user)
                      }
                      disabled={
                        startingConversation &&
                        isSelected
                      }
                      className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-4 text-left transition ${
                        isSelected
                          ? "bg-[#EEF4FF]"
                          : "hover:bg-[#F8FAFC]"
                      }`}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-xs font-bold text-[#2563EB]">
                        {getInitials(
                          getUserName(user)
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#171B3A]">
                              {getUserName(user)}
                            </p>

                            <p className="mt-0.5 text-[11px] font-medium text-[#2563EB]">
                              {getRole(user)}
                            </p>
                          </div>

                          {existingConversation && (
                            <span className="shrink-0 text-[10px] text-[#64748B]">
                              {formatConversationTime(
                                existingConversation.lastMessageAt ||
                                  existingConversation.updatedAt
                              )}
                            </span>
                          )}
                        </div>

                        <p className="mt-1 truncate text-xs text-[#64748B]">
                          {existingConversation?.lastMessage ||
                            user?.email ||
                            "Start a conversation"}
                        </p>

                        {existingConversation?.unreadCount >
                          0 && (
                          <span className="mt-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[#2563EB] px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {existingConversation.unreadCount}
                          </span>
                        )}

                        {!existingConversation && (
                          <span className="mt-2 inline-flex rounded-lg bg-[#EEF4FF] px-2 py-1 text-[10px] font-semibold text-[#2563EB]">
                            Start conversation
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="flex min-h-[420px] flex-col items-center justify-center px-6 py-10 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                    <Users size={28} />
                  </div>

                  <h3 className="mt-5 text-base font-bold text-[#171B3A]">
                    {search
                      ? "No matching users"
                      : "No users available"}
                  </h3>

                  <p className="mt-2 max-w-xs text-sm leading-6 text-[#64748B]">
                    {search
                      ? "Try another name, email, phone, or role."
                      : "No users or managers were returned by the backend."}
                  </p>
                </div>
              )}
            </div>
          </aside>

          {/* CHAT */}
          <div className="flex min-w-0 min-h-[680px] flex-col">
            {/* CHAT HEADER */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              {selectedUser ? (
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-xs font-bold text-[#2563EB]">
                    {getInitials(
                      getUserName(selectedUser)
                    )}
                  </div>

                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-[#171B3A]">
                      {getUserName(selectedUser)}
                    </h2>

                    <div className="mt-1 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />

                      <p className="text-xs text-[#64748B]">
                        {getRole(selectedUser)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EEF4FF] text-[#2563EB]">
                    <MessageSquare size={20} />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-[#171B3A]">
                      Select a User
                    </h2>

                    <p className="mt-1 text-xs text-[#64748B]">
                      Select a user or manager to start
                      messaging.
                    </p>
                  </div>
                </div>
              )}

              {selectedConversation && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      fetchMessages(
                        selectedConversationId
                      )
                    }
                    disabled={loadingMessages}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#2563EB] hover:bg-[#EEF4FF]"
                  >
                    <RefreshCw
                      size={14}
                      className={
                        loadingMessages
                          ? "animate-spin"
                          : ""
                      }
                    />
                    Refresh
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleDeleteConversation
                    }
                    className="flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              )}
            </div>

            {/* MESSAGES */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6">
              {startingConversation ? (
                <div className="flex min-h-[400px] items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#2563EB]" />

                    <p className="mt-4 text-sm text-[#64748B]">
                      Starting conversation...
                    </p>
                  </div>
                </div>
              ) : loadingMessages ? (
                <div className="flex min-h-[400px] items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#2563EB]" />

                    <p className="mt-4 text-sm text-[#64748B]">
                      Loading messages...
                    </p>
                  </div>
                </div>
              ) : messagesError ? (
                <div className="flex min-h-[400px] items-center justify-center">
                  <div className="max-w-md rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-center text-sm font-medium text-red-700">
                    {messagesError}
                  </div>
                </div>
              ) : !selectedUser ? (
                <div className="flex min-h-[400px] items-center justify-center">
                  <div className="max-w-md text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                      <MessageSquare size={29} />
                    </div>

                    <h3 className="mt-5 text-base font-bold text-[#171B3A]">
                      No user selected
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-[#64748B]">
                      Select any user or manager from
                      the list to start a conversation.
                    </p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex min-h-[400px] items-center justify-center">
                  <div className="max-w-md text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                      <MessageSquare size={29} />
                    </div>

                    <h3 className="mt-5 text-base font-bold text-[#171B3A]">
                      No messages yet
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-[#64748B]">
                      Write a message below to start the
                      conversation.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((item, index) => {
                    const sender = item?.sender;

                    const senderName =
                      getUserName(sender);

                    const body =
                      item?.body ||
                      item?.message ||
                      "";

                    const isAdminMessage =
                      String(
                        sender?.role || ""
                      ).toLowerCase() === "admin";

                    return (
                      <div
                        key={
                          item?.id ||
                          item?._id ||
                          `${item?.createdAt}-${index}`
                        }
                        className={`flex items-start gap-3 ${
                          isAdminMessage
                            ? "justify-end"
                            : ""
                        }`}
                      >
                        {!isAdminMessage && (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-[11px] font-bold text-[#2563EB]">
                            {getInitials(senderName)}
                          </div>
                        )}

                        <div
                          className={`min-w-0 max-w-[80%] ${
                            isAdminMessage
                              ? "items-end"
                              : ""
                          }`}
                        >
                          <div
                            className={`mb-1 flex items-center gap-2 ${
                              isAdminMessage
                                ? "justify-end"
                                : ""
                            }`}
                          >
                            <p className="text-xs font-bold text-[#171B3A]">
                              {senderName}
                            </p>

                            {sender?.role && (
                              <span className="text-[10px] capitalize text-[#2563EB]">
                                {sender.role}
                              </span>
                            )}

                            <span className="text-[10px] text-[#64748B]">
                              {formatMessageTime(
                                item?.createdAt
                              )}
                            </span>
                          </div>

                          {body && (
                            <div
                              className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                                isAdminMessage
                                  ? "rounded-tr-md bg-[#2563EB] text-white"
                                  : "rounded-tl-md bg-[#F8FAFC] text-[#26344D]"
                              }`}
                            >
                              {body}
                            </div>
                          )}

                          {Array.isArray(
                            item?.attachments
                          ) &&
                            item.attachments.length >
                              0 && (
                              <div className="mt-2 space-y-1.5">
                                {item.attachments.map(
                                  (
                                    attachment,
                                    attachmentIndex
                                  ) => {
                                    const mime = String(
                                      attachment?.mimeType || attachment?.fileType || ""
                                    ).toLowerCase();
                                    const isImg = mime.startsWith("image/");
                                    const fullUrl = getFileUrl(attachment?.url);

                                    if (isImg) {
                                      return (
                                        <a
                                          key={attachment?.url || attachmentIndex}
                                          href={fullUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="block overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-2xs hover:opacity-95"
                                        >
                                          <img
                                            src={fullUrl}
                                            alt={attachment?.originalName || attachment?.filename || "Attached Image"}
                                            className="max-h-60 w-auto rounded-lg object-contain"
                                          />
                                        </a>
                                      );
                                    }

                                    return (
                                      <a
                                        key={
                                          attachment?.url ||
                                          attachmentIndex
                                        }
                                        href={fullUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-2xs transition ${
                                          isAdminMessage
                                            ? "border-blue-200 bg-blue-50 text-[#2563EB] hover:bg-blue-100"
                                            : "border-slate-200 bg-white text-[#26344D] hover:bg-slate-50"
                                        }`}
                                      >
                                        <FileText
                                          size={15}
                                          className="shrink-0 text-[#2563EB]"
                                        />

                                        <span className="truncate max-w-[220px]">
                                          {attachment?.originalName ||
                                            attachment?.filename ||
                                            "Attached Document"}
                                        </span>
                                      </a>
                                    );
                                  }
                                )}
                              </div>
                            )}
                        </div>

                        {isAdminMessage && (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-[11px] font-bold text-white">
                            A
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* COMPOSER */}
            <div className="shrink-0 border-t border-slate-100 p-4 sm:p-5">
              
              {/* SELECTED FILES PREVIEW CHIPS */}
              {selectedFiles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[#F8FAFC] px-2.5 py-1 text-xs text-[#26344D]"
                    >
                      {file.type.startsWith("image/") ? (
                        <ImageIcon size={13} className="text-[#2563EB]" />
                      ) : (
                        <File size={13} className="text-[#2563EB]" />
                      )}
                      <span className="max-w-[140px] truncate font-medium">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(idx)}
                        className="ml-1 rounded text-slate-400 hover:text-red-500"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form
                onSubmit={handleSendMessage}
                className="flex items-end gap-2"
              >
                {/* Hidden Multi-file input */}
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={
                    !selectedUser ||
                    !selectedConversationId ||
                    sendingMessage
                  }
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-[#2563EB] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
                >
                  <Paperclip size={18} />
                </button>

                <div className="relative flex-1">
                  <textarea
                    value={message}
                    onChange={(event) =>
                      setMessage(event.target.value)
                    }
                    placeholder={
                      selectedUser
                        ? "Write a message or attach files..."
                        : "Select a user first..."
                    }
                    rows={1}
                    disabled={
                      !selectedUser ||
                      !selectedConversationId ||
                      sendingMessage
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey
                      ) {
                        event.preventDefault();
                        handleSendMessage(event);
                      }
                    }}
                    className="min-h-11 w-full resize-none rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    (!message.trim() && selectedFiles.length === 0) ||
                    !selectedUser ||
                    !selectedConversationId ||
                    sendingMessage
                  }
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {sendingMessage ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </form>

              <p className="mt-2 px-1 text-[10px] text-[#64748B]">
                Enter to send • Shift + Enter for a new line • Click Paperclip to add images/docs
              </p>
            </div>
          </div>
        </section>

        {/* INFO */}
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
              <ShieldCheck size={19} />
            </div>

            <div>
              <h2 className="text-sm font-bold text-[#171B3A]">
                Administrator Communication
              </h2>

              <p className="mt-1 text-xs leading-5 text-[#64748B]">
                All active users and managers are loaded
                directly from the Local Pro 1 backend.
                Select a user to open an existing
                conversation or start a new one.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}