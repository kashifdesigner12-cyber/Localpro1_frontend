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

const MAX_FILES = 5;
const MESSAGE_POLL_INTERVAL = 3000;
const CONVERSATION_POLL_INTERVAL = 15000;

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

  if (typeof user === "string" || typeof user === "number") {
    return String(user);
  }

  const id =
    user._id ??
    user.id ??
    user.userId ??
    user.user?._id ??
    user.user?.id;

  return id != null ? String(id) : null;
}

function getConversationId(conversation) {
  const id =
    conversation?._id ??
    conversation?.id ??
    conversation?.conversationId ??
    conversation?.conversation?._id;

  return id != null ? String(id) : null;
}

function getMessageId(message) {
  const id =
    message?._id ??
    message?.id ??
    message?.messageId;

  return id != null ? String(id) : "";
}

function getMessageConversationId(message) {
  const value =
    message?.conversationId ??
    message?.conversation_id ??
    message?.chatId ??
    message?.conversation;

  if (value && typeof value === "object") {
    const id =
      value._id ??
      value.id ??
      value.conversationId;

    return id != null ? String(id) : null;
  }

  return value != null ? String(value) : null;
}

function getMessageText(message) {
  return (
    message?.body ??
    message?.message ??
    (message?.attachments?.length ? "Attachment" : "")
  );
}

