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
  Archive,
  ArrowLeft,
  Bell,
  BellOff,
  Bold,
  Bookmark,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CornerUpLeft,
  Download,
  Eye,
  FileText,
  Filter,
  Image as ImageIcon,
  Info,
  Italic,
  List,
  Loader2,
  Mail,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Phone,
  Pin,
  Plus,
  Search,
  Send,
  Smile,
  Trash2,
  User,
  Users,
  Video,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";

/* ============================================================
    MICROSOFT TEAMS THEME & DESIGN TOKENS
    - Teams Purple: #5B5FC7 (hover: #4F52B2, pressed: #444791)
    - Teams Dark Neutral: #242424
    - Teams Muted Neutral: #616161
    - Teams Border / Divider: #E1DFDD
    - Teams App Background: #F5F5F5
    - Teams Sent Bubble: #EEF1FD (border: #D8DDF8)
    - Teams Received Bubble: #FFFFFF (border: #E1DFDD)
    - Presence: Available (#237B4B), Busy (#C4314B), Away (#F2C80F), Offline (#8A8886)
============================================================ */

/* ============================================================
    API CONFIG & UTILITIES
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
    weekday: "long",
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
  if (Array.isArray(data?.data?.messages?.messages))
    return data.data.messages.messages;
  if (Array.isArray(data?.conversation?.messages))
    return data.conversation.messages;
  return [];
};

const getMessageId = (message) => message?._id || message?.id || null;
const getConversationId = (conversation) =>
  conversation?._id || conversation?.id || null;

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
  const attachments = Array.isArray(message?.attachments)
    ? message.attachments
    : [];
  if (
    attachments.some((a) =>
      String(a?.mimeType || a?.fileType || "").startsWith("image/")
    )
  ) {
    return "Photo";
  }
  return attachments.length
    ? attachments[0]?.originalName || attachments[0]?.filename || "Attachment"
    : "";
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
    if (getMessageId(candidate) || getConversationIdFromMessage(candidate))
      return candidate;
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
    replyTo: message.replyTo || null,
  };
};

const revokeTemporaryAttachmentUrls = (message) => {
  (Array.isArray(message?.attachments) ? message.attachments : []).forEach(
    (att) => {
      if (
        att?.isLocalPreview &&
        typeof att.url === "string" &&
        att.url.startsWith("blob:")
      ) {
        URL.revokeObjectURL(att.url);
      }
    }
  );
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
  )
    return;
  try {
    new Notification(title, {
      body: body || "New message received",
      icon: "/favicon.ico",
    });
  } catch {}
};

const sameId = (a, b) => String(a ?? "") === String(b ?? "");

/* ============================================================
    DEMO / FALLBACK DATA FOR PREVIEW MODE
============================================================ */
const DEMO_USERS = [
  {
    _id: "demo-nadeem",
    id: "demo-nadeem",
    name: "Nadeem Nawaz",
    role: "Support Lead",
    title: "Senior Support Engineer",
    department: "Customer Experience",
    email: "nadeem@localpro1.net",
    phone: "+1 (555) 234-8901",
    isOnline: true,
    status: "available",
  },
  {
    _id: "demo-ayesha",
    id: "demo-ayesha",
    name: "Ayesha Khan",
    role: "Project Manager",
    title: "Operations & Delivery Lead",
    department: "Management",
    email: "ayesha@localpro1.net",
    phone: "+1 (555) 876-5432",
    isOnline: true,
    status: "busy",
  },
  {
    _id: "demo-usman",
    id: "demo-usman",
    name: "Usman Ali",
    role: "Technical Support",
    title: "Field Operations Specialist",
    department: "Operations",
    email: "usman@localpro1.net",
    phone: "+1 (555) 345-6789",
    isOnline: false,
    status: "offline",
  },
  {
    _id: "demo-sarah",
    id: "demo-sarah",
    name: "Sarah Jenkins",
    role: "Dispatch Coordinator",
    title: "Service Dispatcher",
    department: "Dispatch",
    email: "sarah@localpro1.net",
    phone: "+1 (555) 456-7890",
    isOnline: true,
    status: "away",
  },
];

const DEMO_CONVERSATIONS = [
  {
    _id: "demo-conv-nadeem",
    id: "demo-conv-nadeem",
    participants: [DEMO_USERS[0]],
    isGroup: false,
    lastMessage: "I have shared the updated project scope and schedules.",
    lastMessageAt: new Date().toISOString(),
    unreadCount: 1,
  },
  {
    _id: "demo-conv-group",
    id: "demo-conv-group",
    participants: DEMO_USERS,
    isGroup: true,
    groupName: "Operations & Dispatch",
    lastMessage: "Nadeem: All field technicians are assigned for today.",
    lastMessageAt: new Date(Date.now() - 3600000).toISOString(),
    unreadCount: 0,
  },
  {
    _id: "demo-conv-ayesha",
    id: "demo-conv-ayesha",
    participants: [DEMO_USERS[1]],
    isGroup: false,
    lastMessage: "Thanks, reviewed and approved the contract proposal.",
    lastMessageAt: new Date(Date.now() - 86400000).toISOString(),
    unreadCount: 0,
  },
];

const DEMO_MESSAGES = {
  "demo-conv-nadeem": [
    {
      _id: "demo-msg-1",
      id: "demo-msg-1",
      conversationId: "demo-conv-nadeem",
      sender: DEMO_USERS[0],
      body: "Hi! Are you available to review the dispatch timeline?",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      attachments: [],
      reactions: [{ emoji: "👍", count: 1 }],
      status: "sent",
    },
    {
      _id: "demo-msg-2",
      id: "demo-msg-2",
      conversationId: "demo-conv-nadeem",
      sender: {
        _id: "demo-current-admin",
        id: "demo-current-admin",
        name: "You",
        role: "admin",
      },
      body: "Yes, send it over and I'll take a look right now.",
      createdAt: new Date(Date.now() - 85000000).toISOString(),
      attachments: [],
      reactions: [],
      status: "seen",
    },
    {
      _id: "demo-msg-3",
      id: "demo-msg-3",
      conversationId: "demo-conv-nadeem",
      sender: DEMO_USERS[0],
      body: "I have shared the updated project scope and schedules.",
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      attachments: [],
      reactions: [],
      status: "delivered",
    },
  ],
  "demo-conv-group": [
    {
      _id: "demo-group-msg-1",
      id: "demo-group-msg-1",
      conversationId: "demo-conv-group",
      sender: DEMO_USERS[0],
      body: "Welcome to the Operations & Dispatch channel! Keep all field updates posted here.",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      attachments: [],
      reactions: [{ emoji: "🎉", count: 2 }],
      status: "sent",
    },
    {
      _id: "demo-group-msg-2",
      id: "demo-group-msg-2",
      conversationId: "demo-conv-group",
      sender: DEMO_USERS[1],
      body: "Thanks everyone. Schedule is locked in.",
      createdAt: new Date(Date.now() - 85000000).toISOString(),
      attachments: [],
      reactions: [{ emoji: "👍", count: 1 }],
      status: "sent",
    },
    {
      _id: "demo-group-msg-3",
      id: "demo-group-msg-3",
      conversationId: "demo-conv-group",
      sender: DEMO_USERS[0],
      body: "All field technicians are assigned for today.",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      attachments: [],
      reactions: [],
      status: "sent",
    },
  ],
  "demo-conv-ayesha": [
    {
      _id: "demo-ayesha-msg-1",
      id: "demo-ayesha-msg-1",
      conversationId: "demo-conv-ayesha",
      sender: DEMO_USERS[1],
      body: "I reviewed the latest customer agreement draft.",
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      attachments: [],
      reactions: [],
      status: "sent",
    },
    {
      _id: "demo-ayesha-msg-2",
      id: "demo-ayesha-msg-2",
      conversationId: "demo-conv-ayesha",
      sender: {
        _id: "demo-current-admin",
        id: "demo-current-admin",
        name: "You",
        role: "admin",
      },
      body: "Thanks, reviewed and approved the contract proposal.",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      attachments: [],
      reactions: [{ emoji: "❤️", count: 1 }],
      status: "seen",
    },
  ],
};

