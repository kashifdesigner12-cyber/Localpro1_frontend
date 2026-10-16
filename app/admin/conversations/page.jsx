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
  Users,
  Wifi,
  WifiOff,
  Bell,
  BellOff,
  Pencil,
  Archive,
  CheckCheck,
  Video,
  Phone,
  MoreHorizontal,
  ExternalLink,
  Calendar,
  Share2,
  Bookmark,
  AlertTriangle,
  Eye,
  Smile,
  ImageIcon,
  GripVertical,
  Plus,
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
  if (/^(https?:\/\/|blob:|data:)/i.test(value)) return value;
  return `${BACKEND_BASE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
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
    if (typeof parsed === "string") return parsed.replace(/^Bearer\s+/i, "").trim() || null;
    if (parsed && typeof parsed === "object") {
      const token = parsed.token || parsed.accessToken || parsed.access_token || parsed.jwt;
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
      const token = normalizeTokenValue(localStorage.getItem(key));
      if (token) return token;
    } catch {}
    try {
      const token = normalizeTokenValue(sessionStorage.getItem(key));
      if (token) return token;
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

/* ============================================================
    RESPONSE HELPERS
============================================================ */

const parseResponse = async (response) => {
  try {
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return { success: false, message: text }; }
  } catch { return null; }
};

const getId = (item) => {
  if (!item) return null;
  if (typeof item === "string" || typeof item === "number") return item;
  return item._id || item.id || item.userId?._id || item.userId?.id || null;
};

const getUserName = (user) => user?.name || user?.fullName || user?.username || user?.email || "Unknown User";
const getUserAvatar = (user) => user?.avatar || user?.profileImage || user?.image || user?.profilePic || "";

const getInitials = (name) => String(name || "U").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "U";

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
  if (Array.isArray(data?.conversation?.messages)) return data.conversation.messages;
  return [];
};

const getMessageId = (message) => message?._id || message?.id || null;
const getConversationId = (conversation) => conversation?._id || conversation?.id || null;

const getConversationIdFromMessage = (message) => {
  const value = message?.conversationId || message?.conversation?._id || message?.conversation?.id || message?.conversation || message?.chatId;
  if (value && typeof value === "object") return value._id || value.id || null;
  return value || null;
};

const getUnreadCount = (conversation) => {
  const values = [conversation?.unreadCount, conversation?.unreadMessages, conversation?.unread, conversation?.unreadMessageCount];
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
};

const getConversationLastMessage = (conversation) => {
  const last = conversation?.lastMessage;
  if (typeof last === "string") return last;
  return last?.body || last?.message || conversation?.lastMessageText || conversation?.latestMessage?.body || "";
};

const getConversationLastDate = (conversation) =>
  conversation?.lastMessageAt || conversation?.lastMessage?.createdAt || conversation?.latestMessage?.createdAt || conversation?.updatedAt || conversation?.createdAt || null;

const getSenderId = (message) => getId(message?.sender) || getId(message?.senderId) || null;
const getMessageBody = (message) => message?.body || message?.message || message?.content || "";

const unwrapSocketMessage = (payload) => {
  if (!payload) return null;
  const candidates = [payload.messageData, payload.data?.messageData, payload.data?.message, payload.message, payload.data, payload];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    if (getMessageId(candidate) || getConversationIdFromMessage(candidate)) return candidate;
  }
  return null;
};

const revokeTemporaryAttachmentUrls = (message) => {
  (Array.isArray(message?.attachments) ? message.attachments : []).forEach((att) => {
    if (att?.isLocalPreview && typeof att.url === "string" && att.url.startsWith("blob:")) {
      URL.revokeObjectURL(att.url);
    }
  });
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
  };
};

/* ============================================================
    NOTIFICATIONS & SOUND
============================================================ */

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
    gain.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.21);
  } catch {}
};

const showDesktopNotification = (title, body) => {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body: body || "New message received", icon: "/favicon.ico" });
  } catch {}
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

  // Drag and Drop state
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Teams Style Header Tabs
  const [headerTab, setHeaderTab] = useState("chat");

  // 3-Dots Menu State
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const selectedConversationIdRef = useRef(null);
  const conversationsRef = useRef([]);
  const usersRef = useRef([]);
  const messagesCache = useRef({});
  const processedSocketMessages = useRef(new Set());
  const refreshTimerRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  useEffect(() => {
    setIsClient(true);
    mountedRef.current = true;
    try {
      const cachedUsers = localStorage.getItem("localpro_admin_users");
      const cachedConvs = localStorage.getItem("localpro_admin_convs");
      const cachedMsgs = localStorage.getItem("localpro_admin_msgs");

      if (cachedUsers) {
        const parsed = JSON.parse(cachedUsers);
        if (Array.isArray(parsed)) { setUsers(parsed); usersRef.current = parsed; }
      }
      if (cachedConvs) {
        const parsed = JSON.parse(cachedConvs);
        if (Array.isArray(parsed)) { setConversations(parsed); conversationsRef.current = parsed; setLoadingUsers(false); }
      }
      if (cachedMsgs) {
        const parsed = JSON.parse(cachedMsgs);
        if (parsed && typeof parsed === "object") messagesCache.current = parsed;
      }
    } catch {}

    return () => {
      mountedRef.current = false;
      Object.values(messagesCache.current).forEach((list) => {
        if (!Array.isArray(list)) return;
        list.forEach((item) => revokeTemporaryAttachmentUrls(item));
      });
    };
  }, []);

  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => { selectedConversationIdRef.current = selectedConversationId; }, [selectedConversationId]);

  const scrollToBottom = useCallback((instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? "auto" : "smooth" });
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom(false);
  }, [messages, scrollToBottom]);

  const fetchData = useCallback(async (force = false) => {
    try {
      const res = await fetch(getApiUrl("/users"), { method: "GET", credentials: "include", headers: getAuthHeaders(), cache: force ? "no-store" : "default" });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await parseResponse(res);
      if (res.ok) {
        const list = normalizeUsers(data);
        if (mountedRef.current) {
          setUsers(list);
          usersRef.current = list;
          saveCache(list, conversationsRef.current, messagesCache.current);
        }
      }
    } catch {}

    try {
      const res = await fetch(getApiUrl("/conversations"), { method: "GET", credentials: "include", headers: getAuthHeaders(), cache: "no-store" });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await parseResponse(res);
      if (res.ok) {
        const list = normalizeConversations(data);
        if (mountedRef.current) {
          setConversations(list);
          conversationsRef.current = list;
          saveCache(usersRef.current, list, messagesCache.current);
        }
      }
    } catch {}
    if (mountedRef.current) setLoadingUsers(false);
  }, [router, saveCache]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => fetchData(true), 350);
  }, [fetchData]);

  useEffect(() => {
    if (!isClient) return;
    fetchData(false);
    const interval = setInterval(() => fetchData(true), 15000);
    return () => { clearInterval(interval); if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, [isClient, fetchData]);

  const findConversationForUser = useCallback((userId, list = conversationsRef.current) => {
    if (!userId) return null;
    return list.find((c) => {
      if (c?.isGroup) return false;
      const participants = Array.isArray(c?.participants) ? c.participants : [];
      return participants.some((p) => String(getId(p) || "") === String(userId));
    }) || null;
  }, []);

  const fetchMessages = useCallback(async (conversationId, silent = false) => {
    if (!conversationId) return [];
    
    const cached = messagesCache.current[conversationId];
    if (cached && Array.isArray(cached) && cached.length > 0 && !silent) {
      setMessages(cached);
    }

    try {
      const res = await fetch(getApiUrl(`/conversations/${conversationId}/messages?limit=100`), { method: "GET", credentials: "include", headers: getAuthHeaders(), cache: "no-store" });
      const data = await parseResponse(res);
      if (!res.ok) throw new Error(data?.message || "Failed to load messages.");

      const fetched = extractMessages(data).map((item) => normalizeMessage(item, conversationId));
      if (String(selectedConversationIdRef.current || "") !== String(conversationId)) return fetched;

      setMessages((prev) => {
        const temps = prev.filter((item) => String(getMessageId(item) || "").startsWith("temp-"));
        const merged = [...fetched];
        temps.forEach((temp) => {
          const body = getMessageBody(temp);
          const sId = String(getSenderId(temp) || "");
          const exists = merged.some((m) => getMessageBody(m) === body && String(getSenderId(m) || "") === sId);
          if (!exists) merged.push(temp);
        });
        merged.sort((a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime());
        messagesCache.current[conversationId] = merged;
        saveCache(usersRef.current, conversationsRef.current, messagesCache.current);
        return merged;
      });
      return fetched;
    } catch (error) {
      if (!silent) setMessagesError(error?.message || "Unable to load messages.");
      return cached || [];
    }
  }, [saveCache]);

  const markConversationRead = useCallback(async (conversationId) => {
    if (!conversationId) return;
    try {
      await fetch(getApiUrl(`/conversations/${conversationId}/read`), { method: "PUT", credentials: "include", headers: getAuthHeaders() });
    } catch {}
    setConversations((prev) => {
      const updated = prev.map((c) => String(getConversationId(c)) === String(conversationId) ? { ...c, unreadCount: 0, unread: 0 } : c);
      conversationsRef.current = updated;
      saveCache(usersRef.current, updated, messagesCache.current);
      return updated;
    });
  }, [saveCache]);

  const openConversation = useCallback(async (conversation, user = null) => {
    const conversationId = getConversationId(conversation);
    if (!conversationId) return;

    selectedConversationIdRef.current = conversationId;
    setSelectedConversationId(conversationId);
    setSelectedConversation(conversation);
    setHeaderTab("chat");

    if (user) {
      setSelectedUser(user);
    } else if (conversation?.isGroup) {
      setSelectedUser({ name: conversation.groupName || "Team Group", role: "Group Chat", isGroup: true });
    } else {
      const participants = conversation?.participants || [];
      const other = participants.find((p) => String(getId(p) || "") !== String(conversation?.adminId || ""));
      if (other) setSelectedUser(other);
    }

    setMessagesError("");
    setSelectedFiles([]);
    setMessageSearch("");
    setShowMessageSearch(false);
    setEditingMessageId(null);
    setEditDraft("");

    const cached = messagesCache.current[conversationId];
    if (Array.isArray(cached)) {
      setMessages(cached);
    } else {
      setMessages([]);
    }

    await fetchMessages(conversationId, false);
    await markConversationRead(conversationId);
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
      const res = await fetch(getApiUrl("/conversations"), { method: "POST", credentials: "include", headers: getAuthHeaders(), body: JSON.stringify({ recipientId: userId }) });
      const data = await parseResponse(res);
      if (!res.ok) throw new Error(data?.message || "Failed to start conversation.");
      const newConv = data?.conversation || data?.data?.conversation || data?.data;
      const newId = getConversationId(newConv);
      if (!newId) throw new Error("No conversation ID returned.");

      setConversations((prev) => {
        const updated = [newConv, ...prev.filter((c) => String(getConversationId(c)) !== String(newId))];
        conversationsRef.current = updated;
        saveCache(usersRef.current, updated, messagesCache.current);
        return updated;
      });
      await openConversation(newConv, user);
    } catch (err) {
      setMessagesError(err?.message || "Failed to start conversation.");
    } finally {
      setStartingConversation(false);
    }
  }, [findConversationForUser, openConversation, saveCache]);

  const updateMessageInState = useCallback((updatedMessage) => {
    if (!updatedMessage) return;
    const cId = getConversationIdFromMessage(updatedMessage) || selectedConversationIdRef.current;
    const normalized = normalizeMessage(updatedMessage, cId);
    const mId = String(getMessageId(normalized) || "");
    if (!mId) return;

    setMessages((prev) => {
      const next = prev.map((item) => String(getMessageId(item) || "") === mId ? { ...item, ...normalized } : item);
      if (cId) messagesCache.current[String(cId)] = next;
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
      const res = await fetch(getApiUrl(`/messages/${id}`), { method: "PATCH", credentials: "include", headers: getAuthHeaders(), body: JSON.stringify({ body: clean }) });
      const data = await parseResponse(res);
      if (!res.ok || data?.success === false) throw new Error(data?.message || "Could not edit message.");
      const updated = data?.data?.message || data?.data || data?.messageData;
      if (updated && typeof updated === "object") updateMessageInState(updated);
      else await fetchMessages(selectedConversationIdRef.current, true);
      setEditingMessageId(null);
      setEditDraft("");
    } catch (err) {
      setMessagesError(err?.message || "Could not edit message.");
    } finally {
      setMessageActionBusy(false);
    }
  };

  const handleReactToMessage = async (item, emoji) => {
    const id = getMessageId(item);
    if (!id || String(id).startsWith("temp-") || messageActionBusy) return;
    try {
      const res = await fetch(getApiUrl(`/messages/${id}/reactions`), { method: "POST", credentials: "include", headers: getAuthHeaders(), body: JSON.stringify({ emoji }) });
      const data = await parseResponse(res);
      if (!res.ok || data?.success === false) throw new Error(data?.message || "Could not add reaction.");
      const updated = data?.data?.message || data?.data;
      if (updated && typeof updated === "object") updateMessageInState(updated);
      else if (Array.isArray(data?.reactions)) updateMessageInState({ ...item, reactions: data.reactions });
    } catch (err) {
      setMessagesError(err?.message || "Could not add reaction.");
    }
  };

  const handleDeleteMessage = async (item, scope = "everyone") => {
    const id = getMessageId(item);
    if (!id || String(id).startsWith("temp-") || messageActionBusy) return;
    if (!window.confirm(scope === "everyone" ? "Delete this message for everyone?" : "Remove this message from your view?")) return;

    try {
      setMessageActionBusy(true);
      const endpoint = scope === "everyone" ? `/messages/${id}/delete-for-everyone` : `/messages/${id}/delete-for-me`;
      const res = await fetch(getApiUrl(endpoint), { method: "POST", credentials: "include", headers: getAuthHeaders(), body: JSON.stringify({}) });
      const data = await parseResponse(res);
      if (!res.ok || data?.success === false) throw new Error(data?.message || "Could not delete message.");

      if (scope === "everyone") {
        const updated = data?.data?.message || data?.data;
        if (updated && typeof updated === "object") updateMessageInState(updated);
        else updateMessageInState({ ...item, isDeletedForEveryone: true, body: "This message was deleted", attachments: [] });
      } else {
        setMessages((prev) => {
          const next = prev.filter((m) => String(getMessageId(m) || "") !== String(id));
          if (selectedConversationIdRef.current) messagesCache.current[String(selectedConversationIdRef.current)] = next;
          saveCache(usersRef.current, conversationsRef.current, messagesCache.current);
          return next;
        });
      }
    } catch (err) {
      setMessagesError(err?.message || "Could not delete message.");
    } finally {
      setMessageActionBusy(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversationId || !window.confirm("Delete this conversation?")) return;
    try {
      const cId = selectedConversationId;
      const res = await fetch(getApiUrl(`/conversations/${cId}`), { method: "DELETE", credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to delete conversation.");

      setConversations((prev) => {
        const next = prev.filter((c) => String(getConversationId(c)) !== String(cId));
        conversationsRef.current = next;
        saveCache(usersRef.current, next, messagesCache.current);
        return next;
      });
      delete messagesCache.current[cId];
      setSelectedConversationId(null);
      setSelectedConversation(null);
      setSelectedUser(null);
      setMessages([]);
    } catch (err) {
      setMessagesError(err?.message || "Could not delete conversation.");
    }
  };

  /* ==========================================================
     SOCKET.IO REALTIME & NOTIFICATIONS
  ========================================================== */

  useEffect(() => {
    if (!isClient) return;
    const token = getStoredToken();
    const socket = io(BACKEND_BASE_URL, {
      auth: token ? { token } : {},
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      const activeId = selectedConversationIdRef.current;
      if (activeId) socket.emit("join_room", String(activeId));
    });

    socket.on("disconnect", () => setSocketConnected(false));

    const handleIncomingMessage = (payload) => {
      const raw = unwrapSocketMessage(payload);
      if (!raw) return;
      const cId = getConversationIdFromMessage(raw);
      if (!cId) return;

      const normalized = normalizeMessage(raw, cId);
      const mId = String(getMessageId(normalized) || "");
      if (mId && processedSocketMessages.current.has(mId)) return;
      if (mId) processedSocketMessages.current.add(mId);

      const activeId = String(selectedConversationIdRef.current || "");
      const isActive = activeId === String(cId);

      if (isActive) {
        setMessages((prev) => {
          const updated = [...prev, normalized];
          updated.sort((a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime());
          messagesCache.current[String(cId)] = updated;
          saveCache(usersRef.current, conversationsRef.current, messagesCache.current);
          return updated;
        });
      }

      setConversations((prev) => {
        const index = prev.findIndex((c) => String(getConversationId(c)) === String(cId));
        const previewText = getMessageBody(normalized) || (normalized.attachments?.length ? "📷 Photo" : "");
        const timeNow = normalized.createdAt || new Date().toISOString();

        if (index >= 0) {
          const updated = [...prev];
          const old = updated[index];
          const currentUnread = getUnreadCount(old);
          const unread = isActive ? 0 : currentUnread + 1;

          updated[index] = {
            ...old,
            lastMessage: previewText,
            updatedAt: timeNow,
            unreadCount: unread,
            unread,
          };

          const [moved] = updated.splice(index, 1);
          updated.unshift(moved);
          conversationsRef.current = updated;
          saveCache(usersRef.current, updated, messagesCache.current);
          return updated;
        } else {
          scheduleRefresh();
          return prev;
        }
      });

      if (!isActive) {
        playNotificationSound();
        showDesktopNotification("New Message", getMessageBody(normalized));
      }
    };

    socket.on("receive_message", handleIncomingMessage);
    socket.on("new_message", handleIncomingMessage);
    socket.on("message_notification", handleIncomingMessage);

    return () => socket.disconnect();
  }, [isClient, saveCache, scheduleRefresh]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedGroupMembers.length === 0) return;
    try {
      setCreatingGroup(true);
      const res = await fetch(getApiUrl("/conversations"), {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: JSON.stringify({ isGroup: true, groupName: groupName.trim(), participants: selectedGroupMembers }),
      });
      const data = await parseResponse(res);
      if (!res.ok) throw new Error(data?.message || "Failed to create group.");
      const group = data?.conversation || data?.data;

      setConversations((prev) => {
        const next = [group, ...prev];
        conversationsRef.current = next;
        saveCache(usersRef.current, next, messagesCache.current);
        return next;
      });
      setShowGroupModal(false);
      setGroupName("");
      setSelectedGroupMembers([]);
      await openConversation(group);
    } catch (err) {
      window.alert(err?.message || "Error creating group.");
    } finally {
      setCreatingGroup(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => `${u?.name || ""} ${u?.email || ""}`.toLowerCase().includes(q));
  }, [users, search]);

  const visibleMessages = useMemo(() => {
    const q = messageSearch.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => getMessageBody(m).toLowerCase().includes(q));
  }, [messages, messageSearch]);

  const photoMessages = useMemo(() => messages.filter((m) => (m.attachments || []).some((att) => String(att?.mimeType || "").startsWith("image/"))), [messages]);
  const fileMessages = useMemo(() => messages.filter((m) => (m.attachments || []).some((att) => !String(att?.mimeType || "").startsWith("image/"))), [messages]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const cleanBody = message.trim();
    const cId = selectedConversationId;
    const recipientId = getId(selectedUser);
    const filesToSend = [...selectedFiles];

    if ((!cleanBody && filesToSend.length === 0) || !cId || !selectedUser || sendingMessage) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      _id: tempId,
      id: tempId,
      conversationId: cId,
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
    };

    setSendingMessage(true);
    setMessage("");
    setSelectedFiles([]);

    setMessages((prev) => {
      const next = [...prev, optimistic];
      messagesCache.current[cId] = next;
      saveCache(usersRef.current, conversationsRef.current, messagesCache.current);
      return next;
    });
    scrollToBottom(true);

    try {
      let res;
      if (filesToSend.length > 0) {
        const form = new FormData();
        form.append("conversationId", String(cId));
        form.append("body", cleanBody);
        if (recipientId) form.append("recipientId", String(recipientId));
        filesToSend.forEach((f) => form.append("files", f));
        res = await fetch(getApiUrl("/messages"), { method: "POST", credentials: "include", headers: getAuthHeaders(false), body: form });
      } else {
        res = await fetch(getApiUrl("/messages"), { method: "POST", credentials: "include", headers: getAuthHeaders(), body: JSON.stringify({ conversationId: cId, recipientId, body: cleanBody, messageType: "text" }) });
      }
      const data = await parseResponse(res);
      if (!res.ok) throw new Error(data?.message || "Failed to send.");
      await fetchMessages(cId, true);
    } catch (err) {
      setMessagesError(err?.message || "Send failed.");
      setMessages((prev) => prev.filter((m) => getMessageId(m) !== tempId));
      setMessage(cleanBody);
      setSelectedFiles(filesToSend);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleDragStart = (e, index) => setDraggedIndex(index);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    const updated = [...users];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(dropIndex, 0, moved);
    setUsers(updated);
    usersRef.current = updated;
    saveCache(updated, conversationsRef.current, messagesCache.current);
    setDraggedIndex(null);
  };

  const selectedName = selectedUser ? getUserName(selectedUser) : "";
  const selectedAvatar = selectedUser ? getUserAvatar(selectedUser) : "";

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#f7f8fc] text-slate-950">
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <section className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-white lg:flex-row">
          {/* SIDEBAR */}
          <aside className="flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-slate-100 lg:w-[360px] lg:border-b-0 lg:border-r bg-slate-50/50">
            <div className="shrink-0 border-b border-slate-100 p-4 sm:p-5">
              <div className="mb-3.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-slate-900">Chats</h2>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${socketConnected ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                    {socketConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
                  </span>
                </div>
              </div>

              {/* Group Conversations List in Sidebar */}
              {conversations.some((item) => item.isGroup) && (
                <div className="mb-3 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Groups</p>
                  {conversations.filter((item) => item.isGroup).map((group) => {
                    const gId = getConversationId(group);
                    const isSelected = String(selectedConversationId) === String(gId);
                    const unread = getUnreadCount(group);
                    return (
                      <button
                        key={gId}
                        onClick={() => openConversation(group)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${isSelected ? "bg-violet-50 text-violet-700" : "text-slate-700 hover:bg-slate-100"}`}
                      >
                        <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white font-bold">
                          <Users size={16} />
                          {unread > 0 && !isSelected && (
                            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[9px] text-white ring-2 ring-white font-bold">
                              {unread}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold">{group.groupName || "Team Group"}</p>
                          <p className="truncate text-[11px] text-slate-400">{getConversationLastMessage(group) || "Group chat"}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search contacts..."
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-medium text-slate-700 outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {loadingUsers && users.length === 0 ? (
                <div className="flex p-6 justify-center"><Loader2 size={24} className="animate-spin text-violet-600" /></div>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user, index) => {
                  const uId = getId(user);
                  const isSelected = String(getId(selectedUser) || "") === String(uId || "");
                  const existingConv = findConversationForUser(uId, conversations);
                  const unread = getUnreadCount(existingConv);
                  const avatarUrl = getUserAvatar(user);

                  return (
                    <div
                      key={uId || index}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                      onClick={() => handleSelectUser(user)}
                      className={`flex w-full cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-3.5 transition ${
                        isSelected ? "bg-violet-50/70 border-violet-200" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="cursor-grab text-slate-300 hover:text-slate-500" title="Drag to reorder">
                        <GripVertical size={14} />
                      </div>

                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-sm">
                        {avatarUrl ? (
                          <img src={getFileUrl(avatarUrl)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          getInitials(getUserName(user))
                        )}
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-blue-600" title="Active user" />

                        {unread > 0 && !isSelected && (
                          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] text-white ring-2 ring-white font-bold z-10">
                            {unread}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="truncate text-xs font-bold text-slate-900">{getUserName(user)}</p>
                          {existingConv && <span className="text-[10px] text-slate-400">{formatConversationTime(getConversationLastDate(existingConv))}</span>}
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">{getConversationLastMessage(existingConv) || user?.email || "Click to message"}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">No contacts available.</div>
              )}
            </div>
          </aside>

          {/* CHAT PANEL */}
          <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
            {selectedConversationId ? (
              <>
                {/* Header with Chat, Files, Photos and 3-Dots Menu */}
                <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-md">
                      {selectedAvatar ? (
                        <img src={getFileUrl(selectedAvatar)} alt="" className="h-full w-full object-cover" />
                      ) : selectedUser ? (
                        getInitials(selectedName)
                      ) : (
                        <MessageSquare size={18} />
                      )}
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-slate-900">{selectedName}</h2>
                      {/* Tabs: Chat, Files, Photos */}
                      <div className="flex items-center gap-3 mt-1">
                        <button
                          onClick={() => setHeaderTab("chat")}
                          className={`text-xs font-bold pb-0.5 transition ${headerTab === "chat" ? "text-violet-700 border-b-2 border-violet-700" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          Chat
                        </button>
                        <button
                          onClick={() => setHeaderTab("files")}
                          className={`text-xs font-bold pb-0.5 transition ${headerTab === "files" ? "text-violet-700 border-b-2 border-violet-700" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          Files
                        </button>
                        <button
                          onClick={() => setHeaderTab("photos")}
                          className={`text-xs font-bold pb-0.5 transition ${headerTab === "photos" ? "text-violet-700 border-b-2 border-violet-700" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          Photos
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Header Actions & 3-Dots Dropdown Menu */}
                  <div className="flex items-center gap-2 text-slate-600 relative" ref={menuRef}>
                    <button className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-violet-50 hover:text-violet-700" title="Video Call"><Video size={18} /></button>
                    <button className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-violet-50 hover:text-violet-700" title="Audio Call"><Phone size={17} /></button>
                    <button className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-violet-50 hover:text-violet-700" onClick={() => setShowGroupModal(true)} title="Start a group chat"><Users size={17} /></button>
                    <button
                      onClick={() => setMenuOpen((prev) => !prev)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-violet-50 hover:text-violet-700"
                      title="More options"
                    >
                      <MoreHorizontal size={18} />
                    </button>

                    {/* 3-Dots Dropdown Menu */}
                    {menuOpen && (
                      <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl border border-slate-100 bg-white py-2 shadow-2xl">
                        <button onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-violet-50">
                          <ExternalLink size={15} /> Open in new window <span className="ml-auto text-[10px] text-slate-400">Ctrl+O</span>
                        </button>
                        <button onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-violet-50">
                          <Calendar size={15} /> Schedule meeting
                        </button>
                        <button onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-violet-50">
                          <Share2 size={15} /> Share screen <span className="ml-auto text-[10px] text-slate-400">Ctrl+Shift+E</span>
                        </button>
                        <div className="my-1 border-t border-slate-100" />
                        <button onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-violet-50">
                          <CheckCheck size={15} /> Mark as unread
                        </button>
                        <button onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-violet-50">
                          <Bookmark size={15} className="text-violet-600" /> Favorite
                        </button>
                        <button onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-violet-50">
                          <BellOff size={15} /> Mute
                        </button>
                        <div className="my-1 border-t border-slate-100" />
                        <button onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50">
                          <AlertTriangle size={15} /> Report a concern
                        </button>
                        <button onClick={() => { setMenuOpen(false); handleDeleteConversation(); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50">
                          <Trash2 size={15} /> Delete conversation
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Content based on Header Tab */}
                {headerTab === "chat" && (
                  <>
                    <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-6 bg-slate-50/30">
                      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                        {messages.map((item, index) => {
                          const sender = item?.sender;
                          const isDeleted = Boolean(item?.isDeletedForEveryone);
                          const body = isDeleted ? "This message was deleted" : getMessageBody(item);
                          const senderRole = String(sender?.role || "").toLowerCase();
                          const isAdmin = senderRole === "admin" || sender?.name === "You";
                          const msgId = getMessageId(item);
                          const isEditing = editingMessageId === String(msgId);
                          const attachments = Array.isArray(item?.attachments) ? item.attachments : [];

                          return (
                            <div key={msgId || index} className={`group relative flex w-full items-center gap-2.5 ${isAdmin ? "justify-end" : "justify-start"}`}>
                              <div className={`relative max-w-[75%] rounded-[20px] px-4 py-3 shadow-sm ${
                                isDeleted ? "border border-slate-200 bg-slate-50 italic text-slate-400" :
                                isAdmin ? "rounded-tr-xs bg-violet-600 text-white" : "rounded-tl-xs border border-slate-100 bg-white text-slate-800"
                              }`}>
                                {!isAdmin && !isDeleted && <p className="mb-1 text-[10px] font-bold text-violet-600">{getUserName(sender)}</p>}

                                {isEditing ? (
                                  <div className="flex flex-col gap-2">
                                    <textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={3} className="w-full rounded-xl border p-2 text-xs text-slate-800 bg-white outline-none" />
                                    <div className="flex gap-2 justify-end">
                                      <button onClick={() => setEditingMessageId(null)} className="rounded-lg bg-black/10 px-2 py-1 text-[10px] font-bold">Cancel</button>
                                      <button onClick={() => handleSaveEditedMessage(item)} className="rounded-lg bg-white/20 px-2 py-1 text-[10px] font-bold">Save</button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    {body && <p className="whitespace-pre-wrap break-words text-xs font-medium leading-relaxed">{body}</p>}
                                    {/* Image and File Attachments Rendering */}
                                    {attachments.length > 0 && (
                                      <div className={`flex flex-col gap-2 ${body ? "mt-2" : ""}`}>
                                        {attachments.map((att, attIndex) => {
                                          const fileUrl = getFileUrl(att?.url);
                                          const isImage = String(att?.mimeType || att?.fileType || "").includes("image") || /\.(jpg|jpeg|png|webp|gif)$/i.test(att?.url || "");
                                          
                                          if (isImage) {
                                            return (
                                              <a key={attIndex} href={fileUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-white/20 bg-black/5">
                                                <img src={fileUrl} alt={att?.originalName || "Attachment"} className="max-h-60 w-full object-cover rounded-xl" />
                                              </a>
                                            );
                                          }

                                          return (
                                            <a key={attIndex} href={fileUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2.5 rounded-xl p-2.5 text-xs font-medium transition ${isAdmin ? "bg-white/10 hover:bg-white/20 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-800"}`}>
                                              <FileText size={18} className="shrink-0" />
                                              <span className="truncate">{att?.originalName || att?.filename || "Download File"}</span>
                                            </a>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </>
                                )}

                                {Array.isArray(item?.reactions) && item.reactions.length > 0 && (
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    {item.reactions.map((r, i) => (
                                      <span key={i} className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold">{r.emoji}</span>
                                    ))}
                                  </div>
                                )}

                                <div className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${isAdmin ? "text-violet-200" : "text-slate-400"}`}>
                                  <span>{formatMessageTime(item?.createdAt)}</span>
                                  {isAdmin && !isDeleted && (
                                    item?.seen || item?.isRead || item?.readAt ? (
                                      <Eye size={13} className="text-emerald-300" title="Seen" />
                                    ) : (
                                      <CheckCheck size={12} />
                                    )
                                  )}
                                </div>
                              </div>

                              {!isDeleted && !String(msgId).startsWith("temp-") && (
                                <div className={`absolute opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-white border border-slate-200 shadow-lg rounded-xl px-2 py-1 transition ${isAdmin ? "-translate-x-12" : "translate-x-12"}`}>
                                  {["👍", "❤️", "😂"].map((emoji) => (
                                    <button key={emoji} onClick={() => handleReactToMessage(item, emoji)} className="hover:scale-125 transition text-sm p-1">{emoji}</button>
                                  ))}
                                  {isAdmin && (
                                    <button onClick={() => { setEditingMessageId(String(msgId)); setEditDraft(getMessageBody(item)); }} className="p-1 text-slate-400 hover:text-violet-600" title="Edit">
                                      <Pencil size={13} />
                                    </button>
                                  )}
                                  <button onClick={() => handleDeleteMessage(item, "everyone")} className="p-1 text-slate-400 hover:text-rose-600" title="Delete">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    </div>

                    {/* Microsoft Teams Single-Line Input Section */}
                    <div className="shrink-0 border-t border-slate-100 bg-white p-4 sm:p-5">
                      {selectedFiles.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {selectedFiles.map((file, index) => (
                            <div key={index} className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs text-violet-800">
                              <span className="max-w-[150px] truncate font-semibold">{file.name}</span>
                              <button type="button" onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== index))} className="text-violet-400 hover:text-rose-600">
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <form onSubmit={handleSendMessage} className="flex items-center rounded-2xl border border-slate-200 bg-white focus-within:border-violet-500 shadow-sm px-4 py-2">
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage(e);
                            }
                          }}
                          placeholder="Type a message"
                          rows={1}
                          className="flex-1 resize-none border-none py-2 text-xs outline-none bg-transparent"
                        />

                        {/* Teams Style Action Bar inline with Send Button */}
                        <div className="flex items-center gap-2 text-slate-500 ml-2 border-l pl-3">
                          <button type="button" className="p-1.5 rounded-lg hover:bg-slate-100" title="Emoji"><Smile size={17} /></button>
                          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded-lg hover:bg-slate-100" title="Attach"><Paperclip size={17} /></button>
                          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded-lg hover:bg-slate-100" title="Photos"><ImageIcon size={17} /></button>
                          <input type="file" multiple ref={fileInputRef} onChange={(e) => setSelectedFiles(Array.from(e.target.files))} className="hidden" />
                          <button type="button" onClick={() => setShowGroupModal(true)} className="p-1.5 rounded-lg hover:bg-slate-100" title="Add"><Plus size={17} /></button>

                          <button
                            type="submit"
                            disabled={!message.trim() && !selectedFiles.length}
                            className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md hover:bg-violet-700 disabled:bg-slate-100 disabled:text-slate-300 transition ml-1"
                          >
                            <Send size={15} />
                          </button>
                        </div>
                      </form>
                    </div>
                  </>
                )}

                {headerTab === "files" && (
                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Shared Files</h3>
                    {fileMessages.length === 0 ? (
                      <p className="text-xs text-slate-500">No files shared in this chat.</p>
                    ) : (
                      <div className="space-y-2">
                        {fileMessages.map((m, i) => (
                          <div key={i} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                            <FileText size={20} className="text-violet-600" />
                            <span className="text-xs font-bold text-slate-800">{getMessageText(m)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {headerTab === "photos" && (
                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Shared Photos</h3>
                    {photoMessages.length === 0 ? (
                      <p className="text-xs text-slate-500">No photos shared in this chat.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        {photoMessages.map((m, i) => (
                          <div key={i} className="aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <img src={getFileUrl(m.attachments?.[0]?.url)} alt="" className="h-full w-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-slate-400">
                <p className="text-xs font-bold">Select a client conversation from the left</p>
              </div>
            )}
          </main>
        </section>
      </div>

      {/* CREATE GROUP MODAL */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateGroup} className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <h3 className="text-base font-bold text-slate-900">Start a group chat</h3>
              <button type="button" onClick={() => setShowGroupModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Support Team"
                  required
                  className="mt-1 h-10 w-full rounded-xl border px-3 text-xs outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Select Members</label>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border p-2">
                  {users.map((user) => {
                    const uId = getId(user);
                    if (!uId) return null;
                    const checked = selectedGroupMembers.includes(uId);
                    return (
                      <label key={uId} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedGroupMembers((prev) => [...prev, uId]);
                            else setSelectedGroupMembers((prev) => prev.filter((id) => id !== uId));
                          }}
                        />
                        <span className="font-semibold text-slate-800">{getUserName(user)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowGroupModal(false)} className="rounded-xl border px-4 py-2 text-xs font-bold text-slate-600">Cancel</button>
              <button type="submit" disabled={creatingGroup || !groupName.trim() || selectedGroupMembers.length === 0} className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50">
                {creatingGroup ? "Creating..." : "Create Group"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}