function getMessageSenderId(message) {
  return getUserId(
    message?.sender ??
    message?.senderId ??
    message?.user ??
    message?.userId
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
      currentId === participantId
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

function getTimestamp(message) {
  const value =
    message?.createdAt ??
    message?.sentAt ??
    message?.timestamp ??
    0;

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sameOptimisticMessage(a, b) {
  if (!String(getMessageId(a)).startsWith("temp-")) {
    return false;
  }

  const senderA = getMessageSenderId(a);
  const senderB = getMessageSenderId(b);

  if (senderA && senderB && senderA !== senderB) {
    return false;
  }

  if (getMessageText(a) !== getMessageText(b)) {
    return false;
  }

  const attachmentsA = Array.isArray(a?.attachments)
    ? a.attachments
    : [];

  const attachmentsB = Array.isArray(b?.attachments)
    ? b.attachments
    : [];

  if (
    !getMessageText(a) &&
    attachmentsA.length !== attachmentsB.length
  ) {
    return false;
  }

  const timeA = getTimestamp(a);
  const timeB = getTimestamp(b);

  return (
    timeA > 0 &&
    timeB > 0 &&
    Math.abs(timeA - timeB) < 60000
  );
}

function mergeMessages(existing = [], incoming = []) {
  const output = [...existing];

  for (const message of incoming) {
    if (!message || typeof message !== "object") continue;

    const id = getMessageId(message);

    let index = id
      ? output.findIndex(
          (item) => getMessageId(item) === id
        )
      : -1;

    // Reconcile the optimistic copy with the persisted copy.
    if (index < 0 && id && !id.startsWith("temp-")) {
      index = output.findIndex((item) =>
        sameOptimisticMessage(item, message)
      );
    }

    if (index >= 0) {
      output[index] = {
        ...output[index],
        ...message,
        sending: false,
        failed: false,
      };
    } else {
      output.push(message);
    }
  }

  return output.sort(
    (a, b) => getTimestamp(a) - getTimestamp(b)
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

function normalizeIncomingPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidates = [
    payload?.message,
    payload?.messageData,
    payload?.data?.message,
    payload?.data?.messageData,
    payload?.data,
    payload,
  ];

  for (const candidate of candidates) {
    if (
      candidate &&
      typeof candidate === "object" &&
      (
        getMessageId(candidate) ||
        getMessageConversationId(candidate)
      )
    ) {
      return candidate;
    }
  }

  return null;
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

async function getConversationMessages(id) {
  if (!id) return { messages: [] };

  return apiRequest(
    `/messages/${encodeURIComponent(id)}`
  );
}

async function markConversationRead(id) {
  if (!id) return;

  // Keep the read endpoint currently used by this application.
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
      0.06,
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
    // Browser may block notification audio.
  }
}

function showDesktopNotification(title, body, messageId) {
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
        tag: messageId
          ? `localpro-chat-${messageId}`
          : "localpro-chat-message",
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
    useState("default");

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
  const notifiedMessageIdsRef = useRef(new Set());
  const notificationAudioRef = useRef(null);
  const pollingBusyRef = useRef(false);
  const sendingRef = useRef(false);
  const mountedRef = useRef(false);

  const selectedConversationId =
    getConversationId(selectedConversation);

  useEffect(() => {
    mountedRef.current = true;

    if (
      typeof window !== "undefined" &&
      "Notification" in window
    ) {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission("unsupported");
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  /* -------------------- Load Conversations -------------------- */

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

          if (user && typeof user === "object") {
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
          (conversation) => Boolean(getConversationId(conversation))
        );

        // Only show conversations returned by the backend.
        const unique = new Map();

        for (const conversation of list) {
          const id = getConversationId(conversation);

          if (!id) continue;

          // Exclude group conversations in this direct-chat UI.
          if (conversation?.isGroup === true) continue;

          unique.set(id, conversation);
        }

        const finalList = Array.from(unique.values()).sort(
          (a, b) => {
            const timeA = new Date(
              a?.lastMessageAt || a?.updatedAt || a?.createdAt || 0
            ).getTime();

            const timeB = new Date(
              b?.lastMessageAt || b?.updatedAt || b?.createdAt || 0
            ).getTime();

            return timeB - timeA;
          }
        );

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
              (item) => getConversationId(item) === previousId
            );

            if (stillExists) return stillExists;
          }

          return finalList[0] || null;
        });
      } catch (err) {
        console.error("Load conversations error:", err);

        if (err?.status === 401) {
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
          return;
        }

        if (!silent) {
          setError(
            err?.message || "Unable to load conversations."
          );
        }
      } finally {
        conversationsRequestRef.current = false;

        if (mountedRef.current) {
          setLoading(false);
        }
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
          const parsed = JSON.parse(cachedUser);

          currentUserRef.current = parsed;
          setCurrentUser(parsed);
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

  /* -------------------- Cache Messages -------------------- */

  const saveConversationMessages = useCallback(
    (id, nextMessages) => {
      if (!id) return;

      messagesCache.current[id] = nextMessages;

      try {
        localStorage.setItem(
          `cached_user_messages_${id}`,
          JSON.stringify(
            nextMessages.filter(
              (item) =>
                !String(getMessageId(item)).startsWith("temp-") ||
                !item?.failed
            )
          )
        );
      } catch {
        // Ignore storage errors.
      }

      if (
        String(selectedConversationIdRef.current || "") ===
        String(id)
      ) {
        setMessages(nextMessages);
      }
    },
    []
  );

  /* -------------------- Load Messages -------------------- */

  const loadMessages = useCallback(
    async (id, silent = false) => {
      if (!id) {
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
          String(selectedConversationIdRef.current || "") ===
          String(id)
        ) {
          setMessages(merged);
        }

        try {
          localStorage.setItem(
            `cached_user_messages_${id}`,
            JSON.stringify(
              merged.filter(
                (item) =>
                  !String(getMessageId(item)).startsWith("temp-")
              )
            )
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

  /* -------------------- Incoming Socket Messages -------------------- */

  const handleIncomingMessage = useCallback(
    (payload) => {
      const incoming = normalizeIncomingPayload(payload);

      if (!incoming) {
        // Metadata-only events should trigger a quiet refresh.
        const activeId = selectedConversationIdRef.current;

        if (activeId) {
          loadMessages(activeId, true);
        }

        loadConversations(true);
        return;
      }

      const id = getMessageId(incoming);
      const conversationId =
        getMessageConversationId(incoming);

      if (!conversationId) {
        loadConversations(true);
        return;
      }

      // Duplicate socket aliases for the same persisted message.
      if (
        id &&
        processedMessageIdsRef.current.has(id)
      ) {
        return;
      }

      if (id) {
        processedMessageIdsRef.current.add(id);

        if (processedMessageIdsRef.current.size > 2000) {
          const oldest =
            processedMessageIdsRef.current.values().next().value;

          processedMessageIdsRef.current.delete(oldest);
        }
      }

      const senderId = getMessageSenderId(incoming);
      const myId = getUserId(currentUserRef.current);

      const isOwn = Boolean(
        senderId && myId && senderId === myId
      );

      const active =
        String(selectedConversationIdRef.current || "") ===
        String(conversationId);

      const latest = messagesCache.current[conversationId] || [];
      const merged = mergeMessages(latest, [incoming]);

      saveConversationMessages(conversationId, merged);

      const preview = getMessageText(incoming) || "Attachment";
      const time =
        incoming.createdAt || incoming.sentAt || new Date().toISOString();

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

          const unread = active || isOwn
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

        if (!found) {
          loadConversations(true);
        }

        return updated;
      });

      // Notify only once per incoming persisted message.
      if (!isOwn && (!id || !notifiedMessageIdsRef.current.has(id))) {
        if (id) {
          notifiedMessageIdsRef.current.add(id);

          if (notifiedMessageIdsRef.current.size > 1000) {
            const oldest =
              notifiedMessageIdsRef.current.values().next().value;

            notifiedMessageIdsRef.current.delete(oldest);
          }
        }

        playNotificationSound(notificationAudioRef);

        const sender = incoming.sender || {};

        showDesktopNotification(
          sender.name ||
            sender.fullName ||
            sender.email ||
            "New message",
          preview,
          id
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
      setMessagesError("");
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

        messagesCache.current[id] = Array.isArray(parsed)
          ? parsed
          : [];

        setMessages(messagesCache.current[id]);
      } catch {
        setMessages([]);
      }
    }

    loadMessages(id, Boolean(cached));

    const unread = Number(
      conversationsRef.current.find(
        (conversation) => getConversationId(conversation) === id
      )?.unreadCount || 0
    );

    if (unread > 0) {
      markConversationRead(id)
        .then(() => {
          setConversations((previous) =>
            previous.map((conversation) =>
              getConversationId(conversation) === id
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
        })
        .catch(() => {});
    }
  }, [selectedConversationId, loadMessages]);

  /* -------------------- Socket.IO -------------------- */

  useEffect(() => {
    const token = getStoredToken();

    const socket = io(BACKEND_BASE_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 700,
      reconnectionDelayMax: 5000,
      timeout: 15000,
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

      if (conversationId) {
        socket.emit("join_room", conversationId);
        loadMessages(conversationId, true);
      }

      // Recover changes missed during disconnection.
      loadConversations(true);
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

    // These are the backend message events used by this app.
    // Avoid listening to generic aliases that may duplicate delivery.
    socket.on("receive_message", handleIncomingMessage);
    socket.on("new_message", handleIncomingMessage);

    return () => {
      socket.off("connect", joinRooms);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("receive_message", handleIncomingMessage);
      socket.off("new_message", handleIncomingMessage);

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

  useEffect(() => {
    const socket = socketRef.current;
    const id = selectedConversationId;

    if (socket?.connected && id) {
      socket.emit("join_room", id);
    }
  }, [selectedConversationId, socketConnected]);

  useEffect(() => {
    const socket = socketRef.current;
    const userId = getUserId(currentUser);

    if (socket?.connected && userId) {
      socket.emit("user_join", userId);
    }
  }, [currentUser, socketConnected]);

  /* -------------------- Polling Fallback -------------------- */

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

      if (!id) return;

      pollingBusyRef.current = true;

      try {
        await loadMessages(id, true);
      } finally {
        pollingBusyRef.current = false;
      }
    };

    const interval = setInterval(
      sync,
      MESSAGE_POLL_INTERVAL
    );

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

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadConversations(true);
      }
    }, CONVERSATION_POLL_INTERVAL);

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
    const allowed = files.slice(0, MAX_FILES - selectedFiles.length);

    if (files.length > allowed.length) {
      setMessagesError(`You can attach up to ${MAX_FILES} files.`);
    } else {
      setMessagesError("");
    }

    if (allowed.length) {
      setSelectedFiles((previous) =>
        [...previous, ...allowed].slice(0, MAX_FILES)
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

        messagesCache.current[id] = Array.isArray(parsed)
          ? parsed
          : [];

        setMessages(messagesCache.current[id]);
      } catch {
        setMessages([]);
      }
    }

    if (socketRef.current?.connected) {
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
        console.warn("Could not mark conversation read:", err);
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

    if (!conversationId) {
      setMessagesError(
        "Select a real conversation before sending a message."
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

    const previewAttachments = files.map((file) => ({
      filename: file.name,
      originalName: file.name,
      mimeType: file.type,
      url: URL.createObjectURL(file),
      localPreview: true,
    }));

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
      attachments: previewAttachments,
      sending: true,
      failed: false,
    };

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

      if (files.length) {
        const form = new FormData();

        form.append("conversationId", conversationId);
        form.append("body", body);
        form.append("message", body);
        form.append("messageType", "text");

        if (recipientId) {
          form.append("recipientId", recipientId);
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
            ...(recipientId ? { recipientId } : {}),
            body,
            message: body,
            messageType: "text",
          }),
        });
      }

      const sent =
        response?.messageData ||
        response?.data?.messageData ||
        response?.data?.message ||
        response?.message &&
          typeof response.message === "object"
          ? (
              response?.messageData ||
              response?.data?.messageData ||
              response?.data?.message ||
              response?.message
            )
          : (
              response?.data?.data &&
              typeof response.data.data === "object"
                ? response.data.data
                : null
            );

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
        // Server accepted the request, but returned no message object.
        // Refresh history instead of resending and risking duplicates.
        await loadMessages(conversationId, true);

        const current = messagesCache.current[conversationId] || [];

        if (current.some((item) => getMessageId(item) === tempId)) {
          saveConversationMessages(
            conversationId,
            current.filter((item) => getMessageId(item) !== tempId)
          );
        }
      }

      for (const attachment of previewAttachments) {
        if (attachment.url?.startsWith("blob:")) {
          URL.revokeObjectURL(attachment.url);
        }
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

      for (const attachment of previewAttachments) {
        if (attachment.url?.startsWith("blob:")) {
          URL.revokeObjectURL(attachment.url);
        }
      }

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
        response?.messageData ||
        response?.data?.message ||
        response?.data?.messageData ||
        null;

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
      setMessagesError(
        err?.message || "Failed to delete message."
      );
    } finally {
      setDeletingMessage(false);
    }
  }

  const selectedName = selectedConversation
    ? getParticipantName(selectedConversation, currentUser)
    : "";

  /* -------------------- UI -------------------- */

  return (
    <div className="relative flex h-[calc(100vh-4rem)] min-h-0 w-full overflow-hidden bg-[#080b12] p-3 text-slate-100 sm:p-5 lg:p-6">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-fuchsia-600/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-blue-600/5 blur-3xl" />
      </div>

      <div className="relative flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
        {error && (
          <section className="mb-3 shrink-0 rounded-xl border border-rose-900/60 bg-rose-950/50 px-4 py-3 text-xs font-semibold text-rose-300">
            {error}
          </section>
        )}

        <section className="grid h-full min-h-0 min-w-0 w-full flex-1 grid-cols-1 grid-rows-[230px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-800 bg-[#0e131d] shadow-2xl shadow-black/30 lg:grid-cols-[340px_minmax(0,1fr)] lg:grid-rows-1">
          {/* Conversation sidebar */}
          <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-b border-slate-800 lg:border-b-0 lg:border-r">
            <div className="shrink-0 border-b border-slate-800 bg-[#111722] p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-white">
                    Chats
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Direct messages with Admin
                  </p>

                  <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold">
                    {socketConnected ? (
                      <>
                        <Wifi
                          size={12}
                          className="text-emerald-400"
                        />
                        <span className="text-emerald-400">
                          Realtime connected
                        </span>
                      </>
                    ) : (
                      <>
                        <WifiOff
                          size={12}
                          className="text-amber-400"
                        />
                        <span className="text-amber-400">
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
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${
                      notificationPermission === "granted"
                        ? "border-emerald-800 bg-emerald-950/50 text-emerald-400"
                        : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <Bell size={16} />
                  </button>
                )}
              </div>

              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search chats..."
                  className="h-10 w-full rounded-xl border border-slate-700 bg-[#0b1019] pl-9 pr-3 text-xs font-medium text-slate-200 outline-none placeholder:text-slate-500 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {loading && !conversations.length ? (
                <ConversationLoading />
              ) : filteredConversations.length ? (
                filteredConversations.map((conversation) => {
                  const id = getConversationId(conversation);
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
                      key={id}
                      type="button"
                      onClick={() =>
                        handleSelectConversation(conversation)
                      }
                      className={`flex w-full items-start gap-3 border-b border-slate-800/80 px-4 py-3.5 text-left transition ${
                        active
                          ? "bg-violet-500/10"
                          : "hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-xs font-bold text-white">
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
                          <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-extrabold text-white ring-2 ring-[#0e131d]">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`truncate text-xs font-bold ${
                              unread
                                ? "text-white"
                                : "text-slate-300"
                            }`}
                          >
                            {name}
                          </p>

                          <span className="shrink-0 text-[10px] text-slate-500">
                            {formatDateTime(
                              conversation?.lastMessageAt ||
                                conversation?.updatedAt ||
                                conversation?.createdAt
                            )}
                          </span>
                        </div>

                        <p className="mt-1 truncate text-xs text-slate-400">
                          {last}
                        </p>
                      </div>
                    </button>
                  );
                })
              ) : (
                <EmptyConversationList
                  search={search}
                  loading={loading}
                />
              )}
            </div>
          </aside>

          {/* Active chat */}
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-[#111722] px-4 py-3.5 sm:px-6">
              {selectedConversation ? (
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-xs font-bold text-white">
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
                    <h2 className="truncate text-sm font-extrabold text-white">
                      {selectedName}
                    </h2>

                    <p className="truncate text-xs font-semibold text-violet-400">
                      {getParticipantRole(
                        selectedConversation,
                        currentUser
                      ) || "Support"}
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Select a chat
                  </h2>

                  <p className="text-xs text-slate-500">
                    Choose a conversation from the list
                  </p>
                </div>
              )}
            </div>

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-[#0b1018] px-4 py-6 sm:px-6">
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
              <div className="shrink-0 border-t border-rose-900/50 bg-rose-950/40 px-4 py-2 text-xs text-rose-300">
                {messagesError}
              </div>
            )}

            <div className="shrink-0 border-t border-slate-800 bg-[#101620] p-3.5 sm:p-5">
              {selectedFiles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300"
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
                        className="ml-1 rounded-md text-slate-500 hover:text-rose-400"
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
                  aria-label="Attach files"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-40"
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
                          (message.trim() || selectedFiles.length) &&
                          selectedConversation &&
                          !sending
                        ) {
                          handleSendMessage(event);
                        }
                      }
                    }}
                    placeholder={
                      selectedConversation
                        ? `Message ${selectedName}...`
                        : "Select a chat first..."
                    }
                    rows={1}
                    disabled={!selectedConversation || sending}
                    className="min-h-11 max-h-32 w-full resize-y rounded-xl border border-slate-700 bg-[#0b1019] px-4 py-3 text-xs font-medium text-slate-200 outline-none placeholder:text-slate-500 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:opacity-50"
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
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-500 disabled:bg-slate-800 disabled:text-slate-500"
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

      {/* Delete confirmation */}
      {deleteModalOpen && messageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#111722] p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-950/60 text-rose-400">
                <Trash2 size={20} />
              </div>

              <div>
                <h3 className="text-base font-bold text-white">
                  Delete message?
                </h3>

                <p className="text-xs text-slate-400">
                  Choose how you want to delete this message.
                </p>
              </div>
            </div>

            <div className="mt-4 break-words rounded-xl bg-slate-900 p-3.5 text-xs italic text-slate-400">
              “
              {messageToDelete?.isDeletedForEveryone
                ? "This message was deleted"
                : messageToDelete?.body ||
                  messageToDelete?.message ||
                  "Message"}
              ”
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              {String(
                getMessageSenderId(messageToDelete) || ""
              ) === String(getUserId(currentUser) || "") &&
                !messageToDelete?.isDeletedForEveryone && (
                  <button
                    type="button"
                    disabled={deletingMessage}
                    onClick={() =>
                      executeDeleteMessage("everyone")
                    }
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
                  >
                    {deletingMessage ? (
                      <Loader2
                        size={15}
                        className="animate-spin"
                      />
                    ) : (
                      <Trash2 size={15} />
                    )}
                    Delete for Everyone
                  </button>
                )}

              <button
                type="button"
                disabled={deletingMessage}
                onClick={() => executeDeleteMessage("me")}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 text-xs font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
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
                className="h-9 w-full text-xs font-semibold text-slate-500 hover:text-slate-300"
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

  const senderId = getMessageSenderId(message);
  const myId = getUserId(currentUser);

  const outgoing = Boolean(
    senderId && myId && senderId === myId
  );

  const deleted = Boolean(message?.isDeletedForEveryone);

  const body = deleted
    ? "This message was deleted"
    : message?.body ?? message?.message ?? "";

  const sender =
    message?.sender?.name ||
    message?.sender?.fullName ||
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
        className={`relative opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 ${
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
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white"
            >
              <MoreVertical size={14} />
            </button>

            {menuOpen && (
              <div
                className={`absolute bottom-full z-20 mb-1 w-40 rounded-xl border border-slate-700 bg-[#151c28] py-1.5 shadow-xl ${
                  outgoing ? "right-0" : "left-0"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDeletePrompt(message);
                  }}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-bold text-rose-400 hover:bg-rose-950/40"
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
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[72%] ${
          outgoing ? "order-2" : "order-1"
        } ${
          deleted
            ? "border border-slate-700 bg-slate-900 italic text-slate-500"
            : outgoing
              ? "rounded-tr-sm bg-violet-600 text-white"
              : "rounded-tl-sm border border-slate-700 bg-[#151c28] text-slate-200"
        }`}
      >
        {!outgoing && sender && !deleted && (
          <p className="mb-1 text-[10px] font-bold text-violet-400">
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
                  attachment?.name ||
                  "Attachment";

                if (url === "#") {
                  return (
                    <div
                      key={attachment?._id || index}
                      className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400"
                    >
                      <FileText size={15} />
                      <span className="truncate">{name}</span>
                    </div>
                  );
                }

                return isImage ? (
                  <a
                    key={attachment?._id || attachment?.url || index}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-xl border border-slate-700 bg-black/20 p-1"
                  >
                    <img
                      src={url}
                      alt={name}
                      loading="lazy"
                      className="max-h-60 w-auto rounded-lg object-contain"
                    />
                  </a>
                ) : (
                  <a
                    key={attachment?._id || attachment?.url || index}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold ${
                      outgoing
                        ? "border-violet-400/30 bg-violet-700/60 text-white"
                        : "border-slate-700 bg-slate-900 text-slate-200"
                    }`}
                  >
                    <FileText
                      size={15}
                      className="shrink-0 text-violet-400"
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
              ? "text-slate-600"
              : outgoing
                ? "text-violet-200"
                : "text-slate-500"
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
    <div className="flex min-h-[240px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-violet-400">
        {loading ? (
          <Loader2 size={22} className="animate-spin" />
        ) : (
          <MessageSquare size={22} />
        )}
      </div>

      <h3 className="mt-4 text-sm font-bold text-slate-200">
        {loading
          ? "Loading conversations..."
          : search
            ? "No matching chats"
            : "No conversations yet"}
      </h3>

      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
        {loading
          ? "Please wait while your chats load."
          : search
            ? "No conversation matches your search."
            : "The backend has not returned a real conversation yet."}
      </p>
    </div>
  );
}

function NoConversationSelected() {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-violet-400">
        <MessageSquare size={25} />
      </div>

      <h3 className="mt-4 text-sm font-bold text-white">
        Select a chat
      </h3>

      <p className="mt-1 max-w-sm text-xs text-slate-500">
        Choose a conversation from the list.
      </p>
    </div>
  );
}

function NoMessages() {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-violet-400">
        <MessageSquare size={25} />
      </div>

      <h3 className="mt-4 text-sm font-bold text-white">
        No messages yet
      </h3>

      <p className="mt-1 text-xs text-slate-500">
        Send a message below to start the conversation.
      </p>
    </div>
  );
}

function ConversationLoading() {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center p-6 text-center">
      <Loader2
        size={26}
        className="animate-spin text-violet-400"
      />

      <p className="mt-3 text-xs font-semibold text-slate-400">
        Loading chats...
      </p>
    </div>
  );
}

function MessagesLoading() {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
      <Loader2
        size={32}
        className="animate-spin text-violet-400"
      />

      <p className="mt-3 text-xs font-semibold text-slate-400">
        Loading messages...
      </p>
    </div>
  );
}

function MessageError({ message }) {
  return (
    <div className="flex h-full min-h-[300px] items-center justify-center p-4">
      <div className="max-w-md rounded-xl border border-rose-900/60 bg-rose-950/40 p-4 text-center text-xs font-semibold text-rose-300">
        {message}
      </div>
    </div>
  );
}