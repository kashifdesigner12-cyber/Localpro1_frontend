"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  Archive,
  Bell,
  BellOff,
  Bookmark,
  Check,
  CheckCheck,
  ChevronDown,
  FileText,
  Eye,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Send,
  Smile,
  Trash2,
  Users,
  Video,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";

/* ============================================================
   API CONFIG
============================================================ */

const RAW_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.localpro1.net/api";
const CLEAN_API_URL = String(RAW_API_URL).trim().replace(/\/+$/, "");
const API_BASE_URL = CLEAN_API_URL.endsWith("/api")
  ? CLEAN_API_URL
  : `${CLEAN_API_URL}/api`;
const BACKEND_BASE_URL = API_BASE_URL.endsWith("/api")
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL;

const getApiUrl = (path = "") => {
  const cleanPath = String(path).startsWith("/") ? String(path) : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};

const getFileUrl = (url) => {
  if (!url) return "#";
  const value = String(url);
  if (/^(https?:\/\/|blob:|data:)/i.test(value)) return value;
  return `${BACKEND_BASE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
};

/* ============================================================
   AUTH / RESPONSE HELPERS
============================================================ */

const normalizeTokenValue = (value) => {
  if (!value) return null;
  let raw = String(value).trim().replace(/^Bearer\s+/i, "").trim();
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") {
      return parsed.replace(/^Bearer\s+/i, "").trim() || null;
    }
    if (parsed && typeof parsed === "object") {
      const token =
        parsed.token || parsed.accessToken || parsed.access_token || parsed.jwt;
      if (token) return String(token).replace(/^Bearer\s+/i, "").trim();
    }
  } catch {}
  return raw || null;
};

const getStoredToken = () => {
  if (typeof window === "undefined") return null;
  const keys = ["token", "accessToken", "access_token", "authToken", "auth_token", "jwt"];
  for (const key of keys) {
    try {
      const value = normalizeTokenValue(localStorage.getItem(key));
      if (value) return value;
    } catch {}
    try {
      const value = normalizeTokenValue(sessionStorage.getItem(key));
      if (value) return value;
    } catch {}
  }
  return null;
};

const getAuthHeaders = (includeContentType = true) => {
  const headers = { Accept: "application/json" };
  const token = getStoredToken();
  if (includeContentType) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

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
  if (typeof item === "string" || typeof item === "number") return item;
  return (
    item._id ||
    item.id ||
    item.userId?._id ||
    item.userId?.id ||
    null
  );
};

const getUserName = (user) =>
  user?.name || user?.fullName || user?.username || user?.email || "Unknown User";
const getUserAvatar = (user) =>
  user?.avatar || user?.profileImage || user?.image || user?.profilePic || "";
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
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatConversationTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const formatDayLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
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
  if (Array.isArray(data?.data?.conversations)) return data.data.conversations;
  return [];
};

const extractMessages = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.messages)) return data.messages;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.messages)) return data.data.messages;
  if (Array.isArray(data?.data?.messages?.data)) return data.data.messages.data;
  if (Array.isArray(data?.data?.messages?.messages)) return data.data.messages.messages;
  if (Array.isArray(data?.conversation?.messages)) return data.conversation.messages;
  return [];
};

const getMessageId = (message) => message?._id || message?.id || null;
const getConversationId = (conversation) => conversation?._id || conversation?.id || null;

const getConversationIdFromMessage = (message) => {
  const value =
    message?.conversationId ||
    message?.conversation?._id ||
    message?.conversation?.id ||
    message?.conversation ||
    message?.chatId;
  if (value && typeof value === "object") return value._id || value.id || null;
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
    if (Number.isFinite(number) && number > 0) return number;
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
  getId(message?.sender) || getId(message?.senderId) || null;
const getMessageBody = (message) =>
  message?.body || message?.message || message?.content || "";
const getMessageText = (message) => {
  const body = getMessageBody(message);
  if (body) return body;
  const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
  if (attachments.some((a) => String(a?.mimeType || a?.fileType || "").startsWith("image/"))) {
    return "Photo";
  }
  return attachments.length ? attachments[0]?.originalName || attachments[0]?.filename || "Attachment" : "";
};

const unwrapSocketMessage = (payload) => {
  if (!payload) return null;
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
    if (getMessageId(candidate) || getConversationIdFromMessage(candidate)) return candidate;
  }
  return null;
};

const normalizeMessage = (message, conversationId) => {
  if (!message || typeof message !== "object") return message;
  const sender = message.sender || message.senderId || message.user || null;
  return {
    ...message,
    _id: message._id || message.id,
    id: message.id || message._id,
    body: getMessageBody(message),
    sender,
    conversationId: getConversationIdFromMessage(message) || conversationId,
    attachments: Array.isArray(message.attachments) ? message.attachments : [],
    reactions: Array.isArray(message.reactions) ? message.reactions : [],
  };
};

const revokeTemporaryAttachmentUrls = (message) => {
  (Array.isArray(message?.attachments) ? message.attachments : []).forEach((att) => {
    if (
      att?.isLocalPreview &&
      typeof att.url === "string" &&
      att.url.startsWith("blob:")
    ) {
      URL.revokeObjectURL(att.url);
    }
  });
};

const playNotificationSound = () => {
  try {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.19);
    osc.onended = () => ctx.close().catch(() => {});
  } catch {}
};

const showDesktopNotification = (title, body) => {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) return;
  try {
    new Notification(title, {
      body: body || "New message received",
      icon: "/favicon.ico",
    });
  } catch {}
};

const sameId = (a, b) => String(a ?? "") === String(b ?? "");

/* ============================================================
   UI PREVIEW DATA — used only when the backend returns no users
   or cannot be reached. This lets the chat UI be reviewed before
   backend integration; demo messages stay in this browser only.
============================================================ */
const DEMO_USERS = [
  { _id: "demo-nadeem", id: "demo-nadeem", name: "Nadeem Nawaz", role: "Support", isOnline: true },
  { _id: "demo-ayesha", id: "demo-ayesha", name: "Ayesha Khan", role: "Manager", isOnline: true },
  { _id: "demo-usman", id: "demo-usman", name: "Usman Ali", role: "Support", isOnline: false },
];
const DEMO_CONVERSATIONS = [
  { _id: "demo-conv-nadeem", id: "demo-conv-nadeem", participants: [DEMO_USERS[0]], isGroup: false, lastMessage: "I have shared the updated details.", lastMessageAt: new Date().toISOString(), unreadCount: 1 },
  { _id: "demo-conv-group", id: "demo-conv-group", participants: DEMO_USERS, isGroup: true, groupName: "Test Group", lastMessage: "Nadeem: Welcome to the group", lastMessageAt: new Date(Date.now() - 86400000).toISOString(), unreadCount: 0 },
  { _id: "demo-conv-ayesha", id: "demo-conv-ayesha", participants: [DEMO_USERS[1]], isGroup: false, lastMessage: "Thanks, that works for me.", lastMessageAt: new Date(Date.now() - 3600000).toISOString(), unreadCount: 0 },
];
const DEMO_MESSAGES = {
  "demo-conv-nadeem": [
    { _id: "demo-msg-1", id: "demo-msg-1", conversationId: "demo-conv-nadeem", sender: DEMO_USERS[0], body: "Hi! Are you available?", createdAt: new Date(Date.now() - 86400000).toISOString(), attachments: [], reactions: [] },
    { _id: "demo-msg-2", id: "demo-msg-2", conversationId: "demo-conv-nadeem", sender: { _id: "demo-current-admin", id: "demo-current-admin", name: "You", role: "admin" }, body: "Yes, tell me what you need.", createdAt: new Date(Date.now() - 85000000).toISOString(), attachments: [], reactions: [] },
    { _id: "demo-msg-3", id: "demo-msg-3", conversationId: "demo-conv-nadeem", sender: DEMO_USERS[0], body: "I have shared the updated details.", createdAt: new Date(Date.now() - 1800000).toISOString(), attachments: [], reactions: [] },
  ],
  "demo-conv-group": [
    { _id: "demo-group-msg-1", id: "demo-group-msg-1", conversationId: "demo-conv-group", sender: DEMO_USERS[0], body: "Welcome to the group", createdAt: new Date(Date.now() - 86400000).toISOString(), attachments: [], reactions: [] },
    { _id: "demo-group-msg-2", id: "demo-group-msg-2", conversationId: "demo-conv-group", sender: DEMO_USERS[1], body: "Thanks everyone 👋", createdAt: new Date(Date.now() - 85000000).toISOString(), attachments: [], reactions: [] },
  ],
  "demo-conv-ayesha": [
    { _id: "demo-ayesha-msg-1", id: "demo-ayesha-msg-1", conversationId: "demo-conv-ayesha", sender: DEMO_USERS[1], body: "I reviewed the latest update.", createdAt: new Date(Date.now() - 7200000).toISOString(), attachments: [], reactions: [] },
    { _id: "demo-ayesha-msg-2", id: "demo-ayesha-msg-2", conversationId: "demo-conv-ayesha", sender: { _id: "demo-current-admin", id: "demo-current-admin", name: "You", role: "admin" }, body: "Thanks, that works for me.", createdAt: new Date(Date.now() - 3600000).toISOString(), attachments: [], reactions: [] },
  ],
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
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [startingConversation, setStartingConversation] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [messageActionBusy, setMessageActionBusy] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [headerTab, setHeaderTab] = useState("chat");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [chatFilter, setChatFilter] = useState("all");
  const [favorites, setFavorites] = useState([]);
  const [mutedChats, setMutedChats] = useState([]);
  const [pinnedChats, setPinnedChats] = useState([]);
  const [showContactPicker, setShowContactPicker] = useState(false);

  const menuRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const socketRef = useRef(null);
  const selectedConversationIdRef = useRef(null);
  const conversationsRef = useRef([]);
  const usersRef = useRef([]);
  const messagesCache = useRef({});
  const processedSocketMessages = useRef(new Set());
  const refreshTimerRef = useRef(null);
  const mountedRef = useRef(false);
  const fetchingMessagesRef = useRef(new Set());
  const sendingRef = useRef(false);
  const activeRequestRef = useRef(0);

  useEffect(() => {
    setIsClient(true);
    mountedRef.current = true;
    try {
      const cachedUsers = JSON.parse(localStorage.getItem("localpro_admin_users") || "[]");
      const cachedConvs = JSON.parse(localStorage.getItem("localpro_admin_convs") || "[]");
      const cachedMsgs = JSON.parse(localStorage.getItem("localpro_admin_msgs") || "{}");
      const prefs = JSON.parse(localStorage.getItem("localpro_admin_chat_prefs") || "{}");
      if (Array.isArray(cachedUsers)) {
        setUsers(cachedUsers);
        usersRef.current = cachedUsers;
      }
      if (Array.isArray(cachedConvs)) {
        setConversations(cachedConvs);
        conversationsRef.current = cachedConvs;
        setLoadingUsers(false);
      }
      if (cachedMsgs && typeof cachedMsgs === "object") messagesCache.current = cachedMsgs;
      if (Array.isArray(prefs.favorites)) setFavorites(prefs.favorites);
      if (Array.isArray(prefs.mutedChats)) setMutedChats(prefs.mutedChats);
      if (Array.isArray(prefs.pinnedChats)) setPinnedChats(prefs.pinnedChats);
    } catch {}

    return () => {
      mountedRef.current = false;
      Object.values(messagesCache.current).forEach((list) => {
        if (Array.isArray(list)) list.forEach(revokeTemporaryAttachmentUrls);
      });
    };
  }, []);

  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => { selectedConversationIdRef.current = selectedConversationId; }, [selectedConversationId]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "localpro_admin_chat_prefs",
        JSON.stringify({ favorites, mutedChats, pinnedChats })
      );
    } catch {}
  }, [favorites, mutedChats, pinnedChats]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      // Ask only after an explicit user gesture in production; do not prompt on page load.
    }
  }, []);

  const saveCache = useCallback((uList, cList, mCache) => {
    if (typeof window === "undefined") return;
    try {
      if (Array.isArray(uList)) localStorage.setItem("localpro_admin_users", JSON.stringify(uList));
      if (Array.isArray(cList)) localStorage.setItem("localpro_admin_convs", JSON.stringify(cList));
      if (mCache && typeof mCache === "object") {
        const safeCache = {};
        Object.entries(mCache).forEach(([cId, list]) => {
          if (!Array.isArray(list)) return;
          safeCache[cId] = list.filter((item) => !String(getMessageId(item) || "").startsWith("temp-"));
        });
        localStorage.setItem("localpro_admin_msgs", JSON.stringify(safeCache));
      }
    } catch {}
  }, []);

  const scrollToBottom = useCallback((instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? "auto" : "smooth", block: "end" });
  }, []);

  useEffect(() => {
    if (messages.length) scrollToBottom(false);
  }, [messages, scrollToBottom]);

  const fetchData = useCallback(async (force = false) => {
    try {
      const [usersRes, conversationsRes] = await Promise.all([
        fetch(getApiUrl("/users"), {
          method: "GET",
          credentials: "include",
          headers: getAuthHeaders(),
          cache: force ? "no-store" : "default",
        }),
        fetch(getApiUrl("/conversations"), {
          method: "GET",
          credentials: "include",
          headers: getAuthHeaders(),
          cache: "no-store",
        }),
      ]);

      if (usersRes.status === 401 || conversationsRes.status === 401) {
        router.replace("/login");
        return;
      }
      const [usersData, conversationsData] = await Promise.all([
        parseResponse(usersRes),
        parseResponse(conversationsRes),
      ]);

      const receivedUsers = normalizeUsers(usersData);
      const receivedConversations = normalizeConversations(conversationsData);
      // When no backend data is available yet, show a complete interactive preview.
      if (receivedUsers.length === 0 && receivedConversations.length === 0) {
        if (mountedRef.current) {
          setDemoMode(true);
          setUsers(DEMO_USERS);
          usersRef.current = DEMO_USERS;
          setConversations(DEMO_CONVERSATIONS);
          conversationsRef.current = DEMO_CONVERSATIONS;
          messagesCache.current = { ...messagesCache.current, ...DEMO_MESSAGES };
          saveCache(DEMO_USERS, DEMO_CONVERSATIONS, messagesCache.current);
        }
        return;
      }
      if (mountedRef.current) setDemoMode(false);
      if (usersRes.ok) {
        const list = receivedUsers;
        if (mountedRef.current) {
          setUsers(list);
          usersRef.current = list;
          saveCache(list, conversationsRef.current, messagesCache.current);
        }
      }
      if (conversationsRes.ok) {
        const list = receivedConversations;
        if (mountedRef.current) {
          setConversations((previous) => {
            // Keep locally-known last-message/read state until fresh server values replace it.
            const merged = list.map((incoming) => {
              const old = previous.find((item) => sameId(getConversationId(item), getConversationId(incoming)));
              if (!old) return incoming;
              return {
                ...old,
                ...incoming,
                lastMessage: incoming.lastMessage ?? old.lastMessage,
                lastMessageAt: incoming.lastMessageAt ?? old.lastMessageAt,
              };
            });
            conversationsRef.current = merged;
            saveCache(usersRef.current, merged, messagesCache.current);
            return merged;
          });
        }
      }
    } catch {
      // Keep cached content visible; if there is no cache, use the UI preview data.
      if (mountedRef.current && usersRef.current.length === 0 && conversationsRef.current.length === 0) {
        setDemoMode(true);
        setUsers(DEMO_USERS);
        usersRef.current = DEMO_USERS;
        setConversations(DEMO_CONVERSATIONS);
        conversationsRef.current = DEMO_CONVERSATIONS;
        messagesCache.current = { ...messagesCache.current, ...DEMO_MESSAGES };
        saveCache(DEMO_USERS, DEMO_CONVERSATIONS, messagesCache.current);
      }
    } finally {
      if (mountedRef.current) setLoadingUsers(false);
    }
  }, [router, saveCache]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => fetchData(true), 450);
  }, [fetchData]);

  useEffect(() => {
    if (!isClient) return;
    fetchData(false);
    // Low-frequency fallback refreshes conversation metadata only; messages are socket-driven.
    const interval = setInterval(() => fetchData(true), 60000);
    return () => {
      clearInterval(interval);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [isClient, fetchData]);

  const findConversationForUser = useCallback((userId, list = conversationsRef.current) => {
    if (!userId) return null;
    return list.find((conversation) => {
      if (conversation?.isGroup) return false;
      const participants = Array.isArray(conversation?.participants) ? conversation.participants : [];
      return participants.some((participant) => sameId(getId(participant), userId));
    }) || null;
  }, []);

  const fetchMessages = useCallback(async (conversationId, silent = false) => {
    if (!conversationId) return [];
    const cId = String(conversationId);
    if (cId.startsWith("demo-") || demoMode) {
      const demoMessages = messagesCache.current[cId] || DEMO_MESSAGES[cId] || [];
      messagesCache.current[cId] = demoMessages;
      setMessages(demoMessages);
      return demoMessages;
    }
    if (fetchingMessagesRef.current.has(cId)) return messagesCache.current[cId] || [];
    fetchingMessagesRef.current.add(cId);
    const requestId = ++activeRequestRef.current;
    const cached = messagesCache.current[cId];

    if (cached && Array.isArray(cached) && cached.length > 0 && !silent) setMessages(cached);

    try {
      const response = await fetch(getApiUrl(`/messages?conversationId=${encodeURIComponent(cId)}&limit=100`), {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
        cache: "no-store",
      });
      const data = await parseResponse(response);
      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || "Failed to load messages.");
      }

      const fetched = extractMessages(data).map((item) => normalizeMessage(item, cId));
      if (!sameId(selectedConversationIdRef.current, cId)) return fetched;

      setMessages((previous) => {
        const current = previous.filter((item) => !String(getMessageId(item) || "").startsWith("temp-"));
        const byId = new Map();
        [...fetched, ...current].forEach((item) => {
          const id = getMessageId(item);
          if (id) byId.set(String(id), { ...(byId.get(String(id)) || {}), ...item });
        });
        const merged = Array.from(byId.values()).sort(
          (a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime()
        );
        messagesCache.current[cId] = merged;
        saveCache(usersRef.current, conversationsRef.current, messagesCache.current);
        return merged;
      });
      return fetched;
    } catch (error) {
      if (!silent && sameId(selectedConversationIdRef.current, cId)) {
        setMessagesError(error?.message || "Unable to load messages.");
      }
      return cached || [];
    } finally {
      fetchingMessagesRef.current.delete(cId);
      void requestId;
    }
  }, [saveCache]);

  const markConversationRead = useCallback(async (conversationId) => {
    if (!conversationId) return;
    // Optimistic local badge update; server remains authoritative.
    setConversations((previous) => {
      const updated = previous.map((item) =>
        sameId(getConversationId(item), conversationId)
          ? { ...item, unreadCount: 0, unread: 0, unreadMessages: 0 }
          : item
      );
      conversationsRef.current = updated;
      saveCache(usersRef.current, updated, messagesCache.current);
      return updated;
    });
    try {
      const response = await fetch(getApiUrl(`/conversations/${conversationId}/read`), {
        method: "PUT",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        // Backend in this project may expose /messages/read/:conversationId instead.
        const fallback = await fetch(getApiUrl(`/messages/read/${conversationId}`), {
          method: "PUT",
          credentials: "include",
          headers: getAuthHeaders(),
        });
        if (!fallback.ok) throw new Error("Unable to mark conversation as read.");
      }
      socketRef.current?.emit("mark_messages_read", { conversationId: String(conversationId) });
    } catch {
      // Do not block opening a conversation if a read endpoint differs in this backend.
    }
  }, [saveCache]);

  const openConversation = useCallback(async (conversation, user = null) => {
    const conversationId = getConversationId(conversation);
    if (!conversationId) return;
    selectedConversationIdRef.current = String(conversationId);
    setSelectedConversationId(String(conversationId));
    setSelectedConversation(conversation);
    setHeaderTab("chat");
    setMenuOpen(false);
    setShowContactPicker(false);

    if (user) {
      setSelectedUser(user);
    } else if (conversation?.isGroup) {
      setSelectedUser({
        name: conversation.groupName || "Group chat",
        role: "Group Chat",
        isGroup: true,
        avatar: conversation.avatar,
      });
    } else {
      const participants = Array.isArray(conversation?.participants) ? conversation.participants : [];
      const other = participants.find((participant) => {
        const id = getId(participant);
        return id && !sameId(id, conversation?.adminId);
      });
      if (other) setSelectedUser(other);
    }

    setMessagesError("");
    setSelectedFiles([]);
    setMessageSearch("");
    setShowMessageSearch(false);
    setEditingMessageId(null);
    setEditDraft("");
    setMessage("");
    const cached = messagesCache.current[String(conversationId)];
    setMessages(Array.isArray(cached) ? cached : []);
    await fetchMessages(conversationId, false);
    await markConversationRead(conversationId);
    // Joining rooms is backend-specific; retain the event used by the current app.
    socketRef.current?.emit("join_room", String(conversationId));
  }, [fetchMessages, markConversationRead]);

  const handleSelectUser = useCallback(async (user) => {
    const userId = getId(user);
    if (!userId) return;
    setSelectedUser(user);
    setMessagesError("");
    const existing = findConversationForUser(userId, conversationsRef.current);
    if (existing) {
      await openConversation(existing, user);
      return;
    }

    setStartingConversation(true);
    try {
      const response = await fetch(getApiUrl("/conversations"), {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: JSON.stringify({ recipientId: userId }),
      });
      const data = await parseResponse(response);
      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || "Failed to start conversation.");
      }
      const newConversation = data?.conversation || data?.data?.conversation || data?.data;
      const newId = getConversationId(newConversation);
      if (!newId) throw new Error("The server did not return a conversation ID.");

      setConversations((previous) => {
        const updated = [newConversation, ...previous.filter((item) => !sameId(getConversationId(item), newId))];
        conversationsRef.current = updated;
        saveCache(usersRef.current, updated, messagesCache.current);
        return updated;
      });
      await openConversation(newConversation, user);
    } catch (error) {
      if (demoMode) {
        const localConversation = {
          _id: `demo-conv-${String(userId)}`,
          id: `demo-conv-${String(userId)}`,
          participants: [user],
          isGroup: false,
          lastMessage: "",
          lastMessageAt: new Date().toISOString(),
          unreadCount: 0,
        };
        setConversations((previous) => {
          const updated = [localConversation, ...previous.filter((item) => !sameId(getConversationId(item), localConversation._id))];
          conversationsRef.current = updated;
          saveCache(usersRef.current, updated, messagesCache.current);
          return updated;
        });
        messagesCache.current[localConversation._id] = [];
        await openConversation(localConversation, user);
      } else {
        setMessagesError(error?.message || "Failed to start conversation.");
      }
    } finally {
      setStartingConversation(false);
    }
  }, [demoMode, findConversationForUser, openConversation, saveCache]);

  const updateMessageInState = useCallback((updatedMessage) => {
    if (!updatedMessage) return;
    const conversationId = getConversationIdFromMessage(updatedMessage) || selectedConversationIdRef.current;
    const normalized = normalizeMessage(updatedMessage, conversationId);
    const messageId = String(getMessageId(normalized) || "");
    if (!messageId) return;

    setMessages((previous) => {
      const next = previous.map((item) =>
        sameId(getMessageId(item), messageId) ? { ...item, ...normalized } : item
      );
      if (conversationId) messagesCache.current[String(conversationId)] = next;
      saveCache(usersRef.current, conversationsRef.current, messagesCache.current);
      return next;
    });
  }, [saveCache]);

  const handleSaveEditedMessage = async (item) => {
    const id = getMessageId(item);
    const clean = editDraft.trim();
    if (!id || String(id).startsWith("temp-") || !clean || messageActionBusy) return;
    try {
      setMessageActionBusy(true);
      const response = await fetch(getApiUrl(`/messages/${id}`), {
        method: "PATCH",
        credentials: "include",
        headers: getAuthHeaders(),
        body: JSON.stringify({ body: clean, message: clean }),
      });
      const data = await parseResponse(response);
      if (!response.ok || data?.success === false) throw new Error(data?.message || "Could not edit message.");
      const updated = data?.data?.message || data?.message || data?.data;
      if (updated && typeof updated === "object") updateMessageInState(updated);
      else await fetchMessages(selectedConversationIdRef.current, true);
      setEditingMessageId(null);
      setEditDraft("");
    } catch (error) {
      setMessagesError(error?.message || "Could not edit message.");
    } finally {
      setMessageActionBusy(false);
    }
  };

  const handleReactToMessage = async (item, emoji) => {
    const id = getMessageId(item);
    if (!id || String(id).startsWith("temp-") || messageActionBusy) return;
    try {
      const response = await fetch(getApiUrl(`/messages/${id}/reactions`), {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: JSON.stringify({ emoji }),
      });
      const data = await parseResponse(response);
      if (!response.ok || data?.success === false) throw new Error(data?.message || "Could not add reaction.");
      const updated = data?.data?.message || data?.message || data?.data;
      if (updated && typeof updated === "object" && !Array.isArray(updated)) updateMessageInState(updated);
      else if (Array.isArray(data?.reactions)) updateMessageInState({ ...item, reactions: data.reactions });
      else await fetchMessages(selectedConversationIdRef.current, true);
    } catch (error) {
      setMessagesError(error?.message || "Could not add reaction.");
    }
  };

  const handleDeleteMessage = async (item, scope = "everyone") => {
    const id = getMessageId(item);
    if (!id || String(id).startsWith("temp-") || messageActionBusy) return;
    if (!window.confirm(scope === "everyone" ? "Delete this message for everyone?" : "Remove this message from your view?")) return;

    try {
      setMessageActionBusy(true);
      const endpoint = scope === "everyone"
        ? `/messages/${id}/delete-for-everyone`
        : `/messages/${id}/delete-for-me`;
      let response = await fetch(getApiUrl(endpoint), {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: JSON.stringify({}),
      });
      // Some backend implementations use DELETE for the delete-for-me operation.
      if (!response.ok && scope === "me") {
        response = await fetch(getApiUrl(`/messages/${id}`), {
          method: "DELETE",
          credentials: "include",
          headers: getAuthHeaders(),
        });
      }
      const data = await parseResponse(response);
      if (!response.ok || data?.success === false) throw new Error(data?.message || "Could not delete message.");

      if (scope === "everyone") {
        const updated = data?.data?.message || data?.message || data?.data;
        if (updated && typeof updated === "object" && !Array.isArray(updated)) updateMessageInState(updated);
        else updateMessageInState({ ...item, isDeletedForEveryone: true, body: "This message was deleted", attachments: [] });
      } else {
        setMessages((previous) => {
          const next = previous.filter((messageItem) => !sameId(getMessageId(messageItem), id));
          if (selectedConversationIdRef.current) messagesCache.current[String(selectedConversationIdRef.current)] = next;
          saveCache(usersRef.current, conversationsRef.current, messagesCache.current);
          return next;
        });
      }
    } catch (error) {
      setMessagesError(error?.message || "Could not delete message.");
    } finally {
      setMessageActionBusy(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversationId || !window.confirm("Delete this conversation?")) return;
    try {
      const conversationId = selectedConversationId;
      const response = await fetch(getApiUrl(`/conversations/${conversationId}`), {
        method: "DELETE",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const data = await parseResponse(response);
      if (!response.ok || data?.success === false) throw new Error(data?.message || "Failed to delete conversation.");

      setConversations((previous) => {
        const next = previous.filter((item) => !sameId(getConversationId(item), conversationId));
        conversationsRef.current = next;
        saveCache(usersRef.current, next, messagesCache.current);
        return next;
      });
      delete messagesCache.current[String(conversationId)];
      setSelectedConversationId(null);
      selectedConversationIdRef.current = null;
      setSelectedConversation(null);
      setSelectedUser(null);
      setMessages([]);
      setMenuOpen(false);
    } catch (error) {
      setMessagesError(error?.message || "Could not delete conversation.");
    }
  };

  const handleMarkUnread = async () => {
    if (!selectedConversationId) return;
    setConversations((previous) => {
      const updated = previous.map((item) =>
        sameId(getConversationId(item), selectedConversationId)
          ? { ...item, unreadCount: Math.max(1, getUnreadCount(item)), unread: Math.max(1, getUnreadCount(item)) }
          : item
      );
      conversationsRef.current = updated;
      saveCache(usersRef.current, updated, messagesCache.current);
      return updated;
    });
    setMenuOpen(false);
    try {
      await fetch(getApiUrl(`/conversations/${selectedConversationId}/unread`), {
        method: "PUT",
        credentials: "include",
        headers: getAuthHeaders(),
      });
    } catch {}
  };

  const handleSendMessage = async (event) => {
    event?.preventDefault();
    const cleanBody = message.trim();
    const conversationId = selectedConversationId;
    const recipientId = selectedConversation?.isGroup ? null : getId(selectedUser);
    const filesToSend = [...selectedFiles];

    if ((!cleanBody && filesToSend.length === 0) || !conversationId || !selectedUser || sendingRef.current) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic = {
      _id: tempId,
      id: tempId,
      conversationId,
      body: cleanBody,
      sender: { role: "admin", name: "You" },
      createdAt: new Date().toISOString(),
      attachments: filesToSend.map((file) => ({
        filename: file.name,
        originalName: file.name,
        mimeType: file.type,
        url: URL.createObjectURL(file),
        isLocalPreview: true,
      })),
      status: "sending",
      clientMessageId: tempId,
    };

    sendingRef.current = true;
    setSendingMessage(true);
    setMessagesError("");
    setMessage("");
    setSelectedFiles([]);

    setMessages((previous) => {
      const next = [...previous, optimistic];
      messagesCache.current[String(conversationId)] = next;
      saveCache(usersRef.current, conversationsRef.current, messagesCache.current);
      return next;
    });
    setConversations((previous) => {
      const updated = previous.map((item) => sameId(getConversationId(item), conversationId)
        ? { ...item, lastMessage: cleanBody || (filesToSend.length ? "Attachment" : ""), lastMessageAt: optimistic.createdAt, updatedAt: optimistic.createdAt }
        : item);
      conversationsRef.current = updated;
      return updated;
    });
    scrollToBottom(true);

    try {
      if (demoMode || String(conversationId).startsWith("demo-")) {
        const sentAt = new Date().toISOString();
        const localMessage = { ...optimistic, status: "sent", createdAt: sentAt };
        setMessages((previous) => {
          const next = previous.map((item) => sameId(getMessageId(item), tempId) ? localMessage : item);
          messagesCache.current[String(conversationId)] = next;
          saveCache(usersRef.current, conversationsRef.current, messagesCache.current);
          return next;
        });
        setConversations((previous) => {
          const updated = previous.map((item) => sameId(getConversationId(item), conversationId)
            ? { ...item, lastMessage: cleanBody || (filesToSend.length ? "Attachment" : ""), lastMessageAt: sentAt, updatedAt: sentAt }
            : item);
          conversationsRef.current = updated;
          saveCache(usersRef.current, updated, messagesCache.current);
          return updated;
        });
        scrollToBottom(true);
        return;
      }
      let response;
      if (filesToSend.length) {
        const form = new FormData();
        form.append("conversationId", String(conversationId));
        form.append("body", cleanBody);
        form.append("clientMessageId", tempId);
        if (recipientId) form.append("recipientId", String(recipientId));
        filesToSend.forEach((file) => form.append("files", file));
        response = await fetch(getApiUrl("/messages"), {
          method: "POST",
          credentials: "include",
          headers: getAuthHeaders(false),
          body: form,
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
            message: cleanBody,
            messageType: "text",
            clientMessageId: tempId,
          }),
        });
      }

      const data = await parseResponse(response);
      if (!response.ok || data?.success === false) throw new Error(data?.message || "Failed to send message.");

      const sentMessage = data?.message || data?.data?.message || data?.data;
      if (sentMessage && typeof sentMessage === "object" && (getMessageId(sentMessage) || getConversationIdFromMessage(sentMessage))) {
        const normalized = normalizeMessage(sentMessage, conversationId);
        setMessages((previous) => {
          const next = previous.filter((item) => !sameId(getMessageId(item), tempId));
          const canonicalId = getMessageId(normalized);
          const alreadyExists = canonicalId && next.some((item) => sameId(getMessageId(item), canonicalId));
          const merged = alreadyExists
            ? next.map((item) => sameId(getMessageId(item), canonicalId) ? { ...item, ...normalized, status: "sent" } : item)
            : [...next, { ...normalized, status: "sent" }];
          merged.sort((a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime());
          messagesCache.current[String(conversationId)] = merged;
          saveCache(usersRef.current, conversationsRef.current, messagesCache.current);
          return merged;
        });
      } else {
        setMessages((previous) => previous.map((item) => sameId(getMessageId(item), tempId) ? { ...item, status: "sent" } : item));
        // Refresh history only when the send response does not contain the canonical message.
        await fetchMessages(conversationId, true);
      }
      socketRef.current?.emit("join_room", String(conversationId));
    } catch (error) {
      setMessagesError(error?.message || "Message could not be sent. Please try again.");
      setMessages((previous) => previous.map((item) => sameId(getMessageId(item), tempId) ? { ...item, status: "failed" } : item));
      setMessage(cleanBody);
      setSelectedFiles(filesToSend);
    } finally {
      sendingRef.current = false;
      setSendingMessage(false);
      messageInputRef.current?.focus();
    }
  };

  const retryMessage = async (item) => {
    const body = getMessageBody(item);
    if (body) setMessage(body);
    setMessages((previous) => previous.filter((entry) => !sameId(getMessageId(entry), getMessageId(item))));
    if (item.attachments?.some((attachment) => attachment.isLocalPreview)) {
      setMessagesError("Please reattach the files and resend this message.");
    } else {
      setTimeout(() => messageInputRef.current?.focus(), 0);
    }
  };

  /* ==========================================================
     SOCKET.IO REALTIME
     Event names and room-join behavior must match backend.
  ========================================================== */

  useEffect(() => {
    if (!isClient) return;
    const token = getStoredToken();
    const socket = io(BACKEND_BASE_URL, {
      auth: token ? { token } : {},
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
    socketRef.current = socket;

    const joinActiveRoom = () => {
      const activeId = selectedConversationIdRef.current;
      if (activeId) socket.emit("join_room", String(activeId));
    };

    socket.on("connect", () => {
      setSocketConnected(true);
      joinActiveRoom();
      scheduleRefresh();
      const activeId = selectedConversationIdRef.current;
      if (activeId) void fetchMessages(activeId, true);
    });
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("connect_error", () => setSocketConnected(false));

    const handleIncomingMessage = (payload) => {
      const raw = unwrapSocketMessage(payload);
      if (!raw) {
        scheduleRefresh();
        return;
      }
      const conversationId = getConversationIdFromMessage(raw);
      if (!conversationId) {
        scheduleRefresh();
        return;
      }

      const normalized = normalizeMessage(raw, conversationId);
      const messageId = String(getMessageId(normalized) || "");
      if (messageId && processedSocketMessages.current.has(messageId)) return;
      if (messageId) {
        processedSocketMessages.current.add(messageId);
        if (processedSocketMessages.current.size > 2000) {
          processedSocketMessages.current = new Set(Array.from(processedSocketMessages.current).slice(-1000));
        }
      }

      const activeId = String(selectedConversationIdRef.current || "");
      const isActive = activeId === String(conversationId);
      const isOwn = Boolean(normalized?.isOwn || normalized?.sender?.isCurrentUser);

      if (isActive) {
        setMessages((previous) => {
          const id = getMessageId(normalized);
          if (id && previous.some((item) => sameId(getMessageId(item), id))) {
            return previous.map((item) => sameId(getMessageId(item), id) ? { ...item, ...normalized } : item);
          }
          // Replace a matching optimistic send if the server returns the same client ID/body.
          const tempIndex = previous.findIndex((item) =>
            String(getMessageId(item) || "").startsWith("temp-") &&
            getMessageBody(item) === getMessageBody(normalized) &&
            sameId(getSenderId(item), getSenderId(normalized))
          );
          let next = [...previous];
          if (tempIndex >= 0) {
            revokeTemporaryAttachmentUrls(next[tempIndex]);
            next[tempIndex] = { ...normalized, status: "sent" };
          } else {
            next.push(normalized);
          }
          next.sort((a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime());
          messagesCache.current[String(conversationId)] = next;
          saveCache(usersRef.current, conversationsRef.current, messagesCache.current);
          return next;
        });
        void markConversationRead(conversationId);
      }

      setConversations((previous) => {
        const index = previous.findIndex((item) => sameId(getConversationId(item), conversationId));
        if (index < 0) {
          scheduleRefresh();
          return previous;
        }
        const next = [...previous];
        const old = next[index];
        const unread = isActive || isOwn ? 0 : getUnreadCount(old) + 1;
        next[index] = {
          ...old,
          lastMessage: getMessageText(normalized),
          lastMessageAt: normalized.createdAt || new Date().toISOString(),
          lastSender: normalized.sender || old.lastSender,
          updatedAt: normalized.createdAt || new Date().toISOString(),
          unreadCount: unread,
          unread,
        };
        const [moved] = next.splice(index, 1);
        next.unshift(moved);
        conversationsRef.current = next;
        saveCache(usersRef.current, next, messagesCache.current);
        return next;
      });

      if (!isActive && !isOwn && !mutedChats.includes(String(conversationId))) {
        playNotificationSound();
        showDesktopNotification("New message", getMessageText(normalized));
      }
    };

    const handleMessageUpdate = (payload) => {
      const updated = unwrapSocketMessage(payload);
      if (updated) updateMessageInState(updated);
      else scheduleRefresh();
    };
    const handleReadUpdate = () => scheduleRefresh();
    const handlePresence = (payload) => {
      const userId = getId(payload?.user || payload?.userId || payload);
      if (userId) setOnlineUsers((previous) => ({ ...previous, [String(userId)]: Boolean(payload?.online ?? payload?.isOnline ?? true) }));
    };

    ["receive_message", "new_message", "message_notification"].forEach((eventName) => {
      socket.on(eventName, handleIncomingMessage);
    });
    ["message_updated", "message_edited", "message_deleted", "message_reaction_updated"].forEach((eventName) => {
      socket.on(eventName, handleMessageUpdate);
    });
    ["messages_read", "message_read", "read_receipt"].forEach((eventName) => {
      socket.on(eventName, handleReadUpdate);
    });
    ["user_online", "user_offline", "presence_update"].forEach((eventName) => {
      socket.on(eventName, handlePresence);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [isClient, fetchMessages, markConversationRead, mutedChats, saveCache, scheduleRefresh, updateMessageInState]);

  const handleCreateGroup = async (event) => {
    event.preventDefault();
    if (!groupName.trim() || selectedGroupMembers.length === 0 || creatingGroup) return;
    try {
      setCreatingGroup(true);
      const response = await fetch(getApiUrl("/conversations"), {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          isGroup: true,
          groupName: groupName.trim(),
          participants: selectedGroupMembers,
        }),
      });
      const data = await parseResponse(response);
      if (!response.ok || data?.success === false) throw new Error(data?.message || "Failed to create group.");
      const group = data?.conversation || data?.data?.conversation || data?.data;
      if (!getConversationId(group)) throw new Error("The server did not return the new group.");
      setConversations((previous) => {
        const next = [group, ...previous.filter((item) => !sameId(getConversationId(item), getConversationId(group)))];
        conversationsRef.current = next;
        saveCache(usersRef.current, next, messagesCache.current);
        return next;
      });
      setShowGroupModal(false);
      setGroupName("");
      setSelectedGroupMembers([]);
      await openConversation(group);
    } catch (error) {
      setMessagesError(error?.message || "Error creating group.");
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleDragStart = (_event, index) => setDraggedIndex(index);
  const handleDragOver = (event) => event.preventDefault();
  const handleDrop = (event, dropIndex) => {
    event.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    const updated = [...users];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(dropIndex, 0, moved);
    setUsers(updated);
    usersRef.current = updated;
    saveCache(updated, conversationsRef.current, messagesCache.current);
    setDraggedIndex(null);
  };

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = users;
    if (query) {
      list = list.filter((user) =>
        `${user?.name || ""} ${user?.email || ""} ${user?.role || ""}`.toLowerCase().includes(query)
      );
    }
    if (chatFilter === "unread") {
      list = list.filter((user) => getUnreadCount(findConversationForUser(getId(user))) > 0);
    } else if (chatFilter === "favorites") {
      list = list.filter((user) => favorites.includes(String(getId(findConversationForUser(getId(user))) || getId(user))));
    }
    return list;
  }, [users, search, chatFilter, favorites, findConversationForUser]);

  const visibleMessages = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter((item) => getMessageBody(item).toLowerCase().includes(query));
  }, [messages, messageSearch]);

  const photoMessages = useMemo(
    () => messages.filter((item) => (item.attachments || []).some((attachment) => String(attachment?.mimeType || attachment?.fileType || "").startsWith("image/"))),
    [messages]
  );
  const fileMessages = useMemo(
    () => messages.filter((item) => (item.attachments || []).some((attachment) => !String(attachment?.mimeType || attachment?.fileType || "").startsWith("image/"))),
    [messages]
  );

  const selectedName = selectedUser ? getUserName(selectedUser) : "";
  const selectedAvatar = selectedUser ? getUserAvatar(selectedUser) : "";
  const selectedKey = String(selectedConversationId || "");
  const isSelectedGroup = Boolean(selectedConversation?.isGroup);
  const selectedOnline = Boolean(onlineUsers[String(getId(selectedUser))] ?? selectedUser?.isOnline ?? selectedUser?.online);

  const sortedConversations = useMemo(() => {
    const list = [...conversations];
    return list.sort((a, b) => {
      const aId = String(getConversationId(a) || "");
      const bId = String(getConversationId(b) || "");
      const aPinned = pinnedChats.includes(aId) ? 1 : 0;
      const bPinned = pinnedChats.includes(bId) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return new Date(getConversationLastDate(b) || 0).getTime() - new Date(getConversationLastDate(a) || 0).getTime();
    });
  }, [conversations, pinnedChats]);

  const conversationForUser = (user) => findConversationForUser(getId(user), sortedConversations);

  const appendEmoji = (emoji) => {
    setMessage((previous) => `${previous}${emoji}`);
    setShowEmojiPicker(false);
    messageInputRef.current?.focus();
  };

  const toggleFavorite = () => {
    if (!selectedConversationId) return;
    const key = String(selectedConversationId);
    setFavorites((previous) => previous.includes(key) ? previous.filter((item) => item !== key) : [...previous, key]);
    setMenuOpen(false);
  };

  const toggleMute = () => {
    if (!selectedConversationId) return;
    const key = String(selectedConversationId);
    setMutedChats((previous) => previous.includes(key) ? previous.filter((item) => item !== key) : [...previous, key]);
    setMenuOpen(false);
  };

  const togglePin = () => {
    if (!selectedConversationId) return;
    const key = String(selectedConversationId);
    setPinnedChats((previous) => previous.includes(key) ? previous.filter((item) => item !== key) : [...previous, key]);
    setMenuOpen(false);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[560px] w-full flex-1 flex-col overflow-hidden bg-[#f7f8fc] text-slate-950">
      <section className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden rounded-none bg-white lg:flex-row">
        {/* SIDEBAR */}
        <aside className={`flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-[#f8f8fb] lg:w-[390px] xl:w-[430px] ${selectedConversationId ? "hidden lg:flex" : "flex"}`}>
          <div className="shrink-0 border-b border-slate-200 bg-white px-5 pb-4 pt-5">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">Chat</h1>\n                {demoMode && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800" title="Sample data for UI preview only">UI preview</span>}
                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${socketConnected ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`} title={socketConnected ? "Connected" : "Disconnected"}>
                  {socketConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
                </span>
              </div>
              <button
                onClick={() => setShowContactPicker((previous) => !previous)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-violet-50 hover:text-violet-700"
                title="New chat"
                aria-label="New chat"
              >
                <Pencil size={18} />
              </button>
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              />
            </div>
            <div className="mt-4 flex items-center gap-1">
              {[
                { id: "all", label: "All" },
                { id: "unread", label: "Unread" },
                { id: "favorites", label: "Favorites" },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setChatFilter(filter.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${chatFilter === filter.id ? "bg-violet-100 text-violet-800" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {filter.label}
                </button>
              ))}
              <button onClick={() => setShowGroupModal(true)} className="ml-auto flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50" title="Create group">
                <Plus size={14} /> Group
              </button>
            </div>
          </div>

          {showContactPicker && (
            <div className="border-b border-violet-100 bg-violet-50/70 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold text-violet-900">New message</p>
                <button onClick={() => setShowContactPicker(false)} className="rounded p-1 text-slate-500 hover:bg-white"><X size={14} /></button>
              </div>
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a person"
                className="h-9 w-full rounded-lg border border-violet-200 bg-white px-3 text-xs outline-none focus:border-violet-500"
              />
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {loadingUsers && users.length === 0 ? (
              <div className="flex justify-center p-8"><Loader2 size={24} className="animate-spin text-violet-600" /></div>
            ) : (
              <>
                {sortedConversations.filter((conversation) => conversation.isGroup).length > 0 && chatFilter === "all" && !search && (
                  <div className="px-3 pb-1 pt-4">
                    <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Groups</p>
                    {sortedConversations.filter((conversation) => conversation.isGroup).map((group) => {
                      const id = getConversationId(group);
                      const isActive = sameId(selectedConversationId, id);
                      const unread = getUnreadCount(group);
                      return (
                        <button
                          key={id}
                          onClick={() => openConversation(group)}
                          className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${isActive ? "bg-[#e9e7f8] text-violet-900" : "hover:bg-slate-100"}`}
                        >
                          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
                            <Users size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold">{group.groupName || "Group chat"}</p>
                              <span className="text-[10px] text-slate-400">{formatConversationTime(getConversationLastDate(group))}</span>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-slate-500">{getConversationLastMessage(group) || "Group conversation"}</p>
                          </div>
                          {unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">{unread}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="px-3 pb-3 pt-3">
                  <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    {search || showContactPicker ? "People" : "Recent"}
                  </p>
                  {filteredUsers.length > 0 ? filteredUsers.map((user, index) => {
                    const userId = getId(user);
                    const conversation = conversationForUser(user);
                    const conversationId = getConversationId(conversation);
                    const active = (conversationId && sameId(selectedConversationId, conversationId)) ||
                      (!conversationId && sameId(getId(selectedUser), userId));
                    const unread = getUnreadCount(conversation);
                    const avatar = getUserAvatar(user);
                    const isOnline = Boolean(onlineUsers[String(userId)] ?? user?.isOnline ?? user?.online);
                    const lastText = getConversationLastMessage(conversation) || user?.email || "Start a conversation";
                    const isFavorite = favorites.includes(String(conversationId || userId));
                    return (
                      <div
                        key={userId || index}
                        draggable
                        onDragStart={(event) => handleDragStart(event, index)}
                        onDragOver={handleDragOver}
                        onDrop={(event) => handleDrop(event, index)}
                        className={`group mb-1 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 transition ${active ? "bg-[#e9e7f8]" : "hover:bg-slate-100"}`}
                        onClick={() => handleSelectUser(user)}
                      >
                        <div className="relative h-10 w-10 shrink-0">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white">
                            {avatar ? <img src={getFileUrl(avatar)} alt="" className="h-full w-full object-cover" /> : getInitials(getUserName(user))}
                          </div>
                          <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#f8f8fb] ${isOnline ? "bg-emerald-500" : "bg-slate-300"}`} title={isOnline ? "Available" : "Offline"} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`truncate text-sm ${unread ? "font-bold text-slate-950" : "font-semibold text-slate-800"}`}>{getUserName(user)}</p>
                            <span className="shrink-0 text-[10px] text-slate-400">{formatConversationTime(getConversationLastDate(conversation))}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p className={`truncate text-xs ${unread ? "font-semibold text-slate-700" : "text-slate-500"}`}>{lastText}</p>
                            {unread > 0 ? <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">{unread}</span> : isFavorite ? <Bookmark size={12} className="shrink-0 fill-violet-500 text-violet-500" /> : null}
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="px-5 py-10 text-center">
                      <Users size={24} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-600">No people found</p>
                      <p className="mt-1 text-xs text-slate-400">Try a different search.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>

        {/* CHAT PANEL */}
        <main className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white ${selectedConversationId ? "flex" : "hidden lg:flex"}`}>
          {selectedConversationId ? (
            <>
              <header className="z-20 flex min-h-[76px] shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <button onClick={() => { setSelectedConversationId(null); selectedConversationIdRef.current = null; }} className="mr-1 rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" title="Back to chats">
                    <ChevronDown className="rotate-90" size={18} />
                  </button>
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-sm font-bold text-white">
                    {selectedAvatar ? <img src={getFileUrl(selectedAvatar)} alt="" className="h-full w-full object-cover" /> : isSelectedGroup ? <Users size={19} /> : getInitials(selectedName)}
                    {!isSelectedGroup && (
                      <span
                        className={`absolute bottom-0 right-0 flex h-[15px] w-[15px] items-center justify-center rounded-full border-2 border-white ${
                          selectedOnline ? "bg-sky-500 text-white" : "bg-slate-300"
                        }`}
                        title={selectedOnline ? "Online" : "Offline"}
                      >
                        {selectedOnline && <Check size={9} strokeWidth={3} />}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-slate-900 sm:text-base">{selectedName || "Conversation"}</h2>
                    <p className="mt-0.5 text-xs text-slate-500">{isSelectedGroup ? `${selectedConversation?.participants?.length || 0} participants` : selectedOnline ? "Available" : "Chat"}</p>
                    <div className="mt-2 flex items-center gap-4">
                      {[
                        { id: "chat", label: "Chat" },
                        { id: "files", label: "Files" },
                        { id: "photos", label: "Photos" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setHeaderTab(tab.id)}
                          className={`border-b-2 pb-2 text-xs font-semibold transition ${headerTab === tab.id ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="relative flex shrink-0 items-center gap-1 text-slate-600 sm:gap-2" ref={menuRef}>
                  {showMessageSearch && (
                    <div className="absolute right-0 top-12 z-30 flex w-64 items-center rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                      <Search size={15} className="ml-1 text-slate-400" />
                      <input autoFocus value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Find in chat" className="min-w-0 flex-1 px-2 py-1 text-xs outline-none" />
                      <button onClick={() => { setShowMessageSearch(false); setMessageSearch(""); }} className="rounded p-1 hover:bg-slate-100"><X size={14} /></button>
                    </div>
                  )}
                  <button onClick={() => { setShowMessageSearch((previous) => !previous); setMenuOpen(false); }} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-violet-50 hover:text-violet-700" title="Search in chat"><Search size={18} /></button>
                  <button onClick={() => setShowGroupModal(true)} className="hidden h-9 w-9 items-center justify-center rounded-lg hover:bg-violet-50 hover:text-violet-700 sm:flex" title="Create group"><Users size={18} /></button>
                  <button onClick={() => setMenuOpen((previous) => !previous)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-violet-50 hover:text-violet-700" title="More chat options"><MoreHorizontal size={20} /></button>

                  {menuOpen && (
                    <div className="absolute right-0 top-11 z-40 w-60 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl">
                      <button onClick={handleMarkUnread} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-violet-50"><CheckCheck size={15} /> Mark as unread</button>
                      <button onClick={toggleFavorite} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-violet-50"><Bookmark size={15} /> {favorites.includes(selectedKey) ? "Remove favorite" : "Add to favorites"}</button>
                      <button onClick={togglePin} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-violet-50"><Archive size={15} /> {pinnedChats.includes(selectedKey) ? "Unpin chat" : "Pin chat"}</button>
                      <button onClick={toggleMute} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-violet-50">{mutedChats.includes(selectedKey) ? <Bell size={15} /> : <BellOff size={15} />} {mutedChats.includes(selectedKey) ? "Unmute notifications" : "Mute notifications"}</button>
                      <div className="my-1 border-t border-slate-100" />
                      <button onClick={handleDeleteConversation} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50"><Trash2 size={15} /> Delete conversation</button>
                    </div>
                  )}
                </div>
              </header>

              {messagesError && (
                <div className="flex shrink-0 items-start gap-2 border-b border-rose-100 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <p className="flex-1">{messagesError}</p>
                  <button onClick={() => setMessagesError("")} className="rounded p-0.5 hover:bg-rose-100"><X size={14} /></button>
                </div>
              )}

              {headerTab === "chat" && (
                <>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white px-4 py-6 sm:px-8">
                    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
                      {visibleMessages.length === 0 ? (
                        <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center text-center">
                          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-50 text-violet-600"><MessageSquare size={27} /></div>
                          <h3 className="text-sm font-bold text-slate-800">Start the conversation</h3>
                          <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">Send a message or share a file. Your conversation will appear here.</p>
                        </div>
                      ) : (
                        visibleMessages.map((item, index) => {
                          const sender = item?.sender;
                          const isDeleted = Boolean(item?.isDeletedForEveryone);
                          const body = isDeleted ? "This message was deleted" : getMessageBody(item);
                          const senderId = getSenderId(item);
                          const isOwn = String(sender?.role || "").toLowerCase() === "admin" || sender?.name === "You" || sender?.isCurrentUser === true || item?.isOwn === true;
                          const messageId = getMessageId(item);
                          const isEditing = sameId(editingMessageId, messageId);
                          const attachments = Array.isArray(item?.attachments) ? item.attachments : [];
                          const previous = visibleMessages[index - 1];
                          const previousSender = getSenderId(previous);
                          const showDay = !previous || formatDayLabel(item?.createdAt) !== formatDayLabel(previous?.createdAt);
                          const showSender = isSelectedGroup && (!previous || !sameId(previousSender, senderId) || showDay);
                          const isTemp = String(messageId || "").startsWith("temp-");

                          return (
                            <div key={messageId || index}>
                              {showDay && <div className="my-3 flex items-center gap-3"><div className="h-px flex-1 bg-slate-100" /><span className="rounded-full bg-white px-2 text-[11px] font-semibold text-slate-400">{formatDayLabel(item?.createdAt)}</span><div className="h-px flex-1 bg-slate-100" /></div>}
                              <div className={`group relative flex w-full items-end gap-2.5 ${isOwn ? "justify-end" : "justify-start"}`}>
                                {!isOwn && (
                                  <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-[10px] font-bold text-white">
                                    {getUserAvatar(sender) ? <img src={getFileUrl(getUserAvatar(sender))} alt="" className="h-full w-full object-cover" /> : getInitials(getUserName(sender))}
                                  </div>
                                )}
                                <div className={`relative max-w-[88%] sm:max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                                  {showSender && !isOwn && <p className="mb-1 ml-2 text-[11px] font-semibold text-slate-500">{getUserName(sender)}</p>}
                                  <div className={`relative rounded-2xl px-4 py-3 shadow-sm ${isDeleted ? "border border-slate-200 bg-slate-50 italic text-slate-400" : isOwn ? "rounded-br-md bg-[#6264a7] text-white" : "rounded-bl-md border border-slate-200 bg-[#f5f5f8] text-slate-800"}`}>
                                    {isEditing ? (
                                      <div className="flex min-w-[230px] flex-col gap-2">
                                        <textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-800 outline-none focus:border-violet-500" />
                                        <div className="flex justify-end gap-2">
                                          <button onClick={() => { setEditingMessageId(null); setEditDraft(""); }} className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-black/5">Cancel</button>
                                          <button disabled={messageActionBusy || !editDraft.trim()} onClick={() => handleSaveEditedMessage(item)} className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{messageActionBusy ? "Saving…" : "Save"}</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        {body && <p className="whitespace-pre-wrap break-words text-[13px] leading-5">{body}</p>}
                                        {attachments.length > 0 && (
                                          <div className={`flex flex-col gap-2 ${body ? "mt-2.5" : ""}`}>
                                            {attachments.map((attachment, attachmentIndex) => {
                                              const fileUrl = getFileUrl(attachment?.url);
                                              const mime = String(attachment?.mimeType || attachment?.fileType || "");
                                              const isImage = mime.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(attachment?.url || "");
                                              if (isImage) {
                                                return <a key={`${attachment.url}-${attachmentIndex}`} href={fileUrl} target="_blank" rel="noopener noreferrer" className="block max-w-full overflow-hidden rounded-lg border border-white/20 bg-black/5"><img src={fileUrl} alt={attachment?.originalName || "Image attachment"} className="max-h-72 max-w-full rounded-lg object-contain" loading="lazy" /></a>;
                                              }
                                              return (
                                                <a key={`${attachment.url}-${attachmentIndex}`} href={fileUrl} target="_blank" rel="noopener noreferrer" className={`flex min-w-[190px] max-w-full items-center gap-3 rounded-lg p-3 text-xs transition ${isOwn ? "bg-white/10 hover:bg-white/20" : "bg-white hover:bg-slate-100"}`}>
                                                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isOwn ? "bg-white/15" : "bg-violet-50 text-violet-700"}`}><FileText size={18} /></span>
                                                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{attachment?.originalName || attachment?.filename || "Download file"}</span><span className={`mt-0.5 block text-[10px] ${isOwn ? "text-violet-100" : "text-slate-400"}`}>{attachment?.size ? `${Math.ceil(attachment.size / 1024)} KB` : mime || "Attachment"}</span></span>
                                                </a>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </>
                                    )}

                                    {item?.reactions?.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        {item.reactions.map((reaction, reactionIndex) => {
                                          const emoji = typeof reaction === "string" ? reaction : reaction?.emoji;
                                          const count = typeof reaction === "object" ? (reaction?.count || reaction?.users?.length || 1) : 1;
                                          if (!emoji) return null;
                                          return <button key={`${emoji}-${reactionIndex}`} onClick={() => handleReactToMessage(item, emoji)} className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${isOwn ? "border-white/20 bg-white/10 hover:bg-white/20" : "border-slate-200 bg-white hover:bg-violet-50"}`} title="React"><span>{emoji}</span>{count > 1 && <span>{count}</span>}</button>;
                                        })}
                                      </div>
                                    )}
                                    <div className={`mt-1.5 flex items-center justify-end gap-1.5 text-[10px] ${isOwn ? "text-violet-100" : "text-slate-400"}`}>
                                      {item?.editedAt && <span>Edited</span>}
                                      <span>{formatMessageTime(item?.createdAt)}</span>
                                      {isOwn && !isDeleted && (item?.status === "sending" ? <Loader2 size={12} className="animate-spin" /> : item?.status === "failed" ? <button onClick={() => retryMessage(item)} className="font-bold underline">Retry</button> : item?.seen || item?.isRead || item?.readAt ? <Eye size={13} className="text-sky-200" title="Seen" /> : item?.status === "sent" ? <Check size={12} title="Sent" /> : <CheckCheck size={12} title="Delivered" />)}
                                    </div>
                                  </div>
                                </div>

                                {!isDeleted && !isTemp && !isEditing && (
                                  <div className={`absolute top-0 z-10 flex translate-y-[-75%] items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-1 opacity-0 shadow-md transition group-hover:opacity-100 focus-within:opacity-100 ${isOwn ? "left-0" : "right-0"}`}>
                                    {["👍", "❤️", "😂", "😮", "😢", "🙏", "🎉"].map((emoji) => <button key={emoji} onClick={() => handleReactToMessage(item, emoji)} className="rounded p-1 text-sm transition hover:scale-110 hover:bg-violet-50" title={`React ${emoji}`}>{emoji}</button>)}
                                    <div className="mx-0.5 h-4 w-px bg-slate-200" />
                                    <button onClick={() => { setEditingMessageId(messageId); setEditDraft(getMessageBody(item)); }} disabled={!isOwn} className="rounded p-1.5 text-slate-500 hover:bg-violet-50 hover:text-violet-700 disabled:hidden" title="Edit message"><Pencil size={13} /></button>
                                    <button onClick={() => handleDeleteMessage(item, "me")} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Delete for me"><Trash2 size={13} /></button>
                                    {isOwn && <button onClick={() => handleDeleteMessage(item, "everyone")} className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600" title="Delete for everyone"><X size={13} /></button>}
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

                  <div className="shrink-0 bg-white px-4 pb-4 pt-2 sm:px-8 sm:pb-5">
                    <div className="mx-auto max-w-4xl">
                      {selectedFiles.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {selectedFiles.map((file, index) => (
                            <div key={`${file.name}-${file.size}-${index}`} className="flex max-w-full items-center gap-2 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-xs text-violet-800">
                              <FileText size={15} className="shrink-0" />
                              <span className="max-w-[180px] truncate font-semibold">{file.name}</span>
                              <span className="text-[10px] text-violet-500">{Math.max(1, Math.ceil(file.size / 1024))} KB</span>
                              <button type="button" onClick={() => setSelectedFiles((previous) => previous.filter((_, itemIndex) => itemIndex !== index))} className="rounded p-0.5 text-violet-500 hover:bg-violet-100 hover:text-rose-600"><X size={13} /></button>
                            </div>
                          ))}
                        </div>
                      )}

                      <form onSubmit={handleSendMessage} className="rounded-xl border border-slate-300 bg-white shadow-sm transition focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-100">
                        <textarea
                          ref={messageInputRef}
                          value={message}
                          onChange={(event) => setMessage(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                              event.preventDefault();
                              handleSendMessage(event);
                            }
                          }}
                          placeholder="Type a message"
                          rows={1}
                          className="max-h-32 min-h-[48px] w-full resize-none overflow-y-auto rounded-t-xl bg-transparent px-4 py-3 text-sm leading-5 text-slate-800 outline-none placeholder:text-slate-400"
                        />
                        <div className="flex items-center justify-between border-t border-slate-100 px-2 py-2 sm:px-3">
                          <div className="flex items-center gap-0.5 text-slate-500">
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg p-2 transition hover:bg-violet-50 hover:text-violet-700" title="Attach file"><Paperclip size={17} /></button>
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg p-2 transition hover:bg-violet-50 hover:text-violet-700" title="Add photo"><ImageIcon size={17} /></button>
                            <div className="relative">
                              <button type="button" onClick={() => setShowEmojiPicker((previous) => !previous)} className="rounded-lg p-2 transition hover:bg-violet-50 hover:text-violet-700" title="Emoji"><Smile size={17} /></button>
                              {showEmojiPicker && <div className="absolute bottom-11 left-0 z-30 grid grid-cols-6 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">{["😀", "😂", "😍", "👍", "❤️", "🎉", "🙏", "😊", "😮", "😢", "🔥", "✅", "👏", "🤝", "💯", "👀", "🙌", "🤔"].map((emoji) => <button key={emoji} type="button" onClick={() => appendEmoji(emoji)} className="rounded-md p-1.5 text-lg hover:bg-violet-50">{emoji}</button>)}</div>}
                            </div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              multiple
                              onChange={(event) => {
                                const incoming = Array.from(event.target.files || []);
                                setSelectedFiles((previous) => [...previous, ...incoming]);
                                event.target.value = "";
                              }}
                              className="hidden"
                            />
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="hidden text-[10px] text-slate-400 sm:inline">Enter to send · Shift+Enter for new line</span>
                            <button
                              type="submit"
                              disabled={(!message.trim() && selectedFiles.length === 0) || sendingMessage}
                              className="flex h-9 items-center justify-center gap-2 rounded-lg bg-violet-600 px-3.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                            >
                              {sendingMessage ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                              <span className="hidden sm:inline">Send</span>
                            </button>
                          </div>
                        </div>
                      </form>
                      <p className="mt-2 text-center text-[10px] text-slate-400">Keep messages respectful and professional.</p>
                    </div>
                  </div>
                </>
              )}

              {headerTab === "files" && (
                <div className="flex-1 overflow-y-auto bg-white p-5 sm:p-8">
                  <div className="mx-auto max-w-4xl">
                    <h3 className="mb-4 text-sm font-bold text-slate-800">Shared files</h3>
                    {fileMessages.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center text-sm text-slate-500">No files shared in this chat.</div> : (
                      <div className="space-y-2">{fileMessages.flatMap((item) => (item.attachments || []).filter((attachment) => !String(attachment?.mimeType || attachment?.fileType || "").startsWith("image/")).map((attachment, index) => (
                        <a key={`${getMessageId(item)}-${index}`} href={getFileUrl(attachment.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50">
                          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-700"><FileText size={19} /></span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{attachment.originalName || attachment.filename || "Attachment"}</span><span className="text-xs text-slate-400">{formatMessageTime(item.createdAt)}</span></span>
                          <span className="text-xs font-semibold text-violet-700">Open</span>
                        </a>
                      )))}</div>
                    )}
                  </div>
                </div>
              )}

              {headerTab === "photos" && (
                <div className="flex-1 overflow-y-auto bg-white p-5 sm:p-8">
                  <div className="mx-auto max-w-4xl">
                    <h3 className="mb-4 text-sm font-bold text-slate-800">Shared photos</h3>
                    {photoMessages.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center text-sm text-slate-500">No photos shared in this chat.</div> : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{photoMessages.flatMap((item) => (item.attachments || []).filter((attachment) => String(attachment?.mimeType || attachment?.fileType || "").startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(attachment?.url || "")).map((attachment, index) => (
                        <a key={`${getMessageId(item)}-${index}`} href={getFileUrl(attachment.url)} target="_blank" rel="noopener noreferrer" className="group aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          <img src={getFileUrl(attachment.url)} alt={attachment.originalName || "Shared photo"} loading="lazy" className="h-full w-full object-cover transition duration-200 group-hover:scale-105" />
                        </a>
                      )))}</div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="hidden flex-1 flex-col items-center justify-center bg-white px-6 text-center lg:flex">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><MessageSquare size={34} strokeWidth={1.6} /></div>
              <h2 className="text-lg font-bold text-slate-800">Your chats, all in one place</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Select a conversation from the list or start a new chat to message your team.</p>
              <button onClick={() => setShowContactPicker(true)} className="mt-5 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"><Plus size={16} /> New chat</button>
            </div>
          )}
        </main>
      </section>

      {/* CREATE GROUP MODAL */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateGroup} className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div><h3 className="text-base font-bold text-slate-900">New group chat</h3><p className="mt-1 text-xs text-slate-500">Give your group a name and add people.</p></div>
              <button type="button" onClick={() => setShowGroupModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="space-y-4 overflow-y-auto p-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Group name</label>
                <input type="text" value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="e.g. Support Team" required maxLength={80} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Add participants</label>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {users.map((user) => {
                    const userId = getId(user);
                    if (!userId) return null;
                    const checked = selectedGroupMembers.some((id) => sameId(id, userId));
                    return <label key={userId} className="flex cursor-pointer items-center gap-3 rounded-lg p-2.5 hover:bg-slate-50">
                      <input type="checkbox" checked={checked} onChange={(event) => setSelectedGroupMembers((previous) => event.target.checked ? [...previous.filter((id) => !sameId(id, userId)), userId] : previous.filter((id) => !sameId(id, userId)))} className="h-4 w-4 accent-violet-600" />
                      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-violet-100 text-xs font-bold text-violet-700">{getUserAvatar(user) ? <img src={getFileUrl(getUserAvatar(user))} alt="" className="h-full w-full object-cover" /> : getInitials(getUserName(user))}</div>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{getUserName(user)}</span>
                      {checked && <Check size={15} className="text-violet-600" />}
                    </label>;
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">{selectedGroupMembers.length} participant{selectedGroupMembers.length === 1 ? "" : "s"} selected</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
              <button type="button" onClick={() => setShowGroupModal(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={creatingGroup || !groupName.trim() || selectedGroupMembers.length === 0} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">{creatingGroup && <Loader2 size={14} className="animate-spin" />}{creatingGroup ? "Creating…" : "Create group"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
