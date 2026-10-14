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
  Paperclip,
  Search,
  Send,
  Trash2,
  X,
  Loader2,
  Plus,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";

/* ============================================================
   API CONFIG
============================================================ */

const RAW_API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.localpro1.net/api";

const CLEAN_API_URL = String(RAW_API_URL).trim().replace(/\/+$/, "");

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
    /^(https?:\/\/|blob:|data:)/i.test(value)
  ) {
    return value;
  }

  return `${BACKEND_BASE_URL}${
    value.startsWith("/") ? "" : "/"
  }${value}`;
};

/* ============================================================
   AUTH HELPERS
============================================================ */

const normalizeTokenValue = (value) => {
  if (!value) return null;

  let raw = String(value).trim();
  if (!raw) return null;

  raw = raw.replace(/^Bearer\s+/i, "").trim();

  try {
    const parsed = JSON.parse(raw);

    if (typeof parsed === "string") {
      return parsed.replace(/^Bearer\s+/i, "").trim() || null;
    }

    if (parsed && typeof parsed === "object") {
      const token =
        parsed.token ||
        parsed.accessToken ||
        parsed.access_token ||
        parsed.jwt;

      if (token) {
        return String(token)
          .replace(/^Bearer\s+/i, "")
          .trim();
      }
    }
  } catch {}

  return raw || null;
};

const getStoredToken = () => {
  if (typeof window === "undefined") return null;

  const keys = [
    "token",
    "accessToken",
    "access_token",
    "authToken",
    "auth_token",
    "jwt",
  ];

  for (const key of keys) {
    try {
      const token = normalizeTokenValue(
        localStorage.getItem(key)
      );
      if (token) return token;
    } catch {}

    try {
      const token = normalizeTokenValue(
        sessionStorage.getItem(key)
      );
      if (token) return token;
    } catch {}
  }

  return null;
};

const getAuthHeaders = (includeContentType = true) => {
  const headers = { Accept: "application/json" };
  const token = getStoredToken();

  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

/* ============================================================
   RESPONSE HELPERS
============================================================ */

const parseResponse = async (response) => {
  try {
    const text = await response.text();

    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return { success: false, message: text };
    }
  } catch {
    return null;
  }
};

const getId = (item) => {
  if (!item) return null;

  if (typeof item === "string" || typeof item === "number") {
    return item;
  }

  return (
    item._id ||
    item.id ||
    item.userId?._id ||
    item.userId?.id ||
    null
  );
};

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

const getInitials = (name) =>
  String(name || "U")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "U";

const formatMessageTime = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatConversationTime = (value) => {
  if (!value) return "";

  const date = new Date(value);
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
  if (Array.isArray(data?.data?.users)) return data.data.users;
  return [];
};

const normalizeConversations = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.conversations)) return data.conversations;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.conversations)) {
    return data.data.conversations;
  }
  return [];
};

const extractMessages = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.messages)) return data.messages;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.messages)) {
    return data.data.messages;
  }
  if (Array.isArray(data?.conversation?.messages)) {
    return data.conversation.messages;
  }
  return [];
};

const getMessageId = (message) =>
  message?._id || message?.id || null;

const getConversationId = (conversation) =>
  conversation?._id || conversation?.id || null;

const getConversationIdFromMessage = (message) => {
  const value =
    message?.conversationId ||
    message?.conversation?._id ||
    message?.conversation?.id ||
    message?.conversation ||
    message?.chatId;

  if (value && typeof value === "object") {
    return value._id || value.id || null;
  }

  return value || null;
};

const getUnreadCount = (conversation) => {
  const values = [
    conversation?.unreadCount,
    conversation?.unreadMessages,
    conversation?.unread,
    conversation?.unreadMessageCount,
  ];

  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) {
      return number;
    }
  }

  return 0;
};

const getConversationLastMessage = (conversation) => {
  const last = conversation?.lastMessage;

  if (typeof last === "string") return last;

  return (
    last?.body ||
    last?.message ||
    conversation?.lastMessageText ||
    conversation?.latestMessage?.body ||
    conversation?.latestMessage?.message ||
    ""
  );
};

const getConversationLastDate = (conversation) =>
  conversation?.lastMessageAt ||
  conversation?.lastMessage?.createdAt ||
  conversation?.latestMessage?.createdAt ||
  conversation?.updatedAt ||
  conversation?.createdAt ||
  null;

const getSenderId = (message) =>
  getId(message?.sender) ||
  getId(message?.senderId) ||
  null;

const getMessageBody = (message) =>
  message?.body ||
  message?.message ||
  message?.content ||
  "";

/* ============================================================
   NOTIFICATION HELPERS
============================================================ */

const playMessageNotificationSound = () => {
  try {
    if (typeof window === "undefined") return;

    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const play = () => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(
        880,
        context.currentTime
      );

      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.12,
        context.currentTime + 0.02
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + 0.25
      );

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.26);

      oscillator.onended = () => {
        context.close().catch(() => {});
      };
    };

    if (context.state === "suspended") {
      context.resume().then(play).catch(() => {
        context.close().catch(() => {});
      });
    } else {
      play();
    }
  } catch (error) {
    console.warn("Notification sound unavailable:", error);
  }
};

