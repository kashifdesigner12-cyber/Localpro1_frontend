"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  BellOff,
  Bold,
  Check,
  CheckCheck,
  CornerUpLeft,
  Download,
  Eye,
  FileText,
  Filter,
  Image as ImageIcon,
  Italic,
  List,
  Loader2,
  Lock,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Pin,
  Search,
  Send,
  ShieldCheck,
  Smile,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { io } from "socket.io-client";
import { authService } from "@/services/authService";

/* ============================================================
   MICROSOFT TEAMS DESIGN TOKENS (USER CONVERSATION VIEW)
   - Teams Purple: #5B5FC7 (hover: #4F52B2, active: #444791)
   - User Sent Bubble: #EEF1FD (border: #D8DDF8, text: #242424)
   - Admin Received Bubble: #FFFFFF (border: #E1DFDD, text: #242424)
   - Text Colors: #242424 (primary), #616161 (secondary)
   - Background Canvas: #F5F5F5
   - Strict Role Constraint: View Admin messages & reply to Admin only.
     No new chat creation, no group creation, no messaging other users.
============================================================ */

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "https://api.localpro1.net/api"
)
  .trim()
  .replace(/\/+$/, "");

const BACKEND_BASE_URL = API_URL.endsWith("/api")
  ? API_URL.slice(0, -4)
  : API_URL;

const DEFAULT_CONVERSATION_ID = "admin-default-chat";

/* -------------------- Helpers -------------------- */

function normalizeTokenValue(value) {
  if (!value) return "";
  let raw = String(value).trim().replace(/^Bearer\s+/i, "").trim();
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") {
      return parsed.replace(/^Bearer\s+/i, "").trim();
    }
    if (parsed && typeof parsed === "object") {
      const nestedToken =
        parsed.token ||
        parsed.accessToken ||
        parsed.access_token ||
        parsed.jwt ||
        parsed.authToken;
      if (nestedToken) {
        return String(nestedToken).replace(/^Bearer\s+/i, "").trim();
      }
    }
  } catch {}
  return raw;
}

function getStoredToken() {
  if (typeof window === "undefined") return "";
  const keys = [
    "token",
    "accessToken",
    "access_token",
    "authToken",
    "auth_token",
    "jwt",
    "userToken",
    "localpro_token",
    "localProToken",
  ];
  for (const key of keys) {
    try {
      const token = normalizeTokenValue(localStorage.getItem(key));
      if (token) return token;
    } catch {}
    try {
      const token = normalizeTokenValue(sessionStorage.getItem(key));
      if (token) return token;
    } catch {}
  }
  return "";
}

function getFileUrl(url) {
  if (!url) return "#";
  if (/^(https?:\/\/|blob:|data:)/i.test(url)) return url;
  return `${BACKEND_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function getUserId(user) {
  if (!user) return null;
  if (typeof user === "string" || typeof user === "number") return String(user);
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
    return value._id || value.id || value.conversationId
      ? String(value._id || value.id || value.conversationId)
      : null;
  }
  return value ? String(value) : null;
}

function getMessageId(message) {
  const id = message?._id || message?.id || message?.messageId;
  return id ? String(id) : "";
}

function getMessageText(message) {
  return message?.body || message?.message || "";
}

function getOtherParticipant(conversation, currentUser) {
  const participants = Array.isArray(conversation?.participants)
    ? conversation.participants
    : [];
  const currentId = getUserId(currentUser);
  const others = participants.filter((p) => {
    const pId = getUserId(p);
    return !(currentId && pId && String(currentId) === String(pId));
  });
  return (
    others.find((p) =>
      ["admin", "manager", "support"].includes(
        String(p?.role || "").toLowerCase()
      )
    ) ||
    others[0] ||
    conversation?.admin ||
    conversation?.support || {
      name: "Admin Support",
      role: "admin",
      title: "System Administrator",
    }
  );
}

function getParticipantName(conversation, currentUser) {
  const p = getOtherParticipant(conversation, currentUser);
  return (
    p?.name ||
    p?.fullName ||
    p?.displayName ||
    p?.username ||
    p?.email ||
    conversation?.name ||
    "Admin Support"
  );
}

function getParticipantAvatar(conversation, currentUser) {
  const p = getOtherParticipant(conversation, currentUser);
  return p?.avatar || p?.profileImage || p?.image || "";
}

function getInitials(name) {
  return (
    String(name || "A")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "A"
  );
}

function formatMessageTime(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatConversationDate(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatDayLabel(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

function normalizeConversations(response) {
  const value =
    response?.conversations ??
    response?.data?.conversations ??
    response?.results ??
    response?.data?.data?.conversations ??
    response?.data;
  return Array.isArray(value)
    ? value.filter(Boolean)
    : value && typeof value === "object"
    ? [value]
    : [];
}

function normalizeMessages(response) {
  const value =
    response?.messages ??
    response?.data?.messages ??
    response?.results ??
    response?.data?.data?.messages ??
    response?.data;
  return Array.isArray(value)
    ? value.filter(Boolean)
    : value && typeof value === "object"
    ? [value]
    : [];
}

function mergeMessages(existing = [], incoming = []) {
  const map = new Map();
  existing.forEach((msg) => {
    const id = getMessageId(msg);
    if (id) map.set(String(id), msg);
    else map.set(`${getMessageText(msg)}_${msg?.createdAt || ""}`, msg);
  });

  for (const message of incoming) {
    const id = getMessageId(message);
    const key = id
      ? String(id)
      : `${getMessageText(message)}_${message?.createdAt || ""}`;
    if (map.has(key)) {
      const prev = map.get(key);
      map.set(key, { ...prev, ...message, sending: false });
    } else {
      map.set(key, message);
    }
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(a?.createdAt || a?.sentAt || 0).getTime() -
      new Date(b?.createdAt || b?.sentAt || 0).getTime()
  );
}

function sameId(a, b) {
  return String(a ?? "") === String(b ?? "");
}

async function apiRequest(endpoint, options = {}) {
  const token = getStoredToken();
  const isForm =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    Accept: "application/json",
    ...(token
      ? { Authorization: `Bearer ${token}`, "x-auth-token": token }
      : {}),
    ...(isForm || !options.body ? {} : { "Content-Type": "application/json" }),
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
    if (text) data = JSON.parse(text);
  } catch {}
  if (!response.ok) {
    const error = new Error(
      response.status === 401
        ? (data?.message || "Your session has expired. Please sign in again.")
        : data?.message || data?.error || `Request failed (${response.status})`
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
  const conversationId = String(id ?? "").trim();
  if (
    !conversationId ||
    conversationId === DEFAULT_CONVERSATION_ID ||
    conversationId.startsWith("demo-")
  ) {
    return { messages: [] };
  }

  // This backend's getMessages controller reads req.params.conversationId.
  // Keep the id in the route path; a query-only request returns 400 on this API.
  return apiRequest(`/messages/${encodeURIComponent(conversationId)}?limit=100`);
}

async function markConversationRead(id) {
  if (!id || id === DEFAULT_CONVERSATION_ID) return;
  const conversationId = encodeURIComponent(id);
  try {
    // Canonical protected message route exposed by the LocalPro1 backend.
    return await apiRequest(`/messages/read/${conversationId}`, { method: "PUT" });
  } catch (error) {
    // Compatibility with deployments that still expose the legacy route.
    if (error?.status !== 404 && error?.status !== 405) throw error;
    return apiRequest(`/conversations/${conversationId}/read`, { method: "PUT" });
  }
}

function playNotificationSound() {
  try {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
    osc.start();
    osc.stop(ctx.currentTime + 0.17);
  } catch {}
}

/* -------------------- Sample Admin Channels (Fallback) -------------------- */
const DEMO_ADMIN_CONVERSATIONS = [
  {
    _id: "demo-admin-support",
    id: "demo-admin-support",
    name: "Admin Support",
    isGroup: false,
    participants: [
      {
        _id: "admin-nadeem",
        name: "Admin Support (Nadeem)",
        role: "admin",
        title: "System Administrator",
        email: "admin@localpro1.net",
        isOnline: true,
        status: "available",
      },
    ],
    lastMessage: "Please submit your weekly timesheet by 5:00 PM today.",
    lastMessageAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    unreadCount: 1,
  },
  {
    _id: "demo-admin-dispatch",
    id: "demo-admin-dispatch",
    name: "LocalPro Operations Desk",
    isGroup: false,
    participants: [
      {
        _id: "admin-dispatch",
        name: "Operations Dispatch",
        role: "admin",
        title: "Operations Coordinator",
        email: "dispatch@localpro1.net",
        isOnline: true,
        status: "available",
      },
    ],
    lastMessage: "Your assigned service order #8920 has been updated.",
    lastMessageAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    unreadCount: 0,
  },
];

const DEMO_ADMIN_MESSAGES = {
  "demo-admin-support": [
    {
      _id: "demo-adm-msg-1",
      id: "demo-adm-msg-1",
      conversationId: "demo-admin-support",
      sender: {
        _id: "admin-nadeem",
        name: "Admin Support",
        role: "admin",
      },
      body: "Hello! Welcome to the LocalPro communication portal. You can view all company notices and directly reply to our administrative team here.",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      attachments: [],
      reactions: [{ emoji: "👍", count: 1 }],
      status: "delivered",
    },
    {
      _id: "demo-adm-msg-2",
      id: "demo-adm-msg-2",
      conversationId: "demo-admin-support",
      sender: {
        _id: "admin-nadeem",
        name: "Admin Support",
        role: "admin",
      },
      body: "Please submit your weekly timesheet by 5:00 PM today.",
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      attachments: [],
      reactions: [],
      status: "delivered",
    },
  ],
  "demo-admin-dispatch": [
    {
      _id: "demo-adm-msg-3",
      id: "demo-adm-msg-3",
      conversationId: "demo-admin-dispatch",
      sender: {
        _id: "admin-dispatch",
        name: "Operations Dispatch",
        role: "admin",
      },
      body: "Your assigned service order #8920 has been updated.",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      attachments: [],
      reactions: [],
      status: "delivered",
    },
  ],
};

/* -------------------- Teams Presence Badge -------------------- */
function TeamsPresenceBadge({ status = "offline", className = "" }) {
  if (status === "available" || status === true) {
    return (
      <span
        title="Available"
        className={`flex items-center justify-center rounded-full border-2 border-white bg-[#237B4B] text-white shadow-xs ${className}`}
      >
        <Check size={8} strokeWidth={3} />
      </span>
    );
  }
  if (status === "busy") {
    return (
      <span
        title="Busy"
        className={`flex items-center justify-center rounded-full border-2 border-white bg-[#C4314B] shadow-xs ${className}`}
      />
    );
  }
  return (
    <span
      title="Offline"
      className={`flex items-center justify-center rounded-full border-2 border-white bg-[#8A8886] text-white shadow-xs ${className}`}
    >
      <X size={7} strokeWidth={2.5} />
    </span>
  );
}

