
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
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
  X,
  Bell,
} from "lucide-react";
import { io } from "socket.io-client";
import { authService } from "@/services/authService";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "https://api.localpro1.net/api"
).trim().replace(/\/+$/, "");

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

function getStoredToken() {
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
  if (typeof user === "string" || typeof user === "number") return user;

  return (
    user?._id ||
    user?.id ||
    user?.userId ||
    user?.user?._id ||
    user?.user?.id ||
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
    return String(value._id || value.id || value.conversationId || "");
  }

  return value ? String(value) : null;
}

function getOtherParticipant(conversation, currentUser) {
  const participants = Array.isArray(conversation?.participants)
    ? conversation.participants
    : [];

  const currentUserId = getUserId(currentUser);

  const others = participants.filter((participant) => {
    const participantId = getUserId(participant);
    return !(
      currentUserId &&
      participantId &&
      String(currentUserId) === String(participantId)
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
  const participant = getOtherParticipant(conversation, currentUser);

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
  const participant = getOtherParticipant(conversation, currentUser);
  return (
    participant?.avatar ||
    participant?.profileImage ||
    participant?.image ||
    ""
  );
}

function normalizeConversations(response) {
  const possible =
    response?.conversations ??
    response?.data?.conversations ??
    response?.results ??
    response?.data;

  if (Array.isArray(possible)) return possible.filter(Boolean);
  if (possible && typeof possible === "object") return [possible];

  return [];
}

function normalizeMessages(response) {
  const possible =
    response?.messages ??
    response?.data?.messages ??
    response?.results ??
    response?.data;

  if (Array.isArray(possible)) return possible.filter(Boolean);
  if (possible && typeof possible === "object") return [possible];

  return [];
}

function getMessageId(message) {
  const id = message?._id || message?.id || message?.messageId;
  return id ? String(id) : "";
}

function getMessageText(message) {
  return (
    message?.body ||
    message?.message ||
    (message?.attachments?.length ? "Attachment" : "")
  );
}

function mergeMessages(existing, incoming) {
  const combined = [...(existing || [])];

  for (const message of incoming || []) {
    const incomingId = getMessageId(message);

    const index = combined.findIndex((item) => {
      const existingId = getMessageId(item);

      if (incomingId && existingId === incomingId) return true;

      // Replace a temporary optimistic message with the saved server message.
      const temporary = existingId.startsWith("temp-");
      const sameSender =
        String(getUserId(item?.sender) || "") ===
        String(getUserId(message?.sender) || "");

      const sameText = getMessageText(item) === getMessageText(message);

      const timeDifference = Math.abs(
        new Date(item?.createdAt || Date.now()).getTime() -
          new Date(message?.createdAt || Date.now()).getTime()
      );

      return temporary && sameSender && sameText && timeDifference < 15000;
    });

    if (index >= 0) {
      combined[index] = {
        ...combined[index],
        ...message,
      };
    } else {
      combined.push(message);
    }
  }

  return combined.sort((a, b) => {
    const first = new Date(a?.createdAt || a?.sentAt || 0).getTime();
    const second = new Date(b?.createdAt || b?.sentAt || 0).getTime();
    return first - second;
  });
}

function getInitials(name) {
  if (!name) return "A";

  return (
    name
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

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";

  const now = new Date();

  if (parsed.toDateString() === now.toDateString()) {
    return parsed.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatTime(date) {
  if (!date) return "";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

async function apiRequest(endpoint, options = {}) {
  const token = getStoredToken();

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const headers = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(isFormData || !options.body
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
  } catch {}

  if (!response.ok) {
    const error = new Error(
      data?.message ||
        data?.error ||
        `Request failed with status ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

async function safeApiRequest(endpoint) {
  try {
    return await apiRequest(endpoint, { method: "GET" });
  } catch (error) {
    if (error?.status === 401) throw error;
    return null;
  }
}

async function getConversationMessages(conversationId) {
  if (!conversationId || conversationId === DEFAULT_CONVERSATION_ID) {
    return { messages: [] };
  }

  return apiRequest(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    { method: "GET" }
  );
}

async function markConversationRead(conversationId) {
  if (!conversationId || conversationId === DEFAULT_CONVERSATION_ID) return;

  return apiRequest(
    `/conversations/${encodeURIComponent(conversationId)}/read`,
    { method: "PUT" }
  );
}

function playNotificationSound(audioContextRef) {
  try {
    if (typeof window === "undefined") return;

    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    const context = audioContextRef.current;

    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);

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
  } catch (error) {
    console.warn("Notification sound unavailable:", error);
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
    const notification = new Notification(title || "New message", {
      body: body || "You received a new message.",
      icon: "/favicon.ico",
      tag: "localpro-user-chat",
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (error) {
    console.warn("Desktop notification unavailable:", error);
  }
}

export default function UserMessagesPage() {
  const [conversations, setConversations] = useState(() => {
    try {
      const cached = localStorage.getItem("cached_user_admin_chats");
      if (cached) return JSON.parse(cached);
    } catch {}

    return [DEFAULT_CONVERSATION];
  });

  const [selectedConversation, setSelectedConversation] = useState(() => {
    try {
      const cached = localStorage.getItem("cached_user_admin_chats");
      const parsed = cached ? JSON.parse(cached) : [];
      return parsed[0] || DEFAULT_CONVERSATION;
    } catch {
      return DEFAULT_CONVERSATION;
    }
  });

  const [messages, setMessages] = useState(() => {
    try {
      const cached = localStorage.getItem(
        `cached_user_messages_${DEFAULT_CONVERSATION_ID}`
      );
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [messagesError, setMessagesError] = useState("");
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported"
  );

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const cached = localStorage.getItem("user");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [deletingMessage, setDeletingMessage] = useState(false);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const selectedConversationIdRef = useRef(DEFAULT_CONVERSATION_ID);
  const currentUserRef = useRef(null);
  const conversationsRef = useRef([]);
  const messagesCache = useRef({});
  const loadMessagesRequestRef = useRef(0);
  const conversationsRequestRef = useRef(false);
  const processedMessageIdsRef = useRef(new Set());
  const notificationAudioRef = useRef(null);
  const notificationPermissionRequestedRef = useRef(false);

  const selectedConversationId = getConversationId(selectedConversation);

  const scrollToBottom = useCallback((instant = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: instant ? "auto" : "smooth",
    });
  }, []);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    selectedConversationIdRef.current =
      selectedConversationId || DEFAULT_CONVERSATION_ID;
  }, [selectedConversationId]);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom(false);
  }, [messages, scrollToBottom]);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    } catch {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (
      "Notification" in window &&
      Notification.permission === "default" &&
      !notificationPermissionRequestedRef.current
    ) {
      notificationPermissionRequestedRef.current = true;

      // Permission prompts may be blocked by browsers unless initiated
      // by a user gesture. The bell button below is the fallback.
      Notification.requestPermission()
        .then(setNotificationPermission)
        .catch(() => {});
    }
  }, []);

  const loadConversations = useCallback(async (silent = false) => {
    if (conversationsRequestRef.current) return;

    conversationsRequestRef.current = true;

    try {
      if (!silent && conversationsRef.current.length === 0) {
        setLoading(true);
      }

      setError("");

      let user = currentUserRef.current;
      let response;

      if (!user) {
        const [meResponse, conversationsResponse] = await Promise.all([
          authService.me().catch(() => null),
          safeApiRequest("/conversations"),
        ]);

        user = extractUser(meResponse);
        response = conversationsResponse;

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

      const rawConversations = normalizeConversations(response);

      const adminConversations = rawConversations.filter((conversation) => {
        return Boolean(getConversationId(conversation));
      });

      const finalConversations =
        adminConversations.length > 0
          ? adminConversations
          : [DEFAULT_CONVERSATION];

      conversationsRef.current = finalConversations;
      setConversations(finalConversations);

      try {
        localStorage.setItem(
          "cached_user_admin_chats",
          JSON.stringify(finalConversations)
        );
      } catch {}

      setSelectedConversation((previous) => {
        const previousId = getConversationId(previous);

        if (previousId) {
          const matching = finalConversations.find(
            (item) =>
              String(getConversationId(item)) === String(previousId)
          );

          if (matching) return matching;
        }

        return finalConversations[0] || null;
      });
    } catch (err) {
      console.error("User conversations error:", err);

      if (err?.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!silent) {
        setError(err?.message || "Unable to load conversations.");
      }
    } finally {
      conversationsRequestRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations(false);
  }, [loadConversations]);

  const loadMessages = useCallback(async (conversationId, silent = false) => {
    if (!conversationId) {
      setMessages([]);
      setMessagesError("");
      setMessagesLoading(false);
      return;
    }

    const requestId = ++loadMessagesRequestRef.current;

    try {
      if (!silent) setMessagesLoading(true);
      setMessagesError("");

      const response = await getConversationMessages(conversationId);

      if (requestId !== loadMessagesRequestRef.current) return;

      const fetchedMessages = normalizeMessages(response);

      // Merge rather than overwrite so a socket message arriving during
      // a fetch is not lost when the fetch response returns.
      const currentMessages =
        messagesCache.current[conversationId] || [];

      const merged = mergeMessages(currentMessages, fetchedMessages);

      messagesCache.current[conversationId] = merged;

      if (
        String(selectedConversationIdRef.current) ===
        String(conversationId)
      ) {
        setMessages(merged);
      }

      try {
        localStorage.setItem(
          `cached_user_messages_${conversationId}`,
          JSON.stringify(merged)
        );
      } catch {}
    } catch (err) {
      if (requestId !== loadMessagesRequestRef.current) return;

      console.error("Load conversation messages error:", err);

      if (!silent) {
        setMessagesError(
          err?.message || "Unable to load conversation messages."
        );
      }
    } finally {
      if (requestId === loadMessagesRequestRef.current) {
        setMessagesLoading(false);
      }
    }
  }, []);

  const saveConversationMessages = useCallback((conversationId, nextMessages) => {
    if (!conversationId) return;

    messagesCache.current[conversationId] = nextMessages;

    try {
      localStorage.setItem(
        `cached_user_messages_${conversationId}`,
        JSON.stringify(nextMessages)
      );
    } catch {}

    if (
      String(selectedConversationIdRef.current) ===
      String(conversationId)
    ) {
      setMessages(nextMessages);
    }
  }, []);

  const handleIncomingMessage = useCallback(
    (incomingMessage) => {
      if (!incomingMessage || typeof incomingMessage !== "object") return;

      // Ignore socket events that are not actual message payloads.
      const messageId = getMessageId(incomingMessage);
      const conversationId = getMessageConversationId(incomingMessage);

      if (!conversationId) {
        console.warn(
          "Socket message has no conversation ID:",
          incomingMessage
        );
        return;
      }

      // Use IDs to deduplicate messages received through more than one
      // event name. Keep the set bounded to avoid unlimited memory growth.
      if (messageId) {
        if (processedMessageIdsRef.current.has(messageId)) return;

        processedMessageIdsRef.current.add(messageId);

        if (processedMessageIdsRef.current.size > 1500) {
          const oldest =
            processedMessageIdsRef.current.values().next().value;
          processedMessageIdsRef.current.delete(oldest);
        }
      }

      const activeConversationId =
        selectedConversationIdRef.current || "";

      const isActiveConversation =
        String(activeConversationId) === String(conversationId);

      const sender = incomingMessage.sender || {};
      const senderId = getUserId(sender);
      const currentUserId = getUserId(currentUserRef.current);

      const isOwnMessage = Boolean(
        senderId &&
          currentUserId &&
          String(senderId) === String(currentUserId)
      );

      const senderRole = String(sender?.role || "").toLowerCase();
      const isAdminSender = [
        "admin",
        "manager",
        "support",
      ].includes(senderRole);

      const isIncomingFromOtherUser = !isOwnMessage;

      const previousMessages =
        messagesCache.current[conversationId] || [];

      const mergedMessages = mergeMessages(previousMessages, [
        incomingMessage,
      ]);

      saveConversationMessages(conversationId, mergedMessages);

      const preview = getMessageText(incomingMessage);
      const messageTime =
        incomingMessage.createdAt || new Date().toISOString();

      setConversations((previous) => {
        const updated = previous.map((conversation) => {
          if (
            String(getConversationId(conversation)) !==
            String(conversationId)
          ) {
            return conversation;
          }

          const previousUnread = Number(
            conversation.unreadCount ||
              conversation.unread ||
              conversation.unreadMessages ||
              0
          );

          const unread = isActiveConversation
            ? 0
            : isOwnMessage
              ? previousUnread
              : previousUnread + 1;

          return {
            ...conversation,
            lastMessage: preview,
            lastMessageText: preview,
            lastMessageAt: messageTime,
            updatedAt: messageTime,
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
        } catch {}

        return updated;
      });

      const isPageVisible =
        typeof document !== "undefined" &&
        document.visibilityState === "visible";

      // Notify for messages sent by the admin/support side, not for
      // this user's own message echoed back by the server.
      if (isIncomingFromOtherUser && (isAdminSender || !isOwnMessage)) {
        const shouldNotify = !isActiveConversation || !isPageVisible;

        if (shouldNotify) {
          const title =
            sender?.name ||
            sender?.fullName ||
            sender?.email ||
            "Admin / Support";

          playNotificationSound(notificationAudioRef);
          showDesktopNotification(title, preview || "You received a message.");
        }
      }

      if (isActiveConversation && isIncomingFromOtherUser) {
        markConversationRead(conversationId).catch(() => {});

        setConversations((previous) => {
          const updated = previous.map((conversation) =>
            String(getConversationId(conversation)) ===
            String(conversationId)
              ? {
                  ...conversation,
                  unreadCount: 0,
                  unreadMessages: 0,
                  unreadMessageCount: 0,
                  unread: 0,
                }
              : conversation
          );

          conversationsRef.current = updated;
          return updated;
        });
      }

      // Refresh the conversation preview/unread data from the API.
      // Message display itself is updated immediately by the socket.
      loadConversations(true);
    },
    [loadConversations, saveConversationMessages]
  );

  useEffect(() => {
    const conversationId =
      selectedConversationId || DEFAULT_CONVERSATION_ID;

    selectedConversationIdRef.current = conversationId;

    if (!conversationId) {
      ++loadMessagesRequestRef.current;
      setMessages([]);
      setMessagesError("");
      setMessagesLoading(false);
      return;
    }

    const cached = messagesCache.current[conversationId];

    if (cached) {
      setMessages(cached);
      setMessagesLoading(false);
    } else {
      try {
        const local = localStorage.getItem(
          `cached_user_messages_${conversationId}`
        );

        if (local) {
          const parsed = JSON.parse(local);
          messagesCache.current[conversationId] = parsed;
          setMessages(parsed);
          setMessagesLoading(false);
        } else {
          setMessages([]);
        }
      } catch {
        setMessages([]);
      }
    }

    loadMessages(conversationId, Boolean(cached));
  }, [selectedConversationId, loadMessages]);

  useEffect(() => {
    const socket = io(BACKEND_BASE_URL, {
      auth: { token: getStoredToken() },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 20000,
    });

    socketRef.current = socket;

    const joinSelectedRoom = () => {
      const conversationId = selectedConversationIdRef.current;

      if (conversationId) {
        socket.emit("join_room", conversationId);
        // Compatibility with backends using the older event name.
        socket.emit("join", conversationId);
      }

      const userId = getUserId(currentUserRef.current);

      if (userId) {
        socket.emit("user_join", userId);
      }
    };

    const onConnectError = (socketError) => {
      console.warn("Chat socket connection error:", socketError?.message);
    };

    socket.on("connect", joinSelectedRoom);
    socket.on("connect_error", onConnectError);

    // The backend may emit one of these names. The handler deduplicates
    // saved messages by their ID.
    socket.on("receive_message", handleIncomingMessage);
    socket.on("new_message", handleIncomingMessage);
    socket.on("message", handleIncomingMessage);

    return () => {
      socket.off("connect", joinSelectedRoom);
      socket.off("connect_error", onConnectError);
      socket.off("receive_message", handleIncomingMessage);
      socket.off("new_message", handleIncomingMessage);
      socket.off("message", handleIncomingMessage);
      socket.disconnect();

      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [handleIncomingMessage]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !selectedConversationId) return;

    const joinSelectedRoom = () => {
      socket.emit("join_room", selectedConversationId);
      socket.emit("join", selectedConversationId);
    };

    if (socket.connected) {
      joinSelectedRoom();
    } else {
      socket.once("connect", joinSelectedRoom);
    }

    return () => {
      socket.off("connect", joinSelectedRoom);
    };
  }, [selectedConversationId]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;

    return conversations.filter((conversation) => {
      const name = getParticipantName(conversation, currentUser);
      const email = getParticipantEmail(conversation, currentUser);
      const role = getParticipantRole(conversation, currentUser);
      const lastMessage = String(
        conversation?.lastMessage ||
          conversation?.lastMessageText ||
          conversation?.preview ||
          ""
      );

      return `${name} ${email} ${role} ${lastMessage}`
        .toLowerCase()
        .includes(query);
    });
  }, [conversations, search, currentUser]);

  function handleFileChange(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setSelectedFiles((previous) => [...previous, ...files].slice(0, 5));

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

    const conversationId =
      getConversationId(conversation) || DEFAULT_CONVERSATION_ID;

    setSelectedFiles([]);
    setMessagesError("");
    setSelectedConversation(conversation);
    selectedConversationIdRef.current = conversationId;

    const cached = messagesCache.current[conversationId];

    if (cached) {
      setMessages(cached);
    } else {
      try {
        const local = localStorage.getItem(
          `cached_user_messages_${conversationId}`
        );

        if (local) {
          const parsed = JSON.parse(local);
          messagesCache.current[conversationId] = parsed;
          setMessages(parsed);
        } else {
          setMessages([]);
        }
      } catch {
        setMessages([]);
      }
    }

    if (socketRef.current?.connected) {
      socketRef.current.emit("join_room", conversationId);
      socketRef.current.emit("join", conversationId);
    }

    const unreadCount = Number(
      conversation?.unreadCount ||
        conversation?.unreadMessages ||
        conversation?.unread ||
        0
    );

    if (unreadCount > 0 && conversationId !== DEFAULT_CONVERSATION_ID) {
      try {
        await markConversationRead(conversationId);

        setConversations((previous) => {
          const updated = previous.map((item) =>
            String(getConversationId(item)) === String(conversationId)
              ? {
                  ...item,
                  unreadCount: 0,
                  unreadMessages: 0,
                  unreadMessageCount: 0,
                  unread: 0,
                }
              : item
          );

          conversationsRef.current = updated;
          return updated;
        });
      } catch (readError) {
        console.warn("Could not mark conversation as read:", readError);
      }
    }
  }

  async function handleSendMessage(event) {
    event?.preventDefault();

    const body = message.trim();
    const conversationId =
      getConversationId(selectedConversation) || DEFAULT_CONVERSATION_ID;

    if ((!body && selectedFiles.length === 0) || sending) return;

    const contact = getOtherParticipant(selectedConversation, currentUser);
    const recipientId = getUserId(contact);
    const tempId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const filesToSend = [...selectedFiles];

    const optimisticMessage = {
      _id: tempId,
      id: tempId,
      conversationId,
      body,
      message: body,
      sender: currentUser || { role: "user", name: "You" },
      createdAt: new Date().toISOString(),
      attachments: filesToSend.map((file) => ({
        filename: file.name,
        originalName: file.name,
        mimeType: file.type,
        url: URL.createObjectURL(file),
      })),
      sending: true,
    };

    const currentMessages =
      messagesCache.current[conversationId] || messages;

    saveConversationMessages(
      conversationId,
      mergeMessages(currentMessages, [optimisticMessage])
    );

    setMessage("");
    setSelectedFiles([]);
    setSending(true);
    setMessagesError("");
    scrollToBottom(true);

    try {
      let response;

      if (filesToSend.length > 0) {
        const formData = new FormData();

        formData.append("body", body);
        formData.append("message", body);
        formData.append("recipientId", String(recipientId || ""));
        formData.append("conversationId", String(conversationId));

        filesToSend.forEach((file) => {
          formData.append("files", file);
        });

        const res = await fetch(`${API_URL}/messages`, {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            ...(getStoredToken()
              ? { Authorization: `Bearer ${getStoredToken()}` }
              : {}),
          },
          body: formData,
        });

        let responseData = null;

        try {
          const text = await res.text();
          if (text) responseData = JSON.parse(text);
        } catch {}

        if (!res.ok) {
          throw new Error(
            responseData?.message || "Failed to send attachment."
          );
        }

        response = responseData;
      } else {
        response =
          conversationId === DEFAULT_CONVERSATION_ID && recipientId
            ? await apiRequest("/messages", {
                method: "POST",
                body: JSON.stringify({
                  recipientId,
                  body,
                  message: body,
                }),
              })
            : await apiRequest(
                `/conversations/${encodeURIComponent(
                  conversationId
                )}/messages`,
                {
                  method: "POST",
                  body: JSON.stringify({
                    body,
                    message: body,
                    messageType: "text",
                    channel: "chat",
                    direction: "internal",
                    recipientId,
                  }),
                }
              ).catch(() => {
                if (!recipientId) throw new Error("Recipient not found.");

                return apiRequest("/messages", {
                  method: "POST",
                  body: JSON.stringify({
                    recipientId,
                    conversationId,
                    body,
                    message: body,
                  }),
                });
              });
      }

      const sentMessage =
        response?.data?.message ||
        response?.data?.data ||
        response?.data ||
        response?.messageData ||
        response?.message ||
        null;

      const normalizedSentMessage =
        sentMessage && typeof sentMessage === "object"
          ? {
              ...sentMessage,
              conversationId:
                getMessageConversationId(sentMessage) || conversationId,
            }
          : null;

      const latest =
        messagesCache.current[conversationId] || [];

      if (normalizedSentMessage) {
        saveConversationMessages(
          conversationId,
          mergeMessages(
            latest.filter(
              (item) => getMessageId(item) !== String(tempId)
            ),
            [normalizedSentMessage]
          )
        );
      } else {
        saveConversationMessages(
          conversationId,
          latest.map((item) =>
            getMessageId(item) === String(tempId)
              ? { ...item, sending: false }
              : item
          )
        );
      }

      await loadConversations(true);
    } catch (err) {
      console.error("Send message error:", err);
      setMessagesError(err?.message || "Unable to send message.");

      const latest = messagesCache.current[conversationId] || [];

      saveConversationMessages(
        conversationId,
        latest.filter((item) => getMessageId(item) !== String(tempId))
      );

      setMessage(body);
      setSelectedFiles(filesToSend);
    } finally {
      setSending(false);
    }
  }

  function promptDeleteMessage(item) {
    setMessageToDelete(item);
    setDeleteModalOpen(true);
  }

  async function executeDeleteMessage(type) {
    if (!messageToDelete) return;

    const messageId = getMessageId(messageToDelete);

    if (!messageId || messageId.startsWith("temp-")) return;

    try {
      setDeletingMessage(true);

      const endpoint =
        type === "everyone"
          ? `/messages/${encodeURIComponent(
              messageId
            )}/delete-for-everyone`
          : `/messages/${encodeURIComponent(messageId)}/delete-for-me`;

      const response = await apiRequest(endpoint, { method: "POST" });
      const conversationId =
        getConversationId(selectedConversation) || DEFAULT_CONVERSATION_ID;

      const latest = messagesCache.current[conversationId] || messages;
      const serverMessage = response?.data?.message || response?.data;

      const updated =
        type === "me"
          ? latest.filter((item) => getMessageId(item) !== messageId)
          : latest.map((item) => {
              if (getMessageId(item) !== messageId) return item;

              return {
                ...item,
                ...(serverMessage && typeof serverMessage === "object"
                  ? serverMessage
                  : {}),
                body: "This message was deleted",
                message: "This message was deleted",
                isDeletedForEveryone: true,
                attachments: [],
              };
            });

      saveConversationMessages(conversationId, updated);

      setDeleteModalOpen(false);
      setMessageToDelete(null);

      await loadConversations(true);
    } catch (deleteError) {
      console.error("Delete message failed:", deleteError);
      alert(deleteError?.message || "Failed to delete message.");
    } finally {
      setDeletingMessage(false);
    }
  }

  const selectedName = selectedConversation
    ? getParticipantName(selectedConversation, currentUser)
    : "";

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
                </div>

                {notificationPermission !== "granted" &&
                  notificationPermission !== "unsupported" && (
                    <button
                      type="button"
                      onClick={requestNotificationPermission}
                      title="Enable desktop notifications"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-100 bg-white text-violet-600 hover:bg-violet-50"
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
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search admin chats..."
                  className="h-10 w-full rounded-2xl border border-slate-200/90 bg-white pl-9 pr-3 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {loading && conversations.length === 0 ? (
                <ConversationLoading />
              ) : filteredConversations.length > 0 ? (
                filteredConversations.map((conversation, index) => {
                  const id = getConversationId(conversation);
                  const participant = getOtherParticipant(
                    conversation,
                    currentUser
                  );
                  const participantId = getUserId(participant);
                  const name = getParticipantName(conversation, currentUser);
                  const avatar = getParticipantAvatar(
                    conversation,
                    currentUser
                  );
                  const lastMessage =
                    conversation?.lastMessage ||
                    conversation?.lastMessageText ||
                    conversation?.preview ||
                    "No messages yet";
                  const unread = Number(
                    conversation?.unreadCount ||
                      conversation?.unreadMessages ||
                      conversation?.unread ||
                      0
                  );
                  const active =
                    String(selectedConversationId || "") === String(id || "");

                  return (
                    <button
                      key={id || participantId || `contact-${index}`}
                      type="button"
                      onClick={() => handleSelectConversation(conversation)}
                      className={`flex w-full items-start gap-3 border-b border-slate-100/80 px-4 py-3.5 text-left transition duration-150 ${
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
                            className={`truncate text-xs ${
                              unread > 0
                                ? "font-bold text-slate-900"
                                : "font-bold text-slate-800"
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
                          {lastMessage}
                        </p>
                      </div>
                    </button>
                  );
                })
              ) : (
                <EmptyConversationList search={search} loading={loading} />
              )}
            </div>
          </aside>

          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5 sm:px-6">
              {selectedConversation ? (
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-md shadow-purple-500/10">
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
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
                    <MessageSquare size={17} />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-900">
                      Select admin chat
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Choose from list
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6">
              {!selectedConversation ? (
                <NoConversationSelected />
              ) : messagesLoading && messages.length === 0 ? (
                <MessagesLoading />
              ) : messagesError && messages.length === 0 ? (
                <MessageError message={messagesError} />
              ) : messages.length === 0 ? (
                messagesError ? (
                  <MessageError message={messagesError} />
                ) : (
                  <NoMessages />
                )
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
                        <ImageIcon size={14} className="text-violet-600" />
                      ) : (
                        <File size={14} className="text-violet-600" />
                      )}
                      <span className="max-w-[150px] truncate font-semibold">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(index)}
                        className="ml-1 rounded-md text-violet-400 hover:bg-violet-200/50 hover:text-rose-600"
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
                  onChange={handleFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!selectedConversation || sending}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-slate-50/50 text-slate-500 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Attach file"
                >
                  <Paperclip size={18} />
                </button>

                <div className="min-w-0 flex-1">
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();

                        if (
                          (message.trim() || selectedFiles.length > 0) &&
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
                        : "Select chat first..."
                    }
                    rows={1}
                    disabled={!selectedConversation || sending}
                    className="min-h-11 max-h-32 w-full resize-none rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 py-3 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    (!message.trim() && selectedFiles.length === 0) ||
                    !selectedConversation ||
                    sending
                  }
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-600/25 transition duration-150 hover:-translate-y-0.5 hover:bg-violet-700 active:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                  aria-label="Send message"
                >
                  {sending ? (
                    <Loader2 size={17} className="animate-spin" />
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
        <div className="fixed inset-0 z-50 flex animate-fadeIn items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
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

            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs italic text-slate-600">
              &ldquo;
              {messageToDelete?.isDeletedForEveryone
                ? "This message was deleted"
                : messageToDelete?.body ||
                  messageToDelete?.message ||
                  "Message"}
              &rdquo;
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              {String(getUserId(messageToDelete?.sender)) ===
                String(getUserId(currentUser)) &&
                !messageToDelete?.isDeletedForEveryone && (
                  <button
                    type="button"
                    disabled={deletingMessage}
                    onClick={() => executeDeleteMessage("everyone")}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 text-xs font-bold text-white shadow-md shadow-rose-600/20 transition hover:bg-rose-700 disabled:opacity-50"
                  >
                    {deletingMessage ? (
                      <Loader2 size={15} className="animate-spin" />
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
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {deletingMessage ? (
                  <Loader2 size={15} className="animate-spin" />
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
                className="mt-1 h-9 w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600 disabled:opacity-50"
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

function MessageBubble({ message, currentUser, onDeletePrompt }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const senderId = getUserId(message?.sender);
  const currentUserId = getUserId(currentUser);

  const isOutgoing = Boolean(
    senderId &&
      currentUserId &&
      String(senderId) === String(currentUserId)
  );

  const isDeleted = Boolean(message?.isDeletedForEveryone);
  const body = isDeleted
    ? "This message was deleted"
    : message?.body || message?.message || "";
  const sender = message?.sender?.name || message?.senderName || "";

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <div
      className={`group relative flex w-full items-center gap-2.5 ${
        isOutgoing ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`relative ${
          isOutgoing ? "order-2" : "order-1"
        } opacity-0 transition-opacity group-hover:opacity-100`}
        ref={menuRef}
      >
        {!isDeleted && (
          <>
            <button
              type="button"
              onClick={() => setMenuOpen((previous) => !previous)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Message options"
            >
              <MoreVertical size={14} />
            </button>

            {menuOpen && (
              <div
                className={`absolute bottom-full z-20 mb-1 w-40 overflow-hidden rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl ${
                  isOutgoing ? "right-0" : "left-0"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDeletePrompt(message);
                  }}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                >
                  <Trash2 size={13} />
                  {isOutgoing ? "Delete Message" : "Delete for Me"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div
        className={`max-w-[82%] rounded-[20px] px-4 py-3 shadow-sm sm:max-w-[72%] ${
          isOutgoing ? "order-2" : "order-1"
        } ${
          isDeleted
            ? "border border-slate-200/80 bg-slate-50 italic text-slate-400"
            : isOutgoing
              ? "rounded-tr-xs bg-violet-600 text-white shadow-violet-600/15"
              : "rounded-tl-xs border border-slate-100 bg-white text-slate-800 shadow-[0_4px_20px_rgba(45,35,100,0.03)]"
        }`}
      >
        {!isOutgoing && sender && !isDeleted && (
          <p className="mb-1 text-[10px] font-bold text-violet-600">
            {sender}
          </p>
        )}

        {isDeleted ? (
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

        {!isDeleted &&
          Array.isArray(message?.attachments) &&
          message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((attachment, index) => {
                const mime = String(
                  attachment?.mimeType || attachment?.fileType || ""
                ).toLowerCase();

                const isImage = mime.startsWith("image/");
                const fullUrl = getFileUrl(attachment?.url);

                if (isImage && fullUrl !== "#") {
                  return (
                    <a
                      key={attachment?.url || index}
                      href={fullUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm transition hover:opacity-95"
                    >
                      <img
                        src={fullUrl}
                        alt={
                          attachment?.originalName ||
                          attachment?.filename ||
                          "Attached Image"
                        }
                        loading="lazy"
                        className="max-h-60 w-auto rounded-xl object-contain"
                      />
                    </a>
                  );
                }

                return (
                  <a
                    key={attachment?.url || index}
                    href={fullUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-bold shadow-sm transition ${
                      isOutgoing
                        ? "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                        : "border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <FileText size={15} className="shrink-0 text-violet-600" />
                    <span className="max-w-[200px] truncate">
                      {attachment?.originalName ||
                        attachment?.filename ||
                        "Attached Document"}
                    </span>
                  </a>
                );
              })}
            </div>
          )}

        <div
          className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${
            isDeleted
              ? "text-slate-400"
              : isOutgoing
                ? "text-violet-200"
                : "text-slate-400"
          }`}
        >
          <span>{formatTime(message?.createdAt || message?.sentAt)}</span>
          {isOutgoing && !isDeleted && <CheckCheck size={12} />}
        </div>
      </div>
    </div>
  );
}

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
            : "No admin conversation was returned by the server."}
      </p>
    </div>
  );
}

function NoConversationSelected() {
  return (
    <div className="flex h-full min-h-[380px] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
        <MessageSquare size={26} />
      </div>
      <h3 className="mt-4 text-sm font-bold text-slate-900">
        Select admin chat
      </h3>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">
        Choose a conversation from the list.
      </p>
    </div>
  );
}

function NoMessages() {
  return (
    <div className="flex h-full min-h-[380px] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
        <MessageSquare size={26} />
      </div>
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
      <Loader2 size={26} className="animate-spin text-violet-600" />
      <p className="mt-3 text-xs font-semibold text-slate-500">
        Loading chats...
      </p>
    </div>
  );
}

function MessagesLoading() {
  return (
    <div className="flex h-full min-h-[380px] flex-col items-center justify-center text-center">
      <Loader2 size={32} className="animate-spin text-violet-600" />
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