/* ============================================================
    TEAMS PRESENCE BADGE COMPONENT
============================================================ */
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
  if (status === "away") {
    return (
      <span
        title="Away"
        className={`flex items-center justify-center rounded-full border-2 border-white bg-[#F2C80F] shadow-xs ${className}`}
      />
    );
  }
  // Offline
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
    MAIN TEAMS ADMIN CONVERSATION PAGE
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

  // In-chat search
  const [messageSearch, setMessageSearch] = useState("");
  const [showMessageSearch, setShowMessageSearch] = useState(false);

  // Message Editing & Reply
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [messageActionBusy, setMessageActionBusy] = useState(false);

  // Real-time Typing Indicators
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimerRef = useRef(null);
  const emitTypingTimerRef = useRef(null);

  // Online & Presence tracking
  const [onlineUsers, setOnlineUsers] = useState({});

  // Group creation modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Teams Tab Navigation in Chat Pane: "chat" | "files" | "photos" | "profile"
  const [headerTab, setHeaderTab] = useState("chat");
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [chatFilter, setChatFilter] = useState("all"); // 'all' | 'unread' | 'pinned'

  // Preferences & State
  const [favorites, setFavorites] = useState([]);
  const [mutedChats, setMutedChats] = useState([]);
  const [pinnedChats, setPinnedChats] = useState(["demo-conv-group"]);

  // Teams New Chat & Compose Drawer
  const [showNewChatDrawer, setShowNewChatDrawer] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [formatActive, setFormatActive] = useState(false);

  // Photo Lightbox modal
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);

  // Context Menu for a specific chat item
  const [activeChatItemMenu, setActiveChatItemMenu] = useState(null);

  // Refs
  const menuRef = useRef(null);
  const chatItemMenuRef = useRef(null);
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

  /* ------------------------------------------------------------
     INITIALIZATION & LOCALSTORAGE CACHE
  ------------------------------------------------------------ */
  useEffect(() => {
    // The conversation workspace owns its viewport; prevent the page behind it
    // from scrolling so the chat header and composer stay in place.
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    setIsClient(true);
    mountedRef.current = true;
    try {
      const cachedUsers = JSON.parse(
        localStorage.getItem("localpro_admin_users") || "[]"
      );
      const cachedConvs = JSON.parse(
        localStorage.getItem("localpro_admin_convs") || "[]"
      );
      const cachedMsgs = JSON.parse(
        localStorage.getItem("localpro_admin_msgs") || "{}"
      );
      const prefs = JSON.parse(
        localStorage.getItem("localpro_admin_chat_prefs") || "{}"
      );
      if (Array.isArray(cachedUsers) && cachedUsers.length) {
        setUsers(cachedUsers);
        usersRef.current = cachedUsers;
      }
      if (Array.isArray(cachedConvs) && cachedConvs.length) {
        setConversations(cachedConvs);
        conversationsRef.current = cachedConvs;
        setLoadingUsers(false);
      }
      if (cachedMsgs && typeof cachedMsgs === "object") {
        messagesCache.current = cachedMsgs;
      }
      if (Array.isArray(prefs.favorites)) setFavorites(prefs.favorites);
      if (Array.isArray(prefs.mutedChats)) setMutedChats(prefs.mutedChats);
      if (Array.isArray(prefs.pinnedChats)) setPinnedChats(prefs.pinnedChats);
    } catch {}

    return () => {
      mountedRef.current = false;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      Object.values(messagesCache.current).forEach((list) => {
        if (Array.isArray(list)) list.forEach(revokeTemporaryAttachmentUrls);
      });
    };
  }, []);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "localpro_admin_chat_prefs",
        JSON.stringify({ favorites, mutedChats, pinnedChats })
      );
    } catch {}
  }, [favorites, mutedChats, pinnedChats]);

  // Handle outside click for menus
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setChatMenuOpen(false);
      }
      if (
        chatItemMenuRef.current &&
        !chatItemMenuRef.current.contains(event.target)
      ) {
        setActiveChatItemMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const saveCache = useCallback((uList, cList, mCache) => {
    if (typeof window === "undefined") return;
    try {
      if (Array.isArray(uList))
        localStorage.setItem("localpro_admin_users", JSON.stringify(uList));
      if (Array.isArray(cList))
        localStorage.setItem("localpro_admin_convs", JSON.stringify(cList));
      if (mCache && typeof mCache === "object") {
        const safeCache = {};
        Object.entries(mCache).forEach(([cId, list]) => {
          if (!Array.isArray(list)) return;
          safeCache[cId] = list.filter(
            (item) => !String(getMessageId(item) || "").startsWith("temp-")
          );
        });
        localStorage.setItem("localpro_admin_msgs", JSON.stringify(safeCache));
      }
    } catch {}
  }, []);

  const scrollToBottom = useCallback((instant = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: instant ? "auto" : "smooth",
      block: "end",
    });
  }, []);

  useEffect(() => {
    if (messages.length) scrollToBottom(false);
  }, [messages, scrollToBottom]);

  /* ------------------------------------------------------------
     FETCH DATA (USERS & CONVERSATIONS)
  ------------------------------------------------------------ */
  const fetchData = useCallback(
    async (force = false) => {
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

        // Only use preview/demo data when the backend is unavailable and no
        // authenticated session exists. An authenticated empty response means
        // the real account has no records; never replace it with fake chats.
        if (
          receivedUsers.length === 0 &&
          receivedConversations.length === 0 &&
          (!usersRes.ok || !conversationsRes.ok) &&
          !getStoredToken()
        ) {
          if (mountedRef.current) {
            setDemoMode(true);
            setUsers(DEMO_USERS);
            usersRef.current = DEMO_USERS;
            setConversations(DEMO_CONVERSATIONS);
            conversationsRef.current = DEMO_CONVERSATIONS;
            messagesCache.current = {
              ...messagesCache.current,
              ...DEMO_MESSAGES,
            };
            saveCache(DEMO_USERS, DEMO_CONVERSATIONS, messagesCache.current);
            // Default select first conversation for seamless preview
            if (!selectedConversationIdRef.current) {
              const firstConv = DEMO_CONVERSATIONS[0];
              setSelectedConversationId(firstConv._id);
              selectedConversationIdRef.current = firstConv._id;
              setSelectedConversation(firstConv);
              setSelectedUser(DEMO_USERS[0]);
              setMessages(DEMO_MESSAGES[firstConv._id] || []);
            }
          }
          return;
        }

        if (mountedRef.current) setDemoMode(false);

        if (usersRes.ok) {
          if (mountedRef.current) {
            setUsers(receivedUsers);
            usersRef.current = receivedUsers;
            saveCache(
              receivedUsers,
              conversationsRef.current,
              messagesCache.current
            );
          }
        }

        if (conversationsRes.ok) {
          if (mountedRef.current) {
            setConversations((previous) => {
              const merged = receivedConversations.map((incoming) => {
                const old = previous.find((item) =>
                  sameId(getConversationId(item), getConversationId(incoming))
                );
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

            if (receivedConversations.length === 0) {
              selectedConversationIdRef.current = null;
              setSelectedConversationId(null);
              setSelectedConversation(null);
              setSelectedUser(null);
              setMessages([]);
            }

            // If nothing selected yet, select the first conversation
            if (!selectedConversationIdRef.current && receivedConversations[0]) {
              const first = receivedConversations[0];
              openConversation(first);
            }
          }
        }
      } catch {
        if (
          mountedRef.current &&
          !getStoredToken() &&
          usersRef.current.length === 0 &&
          conversationsRef.current.length === 0
        ) {
          setDemoMode(true);
          setUsers(DEMO_USERS);
          usersRef.current = DEMO_USERS;
          setConversations(DEMO_CONVERSATIONS);
          conversationsRef.current = DEMO_CONVERSATIONS;
          messagesCache.current = {
            ...messagesCache.current,
            ...DEMO_MESSAGES,
          };
          saveCache(DEMO_USERS, DEMO_CONVERSATIONS, messagesCache.current);
          if (!selectedConversationIdRef.current) {
            const firstConv = DEMO_CONVERSATIONS[0];
            setSelectedConversationId(firstConv._id);
            selectedConversationIdRef.current = firstConv._id;
            setSelectedConversation(firstConv);
            setSelectedUser(DEMO_USERS[0]);
            setMessages(DEMO_MESSAGES[firstConv._id] || []);
          }
        }
      } finally {
        if (mountedRef.current) setLoadingUsers(false);
      }
    },
    [router, saveCache]
  );

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => fetchData(true), 450);
  }, [fetchData]);

  useEffect(() => {
    if (!isClient) return;
    fetchData(false);
    const interval = setInterval(() => fetchData(true), 60000);
    return () => {
      clearInterval(interval);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [isClient, fetchData]);

  const findConversationForUser = useCallback(
    (userId, list = conversationsRef.current) => {
      if (!userId) return null;
      return (
        list.find((conversation) => {
          if (conversation?.isGroup) return false;
          const participants = Array.isArray(conversation?.participants)
            ? conversation.participants
            : [];
          return participants.some((participant) =>
            sameId(getId(participant), userId)
          );
        }) || null
      );
    },
    []
  );

  /* ------------------------------------------------------------
     FETCH MESSAGES FOR A CONVERSATION
  ------------------------------------------------------------ */
  const fetchMessages = useCallback(
    async (conversationId, silent = false) => {
      if (!conversationId) return [];
      const cId = String(conversationId);
      if (cId.startsWith("demo-") || demoMode) {
        const demoList =
          messagesCache.current[cId] || DEMO_MESSAGES[cId] || [];
        messagesCache.current[cId] = demoList;
        setMessages(demoList);
        return demoList;
      }
      if (fetchingMessagesRef.current.has(cId))
        return messagesCache.current[cId] || [];
      fetchingMessagesRef.current.add(cId);
      const requestId = ++activeRequestRef.current;
      const cached = messagesCache.current[cId];

      if (cached && Array.isArray(cached) && cached.length > 0 && !silent) {
        setMessages(cached);
      }

      try {
        const response = await fetch(
          getApiUrl(
            `/messages?conversationId=${encodeURIComponent(cId)}&limit=100`
          ),
          {
            method: "GET",
            credentials: "include",
            headers: getAuthHeaders(),
            cache: "no-store",
          }
        );
        const data = await parseResponse(response);
        if (!response.ok || data?.success === false) {
          throw new Error(data?.message || "Failed to load messages.");
        }

        const fetched = extractMessages(data).map((item) =>
          normalizeMessage(item, cId)
        );
        if (!sameId(selectedConversationIdRef.current, cId)) return fetched;

        setMessages((previous) => {
          const current = previous.filter(
            (item) => !String(getMessageId(item) || "").startsWith("temp-")
          );
          const byId = new Map();
          [...fetched, ...current].forEach((item) => {
            const id = getMessageId(item);
            if (id)
              byId.set(String(id), { ...(byId.get(String(id)) || {}), ...item });
          });
          const merged = Array.from(byId.values()).sort(
            (a, b) =>
              new Date(a?.createdAt || 0).getTime() -
              new Date(b?.createdAt || 0).getTime()
          );
          messagesCache.current[cId] = merged;
          saveCache(
            usersRef.current,
            conversationsRef.current,
            messagesCache.current
          );
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
    },
    [demoMode, saveCache]
  );

  const markConversationRead = useCallback(
    async (conversationId) => {
      if (!conversationId) return;
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
        let response = await fetch(
          getApiUrl(`/messages/read/${conversationId}`),
          {
            method: "PUT",
            credentials: "include",
            headers: getAuthHeaders(),
          }
        );
        if (!response.ok) {
          response = await fetch(
            getApiUrl(`/conversations/${conversationId}/read`),
            {
              method: "PUT",
              credentials: "include",
              headers: getAuthHeaders(),
            }
          );
        }
        // Keep compatibility with socket servers that implement read receipts.
        socketRef.current?.emit("mark_messages_read", {
          conversationId: String(conversationId),
        });
      } catch {}
    },
    [saveCache]
  );

  const openConversation = useCallback(
    async (conversation, user = null) => {
      const conversationId = getConversationId(conversation);
      if (!conversationId) return;
      selectedConversationIdRef.current = String(conversationId);
      setSelectedConversationId(String(conversationId));
      setSelectedConversation(conversation);
      setHeaderTab("chat");
      setChatMenuOpen(false);
      setShowNewChatDrawer(false);
      setReplyingTo(null);

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
        const participants = Array.isArray(conversation?.participants)
          ? conversation.participants
          : [];
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
      socketRef.current?.emit("join_room", String(conversationId));
    },
    [fetchMessages, markConversationRead]
  );

  const handleSelectUser = useCallback(
    async (user) => {
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
        const newConversation =
          data?.conversation || data?.data?.conversation || data?.data;
        const newId = getConversationId(newConversation);
        if (!newId)
          throw new Error("The server did not return a conversation ID.");

        setConversations((previous) => {
          const updated = [
            newConversation,
            ...previous.filter(
              (item) => !sameId(getConversationId(item), newId)
            ),
          ];
          conversationsRef.current = updated;
          saveCache(usersRef.current, updated, messagesCache.current);
          return updated;
        });
        await openConversation(newConversation, user);
      } catch {
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
            const updated = [
              localConversation,
              ...previous.filter(
                (item) =>
                  !sameId(getConversationId(item), localConversation._id)
              ),
            ];
            conversationsRef.current = updated;
            saveCache(usersRef.current, updated, messagesCache.current);
            return updated;
          });
          messagesCache.current[localConversation._id] = [];
          await openConversation(localConversation, user);
        } else {
          setMessagesError("Failed to start conversation.");
        }
      } finally {
        setStartingConversation(false);
      }
    },
    [demoMode, findConversationForUser, openConversation, saveCache]
  );

  /* ------------------------------------------------------------
     SOCKET.IO REAL-TIME LISTENERS
  ------------------------------------------------------------ */
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
          processedSocketMessages.current = new Set(
            Array.from(processedSocketMessages.current).slice(-1000)
          );
        }
      }

      const activeId = String(selectedConversationIdRef.current || "");
      const isActive = activeId === String(conversationId);
      const isOwn = Boolean(
        normalized?.isOwn || normalized?.sender?.isCurrentUser
      );

      if (isActive) {
        setMessages((previous) => {
          const id = getMessageId(normalized);
          if (id && previous.some((item) => sameId(getMessageId(item), id))) {
            return previous.map((item) =>
              sameId(getMessageId(item), id) ? { ...item, ...normalized } : item
            );
          }
          const tempIndex = previous.findIndex(
            (item) =>
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
          next.sort(
            (a, b) =>
              new Date(a?.createdAt || 0).getTime() -
              new Date(b?.createdAt || 0).getTime()
          );
          messagesCache.current[String(conversationId)] = next;
          saveCache(
            usersRef.current,
            conversationsRef.current,
            messagesCache.current
          );
          return next;
        });
        void markConversationRead(conversationId);
      }

      setConversations((previous) => {
        const index = previous.findIndex((item) =>
          sameId(getConversationId(item), conversationId)
        );
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

    const handleReadUpdate = (payload) => {
      const convId = String(payload?.conversationId || payload?.roomId || "");
      if (convId) {
        setMessages((prev) =>
          prev.map((m) =>
            sameId(getConversationIdFromMessage(m), convId) ||
            sameId(selectedConversationIdRef.current, convId)
              ? { ...m, isRead: true, status: "seen", seen: true }
              : m
          )
        );
        if (messagesCache.current[convId]) {
          messagesCache.current[convId] = messagesCache.current[convId].map(
            (m) => ({ ...m, isRead: true, status: "seen", seen: true })
          );
        }
      }
    };

    const handleTypingStart = (payload) => {
      const convId = String(payload?.conversationId || payload?.roomId || "");
      if (!convId) return;
      const userName = payload?.userName || payload?.senderName || "User";
      setTypingUsers((prev) => ({
        ...prev,
        [convId]: userName,
      }));
    };

    const handleTypingStop = (payload) => {
      const convId = String(payload?.conversationId || payload?.roomId || "");
      if (!convId) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[convId];
        return next;
      });
    };

    const handlePresence = (payload) => {
      const userId = getId(payload?.user || payload?.userId || payload);
      if (userId) {
        setOnlineUsers((previous) => ({
          ...previous,
          [String(userId)]: Boolean(
            payload?.online ?? payload?.isOnline ?? true
          ),
        }));
      }
    };

    [
      "receive_message",
      "new_message",
      "message_notification",
      "message_sent",
      "message:new",
    ].forEach((eventName) => {
      socket.on(eventName, handleIncomingMessage);
    });
    [
      "message_updated",
      "message_edited",
      "message_deleted",
      "message_reaction_updated",
      "message:updated",
      "message:deleted",
    ].forEach((eventName) => {
      socket.on(eventName, handleMessageUpdate);
    });
    [
      "messages_read",
      "message_read",
      "read_receipt",
      "message:read",
      "messages:read",
    ].forEach((eventName) => {
      socket.on(eventName, handleReadUpdate);
    });
    [
      "typing:start",
      "user_typing",
      "typing",
    ].forEach((eventName) => {
      socket.on(eventName, handleTypingStart);
    });
    [
      "typing:stop",
      "user_stopped_typing",
      "stop_typing",
    ].forEach((eventName) => {
      socket.on(eventName, handleTypingStop);
    });
    [
      "user_online",
      "user_offline",
      "presence_update",
      "update_user_status",
      "user_status_update",
      "user:online",
      "user:offline",
    ].forEach((eventName) => {
      socket.on(eventName, handlePresence);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [
    isClient,
    fetchMessages,
    markConversationRead,
    mutedChats,
    saveCache,
    scheduleRefresh,
  ]);

  const updateMessageInState = useCallback(
    (updatedMessage) => {
      if (!updatedMessage) return;
      const conversationId =
        getConversationIdFromMessage(updatedMessage) ||
        selectedConversationIdRef.current;
      const normalized = normalizeMessage(updatedMessage, conversationId);
      const messageId = String(getMessageId(normalized) || "");
      if (!messageId) return;

      setMessages((previous) => {
        const next = previous.map((item) =>
          sameId(getMessageId(item), messageId)
            ? { ...item, ...normalized }
            : item
        );
        if (conversationId)
          messagesCache.current[String(conversationId)] = next;
        saveCache(
          usersRef.current,
          conversationsRef.current,
          messagesCache.current
        );
        return next;
      });
    },
    [saveCache]
  );

  /* ------------------------------------------------------------
     MESSAGE ACTIONS: SEND, EDIT, DELETE, REACT, REPLY
  ------------------------------------------------------------ */
  const handleSendMessage = async (event) => {
    event?.preventDefault();
    const cleanBody = message.trim();
    const conversationId = selectedConversationId;
    const recipientId = selectedConversation?.isGroup
      ? null
      : getId(selectedUser);
    const filesToSend = [...selectedFiles];
    const replyContext = replyingTo ? { ...replyingTo } : null;

    if (
      (!cleanBody && filesToSend.length === 0) ||
      !conversationId ||
      !selectedUser ||
      sendingRef.current
    )
      return;

    const tempId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const optimistic = {
      _id: tempId,
      id: tempId,
      conversationId,
      body: cleanBody,
      sender: { role: "admin", name: "You", isCurrentUser: true },
      createdAt: new Date().toISOString(),
      attachments: filesToSend.map((file) => ({
        filename: file.name,
        originalName: file.name,
        mimeType: file.type,
        url: URL.createObjectURL(file),
        isLocalPreview: true,
      })),
      replyTo: replyContext,
      status: "sending",
      clientMessageId: tempId,
    };

    sendingRef.current = true;
    setSendingMessage(true);
    setMessagesError("");
    setMessage("");
    setSelectedFiles([]);
    setReplyingTo(null);

    setMessages((previous) => {
      const next = [...previous, optimistic];
      messagesCache.current[String(conversationId)] = next;
      saveCache(
        usersRef.current,
        conversationsRef.current,
        messagesCache.current
      );
      return next;
    });

    setConversations((previous) => {
      const updated = previous.map((item) =>
        sameId(getConversationId(item), conversationId)
          ? {
              ...item,
              lastMessage:
                cleanBody || (filesToSend.length ? "Attachment" : ""),
              lastMessageAt: optimistic.createdAt,
              updatedAt: optimistic.createdAt,
            }
          : item
      );
      conversationsRef.current = updated;
      return updated;
    });
    scrollToBottom(true);

    try {
      if (demoMode || String(conversationId).startsWith("demo-")) {
        const sentAt = new Date().toISOString();
        const localMessage = {
          ...optimistic,
          status: "delivered",
          createdAt: sentAt,
        };
        setMessages((previous) => {
          const next = previous.map((item) =>
            sameId(getMessageId(item), tempId) ? localMessage : item
          );
          messagesCache.current[String(conversationId)] = next;
          saveCache(
            usersRef.current,
            conversationsRef.current,
            messagesCache.current
          );
          return next;
        });
        scrollToBottom(true);
        return;
      }

      let data;

      if (filesToSend.length) {
        // Keep file uploads on the existing authenticated REST endpoint;
        // Socket.IO is used for text messages to avoid an extra HTTP round trip.
        const form = new FormData();
        form.append("conversationId", String(conversationId));
        form.append("body", cleanBody);
        form.append("clientMessageId", tempId);
        if (recipientId) form.append("recipientId", String(recipientId));
        if (replyContext)
          form.append("replyToId", String(getMessageId(replyContext)));
        filesToSend.forEach((file) => form.append("files", file));

        const response = await fetch(getApiUrl("/messages"), {
          method: "POST",
          credentials: "include",
          headers: getAuthHeaders(false),
          body: form,
        });
        data = await parseResponse(response);
        if (!response.ok || data?.success === false) {
          throw new Error(data?.message || "Failed to send message.");
        }
      } else {
        const socket = socketRef.current;
        const payload = {
          conversationId: String(conversationId),
          recipientId: recipientId ? String(recipientId) : null,
          body: cleanBody,
          message: cleanBody,
          messageType: "text",
          clientMessageId: tempId,
          replyToId: replyContext ? getMessageId(replyContext) : null,
        };

        if (socket?.connected) {
          // The backend must acknowledge only after the message is persisted.
          // Never fall back to REST after an acknowledgement timeout: the
          // socket may already have saved it and a REST retry could duplicate it.
          data = await new Promise((resolve, reject) => {
            socket.timeout(10000).emit("send_message", payload, (error, result) => {
              if (error) {
                reject(
                  new Error(
                    "Socket message timed out. Please check the connection and retry."
                  )
                );
                return;
              }
              if (!result || result.success === false) {
                reject(new Error(result?.message || "Failed to send message."));
                return;
              }
              resolve(result);
            });
          });
        } else {
          // Preserve text-message delivery during temporary socket disconnects.
          // This REST fallback runs only when no socket send was attempted.
          const response = await fetch(getApiUrl("/messages"), {
            method: "POST",
            credentials: "include",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
          });
          data = await parseResponse(response);
          if (!response.ok || data?.success === false) {
            throw new Error(data?.message || "Failed to send message.");
          }
        }
      }

      const sentMessage =
        data?.data?.message ||
        data?.data ||
        (data?.message && typeof data.message === "object"
          ? data.message
          : null);
      if (
        sentMessage &&
        typeof sentMessage === "object" &&
        (getMessageId(sentMessage) || getConversationIdFromMessage(sentMessage))
      ) {
        const normalized = normalizeMessage(sentMessage, conversationId);
        setMessages((previous) => {
          const next = previous.filter(
            (item) => !sameId(getMessageId(item), tempId)
          );
          const canonicalId = getMessageId(normalized);
          const alreadyExists =
            canonicalId &&
            next.some((item) => sameId(getMessageId(item), canonicalId));
          const merged = alreadyExists
            ? next.map((item) =>
                sameId(getMessageId(item), canonicalId)
                  ? { ...item, ...normalized, status: "delivered" }
                  : item
              )
            : [...next, { ...normalized, status: "delivered" }];
          merged.sort(
            (a, b) =>
              new Date(a?.createdAt || 0).getTime() -
              new Date(b?.createdAt || 0).getTime()
          );
          messagesCache.current[String(conversationId)] = merged;
          saveCache(
            usersRef.current,
            conversationsRef.current,
            messagesCache.current
          );
          return merged;
        });
      } else {
        setMessages((previous) =>
          previous.map((item) =>
            sameId(getMessageId(item), tempId)
              ? { ...item, status: "delivered" }
              : item
          )
        );
        await fetchMessages(conversationId, true);
      }
      socketRef.current?.emit("join_room", String(conversationId));
    } catch (error) {
      setMessagesError(
        error?.message || "Message could not be sent. Please retry."
      );
      setMessages((previous) =>
        previous.map((item) =>
          sameId(getMessageId(item), tempId) ? { ...item, status: "failed" } : item
        )
      );
      setMessage(cleanBody);
      setSelectedFiles(filesToSend);
    } finally {
      sendingRef.current = false;
      setSendingMessage(false);
      messageInputRef.current?.focus();
    }
  };

  const handleSaveEditedMessage = async (item) => {
    const id = getMessageId(item);
    const clean = editDraft.trim();
    if (!id || !clean || messageActionBusy) return;

    if (String(id).startsWith("temp-") || demoMode) {
      updateMessageInState({
        ...item,
        body: clean,
        editedAt: new Date().toISOString(),
      });
      setEditingMessageId(null);
      setEditDraft("");
      return;
    }

    try {
      setMessageActionBusy(true);
      const response = await fetch(getApiUrl(`/messages/${id}`), {
        method: "PATCH",
        credentials: "include",
        headers: getAuthHeaders(),
        body: JSON.stringify({ body: clean, message: clean }),
      });
      const data = await parseResponse(response);
      if (!response.ok || data?.success === false)
        throw new Error(data?.message || "Could not edit message.");
      const updated = data?.data?.message || data?.message || data?.data;
      if (updated && typeof updated === "object") updateMessageInState(updated);
      else
        updateMessageInState({
          ...item,
          body: clean,
          editedAt: new Date().toISOString(),
        });
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
    if (!id || messageActionBusy) return;

    // Optimistic reaction update
    const currentReactions = Array.isArray(item.reactions)
      ? [...item.reactions]
      : [];
    const existingIndex = currentReactions.findIndex((r) => {
      const rEmoji = typeof r === "string" ? r : r?.emoji;
      return rEmoji === emoji;
    });

    let updatedReactions;
    if (existingIndex >= 0) {
      const existing = currentReactions[existingIndex];
      const count = typeof existing === "object" ? existing.count || 1 : 1;
      if (count <= 1) {
        updatedReactions = currentReactions.filter(
          (_, idx) => idx !== existingIndex
        );
      } else {
        updatedReactions = currentReactions.map((r, idx) =>
          idx === existingIndex ? { ...r, count: count - 1 } : r
        );
      }
    } else {
      updatedReactions = [...currentReactions, { emoji, count: 1 }];
    }

    updateMessageInState({ ...item, reactions: updatedReactions });

    if (String(id).startsWith("temp-") || demoMode) return;

    try {
      const response = await fetch(getApiUrl(`/messages/${id}/reactions`), {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: JSON.stringify({ emoji }),
      });
      const data = await parseResponse(response);
      if (!response.ok || data?.success === false) {
        // Rollback silently or ignore
      }
    } catch {}
  };

  const handleDeleteMessage = async (item, scope = "everyone") => {
    const id = getMessageId(item);
    if (!id || messageActionBusy) return;
    if (
      !window.confirm(
        scope === "everyone"
          ? "Delete this message for everyone in Teams?"
          : "Delete this message from your chat view?"
      )
    )
      return;

    if (String(id).startsWith("temp-") || demoMode) {
      if (scope === "everyone") {
        updateMessageInState({
          ...item,
          isDeletedForEveryone: true,
          body: "This message was deleted.",
          attachments: [],
        });
      } else {
        setMessages((previous) =>
          previous.filter((m) => !sameId(getMessageId(m), id))
        );
      }
      return;
    }

    try {
      setMessageActionBusy(true);
      const endpoint =
        scope === "everyone"
          ? `/messages/${id}/delete-for-everyone`
          : `/messages/${id}/delete-for-me`;
      let response = await fetch(getApiUrl(endpoint), {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: JSON.stringify({}),
      });
      if (!response.ok && scope === "me") {
        response = await fetch(getApiUrl(`/messages/${id}`), {
          method: "DELETE",
          credentials: "include",
          headers: getAuthHeaders(),
        });
      }
      if (scope === "everyone") {
        updateMessageInState({
          ...item,
          isDeletedForEveryone: true,
          body: "This message was deleted.",
          attachments: [],
        });
      } else {
        setMessages((previous) =>
          previous.filter((m) => !sameId(getMessageId(m), id))
        );
      }
    } catch (error) {
      setMessagesError(error?.message || "Could not delete message.");
    } finally {
      setMessageActionBusy(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (
      !selectedConversationId ||
      !window.confirm("Are you sure you want to delete this chat?")
    )
      return;
    const cId = selectedConversationId;
    setConversations((previous) =>
      previous.filter((item) => !sameId(getConversationId(item), cId))
    );
    delete messagesCache.current[String(cId)];
    setSelectedConversationId(null);
    selectedConversationIdRef.current = null;
    setSelectedConversation(null);
    setSelectedUser(null);
    setMessages([]);
    setChatMenuOpen(false);

    if (String(cId).startsWith("demo-") || demoMode) return;
    try {
      await fetch(getApiUrl(`/conversations/${cId}`), {
        method: "DELETE",
        credentials: "include",
        headers: getAuthHeaders(),
      });
    } catch {}
  };

  const handleMarkUnread = async () => {
    if (!selectedConversationId) return;
    const cId = selectedConversationId;
    setConversations((previous) =>
      previous.map((item) =>
        sameId(getConversationId(item), cId)
          ? { ...item, unreadCount: Math.max(1, getUnreadCount(item) || 1) }
          : item
      )
    );
    setChatMenuOpen(false);
    try {
      await fetch(getApiUrl(`/conversations/${cId}/unread`), {
        method: "PUT",
        credentials: "include",
        headers: getAuthHeaders(),
      });
    } catch {}
  };

  const handleCreateGroup = async (event) => {
    event.preventDefault();
    if (!groupName.trim() || selectedGroupMembers.length === 0 || creatingGroup)
      return;
    try {
      setCreatingGroup(true);
      if (demoMode) {
        const newGroup = {
          _id: `demo-group-${Date.now()}`,
          id: `demo-group-${Date.now()}`,
          isGroup: true,
          groupName: groupName.trim(),
          participants: users.filter((u) =>
            selectedGroupMembers.includes(getId(u))
          ),
          lastMessage: "Group chat created.",
          lastMessageAt: new Date().toISOString(),
          unreadCount: 0,
        };
        setConversations((prev) => [newGroup, ...prev]);
        setShowGroupModal(false);
        setGroupName("");
        setSelectedGroupMembers([]);
        await openConversation(newGroup);
        return;
      }

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
      if (!response.ok || data?.success === false)
        throw new Error(data?.message || "Failed to create group.");
      const group = data?.conversation || data?.data?.conversation || data?.data;
      if (!getConversationId(group))
        throw new Error("The server did not return the new group.");

      setConversations((previous) => [group, ...previous]);
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

  /* ------------------------------------------------------------
     FILTERING & PREFERENCES
  ------------------------------------------------------------ */
  const toggleFavorite = (convId) => {
    const key = String(convId || selectedConversationId);
    setFavorites((prev) =>
      prev.includes(key) ? prev.filter((i) => i !== key) : [...prev, key]
    );
    setChatMenuOpen(false);
  };

  const toggleMute = (convId) => {
    const key = String(convId || selectedConversationId);
    setMutedChats((prev) =>
      prev.includes(key) ? prev.filter((i) => i !== key) : [...prev, key]
    );
    setChatMenuOpen(false);
  };

  const togglePin = (convId) => {
    const key = String(convId || selectedConversationId);
    setPinnedChats((prev) =>
      prev.includes(key) ? prev.filter((i) => i !== key) : [...prev, key]
    );
    setChatMenuOpen(false);
  };

  const sortedConversations = useMemo(() => {
    let list = [...conversations];
    const query = search.trim().toLowerCase();

    if (query) {
      list = list.filter((conv) => {
        const name = conv.isGroup
          ? conv.groupName || ""
          : getUserName(conv.participants?.[0] || {});
        const last = getConversationLastMessage(conv);
        return (
          name.toLowerCase().includes(query) ||
          last.toLowerCase().includes(query)
        );
      });
    }

    if (chatFilter === "unread") {
      list = list.filter((c) => getUnreadCount(c) > 0);
    }

    return list.sort((a, b) => {
      const aId = String(getConversationId(a) || "");
      const bId = String(getConversationId(b) || "");
      const aPinned = pinnedChats.includes(aId) ? 1 : 0;
      const bPinned = pinnedChats.includes(bId) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return (
        new Date(getConversationLastDate(b) || 0).getTime() -
        new Date(getConversationLastDate(a) || 0).getTime()
      );
    });
  }, [conversations, search, chatFilter, pinnedChats]);

  const pinnedConversations = useMemo(
    () =>
      sortedConversations.filter((c) =>
        pinnedChats.includes(String(getConversationId(c)))
      ),
    [sortedConversations, pinnedChats]
  );

  const recentConversations = useMemo(
    () =>
      sortedConversations.filter(
        (c) => !pinnedChats.includes(String(getConversationId(c)))
      ),
    [sortedConversations, pinnedChats]
  );

  const visibleMessages = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter((item) =>
      getMessageBody(item).toLowerCase().includes(query)
    );
  }, [messages, messageSearch]);

  const photoAttachments = useMemo(
    () =>
      messages.flatMap((item) =>
        (item.attachments || [])
          .filter(
            (attachment) =>
              String(
                attachment?.mimeType || attachment?.fileType || ""
              ).startsWith("image/") ||
              /\.(jpg|jpeg|png|webp|gif)$/i.test(attachment?.url || "")
          )
          .map((att) => ({ ...att, message: item }))
      ),
    [messages]
  );

  const fileAttachments = useMemo(
    () =>
      messages.flatMap((item) =>
        (item.attachments || [])
          .filter(
            (attachment) =>
              !String(
                attachment?.mimeType || attachment?.fileType || ""
              ).startsWith("image/") &&
              !/\.(jpg|jpeg|png|webp|gif)$/i.test(attachment?.url || "")
          )
          .map((att) => ({ ...att, message: item }))
      ),
    [messages]
  );

  const selectedName = selectedUser ? getUserName(selectedUser) : "";
  const selectedAvatar = selectedUser ? getUserAvatar(selectedUser) : "";
  const isSelectedGroup = Boolean(selectedConversation?.isGroup);
  const selectedOnline = Boolean(
    onlineUsers[String(getId(selectedUser))] ??
      selectedUser?.isOnline ??
      selectedUser?.online
  );
  const selectedStatus = selectedUser?.status || (selectedOnline ? "available" : "offline");
  const selectedKey = String(selectedConversationId || "");

  const appendEmoji = (emoji) => {
    setMessage((prev) => `${prev}${emoji}`);
    setShowEmojiPicker(false);
    messageInputRef.current?.focus();
  };

  /* ============================================================
     RENDER MICROSOFT TEAMS WORKSPACE
  ============================================================ */
  return (
    <div className="relative flex h-[100dvh] min-h-0 w-full min-w-0 max-w-full overflow-hidden overscroll-none bg-[#F5F5F5] font-sans text-[#242424]">
      {/* ── TEAMS MAIN SPLIT VIEW ── */}
      <section className="flex h-full min-h-0 w-full min-w-0 max-w-full overflow-hidden">
        {/* ==========================================================
            TEAMS LEFT CHAT LIST PANE
        ========================================================== */}
        <aside
          className={`flex h-full min-h-0 w-full min-w-0 shrink-0 flex-col overflow-hidden border-r border-[#E1DFDD] bg-[#F5F5F5] transition-[width] duration-200 md:w-[300px] md:min-w-[300px] lg:w-[340px] lg:min-w-[340px] xl:w-[360px] xl:min-w-[360px] ${
            selectedConversationId ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Teams Header Bar with Chat title, Filter, New Chat */}
          <div className="flex shrink-0 items-center justify-between border-b border-[#E1DFDD] bg-[#F5F5F5] px-4 py-3">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[#242424]">
                Chat
              </h1>
              {demoMode && (
                <span className="rounded bg-[#E8EBFA] px-1.5 py-0.5 text-[10px] font-semibold text-[#5B5FC7]">
                  Preview
                </span>
              )}
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  socketConnected
                    ? "text-[#237B4B]"
                    : "text-[#8A8886]"
                }`}
                title={socketConnected ? "Realtime connected" : "Connecting..."}
              >
                {socketConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
              </span>
            </div>

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
                title="Filter unread chats"
              >
                <Filter size={16} />
              </button>
              <button
                onClick={() => setShowNewChatDrawer((prev) => !prev)}
                className="flex h-8 w-8 items-center justify-center rounded bg-transparent text-[#616161] transition hover:bg-[#EDEBE9] hover:text-[#5B5FC7]"
                title="New chat (Ctrl+N)"
                aria-label="New chat"
              >
                <Pencil size={17} />
              </button>
            </div>
          </div>

          {/* Teams Search & Quick Filter Chips */}
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
                placeholder="Search"
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
          </div>

          {/* Teams Quick Compose "To:" Bar */}
          {showNewChatDrawer && (
            <div className="border-b border-[#E1DFDD] bg-white p-3 shadow-xs">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-[#5B5FC7]">
                  New chat
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowGroupModal(true);
                      setShowNewChatDrawer(false);
                    }}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#5B5FC7] hover:underline"
                  >
                    <Plus size={12} /> Group
                  </button>
                  <button
                    onClick={() => setShowNewChatDrawer(false)}
                    className="text-[#616161] hover:text-[#242424]"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {users.map((user) => (
                  <button
                    key={getId(user)}
                    onClick={() => {
                      handleSelectUser(user);
                      setShowNewChatDrawer(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded p-1.5 text-left text-xs transition hover:bg-[#F5F5F5]"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#5B5FC7] text-[11px] font-bold text-white">
                      {getUserAvatar(user) ? (
                        <img
                          src={getFileUrl(getUserAvatar(user))}
                          alt=""
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        getInitials(getUserName(user))
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[#242424]">
                        {getUserName(user)}
                      </p>
                      <p className="truncate text-[10px] text-[#616161]">
                        {user.role || user.email}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Teams Chat List Scrollable Items */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {loadingUsers && conversations.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={22} className="animate-spin text-[#5B5FC7]" />
              </div>
            ) : sortedConversations.length === 0 ? (
              <div className="px-6 py-12 text-center text-[#616161]">
                <MessageSquare size={28} className="mx-auto mb-2 text-[#8A8886]" />
                <p className="text-xs font-semibold">No chats found</p>
                <p className="mt-1 text-[11px] text-[#8A8886]">
                  Click the pencil icon above to start a chat.
                </p>
              </div>
            ) : (
              <div className="py-1">
                {/* ── PINNED SECTION ── */}
                {pinnedConversations.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#616161]">
                      <span>Pinned</span>
                    </div>
                    {pinnedConversations.map((conv) => {
                      const id = getConversationId(conv);
                      const isGroup = Boolean(conv.isGroup);
                      const other =
                        conv.participants?.find((p) => getId(p)) || {};
                      const name = isGroup
                        ? conv.groupName || "Group chat"
                        : getUserName(other);
                      const avatar = isGroup
                        ? conv.avatar
                        : getUserAvatar(other);
                      const isSelected = sameId(selectedConversationId, id);
                      const unread = getUnreadCount(conv);
                      const isOnline = Boolean(
                        onlineUsers[String(getId(other))] ??
                          other?.isOnline ??
                          other?.online
                      );
                      const presence = other?.status || (isOnline ? "available" : "offline");

                      return (
                        <div
                          key={id}
                          onClick={() => openConversation(conv, isGroup ? null : other)}
                          className={`group relative flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors ${
                            isSelected
                              ? "bg-white text-[#242424] shadow-xs"
                              : "hover:bg-[#EDEBE9]"
                          }`}
                        >
                          {/* Active Left indicator bar */}
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
                              ) : isGroup ? (
                                <Users size={16} />
                              ) : (
                                getInitials(name)
                              )}
                            </div>
                            {!isGroup && (
                              <TeamsPresenceBadge
                                status={presence}
                                className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5"
                              />
                            )}
                          </div>

                          {/* Chat details */}
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
                                {formatConversationTime(
                                  getConversationLastDate(conv)
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
                                {getConversationLastMessage(conv) || "Start a chat"}
                              </p>
                              {unread > 0 && (
                                <span className="flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full bg-[#5B5FC7] px-1 text-[10px] font-bold text-white">
                                  {unread}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Teams Hover Actions (Pin / More) */}
                          <div className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 group-hover:flex">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePin(id);
                              }}
                              className="rounded p-1 text-[#616161] hover:bg-white hover:text-[#5B5FC7]"
                              title="Unpin"
                            >
                              <Pin size={13} className="fill-[#5B5FC7] text-[#5B5FC7]" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── RECENT SECTION ── */}
                <div>
                  <div className="flex items-center justify-between px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#616161]">
                    <span>Recent</span>
                  </div>
                  {recentConversations.map((conv) => {
                    const id = getConversationId(conv);
                    const isGroup = Boolean(conv.isGroup);
                    const other =
                      conv.participants?.find((p) => getId(p)) || {};
                    const name = isGroup
                      ? conv.groupName || "Group chat"
                      : getUserName(other);
                    const avatar = isGroup
                      ? conv.avatar
                      : getUserAvatar(other);
                    const isSelected = sameId(selectedConversationId, id);
                    const unread = getUnreadCount(conv);
                    const isOnline = Boolean(
                      onlineUsers[String(getId(other))] ??
                        other?.isOnline ??
                        other?.online
                    );
                    const presence = other?.status || (isOnline ? "available" : "offline");
                    const isMuted = mutedChats.includes(String(id));

                    return (
                      <div
                        key={id}
                        onClick={() => openConversation(conv, isGroup ? null : other)}
                        className={`group relative flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors ${
                          isSelected
                            ? "bg-white text-[#242424] shadow-xs"
                            : "hover:bg-[#EDEBE9]"
                        }`}
                      >
                        {isSelected && (
                          <span className="absolute left-0 top-0 h-full w-[3px] bg-[#5B5FC7]" />
                        )}

                        <div className="relative h-9 w-9 shrink-0">
                          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#5B5FC7] text-xs font-bold text-white shadow-xs">
                            {avatar ? (
                              <img
                                src={getFileUrl(avatar)}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : isGroup ? (
                              <Users size={16} />
                            ) : (
                              getInitials(name)
                            )}
                          </div>
                          {!isGroup && (
                            <TeamsPresenceBadge
                              status={presence}
                              className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5"
                            />
                          )}
                        </div>

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
                              {formatConversationTime(
                                getConversationLastDate(conv)
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
                              {getConversationLastMessage(conv) || "Start a chat"}
                            </p>
                            <div className="flex shrink-0 items-center gap-1">
                              {isMuted && (
                                <BellOff size={11} className="text-[#8A8886]" />
                              )}
                              {unread > 0 && (
                                <span className="flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full bg-[#5B5FC7] px-1 text-[10px] font-bold text-white">
                                  {unread}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Hover Action Menu */}
                        <div className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 group-hover:flex">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePin(id);
                            }}
                            className="rounded p-1 text-[#616161] hover:bg-white hover:text-[#5B5FC7]"
                            title="Pin chat"
                          >
                            <Pin size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ==========================================================
            TEAMS RIGHT CONVERSATION PANE
        ========================================================== */}
        <main
          className={`flex h-full min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden bg-white ${
            selectedConversationId ? "flex" : "hidden md:flex"
          }`}
        >
          {selectedConversationId ? (
            <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
              {/* ── TEAMS CONVERSATION HEADER ── */}
              <header className="z-10 flex min-h-[58px] shrink-0 items-center justify-between border-b border-[#E1DFDD] bg-white px-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => {
                      setSelectedConversationId(null);
                      selectedConversationIdRef.current = null;
                    }}
                    className="mr-1 rounded p-1.5 text-[#616161] hover:bg-[#EDEBE9] md:hidden"
                    title="Back to chat list"
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
                    ) : isSelectedGroup ? (
                      <Users size={17} />
                    ) : (
                      getInitials(selectedName)
                    )}
                    {!isSelectedGroup && (
                      <TeamsPresenceBadge
                        status={selectedStatus}
                        className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5"
                      />
                    )}
                  </div>

                  {/* Header Info & Teams Tabs */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-sm font-bold text-[#242424]">
                        {selectedName || "Conversation"}
                      </h2>
                      {!isSelectedGroup && (
                        <span className="text-[11px] text-[#616161]">
                          {selectedStatus === "available"
                            ? "Available"
                            : selectedStatus === "busy"
                            ? "Busy"
                            : selectedStatus === "away"
                            ? "Away"
                            : "Offline"}
                        </span>
                      )}
                    </div>

                    {/* Microsoft Teams Tabs: Chat | Files | Photos | Profile */}
                    <div className="mt-1 flex items-center gap-4">
                      {[
                        { id: "chat", label: "Chat" },
                        { id: "files", label: "Files" },
                        { id: "photos", label: "Photos" },
                        ...(!isSelectedGroup
                          ? [{ id: "profile", label: "Profile" }]
                          : []),
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

                {/* Right Call & Options Bar */}
                <div
                  className="relative flex shrink-0 items-center gap-1 text-[#616161]"
                  ref={menuRef}
                >
                  {/* In-chat search box */}
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
                    onClick={() =>
                      alert("Starting video call (Teams Audio/Video)...")
                    }
                    className="flex h-8 w-8 items-center justify-center rounded text-[#616161] transition hover:bg-[#EDEBE9] hover:text-[#242424]"
                    title="Video call"
                  >
                    <Video size={17} />
                  </button>
                  <button
                    onClick={() =>
                      alert("Starting audio call (Teams Audio/Video)...")
                    }
                    className="flex h-8 w-8 items-center justify-center rounded text-[#616161] transition hover:bg-[#EDEBE9] hover:text-[#242424]"
                    title="Audio call"
                  >
                    <Phone size={16} />
                  </button>
                  <button
                    onClick={() => setShowMessageSearch((prev) => !prev)}
                    className="flex h-8 w-8 items-center justify-center rounded text-[#616161] transition hover:bg-[#EDEBE9] hover:text-[#242424]"
                    title="Search in chat"
                  >
                    <Search size={16} />
                  </button>
                  <button
                    onClick={() => setChatMenuOpen((prev) => !prev)}
                    className="flex h-8 w-8 items-center justify-center rounded text-[#616161] transition hover:bg-[#EDEBE9] hover:text-[#242424]"
                    title="More chat options"
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  {/* Teams Chat Dropdown Menu */}
                  {chatMenuOpen && (
                    <div className="absolute right-0 top-10 z-40 w-56 rounded-md border border-[#E1DFDD] bg-white py-1.5 shadow-lg">
                      <button
                        onClick={handleMarkUnread}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-[#242424] hover:bg-[#F5F5F5]"
                      >
                        <CheckCheck size={14} className="text-[#5B5FC7]" />
                        Mark as unread
                      </button>
                      <button
                        onClick={() => togglePin()}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-[#242424] hover:bg-[#F5F5F5]"
                      >
                        <Pin size={14} className="text-[#5B5FC7]" />
                        {pinnedChats.includes(selectedKey)
                          ? "Unpin chat"
                          : "Pin chat"}
                      </button>
                      <button
                        onClick={() => toggleMute()}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-[#242424] hover:bg-[#F5F5F5]"
                      >
                        {mutedChats.includes(selectedKey) ? (
                          <Bell size={14} />
                        ) : (
                          <BellOff size={14} />
                        )}
                        {mutedChats.includes(selectedKey)
                          ? "Unmute notifications"
                          : "Mute notifications"}
                      </button>
                      <div className="my-1 border-t border-[#E1DFDD]" />
                      <button
                        onClick={handleDeleteConversation}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold text-[#C4314B] hover:bg-[#FDF3F4]"
                      >
                        <Trash2 size={14} />
                        Delete chat
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

              {/* ── TEAMS TAB 1: CHAT ── */}
              {headerTab === "chat" && (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
                  {/* Messages Canvas */}
                  <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-white px-4 py-5 sm:px-6">
                    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                      {visibleMessages.length === 0 ? (
                        <div className="flex min-h-[300px] flex-1 flex-col items-center justify-center text-center">
                          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF1FD] text-[#5B5FC7]">
                            <MessageSquare size={26} />
                          </div>
                          <h3 className="text-sm font-bold text-[#242424]">
                            Welcome to the chat!
                          </h3>
                          <p className="mt-1 max-w-xs text-xs text-[#616161]">
                            Send a message, attach files, or share photos to collaborate with your team in Microsoft Teams.
                          </p>
                        </div>
                      ) : (
                        visibleMessages.map((item, index) => {
                          const sender = item?.sender;
                          const isDeleted = Boolean(item?.isDeletedForEveryone);
                          const body = isDeleted
                            ? "This message was deleted."
                            : getMessageBody(item);
                          const senderId = getSenderId(item);
                          const isOwn =
                            String(sender?.role || "").toLowerCase() ===
                              "admin" ||
                            sender?.name === "You" ||
                            sender?.isCurrentUser === true ||
                            item?.isOwn === true;
                          const messageId = getMessageId(item);
                          const isEditing = sameId(editingMessageId, messageId);
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
                            <div key={messageId || index} className="group relative">
                              {/* Date Separator Pill */}
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
                                {/* Sender Avatar */}
                                <div className="mt-0.5 h-8 w-8 shrink-0">
                                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#5B5FC7] text-[11px] font-bold text-white shadow-2xs">
                                    {isOwn ? (
                                      "You"
                                    ) : getUserAvatar(sender) ? (
                                      <img
                                        src={getFileUrl(getUserAvatar(sender))}
                                        alt=""
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      getInitials(getUserName(sender))
                                    )}
                                  </div>
                                </div>

                                {/* Message Content Container */}
                                <div
                                  className={`relative max-w-[85%] sm:max-w-[75%] ${
                                    isOwn ? "items-end" : "items-start"
                                  } flex flex-col`}
                                >
                                  {/* Header Info: Name + Timestamp */}
                                  <div className="mb-1 flex items-center gap-2 px-1 text-[11px] text-[#616161]">
                                    <span className="font-semibold text-[#242424]">
                                      {isOwn ? "You" : getUserName(sender)}
                                    </span>
                                    <span>
                                      {formatMessageTime(item?.createdAt)}
                                    </span>
                                    {item?.editedAt && (
                                      <span className="italic">(edited)</span>
                                    )}
                                  </div>

                                  {/* Message Bubble */}
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
                                          {getUserName(replyInfo.sender) || "User"}
                                        </p>
                                        <p className="line-clamp-2 text-[#616161]">
                                          {getMessageBody(replyInfo) || "Attachment"}
                                        </p>
                                      </div>
                                    )}

                                    {/* Inline Edit Form */}
                                    {isEditing ? (
                                      <div className="flex min-w-[240px] flex-col gap-2">
                                        <textarea
                                          value={editDraft}
                                          onChange={(e) =>
                                            setEditDraft(e.target.value)
                                          }
                                          rows={2}
                                          className="w-full rounded border border-[#E1DFDD] bg-white p-2 text-xs text-[#242424] outline-none focus:border-[#5B5FC7]"
                                        />
                                        <div className="flex justify-end gap-1.5">
                                          <button
                                            onClick={() => {
                                              setEditingMessageId(null);
                                              setEditDraft("");
                                            }}
                                            className="rounded px-2.5 py-1 text-[11px] font-semibold text-[#616161] hover:bg-[#EDEBE9]"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            disabled={
                                              messageActionBusy ||
                                              !editDraft.trim()
                                            }
                                            onClick={() =>
                                              handleSaveEditedMessage(item)
                                            }
                                            className="rounded bg-[#5B5FC7] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#4F52B2] disabled:opacity-50"
                                          >
                                            {messageActionBusy
                                              ? "Saving..."
                                              : "Save"}
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        {/* Text content */}
                                        {body && (
                                          <p className="whitespace-pre-wrap break-words leading-relaxed">
                                            {body}
                                          </p>
                                        )}

                                        {/* Attachments preview inside bubble */}
                                        {attachments.length > 0 && !isDeleted && (
                                          <div
                                            className={`flex flex-col gap-2 ${
                                              body ? "mt-2.5" : ""
                                            }`}
                                          >
                                            {attachments.map((att, attIdx) => {
                                              const fileUrl = getFileUrl(
                                                att?.url
                                              );
                                              const mime = String(
                                                att?.mimeType ||
                                                  att?.fileType ||
                                                  ""
                                              );
                                              const isImage =
                                                mime.startsWith("image/") ||
                                                /\.(jpg|jpeg|png|webp|gif)$/i.test(
                                                  att?.url || ""
                                                );

                                              if (isImage) {
                                                return (
                                                  <div
                                                    key={`${att.url}-${attIdx}`}
                                                    onClick={() =>
                                                      setPreviewPhotoUrl(
                                                        fileUrl
                                                      )
                                                    }
                                                    className="group/img relative cursor-pointer overflow-hidden rounded-lg border border-[#E1DFDD]"
                                                  >
                                                    <img
                                                      src={fileUrl}
                                                      alt={
                                                        att?.originalName ||
                                                        "Image"
                                                      }
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
                                                        "File attachment"}
                                                    </p>
                                                    <p className="text-[10px] text-[#616161]">
                                                      {att.size
                                                        ? `${Math.ceil(
                                                            att.size / 1024
                                                          )} KB`
                                                        : "Document"}
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
                                      </>
                                    )}

                                    {/* Delivery & Read Receipts for Own Messages */}
                                    {isOwn && !isDeleted && (
                                      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#616161]">
                                        {item?.status === "sending" ? (
                                          <Loader2
                                            size={11}
                                            className="animate-spin text-[#5B5FC7]"
                                          />
                                        ) : item?.status === "failed" ? (
                                          <span className="font-semibold text-[#C4314B]">
                                            Failed
                                          </span>
                                        ) : item?.seen ||
                                          item?.isRead ||
                                          item?.status === "seen" ? (
                                          <Eye
                                            size={12}
                                            className="text-[#5B5FC7]"
                                            title="Seen"
                                          />
                                        ) : (
                                          <CheckCheck
                                            size={12}
                                            className="text-[#616161]"
                                            title="Delivered"
                                          />
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Emoji Reactions Bar below bubble */}
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
                                              handleReactToMessage(item, emoji)
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

                                {/* Teams Floating Reaction & Action Bar on Hover */}
                                {!isDeleted && !isEditing && (
                                  <div
                                    className={`absolute top-0 z-20 hidden -translate-y-4 items-center rounded-full border border-[#E1DFDD] bg-white px-1.5 py-1 shadow-md group-hover:flex ${
                                      isOwn ? "left-12" : "right-12"
                                    }`}
                                  >
                                    {["👍", "❤️", "😂", "😮", "😢", "👏"].map(
                                      (emoji) => (
                                        <button
                                          key={emoji}
                                          onClick={() =>
                                            handleReactToMessage(item, emoji)
                                          }
                                          className="rounded-full p-1 text-sm transition hover:scale-125 hover:bg-[#F5F5F5]"
                                          title={`React with ${emoji}`}
                                        >
                                          {emoji}
                                        </button>
                                      )
                                    )}
                                    <div className="mx-1 h-3.5 w-px bg-[#E1DFDD]" />
                                    {/* Reply Button */}
                                    <button
                                      onClick={() => {
                                        setReplyingTo(item);
                                        messageInputRef.current?.focus();
                                      }}
                                      className="rounded p-1 text-[#616161] hover:bg-[#F5F5F5] hover:text-[#5B5FC7]"
                                      title="Reply"
                                    >
                                      <CornerUpLeft size={13} />
                                    </button>
                                    {/* Edit Button (Own message) */}
                                    {isOwn && (
                                      <button
                                        onClick={() => {
                                          setEditingMessageId(messageId);
                                          setEditDraft(getMessageBody(item));
                                        }}
                                        className="rounded p-1 text-[#616161] hover:bg-[#F5F5F5] hover:text-[#5B5FC7]"
                                        title="Edit message"
                                      >
                                        <Pencil size={13} />
                                      </button>
                                    )}
                                    {/* Delete Button */}
                                    <button
                                      onClick={() =>
                                        handleDeleteMessage(
                                          item,
                                          isOwn ? "everyone" : "me"
                                        )
                                      }
                                      className="rounded p-1 text-[#616161] hover:bg-[#FDF3F4] hover:text-[#C4314B]"
                                      title="Delete"
                                    >
                                      <Trash2 size={13} />
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

                  {/* ── TEAMS MESSAGE COMPOSER: ALWAYS VISIBLE AT BOTTOM ── */}
                  <div className="relative z-20 mt-auto w-full shrink-0 border-t border-[#E1DFDD] bg-white px-4 pb-3 pt-3 sm:px-6">
                    <div className="mx-auto max-w-4xl">
                      {/* Replying Banner */}
                      {replyingTo && (
                        <div className="mb-2 flex items-center justify-between rounded-t border-l-2 border-[#5B5FC7] bg-[#EEF1FD] px-3 py-1.5 text-xs">
                          <div className="min-w-0">
                            <span className="font-semibold text-[#5B5FC7]">
                              Replying to {getUserName(replyingTo.sender)}
                            </span>
                            <p className="truncate text-[11px] text-[#616161]">
                              {getMessageBody(replyingTo) || "Attachment"}
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

                      {/* Selected Files Preview Chips */}
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

                      {/* Real-time Typing Indicator Banner */}
                      {typingUsers[String(selectedConversationId)] && (
                        <div className="mb-1.5 flex items-center gap-1.5 px-2 text-xs font-medium italic text-[#5B5FC7]">
                          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#5B5FC7]" />
                          <span>
                            {typingUsers[String(selectedConversationId)]} is typing...
                          </span>
                        </div>
                      )}

                      {/* Teams Single-Line Message Input Box */}
                      <form
                        onSubmit={(e) => {
                          const convId = selectedConversationIdRef.current;
                          if (convId && socketRef.current?.connected) {
                            socketRef.current.emit("typing:stop", { conversationId: convId });
                          }
                          if (emitTypingTimerRef.current) {
                            clearTimeout(emitTypingTimerRef.current);
                            emitTypingTimerRef.current = null;
                          }
                          handleSendMessage(e);
                        }}
                        className="flex min-h-[54px] w-full items-center rounded-lg border border-[#C8C6C4] bg-white shadow-sm transition focus-within:border-[#5B5FC7] focus-within:ring-2 focus-within:ring-[#5B5FC7]/20"
                      >
                        {/* Optional Rich Text Format Bar */}
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

                        {/* Single-line layout container for input and all inline actions */}
                        <div className="flex min-h-[52px] w-full items-end gap-2 px-3 py-1.5">
                          <textarea
                            ref={messageInputRef}
                            value={message}
                            onChange={(e) => {
                              setMessage(e.target.value);
                              // Keep the composer compact like Teams, and only
                              // grow it when the user types multiple lines.
                              const input = e.currentTarget;
                              input.style.height = "40px";
                              const nextHeight = Math.min(input.scrollHeight, 96);
                              input.style.height = `${nextHeight}px`;
                              input.style.overflowY =
                                input.scrollHeight > 96 ? "auto" : "hidden";

                              // Real-time typing emit
                              const convId = selectedConversationIdRef.current;
                              if (convId && socketRef.current?.connected) {
                                socketRef.current.emit("typing:start", {
                                  conversationId: convId,
                                  userName: "Admin",
                                });
                                if (emitTypingTimerRef.current) {
                                  clearTimeout(emitTypingTimerRef.current);
                                }
                                emitTypingTimerRef.current = setTimeout(() => {
                                  socketRef.current?.emit("typing:stop", {
                                    conversationId: convId,
                                  });
                                  emitTypingTimerRef.current = null;
                                }, 2500);
                              }
                            }}
                            onBlur={() => {
                              const convId = selectedConversationIdRef.current;
                              if (convId && socketRef.current?.connected) {
                                socketRef.current.emit("typing:stop", {
                                  conversationId: convId,
                                });
                              }
                              if (emitTypingTimerRef.current) {
                                clearTimeout(emitTypingTimerRef.current);
                                emitTypingTimerRef.current = null;
                              }
                            }}
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                !e.shiftKey &&
                                !e.nativeEvent.isComposing
                              ) {
                                e.preventDefault();
                                const convId = selectedConversationIdRef.current;
                                if (convId && socketRef.current?.connected) {
                                  socketRef.current.emit("typing:stop", {
                                    conversationId: convId,
                                  });
                                }
                                if (emitTypingTimerRef.current) {
                                  clearTimeout(emitTypingTimerRef.current);
                                  emitTypingTimerRef.current = null;
                                }
                                handleSendMessage(e);
                              }
                            }}
                            placeholder="Type a message"
                            aria-label="Type a message"
                            rows={1}
                            className="block min-h-[40px] max-h-[96px] min-w-0 flex-1 resize-none overflow-y-hidden bg-transparent px-1 py-2 text-sm leading-5 text-[#242424] outline-none placeholder:text-[#616161]"
                          />

                          {/* Teams Toolbar Actions aligned in the same single line */}
                          <div className="flex shrink-0 items-center gap-0.5 self-end pb-1 text-[#616161]">
                            {/* Format toggle */}
                            <button
                              type="button"
                              onClick={() => setFormatActive((prev) => !prev)}
                              className={`rounded p-1.5 transition ${
                                formatActive
                                  ? "bg-[#EDEBE9] text-[#5B5FC7]"
                                  : "hover:bg-[#EDEBE9] hover:text-[#242424]"
                              }`}
                              title="Formatting options"
                            >
                              <Pencil size={15} />
                            </button>

                            {/* Attach File */}
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="rounded p-1.5 transition hover:bg-[#EDEBE9] hover:text-[#242424]"
                              title="Attach file"
                            >
                              <Paperclip size={15} />
                            </button>

                            {/* Add Photo */}
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
                                <div className="absolute bottom-9 right-0 z-40 grid grid-cols-6 gap-1 rounded-md border border-[#E1DFDD] bg-white p-2 shadow-lg">
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
                                const incoming = Array.from(e.target.files || []);
                                setSelectedFiles((prev) => [
                                  ...prev,
                                  ...incoming,
                                ]);
                                e.target.value = "";
                              }}
                              className="hidden"
                            />

                            {/* Send Button */}
                            <button
                              type="submit"
                              disabled={
                                (!message.trim() && selectedFiles.length === 0) ||
                                sendingMessage
                              }
                              className="ml-1 flex h-7 w-7 items-center justify-center rounded text-[#5B5FC7] transition hover:bg-[#EEF1FD] disabled:cursor-not-allowed disabled:text-[#8A8886]"
                              title="Send message (Enter)"
                            >
                              {sendingMessage ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Send size={16} />
                              )}
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TEAMS TAB 2: FILES ── */}
              {headerTab === "files" && (
                <div className="flex-1 overflow-y-auto bg-white p-6">
                  <div className="mx-auto max-w-4xl">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#242424]">
                        Shared Files
                      </h3>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 rounded bg-[#5B5FC7] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4F52B2]"
                      >
                        <Plus size={14} /> Upload file
                      </button>
                    </div>
                    {fileAttachments.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[#E1DFDD] p-12 text-center text-xs text-[#616161]">
                        No files shared in this chat yet.
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-lg border border-[#E1DFDD]">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-[#E1DFDD] bg-[#F5F5F5] font-semibold text-[#616161]">
                            <tr>
                              <th className="px-4 py-2.5">Name</th>
                              <th className="px-4 py-2.5">Modified</th>
                              <th className="px-4 py-2.5">Shared By</th>
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
                                  <span className="truncate max-w-[200px]">
                                    {att.originalName || att.filename || "File"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-[#616161]">
                                  {formatConversationTime(
                                    att.message?.createdAt
                                  )}
                                </td>
                                <td className="px-4 py-3 text-[#616161]">
                                  {getUserName(att.message?.sender)}
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

              {/* ── TEAMS TAB 3: PHOTOS ── */}
              {headerTab === "photos" && (
                <div className="flex-1 overflow-y-auto bg-white p-6">
                  <div className="mx-auto max-w-4xl">
                    <h3 className="mb-4 text-sm font-bold text-[#242424]">
                      Shared Photos
                    </h3>
                    {photoAttachments.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[#E1DFDD] p-12 text-center text-xs text-[#616161]">
                        No photos shared in this chat yet.
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
                              alt={att.originalName || "Photo"}
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

              {/* ── TEAMS TAB 4: PROFILE CARD ── */}
              {headerTab === "profile" && selectedUser && (
                <div className="flex-1 overflow-y-auto bg-white p-8">
                  <div className="mx-auto max-w-md rounded-xl border border-[#E1DFDD] bg-white p-6 shadow-xs">
                    <div className="flex flex-col items-center text-center">
                      <div className="relative mb-3 h-20 w-20">
                        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#5B5FC7] text-2xl font-bold text-white shadow-sm">
                          {selectedAvatar ? (
                            <img
                              src={getFileUrl(selectedAvatar)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            getInitials(selectedName)
                          )}
                        </div>
                        <TeamsPresenceBadge
                          status={selectedStatus}
                          className="absolute bottom-0 right-0 h-5 w-5"
                        />
                      </div>
                      <h3 className="text-base font-bold text-[#242424]">
                        {selectedName}
                      </h3>
                      <p className="text-xs text-[#616161]">
                        {selectedUser.title || selectedUser.role || "Member"}
                      </p>
                      <p className="mt-0.5 text-xs text-[#5B5FC7]">
                        {selectedUser.department || "LocalPro 1 Team"}
                      </p>

                      <div className="mt-5 flex w-full justify-center gap-3">
                        <button
                          onClick={() => setHeaderTab("chat")}
                          className="flex items-center gap-1.5 rounded bg-[#5B5FC7] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#4F52B2]"
                        >
                          <MessageSquare size={13} /> Message
                        </button>
                        <button
                          onClick={() =>
                            alert(`Calling ${selectedName}...`)
                          }
                          className="flex items-center gap-1.5 rounded border border-[#E1DFDD] bg-white px-4 py-1.5 text-xs font-semibold text-[#242424] hover:bg-[#F5F5F5]"
                        >
                          <Phone size={13} /> Call
                        </button>
                      </div>

                      <div className="mt-6 w-full space-y-3 border-t border-[#E1DFDD] pt-4 text-left text-xs">
                        <div>
                          <span className="block text-[11px] font-semibold text-[#616161]">
                            Email
                          </span>
                          <span className="text-[#242424]">
                            {selectedUser.email || "Not specified"}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] font-semibold text-[#616161]">
                            Phone
                          </span>
                          <span className="text-[#242424]">
                            {selectedUser.phone || "+1 (555) 019-2834"}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] font-semibold text-[#616161]">
                            Status
                          </span>
                          <span className="capitalize text-[#242424]">
                            {selectedStatus}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Empty State when no conversation is selected */
            <div className="hidden flex-1 flex-col items-center justify-center bg-white px-6 text-center md:flex">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#EEF1FD] text-[#5B5FC7]">
                <MessageSquare size={36} strokeWidth={1.7} />
              </div>
              <h2 className="text-base font-bold text-[#242424]">
                Select a chat to view messages
              </h2>
              <p className="mt-1 max-w-sm text-xs text-[#616161]">
                Pick an existing conversation from the list on the left or create a new chat to connect with your team.
              </p>
              <button
                onClick={() => setShowNewChatDrawer(true)}
                className="mt-4 flex items-center gap-2 rounded bg-[#5B5FC7] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#4F52B2]"
              >
                <Pencil size={14} /> New chat
              </button>
            </div>
          )}
        </main>
      </section>

      {/* ==========================================================
          TEAMS NEW GROUP MODAL
      ========================================================== */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleCreateGroup}
            className="w-full max-w-md overflow-hidden rounded-lg border border-[#E1DFDD] bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[#E1DFDD] px-5 py-3.5">
              <h3 className="text-sm font-bold text-[#242424]">
                New group chat
              </h3>
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="text-[#616161] hover:text-[#242424]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#242424]">
                  Group name
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Field Operations, Dispatch"
                  required
                  maxLength={60}
                  className="h-8 w-full rounded border border-[#E1DFDD] px-3 text-xs outline-none focus:border-[#5B5FC7]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#242424]">
                  Add members ({selectedGroupMembers.length} selected)
                </label>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded border border-[#E1DFDD] p-2">
                  {users.map((user) => {
                    const userId = getId(user);
                    if (!userId) return null;
                    const isChecked = selectedGroupMembers.some((id) =>
                      sameId(id, userId)
                    );
                    return (
                      <label
                        key={userId}
                        className="flex cursor-pointer items-center gap-2.5 rounded p-1.5 hover:bg-[#F5F5F5]"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            setSelectedGroupMembers((prev) =>
                              e.target.checked
                                ? [...prev.filter((id) => !sameId(id, userId)), userId]
                                : prev.filter((id) => !sameId(id, userId))
                            )
                          }
                          className="h-3.5 w-3.5 rounded border-[#E1DFDD] text-[#5B5FC7] focus:ring-[#5B5FC7]"
                        />
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#5B5FC7] text-[10px] font-bold text-white">
                          {getUserAvatar(user) ? (
                            <img
                              src={getFileUrl(getUserAvatar(user))}
                              alt=""
                              className="h-full w-full rounded-full object-cover"
                            />
                          ) : (
                            getInitials(getUserName(user))
                          )}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-xs text-[#242424]">
                          {getUserName(user)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#E1DFDD] bg-[#F5F5F5] px-5 py-3">
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="rounded border border-[#E1DFDD] bg-white px-3 py-1.5 text-xs font-semibold text-[#242424] hover:bg-[#EDEBE9]"
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
                className="flex items-center gap-1.5 rounded bg-[#5B5FC7] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#4F52B2] disabled:opacity-50"
              >
                {creatingGroup && (
                  <Loader2 size={13} className="animate-spin" />
                )}
                {creatingGroup ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================================
          PHOTO LIGHTBOX PREVIEW MODAL
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