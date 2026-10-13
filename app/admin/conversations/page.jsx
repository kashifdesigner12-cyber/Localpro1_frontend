
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
} from "lucide-react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";

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
    value.startsWith("https://") ||
    value.startsWith("blob:") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  return `${BACKEND_BASE_URL}${
    value.startsWith("/") ? "" : "/"
  }${value}`;
};

/* ============================================================
   TOKEN HELPERS
============================================================ */

const normalizeTokenValue = (value) => {
  if (!value) return null;

  let rawValue = String(value).trim();

  if (!rawValue) return null;

  if (/^Bearer\s+/i.test(rawValue)) {
    rawValue = rawValue.replace(/^Bearer\s+/i, "").trim();
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (typeof parsed === "string") {
      return parsed.replace(/^Bearer\s+/i, "").trim() || null;
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
    .map((part) => part.charAt(0).toUpperCase())
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
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.users?.data)) return data.users.data;

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

const getUnreadCount = (conversation) => {
  if (!conversation) return 0;

  const possibleValues = [
    conversation?.unreadCount,
    conversation?.unreadMessages,
    conversation?.unread,
    conversation?.unreadMessageCount,
  ];

  for (const value of possibleValues) {
    if (typeof value === "number" && value > 0) {
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

const getConversationLastMessage = (conversation) => {
  if (!conversation) return "";

  return (
    conversation?.lastMessage ||
    conversation?.lastMessageText ||
    conversation?.latestMessage?.body ||
    conversation?.latestMessage?.message ||
    ""
  );
};

const getConversationLastDate = (conversation) => {
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

const extractMessages = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.messages)) return data.messages;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.messages)) return data.data.messages;
  if (Array.isArray(data?.conversation?.messages)) {
    return data.conversation.messages;
  }

  return [];
};

const getConversationIdFromMessage = (incomingMsg) => {
  const value =
    incomingMsg?.conversationId ||
    incomingMsg?.conversation?._id ||
    incomingMsg?.conversation?.id ||
    incomingMsg?.conversation;

  if (value && typeof value === "object") {
    return value._id || value.id || null;
  }

  return value || null;
};

/* ============================================================
   NOTIFICATIONS
============================================================ */