/* ============================================================
   MAIN USER CONVERSATION PAGE (TEAMS UI)
============================================================ */
export default function UserConversationsPage() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [chatFilter, setChatFilter] = useState("all");

  // Teams Tabs: "chat" | "files" | "photos"
  const [headerTab, setHeaderTab] = useState("chat");

  // In-chat Search & Menu
  const [messageSearch, setMessageSearch] = useState("");
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Replying & Reactions
  const [replyingTo, setReplyingTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [formatActive, setFormatActive] = useState(false);
  const [pinnedChats, setPinnedChats] = useState(["demo-admin-support"]);
  const [mutedChats, setMutedChats] = useState([]);

  // Photo Lightbox
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);

  // Refs
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const socketRef = useRef(null);
  const selectedConversationIdRef = useRef(null);
  const currentUserRef = useRef(null);
  const conversationsRef = useRef([]);
  const messagesCache = useRef({});
  const processedMessageIdsRef = useRef(new Set());
  const sendingRef = useRef(false);

  // Handle outside clicks for menus
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedConversationId = getConversationId(selectedConversation);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  const scrollToBottom = useCallback((instant = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: instant ? "auto" : "smooth",
      block: "end",
    });
  }, []);

  useEffect(() => {
    if (messages.length) scrollToBottom(false);
  }, [messages, scrollToBottom]);

  /* -------------------- Load Conversations -------------------- */
  const loadConversations = useCallback(async (silent = false) => {
    try {
      if (!silent) setMessagesError("");
      let user = currentUserRef.current;
      let response;

      if (!user) {
        const [me, chats] = await Promise.all([
          authService.me().catch(() => null),
          safeApiRequest("/conversations"),
        ]);
        user = me?.user || me?.data || me;
        response = chats;
        if (user) {
          currentUserRef.current = user;
          setCurrentUser(user);
          try {
            localStorage.setItem("user", JSON.stringify(user));
          } catch {}
        }
      } else {
        response = await safeApiRequest("/conversations");
      }

      if (!response) {
        response = await safeApiRequest("/messages/conversations");
      }

      let list = normalizeConversations(response).filter((c) =>
        Boolean(getConversationId(c))
      );

      // Demo conversations are only for an unauthenticated preview. A successful
      // authenticated empty response must reflect the real backend state.
      if (!list.length && !getStoredToken()) {
        list = DEMO_ADMIN_CONVERSATIONS;
        messagesCache.current = {
          ...messagesCache.current,
          ...DEMO_ADMIN_MESSAGES,
        };
      }

      conversationsRef.current = list;
      setConversations(list);

      // Keep the selected chat if it still exists; otherwise select the first.
      setSelectedConversation((prev) => {
        const prevId = getConversationId(prev);
        if (prevId) {
          const exists = list.find((c) => getConversationId(c) === prevId);
          if (exists) return exists;
        }
        return list[0] || null;
      });
      if (!list.length) {
        selectedConversationIdRef.current = null;
        setMessages([]);
      }
    } catch (loadError) {
      if (loadError?.status === 401) {
        conversationsRef.current = [];
        setConversations([]);
        setSelectedConversation(null);
        setMessages([]);
        setMessagesError("Your session has expired. Please sign in again, then reopen Chat.");
      } else if (!getStoredToken()) {
        conversationsRef.current = DEMO_ADMIN_CONVERSATIONS;
        setConversations(DEMO_ADMIN_CONVERSATIONS);
        messagesCache.current = {
          ...messagesCache.current,
          ...DEMO_ADMIN_MESSAGES,
        };
        setSelectedConversation(DEMO_ADMIN_CONVERSATIONS[0]);
      } else {
        conversationsRef.current = [];
        setConversations([]);
        setSelectedConversation(null);
        setMessages([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations(false);
  }, [loadConversations]);

  /* -------------------- Load Messages for Chat -------------------- */
  const loadMessages = useCallback(async (id, silent = false) => {
    if (!id || id === DEFAULT_CONVERSATION_ID) return;
    const cId = String(id);

    if (cId.startsWith("demo-")) {
      const demoList =
        messagesCache.current[cId] || DEMO_ADMIN_MESSAGES[cId] || [];
      messagesCache.current[cId] = demoList;
      setMessages(demoList);
      setMessagesLoading(false);
      return;
    }

    try {
      if (!silent) setMessagesLoading(true);
      setMessagesError("");

      const cached = messagesCache.current[cId];
      if (cached && !silent) setMessages(cached);

      const response = await getConversationMessages(cId);
      const fetched = normalizeMessages(response);
      const merged = mergeMessages(cached || [], fetched);
      messagesCache.current[cId] = merged;

      if (sameId(selectedConversationIdRef.current, cId)) {
        setMessages(merged);
      }

      if (socketRef.current?.connected) {
        socketRef.current.emit("join_room", cId);
      }
    } catch (err) {
      if (!silent)
        setMessagesError(err?.message || "Unable to load messages.");
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = selectedConversationId;
    if (!id) {
      setMessages([]);
      return;
    }
    const cached = messagesCache.current[id];
    if (cached) setMessages(cached);
    loadMessages(id, Boolean(cached));
  }, [selectedConversationId, loadMessages]);

  /* -------------------- Socket Real-Time -------------------- */
  const handleIncomingMessage = useCallback(
    (payload) => {
      const incoming =
        payload?.message && typeof payload.message === "object"
          ? payload.message
          : payload?.data?.message && typeof payload.data.message === "object"
          ? payload.data.message
          : payload?.data &&
            typeof payload.data === "object" &&
            (payload.data._id || payload.data.id)
          ? payload.data
          : payload;

      if (!incoming || typeof incoming !== "object") return;

      const id = getMessageId(incoming);
      const conversationId = getMessageConversationId(incoming);
      if (!conversationId) return;

      if (id && processedMessageIdsRef.current.has(id)) return;
      if (id) {
        processedMessageIdsRef.current.add(id);
      }

      const senderId = getUserId(incoming.sender);
      const myId = getUserId(currentUserRef.current);
      const isOwn = Boolean(
        senderId && myId && String(senderId) === String(myId)
      );
      const active = sameId(selectedConversationIdRef.current, conversationId);

      const latest = messagesCache.current[conversationId] || [];
      const merged = mergeMessages(latest, [incoming]);
      messagesCache.current[conversationId] = merged;

      if (active) {
        setMessages(merged);
        markConversationRead(conversationId).catch(() => {});
        socketRef.current?.emit("mark_messages_read", { conversationId });
      }

      const preview =
        getMessageText(incoming) ||
        (incoming.attachments?.length ? "Attachment" : "");
      const time = incoming.createdAt || new Date().toISOString();

      setConversations((previous) => {
        return previous.map((conv) => {
          if (getConversationId(conv) !== String(conversationId)) return conv;
          const currentUnread = Number(conv.unreadCount || conv.unread || 0);
          const unread = active || isOwn ? 0 : currentUnread + 1;
          return {
            ...conv,
            lastMessage: preview,
            lastMessageAt: time,
            updatedAt: time,
            unreadCount: unread,
            unread,
          };
        });
      });

      if (!isOwn) {
        playNotificationSound();
      }
    },
    []
  );

  useEffect(() => {
    const socket = io(BACKEND_BASE_URL, {
      auth: { token: getStoredToken() },
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      const activeId = selectedConversationIdRef.current;
      if (activeId && activeId !== DEFAULT_CONVERSATION_ID) {
        socket.emit("join_room", activeId);
      }
    });
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("connect_error", () => setSocketConnected(false));

    const incomingEvents = [
      "receive_message",
      "new_message",
      "message:new",
      "message",
      "message_notification",
      "message_sent",
    ];
    incomingEvents.forEach((eventName) => {
      socket.on(eventName, handleIncomingMessage);
    });

    // Keep unread badges and the open chat in sync with backend read receipts.
    const handleMessagesRead = (payload) => {
      const conversationId =
        payload?.conversationId || payload?.roomId || payload?.conversation;
      if (!conversationId) return;
      const normalizedId = typeof conversationId === "object"
        ? getConversationId(conversationId)
        : String(conversationId);
      if (!normalizedId) return;
      setConversations((previous) => previous.map((conv) =>
        getConversationId(conv) === normalizedId
          ? { ...conv, unreadCount: 0, unread: 0 }
          : conv
      ));
    };
    ["messages_read", "message:read"].forEach((eventName) => {
      socket.on(eventName, handleMessagesRead);
    });

    return () => {
      incomingEvents.forEach((eventName) => socket.off(eventName, handleIncomingMessage));
      ["messages_read", "message:read"].forEach((eventName) => socket.off(eventName, handleMessagesRead));
      socket.disconnect();
    };
  }, [handleIncomingMessage]);

  /* -------------------- Select Conversation -------------------- */
  async function handleSelectConversation(conversation) {
    if (!conversation) return;
    const id = getConversationId(conversation);
    if (!id) return;

    setSelectedFiles([]);
    setMessagesError("");
    const previousId = selectedConversationIdRef.current;
    if (previousId && previousId !== id) {
      socketRef.current?.emit("leave_room", previousId);
    }
    setSelectedConversation(conversation);
    selectedConversationIdRef.current = id;
    if (socketRef.current?.connected) {
      socketRef.current.emit("join_room", id);
    }
    setHeaderTab("chat");
    setReplyingTo(null);

    const unread = Number(conversation.unreadCount || conversation.unread || 0);
    if (unread > 0) {
      try {
        await markConversationRead(id);
        socketRef.current?.emit("mark_messages_read", { conversationId: id });
        setConversations((prev) =>
          prev.map((c) =>
            getConversationId(c) === id
              ? { ...c, unreadCount: 0, unread: 0 }
              : c
          )
        );
      } catch {}
    }
    loadMessages(id, true);
  }

  /* -------------------- Send Reply to Admin -------------------- */
  async function handleSendMessage(e) {
    e?.preventDefault();
    const body = message.trim();
    const conversationId = getConversationId(selectedConversation);
    const files = [...selectedFiles];
    const replyTarget = replyingTo ? { ...replyingTo } : null;

    if ((!body && !files.length) || sendingRef.current) return;
    if (!conversationId || conversationId === DEFAULT_CONVERSATION_ID) return;

    const recipient = getOtherParticipant(selectedConversation, currentUser);
    const recipientId = getUserId(recipient);
    const tempId = `temp-${Date.now()}`;

    const optimisticMsg = {
      _id: tempId,
      id: tempId,
      conversationId,
      body,
      message: body,
      sender: currentUser || { name: "You", role: "user" },
      createdAt: new Date().toISOString(),
      attachments: files.map((file) => ({
        filename: file.name,
        originalName: file.name,
        mimeType: file.type,
        url: URL.createObjectURL(file),
      })),
      replyTo: replyTarget,
      sending: true,
      status: "delivered",
    };

    const latest = messagesCache.current[conversationId] || [];
    const nextList = mergeMessages(latest, [optimisticMsg]);
    messagesCache.current[conversationId] = nextList;
    setMessages(nextList);

    setMessage("");
    setSelectedFiles([]);
    setReplyingTo(null);
    setSending(true);
    sendingRef.current = true;
    scrollToBottom(true);

    // If demo mode, resolve locally
    if (String(conversationId).startsWith("demo-")) {
      setTimeout(() => {
        setSending(false);
        sendingRef.current = false;
        const resolved = nextList.map((m) =>
          getMessageId(m) === tempId ? { ...m, sending: false } : m
        );
        messagesCache.current[conversationId] = resolved;
        setMessages(resolved);
      }, 400);
      return;
    }

    try {
      let response;
      if (files.length) {
        const form = new FormData();
        form.append("conversationId", conversationId);
        form.append("body", body);
        form.append("clientMessageId", tempId);
        if (recipientId) form.append("recipientId", String(recipientId));
        if (replyTarget)
          form.append("replyToId", String(getMessageId(replyTarget)));
        files.forEach((file) => form.append("files", file));
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
            clientMessageId: tempId,
            replyToId: replyTarget ? getMessageId(replyTarget) : undefined,
          }),
        });
      }

      const sentCandidate =
        response?.messageData ||
        response?.message ||
        response?.data?.message ||
        response?.data?.data ||
        response?.data;
      const sent = sentCandidate && typeof sentCandidate === "object"
        ? sentCandidate
        : null;
      if (sent) {
        const updatedLatest = messagesCache.current[conversationId] || [];
        const finalMerged = mergeMessages(
          updatedLatest.filter((m) => getMessageId(m) !== tempId),
          [sent]
        );
        messagesCache.current[conversationId] = finalMerged;
        setMessages(finalMerged);
      } else {
        const latestAfterSend = messagesCache.current[conversationId] || [];
        const resolved = latestAfterSend.map((item) =>
          getMessageId(item) === tempId ? { ...item, sending: false } : item
        );
        messagesCache.current[conversationId] = resolved;
        setMessages(resolved);
      }
    } catch (err) {
      const latestAfterFailure = messagesCache.current[conversationId] || [];
      const withoutFailedOptimistic = latestAfterFailure.filter(
        (item) => getMessageId(item) !== tempId
      );
      messagesCache.current[conversationId] = withoutFailedOptimistic;
      if (sameId(selectedConversationIdRef.current, conversationId)) {
        setMessages(withoutFailedOptimistic);
      }
      setMessage((current) => current || body);
      setSelectedFiles((current) => current.length ? current : files);
      setReplyingTo((current) => current || replyTarget);
      setMessagesError(err?.message || "Failed to send reply to Admin.");
    } finally {
      setSending(false);
      sendingRef.current = false;
      messageInputRef.current?.focus();
    }
  }

  /* -------------------- Reactions -------------------- */
  async function handleAddReaction(messageId, emoji) {
    const conversationId = getConversationId(selectedConversation);
    const latest = messagesCache.current[conversationId] || messages;
    const updated = latest.map((m) => {
      if (getMessageId(m) === messageId) {
        const currentReactions = m.reactions || [];
        const existingIdx = currentReactions.findIndex(
          (r) => (typeof r === "string" ? r : r.emoji) === emoji
        );
        let nextReactions;
        if (existingIdx >= 0) {
          const item = currentReactions[existingIdx];
          const count = typeof item === "object" ? item.count || 1 : 1;
          if (count <= 1) {
            nextReactions = currentReactions.filter(
              (_, i) => i !== existingIdx
            );
          } else {
            nextReactions = currentReactions.map((r, i) =>
              i === existingIdx ? { ...r, count: count - 1 } : r
            );
          }
        } else {
          nextReactions = [
            ...currentReactions,
            { emoji, count: 1, userId: getUserId(currentUser) },
          ];
        }
        return { ...m, reactions: nextReactions };
      }
      return m;
    });

    messagesCache.current[conversationId] = updated;
    setMessages(updated);

    if (String(conversationId).startsWith("demo-")) return;

    try {
      await apiRequest(`/messages/${encodeURIComponent(messageId)}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      });
    } catch {}
  }

  const selectedName = selectedConversation
    ? getParticipantName(selectedConversation, currentUser)
    : "";
  const selectedOther = selectedConversation
    ? getOtherParticipant(selectedConversation, currentUser)
    : null;
  const selectedAvatar = selectedConversation
    ? getParticipantAvatar(selectedConversation, currentUser)
    : "";

  const filteredConversations = useMemo(() => {
    let source = conversations;
    if (chatFilter === "unread") {
      source = source.filter(
        (c) => Number(c.unreadCount || c.unread || 0) > 0
      );
    }
    const query = search.trim().toLowerCase();
    if (!query) return source;
    return source.filter((c) =>
      `${getParticipantName(c, currentUser)} ${
        c?.lastMessage || ""
      }`.toLowerCase().includes(query)
    );
  }, [conversations, chatFilter, search, currentUser]);

  const visibleMessages = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter((m) =>
      getMessageText(m).toLowerCase().includes(query)
    );
  }, [messages, messageSearch]);

  const photoAttachments = useMemo(() => {
    return messages.flatMap((m) =>
      (m.attachments || [])
        .filter(
          (att) =>
            String(att?.mimeType || att?.fileType || "").startsWith("image/") ||
            /\.(jpg|jpeg|png|webp|gif)$/i.test(att?.url || "")
        )
        .map((att) => ({ ...att, message: m }))
    );
  }, [messages]);

  const fileAttachments = useMemo(() => {
    return messages.flatMap((m) =>
      (m.attachments || [])
        .filter(
          (att) =>
            !String(att?.mimeType || att?.fileType || "").startsWith(
              "image/"
            ) && !/\.(jpg|jpeg|png|webp|gif)$/i.test(att?.url || "")
        )
        .map((att) => ({ ...att, message: m }))
    );
  }, [messages]);

  const appendEmoji = (emoji) => {
    setMessage((prev) => `${prev}${emoji}`);
    setShowEmojiPicker(false);
    messageInputRef.current?.focus();
  };

  const togglePin = (convId) => {
    const key = String(convId || selectedConversationId);
    setPinnedChats((prev) =>
      prev.includes(key) ? prev.filter((i) => i !== key) : [...prev, key]
    );
    setMenuOpen(false);
  };

  const toggleMute = (convId) => {
    const key = String(convId || selectedConversationId);
    setMutedChats((prev) =>
      prev.includes(key) ? prev.filter((i) => i !== key) : [...prev, key]
    );
    setMenuOpen(false);
  };

  return (
    <div className="flex h-full w-full min-h-0 flex-1 select-text overflow-hidden bg-[#F5F5F5] font-sans text-[#242424]">
      {/* ── MAIN WORKSPACE ── */}
      <section className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
        {/* ==========================================================
            TEAMS LEFT CHAT LIST (ADMIN CHANNELS ONLY)
        ========================================================== */}
        <aside
          className={`flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-r border-[#E1DFDD] bg-[#F5F5F5] transition-all md:w-[340px] lg:w-[360px] xl:w-[380px] ${
            selectedConversationId ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Header Bar */}
          <div className="flex shrink-0 items-center justify-between border-b border-[#E1DFDD] bg-[#F5F5F5] px-4 py-3">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[#242424]">
                Chat
              </h1>
              <span className="flex items-center gap-1 rounded bg-[#EEF1FD] px-1.5 py-0.5 text-[10px] font-semibold text-[#5B5FC7]">
                <ShieldCheck size={11} /> Admin Channels
              </span>
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  socketConnected ? "text-[#237B4B]" : "text-[#8A8886]"
                }`}
                title={socketConnected ? "Connected" : "Reconnecting"}
              >
                {socketConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
              </span>
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setChatFilter((prev) => (prev === "all" ? "unread" : "all"))
                }
                className={`flex h-8 w-8 items-center justify-center rounded transition ${
                  chatFilter === "unread"
                    ? "bg-[#EDEBE9] text-[#5B5FC7]"
                    : "text-[#616161] hover:bg-[#EDEBE9] hover:text-[#242424]"
                }`}
                title="Filter unread messages"
              >
                <Filter size={16} />
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="shrink-0 bg-[#F5F5F5] px-3 pb-2 pt-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#616161]"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Admin messages"
                className="h-8 w-full rounded border border-[#E1DFDD] bg-white pl-8 pr-3 text-xs text-[#242424] outline-none transition placeholder:text-[#616161] focus:border-[#5B5FC7] focus:ring-1 focus:ring-[#5B5FC7]"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8A8886] hover:text-[#242424]"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Read-only policy notice */}
            <div className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-[#616161]">
              <Lock size={11} className="shrink-0 text-[#8A8886]" />
              <span className="truncate">
                Admin-initiated conversations only
              </span>
            </div>
          </div>

          {/* Chat List Items */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {loading && conversations.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={22} className="animate-spin text-[#5B5FC7]" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="px-6 py-12 text-center text-[#616161]">
                <MessageSquare
                  size={28}
                  className="mx-auto mb-2 text-[#8A8886]"
                />
                <p className="text-xs font-semibold">No messages found</p>
                <p className="mt-1 text-[11px] text-[#8A8886]">
                  Messages sent by Administrators will appear here.
                </p>
              </div>
            ) : (
              <div className="py-1">
                <div className="flex items-center justify-between px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#616161]">
                  <span>Official Communications</span>
                </div>
                {filteredConversations.map((conv) => {
                  const id = getConversationId(conv);
                  const name = getParticipantName(conv, currentUser);
                  const avatar = getParticipantAvatar(conv, currentUser);
                  const isSelected = sameId(selectedConversationId, id);
                  const unread = Number(conv.unreadCount || conv.unread || 0);
                  const isPinned = pinnedChats.includes(String(id));
                  const isMuted = mutedChats.includes(String(id));

                  return (
                    <div
                      key={id}
                      onClick={() => handleSelectConversation(conv)}
                      className={`group relative flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors ${
                        isSelected
                          ? "bg-white text-[#242424] shadow-xs"
                          : "hover:bg-[#EDEBE9]"
                      }`}
                    >
                      {/* Purple selection bar */}
                      {isSelected && (
                        <span className="absolute left-0 top-0 h-full w-[3px] bg-[#5B5FC7]" />
                      )}

                      {/* Avatar with Presence */}
                      <div className="relative h-9 w-9 shrink-0">
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#5B5FC7] text-xs font-bold text-white shadow-xs">
                          {avatar ? (
                            <img
                              src={getFileUrl(avatar)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            getInitials(name)
                          )}
                        </div>
                        <TeamsPresenceBadge
                          status="available"
                          className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5"
                        />
                      </div>

                      {/* Text preview */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`truncate text-xs ${
                              unread > 0
                                ? "font-bold text-[#242424]"
                                : isSelected
                                ? "font-semibold text-[#242424]"
                                : "text-[#242424]"
                            }`}
                          >
                            {name}
                          </span>
                          <span className="shrink-0 text-[10px] text-[#616161]">
                            {formatConversationDate(
                              conv.lastMessageAt || conv.updatedAt
                            )}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-1">
                          <p
                            className={`truncate text-[11px] ${
                              unread > 0
                                ? "font-bold text-[#242424]"
                                : "text-[#616161]"
                            }`}
                          >
                            {conv.lastMessage || "Admin communication"}
                          </p>
                          <div className="flex shrink-0 items-center gap-1">
                            {isMuted && (
                              <BellOff size={11} className="text-[#8A8886]" />
                            )}
                            {isPinned && (
                              <Pin
                                size={11}
                                className="fill-[#5B5FC7] text-[#5B5FC7]"
                              />
                            )}
                            {unread > 0 && (
                              <span className="flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full bg-[#5B5FC7] px-1 text-[10px] font-bold text-white">
                                {unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ==========================================================
            TEAMS RIGHT CONVERSATION PANE (VIEW & REPLY DIRECTLY)
        ========================================================== */}
        <main
          className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white ${
            selectedConversationId ? "flex" : "hidden md:flex"
          }`}
        >
          {selectedConversationId ? (
            <>
              {/* Header Bar */}
              <header className="z-10 flex min-h-[58px] shrink-0 items-center justify-between border-b border-[#E1DFDD] bg-white px-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="mr-1 rounded p-1.5 text-[#616161] hover:bg-[#EDEBE9] md:hidden"
                    title="Back to chats"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  {/* Header Avatar */}
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#5B5FC7] text-xs font-bold text-white shadow-xs">
                    {selectedAvatar ? (
                      <img
                        src={getFileUrl(selectedAvatar)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(selectedName)
                    )}
                    <TeamsPresenceBadge
                      status="available"
                      className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5"
                    />
                  </div>

                  {/* Title & Tabs */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-sm font-bold text-[#242424]">
                        {selectedName}
                      </h2>
                      <span className="rounded bg-[#EEF1FD] px-1.5 py-0.5 text-[10px] font-semibold text-[#5B5FC7]">
                        Verified Admin
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-4">
                      {[
                        { id: "chat", label: "Chat" },
                        { id: "files", label: "Files" },
                        { id: "photos", label: "Photos" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setHeaderTab(tab.id)}
                          className={`relative pb-1 text-xs font-semibold transition ${
                            headerTab === tab.id
                              ? "text-[#5B5FC7]"
                              : "text-[#616161] hover:text-[#242424]"
                          }`}
                        >
                          {tab.label}
                          {headerTab === tab.id && (
                            <span className="absolute bottom-0 left-0 h-[2px] w-full bg-[#5B5FC7]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Options Toolbar */}
                <div
                  className="relative flex shrink-0 items-center gap-1 text-[#616161]"
                  ref={menuRef}
                >
                  {/* Search in chat */}
                  {showMessageSearch && (
                    <div className="absolute right-0 top-12 z-30 flex w-72 items-center rounded border border-[#E1DFDD] bg-white p-1.5 shadow-lg">
                      <Search size={14} className="ml-1 text-[#616161]" />
                      <input
                        autoFocus
                        value={messageSearch}
                        onChange={(e) => setMessageSearch(e.target.value)}
                        placeholder="Search in chat..."
                        className="min-w-0 flex-1 px-2 py-0.5 text-xs outline-none"
                      />
                      <button
                        onClick={() => {
                          setShowMessageSearch(false);
                          setMessageSearch("");
                        }}
                        className="rounded p-1 hover:bg-[#EDEBE9]"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => setShowMessageSearch((prev) => !prev)}
                    className="flex h-8 w-8 items-center justify-center rounded text-[#616161] transition hover:bg-[#EDEBE9] hover:text-[#242424]"
                    title="Search in chat"
                  >
                    <Search size={16} />
                  </button>
                  <button
                    onClick={() => setMenuOpen((prev) => !prev)}
                    className="flex h-8 w-8 items-center justify-center rounded text-[#616161] transition hover:bg-[#EDEBE9] hover:text-[#242424]"
                    title="More options"
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  {/* Options Menu */}
                  {menuOpen && (
                    <div className="absolute right-0 top-10 z-40 w-52 rounded-md border border-[#E1DFDD] bg-white py-1.5 shadow-lg">
                      <button
                        onClick={() => {
                          togglePin();
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-[#242424] hover:bg-[#F5F5F5]"
                      >
                        <Pin size={14} className="text-[#5B5FC7]" />
                        {pinnedChats.includes(String(selectedConversationId))
                          ? "Unpin chat"
                          : "Pin chat"}
                      </button>
                      <button
                        onClick={() => {
                          toggleMute();
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-[#242424] hover:bg-[#F5F5F5]"
                      >
                        {mutedChats.includes(String(selectedConversationId)) ? (
                          <Bell size={14} />
                        ) : (
                          <BellOff size={14} />
                        )}
                        {mutedChats.includes(String(selectedConversationId))
                          ? "Unmute"
                          : "Mute notifications"}
                      </button>
                    </div>
                  )}
                </div>
              </header>

              {/* Error Notice */}
              {messagesError && (
                <div className="flex shrink-0 items-center justify-between border-b border-[#F9D9DC] bg-[#FDF3F4] px-4 py-2 text-xs text-[#C4314B]">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>{messagesError}</span>
                  </div>
                  <button onClick={() => setMessagesError("")}>
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* ── TAB 1: CHAT CANVAS ── */}
              {headerTab === "chat" && (
                <>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white px-4 py-5 sm:px-6">
                    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                      {messagesLoading ? (
                        <div className="flex items-center justify-center py-16">
                          <Loader2
                            size={24}
                            className="animate-spin text-[#5B5FC7]"
                          />
                        </div>
                      ) : visibleMessages.length === 0 ? (
                        <div className="flex min-h-[300px] flex-1 flex-col items-center justify-center text-center">
                          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF1FD] text-[#5B5FC7]">
                            <MessageSquare size={26} />
                          </div>
                          <h3 className="text-sm font-bold text-[#242424]">
                            Official Admin Channel
                          </h3>
                          <p className="mt-1 max-w-xs text-xs text-[#616161]">
                            All updates from your administration team will appear here. You can reply directly below.
                          </p>
                        </div>
                      ) : (
                        visibleMessages.map((item, index) => {
                          const sender = item?.sender;
                          const senderId = getUserId(sender);
                          const myId = getUserId(currentUser);
                          const isOwn = Boolean(
                            (senderId && myId && sameId(senderId, myId)) ||
                              sender?.name === "You" ||
                              String(sender?.role || "").toLowerCase() === "user"
                          );
                          const msgId = getMessageId(item);
                          const isDeleted = Boolean(item?.isDeletedForEveryone);
                          const body = isDeleted
                            ? "This message was deleted."
                            : getMessageText(item);
                          const attachments = Array.isArray(item?.attachments)
                            ? item.attachments
                            : [];
                          const previous = visibleMessages[index - 1];
                          const showDay =
                            !previous ||
                            formatDayLabel(item?.createdAt) !==
                              formatDayLabel(previous?.createdAt);
                          const replyInfo = item?.replyTo;

                          return (
                            <div key={msgId || index} className="group relative">
                              {/* Date Separator */}
                              {showDay && (
                                <div className="my-4 flex items-center justify-center">
                                  <span className="rounded-full bg-[#F5F5F5] px-3 py-1 text-[11px] font-semibold text-[#616161] shadow-2xs">
                                    {formatDayLabel(item?.createdAt)}
                                  </span>
                                </div>
                              )}

                              {/* Message Row */}
                              <div
                                className={`flex w-full items-start gap-2.5 ${
                                  isOwn ? "flex-row-reverse" : "flex-row"
                                }`}
                              >
                                {/* Avatar */}
                                <div className="mt-0.5 h-8 w-8 shrink-0">
                                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#5B5FC7] text-[11px] font-bold text-white shadow-2xs">
                                    {isOwn ? (
                                      "You"
                                    ) : (
                                      getInitials(selectedName)
                                    )}
                                  </div>
                                </div>

                                {/* Bubble Box */}
                                <div
                                  className={`relative max-w-[85%] sm:max-w-[75%] ${
                                    isOwn ? "items-end" : "items-start"
                                  } flex flex-col`}
                                >
                                  {/* Header Info */}
                                  <div className="mb-1 flex items-center gap-2 px-1 text-[11px] text-[#616161]">
                                    <span className="font-semibold text-[#242424]">
                                      {isOwn ? "You" : selectedName}
                                    </span>
                                    {!isOwn && (
                                      <span className="rounded bg-[#EEF1FD] px-1 text-[10px] font-bold text-[#5B5FC7]">
                                        Admin
                                      </span>
                                    )}
                                    <span>
                                      {formatMessageTime(item?.createdAt)}
                                    </span>
                                  </div>

                                  {/* Bubble Content */}
                                  <div
                                    className={`relative rounded-xl px-4 py-2.5 text-xs shadow-2xs transition-shadow ${
                                      isDeleted
                                        ? "border border-[#E1DFDD] bg-[#F5F5F5] italic text-[#8A8886]"
                                        : isOwn
                                        ? "rounded-tr-xs border border-[#D8DDF8] bg-[#EEF1FD] text-[#242424]"
                                        : "rounded-tl-xs border border-[#E1DFDD] bg-white text-[#242424]"
                                    }`}
                                  >
                                    {/* Quoted Reply Block */}
                                    {replyInfo && !isDeleted && (
                                      <div className="mb-2 border-l-2 border-[#5B5FC7] bg-[#EDEBE9]/40 pl-2.5 py-1 text-[11px]">
                                        <p className="font-semibold text-[#5B5FC7]">
                                          Admin Support
                                        </p>
                                        <p className="line-clamp-2 text-[#616161]">
                                          {getMessageText(replyInfo) ||
                                            "Attachment"}
                                        </p>
                                      </div>
                                    )}

                                    {/* Text */}
                                    {body && (
                                      <p className="whitespace-pre-wrap break-words leading-relaxed">
                                        {body}
                                      </p>
                                    )}

                                    {/* Attachments */}
                                    {attachments.length > 0 && !isDeleted && (
                                      <div
                                        className={`flex flex-col gap-2 ${
                                          body ? "mt-2.5" : ""
                                        }`}
                                      >
                                        {attachments.map((att, attIdx) => {
                                          const fileUrl = getFileUrl(att?.url);
                                          const isImage =
                                            String(
                                              att?.mimeType ||
                                                att?.fileType ||
                                                ""
                                            ).startsWith("image/") ||
                                            /\.(jpg|jpeg|png|webp|gif)$/i.test(
                                              att?.url || ""
                                            );

                                          if (isImage) {
                                            return (
                                              <div
                                                key={`${att.url}-${attIdx}`}
                                                onClick={() =>
                                                  setPreviewPhotoUrl(fileUrl)
                                                }
                                                className="group/img relative cursor-pointer overflow-hidden rounded-lg border border-[#E1DFDD]"
                                              >
                                                <img
                                                  src={fileUrl}
                                                  alt="Attachment"
                                                  className="max-h-72 max-w-full rounded object-contain transition duration-150 group-hover/img:scale-[1.01]"
                                                  loading="lazy"
                                                />
                                                <div className="absolute right-2 top-2 rounded bg-black/60 p-1 text-white opacity-0 transition group-hover/img:opacity-100">
                                                  <Maximize2 size={13} />
                                                </div>
                                              </div>
                                            );
                                          }

                                          return (
                                            <a
                                              key={`${att.url}-${attIdx}`}
                                              href={fileUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex items-center gap-3 rounded-lg border border-[#E1DFDD] bg-white p-2.5 transition hover:bg-[#F5F5F5]"
                                            >
                                              <div className="flex h-8 w-8 items-center justify-center rounded bg-[#EEF1FD] text-[#5B5FC7]">
                                                <FileText size={17} />
                                              </div>
                                              <div className="min-w-0 flex-1">
                                                <p className="truncate text-xs font-semibold text-[#242424]">
                                                  {att.originalName ||
                                                    att.filename ||
                                                    "Document"}
                                                </p>
                                                <p className="text-[10px] text-[#616161]">
                                                  Attachment
                                                </p>
                                              </div>
                                              <Download
                                                size={14}
                                                className="text-[#616161]"
                                              />
                                            </a>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* Sent Status for User */}
                                    {isOwn && !isDeleted && (
                                      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#616161]">
                                        {item?.sending ? (
                                          <Loader2
                                            size={11}
                                            className="animate-spin text-[#5B5FC7]"
                                          />
                                        ) : item?.seen ? (
                                          <Eye
                                            size={12}
                                            className="text-[#5B5FC7]"
                                            title="Seen by Admin"
                                          />
                                        ) : (
                                          <CheckCheck
                                            size={12}
                                            className="text-[#616161]"
                                            title="Delivered to Admin"
                                          />
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Emoji Reactions Bar */}
                                  {item?.reactions?.length > 0 && (
                                    <div className="mt-1.5 flex flex-wrap gap-1 px-1">
                                      {item.reactions.map((r, rIdx) => {
                                        const emoji =
                                          typeof r === "string" ? r : r?.emoji;
                                        const count =
                                          typeof r === "object"
                                            ? r?.count ||
                                              r?.users?.length ||
                                              1
                                            : 1;
                                        if (!emoji) return null;
                                        return (
                                          <button
                                            key={`${emoji}-${rIdx}`}
                                            onClick={() =>
                                              handleAddReaction(msgId, emoji)
                                            }
                                            className="flex items-center gap-1 rounded-full border border-[#E1DFDD] bg-[#F5F5F5] px-2 py-0.5 text-[11px] transition hover:bg-white"
                                          >
                                            <span>{emoji}</span>
                                            {count > 1 && (
                                              <span className="font-semibold text-[#616161]">
                                                {count}
                                              </span>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                {/* Floating Reaction & Reply Bar on Hover */}
                                {!isDeleted && (
                                  <div
                                    className={`absolute top-0 z-20 hidden -translate-y-4 items-center rounded-full border border-[#E1DFDD] bg-white px-1.5 py-1 shadow-md group-hover:flex ${
                                      isOwn ? "left-12" : "right-12"
                                    }`}
                                  >
                                    {["👍", "❤️", "😂", "😮", "👏"].map(
                                      (emoji) => (
                                        <button
                                          key={emoji}
                                          onClick={() =>
                                            handleAddReaction(msgId, emoji)
                                          }
                                          className="rounded-full p-1 text-sm transition hover:scale-125 hover:bg-[#F5F5F5]"
                                          title={`React with ${emoji}`}
                                        >
                                          {emoji}
                                        </button>
                                      )
                                    )}
                                    <div className="mx-1 h-3.5 w-px bg-[#E1DFDD]" />
                                    {/* Reply Directly to Message */}
                                    <button
                                      onClick={() => {
                                        setReplyingTo(item);
                                        messageInputRef.current?.focus();
                                      }}
                                      className="rounded p-1 text-[#616161] hover:bg-[#F5F5F5] hover:text-[#5B5FC7]"
                                      title="Reply to message"
                                    >
                                      <CornerUpLeft size={13} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {/* ── TEAMS MESSAGE COMPOSER (REPLY DIRECTLY TO ADMIN) ── */}
                  <div className="shrink-0 bg-white px-4 pb-4 pt-1 sm:px-6">
                    <div className="mx-auto max-w-4xl">
                      {/* Replying Banner */}
                      {replyingTo && (
                        <div className="mb-2 flex items-center justify-between rounded-t border-l-2 border-[#5B5FC7] bg-[#EEF1FD] px-3 py-1.5 text-xs">
                          <div className="min-w-0">
                            <span className="font-semibold text-[#5B5FC7]">
                              Replying directly to Admin message
                            </span>
                            <p className="truncate text-[11px] text-[#616161]">
                              {getMessageText(replyingTo) || "Attachment"}
                            </p>
                          </div>
                          <button
                            onClick={() => setReplyingTo(null)}
                            className="rounded p-1 text-[#616161] hover:text-[#242424]"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}

                      {/* Selected Files Chips */}
                      {selectedFiles.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {selectedFiles.map((file, idx) => (
                            <div
                              key={`${file.name}-${idx}`}
                              className="flex items-center gap-2 rounded border border-[#D8DDF8] bg-[#EEF1FD] px-2.5 py-1 text-xs text-[#242424]"
                            >
                              <FileText size={13} className="text-[#5B5FC7]" />
                              <span className="max-w-[150px] truncate font-medium">
                                {file.name}
                              </span>
                              <span className="text-[10px] text-[#616161]">
                                {Math.ceil(file.size / 1024)} KB
                              </span>
                              <button
                                onClick={() =>
                                  setSelectedFiles((prev) =>
                                    prev.filter((_, i) => i !== idx)
                                  )
                                }
                                className="text-[#616161] hover:text-[#C4314B]"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Input Box */}
                      <form
                        onSubmit={handleSendMessage}
                        className="rounded-lg border border-[#E1DFDD] bg-white shadow-2xs transition focus-within:border-[#5B5FC7] focus-within:ring-1 focus-within:ring-[#5B5FC7]"
                      >
                        {formatActive && (
                          <div className="flex items-center gap-1 border-b border-[#E1DFDD] bg-[#F5F5F5] px-3 py-1 text-[#616161]">
                            <button
                              type="button"
                              onClick={() => setMessage((p) => `**${p}**`)}
                              className="rounded p-1 hover:bg-[#EDEBE9]"
                              title="Bold"
                            >
                              <Bold size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setMessage((p) => `*${p}*`)}
                              className="rounded p-1 hover:bg-[#EDEBE9]"
                              title="Italic"
                            >
                              <Italic size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setMessage((p) => `\n- ${p}`)}
                              className="rounded p-1 hover:bg-[#EDEBE9]"
                              title="Bullet list"
                            >
                              <List size={13} />
                            </button>
                          </div>
                        )}

                        <div className="px-3 pt-2.5">
                          <textarea
                            ref={messageInputRef}
                            value={message}
                            onChange={(e) => {
                              setMessage(e.target.value);
                              e.target.style.height = "40px";
                              e.target.style.height = `${Math.min(
                                e.target.scrollHeight,
                                120
                              )}px`;
                            }}
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                !e.shiftKey &&
                                !e.nativeEvent.isComposing
                              ) {
                                e.preventDefault();
                                handleSendMessage(e);
                              }
                            }}
                            placeholder={`Reply directly to ${selectedName}...`}
                            rows={1}
                            className="min-h-[40px] max-h-32 w-full resize-none bg-transparent text-xs leading-relaxed text-[#242424] outline-none placeholder:text-[#616161]"
                          />
                        </div>

                        {/* Composer Toolbar */}
                        <div className="flex items-center justify-between px-2 pb-2 pt-1 text-[#616161]">
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => setFormatActive((prev) => !prev)}
                              className={`rounded p-1.5 transition ${
                                formatActive
                                  ? "bg-[#EDEBE9] text-[#5B5FC7]"
                                  : "hover:bg-[#EDEBE9] hover:text-[#242424]"
                              }`}
                              title="Formatting"
                            >
                              <Pencil size={15} />
                            </button>

                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="rounded p-1.5 transition hover:bg-[#EDEBE9] hover:text-[#242424]"
                              title="Attach file"
                            >
                              <Paperclip size={15} />
                            </button>

                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="rounded p-1.5 transition hover:bg-[#EDEBE9] hover:text-[#242424]"
                              title="Add image"
                            >
                              <ImageIcon size={15} />
                            </button>

                            {/* Emoji Picker */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setShowEmojiPicker((prev) => !prev)
                                }
                                className="rounded p-1.5 transition hover:bg-[#EDEBE9] hover:text-[#242424]"
                                title="Emoji"
                              >
                                <Smile size={15} />
                              </button>
                              {showEmojiPicker && (
                                <div className="absolute bottom-9 left-0 z-40 grid grid-cols-6 gap-1 rounded-md border border-[#E1DFDD] bg-white p-2 shadow-lg">
                                  {[
                                    "😀",
                                    "😂",
                                    "😍",
                                    "👍",
                                    "❤️",
                                    "🎉",
                                    "🙏",
                                    "😊",
                                    "😮",
                                    "😢",
                                    "🔥",
                                    "✅",
                                    "👏",
                                    "🤝",
                                    "💯",
                                    "👀",
                                    "🙌",
                                    "🤔",
                                  ].map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => appendEmoji(emoji)}
                                      className="rounded p-1.5 text-base hover:bg-[#EDEBE9]"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            <input
                              ref={fileInputRef}
                              type="file"
                              multiple
                              onChange={(e) => {
                                const incoming = Array.from(
                                  e.target.files || []
                                );
                                setSelectedFiles((prev) => [
                                  ...prev,
                                  ...incoming,
                                ]);
                                e.target.value = "";
                              }}
                              className="hidden"
                            />
                          </div>

                          {/* Send Button */}
                          <button
                            type="submit"
                            disabled={
                              (!message.trim() &&
                                selectedFiles.length === 0) ||
                              sending
                            }
                            className="flex h-7 w-7 items-center justify-center rounded text-[#5B5FC7] transition hover:bg-[#EEF1FD] disabled:cursor-not-allowed disabled:text-[#8A8886]"
                            title="Send reply (Enter)"
                          >
                            {sending ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Send size={16} />
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </>
              )}

              {/* ── TAB 2: FILES ── */}
              {headerTab === "files" && (
                <div className="flex-1 overflow-y-auto bg-white p-6">
                  <div className="mx-auto max-w-4xl">
                    <h3 className="mb-4 text-sm font-bold text-[#242424]">
                      Shared Documents with Admin
                    </h3>
                    {fileAttachments.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[#E1DFDD] p-12 text-center text-xs text-[#616161]">
                        No files shared in this conversation yet.
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-lg border border-[#E1DFDD]">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-[#E1DFDD] bg-[#F5F5F5] font-semibold text-[#616161]">
                            <tr>
                              <th className="px-4 py-2.5">Name</th>
                              <th className="px-4 py-2.5">Date</th>
                              <th className="px-4 py-2.5">Sender</th>
                              <th className="px-4 py-2.5 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E1DFDD]">
                            {fileAttachments.map((att, idx) => (
                              <tr key={idx} className="hover:bg-[#F5F5F5]">
                                <td className="flex items-center gap-2.5 px-4 py-3 font-medium text-[#242424]">
                                  <FileText
                                    size={16}
                                    className="text-[#5B5FC7]"
                                  />
                                  <span className="truncate max-w-[220px]">
                                    {att.originalName || att.filename || "File"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-[#616161]">
                                  {formatConversationDate(
                                    att.message?.createdAt
                                  )}
                                </td>
                                <td className="px-4 py-3 text-[#616161]">
                                  {sameId(
                                    getUserId(att.message?.sender),
                                    getUserId(currentUser)
                                  )
                                    ? "You"
                                    : "Admin"}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <a
                                    href={getFileUrl(att.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-[#5B5FC7] hover:underline"
                                  >
                                    Open
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── TAB 3: PHOTOS ── */}
              {headerTab === "photos" && (
                <div className="flex-1 overflow-y-auto bg-white p-6">
                  <div className="mx-auto max-w-4xl">
                    <h3 className="mb-4 text-sm font-bold text-[#242424]">
                      Shared Photos
                    </h3>
                    {photoAttachments.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[#E1DFDD] p-12 text-center text-xs text-[#616161]">
                        No photos shared in this conversation yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {photoAttachments.map((att, idx) => (
                          <div
                            key={idx}
                            onClick={() =>
                              setPreviewPhotoUrl(getFileUrl(att.url))
                            }
                            className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-[#E1DFDD] bg-[#F5F5F5]"
                          >
                            <img
                              src={getFileUrl(att.url)}
                              alt="Photo"
                              loading="lazy"
                              className="h-full w-full object-cover transition duration-150 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 transition group-hover:opacity-100 flex items-center justify-center text-white">
                              <Maximize2 size={18} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="hidden flex-1 flex-col items-center justify-center bg-white px-6 text-center md:flex">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#EEF1FD] text-[#5B5FC7]">
                <MessageSquare size={36} strokeWidth={1.7} />
              </div>
              <h2 className="text-base font-bold text-[#242424]">
                Select an Admin conversation
              </h2>
              <p className="mt-1 max-w-sm text-xs text-[#616161]">
                Pick an official Admin channel from the left panel to review company notices and send direct replies.
              </p>
            </div>
          )}
        </main>
      </section>

      {/* ==========================================================
          PHOTO LIGHTBOX MODAL
      ========================================================== */}
      {previewPhotoUrl && (
        <div
          onClick={() => setPreviewPhotoUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-lg bg-black"
          >
            <button
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/90"
            >
              <X size={18} />
            </button>
            <img
              src={previewPhotoUrl}
              alt="Enlarged preview"
              className="max-h-[85vh] max-w-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}