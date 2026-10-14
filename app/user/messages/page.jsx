"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  File,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Search,
  Send,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { io } from "socket.io-client";
import { authService } from "@/services/authService";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.localpro1.net/api"
)
  .trim()
  .replace(/\/+$/, "");

const BACKEND_BASE_URL = API_URL.endsWith("/api")
  ? API_URL.slice(0, -4)
  : API_URL;

const DEFAULT_CONVERSATION_ID = "admin-default-chat";

const DEFAULT_CONVERSATION = {
  id: DEFAULT_CONVERSATION_ID,
  _id: DEFAULT_CONVERSATION_ID,
  participants: [
    {
      name: "Admin / Support",
      role: "admin",
      email: "admin@localpro1.net",
    },
  ],
  lastMessage: "Welcome to support chat",
  updatedAt: new Date().toISOString(),
};

/* -------------------- Helpers -------------------- */

function getStoredToken() {
  if (typeof window === "undefined") return "";

  try {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("token") ||
      ""
    );
  } catch {
    return "";
  }
}

function getFileUrl(url) {
  if (!url) return "#";

  if (/^(https?:\/\/|blob:|data:)/i.test(url)) {
    return url;
  }

  return `${BACKEND_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function getUserId(user) {
  if (!user) return null;

  if (
    typeof user === "string" ||
    typeof user === "number"
  ) {
    return String(user);
  }

  return (
    user._id ||
    user.id ||
    user.userId ||
    user.user?._id ||
    user.user?.id ||
    null
  );
}

function getConversationId(conversation) {
  const id =
    conversation?._id ||
    conversation?.id ||
    conversation?.conversationId ||
    conversation?.conversation?._id;

  return id ? String(id) : null;
}

function getMessageConversationId(message) {
  const value =
    message?.conversationId ??
    message?.conversation ??
    message?.conversation_id ??
    message?.chatId;

  if (value && typeof value === "object") {
    const id =
      value._id ||
      value.id ||
      value.conversationId;

    return id ? String(id) : null;
  }

  return value ? String(value) : null;
}

function getMessageId(message) {
  const id =
    message?._id ||
    message?.id ||
    message?.messageId;

  return id ? String(id) : "";
}

function getMessageText(message) {
  return (
    message?.body ||
    message?.message ||
    (message?.attachments?.length ? "Attachment" : "")
  );
}

function getOtherParticipant(conversation, currentUser) {
  const participants = Array.isArray(conversation?.participants)
    ? conversation.participants
    : [];

  const currentId = getUserId(currentUser);

  const others = participants.filter((participant) => {
    const participantId = getUserId(participant);

    return !(
      currentId &&
      participantId &&
      String(currentId) === String(participantId)
    );
  });

  return (
    others.find((participant) =>
      ["admin", "manager", "support"].includes(
        String(participant?.role || "").toLowerCase()
      )
    ) ||
    others[0] ||
    conversation?.admin ||
    conversation?.support ||
    { name: "Admin / Support", role: "admin" }
  );
}

function getParticipantName(conversation, currentUser) {
  const participant = getOtherParticipant(
    conversation,
    currentUser
  );

  return (
    participant?.name ||
    participant?.fullName ||
    participant?.displayName ||
    participant?.username ||
    participant?.email ||
    conversation?.name ||
    "Admin / Support"
  );
}

function getParticipantEmail(conversation, currentUser) {
  return (
    getOtherParticipant(conversation, currentUser)?.email ||
    conversation?.email ||
    ""
  );
}

function getParticipantRole(conversation, currentUser) {
  return (
    getOtherParticipant(conversation, currentUser)?.role ||
    conversation?.role ||
    "admin"
  );
}

function getParticipantAvatar(conversation, currentUser) {
  const participant = getOtherParticipant(
    conversation,
    currentUser
  );

  return (
    participant?.avatar ||
    participant?.profileImage ||
    participant?.image ||
    ""
  );
}

function normalizeConversations(response) {
  const value =
    response?.conversations ??
    response?.data?.conversations ??
    response?.results ??
    response?.data;

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return value && typeof value === "object"
    ? [value]
    : [];
}

function normalizeMessages(response) {
  const value =
    response?.messages ??
    response?.data?.messages ??
    response?.results ??
    response?.data;

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return value && typeof value === "object"
    ? [value]
    : [];
}

function mergeMessages(existing = [], incoming = []) {
  const output = [...existing];

  for (const message of incoming) {
    const id = getMessageId(message);

    let index = id
      ? output.findIndex(
          (item) => getMessageId(item) === id
        )
      : -1;

    // Reconcile the optimistic message with its saved version.
    if (index < 0 && id && !id.startsWith("temp-")) {
      index = output.findIndex((item) => {
        if (!getMessageId(item).startsWith("temp-")) {
          return false;
        }

        const sameSender =
          String(getUserId(item?.sender) || "") ===
          String(getUserId(message?.sender) || "");

        const sameText =
          getMessageText(item) === getMessageText(message);

        const delta = Math.abs(
          new Date(item?.createdAt || 0).getTime() -
            new Date(message?.createdAt || 0).getTime()
        );

        return sameSender && sameText && delta < 15000;
      });
    }

    if (index >= 0) {
      output[index] = {
        ...output[index],
        ...message,
        sending: false,
      };
    } else {
      output.push(message);
    }
  }

  return output.sort(
    (a, b) =>
      new Date(a?.createdAt || a?.sentAt || 0).getTime() -
      new Date(b?.createdAt || b?.sentAt || 0).getTime()
  );
}

function getInitials(name) {
  return (
    String(name || "A")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "A"
  );
}

function extractUser(response) {
  return (
    response?.user ||
    response?.data?.user ||
    response?.data ||
    response ||
    null
  );
}

function formatDateTime(date) {
  if (!date) return "";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "";

  return parsedDate.toDateString() === new Date().toDateString()
    ? parsedDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : parsedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
}

function formatTime(date) {
  if (!date) return "";

  const parsedDate = new Date(date);

  return Number.isNaN(parsedDate.getTime())
    ? ""
    : parsedDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
}

async function apiRequest(endpoint, options = {}) {
  const token = getStoredToken();

  const isForm =
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  const headers = {
    Accept: "application/json",
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
    ...(isForm || !options.body
      ? {}
      : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    cache: "no-store",
    headers,
  });

  let data = null;

  try {
    const text = await response.text();

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }
  } catch {
    // Ignore response parsing errors.
  }

  if (!response.ok) {
    const error = new Error(
      data?.message ||
        data?.error ||
        `Request failed (${response.status})`
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

async function safeApiRequest(endpoint) {
  try {
    return await apiRequest(endpoint);
  } catch (error) {
    if (error?.status === 401) throw error;
    return null;
  }
}

// Matches the GET /:conversationId route in messageRoutes.js.
async function getConversationMessages(id) {
  if (!id || id === DEFAULT_CONVERSATION_ID) {
    return { messages: [] };
  }

  return apiRequest(
    `/messages/${encodeURIComponent(id)}`
  );
}

async function markConversationRead(id) {
  if (!id || id === DEFAULT_CONVERSATION_ID) return;

  // Keep the endpoint already used by the existing application.
  return apiRequest(
    `/conversations/${encodeURIComponent(id)}/read`,
    { method: "PUT" }
  );
}

/* -------------------- Notifications -------------------- */

function playNotificationSound(audioRef) {
  try {
    if (typeof window === "undefined") return;

    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) return;

    if (!audioRef.current) {
      audioRef.current = new AudioContextClass();
    }

    const context = audioRef.current;

    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(
      880,
      context.currentTime
    );

    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.08,
      context.currentTime + 0.02
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + 0.2
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + 0.21);
  } catch {
    // Browser may block notification sound.
  }
}

function showDesktopNotification(title, body) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  try {
    const notification = new Notification(
      title || "New message",
      {
        body: body || "You received a message.",
        icon: "/favicon.ico",
        tag: `localpro-chat-${Date.now()}`,
      }
    );

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Browser may block desktop notifications.
  }
}

/* -------------------- Main Component -------------------- */

export default function UserMessagesPage() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] =
    useState(null);
  const [messages, setMessages] = useState([]);

  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);

  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [messagesError, setMessagesError] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);

  const [notificationPermission, setNotificationPermission] =
    useState(() => {
      if (typeof window === "undefined") return "default";

      return "Notification" in window
        ? Notification.permission
        : "unsupported";
    });

  const [currentUser, setCurrentUser] = useState(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [deletingMessage, setDeletingMessage] = useState(false);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  const selectedConversationIdRef = useRef(null);
  const currentUserRef = useRef(null);
  const conversationsRef = useRef([]);
  const messagesCache = useRef({});
  const loadMessagesRequestRef = useRef(0);
  const conversationsRequestRef = useRef(false);
  const processedMessageIdsRef = useRef(new Set());
  const notificationAudioRef = useRef(null);
  const pollingBusyRef = useRef(false);
  const sendingRef = useRef(false);

  const selectedConversationId =
    getConversationId(selectedConversation);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    selectedConversationIdRef.current =
      selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    if (messages.length) {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [messages]);

  const scrollToBottom = useCallback((instant = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: instant ? "auto" : "smooth",
      block: "end",
    });
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window)
    ) {
      setNotificationPermission("unsupported");
      return;
    }

    try {
      const permission =
        await Notification.requestPermission();

      setNotificationPermission(permission);
    } catch {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const loadConversations = useCallback(
    async (silent = false) => {
      if (conversationsRequestRef.current) return;

      conversationsRequestRef.current = true;

      try {
        if (!silent) setError("");

        let user = currentUserRef.current;
        let response;

        if (!user) {
          const [me, chats] = await Promise.all([
            authService.me().catch(() => null),
            safeApiRequest("/conversations"),
          ]);

          user = extractUser(me);
          response = chats;

          if (user) {
            currentUserRef.current = user;
            setCurrentUser(user);

            try {
              localStorage.setItem(
                "user",
                JSON.stringify(user)
              );
            } catch {
              // Ignore storage errors.
            }
          }
        } else {
          response = await safeApiRequest("/conversations");
        }

        if (!response) {
          response = await safeApiRequest(
            "/messages/conversations"
          );
        }

        const list = normalizeConversations(response).filter(
          (conversation) =>
            Boolean(getConversationId(conversation))
        );

        // Do not pretend a fake local conversation is a real DB chat.
        const finalList = list;

        conversationsRef.current = finalList;
        setConversations(finalList);

        try {
          localStorage.setItem(
            "cached_user_admin_chats",
            JSON.stringify(finalList)
          );
        } catch {
          // Ignore storage errors.
        }

        setSelectedConversation((previous) => {
          const previousId = getConversationId(previous);

          if (previousId) {
            const stillExists = finalList.find(
              (item) =>
                getConversationId(item) === previousId
            );

            if (stillExists) return stillExists;
          }

          return finalList[0] || null;
        });
      } catch (err) {
        console.error("Load conversations error:", err);

        if (err?.status === 401) {
          window.location.href = "/login";
          return;
        }

        if (!silent) {
          setError(
            err?.message || "Unable to load conversations."
          );
        }
      } finally {
        conversationsRequestRef.current = false;
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const cachedUser = localStorage.getItem("user");

        if (cachedUser && !cancelled) {
          setCurrentUser(JSON.parse(cachedUser));
        }
      } catch {
        // Ignore cache errors.
      }

      if (!cancelled) {
        await loadConversations(false);
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [loadConversations]);

  const saveConversationMessages = useCallback(
    (id, nextMessages) => {
      if (!id) return;

      messagesCache.current[id] = nextMessages;

      try {
        localStorage.setItem(
          `cached_user_messages_${id}`,
          JSON.stringify(nextMessages)
        );
      } catch {
        // Ignore storage errors.
      }

      if (
        String(selectedConversationIdRef.current) ===
        String(id)
      ) {
        setMessages(nextMessages);
      }
    },
    []
  );

  const loadMessages = useCallback(
    async (id, silent = false) => {
      if (
        !id ||
        id === DEFAULT_CONVERSATION_ID
      ) {
        setMessages([]);
        setMessagesLoading(false);
        setMessagesError("");
        return;
      }

      const requestId = ++loadMessagesRequestRef.current;

      try {
        if (!silent) setMessagesLoading(true);
        setMessagesError("");

        const response = await getConversationMessages(id);

        if (requestId !== loadMessagesRequestRef.current) {
          return;
        }

        const fetched = normalizeMessages(response);
        const cached = messagesCache.current[id] || [];
        const merged = mergeMessages(cached, fetched);

        messagesCache.current[id] = merged;

        if (
          String(selectedConversationIdRef.current) ===
          String(id)
        ) {
          setMessages(merged);
        }

        try {
          localStorage.setItem(
            `cached_user_messages_${id}`,
            JSON.stringify(merged)
          );
        } catch {
          // Ignore storage errors.
        }
      } catch (err) {
        if (requestId !== loadMessagesRequestRef.current) {
          return;
        }

        console.error("Load messages error:", err);

        if (!silent) {
          setMessagesError(
            err?.message || "Unable to load messages."
          );
        }
      } finally {
        if (requestId === loadMessagesRequestRef.current) {
          setMessagesLoading(false);
        }
      }
    },
    []
  );

  const handleIncomingMessage = useCallback(
    (payload) => {
      const incoming =
        payload?.message &&
        typeof payload.message === "object"
          ? payload.message
          : payload?.data?.message &&
              typeof payload.data.message === "object"
            ? payload.data.message
            : payload?.data &&
                typeof payload.data === "object" &&
                (payload.data._id || payload.data.id)
              ? payload.data
              : payload;

      if (!incoming || typeof incoming !== "object") {
        return;
      }

      const id = getMessageId(incoming);
      const conversationId =
        getMessageConversationId(incoming);

      if (!conversationId) {
        // If the server sends a metadata-only event, refresh
        // the active conversation rather than silently losing it.
        const activeId = selectedConversationIdRef.current;

        if (activeId) {
          loadMessages(activeId, true);
        }

        loadConversations(true);
        return;
      }

      if (id && processedMessageIdsRef.current.has(id)) {
        return;
      }

      if (id) {
        processedMessageIdsRef.current.add(id);

        if (processedMessageIdsRef.current.size > 1500) {
          const oldest =
            processedMessageIdsRef.current.values().next().value;

          processedMessageIdsRef.current.delete(oldest);
        }
      }

      const senderId = getUserId(incoming.sender);
      const myId = getUserId(currentUserRef.current);

      const isOwn = Boolean(
        senderId &&
          myId &&
          String(senderId) === String(myId)
      );

      const active =
        String(selectedConversationIdRef.current || "") ===
        String(conversationId);

      const latest = messagesCache.current[conversationId] || [];
      const merged = mergeMessages(latest, [incoming]);

      saveConversationMessages(conversationId, merged);

      const preview = getMessageText(incoming);
      const time =
        incoming.createdAt || new Date().toISOString();

      setConversations((previous) => {
        let found = false;

        const updated = previous.map((conversation) => {
          if (
            getConversationId(conversation) !==
            String(conversationId)
          ) {
            return conversation;
          }

          found = true;

          const currentUnread = Number(
            conversation.unreadCount ??
              conversation.unreadMessages ??
              conversation.unread ??
              0
          );

          const unread =
            active || isOwn
              ? 0
              : currentUnread + 1;

          return {
            ...conversation,
            lastMessage: preview,
            lastMessageText: preview,
            lastMessageAt: time,
            updatedAt: time,
            unreadCount: unread,
            unreadMessages: unread,
            unreadMessageCount: unread,
            unread,
          };
        });

        conversationsRef.current = updated;

        try {
          localStorage.setItem(
            "cached_user_admin_chats",
            JSON.stringify(updated)
          );
        } catch {
          // Ignore storage errors.
        }

        // If a real conversation was missing from the list,
        // refresh the list from the server.
        if (!found) {
          loadConversations(true);
        }

        return updated;
      });

      if (!isOwn) {
        const sender = incoming.sender || {};

        playNotificationSound(notificationAudioRef);

        showDesktopNotification(
          sender.name ||
            sender.fullName ||
            sender.email ||
            "New message",
          preview || "You received a message."
        );
      }

      if (active && !isOwn) {
        markConversationRead(conversationId).catch(() => {});

        setConversations((previous) =>
          previous.map((conversation) =>
            getConversationId(conversation) ===
            String(conversationId)
              ? {
                  ...conversation,
                  unreadCount: 0,
                  unreadMessages: 0,
                  unreadMessageCount: 0,
                  unread: 0,
                }
              : conversation
          )
        );
      }
    },
    [
      loadConversations,
      loadMessages,
      saveConversationMessages,
    ]
  );

  /* -------------------- Selected Conversation -------------------- */

  useEffect(() => {
    const id = selectedConversationId;

    selectedConversationIdRef.current = id;

    if (!id) {
      setMessages([]);
      setMessagesLoading(false);
      return;
    }

    const cached = messagesCache.current[id];

    if (cached) {
      setMessages(cached);
      setMessagesLoading(false);
    } else {
      try {
        const raw = localStorage.getItem(
          `cached_user_messages_${id}`
        );

        const parsed = raw ? JSON.parse(raw) : [];

        messagesCache.current[id] = parsed;
        setMessages(parsed);
      } catch {
        setMessages([]);
      }
    }

    loadMessages(id, Boolean(cached));
  }, [selectedConversationId, loadMessages]);

  /* -------------------- Socket.IO -------------------- */

  useEffect(() => {
    const socket = io(BACKEND_BASE_URL, {
      auth: {
        token: getStoredToken(),
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 10000,
    });

    socketRef.current = socket;

    const joinRooms = () => {
      setSocketConnected(true);

      const userId = getUserId(currentUserRef.current);

      if (userId) {
        socket.emit("user_join", userId);
      }

      const conversationId =
        selectedConversationIdRef.current;

      if (
        conversationId &&
        conversationId !== DEFAULT_CONVERSATION_ID
      ) {
        socket.emit("join_room", conversationId);
      }

      // Recover any missed messages after reconnecting.
      loadConversations(true);

      if (conversationId) {
        loadMessages(conversationId, true);
      }
    };

    const onDisconnect = () => {
      setSocketConnected(false);
    };

    const onConnectError = (err) => {
      setSocketConnected(false);
      console.warn(
        "Chat socket connection error:",
        err?.message
      );
    };

    socket.on("connect", joinRooms);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    const eventNames = [
      "receive_message",
      "new_message",
      "message",
      "message_notification",
    ];

    eventNames.forEach((eventName) => {
      socket.on(eventName, handleIncomingMessage);
    });

    return () => {
      socket.off("connect", joinRooms);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);

      eventNames.forEach((eventName) => {
        socket.off(eventName, handleIncomingMessage);
      });

      socket.disconnect();

      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [
    handleIncomingMessage,
    loadConversations,
    loadMessages,
  ]);

  // Join the selected conversation room.
  useEffect(() => {
    const socket = socketRef.current;
    const id = selectedConversationId;

    if (
      !socket ||
      !socket.connected ||
      !id ||
      id === DEFAULT_CONVERSATION_ID
    ) {
      return;
    }

    socket.emit("join_room", id);
  }, [selectedConversationId, socketConnected]);

  // Join the private user room when the user profile becomes available.
  useEffect(() => {
    const socket = socketRef.current;
    const userId = getUserId(currentUser);

    if (socket?.connected && userId) {
      socket.emit("user_join", userId);
    }
  }, [currentUser, socketConnected]);

  /*
   * Poll only the active chat as a fallback.
   * Socket.IO remains the primary realtime channel.
   */
  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      if (
        cancelled ||
        pollingBusyRef.current ||
        document.visibilityState === "hidden"
      ) {
        return;
      }

      const id = selectedConversationIdRef.current;

      if (!id || id === DEFAULT_CONVERSATION_ID) {
        return;
      }

      pollingBusyRef.current = true;

      try {
        await loadMessages(id, true);
      } finally {
        pollingBusyRef.current = false;
      }
    };

    const interval = setInterval(sync, 2000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sync();
      }
    };

    document.addEventListener(
      "visibilitychange",
      onVisibilityChange
    );

    return () => {
      cancelled = true;
      clearInterval(interval);

      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange
      );
    };
  }, [loadMessages]);

  // Conversation list refresh is deliberately less frequent.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadConversations(true);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [loadConversations]);

  /* -------------------- Conversation List -------------------- */

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return conversations;

    return conversations.filter((conversation) =>
      `${getParticipantName(conversation, currentUser)} ${getParticipantEmail(
        conversation,
        currentUser
      )} ${getParticipantRole(conversation, currentUser)} ${
        conversation?.lastMessage ||
        conversation?.lastMessageText ||
        conversation?.preview ||
        ""
      }`
        .toLowerCase()
        .includes(query)
    );
  }, [conversations, search, currentUser]);

  function handleFileChange(event) {
    const files = Array.from(event.target.files || []);

    if (files.length) {
      setSelectedFiles((previous) =>
        [...previous, ...files].slice(0, 5)
      );
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeSelectedFile(index) {
    setSelectedFiles((previous) =>
      previous.filter((_, fileIndex) => fileIndex !== index)
    );
  }

  async function handleSelectConversation(conversation) {
    if (!conversation) return;

    const id = getConversationId(conversation);

    if (!id) return;

    setSelectedFiles([]);
    setMessagesError("");
    setSelectedConversation(conversation);

    selectedConversationIdRef.current = id;

    const cached = messagesCache.current[id];

    if (cached) {
      setMessages(cached);
    } else {
      try {
        const raw = localStorage.getItem(
          `cached_user_messages_${id}`
        );

        const parsed = raw ? JSON.parse(raw) : [];

        messagesCache.current[id] = parsed;
        setMessages(parsed);
      } catch {
        setMessages([]);
      }
    }

    if (
      socketRef.current?.connected &&
      id !== DEFAULT_CONVERSATION_ID
    ) {
      socketRef.current.emit("join_room", id);
    }

    const unread = Number(
      conversation.unreadCount ??
        conversation.unreadMessages ??
        conversation.unread ??
        0
    );

    if (unread > 0) {
      try {
        await markConversationRead(id);

        setConversations((previous) =>
          previous.map((item) =>
            getConversationId(item) === id
              ? {
                  ...item,
                  unreadCount: 0,
                  unreadMessages: 0,
                  unreadMessageCount: 0,
                  unread: 0,
                }
              : item
          )
        );
      } catch (err) {
        console.warn(
          "Could not mark conversation read:",
          err
        );
      }
    }

    loadMessages(id, true);
  }

  /* -------------------- Send Message -------------------- */

  async function handleSendMessage(event) {
    event?.preventDefault();

    const body = message.trim();
    const conversationId =
      getConversationId(selectedConversation);

    const files = [...selectedFiles];

    if ((!body && !files.length) || sendingRef.current) {
      return;
    }

    if (
      !conversationId ||
      conversationId === DEFAULT_CONVERSATION_ID
    ) {
      setMessagesError(
        "A real conversation has not loaded yet. Refresh the chat list and try again."
      );
      return;
    }

    const recipient = getOtherParticipant(
      selectedConversation,
      currentUser
    );

    const recipientId = getUserId(recipient);

    const tempId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const optimisticMessage = {
      _id: tempId,
      id: tempId,
      conversationId,
      body,
      message: body,
      sender: currentUser || {
        role: "user",
        name: "You",
      },
      createdAt: new Date().toISOString(),
      attachments: files.map((file) => ({
        filename: file.name,
        originalName: file.name,
        mimeType: file.type,
        url: URL.createObjectURL(file),
      })),
      sending: true,
      failed: false,
    };

    // Optimistic UI: display immediately, before network response.
    const latest = messagesCache.current[conversationId] || [];

    saveConversationMessages(
      conversationId,
      mergeMessages(latest, [optimisticMessage])
    );

    setMessage("");
    setSelectedFiles([]);
    setSending(true);
    sendingRef.current = true;
    setMessagesError("");

    requestAnimationFrame(() => scrollToBottom(true));

    try {
      let response;

      // One request only. Do not retry through a second endpoint
      // automatically, because the first request may have saved it.
      if (files.length) {
        const form = new FormData();

        form.append("conversationId", conversationId);
        form.append("body", body);
        form.append("message", body);
        form.append("messageType", "text");

        if (recipientId) {
          form.append("recipientId", String(recipientId));
        }

        files.forEach((file) => {
          form.append("files", file);
        });

        response = await apiRequest("/messages", {
          method: "POST",
          body: form,
        });
      } else {
        response = await apiRequest("/messages", {
          method: "POST",
          body: JSON.stringify({
            conversationId,
            recipientId,
            body,
            message: body,
            messageType: "text",
          }),
        });
      }

      const sent =
        response?.messageData ||
        response?.data?.message ||
        response?.data?.data ||
        response?.data ||
        (response?.message &&
        typeof response.message === "object"
          ? response.message
          : null);

      const latestAfterSend =
        messagesCache.current[conversationId] || [];

      if (sent && typeof sent === "object") {
        const normalized = {
          ...sent,
          conversationId:
            getMessageConversationId(sent) || conversationId,
          sending: false,
          failed: false,
        };

        saveConversationMessages(
          conversationId,
          mergeMessages(
            latestAfterSend.filter(
              (item) => getMessageId(item) !== tempId
            ),
            [normalized]
          )
        );

        const savedId = getMessageId(normalized);

        if (savedId) {
          processedMessageIdsRef.current.add(savedId);
        }
      } else {
        // Do not claim server delivery without a confirmed message.
        saveConversationMessages(
          conversationId,
          latestAfterSend.map((item) =>
            getMessageId(item) === tempId
              ? { ...item, sending: false }
              : item
          )
        );

        await loadMessages(conversationId, true);
      }

      loadConversations(true);
    } catch (err) {
      console.error("Send message error:", err);

      setMessagesError(
        err?.message || "Unable to send message."
      );

      const latestAfterFailure =
        messagesCache.current[conversationId] || [];

      saveConversationMessages(
        conversationId,
        latestAfterFailure.filter(
          (item) => getMessageId(item) !== tempId
        )
      );

      setMessage(body);
      setSelectedFiles(files);
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  }

  /* -------------------- Delete Message -------------------- */

  function promptDeleteMessage(item) {
    setMessageToDelete(item);
    setDeleteModalOpen(true);
  }

  async function executeDeleteMessage(type) {
    if (!messageToDelete) return;

    const id = getMessageId(messageToDelete);

    if (!id || id.startsWith("temp-")) return;

    try {
      setDeletingMessage(true);

      const endpoint =
        type === "everyone"
          ? `/messages/${encodeURIComponent(id)}/delete-for-everyone`
          : `/messages/${encodeURIComponent(id)}/delete-for-me`;

      const response = await apiRequest(endpoint, {
        method: "POST",
      });

      const conversationId =
        getConversationId(selectedConversation);

      const latest =
        messagesCache.current[conversationId] || messages;

      const serverMessage =
        response?.data?.message || response?.data;

      const updated =
        type === "me"
          ? latest.filter(
              (item) => getMessageId(item) !== id
            )
          : latest.map((item) =>
              getMessageId(item) !== id
                ? item
                : {
                    ...item,
                    ...(serverMessage &&
                    typeof serverMessage === "object"
                      ? serverMessage
                      : {}),
                    body: "This message was deleted",
                    message: "This message was deleted",
                    isDeletedForEveryone: true,
                    attachments: [],
                  }
            );

      saveConversationMessages(conversationId, updated);

      setDeleteModalOpen(false);
      setMessageToDelete(null);

      loadConversations(true);
    } catch (err) {
      console.error("Delete message failed:", err);
      alert(err?.message || "Failed to delete message.");
    } finally {
      setDeletingMessage(false);
    }
  }

  const selectedName = selectedConversation
    ? getParticipantName(selectedConversation, currentUser)
    : "";

  /* -------------------- UI -------------------- */

  return (
    <div className="relative flex h-[calc(100vh-4rem)] min-h-0 w-full animate-fadeIn overflow-hidden bg-[#f7f8fc] p-4 text-slate-950 sm:p-6 lg:p-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-72 w-72 animate-pulse rounded-full bg-violet-400/10 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      <div className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
        {error && (
          <section className="mb-3 shrink-0 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
            {error}
          </section>
        )}

        <section className="grid h-full min-h-0 min-w-0 w-full flex-1 grid-cols-1 grid-rows-[240px_minmax(0,1fr)] overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)] lg:grid-cols-[360px_minmax(0,1fr)] lg:grid-rows-1">
          <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-b border-slate-100 lg:border-b-0 lg:border-r">
            <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 p-4 sm:p-5">
              <div className="mb-3.5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Chats & Teams
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-400">
                    Direct messages with Admin
                  </p>

                  <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold">
                    {socketConnected ? (
                      <>
                        <Wifi
                          size={12}
                          className="text-emerald-600"
                        />
                        <span className="text-emerald-600">
                          Realtime connected
                        </span>
                      </>
                    ) : (
                      <>
                        <WifiOff
                          size={12}
                          className="text-amber-600"
                        />
                        <span className="text-amber-600">
                          Reconnecting…
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {notificationPermission !== "unsupported" && (
                  <button
                    type="button"
                    onClick={requestNotificationPermission}
                    title={
                      notificationPermission === "granted"
                        ? "Notifications enabled"
                        : "Enable desktop notifications"
                    }
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                      notificationPermission === "granted"
                        ? "border-emerald-100 bg-emerald-50 text-emerald-600"
                        : "border-violet-100 bg-white text-violet-600 hover:bg-violet-50"
                    }`}
                  >
                    <Bell size={16} />
                  </button>
                )}
              </div>

              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search admin chats..."
                  className="h-10 w-full rounded-2xl border border-slate-200/90 bg-white pl-9 pr-3 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {loading && !conversations.length ? (
                <ConversationLoading />
              ) : filteredConversations.length ? (
                filteredConversations.map(
                  (conversation, index) => {
                    const id = getConversationId(conversation);

                    const participant = getOtherParticipant(
                      conversation,
                      currentUser
                    );

                    const name = getParticipantName(
                      conversation,
                      currentUser
                    );

                    const avatar = getParticipantAvatar(
                      conversation,
                      currentUser
                    );

                    const last =
                      conversation?.lastMessage ||
                      conversation?.lastMessageText ||
                      conversation?.preview ||
                      "No messages yet";

                    const unread = Number(
                      conversation?.unreadCount ??
                        conversation?.unreadMessages ??
                        conversation?.unread ??
                        0
                    );

                    const active =
                      String(selectedConversationId || "") ===
                      String(id || "");

                    return (
                      <button
                        key={
                          id ||
                          getUserId(participant) ||
                          `contact-${index}`
                        }
                        onClick={() =>
                          handleSelectConversation(conversation)
                        }
                        type="button"
                        className={`flex w-full items-start gap-3 border-b border-slate-100/80 px-4 py-3.5 text-left transition ${
                          active
                            ? "border-violet-200/60 bg-violet-50/70"
                            : "hover:bg-slate-50/80"
                        }`}
                      >
                        <div className="relative shrink-0">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-sm">
                            {avatar ? (
                              <img
                                src={getFileUrl(avatar)}
                                alt={name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              getInitials(name)
                            )}
                          </div>

                          {unread > 0 && (
                            <span className="absolute -right-2 -top-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-extrabold text-white shadow-md ring-2 ring-white">
                              {unread > 99 ? "99+" : unread}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p
                              className={`truncate text-xs font-bold ${
                                unread
                                  ? "text-slate-900"
                                  : "text-slate-800"
                              }`}
                            >
                              {name}
                            </p>

                            <span className="shrink-0 text-[10px] text-slate-400">
                              {formatDateTime(
                                conversation?.lastMessageAt ||
                                  conversation?.updatedAt ||
                                  conversation?.createdAt
                              )}
                            </span>
                          </div>

                          <p className="mt-1 truncate text-xs text-slate-500">
                            {last}
                          </p>
                        </div>
                      </button>
                    );
                  }
                )
              ) : (
                <EmptyConversationList
                  search={search}
                  loading={loading}
                />
              )}
            </div>
          </aside>

          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5 sm:px-6">
              {selectedConversation ? (
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-md">
                    {getParticipantAvatar(
                      selectedConversation,
                      currentUser
                    ) ? (
                      <img
                        src={getFileUrl(
                          getParticipantAvatar(
                            selectedConversation,
                            currentUser
                          )
                        )}
                        alt={selectedName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <MessageSquare size={18} />
                    )}
                  </div>

                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-extrabold text-slate-900">
                      {selectedName}
                    </h2>

                    <p className="truncate text-xs font-semibold text-violet-600">
                      Admin Support
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-xs font-bold text-slate-900">
                    Select admin chat
                  </h2>

                  <p className="text-[11px] text-slate-400">
                    Choose from list
                  </p>
                </div>
              )}
            </div>

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6">
              {!selectedConversation ? (
                <NoConversationSelected />
              ) : messagesLoading && !messages.length ? (
                <MessagesLoading />
              ) : messagesError && !messages.length ? (
                <MessageError message={messagesError} />
              ) : !messages.length ? (
                <NoMessages />
              ) : (
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-3.5">
                  {messages.map((item, index) => (
                    <MessageBubble
                      key={
                        getMessageId(item) ||
                        `${item?.createdAt || "message"}-${index}`
                      }
                      message={item}
                      currentUser={currentUser}
                      onDeletePrompt={promptDeleteMessage}
                    />
                  ))}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {messagesError && messages.length > 0 && (
              <div className="shrink-0 border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">
                {messagesError}
              </div>
            )}

            <div className="shrink-0 border-t border-slate-100 bg-white p-4 sm:p-5">
              {selectedFiles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/70 px-3 py-1.5 text-xs text-violet-800"
                    >
                      {file.type.startsWith("image/") ? (
                        <ImageIcon size={14} />
                      ) : (
                        <File size={14} />
                      )}

                      <span className="max-w-[150px] truncate font-semibold">
                        {file.name}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeSelectedFile(index)}
                        aria-label={`Remove ${file.name}`}
                        className="ml-1 rounded-md text-violet-400 hover:text-rose-600"
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
                  onChange={handleFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!selectedConversation || sending}
                  aria-label="Attach file"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-violet-50 disabled:opacity-50"
                >
                  <Paperclip size={18} />
                </button>

                <div className="min-w-0 flex-1">
                  <textarea
                    value={message}
                    onChange={(event) =>
                      setMessage(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();

                        if (
                          (message.trim() ||
                            selectedFiles.length) &&
                          selectedConversation &&
                          !sending
                        ) {
                          handleSendMessage(event);
                        }
                      }
                    }}
                    placeholder={
                      selectedConversation
                        ? `Message ${selectedName} or attach files...`
                        : "Select a real chat first..."
                    }
                    rows={1}
                    disabled={!selectedConversation || sending}
                    className="min-h-11 max-h-32 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-700 outline-none focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 disabled:opacity-60"
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    (!message.trim() && !selectedFiles.length) ||
                    !selectedConversation ||
                    sending
                  }
                  aria-label="Send message"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {sending ? (
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

      {deleteModalOpen && messageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <Trash2 size={20} />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Delete Message?
                </h3>

                <p className="text-xs text-slate-400">
                  Choose how you want to delete this message.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-3.5 text-xs italic text-slate-600">
              “
              {messageToDelete?.isDeletedForEveryone
                ? "This message was deleted"
                : messageToDelete?.body ||
                  messageToDelete?.message ||
                  "Message"}
              ”
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              {String(getUserId(messageToDelete?.sender)) ===
                String(getUserId(currentUser)) &&
                !messageToDelete?.isDeletedForEveryone && (
                  <button
                    type="button"
                    disabled={deletingMessage}
                    onClick={() =>
                      executeDeleteMessage("everyone")
                    }
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {deletingMessage ? (
                      <Loader2
                        size={15}
                        className="animate-spin"
                      />
                    ) : (
                      <Users size={15} />
                    )}
                    Delete for Everyone
                  </button>
                )}

              <button
                type="button"
                disabled={deletingMessage}
                onClick={() => executeDeleteMessage("me")}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-xs font-bold text-slate-700 disabled:opacity-50"
              >
                {deletingMessage ? (
                  <Loader2
                    size={15}
                    className="animate-spin"
                  />
                ) : (
                  <Trash2 size={15} />
                )}
                Delete for Me
              </button>

              <button
                type="button"
                disabled={deletingMessage}
                onClick={() => {
                  setDeleteModalOpen(false);
                  setMessageToDelete(null);
                }}
                className="h-9 w-full text-xs font-semibold text-slate-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------- Message Bubble -------------------- */

function MessageBubble({
  message,
  currentUser,
  onDeletePrompt,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const senderId = getUserId(message?.sender);
  const myId = getUserId(currentUser);

  const outgoing = Boolean(
    senderId &&
      myId &&
      String(senderId) === String(myId)
  );

  const deleted = Boolean(message?.isDeletedForEveryone);

  const body = deleted
    ? "This message was deleted"
    : message?.body || message?.message || "";

  const sender =
    message?.sender?.name ||
    message?.senderName ||
    "";

  useEffect(() => {
    const closeMenu = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener("mousedown", closeMenu);
    }

    return () => {
      document.removeEventListener("mousedown", closeMenu);
    };
  }, [menuOpen]);

  return (
    <div
      className={`group relative flex w-full items-center gap-2.5 ${
        outgoing ? "justify-end" : "justify-start"
      }`}
    >
      <div
        ref={menuRef}
        className={`relative opacity-0 transition-opacity group-hover:opacity-100 ${
          outgoing ? "order-2" : "order-1"
        }`}
      >
        {!deleted && (
          <>
            <button
              type="button"
              onClick={() =>
                setMenuOpen((previous) => !previous)
              }
              aria-label="Message options"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <MoreVertical size={14} />
            </button>

            {menuOpen && (
              <div
                className={`absolute bottom-full z-20 mb-1 w-40 rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl ${
                  outgoing ? "right-0" : "left-0"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDeletePrompt(message);
                  }}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 size={13} />
                  {outgoing
                    ? "Delete Message"
                    : "Delete for Me"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div
        className={`max-w-[82%] rounded-[20px] px-4 py-3 shadow-sm sm:max-w-[72%] ${
          outgoing ? "order-2" : "order-1"
        } ${
          deleted
            ? "border border-slate-200 bg-slate-50 italic text-slate-400"
            : outgoing
              ? "rounded-tr-xs bg-violet-600 text-white"
              : "rounded-tl-xs border border-slate-100 bg-white text-slate-800"
        }`}
      >
        {!outgoing && sender && !deleted && (
          <p className="mb-1 text-[10px] font-bold text-violet-600">
            {sender}
          </p>
        )}

        {deleted ? (
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle size={13} />
            <span>This message was deleted</span>
          </div>
        ) : (
          body && (
            <p className="whitespace-pre-wrap break-words text-xs font-medium leading-relaxed">
              {body}
            </p>
          )
        )}

        {!deleted &&
          Array.isArray(message?.attachments) &&
          message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((attachment, index) => {
                const mime = String(
                  attachment?.mimeType ||
                    attachment?.fileType ||
                    ""
                ).toLowerCase();

                const isImage = mime.startsWith("image/");
                const url = getFileUrl(attachment?.url);

                const name =
                  attachment?.originalName ||
                  attachment?.filename ||
                  "Attachment";

                return isImage && url !== "#" ? (
                  <a
                    key={attachment?.url || index}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-2xl border bg-white p-1"
                  >
                    <img
                      src={url}
                      alt={name}
                      loading="lazy"
                      className="max-h-60 w-auto rounded-xl object-contain"
                    />
                  </a>
                ) : (
                  <a
                    key={attachment?.url || index}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-bold ${
                      outgoing
                        ? "border-violet-200 bg-violet-50 text-violet-700"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <FileText
                      size={15}
                      className="shrink-0 text-violet-600"
                    />

                    <span className="max-w-[200px] truncate">
                      {name}
                    </span>
                  </a>
                );
              })}
            </div>
          )}

        <div
          className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${
            deleted
              ? "text-slate-400"
              : outgoing
                ? "text-violet-200"
                : "text-slate-400"
          }`}
        >
          <span>
            {formatTime(
              message?.createdAt || message?.sentAt
            )}
          </span>

          {outgoing && !deleted && (
            message?.sending ? (
              <Check size={12} />
            ) : (
              <CheckCheck size={12} />
            )
          )}

          {message?.sending && <span>Sending…</span>}
        </div>
      </div>
    </div>
  );
}

/* -------------------- Empty States -------------------- */

function EmptyConversationList({ search, loading }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
        {loading ? (
          <Loader2 size={22} className="animate-spin" />
        ) : (
          <MessageSquare size={22} />
        )}
      </div>

      <h3 className="mt-4 text-sm font-bold text-slate-800">
        {loading
          ? "Loading conversations..."
          : search
            ? "No matching chats"
            : "No admin chats"}
      </h3>

      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">
        {loading
          ? "Please wait while your chats load."
          : search
            ? "No conversation matches your search."
            : "The server has not returned a real conversation yet."}
      </p>
    </div>
  );
}

function NoConversationSelected() {
  return (
    <div className="flex h-full min-h-[380px] flex-col items-center justify-center text-center">
      <MessageSquare size={26} className="text-violet-600" />

      <h3 className="mt-4 text-sm font-bold text-slate-900">
        Select admin chat
      </h3>

      <p className="mt-1 max-w-sm text-xs text-slate-400">
        Choose a conversation from the list.
      </p>
    </div>
  );
}

function NoMessages() {
  return (
    <div className="flex h-full min-h-[380px] flex-col items-center justify-center text-center">
      <MessageSquare size={26} className="text-violet-600" />

      <h3 className="mt-4 text-sm font-bold text-slate-900">
        No messages yet
      </h3>

      <p className="mt-1 text-xs text-slate-400">
        Send a message below to start your conversation with Admin.
      </p>
    </div>
  );
}

function ConversationLoading() {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center p-6 text-center">
      <Loader2
        size={26}
        className="animate-spin text-violet-600"
      />

      <p className="mt-3 text-xs font-semibold text-slate-500">
        Loading chats...
      </p>
    </div>
  );
}

function MessagesLoading() {
  return (
    <div className="flex h-full min-h-[380px] flex-col items-center justify-center text-center">
      <Loader2
        size={32}
        className="animate-spin text-violet-600"
      />

      <p className="mt-3 text-xs font-semibold text-slate-500">
        Loading messages...
      </p>
    </div>
  );
}

function MessageError({ message }) {
  return (
    <div className="flex h-full min-h-[380px] items-center justify-center p-4">
      <div className="max-w-md rounded-2xl border border-rose-100 bg-rose-50 p-4 text-center text-xs font-semibold text-rose-600">
        {message}
      </div>
    </div>
  );
}