const showMessageDesktopNotification = (title, body) => {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  try {
    const notification = new Notification(title, {
      body: body || "You received a new message.",
      icon: "/favicon.ico",
      tag: `localpro-chat-${Date.now()}`,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (error) {
    console.warn("Desktop notification unavailable:", error);
  }
};

/* ============================================================
   MESSAGE NORMALIZATION
============================================================ */

const unwrapSocketMessage = (payload) => {
  if (!payload) return null;

  // Controller/event payloads can use different wrapper shapes.
  const candidates = [
    payload.messageData,
    payload.data?.messageData,
    payload.data?.message,
    payload.message,
    payload.data,
    payload,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;

    if (
      getMessageId(candidate) ||
      getConversationIdFromMessage(candidate)
    ) {
      return candidate;
    }
  }

  return null;
};

const normalizeMessage = (message, conversationId) => {
  if (!message || typeof message !== "object") return message;

  const sender =
    message.sender ||
    message.senderId ||
    message.user ||
    null;

  return {
    ...message,
    _id: message._id || message.id,
    id: message.id || message._id,
    body: getMessageBody(message),
    sender,
    conversationId:
      getConversationIdFromMessage(message) || conversationId,
    attachments: Array.isArray(message.attachments)
      ? message.attachments
      : [],
  };
};

/* ============================================================
   MAIN PAGE
============================================================ */

export default function AdminConversationsPage() {
  const router = useRouter();

  const [isClient, setIsClient] = useState(false);
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
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [startingConversation, setStartingConversation] =
    useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);

  const [onlineUsers, setOnlineUsers] = useState({});

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState(
    []
  );
  const [creatingGroup, setCreatingGroup] = useState(false);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  const selectedConversationIdRef = useRef(null);
  const conversationsRef = useRef([]);
  const usersRef = useRef([]);
  const messagesRef = useRef([]);

  const messagesCache = useRef({});
  const processedSocketMessages = useRef(new Set());
  const refreshTimerRef = useRef(null);
  const mountedRef = useRef(false);

  /* ==========================================================
     CACHE
  ========================================================== */

  const saveCache = useCallback((uList, cList, mCache) => {
    if (typeof window === "undefined") return;

    try {
      if (Array.isArray(uList)) {
        localStorage.setItem(
          "localpro_admin_users",
          JSON.stringify(uList)
        );
      }

      if (Array.isArray(cList)) {
        localStorage.setItem(
          "localpro_admin_convs",
          JSON.stringify(cList)
        );
      }

      if (mCache && typeof mCache === "object") {
        // Do not persist temporary blob URLs. They are invalid after reload.
        const safeCache = {};

        Object.entries(mCache).forEach(([conversationId, list]) => {
          if (!Array.isArray(list)) return;

          safeCache[conversationId] = list.filter((item) => {
            const id = String(getMessageId(item) || "");
            return !id.startsWith("temp-");
          });
        });

        localStorage.setItem(
          "localpro_admin_msgs",
          JSON.stringify(safeCache)
        );
      }
    } catch (error) {
      console.warn("Unable to save chat cache:", error);
    }
  }, []);

  useEffect(() => {
    setIsClient(true);
    mountedRef.current = true;

    try {
      const cachedUsers = localStorage.getItem(
        "localpro_admin_users"
      );
      const cachedConversations = localStorage.getItem(
        "localpro_admin_convs"
      );
      const cachedMessages = localStorage.getItem(
        "localpro_admin_msgs"
      );

      if (cachedUsers) {
        const parsed = JSON.parse(cachedUsers);
        if (Array.isArray(parsed)) {
          setUsers(parsed);
          usersRef.current = parsed;
        }
      }

      if (cachedConversations) {
        const parsed = JSON.parse(cachedConversations);
        if (Array.isArray(parsed)) {
          setConversations(parsed);
          conversationsRef.current = parsed;
          setLoadingUsers(false);
        }
      }

      if (cachedMessages) {
        const parsed = JSON.parse(cachedMessages);
        if (parsed && typeof parsed === "object") {
          messagesCache.current = parsed;
        }
      }
    } catch (error) {
      console.warn("Unable to restore chat cache:", error);
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    selectedConversationIdRef.current =
      selectedConversationId;
  }, [selectedConversationId]);

  const scrollToBottom = useCallback((instant = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: instant ? "auto" : "smooth",
    });
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom(false);
  }, [messages, scrollToBottom]);

  /* ==========================================================
     DATA REFRESH
  ========================================================== */

  const fetchData = useCallback(
    async (force = false) => {
      const headers = getAuthHeaders();

      try {
        const response = await fetch(getApiUrl("/users"), {
          method: "GET",
          credentials: "include",
          headers,
          cache: force ? "no-store" : "default",
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const data = await parseResponse(response);

        if (response.ok) {
          const availableUsers = normalizeUsers(data).filter(
            (user) => {
              const role = String(
                user?.role || ""
              ).toLowerCase();

              return (
                role === "user" ||
                role === "manager" ||
                role === "admin"
              );
            }
          );

          if (mountedRef.current) {
            setUsers(availableUsers);
            usersRef.current = availableUsers;

            saveCache(
              availableUsers,
              conversationsRef.current,
              messagesCache.current
            );
          }
        }
      } catch (error) {
        console.warn("Unable to refresh users:", error);
      }

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

        const data = await parseResponse(response);

        if (response.ok) {
          const currentId = String(
            selectedConversationIdRef.current || ""
          );

          const updatedConversations =
            normalizeConversations(data).map((conversation) => {
              const id = String(
                getConversationId(conversation) || ""
              );

              if (currentId && id === currentId) {
                return {
                  ...conversation,
                  unreadCount: 0,
                  unreadMessages: 0,
                  unread: 0,
                  unreadMessageCount: 0,
                };
              }

              return conversation;
            });

          if (mountedRef.current) {
            setConversations(updatedConversations);
            conversationsRef.current = updatedConversations;

            saveCache(
              usersRef.current,
              updatedConversations,
              messagesCache.current
            );
          }
        }
      } catch (error) {
        console.warn("Unable to refresh conversations:", error);
      } finally {
        if (mountedRef.current) setLoadingUsers(false);
      }
    },
    [router, saveCache]
  );

  const fetchDataRef = useRef(fetchData);

  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = setTimeout(() => {
      fetchDataRef.current(true);
    }, 250);
  }, []);

  useEffect(() => {
    if (!isClient) return undefined;

    fetchDataRef.current(false);

    // Fallback in case a socket event is missed.
    const interval = setInterval(() => {
      fetchDataRef.current(true);
    }, 15000);

    return () => {
      clearInterval(interval);

      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [isClient]);

  /* ==========================================================
     CONVERSATION HELPERS
  ========================================================== */

  const findConversationForUser = useCallback(
    (userId, list = conversationsRef.current) => {
      if (!userId) return null;

      return (
        list.find((conversation) => {
          if (conversation?.isGroup) return false;

          const participants = Array.isArray(
            conversation?.participants
          )
            ? conversation.participants
            : [];

          return participants.some((participant) => {
            return (
              String(getId(participant) || "") ===
              String(userId)
            );
          });
        }) || null
      );
    },
    []
  );

  /* ==========================================================
     LOAD MESSAGES
  ========================================================== */

  const fetchMessages = useCallback(
    async (conversationId, silent = false) => {
      if (!conversationId) return [];

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

        const data = await parseResponse(response);

        if (!response.ok) {
          throw new Error(
            data?.message || "Failed to load messages."
          );
        }

        const fetchedMessages = extractMessages(data).map(
          (item) => normalizeMessage(item, conversationId)
        );

        // Do not replace the chat if the user has switched conversations
        // while this request was still in progress.
        if (
          String(selectedConversationIdRef.current || "") !==
          String(conversationId)
        ) {
          return fetchedMessages;
        }

        // Preserve optimistic messages while merging server messages.
        setMessages((previous) => {
          const temporaryMessages = previous.filter((item) =>
            String(getMessageId(item) || "").startsWith("temp-")
          );

          const merged = [...fetchedMessages];

          temporaryMessages.forEach((temp) => {
            const body = getMessageBody(temp);
            const alreadyPresent = merged.some(
              (serverMessage) =>
                getMessageBody(serverMessage) === body &&
                String(getSenderId(serverMessage) || "") ===
                  String(getSenderId(temp) || "")
            );

            if (!alreadyPresent) merged.push(temp);
          });

          merged.sort((a, b) => {
            const first = new Date(a?.createdAt || 0).getTime();
            const second = new Date(b?.createdAt || 0).getTime();
            return first - second;
          });

          messagesCache.current[conversationId] = merged;

          saveCache(
            usersRef.current,
            conversationsRef.current,
            messagesCache.current
          );

          return merged;
        });

        return fetchedMessages;
      } catch (error) {
        if (!silent) {
          setMessagesError(
            error?.message || "Unable to load messages."
          );
        }

        return [];
      } finally {
        if (!silent) setLoadingMessages(false);
      }
    },
    [saveCache]
  );

  /* ==========================================================
     MARK READ
  ========================================================== */

  const markConversationRead = useCallback(
    async (conversationId) => {
      if (!conversationId) return;

      try {
        await fetch(
          getApiUrl(`/conversations/${conversationId}/read`),
          {
            method: "PUT",
            credentials: "include",
            headers: getAuthHeaders(),
          }
        );
      } catch (error) {
        console.warn("Unable to mark conversation as read:", error);
      }

      setConversations((previous) => {
        const updated = previous.map((conversation) => {
          if (
            String(getConversationId(conversation)) !==
            String(conversationId)
          ) {
            return conversation;
          }

          return {
            ...conversation,
            unreadCount: 0,
            unreadMessages: 0,
            unread: 0,
            unreadMessageCount: 0,
          };
        });

        conversationsRef.current = updated;

        saveCache(
          usersRef.current,
          updated,
          messagesCache.current
        );

        return updated;
      });
    },
    [saveCache]
  );

  /* ==========================================================
     OPEN CONVERSATION
  ========================================================== */

  const openConversation = useCallback(
    async (conversation, user = null) => {
      const conversationId = getConversationId(conversation);
      if (!conversationId) return;

      const previousId = selectedConversationIdRef.current;

      if (
        previousId &&
        String(previousId) !== String(conversationId) &&
        socketRef.current?.connected
      ) {
        socketRef.current.emit("leave_room", previousId);
      }

      selectedConversationIdRef.current = conversationId;
      setSelectedConversationId(conversationId);
      setSelectedConversation(conversation);

      if (user) {
        setSelectedUser(user);
      } else if (conversation?.isGroup) {
        setSelectedUser({
          name: conversation.groupName || "Team Group",
          role: "Group Chat",
          isGroup: true,
        });
      } else {
        const participants = conversation?.participants || [];
        const otherUser = participants.find(
          (participant) =>
            String(getId(participant) || "") !==
            String(conversation?.adminId || "")
        );

        if (otherUser) setSelectedUser(otherUser);
      }

      setMessagesError("");
      setSelectedFiles([]);

      setConversations((previous) => {
        const updated = previous.map((item) => {
          if (
            String(getConversationId(item)) !==
            String(conversationId)
          ) {
            return item;
          }

          return {
            ...item,
            unreadCount: 0,
            unreadMessages: 0,
            unread: 0,
            unreadMessageCount: 0,
          };
        });

        conversationsRef.current = updated;

        saveCache(
          usersRef.current,
          updated,
          messagesCache.current
        );

        return updated;
      });

      const cached = messagesCache.current[conversationId];

      if (Array.isArray(cached)) {
        setMessages(cached);
        setLoadingMessages(false);
      } else {
        setMessages([]);
        setLoadingMessages(true);
      }

      if (socketRef.current?.connected) {
        socketRef.current.emit("join_room", conversationId);
      }

      await fetchMessages(conversationId, false);
      await markConversationRead(conversationId);
    },
    [fetchMessages, markConversationRead, saveCache]
  );

  /* ==========================================================
     START / OPEN DIRECT CHAT
  ========================================================== */

  const handleSelectUser = useCallback(
    async (user) => {
      const userId = getId(user);
      if (!userId) return;

      setSelectedUser(user);
      setMessagesError("");

      const existing = findConversationForUser(
        userId,
        conversationsRef.current
      );

      if (existing) {
        await openConversation(existing, user);
        return;
      }

      setStartingConversation(true);

      try {
        const response = await fetch(
          getApiUrl("/conversations"),
          {
            method: "POST",
            credentials: "include",
            headers: getAuthHeaders(),
            body: JSON.stringify({ recipientId: userId }),
          }
        );

        const data = await parseResponse(response);

        if (!response.ok) {
          throw new Error(
            data?.message || "Failed to start conversation."
          );
        }

        const newConversation =
          data?.conversation ||
          data?.data?.conversation ||
          data?.data ||
          data;

        const newId = getConversationId(newConversation);

        if (!newId) {
          throw new Error(
            "The server did not return a conversation ID."
          );
        }

        setConversations((previous) => {
          const exists = previous.some(
            (item) =>
              String(getConversationId(item)) === String(newId)
          );

          const updated = exists
            ? previous
            : [newConversation, ...previous];

          conversationsRef.current = updated;

          saveCache(
            usersRef.current,
            updated,
            messagesCache.current
          );

          return updated;
        });

        await openConversation(newConversation, user);
      } catch (error) {
        setMessagesError(
          error?.message || "Failed to start conversation."
        );
      } finally {
        setStartingConversation(false);
      }
    },
    [findConversationForUser, openConversation, saveCache]
  );

  /* ==========================================================
     SOCKET.IO REALTIME
  ========================================================== */

  useEffect(() => {
    if (!isClient) return undefined;

    const token = getStoredToken();

    const socket = io(BACKEND_BASE_URL, {
      auth: token ? { token } : {},
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    const handleConnect = () => {
      setSocketConnected(true);

      const activeId = selectedConversationIdRef.current;

      // Rejoin the active room after reconnecting.
      if (activeId) {
        socket.emit("join_room", activeId);
      }

      scheduleRefresh();
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
    };

    const handleConnectError = (error) => {
      setSocketConnected(false);
      console.warn("Chat socket connection error:", error?.message);
    };

    const handleUserStatus = (payload = {}) => {
      const userId =
        payload.userId ||
        payload._id ||
        payload.id;

      const status = payload.status;

      if (!userId || !status) return;

      setOnlineUsers((previous) => ({
        ...previous,
        [String(userId)]: status,
      }));
    };

    const handleIncomingMessage = (payload) => {
      const rawMessage = unwrapSocketMessage(payload);

      if (!rawMessage) {
        // Notification events sometimes contain only metadata.
        scheduleRefresh();
        return;
      }

      const conversationId = getConversationIdFromMessage(
        rawMessage
      );

      if (!conversationId) {
        console.warn(
          "Socket message has no conversation ID:",
          payload
        );
        scheduleRefresh();
        return;
      }

      const conversationKey = String(conversationId);
      const incoming = normalizeMessage(
        rawMessage,
        conversationId
      );

      const incomingId = String(getMessageId(incoming) || "");

      // Same DB message can arrive through receive_message and new_message.
      if (incomingId) {
        if (processedSocketMessages.current.has(incomingId)) {
          return;
        }

        processedSocketMessages.current.add(incomingId);

        if (processedSocketMessages.current.size > 1500) {
          const firstId =
            processedSocketMessages.current.values().next().value;

          processedSocketMessages.current.delete(firstId);
        }
      }

      const sender = incoming.sender;
      const senderRole = String(
        sender?.role || ""
      ).toLowerCase();

      const isAdminMessage =
        senderRole === "admin" ||
        sender?.name === "You";

      const activeId = String(
        selectedConversationIdRef.current || ""
      );

      const isActive = activeId === conversationKey;

      if (isActive) {
        setMessages((previous) => {
          const incomingBody = getMessageBody(incoming);
          const incomingSenderId = String(
            getSenderId(incoming) || ""
          );

          const existingIndex = previous.findIndex((item) => {
            const existingId = String(
              getMessageId(item) || ""
            );

            if (incomingId && existingId === incomingId) {
              return true;
            }

            // Reconcile an optimistic message with the saved socket copy.
            return (
              existingId.startsWith("temp-") &&
              getMessageBody(item) === incomingBody &&
              String(getSenderId(item) || "") ===
                incomingSenderId &&
              Boolean(incomingId)
            );
          });

          let updated;

          if (existingIndex >= 0) {
            updated = [...previous];
            updated[existingIndex] = {
              ...updated[existingIndex],
              ...incoming,
              status: "sent",
            };
          } else {
            updated = [...previous, incoming];
          }

          updated.sort((a, b) => {
            const first = new Date(a?.createdAt || 0).getTime();
            const second = new Date(b?.createdAt || 0).getTime();
            return first - second;
          });

          messagesCache.current[conversationKey] = updated;

          saveCache(
            usersRef.current,
            conversationsRef.current,
            messagesCache.current
          );

          return updated;
        });
      } else {
        const cached = messagesCache.current[conversationKey];

        if (Array.isArray(cached)) {
          const exists = cached.some(
            (item) =>
              incomingId &&
              String(getMessageId(item) || "") === incomingId
          );

          if (!exists) {
            messagesCache.current[conversationKey] = [
              ...cached,
              incoming,
            ];
          }
        }
      }

      setConversations((previous) => {
        const index = previous.findIndex(
          (conversation) =>
            String(getConversationId(conversation) || "") ===
            conversationKey
        );

        if (index < 0) {
          scheduleRefresh();
          return previous;
        }

        const updated = [...previous];
        const oldConversation = updated[index];
        const previousUnread = getUnreadCount(oldConversation);

        const nextUnread = isActive
          ? 0
          : isAdminMessage
          ? previousUnread
          : previousUnread + 1;

        updated[index] = {
          ...oldConversation,
          lastMessage:
            getMessageBody(incoming) ||
            (incoming.attachments?.length
              ? "Attachment"
              : getConversationLastMessage(oldConversation)),
          lastMessageAt:
            incoming.createdAt || new Date().toISOString(),
          updatedAt:
            incoming.createdAt || new Date().toISOString(),
          unreadCount: nextUnread,
          unreadMessages: nextUnread,
          unread: nextUnread,
          unreadMessageCount: nextUnread,
        };

        // Move the updated conversation to the top of the list.
        const [latestConversation] = updated.splice(index, 1);
        updated.unshift(latestConversation);

        conversationsRef.current = updated;

        saveCache(
          usersRef.current,
          updated,
          messagesCache.current
        );

        return updated;
      });

      if (!isAdminMessage) {
        const shouldNotify =
          !isActive ||
          document.visibilityState !== "visible";

        if (shouldNotify) {
          playMessageNotificationSound();

          showMessageDesktopNotification(
            getUserName(sender),
            getMessageBody(incoming) ||
              "You received a file or attachment."
          );
        }
      }

      if (isActive && !isAdminMessage) {
        markConversationRead(conversationId);
      }

      // Don't rely on a custom server event being implemented.
      scheduleRefresh();
    };

    const handleNotification = (payload) => {
      const possibleMessage = unwrapSocketMessage(payload);

      if (possibleMessage) {
        handleIncomingMessage(possibleMessage);
      } else {
        scheduleRefresh();
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    socket.on("receive_message", handleIncomingMessage);
    socket.on("new_message", handleIncomingMessage);
    socket.on("notification", handleNotification);
    socket.on("message_notification", handleNotification);
    socket.on("update_user_status", handleUserStatus);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);

      socket.off("receive_message", handleIncomingMessage);
      socket.off("new_message", handleIncomingMessage);
      socket.off("notification", handleNotification);
      socket.off("message_notification", handleNotification);
      socket.off("update_user_status", handleUserStatus);

      socket.disconnect();

      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [
    isClient,
    markConversationRead,
    saveCache,
    scheduleRefresh,
  ]);

  /* ==========================================================
     CREATE GROUP
  ========================================================== */

  const handleCreateGroup = async (event) => {
    event.preventDefault();

    if (
      !groupName.trim() ||
      selectedGroupMembers.length === 0
    ) {
      return;
    }

    try {
      setCreatingGroup(true);
      setMessagesError("");

      const response = await fetch(
        getApiUrl("/conversations"),
        {
          method: "POST",
          credentials: "include",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            isGroup: true,
            groupName: groupName.trim(),
            participants: selectedGroupMembers,
          }),
        }
      );

      const data = await parseResponse(response);

      if (!response.ok) {
        throw new Error(
          data?.message || "Failed to create group."
        );
      }

      const group =
        data?.conversation ||
        data?.data?.conversation ||
        data?.data ||
        data;

      if (!getConversationId(group)) {
        throw new Error(
          "The server did not return a group conversation."
        );
      }

      setConversations((previous) => {
        const groupId = String(getConversationId(group));

        const updated = [
          group,
          ...previous.filter(
            (item) =>
              String(getConversationId(item)) !== groupId
          ),
        ];

        conversationsRef.current = updated;

        saveCache(
          usersRef.current,
          updated,
          messagesCache.current
        );

        return updated;
      });

      setShowGroupModal(false);
      setGroupName("");
      setSelectedGroupMembers([]);

      await openConversation(group);
    } catch (error) {
      window.alert(error?.message || "Error creating group.");
    } finally {
      setCreatingGroup(false);
    }
  };

  /* ==========================================================
     SEARCH
  ========================================================== */

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return users;

    return users.filter((user) => {
      const full = `${user?.name || ""} ${
        user?.fullName || ""
      } ${user?.email || ""}`.toLowerCase();

      return full.includes(query);
    });
  }, [users, search]);

  /* ==========================================================
     SEND MESSAGE
  ========================================================== */

  const handleSendMessage = async (event) => {
    event?.preventDefault();

    const cleanBody = message.trim();
    const conversationId = selectedConversationId;
    const recipientId = getId(selectedUser);
    const filesToSend = [...selectedFiles];

    if (
      (!cleanBody && filesToSend.length === 0) ||
      !conversationId ||
      !selectedUser ||
      sendingMessage
    ) {
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const optimisticMessage = {
      _id: tempId,
      id: tempId,
      conversationId,
      body: cleanBody,
      sender: {
        role: "admin",
        name: "You",
      },
      createdAt: new Date().toISOString(),
      attachments: filesToSend.map((file) => ({
        filename: file.name,
        originalName: file.name,
        mimeType: file.type,
        url: URL.createObjectURL(file),
        isLocalPreview: true,
      })),
      status: "sending",
    };

    setSendingMessage(true);
    setMessagesError("");
    setMessage("");
    setSelectedFiles([]);

    setMessages((previous) => {
      const updated = [...previous, optimisticMessage];

      messagesCache.current[conversationId] = updated;

      saveCache(
        usersRef.current,
        conversationsRef.current,
        messagesCache.current
      );

      return updated;
    });

    scrollToBottom(true);

    try {
      let response;

      // The message controller supports conversationId, recipientId,
      // body/message/content and attachments. Keep file requests multipart.
      if (filesToSend.length > 0) {
        const formData = new FormData();

        formData.append("conversationId", String(conversationId));
        formData.append("body", cleanBody);

        if (recipientId) {
          formData.append("recipientId", String(recipientId));
        }

        filesToSend.forEach((file) => {
          formData.append("files", file);
        });

        response = await fetch(getApiUrl("/messages"), {
          method: "POST",
          credentials: "include",
          headers: getAuthHeaders(false),
          body: formData,
        });
      } else {
        response = await fetch(getApiUrl("/messages"), {
          method: "POST",
          credentials: "include",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            conversationId,
            recipientId,
            body: cleanBody,
            messageType: "text",
          }),
        });
      }

      const data = await parseResponse(response);

      if (!response.ok || data?.success === false) {
        throw new Error(
          data?.message || "Failed to send message."
        );
      }

      // messageController can return { data, messageData }.
      const confirmedRaw =
        data?.messageData ||
        data?.data?.messageData ||
        (typeof data?.data?.message === "object"
          ? data.data.message
          : null) ||
        (typeof data?.message === "object"
          ? data.message
          : null) ||
        (data?.data && typeof data.data === "object"
          ? data.data
          : null);

      if (confirmedRaw && typeof confirmedRaw === "object") {
        const confirmed = normalizeMessage(
          confirmedRaw,
          conversationId
        );

        const confirmedId = String(
          getMessageId(confirmed) || ""
        );

        if (confirmedId) {
          processedSocketMessages.current.add(confirmedId);
        }

        setMessages((previous) => {
          const updated = [...previous];
          const tempIndex = updated.findIndex(
            (item) =>
              String(getMessageId(item) || "") === tempId
          );

          const confirmedIndex = updated.findIndex(
            (item) =>
              confirmedId &&
              String(getMessageId(item) || "") === confirmedId
          );

          if (tempIndex >= 0) {
            updated[tempIndex] = {
              ...confirmed,
              status: "sent",
            };
          } else if (confirmedIndex >= 0) {
            updated[confirmedIndex] = {
              ...confirmed,
              status: "sent",
            };
          } else {
            updated.push({ ...confirmed, status: "sent" });
          }

          const sorted = updated.sort((a, b) => {
            const first = new Date(a?.createdAt || 0).getTime();
            const second = new Date(b?.createdAt || 0).getTime();
            return first - second;
          });

          messagesCache.current[conversationId] = sorted;

          saveCache(
            usersRef.current,
            conversationsRef.current,
            messagesCache.current
          );

          return sorted;
        });
      } else {
        // No message object in response: reload the authoritative history.
        await fetchMessages(conversationId, true);
      }

      // Update the conversation preview and server-side unread state.
      scheduleRefresh();
    } catch (error) {
      setMessagesError(
        `Message failed: ${error?.message || "Please try again."}`
      );

      setMessages((previous) => {
        const updated = previous.filter(
          (item) =>
            String(getMessageId(item) || "") !== tempId
        );

        messagesCache.current[conversationId] = updated;
        return updated;
      });

      // Restore the typed content and files if the send failed.
      setMessage(cleanBody);
      setSelectedFiles(filesToSend);
    } finally {
      setSendingMessage(false);
    }
  };

  /* ==========================================================
     DELETE CONVERSATION
  ========================================================== */

  const handleDeleteConversation = async () => {
    if (!selectedConversationId) return;

    if (
      !window.confirm(
        "Are you sure you want to delete this conversation?"
      )
    ) {
      return;
    }

    try {
      const deletedId = selectedConversationId;

      const response = await fetch(
        getApiUrl(`/conversations/${deletedId}`),
        {
          method: "DELETE",
          credentials: "include",
          headers: getAuthHeaders(),
        }
      );

      const data = await parseResponse(response);

      if (!response.ok) {
        throw new Error(
          data?.message || "Failed to delete conversation."
        );
      }

      if (socketRef.current?.connected) {
        socketRef.current.emit("leave_room", deletedId);
      }

      setConversations((previous) => {
        const updated = previous.filter(
          (item) =>
            String(getConversationId(item)) !==
            String(deletedId)
        );

        conversationsRef.current = updated;

        saveCache(
          usersRef.current,
          updated,
          messagesCache.current
        );

        return updated;
      });

      delete messagesCache.current[deletedId];

      selectedConversationIdRef.current = null;

      setSelectedConversationId(null);
      setSelectedConversation(null);
      setSelectedUser(null);
      setMessages([]);
      setMessagesError("");

      saveCache(
        usersRef.current,
        conversationsRef.current,
        messagesCache.current
      );
    } catch (error) {
      setMessagesError(
        error?.message || "Could not delete conversation."
      );
    }
  };

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#f7f8fc] text-slate-950">
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <section className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-white lg:flex-row">
          {/* SIDEBAR */}
          <aside className="flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-slate-100 lg:w-[360px] lg:border-b-0 lg:border-r">
            <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 p-4 sm:p-5">
              <div className="mb-3.5 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Chats & Teams
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Direct messages & groups
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    title={
                      socketConnected
                        ? "Realtime connected"
                        : "Connecting to realtime chat"
                    }
                    className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                      socketConnected
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {socketConnected ? (
                      <Wifi size={15} />
                    ) : (
                      <WifiOff size={15} />
                    )}
                  </span>

                  <button
                    type="button"
                    onClick={() => setShowGroupModal(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    <Plus size={15} />
                    New Group
                  </button>
                </div>
              </div>

              {conversations.some((item) => item.isGroup) && (
                <div className="mb-3 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Groups
                  </p>

                  {conversations
                    .filter((item) => item.isGroup)
                    .map((group) => {
                      const groupId = getConversationId(group);
                      const isSelected =
                        String(selectedConversationId) ===
                        String(groupId);
                      const unread = getUnreadCount(group);

                      return (
                        <button
                          key={groupId}
                          type="button"
                          onClick={() => openConversation(group)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                            isSelected
                              ? "bg-blue-50 text-blue-700"
                              : "text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
                            <Users size={16} />
                            {unread > 0 && !isSelected && (
                              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] text-white">
                                {unread > 99 ? "99+" : unread}
                              </span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold">
                              {group.groupName || "Team Group"}
                            </p>
                            <p className="truncate text-[11px] text-slate-400">
                              {getConversationLastMessage(group) ||
                                "Group chat"}
                            </p>
                          </div>

                          <span className="shrink-0 text-[10px] text-slate-400">
                            {formatConversationTime(
                              getConversationLastDate(group)
                            )}
                          </span>
                        </button>
                      );
                    })}
                </div>
              )}

              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search contacts..."
                  className="h-10 w-full rounded-2xl border border-slate-200/90 bg-white pl-9 pr-3 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {loadingUsers && users.length === 0 ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center p-6 text-center">
                  <Loader2
                    size={26}
                    className="animate-spin text-[#2563EB]"
                  />
                  <p className="mt-3 text-xs font-semibold text-slate-400">
                    Loading contacts...
                  </p>
                </div>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const userId = getId(user);
                  const isSelected =
                    String(getId(selectedUser) || "") ===
                    String(userId || "");

                  const existingConversation =
                    findConversationForUser(
                      userId,
                      conversations
                    );

                  const unread = getUnreadCount(
                    existingConversation
                  );

                  const isOnline =
                    onlineUsers[String(userId)] === "online" ||
                    user.status === "active";

                  return (
                    <button
                      key={userId}
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className={`flex w-full items-start gap-3 border-b border-slate-100/80 px-4 py-3.5 text-left transition duration-150 ${
                        isSelected
                          ? "border-blue-200/60 bg-blue-50/70"
                          : "hover:bg-slate-50/80"
                      }`}
                    >
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#2563EB] text-xs font-bold text-white shadow-sm">
                        {getInitials(getUserName(user))}

                        <span
                          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                            isOnline
                              ? "bg-emerald-500"
                              : "bg-slate-300"
                          }`}
                        />

                        {unread > 0 && !isSelected && (
                          <span className="absolute -right-1.5 -top-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2563EB] px-1.5 text-[10px] font-extrabold leading-none text-white shadow-md ring-2 ring-white">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-bold text-slate-900">
                            {getUserName(user)}
                          </p>

                          {existingConversation && (
                            <span className="shrink-0 text-[10px] text-slate-400">
                              {formatConversationTime(
                                getConversationLastDate(
                                  existingConversation
                                )
                              )}
                            </span>
                          )}
                        </div>

                        <p className="mt-1 truncate text-xs text-slate-500">
                          {getConversationLastMessage(
                            existingConversation
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
          </aside>

          {/* CHAT PANEL */}
          <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-50/20">
            <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#2563EB] text-xs font-bold text-white shadow-md">
                  {selectedUser ? (
                    getInitials(getUserName(selectedUser))
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

                  <p className="truncate text-xs font-semibold text-[#2563EB]">
                    {selectedUser
                      ? getRole(selectedUser) || "Active Member"
                      : "Choose from list"}
                  </p>
                </div>
              </div>

              {selectedConversationId && (
                <button
                  type="button"
                  onClick={handleDeleteConversation}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                  title="Delete Conversation"
                  aria-label="Delete conversation"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </header>

            {/* MESSAGE LIST */}
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6">
              {messagesError && (
                <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <p>{messagesError}</p>
                  <button
                    type="button"
                    onClick={() => setMessagesError("")}
                    aria-label="Dismiss error"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {startingConversation ? (
                <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                  <Loader2
                    size={28}
                    className="animate-spin text-[#2563EB]"
                  />
                  <p className="mt-2 text-xs font-semibold text-slate-400">
                    Opening conversation...
                  </p>
                </div>
              ) : !selectedUser ? (
                <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#2563EB]">
                    <MessageSquare size={26} />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-slate-900">
                    No contact selected
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Pick a team member from the left list to review chat
                    histories.
                  </p>
                </div>
              ) : loadingMessages && messages.length === 0 ? (
                <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                  <Loader2
                    size={24}
                    className="animate-spin text-[#2563EB]"
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    Loading messages...
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
                    const isDeleted = Boolean(
                      item?.isDeletedForEveryone
                    );

                    const body = isDeleted
                      ? "This message was deleted"
                      : getMessageBody(item);

                    const senderRole = String(
                      sender?.role || ""
                    ).toLowerCase();

                    const isAdmin =
                      senderRole === "admin" ||
                      sender?.name === "You";

                    const attachments = Array.isArray(
                      item?.attachments
                    )
                      ? item.attachments
                      : [];

                    return (
                      <div
                        key={getMessageId(item) || index}
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
                              ? "rounded-tr-sm bg-[#2563EB] text-white shadow-blue-600/15"
                              : "rounded-tl-sm border border-slate-100 bg-white text-slate-800 shadow-[0_4px_20px_rgba(45,35,100,0.03)]"
                          }`}
                        >
                          {!isAdmin && !isDeleted && (
                            <p className="mb-1 text-[10px] font-bold text-[#2563EB]">
                              {getUserName(sender)}
                            </p>
                          )}

                          {attachments.length > 0 && (
                            <div className="mb-2 flex flex-col gap-2">
                              {attachments.map(
                                (attachment, attachmentIndex) => {
                                  const rawUrl =
                                    attachment.url ||
                                    attachment.path ||
                                    attachment.filePath ||
                                    attachment.fileUrl ||
                                    attachment.filename;

                                  const fileUrl = getFileUrl(rawUrl);

                                  const mimeType =
                                    attachment.mimeType ||
                                    attachment.type ||
                                    "";

                                  const isImage =
                                    mimeType.startsWith("image/") ||
                                    /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(
                                      fileUrl
                                    );

                                  const filename =
                                    attachment.originalName ||
                                    attachment.filename ||
                                    "Download File";

                                  if (isImage) {
                                    return (
                                      <a
                                        key={attachmentIndex}
                                        href={fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block overflow-hidden rounded-xl border border-white/20 bg-black/10"
                                      >
                                        <img
                                          src={fileUrl}
                                          alt={filename}
                                          loading="lazy"
                                          className="max-h-60 w-full object-cover transition hover:opacity-95"
                                        />
                                      </a>
                                    );
                                  }

                                  return (
                                    <a
                                      key={attachmentIndex}
                                      href={fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download={filename}
                                      className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-semibold ${
                                        isAdmin
                                          ? "bg-white/10 text-white hover:bg-white/20"
                                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                      }`}
                                    >
                                      <FileText size={16} />
                                      <span className="truncate">
                                        {filename}
                                      </span>
                                    </a>
                                  );
                                }
                              )}
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
                                ? "text-blue-200"
                                : "text-slate-400"
                            }`}
                          >
                            {formatMessageTime(item?.createdAt)}
                            {item?.status === "sending"
                              ? " · Sending..."
                              : ""}
                            {item?.status === "sent" && isAdmin
                              ? " · Sent"
                              : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* COMPOSER */}
            <div className="shrink-0 border-t border-slate-100 bg-white p-4 sm:p-5">
              {selectedFiles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-1.5 text-xs text-blue-800"
                    >
                      <span className="max-w-[150px] truncate font-semibold">
                        {file.name}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedFiles((previous) =>
                            previous.filter((_, i) => i !== index)
                          )
                        }
                        className="text-blue-400 hover:text-rose-600"
                        aria-label={`Remove ${file.name}`}
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
                  onChange={(event) => {
                    const newFiles = Array.from(
                      event.target.files || []
                    );

                    setSelectedFiles((previous) => {
                      const combined = [...previous, ...newFiles];
                      const seen = new Set();

                      return combined.filter((file) => {
                        const key = [
                          file.name,
                          file.size,
                          file.lastModified,
                        ].join(":");

                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                      });
                    });

                    event.target.value = "";
                  }}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!selectedUser || sendingMessage}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-slate-50/50 text-slate-500 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#2563EB] disabled:opacity-40"
                  aria-label="Attach files"
                >
                  <Paperclip size={18} />
                </button>

                <div className="min-w-0 flex-1">
                  <textarea
                    value={message}
                    onChange={(event) =>
                      setMessage(event.target.value)
                    }
                    placeholder={
                      selectedUser
                        ? "Write a message..."
                        : "Select user first..."
                    }
                    rows={1}
                    disabled={!selectedUser || sendingMessage}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        handleSendMessage(event);
                      }
                    }}
                    className="min-h-11 max-h-32 w-full resize-y rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 py-3 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#2563EB] focus:bg-white focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60"
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    !selectedUser ||
                    sendingMessage ||
                    (!message.trim() && selectedFiles.length === 0)
                  }
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2563EB] text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
                  aria-label="Send message"
                >
                  {sendingMessage ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Send size={17} />
                  )}
                </button>
              </form>

              <p className="mt-2 text-[10px] text-slate-400">
                Enter to send · Shift + Enter for a new line
              </p>
            </div>
          </main>
        </section>
      </div>

      {/* CREATE GROUP MODAL */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-4">
              <h3 className="text-base font-bold text-slate-900">
                Create Team Group
              </h3>

              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close group modal"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleCreateGroup}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Group Name
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(event) =>
                    setGroupName(event.target.value)
                  }
                  placeholder="e.g. Weekend Escape, Dev Team"
                  required
                  className="mt-1 h-10 w-full rounded-xl border px-3 text-xs outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Select Members
                </label>

                <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border p-2">
                  {users.map((user) => {
                    const userId = getId(user);
                    if (!userId) return null;

                    const id = String(userId);
                    const checked =
                      selectedGroupMembers.some(
                        (memberId) => String(memberId) === id
                      );

                    return (
                      <label
                        key={id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setSelectedGroupMembers((previous) =>
                                previous.some(
                                  (memberId) =>
                                    String(memberId) === id
                                )
                                  ? previous
                                  : [...previous, userId]
                              );
                            } else {
                              setSelectedGroupMembers((previous) =>
                                previous.filter(
                                  (memberId) =>
                                    String(memberId) !== id
                                )
                              );
                            }
                          }}
                        />

                        <span className="font-semibold text-slate-800">
                          {getUserName(user)}
                        </span>

                        <span className="text-[10px] text-slate-400">
                          ({user.role || "user"})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  className="rounded-xl border px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    creatingGroup ||
                    !groupName.trim() ||
                    selectedGroupMembers.length === 0
                  }
                  className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {creatingGroup ? "Creating..." : "Create Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}