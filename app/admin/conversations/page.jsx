"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  FileText,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Search,
  Send,
  RefreshCw,
  Trash2,
  X,
  Loader2,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  Users,
  ClipboardList,
  ClipboardCheck,
  CalendarDays,
  Activity,
  Settings,
  Menu,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { authService } from "@/services/authService";
import { usePathname, useRouter } from "next/navigation";

/* ============================================================
   API CONFIG
============================================================ */

const RAW_API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.localpro1.net/api";

const CLEAN_API_URL = String(RAW_API_URL)
  .trim()
  .replace(/\/+$/, "");

const API_BASE_URL = CLEAN_API_URL.endsWith("/api")
  ? CLEAN_API_URL
  : `${CLEAN_API_URL}/api`;

const BACKEND_BASE_URL = API_BASE_URL.endsWith("/api")
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL;

const getApiUrl = (path = "") => {
  const cleanPath = String(path).startsWith("/")
    ? String(path)
    : `/${path}`;

  return `${API_BASE_URL}${cleanPath}`;
};

const getFileUrl = (url) => {
  if (!url) return "#";

  const value = String(url);

  if (
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  return `${BACKEND_BASE_URL}${
    value.startsWith("/") ? "" : "/"
  }${value}`;
};

/* ============================================================
   TOKEN
============================================================ */

const normalizeTokenValue = (value) => {
  if (!value) return null;

  let rawValue = String(value).trim();

  if (!rawValue) return null;

  if (/^Bearer\s+/i.test(rawValue)) {
    rawValue = rawValue
      .replace(/^Bearer\s+/i, "")
      .trim();
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (typeof parsed === "string") {
      return (
        parsed.replace(/^Bearer\s+/i, "").trim() ||
        null
      );
    }

    if (parsed && typeof parsed === "object") {
      const possibleToken =
        parsed.token ||
        parsed.accessToken ||
        parsed.access_token ||
        parsed.jwt;

      if (possibleToken) {
        return (
          String(possibleToken)
            .replace(/^Bearer\s+/i, "")
            .trim() || null
        );
      }
    }
  } catch {}

  return rawValue || null;
};

const getStoredToken = () => {
  if (typeof window === "undefined") return null;

  const tokenKeys = [
    "token",
    "accessToken",
    "access_token",
    "authToken",
    "auth_token",
    "jwt",
  ];

  for (const key of tokenKeys) {
    try {
      const localToken = normalizeTokenValue(
        window.localStorage.getItem(key)
      );

      if (localToken) return localToken;
    } catch {}

    try {
      const sessionToken = normalizeTokenValue(
        window.sessionStorage.getItem(key)
      );

      if (sessionToken) return sessionToken;
    } catch {}
  }

  return null;
};

const getAuthHeaders = (includeContentType = true) => {
  const headers = {
    Accept: "application/json",
  };

  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  const token = getStoredToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

/* ============================================================
   RESPONSE PARSER
============================================================ */

const parseResponse = async (response) => {
  try {
    const text = await response.text();

    if (!text) return null;

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
};

/* ============================================================
   HELPERS
============================================================ */

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
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
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

  if (Array.isArray(data?.users)) {
    return data.users;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

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

  if (Array.isArray(data?.data?.conversations)) {
    return data.data.conversations;
  }

  return [];
};

const getUnreadCount = (conversation) => {
  if (!conversation) return 0;

  const possibleValues = [
    conversation?.unreadCount,
    conversation?.unreadMessages,
    conversation?.unread,
    conversation?.unreadMessageCount,
  ];

  for (const value of possibleValues) {
    if (
      typeof value === "number" &&
      value > 0
    ) {
      return value;
    }

    if (
      typeof value === "string" &&
      !Number.isNaN(Number(value))
    ) {
      const number = Number(value);

      if (number > 0) return number;
    }
  }

  return 0;
};

const getConversationLastMessage = (
  conversation
) => {
  if (!conversation) return "";

  return (
    conversation?.lastMessage ||
    conversation?.lastMessageText ||
    conversation?.latestMessage?.body ||
    conversation?.latestMessage?.message ||
    ""
  );
};

const getConversationLastDate = (
  conversation
) => {
  if (!conversation) return null;

  return (
    conversation?.lastMessageAt ||
    conversation?.lastMessage?.createdAt ||
    conversation?.latestMessage?.createdAt ||
    conversation?.updatedAt ||
    conversation?.createdAt ||
    null
  );
};

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
   MAIN COMPONENT
============================================================ */

export default function AdminConversationsPage() {
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] =
    useState([]);

  const [selectedUser, setSelectedUser] =
    useState(null);

  const [
    selectedConversationId,
    setSelectedConversationId,
  ] = useState(null);

  const [
    selectedConversation,
    setSelectedConversation,
  ] = useState(null);

  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] =
    useState([]);

  const [loadingUsers, setLoadingUsers] =
    useState(false);

  const [
    loadingConversations,
    setLoadingConversations,
  ] = useState(false);

  const [
    loadingMessages,
    setLoadingMessages,
  ] = useState(false);

  const [
    startingConversation,
    setStartingConversation,
  ] = useState(false);

  const [
    sendingMessage,
    setSendingMessage,
  ] = useState(false);

  const [
    messagesError,
    setMessagesError,
  ] = useState("");

  const [refreshing, setRefreshing] =
    useState(false);

  const [
    deleteModalOpen,
    setDeleteModalOpen,
  ] = useState(false);

  const [
    messageToDelete,
    setMessageToDelete,
  ] = useState(null);

  const [
    deletingMessage,
    setDeletingMessage,
  ] = useState(false);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const selectedConversationIdRef =
    useRef(null);

  const conversationsRef = useRef([]);
  const usersRef = useRef([]);
  const messagesRef = useRef([]);
  const messagesCache = useRef({});

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    conversationsRef.current =
      conversations;
  }, [conversations]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    selectedConversationIdRef.current =
      selectedConversationId;
  }, [selectedConversationId]);

  const scrollToBottom = useCallback(
    (instant = false) => {
      if (!messagesEndRef.current) return;

      messagesEndRef.current.scrollIntoView({
        behavior: instant ? "auto" : "smooth",
      });
    },
    []
  );

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(false);
    }
  }, [messages, scrollToBottom]);

  /* ==========================================================
     FETCH USERS & CONVERSATIONS
  ========================================================== */

  const fetchData = useCallback(
    async (force = false) => {
      try {
        const response = await fetch(
          getApiUrl("/users"),
          {
            method: "GET",
            credentials: "include",
            headers: getAuthHeaders(),
          }
        );

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const data =
          await parseResponse(response);

        if (response.ok) {
          const userData =
            normalizeUsers(data);

          const availableUsers =
            userData.filter((user) => {
              if (!user) return false;

              const role = String(
                user?.role || ""
              ).toLowerCase();

              return (
                role === "user" ||
                role === "manager"
              );
            });

          setUsers(availableUsers);
        }
      } catch {}

      try {
        const response = await fetch(
          getApiUrl("/conversations"),
          {
            method: "GET",
            credentials: "include",
            headers: getAuthHeaders(),
            cache: "no-store",
          }
        );

        const data =
          await parseResponse(response);

        if (response.ok) {
          const conversationData =
            normalizeConversations(data);

          setConversations(
            conversationData
          );

          conversationsRef.current =
            conversationData;
        }
      } catch {}
    },
    [router]
  );

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  const findConversationForUser =
    useCallback((userId, list) => {
      if (!userId) return null;

      const convList = Array.isArray(list)
        ? list
        : conversationsRef.current;

      return (
        convList.find((conversation) => {
          const participants =
            Array.isArray(
              conversation?.participants
            )
              ? conversation.participants
              : [];

          return participants.some(
            (participant) => {
              const participantId =
                getId(participant);

              return (
                participantId &&
                String(participantId) ===
                  String(userId)
              );
            }
          );
        }) || null
      );
    }, []);

  const extractMessages = (data) => {
    if (Array.isArray(data)) return data;

    if (Array.isArray(data?.messages)) {
      return data.messages;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    if (
      Array.isArray(
        data?.data?.messages
      )
    ) {
      return data.data.messages;
    }

    if (
      Array.isArray(
        data?.conversation?.messages
      )
    ) {
      return data.conversation.messages;
    }

    return [];
  };

  const fetchMessages = useCallback(
    async (
      conversationId,
      silent = false
    ) => {
      if (!conversationId) return [];

      if (
        !silent &&
        messagesCache.current[
          conversationId
        ]
      ) {
        setMessages(
          messagesCache.current[
            conversationId
          ]
        );

        setLoadingMessages(false);
      } else if (!silent) {
        setLoadingMessages(true);
      }

      if (!silent) {
        setMessagesError("");
      }

      try {
        const response = await fetch(
          getApiUrl(
            `/conversations/${conversationId}/messages?limit=100`
          ),
          {
            method: "GET",
            credentials: "include",
            headers: getAuthHeaders(),
            cache: "no-store",
          }
        );

        const data =
          await parseResponse(response);

        if (!response.ok) {
          throw new Error(
            "Failed to load messages."
          );
        }

        const messageData =
          extractMessages(data);

        if (
          String(conversationId) ===
          String(
            selectedConversationIdRef.current
          )
        ) {
          messagesCache.current[
            conversationId
          ] = messageData;

          setMessages(messageData);
        }

        return messageData;
      } catch (err) {
        if (!silent) {
          setMessagesError(
            err?.message ||
              "Unable to load messages."
          );
        }

        return [];
      } finally {
        if (!silent) {
          setLoadingMessages(false);
        }
      }
    },
    []
  );

  const openConversation =
    useCallback(
      async (
        conversation,
        user = null
      ) => {
        const conversationId =
          conversation?.id ||
          conversation?._id;

        if (!conversationId) return;

        selectedConversationIdRef.current =
          conversationId;

        setSelectedConversationId(
          conversationId
        );

        setSelectedConversation(
          conversation
        );

        if (user) {
          setSelectedUser(user);
        }

        setMessagesError("");
        setSelectedFiles([]);

        await fetchMessages(
          conversationId,
          false
        );

        try {
          await fetch(
            getApiUrl(
              `/conversations/${conversationId}/read`
            ),
            {
              method: "PUT",
              credentials: "include",
              headers: getAuthHeaders(),
            }
          );
        } catch {}
      },
      [fetchMessages]
    );

  const handleSelectUser =
    useCallback(
      async (user) => {
        const userId = getId(user);

        if (!userId) return;

        setSelectedUser(user);
        setMessagesError("");

        const existingConversation =
          findConversationForUser(
            userId,
            conversationsRef.current
          );

        if (existingConversation) {
          await openConversation(
            existingConversation,
            user
          );

          return;
        }

        setStartingConversation(true);

        try {
          const response = await fetch(
            getApiUrl(
              "/conversations"
            ),
            {
              method: "POST",
              credentials: "include",
              headers: getAuthHeaders(),
              body: JSON.stringify({
                recipientId: userId,
              }),
            }
          );

          const data =
            await parseResponse(
              response
            );

          if (!response.ok) {
            throw new Error(
              "Failed to start conversation."
            );
          }

          const newConversation =
            data?.conversation ||
            data?.data?.conversation ||
            data?.data ||
            data;

          const newConversationId =
            newConversation?.id ||
            newConversation?._id;

          if (newConversationId) {
            setConversations(
              (prev) => {
                const exists =
                  prev.some(
                    (item) =>
                      String(
                        item?.id ||
                          item?._id
                      ) ===
                      String(
                        newConversationId
                      )
                  );

                return exists
                  ? prev
                  : [
                      newConversation,
                      ...prev,
                    ];
              }
            );

            conversationsRef.current =
              [
                newConversation,
                ...conversationsRef.current,
              ];

            await openConversation(
              newConversation,
              user
            );
          }
        } catch (err) {
          setMessagesError(
            err?.message ||
              "Failed to start conversation."
          );
        } finally {
          setStartingConversation(
            false
          );
        }
      },
      [
        findConversationForUser,
        openConversation,
      ]
    );

  const filteredUsers = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    if (!query) return users;

    return users.filter((user) => {
      const full =
        `${user?.name || ""} ${
          user?.email || ""
        }`.toLowerCase();

      return full.includes(query);
    });
  }, [users, search]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();

    const cleanBody = message.trim();

    if (
      (!cleanBody &&
        selectedFiles.length === 0) ||
      !selectedConversationId ||
      !selectedUser
    ) {
      return;
    }

    const recipientId =
      getId(selectedUser);

    if (!recipientId) return;

    const tempId =
      `temp-${Date.now()}`;

    const filesToSend = [
      ...selectedFiles,
    ];

    const optimisticMessage = {
      _id: tempId,
      id: tempId,
      body: cleanBody,
      sender: {
        role: "admin",
        name: "You",
      },
      createdAt:
        new Date().toISOString(),
      attachments:
        filesToSend.map((file) => ({
          filename: file.name,
          originalName: file.name,
          mimeType: file.type,
        })),
    };

    setMessages((prev) => [
      ...prev,
      optimisticMessage,
    ]);

    setMessage("");
    setSelectedFiles([]);
    scrollToBottom(true);

    try {
      setSendingMessage(true);

      let response;

      if (filesToSend.length > 0) {
        const formData =
          new FormData();

        formData.append(
          "body",
          cleanBody
        );

        formData.append(
          "recipientId",
          recipientId
        );

        formData.append(
          "conversationId",
          selectedConversationId
        );

        filesToSend.forEach(
          (file) =>
            formData.append(
              "files",
              file
            )
        );

        const token =
          getStoredToken();

        const headers = {
          Accept:
            "application/json",
        };

        if (token) {
          headers.Authorization =
            `Bearer ${token}`;
        }

        response = await fetch(
          getApiUrl("/messages"),
          {
            method: "POST",
            credentials:
              "include",
            headers,
            body: formData,
          }
        );
      } else {
        response = await fetch(
          getApiUrl(
            `/conversations/${selectedConversationId}/messages`
          ),
          {
            method: "POST",
            credentials:
              "include",
            headers:
              getAuthHeaders(),
            body: JSON.stringify({
              body: cleanBody,
              recipientId,
            }),
          }
        );
      }

      const data =
        await parseResponse(
          response
        );

      if (!response.ok) {
        throw new Error(
          "Failed to send message."
        );
      }

      const confirmedMessage =
        data?.message ||
        data?.data?.message ||
        data?.data;

      if (
        confirmedMessage &&
        typeof confirmedMessage ===
          "object"
      ) {
        setMessages((prev) =>
          prev.map((item) =>
            String(
              item?.id ||
                item?._id
            ) ===
            String(tempId)
              ? confirmedMessage
              : item
          )
        );
      }
    } catch (err) {
      setMessagesError(
        "Message failed to sync: " +
          (err?.message ||
            "Error")
      );

      setMessages((prev) =>
        prev.filter(
          (item) =>
            String(
              item?.id ||
                item?._id
            ) !==
            String(tempId)
        )
      );
    } finally {
      setSendingMessage(false);
    }
  };

  const promptDeleteMessage = (
    msg
  ) => {
    setMessageToDelete(msg);
    setDeleteModalOpen(true);
  };

  const executeDeleteMessage =
    async (type) => {
      if (!messageToDelete)
        return;

      const messageId =
        messageToDelete?._id ||
        messageToDelete?.id;

      if (!messageId) return;

      try {
        setDeletingMessage(true);

        const endpoint =
          type === "everyone"
            ? `/messages/${messageId}/delete-for-everyone`
            : `/messages/${messageId}/delete-for-me`;

        const response =
          await fetch(
            getApiUrl(endpoint),
            {
              method: "POST",
              credentials:
                "include",
              headers:
                getAuthHeaders(),
            }
          );

        if (!response.ok) {
          throw new Error(
            "Delete failed."
          );
        }

        if (type === "me") {
          setMessages((prev) =>
            prev.filter(
              (item) =>
                String(
                  item?._id ||
                    item?.id
                ) !==
                String(messageId)
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((item) =>
              String(
                item?._id ||
                  item?.id
              ) ===
              String(messageId)
                ? {
                    ...item,
                    body:
                      "This message was deleted",
                    isDeletedForEveryone:
                      true,
                  }
                : item
            )
          );
        }

        setDeleteModalOpen(
          false
        );

        setMessageToDelete(null);
      } catch (err) {
        setMessagesError(
          err?.message ||
            "Could not delete message."
        );
      } finally {
        setDeletingMessage(
          false
        );
      }
    };

  const handleDeleteConversation =
    async () => {
      if (!selectedConversationId)
        return;

      if (
        !window.confirm(
          "Are you sure you want to delete this entire conversation?"
        )
      ) {
        return;
      }

      try {
        const response =
          await fetch(
            getApiUrl(
              `/conversations/${selectedConversationId}`
            ),
            {
              method: "DELETE",
              credentials:
                "include",
              headers:
                getAuthHeaders(),
            }
          );

        if (!response.ok) {
          throw new Error(
            "Failed to delete conversation."
          );
        }

        const deletedId =
          selectedConversationId;

        setConversations((prev) =>
          prev.filter(
            (c) =>
              String(
                c?.id ||
                  c?._id
              ) !==
              String(deletedId)
          )
        );

        delete messagesCache
          .current[deletedId];

        selectedConversationIdRef.current =
          null;

        setSelectedConversationId(
          null
        );

        setSelectedConversation(
          null
        );

        setSelectedUser(null);
        setMessages([]);
      } catch (err) {
        setMessagesError(
          err?.message ||
            "Could not delete conversation."
        );
      }
    };

  async function handleLogout() {
    try {
      await authService.logout();
    } catch {
    } finally {
      setSidebarOpen(false);
      router.replace("/login");
    }
  }

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-[#f7f8fc] text-slate-950 animate-fadeIn">
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
          onClick={() =>
            setSidebarOpen(false)
          }
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* SIDEBAR */}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#171B3A] text-white shadow-2xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <Link
            href="/admin"
            onClick={() =>
              setSidebarOpen(false)
            }
            className="flex items-center gap-3 text-white"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20">
              <ShieldCheck size={22} />
            </div>

            <div>
              <h1 className="text-sm font-bold text-white">
                Local Pro 1
              </h1>

              <p className="text-[11px] font-semibold text-blue-400">
                Admin Workspace
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() =>
              setSidebarOpen(false)
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Administration
          </p>

          <div className="space-y-1.5">
            {navigation.map(
              (item) => (
                <AdminNavItem
                  key={item.href}
                  item={item}
                  onNavigate={() =>
                    setSidebarOpen(
                      false
                    )
                  }
                />
              )
            )}
          </div>
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#2563EB] text-xs font-bold text-white">
              A
            </div>

            <div className="min-w-0">
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

      {/* MAIN CONTAINER */}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden w-full">
        {/* TOP HEADER REMOVED */}

        {/* WORKSPACE CHAT SECTION */}

        <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-0 animate-slideUp">
          <section className="grid h-full min-h-0 flex-1 w-full grid-cols-1 overflow-hidden rounded-none border-0 bg-white shadow-none lg:grid-cols-[360px_minmax(0,1fr)]">
            {/* Left Column */}

            <aside className="flex h-full min-h-0 flex-col border-b border-slate-100 lg:border-b-0 lg:border-r">
              <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 p-4 sm:p-5">
                <div className="mb-3.5">
                  <h2 className="text-base font-extrabold text-slate-900">
                    Team Contacts
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-400">
                    Select a member to chat
                  </p>
                </div>

                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="text"
                    value={search}
                    onChange={(e) =>
                      setSearch(
                        e.target.value
                      )
                    }
                    placeholder="Search contacts..."
                    className="h-10 w-full rounded-2xl border border-slate-200/90 bg-white pl-9 pr-3 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {loadingUsers &&
                users.length === 0 ? (
                  <div className="flex min-h-[260px] flex-col items-center justify-center p-6 text-center">
                    <Loader2
                      size={26}
                      className="animate-spin text-violet-600"
                    />

                    <p className="mt-3 text-xs font-semibold text-slate-400">
                      Loading contacts...
                    </p>
                  </div>
                ) : filteredUsers.length >
                  0 ? (
                  filteredUsers.map(
                    (user) => {
                      const userId =
                        getId(user);

                      const isSelected =
                        String(
                          getId(
                            selectedUser
                          )
                        ) ===
                        String(userId);

                      const existingConv =
                        findConversationForUser(
                          userId,
                          conversations
                        );

                      const unread =
                        getUnreadCount(
                          existingConv
                        );

                      return (
                        <button
                          key={userId}
                          type="button"
                          onClick={() =>
                            handleSelectUser(
                              user
                            )
                          }
                          className={`flex w-full items-start gap-3 border-b border-slate-100/80 px-4 py-3.5 text-left transition duration-150 ${
                            isSelected
                              ? "bg-violet-50/70 border-violet-200/60"
                              : "hover:bg-slate-50/80"
                          }`}
                        >
                          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-sm">
                            {getInitials(
                              getUserName(
                                user
                              )
                            )}

                            {unread > 0 &&
                              !isSelected && (
                                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white shadow-sm">
                                  {unread >
                                  99
                                    ? "99+"
                                    : unread}
                                </span>
                              )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-xs font-bold text-slate-900">
                                {getUserName(
                                  user
                                )}
                              </p>

                              {existingConv && (
                                <span className="shrink-0 text-[10px] text-slate-400">
                                  {formatConversationTime(
                                    getConversationLastDate(
                                      existingConv
                                    )
                                  )}
                                </span>
                              )}
                            </div>

                            <p className="mt-1 truncate text-xs text-slate-500">
                              {getConversationLastMessage(
                                existingConv
                              ) ||
                                user?.email ||
                                "Click to message"}
                            </p>
                          </div>
                        </button>
                      );
                    }
                  )
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No contacts available.
                  </div>
                )}
              </div>
            </aside>

            {/* Right Column */}

            <div className="flex h-full min-h-0 min-w-0 flex-col bg-slate-50/20">
              {/* CHAT HEADER */}

              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-md shadow-purple-500/10">
                    {selectedUser ? (
                      getInitials(
                        getUserName(
                          selectedUser
                        )
                      )
                    ) : (
                      <MessageSquare
                        size={18}
                      />
                    )}
                  </div>

                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-extrabold text-slate-900">
                      {selectedUser
                        ? getUserName(
                            selectedUser
                          )
                        : "Select a contact"}
                    </h2>

                    <p className="truncate text-xs font-semibold text-violet-600">
                      {selectedUser
                        ? getRole(
                            selectedUser
                          ) ||
                          "Active Member"
                        : "Choose from list"}
                    </p>
                  </div>
                </div>

                {selectedConversationId && (
                  <button
                    onClick={
                      handleDeleteConversation
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                    title="Delete Conversation"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Messages Container */}

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6">
                {startingConversation ? (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                    <Loader2
                      size={28}
                      className="animate-spin text-violet-600"
                    />

                    <p className="mt-2 text-xs font-semibold text-slate-400">
                      Opening conversation...
                    </p>
                  </div>
                ) : loadingMessages ? (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                    <Loader2
                      size={28}
                      className="animate-spin text-violet-600"
                    />

                    <p className="mt-2 text-xs font-semibold text-slate-400">
                      Loading messages...
                    </p>
                  </div>
                ) : !selectedUser ? (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                      <MessageSquare
                        size={26}
                      />
                    </div>

                    <h3 className="mt-4 text-sm font-bold text-slate-900">
                      No contact selected
                    </h3>

                    <p className="mt-1 text-xs text-slate-400">
                      Pick a team member
                      from the left list
                      to review chat
                      histories.
                    </p>
                  </div>
                ) : messages.length ===
                  0 ? (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                    <h3 className="text-sm font-bold text-slate-800">
                      Say Hello 👋
                    </h3>

                    <p className="mt-1 text-xs text-slate-400">
                      Start the discussion
                      below.
                    </p>
                  </div>
                ) : (
                  <div className="mx-auto flex w-full max-w-5xl flex-col gap-3.5">
                    {messages.map(
                      (
                        item,
                        index
                      ) => {
                        const sender =
                          item?.sender;

                        const senderName =
                          getUserName(
                            sender
                          );

                        const isDeleted =
                          Boolean(
                            item?.isDeletedForEveryone
                          );

                        const body =
                          isDeleted
                            ? "This message was deleted"
                            : item?.body ||
                              item?.message ||
                              "";

                        const isAdmin =
                          String(
                            sender?.role ||
                              ""
                          ).toLowerCase() ===
                          "admin";

                        return (
                          <div
                            key={
                              item?.id ||
                              item?._id ||
                              index
                            }
                            className={`group relative flex w-full items-center gap-2.5 ${
                              isAdmin
                                ? "justify-end"
                                : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-[82%] rounded-[20px] px-4 py-3 shadow-sm sm:max-w-[72%] ${
                                isDeleted
                                  ? "border border-slate-200/80 bg-slate-50 italic text-slate-400"
                                  : isAdmin
                                  ? "rounded-tr-xs bg-violet-600 text-white shadow-violet-600/15"
                                  : "rounded-tl-xs border border-slate-100 bg-white text-slate-800 shadow-[0_4px_20px_rgba(45,35,100,0.03)]"
                              }`}
                            >
                              {!isAdmin &&
                                senderName &&
                                !isDeleted && (
                                  <p className="mb-1 text-[10px] font-bold text-violet-600">
                                    {
                                      senderName
                                    }
                                  </p>
                                )}

                              <p className="whitespace-pre-wrap break-words text-xs font-medium leading-relaxed">
                                {body}
                              </p>

                              <span
                                className={`mt-1.5 block text-right text-[10px] ${
                                  isAdmin
                                    ? "text-violet-200"
                                    : "text-slate-400"
                                }`}
                              >
                                {formatMessageTime(
                                  item?.createdAt
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      }
                    )}

                    <div
                      ref={
                        messagesEndRef
                      }
                    />
                  </div>
                )}
              </div>

              {/* Composer */}

              <div className="shrink-0 border-t border-slate-100 bg-white p-4 sm:p-5">
                {selectedFiles.length >
                  0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {selectedFiles.map(
                      (
                        file,
                        idx
                      ) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/70 px-3 py-1.5 text-xs text-violet-800"
                        >
                          <span className="max-w-[150px] truncate font-semibold">
                            {
                              file.name
                            }
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedFiles(
                                (
                                  prev
                                ) =>
                                  prev.filter(
                                    (
                                      _,
                                      i
                                    ) =>
                                      i !==
                                      idx
                                  )
                              )
                            }
                            className="text-violet-400 hover:text-rose-600"
                          >
                            <X
                              size={
                                13
                              }
                            />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}

                <form
                  onSubmit={
                    handleSendMessage
                  }
                  className="flex items-end gap-2.5"
                >
                  <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    onChange={(e) => {
                      const newFiles =
                        Array.from(
                          e.target
                            .files || []
                        );

                      setSelectedFiles(
                        (prev) => [
                          ...prev,
                          ...newFiles,
                        ]
                      );

                      e.target.value =
                        "";
                    }}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    disabled={
                      !selectedUser
                    }
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-slate-50/50 text-slate-500 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600 disabled:opacity-40"
                  >
                    <Paperclip
                      size={18}
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    <textarea
                      value={message}
                      onChange={(e) =>
                        setMessage(
                          e.target.value
                        )
                      }
                      placeholder={
                        selectedUser
                          ? "Write a message..."
                          : "Select user first..."
                      }
                      rows={1}
                      disabled={
                        !selectedUser ||
                        sendingMessage
                      }
                      onKeyDown={(e) => {
                        if (
                          e.key ===
                            "Enter" &&
                          !e.shiftKey
                        ) {
                          e.preventDefault();

                          handleSendMessage(
                            e
                          );
                        }
                      }}
                      className="min-h-11 max-h-32 w-full resize-none rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 py-3 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 disabled:opacity-60"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={
                      !selectedUser ||
                      sendingMessage ||
                      (!message.trim() &&
                        selectedFiles.length ===
                          0)
                    }
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-600/25 transition hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    {sendingMessage ? (
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                    ) : (
                      <Send
                        size={17}
                      />
                    )}
                  </button>
                </form>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

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
          ? "bg-[#2563EB] text-white shadow-md shadow-blue-600/30"
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