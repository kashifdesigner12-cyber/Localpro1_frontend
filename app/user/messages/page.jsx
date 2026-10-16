"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Eye,
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
  UsersRound,
  Plus,
  PanelRightOpen,
  PanelRightClose,
  Smile,
  Wifi,
  WifiOff,
  X,
  GripVertical,
  Pencil,
  Video,
  Phone,
  MoreHorizontal,
  ExternalLink,
  Calendar,
  Share2,
  Bookmark,
  BellOff,
  AlertTriangle,
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
  if (/^(https?:\/\/|blob:|data:)/i.test(url)) return url;
  return `${BACKEND_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function getUserId(user) {
  if (!user) return null;
  if (typeof user === "string" || typeof user === "number") return String(user);
  return user._id || user.id || user.userId || user.user?._id || user.user?.id || null;
}

function isGroupConversation(conversation) {
  return Boolean(
    conversation?.isGroup ||
    conversation?.type === "group" ||
    conversation?.conversationType === "group" ||
    conversation?.kind === "group"
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
    return value._id || value.id || value.conversationId ? String(value._id || value.id || value.conversationId) : null;
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
  const participants = Array.isArray(conversation?.participants) ? conversation.participants : [];
  const currentId = getUserId(currentUser);
  const others = participants.filter((p) => {
    const pId = getUserId(p);
    return !(currentId && pId && String(currentId) === String(pId));
  });
  return (
    others.find((p) => ["admin", "manager", "support"].includes(String(p?.role || "").toLowerCase())) ||
    others[0] ||
    conversation?.admin ||
    conversation?.support ||
    { name: "Admin / Support", role: "admin" }
  );
}

function getParticipantName(conversation, currentUser) {
  const p = getOtherParticipant(conversation, currentUser);
  return p?.name || p?.fullName || p?.displayName || p?.username || p?.email || conversation?.name || "Admin / Support";
}

function getParticipantAvatar(conversation, currentUser) {
  const p = getOtherParticipant(conversation, currentUser);
  return p?.avatar || p?.profileImage || p?.image || "";
}

function normalizeConversations(response) {
  const value = response?.conversations ?? response?.data?.conversations ?? response?.results ?? response?.data;
  return Array.isArray(value) ? value.filter(Boolean) : value && typeof value === "object" ? [value] : [];
}

function normalizeMessages(response) {
  const value = response?.messages ?? response?.data?.messages ?? response?.results ?? response?.data;
  return Array.isArray(value) ? value.filter(Boolean) : value && typeof value === "object" ? [value] : [];
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
    const key = id ? String(id) : `${getMessageText(message)}_${message?.createdAt || ""}`;
    
    if (map.has(key)) {
      const prev = map.get(key);
      map.set(key, { ...prev, ...message, sending: false });
    } else {
      map.set(key, message);
    }
  }

  const output = Array.from(map.values());
  return output.sort((a, b) => new Date(a?.createdAt || a?.sentAt || 0).getTime() - new Date(b?.createdAt || b?.sentAt || 0).getTime());
}

function getInitials(name) {
  return String(name || "A").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "A";
}

function extractUser(response) {
  return response?.user || response?.data?.user || response?.data || response || null;
}

function formatDateTime(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(date) {
  if (!date) return "";
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

async function apiRequest(endpoint, options = {}) {
  const token = getStoredToken();
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(isForm || !options.body ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };
  const response = await fetch(`${API_URL}${endpoint}`, { ...options, credentials: "include", cache: "no-store", headers });
  let data = null;
  try {
    const text = await response.text();
    if (text) data = JSON.parse(text);
  } catch {}
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `Request failed (${response.status})`);
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
  if (!id || id === DEFAULT_CONVERSATION_ID) return { messages: [] };
  return apiRequest(`/messages/${encodeURIComponent(id)}`);
}

async function markConversationRead(id) {
  if (!id || id === DEFAULT_CONVERSATION_ID) return;
  return apiRequest(`/conversations/${encodeURIComponent(id)}/read`, { method: "PUT" });
}

/* -------------------- Main Component -------------------- */

export default function UserMessagesPage() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
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
  const [notificationPermission, setNotificationPermission] = useState("default");
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("chats");
  const [chatFilter, setChatFilter] = useState("all");
  const [localGroups, setLocalGroups] = useState([]);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [groupMembersInput, setGroupMembersInput] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [deletingMessage, setDeletingMessage] = useState(false);

  const [headerTab, setHeaderTab] = useState("chat");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");
  const [draggedIndex, setDraggedIndex] = useState(null);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const selectedConversationIdRef = useRef(null);
  const currentUserRef = useRef(null);
  const conversationsRef = useRef([]);
  const messagesCache = useRef({});
  const authorizedConversationIdsRef = useRef(new Set());
  const loadMessagesRequestRef = useRef(0);
  const conversationsRequestRef = useRef(false);
  const processedMessageIdsRef = useRef(new Set());
  const notificationAudioRef = useRef(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission("unsupported");
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

  useEffect(() => {
    if (messages.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  const scrollToBottom = useCallback((instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? "auto" : "smooth", block: "end" });
  }, []);

  const loadConversations = useCallback(async (silent = false) => {
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
          try { localStorage.setItem("user", JSON.stringify(user)); } catch {}
        }
      } else {
        response = await safeApiRequest("/conversations");
      }

      if (!response) {
        response = await safeApiRequest("/messages/conversations");
      }

      let list = normalizeConversations(response).filter((c) => Boolean(getConversationId(c)));
      if (!list.length) {
        try {
          const cached = localStorage.getItem("cached_user_admin_chats");
          if (cached) list = JSON.parse(cached);
        } catch {}
      }

      conversationsRef.current = list;
      setConversations(list);
      try { localStorage.setItem("cached_user_admin_chats", JSON.stringify(list)); } catch {}

      setSelectedConversation((prev) => {
        const prevId = getConversationId(prev);
        if (prevId) {
          const exists = list.find((item) => getConversationId(item) === prevId);
          if (exists) return exists;
        }
        return list[0] || null;
      });
    } catch (err) {
      if (!silent) setError(err?.message || "Unable to load conversations.");
    } finally {
      conversationsRequestRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const cachedUser = localStorage.getItem("user");
        if (cachedUser && !cancelled) setCurrentUser(JSON.parse(cachedUser));
        const cachedChats = localStorage.getItem("cached_user_admin_chats");
        if (cachedChats && !cancelled) {
          const parsed = JSON.parse(cachedChats);
          setConversations(parsed);
          setSelectedConversation(parsed[0] || null);
          setLoading(false);
        }
      } catch {}
      if (!cancelled) await loadConversations(false);
    }
    init();
    return () => { cancelled = true; };
  }, [loadConversations]);

  const saveConversationMessages = useCallback((id, nextMessages) => {
    if (!id) return;
    messagesCache.current[id] = nextMessages;
    try { localStorage.setItem(`cached_messages_${id}`, JSON.stringify(nextMessages)); } catch {}
    if (String(selectedConversationIdRef.current) === String(id)) {
      setMessages(nextMessages);
    }
  }, []);

  const loadMessages = useCallback(async (id, silent = false) => {
    if (!id || id === DEFAULT_CONVERSATION_ID || String(id).startsWith("local-group-")) {
      let cachedMsgs = messagesCache.current[id];
      if (!cachedMsgs) {
        try {
          const stored = localStorage.getItem(`cached_messages_${id}`);
          if (stored) cachedMsgs = JSON.parse(stored);
        } catch {}
      }
      setMessages(id ? cachedMsgs || [] : []);
      setMessagesLoading(false);
      setMessagesError("");
      return;
    }

    const requestId = ++loadMessagesRequestRef.current;
    try {
      if (!silent) setMessagesLoading(true);
      setMessagesError("");
      let cached = messagesCache.current[id];
      if (!cached) {
        try {
          const stored = localStorage.getItem(`cached_messages_${id}`);
          if (stored) {
            cached = JSON.parse(stored);
            messagesCache.current[id] = cached;
            if (String(selectedConversationIdRef.current) === String(id)) {
              setMessages(cached);
              setMessagesLoading(false);
            }
          }
        } catch {}
      }

      const response = await getConversationMessages(id);
      if (requestId !== loadMessagesRequestRef.current) return;
      authorizedConversationIdsRef.current.add(String(id));

      if (String(selectedConversationIdRef.current || "") === String(id) && socketRef.current?.connected) {
        socketRef.current.emit("join_room", id);
      }

      const fetched = normalizeMessages(response);
      const merged = mergeMessages(cached || [], fetched);
      messagesCache.current[id] = merged;
      try { localStorage.setItem(`cached_messages_${id}`, JSON.stringify(merged)); } catch {}

      if (String(selectedConversationIdRef.current) === String(id)) {
        setMessages(merged);
      }
    } catch (err) {
      if (requestId !== loadMessagesRequestRef.current) return;
      authorizedConversationIdsRef.current.delete(String(id));
      if (!silent) setMessagesError(err?.message || "Unable to load messages.");
    } finally {
      if (requestId === loadMessagesRequestRef.current) setMessagesLoading(false);
    }
  }, []);

  const handleIncomingMessage = useCallback((payload) => {
    const incoming =
      payload?.message && typeof payload.message === "object"
        ? payload.message
        : payload?.data?.message && typeof payload.data.message === "object"
        ? payload.data.message
        : payload?.data && typeof payload.data === "object" && (payload.data._id || payload.data.id)
        ? payload.data
        : payload;

    if (!incoming || typeof incoming !== "object") return;

    const id = getMessageId(incoming);
    const conversationId = getMessageConversationId(incoming);
    if (!conversationId) {
      const activeId = selectedConversationIdRef.current;
      if (activeId) loadMessages(activeId, true);
      loadConversations(true);
      return;
    }

    if (id && processedMessageIdsRef.current.has(id)) return;
    if (id) {
      processedMessageIdsRef.current.add(id);
      if (processedMessageIdsRef.current.size > 1500) {
        const oldest = processedMessageIdsRef.current.values().next().value;
        processedMessageIdsRef.current.delete(oldest);
      }
    }

    const senderId = getUserId(incoming.sender);
    const myId = getUserId(currentUserRef.current);
    const isOwn = Boolean(senderId && myId && String(senderId) === String(myId));
    const active = String(selectedConversationIdRef.current || "") === String(conversationId);

    const latest = messagesCache.current[conversationId] || [];
    const merged = mergeMessages(latest, [incoming]);
    saveConversationMessages(conversationId, merged);

    const preview = getMessageText(incoming) || (incoming.attachments?.length ? "📷 Photo" : "");
    const time = incoming.createdAt || new Date().toISOString();

    setConversations((previous) => {
      let found = false;
      const updated = previous.map((conv) => {
        if (getConversationId(conv) !== String(conversationId)) return conv;
        found = true;
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

      const targetIndex = updated.findIndex((c) => getConversationId(c) === String(conversationId));
      if (targetIndex > 0) {
        const [moved] = updated.splice(targetIndex, 1);
        updated.unshift(moved);
      }

      conversationsRef.current = updated;
      try { localStorage.setItem("cached_user_admin_chats", JSON.stringify(updated)); } catch {}
      if (!found) loadConversations(true);
      return updated;
    });

    if (!isOwn) {
      playNotificationSound(notificationAudioRef);
    }
  }, [loadConversations, loadMessages, saveConversationMessages]);

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
        const stored = localStorage.getItem(`cached_messages_${id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          messagesCache.current[id] = parsed;
          setMessages(parsed);
          setMessagesLoading(false);
        } else {
          setMessages([]);
        }
      } catch {
        setMessages([]);
      }
    }
    loadMessages(id, Boolean(cached));
  }, [selectedConversationId, loadMessages]);

  useEffect(() => {
    const socket = io(BACKEND_BASE_URL, {
      auth: { token: getStoredToken() },
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socketRef.current = socket;

    const onConnect = () => {
      setSocketConnected(true);
      const activeId = selectedConversationIdRef.current;
      if (activeId && activeId !== DEFAULT_CONVERSATION_ID) {
        socket.emit("join_room", activeId);
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("connect_error", () => setSocketConnected(false));

    ["receive_message", "new_message", "message", "message_notification"].forEach((ev) => {
      socket.on(ev, handleIncomingMessage);
    });

    return () => {
      socket.disconnect();
    };
  }, [handleIncomingMessage]);

  const filteredConversations = useMemo(() => {
    let source = activeTab === "groups"
      ? [...conversations.filter(isGroupConversation), ...localGroups]
      : conversations.filter((c) => !isGroupConversation(c));

    if (chatFilter === "unread") {
      source = source.filter((c) => Number(c.unreadCount || c.unread || 0) > 0);
    }

    const query = search.trim().toLowerCase();
    if (!query) return source;

    return source.filter((c) =>
      `${getParticipantName(c, currentUser)} ${c?.lastMessage || ""}`.toLowerCase().includes(query)
    );
  }, [conversations, localGroups, activeTab, chatFilter, search, currentUser]);

  const handleDragStart = (e, index) => setDraggedIndex(index);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    const updated = [...conversations];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(dropIndex, 0, moved);
    setConversations(updated);
    setDraggedIndex(null);
  };

  async function handleSelectConversation(conversation) {
    if (!conversation) return;
    const id = getConversationId(conversation);
    if (!id) return;

    setSelectedFiles([]);
    setMessagesError("");
    setSelectedConversation(conversation);
    selectedConversationIdRef.current = id;
    setHeaderTab("chat");

    const unread = Number(conversation.unreadCount || conversation.unread || 0);
    if (unread > 0) {
      try {
        await markConversationRead(id);
        setConversations((prev) =>
          prev.map((c) => (getConversationId(c) === id ? { ...c, unreadCount: 0, unread: 0 } : c))
        );
      } catch {}
    }
    loadMessages(id, true);
  }

  function handleCreateGroup(e) {
    e?.preventDefault();
    const name = groupNameInput.trim();
    if (!name) return;

    const groupId = `local-group-${Date.now()}`;
    const newGroup = {
      _id: groupId,
      id: groupId,
      name,
      isGroup: true,
      isLocalGroup: true,
      participants: [currentUser || { name: "You" }],
      lastMessage: "Group created",
      updatedAt: new Date().toISOString(),
      unreadCount: 0,
    };

    setLocalGroups((prev) => [newGroup, ...prev]);
    setActiveTab("groups");
    setSelectedConversation(newGroup);
    setGroupModalOpen(false);
    setGroupNameInput("");
    setGroupMembersInput("");
  }

  async function handleSendMessage(e) {
    e?.preventDefault();
    const body = message.trim();
    const conversationId = getConversationId(selectedConversation);
    const files = [...selectedFiles];
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
      sending: true,
      seen: false,
    };

    const latest = messagesCache.current[conversationId] || [];
    saveConversationMessages(conversationId, mergeMessages(latest, [optimisticMsg]));
    setMessage("");
    setSelectedFiles([]);
    setSending(true);
    sendingRef.current = true;

    requestAnimationFrame(() => scrollToBottom(true));

    try {
      let response;
      if (files.length) {
        const form = new FormData();
        form.append("conversationId", conversationId);
        form.append("body", body);
        if (recipientId) form.append("recipientId", String(recipientId));
        files.forEach((file) => form.append("files", file));
        response = await apiRequest("/messages", { method: "POST", body: form });
      } else {
        response = await apiRequest("/messages", {
          method: "POST",
          body: JSON.stringify({ conversationId, recipientId, body, messageType: "text" }),
        });
      }

      const sent = response?.messageData || response?.data?.message || response?.data;
      if (sent) {
        const updatedLatest = messagesCache.current[conversationId] || [];
        saveConversationMessages(
          conversationId,
          mergeMessages(updatedLatest.filter((m) => getMessageId(m) !== tempId), [sent])
        );
      }

      setConversations((prev) => {
        const list = [...prev];
        const idx = list.findIndex((c) => getConversationId(c) === conversationId);
        if (idx > 0) {
          const [item] = list.splice(idx, 1);
          list.unshift(item);
        }
        return list;
      });
    } catch (err) {
      setMessagesError(err?.message || "Failed to send.");
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  }

  async function handleEditMessage(messageId) {
    if (!editText.trim()) return;
    const conversationId = getConversationId(selectedConversation);
    const latest = messagesCache.current[conversationId] || messages;

    const updated = latest.map((m) => (getMessageId(m) === messageId ? { ...m, body: editText, message: editText, edited: true } : m));
    saveConversationMessages(conversationId, updated);
    setEditingMessageId(null);
    setEditText("");

    try {
      await apiRequest(`/messages/${encodeURIComponent(messageId)}`, {
        method: "PUT",
        body: JSON.stringify({ body: editText }),
      });
    } catch {}
  }

  async function executeDeleteMessage(type) {
    if (!messageToDelete) return;
    const id = getMessageId(messageToDelete);
    if (!id) return;

    try {
      setDeletingMessage(true);
      const endpoint = type === "everyone" ? `/messages/${encodeURIComponent(id)}/delete-for-everyone` : `/messages/${encodeURIComponent(id)}/delete-for-me`;
      await apiRequest(endpoint, { method: "POST" });

      const conversationId = getConversationId(selectedConversation);
      const latest = messagesCache.current[conversationId] || messages;
      const updated = type === "me" ? latest.filter((m) => getMessageId(m) !== id) : latest.map((m) => (getMessageId(m) === id ? { ...m, body: "This message was deleted", isDeletedForEveryone: true } : m));

      saveConversationMessages(conversationId, updated);
      setDeleteModalOpen(false);
      setMessageToDelete(null);
    } catch (err) {
      alert(err?.message || "Failed to delete.");
    } finally {
      setDeletingMessage(false);
    }
  }

  async function handleAddReaction(messageId, emoji) {
    const conversationId = getConversationId(selectedConversation);
    const latest = messagesCache.current[conversationId] || messages;
    const updated = latest.map((m) => {
      if (getMessageId(m) === messageId) {
        const reactions = m.reactions || [];
        return { ...m, reactions: [...reactions, { emoji, userId: getUserId(currentUser) }] };
      }
      return m;
    });
    saveConversationMessages(conversationId, updated);

    try {
      await apiRequest(`/messages/${encodeURIComponent(messageId)}/react`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      });
    } catch {}
  }

  const selectedName = selectedConversation ? getParticipantName(selectedConversation, currentUser) : "";

  const photoMessages = useMemo(() => {
    return messages.filter((m) =>
      (m.attachments || []).some((att) => String(att?.mimeType || "").startsWith("image/"))
    );
  }, [messages]);

  const fileMessages = useMemo(() => {
    return messages.filter((m) =>
      (m.attachments || []).some((att) => !String(att?.mimeType || "").startsWith("image/"))
    );
  }, [messages]);

  return (
    <div className="relative flex h-[calc(100vh-4rem)] min-h-0 w-full animate-fadeIn overflow-hidden bg-[#f7f8fc] p-4 text-slate-950 sm:p-6 lg:p-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-72 w-72 animate-pulse rounded-full bg-violet-400/10 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-pink-400/10 blur-3xl" />
      </div>

      <div className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
        <section className="grid h-full min-h-0 min-w-0 w-full flex-1 grid-cols-1 grid-rows-[240px_minmax(0,1fr)] overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)] lg:grid-cols-[360px_minmax(0,1fr)] lg:grid-rows-1">
          {/* Left Sidebar */}
          <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-b border-slate-100 lg:border-b-0 lg:border-r">
            <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 p-4 sm:p-5">
              <div className="mb-3.5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Chats & Teams</h2>
                  <p className="mt-0.5 text-xs text-slate-400">Microsoft Teams style layout</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGroupModalOpen(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm hover:bg-violet-700"
                    title="Start Group Chat"
                  >
                    <Plus size={16} />
                  </button>
                  {socketConnected ? <Wifi size={14} className="text-emerald-600" /> : <WifiOff size={14} className="text-amber-600" />}
                </div>
              </div>

              {/* Tabs */}
              <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                <button
                  onClick={() => setActiveTab("chats")}
                  className={`flex h-8 items-center justify-center gap-2 rounded-lg text-[11px] font-bold transition ${activeTab === "chats" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}
                >
                  <MessageSquare size={13} /> Chats
                </button>
                <button
                  onClick={() => setActiveTab("groups")}
                  className={`flex h-8 items-center justify-center gap-2 rounded-lg text-[11px] font-bold transition ${activeTab === "groups" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}
                >
                  <UsersRound size={13} /> Groups
                </button>
              </div>

              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search chats..."
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-medium text-slate-700 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {filteredConversations.map((c, index) => {
                const id = getConversationId(c);
                const name = getParticipantName(c, currentUser);
                const avatar = getParticipantAvatar(c, currentUser);
                const last = c?.lastMessage || c?.lastMessageText || "No messages yet";
                const unread = Number(c?.unreadCount || c?.unread || 0);
                const active = String(selectedConversationId) === String(id);

                return (
                  <div
                    key={id || index}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    onClick={() => handleSelectConversation(c)}
                    className={`flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3.5 transition ${
                      active ? "bg-violet-50/70 border-violet-200" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="cursor-grab text-slate-300 hover:text-slate-500"><GripVertical size={14} /></div>
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-sm">
                      {avatar ? <img src={getFileUrl(avatar)} alt="" className="h-full w-full rounded-2xl object-cover" /> : getInitials(name)}
                      {unread > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-extrabold text-white ring-2 ring-white">
                          {unread}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`truncate text-xs font-bold ${unread ? "text-slate-900" : "text-slate-800"}`}>{name}</p>
                        <span className="text-[10px] text-slate-400">{formatDateTime(c?.updatedAt)}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">{last}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Right Chat Area */}
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {selectedConversation ? (
              <>
                {/* Header with Chat / Files / Photos and 3-Dots Menu */}
                <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-md">
                      {getInitials(selectedName)}
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-slate-900">{selectedName}</h2>
                      {/* Chat Header Tabs: Chat, Files, Photos */}
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
                          <Check size={15} /> Mark as unread
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
                        <button onClick={() => { setMenuOpen(false); setDeleteModalOpen(true); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50">
                          <Trash2 size={15} /> Delete conversation
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Content based on Header Tab (Chat, Files, Photos) */}
                {headerTab === "chat" && (
                  <>
                    <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-6 bg-slate-50/30">
                      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                        {messages.map((item, index) => {
                          const isOutgoing = String(getUserId(item?.sender)) === String(getUserId(currentUser));
                          const msgId = getMessageId(item);
                          const isEditing = editingMessageId === msgId;
                          const attachments = Array.isArray(item?.attachments) ? item.attachments : [];

                          return (
                            <div key={msgId || index} className={`group flex gap-3 ${isOutgoing ? "justify-end" : "justify-start"}`}>
                              <div className={`relative max-w-[75%] rounded-[20px] px-4 py-3 shadow-sm ${isOutgoing ? "rounded-tr-xs bg-violet-600 text-white" : "rounded-tl-xs border border-slate-100 bg-white text-slate-800"}`}>
                                {!isOutgoing && <p className="mb-1 text-[10px] font-bold text-violet-600">{selectedName}</p>}

                                {item.isDeletedForEveryone ? (
                                  <p className="italic text-slate-400 text-xs">This message was deleted</p>
                                ) : isEditing ? (
                                  <div className="flex flex-col gap-2">
                                    <input
                                      value={editText}
                                      onChange={(e) => setEditText(e.target.value)}
                                      className="rounded-xl border border-slate-200 px-3 py-1 text-xs text-slate-800 bg-white outline-none"
                                    />
                                    <div className="flex gap-2">
                                      <button onClick={() => handleEditMessage(msgId)} className="rounded-lg bg-violet-700 px-2.5 py-1 text-white text-[10px] font-bold">Save</button>
                                      <button onClick={() => setEditingMessageId(null)} className="rounded-lg border px-2.5 py-1 text-[10px] font-bold">Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    {getMessageText(item) && (
                                      <p className="whitespace-pre-wrap break-words text-xs font-medium leading-relaxed">{getMessageText(item)}</p>
                                    )}
                                    {/* Render Attachments/Images properly */}
                                    {attachments.length > 0 && (
                                      <div className={`flex flex-col gap-2 ${getMessageText(item) ? "mt-2" : ""}`}>
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
                                            <a key={attIndex} href={fileUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2.5 rounded-xl p-2.5 text-xs font-medium transition ${isOutgoing ? "bg-white/10 hover:bg-white/20 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-800"}`}>
                                              <FileText size={18} className="shrink-0" />
                                              <span className="truncate">{att?.originalName || att?.filename || "Download File"}</span>
                                            </a>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </>
                                )}

                                {/* Reactions */}
                                {Array.isArray(item?.reactions) && item.reactions.length > 0 && (
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    {item.reactions.map((r, i) => (
                                      <span key={i} className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold">{r.emoji}</span>
                                    ))}
                                  </div>
                                )}

                                <div className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${isOutgoing ? "text-violet-200" : "text-slate-400"}`}>
                                  <span>{formatTime(item?.createdAt)}</span>
                                  {isOutgoing && !item.isDeletedForEveryone && (
                                    item?.seen ? <Eye size={13} className="text-emerald-300" title="Seen" /> : <CheckCheck size={12} />
                                  )}
                                </div>
                              </div>

                              {/* Hover action bar */}
                              {!item.isDeletedForEveryone && (
                                <div className={`absolute opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-white border border-slate-200 shadow-lg rounded-xl px-2 py-1 transition ${isOutgoing ? "-translate-x-12" : "translate-x-12"}`}>
                                  {["👍", "❤️", "😂"].map((emoji) => (
                                    <button key={emoji} onClick={() => handleAddReaction(msgId, emoji)} className="hover:scale-125 transition text-sm p-1">{emoji}</button>
                                  ))}
                                  {isOutgoing && (
                                    <button onClick={() => { setEditingMessageId(msgId); setEditText(getMessageText(item)); }} className="p-1 text-slate-400 hover:text-violet-600" title="Edit">
                                      <Pencil size={13} />
                                    </button>
                                  )}
                                  <button onClick={() => { setMessageToDelete(item); setDeleteModalOpen(true); }} className="p-1 text-slate-400 hover:text-rose-600" title="Delete">
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

                    {/* Bottom Type Section */}
                    <div className="shrink-0 border-t border-slate-100 bg-white p-4 sm:p-5">
                      <form onSubmit={handleSendMessage} className="flex items-end gap-2.5">
                        <input type="file" multiple ref={fileInputRef} onChange={(e) => setSelectedFiles(Array.from(e.target.files))} className="hidden" />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-violet-50">
                          <Paperclip size={18} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage(e);
                              }
                            }}
                            placeholder={`Message ${selectedName}...`}
                            rows={1}
                            className="min-h-11 max-h-32 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-700 outline-none focus:border-violet-500 focus:bg-white"
                          />
                        </div>
                        <button type="submit" disabled={!message.trim() && !selectedFiles.length} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md hover:bg-violet-700 disabled:bg-slate-200">
                          <Send size={17} />
                        </button>
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
                <p className="text-xs font-bold">Select a conversation to start chatting</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Start Group Chat Modal */}
      {groupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateGroup} className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Start Group Chat</h3>
            <p className="mt-1 text-xs text-slate-400">Enter a group name to start chatting with multiple users.</p>
            <input
              value={groupNameInput}
              onChange={(e) => setGroupNameInput(e.target.value)}
              placeholder="Group name..."
              className="mt-4 h-11 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-violet-500"
              autoFocus
            />
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setGroupModalOpen(false)} className="h-10 rounded-xl border px-4 text-xs font-bold text-slate-600">Cancel</button>
              <button type="submit" className="h-10 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-violet-700">Create Group</button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Delete Message?</h3>
            <div className="mt-4 flex flex-col gap-2.5">
              <button onClick={() => { executeDeleteMessage("everyone"); setDeleteModalOpen(false); }} className="h-11 w-full rounded-2xl bg-rose-600 text-xs font-bold text-white">Delete for Everyone</button>
              <button onClick={() => { executeDeleteMessage("me"); setDeleteModalOpen(false); }} className="h-11 w-full rounded-2xl border border-slate-200 text-xs font-bold text-slate-700">Delete for Me</button>
              <button onClick={() => setDeleteModalOpen(false)} className="h-9 w-full text-xs font-semibold text-slate-400">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function playNotificationSound(audioRef) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch {}
}