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
   GLOBAL CACHE FOR INSTANT WHATSAPP-LIKE LOAD
============================================================ */
let globalAdminConversationsCache = {
  users: [],
  conversations: [],
  messagesCache: {},
  loaded: false,
};

/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function AdminConversationsPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [users, setUsers] = useState(
    globalAdminConversationsCache.users
  );
  const [conversations, setConversations] =
    useState(globalAdminConversationsCache.conversations);

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
    useState(!globalAdminConversationsCache.loaded);

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

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const selectedConversationIdRef =
    useRef(null);

  const conversationsRef = useRef(conversations);
  const usersRef = useRef(users);
  const messagesRef = useRef(messages);
  const messagesCache = useRef(
    globalAdminConversationsCache.messagesCache
  );

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
            cache: force
              ? "no-store"
              : "default",
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
          globalAdminConversationsCache.users = availableUsers;
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

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const data =
          await parseResponse(response);

        if (response.ok) {
          const conversationData =
            normalizeConversations(data);

          const updatedConversations =
            conversationData.map(
              (conversation) => {
                const conversationId =
                  conversation?.id ||
                  conversation?._id;

                if (
                  selectedConversationIdRef.current &&
                  String(conversationId) ===
                    String(
                      selectedConversationIdRef.current
                    )
                ) {
                  return {
                    ...conversation,
                    unreadCount: 0,
                    unreadMessages: 0,
                    unread: 0,
                    unreadMessageCount: 0,
                  };
                }

                return conversation;
              }
            );

          setConversations(
            updatedConversations
          );

          conversationsRef.current =
            updatedConversations;
          globalAdminConversationsCache.conversations =
            updatedConversations;
          globalAdminConversationsCache.loaded = true;
        }
      } catch {}
      setLoadingUsers(false);
    },
    [router]
  );

  useEffect(() => {
    fetchData(false);

    const interval = setInterval(() => {
      fetchData(true);
    }, 5000);

    return () => clearInterval(interval);
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

      if (messagesCache.current[conversationId]) {
        setMessages(
          messagesCache.current[conversationId]
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
          globalAdminConversationsCache.messagesCache =
            messagesCache.current;

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

        setConversations((prev) =>
          prev.map((item) => {
            const itemId =
              item?.id ||
              item?._id;

            if (
              String(itemId) ===
              String(conversationId)
            ) {
              return {
                ...item,
                unreadCount: 0,
                unreadMessages: 0,
                unread: 0,
                unreadMessageCount: 0,
              };
            }

            return item;
          })
        );

        conversationsRef.current =
          conversationsRef.current.map(
            (item) => {
              const itemId =
                item?.id ||
                item?._id;

              if (
                String(itemId) ===
                String(conversationId)
              ) {
                return {
                  ...item,
                  unreadCount: 0,
                  unreadMessages: 0,
                  unread: 0,
                  unreadMessageCount: 0,
                };
              }

              return item;
            }
          );

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
          url: URL.createObjectURL(file), // Local preview for optimistic update
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

      fetchData(true);
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

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#f7f8fc] text-slate-950">
      {/* FULL REMAINING PAGE */}
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* CONVERSATION WORKSPACE */}
        <section className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-white lg:flex-row">
          
          {/* CONTACTS SIDEBAR */}
          <div className="flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-slate-100 lg:h-full lg:w-[360px] lg:border-b-0 lg:border-r">
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
                    setSearch(e.target.value)
                  }
                  placeholder="Search contacts..."
                  className="h-10 w-full rounded-2xl border border-slate-200/90 bg-white pl-9 pr-3 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
                filteredUsers.map((user) => {
                  const userId = getId(user);
                  const isSelected =
                    String(
                      getId(selectedUser)
                    ) === String(userId);

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
                        handleSelectUser(user)
                      }
                      className={`flex w-full items-start gap-3 border-b border-slate-100/80 px-4 py-3.5 text-left transition duration-150 ${
                        isSelected
                          ? "border-violet-200/60 bg-violet-50/70"
                          : "hover:bg-slate-50/80"
                      }`}
                    >
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-visible rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-sm">
                        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl">
                          {getInitials(
                            getUserName(user)
                          )}
                        </div>

                        {unread > 0 &&
                          !isSelected && (
                            <span className="absolute -right-1.5 -top-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1.5 text-[10px] font-extrabold leading-none text-white shadow-md shadow-violet-600/30 ring-2 ring-white">
                              {unread > 99
                                ? "99+"
                                : unread}
                            </span>
                          )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-bold text-slate-900">
                            {getUserName(user)}
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
                })
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  No contacts available.
                </div>
              )}
            </div>
          </div>

          {/* CHAT MAIN PANEL */}
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-50/20">
            
            {/* Chat Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-md shadow-purple-500/10">
                  {selectedUser ? (
                    getInitials(
                      getUserName(selectedUser)
                    )
                  ) : (
                    <MessageSquare size={18} />
                  )}
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-sm font-extrabold text-slate-900">
                    {selectedUser
                      ? getUserName(selectedUser)
                      : "Select a contact"}
                  </h2>

                  <p className="truncate text-xs font-semibold text-violet-600">
                    {selectedUser
                      ? getRole(selectedUser) ||
                        "Active Member"
                      : "Choose from list"}
                  </p>
                </div>
              </div>

              {selectedConversationId && (
                <button
                  onClick={handleDeleteConversation}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                  title="Delete Conversation"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* Scrollable Messages Area */}
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6">
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
                    <MessageSquare size={26} />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-slate-900">
                    No contact selected
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Pick a team member from the left list to review chat histories.
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                  <h3 className="text-sm font-bold text-slate-800">
                    Say Hello 👋
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Start the discussion below.
                  </p>
                </div>
              ) : (
                <div className="flex w-full flex-col gap-3.5">
                  {messages.map((item, index) => {
                    const sender = item?.sender;
                    const senderName = getUserName(sender);
                    const isDeleted = Boolean(
                      item?.isDeletedForEveryone
                    );

                    const body = isDeleted
                      ? "This message was deleted"
                      : item?.body ||
                        item?.message ||
                        "";

                    const isAdmin =
                      String(
                        sender?.role || ""
                      ).toLowerCase() === "admin";

                    const attachments = Array.isArray(item?.attachments)
                      ? item.attachments
                      : [];

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
                                {senderName}
                              </p>
                            )}

                          {/* Render Attachments / Images */}
                          {attachments.length > 0 && (
                            <div className="mb-2 flex flex-col gap-2">
                              {attachments.map((att, attIdx) => {
                                const fileUrl =
                                  att.url ||
                                  getFileUrl(att.path || att.filename || att.filenameOriginal);
                                const isImage =
                                  att.mimeType?.startsWith("image/") ||
                                  /\.(png|jpg|jpeg|webp|gif)$/i.test(fileUrl);

                                if (isImage) {
                                  return (
                                    <a
                                      key={attIdx}
                                      href={fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block overflow-hidden rounded-xl border border-white/20 bg-black/10"
                                    >
                                      <img
                                        src={fileUrl}
                                        alt={att.originalName || att.filename || "Attachment"}
                                        className="max-h-60 w-full object-cover transition hover:opacity-95"
                                      />
                                    </a>
                                  );
                                }

                                return (
                                  <a
                                    key={attIdx}
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-semibold ${
                                      isAdmin
                                        ? "bg-white/10 text-white hover:bg-white/20"
                                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                    }`}
                                  >
                                    <FileText size={16} />
                                    <span className="truncate">
                                      {att.originalName || att.filename || "Download File"}
                                    </span>
                                  </a>
                                );
                              })}
                            </div>
                          )}

                          {body && (
                            <p className="whitespace-pre-wrap break-words text-xs font-medium leading-relaxed">
                              {body}
                            </p>
                          )}

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
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Fixed Message Composer Footer */}
            <div className="shrink-0 border-t border-slate-100 bg-white p-4 sm:p-5">
              {selectedFiles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/70 px-3 py-1.5 text-xs text-violet-800"
                    >
                      <span className="max-w-[150px] truncate font-semibold">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedFiles((prev) =>
                            prev.filter(
                              (_, i) => i !== idx
                            )
                          )
                        }
                        className="text-violet-400 hover:text-rose-600"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form
                onSubmit={handleSendMessage}
                className="flex items-end gap-2.5"
              >
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={(e) => {
                    const newFiles =
                      Array.from(
                        e.target.files || []
                      );
                    setSelectedFiles((prev) => [
                      ...prev,
                      ...newFiles,
                    ]);
                    e.target.value = "";
                  }}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                  disabled={!selectedUser}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-slate-50/50 text-slate-500 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600 disabled:opacity-40"
                >
                  <Paperclip size={18} />
                </button>

                <div className="min-w-0 flex-1">
                  <textarea
                    value={message}
                    onChange={(e) =>
                      setMessage(e.target.value)
                    }
                    placeholder={
                      selectedUser
                        ? "Write a message..."
                        : "Select user first..."
                    }
                    rows={1}
                    disabled={
                      !selectedUser || sendingMessage
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey
                      ) {
                        e.preventDefault();
                        handleSendMessage(e);
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
                      selectedFiles.length === 0)
                  }
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-600/25 transition hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {sendingMessage ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Send size={17} />
                  )}
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}