const playMessageNotificationSound = () => {
  try {
    if (typeof window === "undefined") return;

    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();

    const playTone = () => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(
        880,
        audioContext.currentTime
      );

      gain.gain.setValueAtTime(
        0.0001,
        audioContext.currentTime
      );
      gain.gain.exponentialRampToValueAtTime(
        0.12,
        audioContext.currentTime + 0.02
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + 0.25
      );

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.26);

      oscillator.onended = () => {
        audioContext.close().catch(() => {});
      };
    };

    if (audioContext.state === "suspended") {
      audioContext
        .resume()
        .then(playTone)
        .catch(() => audioContext.close().catch(() => {}));
    } else {
      playTone();
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
   MAIN COMPONENT
============================================================ */

export default function AdminConversationsPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [isClient, setIsClient] = useState(false);

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
  const [messagesError, setMessagesError] = useState("");

  const [onlineUsers, setOnlineUsers] = useState({});

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  const selectedConversationIdRef = useRef(null);
  const conversationsRef = useRef(conversations);
  const usersRef = useRef(users);
  const messagesRef = useRef(messages);
  const messagesCache = useRef({});

  // Track socket message IDs to avoid processing duplicate events.
  const processedSocketMessages = useRef(new Set());

  /* ==========================================================
     INITIAL LOAD AND BROWSER NOTIFICATION PERMISSION
  ========================================================== */

  useEffect(() => {
    setIsClient(true);

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      // Permission is requested only after the browser allows it.
      // Some browsers require a direct user gesture.
      Notification.requestPermission().catch(() => {});
    }

    try {
      const cachedUsers = localStorage.getItem("localpro_admin_users");
      const cachedConvs = localStorage.getItem("localpro_admin_convs");
      const cachedMsgs = localStorage.getItem("localpro_admin_msgs");

      if (cachedUsers) {
        const parsedUsers = JSON.parse(cachedUsers);
        if (Array.isArray(parsedUsers)) {
          setUsers(parsedUsers);
          usersRef.current = parsedUsers;
        }
      }

      if (cachedConvs) {
        const parsedConvs = JSON.parse(cachedConvs);
        if (Array.isArray(parsedConvs)) {
          setConversations(parsedConvs);
          conversationsRef.current = parsedConvs;
          setLoadingUsers(false);
        }
      }

      if (cachedMsgs) {
        const parsedMsgs = JSON.parse(cachedMsgs);
        if (parsedMsgs && typeof parsedMsgs === "object") {
          messagesCache.current = parsedMsgs;
        }
      }
    } catch (error) {
      console.warn("Unable to restore chat cache:", error);
    }
  }, []);

  const saveCache = useCallback((uList, cList, mCache) => {
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
        localStorage.setItem(
          "localpro_admin_msgs",
          JSON.stringify(mCache)
        );
      }
    } catch {}
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
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  const scrollToBottom = useCallback((instant = false) => {
    if (!messagesEndRef.current) return;

    messagesEndRef.current.scrollIntoView({
      behavior: instant ? "auto" : "smooth",
    });
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(false);
    }
  }, [messages, scrollToBottom]);

  /* ==========================================================
     SOCKET.IO REAL-TIME SETUP
  ========================================================== */

  useEffect(() => {
    if (!isClient) return undefined;

    const token = getStoredToken();

    const socket = io(BACKEND_BASE_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 20000,
    });

    socketRef.current = socket;

    const handleIncomingMessage = (incomingMsg) => {
      if (!incomingMsg) return;

      const incomingConvId = getConversationIdFromMessage(incomingMsg);

      if (!incomingConvId) {
        console.warn(
          "Socket message did not include a conversation ID:",
          incomingMsg
        );
        return;
      }

      const conversationId = String(incomingConvId);
      const incomingId = String(
        incomingMsg._id || incomingMsg.id || ""
      );

      // Ignore the same database message if delivered by both event names.
      if (incomingId) {
        if (processedSocketMessages.current.has(incomingId)) {
          return;
        }

        processedSocketMessages.current.add(incomingId);

        if (processedSocketMessages.current.size > 1000) {
          const oldestId =
            processedSocketMessages.current.values().next().value;

          processedSocketMessages.current.delete(oldestId);
        }
      }

      const sender = incomingMsg.sender;
      const senderRole = String(sender?.role || "").toLowerCase();
      const isFromAdmin =
        senderRole === "admin" ||
        sender?.name === "You";

      const activeConversationId = String(
        selectedConversationIdRef.current || ""
      );

      const isActiveConversation =
        activeConversationId === conversationId;

      // Update the open chat immediately without a page refresh.
      if (isActiveConversation) {
        setMessages((previousMessages) => {
          const alreadyExists = previousMessages.some((item) => {
            const existingId = String(item?._id || item?.id || "");

            if (incomingId && existingId === incomingId) {
              return true;
            }

            return (
              existingId.startsWith("temp-") &&
              item?.body === (incomingMsg.body || incomingMsg.message) &&
              String(
                item?.sender?._id ||
                item?.sender?.id ||
                item?.sender ||
                ""
              ) ===
                String(
                  sender?._id ||
                  sender?.id ||
                  sender ||
                  ""
                )
            );
          });

          let updatedMessages;

          if (alreadyExists) {
            updatedMessages = previousMessages.map((item) => {
              const existingId = String(item?._id || item?.id || "");

              if (
                existingId.startsWith("temp-") &&
                item?.body === (incomingMsg.body || incomingMsg.message)
              ) {
                return incomingMsg;
              }

              return item;
            });
          } else {
            updatedMessages = [...previousMessages, incomingMsg];
          }

          messagesCache.current[conversationId] = updatedMessages;

          saveCache(
            usersRef.current,
            conversationsRef.current,
            messagesCache.current
          );

          return updatedMessages;
        });
      } else {
        // Update cached messages for a conversation that is not open.
        const cached = messagesCache.current[conversationId];

        if (Array.isArray(cached) && incomingId) {
          const alreadyCached = cached.some(
            (item) =>
              String(item?._id || item?.id || "") === incomingId
          );

          if (!alreadyCached) {
            messagesCache.current[conversationId] = [
              ...cached,
              incomingMsg,
            ];
          }
        }
      }

      // Update conversation preview and unread badges immediately.
      setConversations((previousConversations) => {
        const foundConversation = previousConversations.some(
          (conversation) =>
            String(conversation?._id || conversation?.id || "") ===
            conversationId
        );

        const updatedConversations = previousConversations.map(
          (conversation) => {
            const existingConversationId = String(
              conversation?._id || conversation?.id || ""
            );

            if (existingConversationId !== conversationId) {
              return conversation;
            }

            const previousUnread = getUnreadCount(conversation);

            // Messages sent by the admin should not increase the admin's
            // own unread badge.
            const nextUnread = isActiveConversation
              ? 0
              : isFromAdmin
              ? previousUnread
              : previousUnread + 1;

            return {
              ...conversation,
              lastMessage:
                incomingMsg.body ||
                incomingMsg.message ||
                (incomingMsg.attachments?.length
                  ? "Attachment"
                  : conversation.lastMessage || ""),
              lastMessageAt:
                incomingMsg.createdAt || new Date().toISOString(),
              updatedAt:
                incomingMsg.createdAt || new Date().toISOString(),
              unreadCount: nextUnread,
              unreadMessages: nextUnread,
              unread: nextUnread,
              unreadMessageCount: nextUnread,
            };
          }
        );

        // If this conversation is not currently in the list, fetchData()
        // below will refresh it from the server.
        conversationsRef.current = updatedConversations;

        if (foundConversation) {
          saveCache(
            usersRef.current,
            updatedConversations,
            messagesCache.current
          );
        }

        return updatedConversations;
      });

      // Admin notifications are for messages sent by a non-admin.
      if (!isFromAdmin) {
        const shouldNotify =
          !isActiveConversation ||
          document.visibilityState !== "visible";

        if (shouldNotify) {
          const senderTitle = getUserName(sender) || "New Message";
          const messageBody =
            incomingMsg.body ||
            incomingMsg.message ||
            "You received a file or attachment.";

          playMessageNotificationSound();
          showMessageDesktopNotification(senderTitle, messageBody);
        }
      }

      // Mark incoming messages as read when the relevant conversation is open.
      if (isActiveConversation && !isFromAdmin) {
        fetch(
          getApiUrl(`/conversations/${conversationId}/read`),
          {
            method: "PUT",
            credentials: "include",
            headers: getAuthHeaders(),
          }
        ).catch(() => {});
      }

      // Refresh the authoritative conversation list without reloading the page.
      // This also handles conversations that were not in the current list.
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          if (socketRef.current === socket) {
            // fetchData is attached to the socket below after it is declared.
            socket.emit("request_conversation_refresh");
          }
        }, 0);
      }
    };

    const handleUserStatus = ({ userId, status } = {}) => {
      if (!userId || !status) return;

      setOnlineUsers((previous) => ({
        ...previous,
        [userId]: status,
      }));
    };

    const handleConnect = () => {
      const activeId = selectedConversationIdRef.current;

      if (activeId) {
        socket.emit("join_room", activeId);
      }
    };

    socket.on("connect", handleConnect);
    socket.on("receive_message", handleIncomingMessage);
    socket.on("new_message", handleIncomingMessage);
    socket.on("update_user_status", handleUserStatus);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("receive_message", handleIncomingMessage);
      socket.off("new_message", handleIncomingMessage);
      socket.off("update_user_status", handleUserStatus);
      socket.disconnect();

      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [isClient, saveCache]);

  /* ==========================================================
     FETCH USERS AND CONVERSATIONS
  ========================================================== */

  const fetchData = useCallback(
    async (force = false) => {
      try {
        const response = await fetch(getApiUrl("/users"), {
          method: "GET",
          credentials: "include",
          headers: getAuthHeaders(),
          cache: force ? "no-store" : "default",
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const data = await parseResponse(response);

        if (response.ok) {
          const userData = normalizeUsers(data);

          const availableUsers = userData.filter((user) => {
            if (!user) return false;

            const role = String(user?.role || "").toLowerCase();

            return (
              role === "user" ||
              role === "manager" ||
              role === "admin"
            );
          });

          setUsers(availableUsers);
          usersRef.current = availableUsers;

          saveCache(
            availableUsers,
            conversationsRef.current,
            messagesCache.current
          );
        }
      } catch (error) {
        console.warn("Unable to refresh users:", error);
      }

      try {
        const response = await fetch(getApiUrl("/conversations"), {
          method: "GET",
          credentials: "include",
          headers: getAuthHeaders(),
          cache: "no-store",
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const data = await parseResponse(response);

        if (response.ok) {
          const conversationData = normalizeConversations(data);

          const updatedConversations = conversationData.map(
            (conversation) => {
              const conversationId =
                conversation?.id || conversation?._id;

              if (
                selectedConversationIdRef.current &&
                String(conversationId) ===
                  String(selectedConversationIdRef.current)
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

          setConversations(updatedConversations);
          conversationsRef.current = updatedConversations;

          saveCache(
            usersRef.current,
            updatedConversations,
            messagesCache.current
          );
        }
      } catch (error) {
        console.warn("Unable to refresh conversations:", error);
      } finally {
        setLoadingUsers(false);
      }
    },
    [router, saveCache]
  );

  // Keep the refresh function available to socket-driven updates.
  const fetchDataRef = useRef(fetchData);

  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  useEffect(() => {
    if (!isClient) return undefined;

    fetchData(false);

    // Socket.IO handles live messages; this is a fallback refresh only.
    const interval = setInterval(() => {
      fetchDataRef.current(true);
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchData, isClient]);

  /* ==========================================================
     CONVERSATION HELPERS
  ========================================================== */

  const findConversationForUser = useCallback((userId, list) => {
    if (!userId) return null;

    const convList = Array.isArray(list)
      ? list
      : conversationsRef.current;

    return (
      convList.find((conversation) => {
        if (conversation?.isGroup) return false;

        const participants = Array.isArray(conversation?.participants)
          ? conversation.participants
          : [];

        return participants.some((participant) => {
          const participantId = getId(participant);

          return (
            participantId &&
            String(participantId) === String(userId)
          );
        });
      }) || null
    );
  }, []);

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

        const messageData = extractMessages(data);

        if (
          String(conversationId) ===
          String(selectedConversationIdRef.current)
        ) {
          messagesCache.current[conversationId] = messageData;

          saveCache(
            usersRef.current,
            conversationsRef.current,
            messagesCache.current
          );

          setMessages(messageData);
        }

        return messageData;
      } catch (error) {
        if (!silent) {
          setMessagesError(
            error?.message || "Unable to load messages."
          );
        }

        return [];
      } finally {
        if (!silent) {
          setLoadingMessages(false);
        }
      }
    },
    [saveCache]
  );

  const openConversation = useCallback(
    async (conversation, user = null) => {
      const conversationId =
        conversation?.id || conversation?._id;

      if (!conversationId) return;

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
      }

      setConversations((previous) => {
        const updated = previous.map((item) => {
          const itemId = item?.id || item?._id;

          if (String(itemId) === String(conversationId)) {
            return {
              ...item,
              unreadCount: 0,
              unreadMessages: 0,
              unread: 0,
              unreadMessageCount: 0,
            };
          }

          return item;
        });

        conversationsRef.current = updated;

        saveCache(
          usersRef.current,
          updated,
          messagesCache.current
        );

        return updated;
      });

      setMessagesError("");
      setSelectedFiles([]);

      if (messagesCache.current[conversationId]) {
        setMessages(messagesCache.current[conversationId]);
        setLoadingMessages(false);
      } else {
        setMessages([]);
        setLoadingMessages(true);
      }

      // Join the conversation room when it is selected.
      if (socketRef.current?.connected) {
        socketRef.current.emit("join_room", conversationId);
      }

      await fetchMessages(conversationId, true);
      setLoadingMessages(false);

      try {
        await fetch(
          getApiUrl(`/conversations/${conversationId}/read`),
          {
            method: "PUT",
            credentials: "include",
            headers: getAuthHeaders(),
          }
        );
      } catch {}
    },
    [fetchMessages, saveCache]
  );

  const handleSelectUser = useCallback(
    async (user) => {
      const userId = getId(user);

      if (!userId) return;

      setSelectedUser(user);
      setMessagesError("");

      const existingConversation = findConversationForUser(
        userId,
        conversationsRef.current
      );

      if (existingConversation) {
        await openConversation(existingConversation, user);
        return;
      }

      setStartingConversation(true);

      try {
        const response = await fetch(getApiUrl("/conversations"), {
          method: "POST",
          credentials: "include",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            recipientId: userId,
          }),
        });

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

        const newConversationId =
          newConversation?.id || newConversation?._id;

        if (newConversationId) {
          setConversations((previous) => {
            const exists = previous.some(
              (item) =>
                String(item?.id || item?._id) ===
                String(newConversationId)
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
        }
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
     CREATE GROUP
  ========================================================== */

  const handleCreateGroup = async (event) => {
    event.preventDefault();

    if (!groupName.trim() || selectedGroupMembers.length === 0) {
      return;
    }

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

      if (!response.ok) {
        throw new Error(
          data?.message || "Failed to create group."
        );
      }

      const newGroupConv =
        data?.conversation ||
        data?.data?.conversation ||
        data?.data;

      if (newGroupConv) {
        setConversations((previous) => {
          const updated = [newGroupConv, ...previous];

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

        await openConversation(newGroupConv);
      }
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
        user?.email || ""
      }`.toLowerCase();

      return full.includes(query);
    });
  }, [users, search]);

  /* ==========================================================
     SEND MESSAGE
  ========================================================== */

  const handleSendMessage = async (event) => {
    event?.preventDefault();

    const cleanBody = message.trim();

    if (
      (!cleanBody && selectedFiles.length === 0) ||
      !selectedConversationId ||
      !selectedUser
    ) {
      return;
    }

    const conversationId = selectedConversationId;
    const recipientId = getId(selectedUser);
    const tempId = `temp-${Date.now()}`;
    const filesToSend = [...selectedFiles];

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
      })),
      status: "sending",
    };

    // Optimistic UI: show the message immediately.
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

    setMessage("");
    setSelectedFiles([]);
    scrollToBottom(true);

    try {
      let response;

      if (filesToSend.length > 0) {
        const formData = new FormData();

        formData.append("body", cleanBody);

        if (recipientId) {
          formData.append("recipientId", recipientId);
        }

        formData.append("conversationId", conversationId);

        filesToSend.forEach((file) => {
          formData.append("files", file);
        });

        const token = getStoredToken();
        const headers = { Accept: "application/json" };

        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        response = await fetch(getApiUrl("/messages"), {
          method: "POST",
          credentials: "include",
          headers,
          body: formData,
        });
      } else {
        response = await fetch(
          getApiUrl(`/conversations/${conversationId}/messages`),
          {
            method: "POST",
            credentials: "include",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              body: cleanBody,
              recipientId,
            }),
          }
        );
      }

      const data = await parseResponse(response);

      if (!response.ok) {
        throw new Error(
          data?.message || "Failed to send message."
        );
      }

      const confirmedMessage =
        data?.message ||
        data?.data?.message ||
        data?.data ||
        data?.messageData;

      if (
        confirmedMessage &&
        typeof confirmedMessage === "object"
      ) {
        const normalizedConfirmedMessage = {
          ...confirmedMessage,
          conversationId:
            getConversationIdFromMessage(confirmedMessage) ||
            conversationId,
          status: confirmedMessage.status || "sent",
        };

        setMessages((previous) => {
          const confirmedId = String(
            normalizedConfirmedMessage._id ||
            normalizedConfirmedMessage.id ||
            ""
          );

          const updated = previous.map((item) => {
            const itemId = String(item?._id || item?.id || "");

            if (itemId === tempId) {
              return normalizedConfirmedMessage;
            }

            if (confirmedId && itemId === confirmedId) {
              return normalizedConfirmedMessage;
            }

            return item;
          });

          messagesCache.current[conversationId] = updated;

          saveCache(
            usersRef.current,
            conversationsRef.current,
            messagesCache.current
          );

          return updated;
        });
      } else {
        await fetchMessages(conversationId, true);
      }

      // Refresh previews/unread counts after the server confirms the send.
      await fetchDataRef.current(true);
    } catch (error) {
      setMessagesError(
        `Message failed to sync: ${error?.message || "Error"}`
      );

      setMessages((previous) =>
        previous.filter(
          (item) => String(item?.id || item?._id) !== tempId
        )
      );
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
      const response = await fetch(
        getApiUrl(`/conversations/${selectedConversationId}`),
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

      const deletedId = selectedConversationId;

      setConversations((previous) => {
        const updated = previous.filter(
          (conversation) =>
            String(conversation?.id || conversation?._id) !==
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

      saveCache(
        usersRef.current,
        conversationsRef.current,
        messagesCache.current
      );

      selectedConversationIdRef.current = null;

      setSelectedConversationId(null);
      setSelectedConversation(null);
      setSelectedUser(null);
      setMessages([]);
      setMessagesError("");
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

          {/* CONTACTS / GROUPS SIDEBAR */}
          <div className="flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-slate-100 lg:w-[360px] lg:border-b-0 lg:border-r">
            <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 p-4 sm:p-5">
              <div className="mb-3.5 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Chats & Teams
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Direct messages & groups
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowGroupModal(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700"
                >
                  <Plus size={15} />
                  New Group
                </button>
              </div>

              {conversations.some((item) => item.isGroup) && (
                <div className="mb-3 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Groups
                  </p>

                  {conversations
                    .filter((item) => item.isGroup)
                    .map((group) => {
                      const groupId = group._id || group.id;
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
                    String(getId(selectedUser)) === String(userId);

                  const existingConv = findConversationForUser(
                    userId,
                    conversations
                  );

                  const unread = getUnreadCount(existingConv);
                  const isOnline =
                    onlineUsers[userId] === "online" ||
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
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-visible rounded-2xl bg-[#2563EB] text-xs font-bold text-white shadow-sm">
                        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl">
                          {getInitials(getUserName(user))}
                        </div>

                        <span
                          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                            isOnline ? "bg-emerald-500" : "bg-slate-300"
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

                          {existingConv && (
                            <span className="shrink-0 text-[10px] text-slate-400">
                              {formatConversationTime(
                                getConversationLastDate(existingConv)
                              )}
                            </span>
                          )}
                        </div>

                        <p className="mt-1 truncate text-xs text-slate-500">
                          {getConversationLastMessage(existingConv) ||
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

          {/* CHAT PANEL */}
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-50/20">
            {/* CHAT HEADER */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5 sm:px-6">
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
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* MESSAGES */}
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
                    const senderName = getUserName(sender);
                    const isDeleted = Boolean(
                      item?.isDeletedForEveryone
                    );

                    const body = isDeleted
                      ? "This message was deleted"
                      : item?.body || item?.message || "";

                    const isAdmin =
                      String(sender?.role || "").toLowerCase() ===
                        "admin" ||
                      sender?.name === "You";

                    const attachments = Array.isArray(item?.attachments)
                      ? item.attachments
                      : [];

                    return (
                      <div
                        key={item?.id || item?._id || index}
                        className={`group relative flex w-full items-center gap-2.5 ${
                          isAdmin ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[82%] rounded-[20px] px-4 py-3 shadow-sm sm:max-w-[72%] ${
                            isDeleted
                              ? "border border-slate-200/80 bg-slate-50 italic text-slate-400"
                              : isAdmin
                              ? "rounded-tr-xs bg-[#2563EB] text-white shadow-blue-600/15"
                              : "rounded-tl-xs border border-slate-100 bg-white text-slate-800 shadow-[0_4px_20px_rgba(45,35,100,0.03)]"
                          }`}
                        >
                          {!isAdmin && !isDeleted && (
                            <p className="mb-1 text-[10px] font-bold text-[#2563EB]">
                              {senderName}
                            </p>
                          )}

                          {attachments.length > 0 && (
                            <div className="mb-2 flex flex-col gap-2">
                              {attachments.map((attachment, attachmentIndex) => {
                                const rawUrl =
                                  attachment.url ||
                                  attachment.path ||
                                  attachment.filePath ||
                                  attachment.fileUrl ||
                                  attachment.filename;

                                const fileUrl = getFileUrl(rawUrl);

                                const isImage =
                                  attachment.mimeType?.startsWith("image/") ||
                                  /\.(png|jpg|jpeg|webp|gif)$/i.test(
                                    fileUrl
                                  ) ||
                                  attachment.type?.startsWith("image/");

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
                                        alt={
                                          attachment.originalName ||
                                          attachment.filename ||
                                          "Attachment"
                                        }
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
                                    className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-semibold ${
                                      isAdmin
                                        ? "bg-white/10 text-white hover:bg-white/20"
                                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                    }`}
                                  >
                                    <FileText size={16} />
                                    <span className="truncate">
                                      {attachment.originalName ||
                                        attachment.filename ||
                                        "Download File"}
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
                              isAdmin ? "text-blue-200" : "text-slate-400"
                            }`}
                          >
                            {formatMessageTime(item?.createdAt)}
                            {isAdmin && item?.status === "sending"
                              ? " · Sending"
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

            {/* MESSAGE COMPOSER */}
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

                    setSelectedFiles((previous) => [
                      ...previous,
                      ...newFiles,
                    ]);

                    event.target.value = "";
                  }}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!selectedUser}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-slate-50/50 text-slate-500 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#2563EB] disabled:opacity-40"
                  aria-label="Attach files"
                >
                  <Paperclip size={18} />
                </button>

                <div className="min-w-0 flex-1">
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={
                      selectedUser
                        ? "Write a message..."
                        : "Select user first..."
                    }
                    rows={1}
                    disabled={!selectedUser}
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
                    (!message.trim() && selectedFiles.length === 0)
                  }
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2563EB] text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
                  aria-label="Send message"
                >
                  <Send size={17} />
                </button>
              </form>
            </div>
          </div>
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
                  onChange={(event) => setGroupName(event.target.value)}
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

                    const isChecked =
                      selectedGroupMembers.includes(userId);

                    return (
                      <label
                        key={userId}
                        className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setSelectedGroupMembers((previous) =>
                                previous.includes(userId)
                                  ? previous
                                  : [...previous, userId]
                              );
                            } else {
                              setSelectedGroupMembers((previous) =>
                                previous.filter((id) => id !== userId)
                              );
                            }
                          }}
                        />
                        <span className="font-semibold text-slate-800">
                          {getUserName(user)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({user.role})
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
