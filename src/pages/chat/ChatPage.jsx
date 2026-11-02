import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";

import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import { MessageSquare, Users, X, Check, Search, UserMinus, ShieldCheck, Trash2 } from "lucide-react";
import api from "../../services/api";

import ChatSidebar from "./components/ChatSidebar";
import ChatHeader from "./components/ChatHeader";
import ChatMessageArea from "./components/ChatMessageArea";
import ChatInput from "./components/ChatInput";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥"];

const EMOJI_PALETTE = [
  "👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👏",
  "🙌", "✨", "💯", "🚀", "💡", "✅", "👀", "🤝",
  "😊", "😍", "🤩", "🤔", "😎", "🙏", "💪", "🎯",
  "⚡", "🌟", "🎈", "🏆", "👌", "☕", "🍕", "🥳",
];

const playNotificationSound = () => {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880.0, now + 0.08);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 450);
  } catch {
    // Non-blocking audio fallback
  }
};

const isValidObjectId = (id) =>
  typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

const getEntityId = (value) => {
  if (!value) return "";

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return String(
    value._id ||
      value.id ||
      value.userId ||
      value.conversationId ||
      ""
  );
};

const getStoredSocketToken = () => {
  if (typeof window === "undefined") return "";

  try {
    const keys = [
      "localpro_token",
      "token",
      "accessToken",
      "access_token",
      "authToken",
      "auth_token",
      "jwt",
    ];

    for (const storage of [
      window.localStorage,
      window.sessionStorage,
    ]) {
      for (const key of keys) {
        const value = storage.getItem(key);
        if (value) return value;
      }
    }

    const authorization =
      api.defaults.headers?.common?.Authorization;

    return typeof authorization === "string"
      ? authorization.replace(/^Bearer\s+/i, "")
      : "";
  } catch {
    return "";
  }
};

const getDisplayName = (u, usersMap = null) => {
  if (!u) return "";

  if (typeof u === "string") {
    const result = usersMap?.get ? usersMap.get(u) : usersMap?.[u];
    return result ? getDisplayName(result, usersMap) : "";
  }

  const userId = String(u._id || u.id || "");

  const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim();
  const directName =
    (typeof u.name === "string" && u.name.trim() ? u.name.trim() : null) ||
    (fullName || null) ||
    (typeof u.username === "string" && u.username.trim() ? u.username.trim() : null) ||
    (typeof u.email === "string" && u.email.includes("@") ? u.email.split("@")[0] : null);

  if (directName) {
    return directName;
  }

  if (userId && usersMap) {
    const result = usersMap?.get ? usersMap.get(userId) : usersMap?.[userId];
    if (result && result !== u) {
      return getDisplayName(result, usersMap);
    }
  }

  return u.username || u.name || (u.email ? u.email.split("@")[0] : "") || "";
};

const getUserInitials = (u, usersMap = null) => {
  const name = getDisplayName(u, usersMap);
  if (!name) return "";
  const parts = name.split(" ").filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return name.slice(0, 2).toUpperCase() || "";
};

const formatMessageTime = (dateString) => {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatMessageDateHeader = (dateString) => {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return "Today";
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const formatFileSize = (bytes) => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const mergeMessages = (existing = [], incoming = []) => {
  const result = [...existing];

  incoming.forEach((incomingMessage) => {
    if (!incomingMessage) return;

    const incomingId = getEntityId(incomingMessage._id);
    const incomingClientId = incomingMessage.clientMsgId;

    const index = result.findIndex((message) => {
      const sameServerId =
        incomingId &&
        getEntityId(message._id) === incomingId;

      const sameClientId =
        incomingClientId &&
        message.clientMsgId === incomingClientId;

      return Boolean(sameServerId || sameClientId);
    });

    if (index >= 0) {
      result[index] = {
        ...result[index],
        ...incomingMessage,
        isOptimistic: false,
        sendFailed: false,
      };
    } else {
      result.push(incomingMessage);
    }
  });

  return result.sort(
    (a, b) =>
      new Date(a.createdAt || 0).getTime() -
      new Date(b.createdAt || 0).getTime()
  );
};

export default function ChatPage({ user }) {
  const [searchParams] = useSearchParams();

  const targetConvIdFromUrl =
    searchParams.get("conv") ||
    searchParams.get("conversationId");

  const myUserId = useMemo(() => {
    if (user?._id) return String(user._id);
    if (user?.id) return String(user.id);

    try {
      const stored = JSON.parse(
        window.localStorage.getItem("localpro_user") || "{}"
      );

      return String(stored?._id || stored?.id || "");
    } catch {
      return "";
    }
  }, [user]);

  const isSelfUser = useCallback(
    (candidate) => {
      if (!candidate) return false;

      const candidateId =
        typeof candidate === "object"
          ? String(candidate._id || candidate.id || "")
          : String(candidate);

      if (candidateId && myUserId && candidateId === myUserId) {
        return true;
      }

      if (
        user?.username &&
        candidate?.username &&
        user.username.toLowerCase() ===
          candidate.username.toLowerCase()
      ) {
        return true;
      }

      if (
        user?.email &&
        candidate?.email &&
        user.email.toLowerCase() ===
          candidate.email.toLowerCase()
      ) {
        return true;
      }

      return false;
    },
    [user, myUserId]
  );

  const [conversations, setConversations] = useState([]);
  const [workspaceUsers, setWorkspaceUsers] = useState([]);
  const [activeConversation, setActiveConversation] = useState(() => {
    if (targetConvIdFromUrl && isValidObjectId(targetConvIdFromUrl)) {
      return { _id: targetConvIdFromUrl };
    }
    return null;
  });
  const [messages, setMessages] = useState([]);

  const [composerText, setComposerText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);

  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState(new Map());

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [isGroupInfoModalOpen, setIsGroupInfoModalOpen] = useState(false);
  const [groupInfoLoading, setGroupInfoLoading] = useState(false);
  const [groupMembersList, setGroupMembersList] = useState([]);
  const [groupAdminUser, setGroupAdminUser] = useState(null);
  const [groupMemberSearch, setGroupMemberSearch] = useState("");

  const [forwardModalMsg, setForwardModalMsg] = useState(null);
  const [forwardSelectedConvs, setForwardSelectedConvs] = useState([]);

  const [activeActionMenuId, setActiveActionMenuId] = useState(null);
  const [activeReactionPickerId, setActiveReactionPickerId] = useState(null);
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false);
  const [showChatHeaderMenu, setShowChatHeaderMenu] = useState(false);
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);
  const [messagePriority, setMessagePriority] = useState("standard");
  const [pinnedConvIds, setPinnedConvIds] = useState(() => {
    try {
      const stored = localStorage.getItem("localpro_pinned_convs");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const handleTogglePinConversation = useCallback((convId) => {
    if (!convId) return;
    setPinnedConvIds((prev) => {
      const exists = prev.includes(convId);
      const updated = exists ? prev.filter((id) => id !== convId) : [...prev, convId];
      try {
        localStorage.setItem("localpro_pinned_convs", JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to persist pinned convs:", err);
      }
      return updated;
    });
  }, []);

  const [customChatOrder, setCustomChatOrder] = useState(() => {
    try {
      const stored = localStorage.getItem("localpro_chat_order");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const handleReorderChats = useCallback((newOrder) => {
    if (!Array.isArray(newOrder)) return;
    setCustomChatOrder(newOrder);
    try {
      localStorage.setItem("localpro_chat_order", JSON.stringify(newOrder));
    } catch (err) {
      console.warn("Failed to persist chat order:", err);
    }
  }, []);

  const socketRef = useRef(null);
  const activeConvRef = useRef(null);
  const userRef = useRef(user);
  const messagesScrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const sendingRef = useRef(new Set());
  const messageConversationRef = useRef("");
  const highlightTimerRef = useRef(null);
  const previewUrlsRef = useRef(new Set());
  const selectedFilesRef = useRef([]);
  const filePreviewsRef = useRef([]);

  useEffect(() => {
    activeConvRef.current = activeConversation;
    const convId = getEntityId(activeConversation);
    if (convId && socketRef.current?.connected) {
      socketRef.current.emit("join_conversation", convId);
    }
  }, [activeConversation]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    selectedFilesRef.current = selectedFiles;
  }, [selectedFiles]);

  useEffect(() => {
    filePreviewsRef.current = filePreviews;
  }, [filePreviews]);

  const conversationsRef = useRef(conversations);
  const workspaceUsersMapRef = useRef(new Map());
  const handleSelectConversationRef = useRef(null);
  const handleSelectConversationByIdRef = useRef(null);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const [notificationPermission, setNotificationPermission] = useState(() => {
    return typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "default";
  });

  const requestNotificationPermission = useCallback(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission()
          .then((permission) => {
            console.info("[CHAT NOTIFICATION] Permission status:", permission);
            setNotificationPermission(permission);
          })
          .catch((err) => {
            console.warn("[CHAT NOTIFICATION] Request failed:", err);
          });
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "default") {
      Notification.requestPermission()
        .then((permission) => {
          console.info("[CHAT NOTIFICATION] Permission status on mount:", permission);
          setNotificationPermission(permission);
        })
        .catch(() => {});
    }

    // Modern browsers require a user interaction gesture to prompt for Notification permission
    const handleUserInteraction = () => {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission()
          .then((permission) => {
            console.info("[CHAT NOTIFICATION] Permission status via user interaction:", permission);
            setNotificationPermission(permission);
          })
          .catch(() => {});
      }
    };

    window.addEventListener("click", handleUserInteraction, { once: true });
    window.addEventListener("keydown", handleUserInteraction, { once: true });

    return () => {
      window.removeEventListener("click", handleUserInteraction);
      window.removeEventListener("keydown", handleUserInteraction);
    };
  }, []);

  // Autonomous verification test function attached to window
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.testLocalProNotification = () => {
        if (!("Notification" in window)) {
          console.warn("[TEST NOTIFICATION] Web Notifications API is not supported in this browser.");
          return;
        }
        if (Notification.permission === "default") {
          Notification.requestPermission().then((perm) => {
            console.log("[TEST NOTIFICATION] Requested permission:", perm);
            setNotificationPermission(perm);
            if (perm === "granted") {
              const notif = new Notification("LocalPro Test", {
                body: "Windows notification is working!",
                icon: "/favicon.ico",
                badge: "/favicon.ico",
                tag: "localpro-test",
                renotify: true,
              });
              notif.onclick = () => {
                window.focus();
                notif.close();
              };
              console.log("[TEST NOTIFICATION] Test notification dispatched successfully!");
            }
          });
        } else if (Notification.permission === "granted") {
          const notif = new Notification("LocalPro Test", {
            body: "Windows notification is working!",
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            tag: "localpro-test",
            renotify: true,
          });
          notif.onclick = () => {
            window.focus();
            notif.close();
          };
          console.log("[TEST NOTIFICATION] Test notification dispatched successfully!");
        } else {
          console.warn("[TEST NOTIFICATION] Notification permission is denied in browser settings.");
        }
      };
    }
    return () => {
      if (typeof window !== "undefined") {
        delete window.testLocalProNotification;
      }
    };
  }, []);

  const releasePreviews = useCallback((previews = []) => {
    previews.forEach((preview) => {
      const url = preview?.url;

      if (url?.startsWith("blob:")) {
        URL.revokeObjectURL(url);
        previewUrlsRef.current.delete(url);
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }

      previewUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });

      previewUrlsRef.current.clear();
    };
  }, []);

  const serverBaseUrl = useMemo(() => {
    const configuredBaseUrl = api.defaults.baseURL;

    if (configuredBaseUrl) {
      return configuredBaseUrl.replace(/\/api\/?$/, "");
    }

    return typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:5000";
  }, []);

  const workspaceUsersMap = useMemo(() => {
    const map = new Map();

    workspaceUsers.forEach((workspaceUser) => {
      if (workspaceUser?._id) {
        map.set(String(workspaceUser._id), workspaceUser);
      }

      if (workspaceUser?.id) {
        map.set(String(workspaceUser.id), workspaceUser);
      }
    });

    if (user?._id) map.set(String(user._id), user);
    if (user?.id) map.set(String(user.id), user);

    return map;
  }, [workspaceUsers, user]);

  useEffect(() => {
    workspaceUsersMapRef.current = workspaceUsersMap;
  }, [workspaceUsersMap]);

  const scrollToBottom = useCallback((behavior = "smooth") => {
    const element = messagesScrollRef.current;
    if (!element) return;

    element.scrollTo({
      top: element.scrollHeight,
      behavior,
    });
  }, []);

  const scrollToMessage = useCallback((messageId) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (!element) return;

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    setHighlightedMsgId(messageId);

    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }

    highlightTimerRef.current = setTimeout(() => {
      setHighlightedMsgId(null);
      highlightTimerRef.current = null;
    }, 2000);
  }, []);

  // Bootstrap conversations and workspace contacts
  useEffect(() => {
    let isMounted = true;

    const loadBootstrap = async () => {
      try {
        const response = await api.get("/chats/bootstrap");

        if (!isMounted) return;

        const rawConvs = Array.isArray(response.data?.conversations)
          ? response.data.conversations
          : [];

        const rawUsers = Array.isArray(response.data?.users)
          ? response.data.users
          : [];

        const seenConvIds = new Set();
        const convs = [];
        for (const c of rawConvs) {
          const cid = getEntityId(c);
          if (cid && !seenConvIds.has(cid)) {
            seenConvIds.add(cid);
            convs.push(c);
          }
        }

        const seenUserIds = new Set();
        const dedupedUsers = [];
        for (const u of rawUsers) {
          const uid = getEntityId(u);
          if (
            uid &&
            !seenUserIds.has(uid) &&
            !isSelfUser(u) &&
            !u.participants &&
            !u.isGroup &&
            !u.conversationId
          ) {
            seenUserIds.add(uid);
            dedupedUsers.push(u);
          }
        }

        setConversations(convs);
        setWorkspaceUsers(dedupedUsers);

        // Do not auto-open first chat on load; only open if explicit conv ID in URL
        let selected = null;

        if (targetConvIdFromUrl && isValidObjectId(targetConvIdFromUrl)) {
          selected =
            convs.find(
              (conversation) => getEntityId(conversation) === targetConvIdFromUrl
            ) || null;
        }

        if (selected) {
          const selectedId = getEntityId(selected);
          activeConvRef.current = selected;
          messageConversationRef.current = selectedId;
          setActiveConversation(selected);
          localStorage.setItem("localpro_last_active_conv", selectedId);
        } else {
          activeConvRef.current = null;
          messageConversationRef.current = "";
          setActiveConversation(null);
          setMessages([]);
        }
      } catch (error) {
        if (isMounted) {
          console.error("[CHAT] Bootstrap fetch failed:", error);
        }
      }
    };

    loadBootstrap();

    return () => {
      isMounted = false;
    };
  }, [targetConvIdFromUrl, isSelfUser]);

  // Socket connection and realtime events
  useEffect(() => {
    const token = getStoredSocketToken();

    const socket = io(serverBaseUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      auth: token ? { token, userId: myUserId } : { userId: myUserId },
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.info("[CHAT SOCKET] Connected:", socket.id);
      const currentId = myUserId || getEntityId(userRef.current);
      if (currentId) {
        socket.emit("join", currentId);
      }
      const activeId = getEntityId(activeConvRef.current);
      if (activeId) {
        socket.emit("join_conversation", activeId);
      }
    });

    socket.on("disconnect", (reason) => {
      if (reason !== "io client disconnect") {
        console.warn("[CHAT SOCKET] Disconnected:", reason);
      }
    });

    socket.on("connect_error", (error) => {
      console.warn("[CHAT SOCKET] Connection error:", error.message);
    });

    const applyPresenceUpdate = (payload = {}) => {
      const userId = getEntityId(
        payload.userId || payload.user || payload._id
      );

      const status = String(
        payload.status || payload.state || ""
      ).toLowerCase();

      if (!userId) return;

      setOnlineUserIds((previous) => {
        const next = new Set(previous);

        if (status === "online" || status === "active") {
          next.add(userId);
        } else if (status === "offline" || status === "inactive") {
          next.delete(userId);
        }

        return next;
      });
    };

    socket.on("update_user_status", applyPresenceUpdate);
    socket.on("presence:update", applyPresenceUpdate);

    socket.on("presence:initial", (onlineIds) => {
      if (!Array.isArray(onlineIds)) return;

      setOnlineUserIds(
        new Set(onlineIds.map(getEntityId).filter(Boolean))
      );
    });

    socket.on("chat:typing", (payload = {}) => {
      const conversationId = getEntityId(payload.conversationId);
      const typingUserId = getEntityId(payload.userId);
      const activeId = String(
        activeConvRef.current?._id ||
        activeConvRef.current?.id ||
        ""
      );
      const currentUserId = String(
        userRef.current?._id ||
        userRef.current?.id ||
        ""
      );

      if (
        conversationId !== activeId ||
        !typingUserId ||
        typingUserId === currentUserId
      ) {
        return;
      }

      setTypingUsers((previous) => {
        const next = new Map(previous);

        if (payload.isTyping) {
          next.set(typingUserId, Date.now());
        } else {
          next.delete(typingUserId);
        }

        return next;
      });
    });

    socket.on("message:new", (incomingMessage) => {
      if (!incomingMessage) return;

      const activeId = String(
        activeConvRef.current?._id ||
        activeConvRef.current?.id ||
        ""
      );

      const incomingConversationId = String(
        incomingMessage.conversation?._id ||
        incomingMessage.conversation?.id ||
        incomingMessage.conversation ||
        incomingMessage.conversationId ||
        ""
      );

      const currentUserId = String(
        userRef.current?._id ||
        userRef.current?.id ||
        ""
      );

      const senderId = String(
        incomingMessage.sender?._id ||
        incomingMessage.sender?.id ||
        incomingMessage.sender ||
        ""
      );

      if (!incomingConversationId) return;

      const isMe = Boolean(senderId && senderId === currentUserId);
      const isViewingActive = Boolean(activeId && incomingConversationId === activeId);

      if (isViewingActive) {
        setMessages((previous) => mergeMessages(previous, [incomingMessage]));

        if (!isMe) {
          api.post(`/chats/${activeId}/read`).catch((error) => {
            console.warn("[CHAT] Mark read failed:", error.message);
          });
        }

        window.setTimeout(() => {
          scrollToBottom("smooth");
        }, 10);
      }

      // Windows Desktop & Audio Notification for incoming messages from other users
      if (!isMe) {
        const isDifferentChat = !isViewingActive;
        const isBackgroundTab = typeof document !== "undefined" && document.hidden;

        if (isBackgroundTab || isDifferentChat) {
          // 1. Play clean web audio notification chime
          try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
              const audioCtx = new AudioCtx();
              if (audioCtx.state === "suspended") {
                audioCtx.resume().catch(() => {});
              }
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.type = "sine";
              osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
              gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.35);
              setTimeout(() => {
                audioCtx.close().catch(() => {});
              }, 450);
            }
          } catch {
            // AudioContext fallback
          }

          // 2. Trigger Native Windows / Browser Notification
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              const senderObj = incomingMessage.sender;
              const senderName =
                getDisplayName(senderObj, workspaceUsersMapRef.current) || "New Message";
              const bodyText = incomingMessage.text
                ? incomingMessage.text.length > 80
                  ? incomingMessage.text.slice(0, 80) + "..."
                  : incomingMessage.text
                : incomingMessage.attachments?.length
                  ? "📎 Sent an attachment"
                  : "New message received";

              const notif = new Notification(senderName, {
                body: bodyText,
                icon: "/favicon.ico",
                badge: "/favicon.ico",
                tag: `localpro-chat-${incomingConversationId}`,
                renotify: true,
                silent: false,
              });

              notif.onclick = () => {
                window.focus();
                notif.close();
                if (typeof handleSelectConversationByIdRef.current === "function") {
                  handleSelectConversationByIdRef.current(incomingConversationId);
                } else if (typeof handleSelectConversationById === "function") {
                  handleSelectConversationById(incomingConversationId);
                }
              };
            } catch (err) {
              console.warn("[CHAT NOTIFICATION] Native notification failed:", err);
            }
          }
        }
      }

      setConversations((previous) => {
        let found = false;
        const updated = previous.map((conversation) => {
          const convId = String(
            conversation?._id ||
            conversation?.id ||
            ""
          );

          if (convId !== incomingConversationId) {
            return conversation;
          }

          found = true;
          return {
            ...conversation,
            lastMessage: incomingMessage,
            lastMessageAt:
              incomingMessage.createdAt ||
              conversation.lastMessageAt ||
              new Date().toISOString(),
            unreadCount:
              isViewingActive || isMe
                ? 0
                : (Number(conversation.unreadCount) || 0) + 1,
          };
        });

        if (!found) {
          const fallbackParticipants =
            activeConvRef.current &&
            getEntityId(activeConvRef.current) === incomingConversationId &&
            Array.isArray(activeConvRef.current.participants)
              ? activeConvRef.current.participants
              : [user, incomingMessage.sender].filter(Boolean);

          updated.unshift({
            _id: incomingConversationId,
            lastMessage: incomingMessage,
            lastMessageAt: incomingMessage.createdAt || new Date().toISOString(),
            unreadCount: isViewingActive || isMe ? 0 : 1,
            participants: fallbackParticipants,
          });

          api.get("/chats/conversations")
            .then((res) => {
              if (Array.isArray(res.data?.conversations)) {
                setConversations((prev) => {
                  const map = new Map();
                  for (const c of res.data.conversations) {
                    const id = getEntityId(c);
                    if (id) map.set(id, c);
                  }
                  for (const c of prev) {
                    const id = getEntityId(c);
                    if (id && !map.has(id)) map.set(id, c);
                  }
                  return Array.from(map.values()).sort(
                    (a, b) =>
                      new Date(b.lastMessageAt || 0).getTime() -
                      new Date(a.lastMessageAt || 0).getTime()
                  );
                });
              }
            })
            .catch(() => {});
        }

        const map = new Map();
        for (const c of updated) {
          const id = getEntityId(c);
          if (id && !map.has(id)) {
            map.set(id, c);
          }
        }

        return Array.from(map.values()).sort(
          (a, b) =>
            new Date(b.lastMessageAt || 0).getTime() -
            new Date(a.lastMessageAt || 0).getTime()
        );
      });
    });

    socket.on("chat:notification", (notification) => {
      if (!notification || typeof window === "undefined") return;

      window.dispatchEvent(
        new CustomEvent("localpro:chat-notification", {
          detail: notification,
        })
      );

      if (
        document.hidden &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          const convId = getEntityId(
            notification.conversationId ||
              notification.conversation ||
              notification.id
          );
          const notif = new Notification(
            notification.title || "New chat message",
            {
              body:
                notification.message ||
                notification.text ||
                "You received a new message.",
              icon: "/favicon.ico",
              badge: "/favicon.ico",
              tag: convId ? `localpro-chat-${convId}` : undefined,
              renotify: true,
              silent: false,
            }
          );
          if (convId) {
            notif.onclick = () => {
              window.focus();
              notif.close();
              handleSelectConversationByIdRef.current?.(convId);
            };
          }
        } catch {
          // Browser notification is optional.
        }
      }
    });

    const upsertConversation = (updatedConv) => {
      const conversationId = getEntityId(
        updatedConv?._id || updatedConv?.conversationId || updatedConv?.id
      );

      if (!conversationId) return;

      setConversations((previous) => {
        let matched = false;
        const updated = previous.map((item) => {
          if (getEntityId(item) === conversationId) {
            matched = true;
            return {
              ...item,
              ...updatedConv,
              _id: item._id || conversationId,
              participants:
                Array.isArray(updatedConv.participants) && updatedConv.participants.length
                  ? updatedConv.participants
                  : item.participants,
              isGroup:
                updatedConv.isGroup !== undefined
                  ? updatedConv.isGroup
                  : item.isGroup,
              groupName: updatedConv.groupName || item.groupName,
              unreadCount:
                typeof updatedConv.unreadCount === "number"
                  ? updatedConv.unreadCount
                  : item.unreadCount,
            };
          }
          return item;
        });

        if (!matched && (updatedConv._id || updatedConv.id)) {
          updated.unshift(updatedConv);
        }

        const map = new Map();
        for (const item of updated) {
          const id = getEntityId(item);
          if (id && !map.has(id)) {
            map.set(id, item);
          }
        }

        return Array.from(map.values()).sort(
          (a, b) =>
            new Date(b.lastMessageAt || b.updatedAt || 0).getTime() -
            new Date(a.lastMessageAt || a.updatedAt || 0).getTime()
        );
      });
    };

    socket.on("conversation:new", upsertConversation);

    socket.on("conversation:updated", (payload) => {
      const conversation = payload?.conversation || payload;

      if (conversation?._id || conversation?.conversationId) {
        upsertConversation(conversation);
      }
    });

    const applyReadReceipt = (payload = {}) => {
      const conversationId = getEntityId(payload.conversationId);
      const readerId = getEntityId(
        payload.readerId || payload.userId || payload.reader
      );
      const currentUserId = String(
        userRef.current?._id || userRef.current?.id || ""
      );

      if (readerId && readerId === currentUserId) {
        setConversations((previous) =>
          previous.map((c) =>
            getEntityId(c) === conversationId
              ? { ...c, unreadCount: 0 }
              : c
          )
        );
      }

      if (
        conversationId !== getEntityId(activeConvRef.current) ||
        !readerId
      ) {
        return;
      }

      setMessages((previous) =>
        previous.map((message) => {
          if (getEntityId(message.sender) !== currentUserId) {
            return message;
          }

          const readBy = Array.isArray(message.readBy)
            ? [...message.readBy]
            : [];

          if (!readBy.some((item) => getEntityId(item) === readerId)) {
            readBy.push(readerId);
          }

          return { ...message, readBy };
        })
      );
    };

    socket.on("chat:read", applyReadReceipt);
    socket.on("message:read", applyReadReceipt);

    socket.on("message:edited", (payload = {}) => {
      const messageId = getEntityId(payload.messageId || payload._id);
      if (!messageId) return;

      setMessages((previous) =>
        previous.map((message) =>
          getEntityId(message) === messageId
            ? { ...message, ...payload, _id: message._id }
            : message
        )
      );
    });

    socket.on("message:reaction", (payload = {}) => {
      const messageId = getEntityId(payload.messageId || payload._id);
      if (!messageId) return;

      setMessages((previous) =>
        previous.map((message) =>
          getEntityId(message) === messageId
            ? { ...message, reactions: payload.reactions || [] }
            : message
        )
      );
    });

    socket.on("message:pinned", (payload = {}) => {
      const messageId = getEntityId(payload.messageId || payload._id);
      if (!messageId) return;

      setMessages((previous) =>
        previous.map((message) =>
          getEntityId(message) === messageId
            ? {
                ...message,
                isPinned: payload.isPinned,
                pinnedBy: payload.pinnedBy,
              }
            : message
        )
      );
    });

    socket.on("message:deleted", (payload = {}) => {
      const messageId = getEntityId(payload.messageId || payload._id);
      if (!messageId) return;

      setMessages((previous) =>
        previous.map((message) =>
          getEntityId(message) === messageId
            ? {
                ...message,
                text: payload.text || "This message was deleted",
                isDeletedForEveryone: true,
                attachments: [],
              }
            : message
        )
      );
    });

    socket.on("message:deleted_for_me", (payload = {}) => {
      const messageId = getEntityId(payload.messageId);
      if (!messageId) return;

      setMessages((previous) =>
        previous.filter(
          (message) => getEntityId(message) !== messageId
        )
      );
    });

    socket.on("conversation:deleted", (payload = {}) => {
      const convId = getEntityId(payload.conversationId || payload._id || payload);
      if (!convId) return;

      setConversations((previous) =>
        previous.filter((item) => getEntityId(item) !== convId)
      );

      if (getEntityId(activeConvRef.current) === convId) {
        setActiveConversation(null);
        setMessages([]);
        localStorage.removeItem("localpro_last_active_conv");
      }
    });

    socket.on("group:member_removed", (payload = {}) => {
      const convId = getEntityId(payload.conversationId);
      const memberId = getEntityId(payload.memberId);
      const currentId = myUserId || getEntityId(userRef.current);

      if (memberId && currentId && memberId === currentId) {
        setConversations((previous) =>
          previous.filter((item) => getEntityId(item) !== convId)
        );

        if (getEntityId(activeConvRef.current) === convId) {
          setActiveConversation(null);
          setMessages([]);
          localStorage.removeItem("localpro_last_active_conv");
        }
      } else if (convId) {
        setConversations((previous) =>
          previous.map((c) =>
            getEntityId(c) === convId
              ? {
                  ...c,
                  participants: Array.isArray(c.participants)
                    ? c.participants.filter((p) => getEntityId(p) !== memberId)
                    : [],
                }
              : c
          )
        );

        setGroupMembersList((previous) =>
          previous.filter((m) => getEntityId(m) !== memberId)
        );
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();

      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [serverBaseUrl, scrollToBottom]);

  // Direct message loader function (reusable, explicit async loader)
  const loadMessagesForConversation = useCallback(
    async (convId) => {
      const conversationId = getEntityId(convId);
      if (!conversationId || !isValidObjectId(conversationId)) return;

      messageConversationRef.current = conversationId;

      try {
        const response = await api.get(`/chats/${conversationId}/messages`);
        const fetchedMessages = Array.isArray(response.data?.messages)
          ? response.data.messages
          : response.data?.data || [];

        // Verify current conversation has not switched during network transit
        const currentActiveId = String(
          activeConvRef.current?._id || activeConvRef.current?.id || ""
        );

        if (
          currentActiveId === conversationId ||
          messageConversationRef.current === conversationId
        ) {
          setMessages(fetchedMessages);
          setTimeout(() => {
            scrollToBottom("auto");
          }, 30);
        }

        // Auto mark as read
        api.post(`/chats/${conversationId}/read`).catch(() => {});
      } catch (error) {
        console.error("[CHAT] Failed to load messages dynamically:", error);
      }
    },
    [scrollToBottom]
  );

  // Select a conversation
  const handleSelectConversation = useCallback(
    (conversation) => {
      const conversationId = getEntityId(conversation);
      if (!conversationId) return;

      // Refresh persistence ke liye ID save karein
      localStorage.setItem("localpro_last_active_conv", conversationId);

      releasePreviews(filePreviewsRef.current);

      filePreviewsRef.current = [];
      selectedFilesRef.current = [];

      const previousActiveId = getEntityId(activeConvRef.current);
      activeConvRef.current = conversation;
      messageConversationRef.current = conversationId;

      setActiveConversation(conversation);

      // Only clear messages if switching to a different conversation
      if (previousActiveId !== conversationId) {
        setMessages([]);
      }

      setComposerText("");
      setReplyingTo(null);
      setEditingMessage(null);
      setSelectedFiles([]);
      setFilePreviews([]);
      setTypingUsers(new Map());
      setShowInputEmojiPicker(false);
      setMessagePriority("standard");

      setConversations((previous) =>
        previous.map((c) =>
          getEntityId(c) === conversationId
            ? { ...c, unreadCount: 0 }
            : c
        )
      );

      // Directly trigger message loading
      loadMessagesForConversation(conversationId);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [releasePreviews, loadMessagesForConversation]
  );

  useEffect(() => {
    handleSelectConversationRef.current = handleSelectConversation;
  }, [handleSelectConversation]);

  // Select a conversation by ID (handles notification click without requiring refresh)
  const handleSelectConversationById = useCallback(
    async (convId) => {
      if (!convId) return;
      const conversationId = String(convId);

      // 1. Check if conversation already exists in state
      let targetConv = conversationsRef.current?.find(
        (c) => String(c._id || c.id) === conversationId
      );

      // 2. If not found in memory (e.g. brand new chat), fetch from API immediately
      if (!targetConv) {
        try {
          const res = await api.get("/chats/conversations");
          const allConvs = res.data?.conversations || [];
          setConversations(allConvs);
          targetConv = allConvs.find(
            (c) => String(c._id || c.id) === conversationId
          );
        } catch (err) {
          console.error("Failed to fetch conversations on notification click", err);
        }
      }

      const convToSelect = targetConv || { _id: conversationId };
      handleSelectConversation(convToSelect);
      loadMessagesForConversation(conversationId);
    },
    [handleSelectConversation, loadMessagesForConversation]
  );

  useEffect(() => {
    handleSelectConversationByIdRef.current = handleSelectConversationById;
  }, [handleSelectConversationById]);

  useEffect(() => {
    const handleCustomNotif = (e) => {
      const convId = getEntityId(
        e.detail?.conversationId ||
          e.detail?.conversation ||
          e.detail?.id
      );
      if (convId) {
        handleSelectConversationById(convId);
      }
    };
    window.addEventListener("localpro:chat-notification", handleCustomNotif);
    return () => {
      window.removeEventListener("localpro:chat-notification", handleCustomNotif);
    };
  }, [handleSelectConversationById]);

  // Load messages for selected conversation
  useEffect(() => {
    const conversationId = getEntityId(activeConversation);

    if (!conversationId || !isValidObjectId(conversationId)) {
      messageConversationRef.current = "";
      setMessages([]);
      return undefined;
    }

    loadMessagesForConversation(conversationId);

    setConversations((previous) =>
      previous.map((conversation) =>
        getEntityId(conversation) === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation
      )
    );
  }, [activeConversation?._id, activeConversation?.id, loadMessagesForConversation]);

  // Emit typing state
  const emitTyping = useCallback((isTyping) => {
    const socket = socketRef.current;
    const conversationId = getEntityId(activeConvRef.current);

    if (!socket?.connected || !conversationId) return;

    socket.emit("chat:typing", { conversationId, isTyping });
  }, []);

  // Auto-expire typing indicator after 3.5 seconds of silence
  useEffect(() => {
    if (!typingUsers.size) return undefined;
    const interval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      const next = new Map();
      typingUsers.forEach((timestamp, uid) => {
        if (now - timestamp < 3500) next.set(uid, timestamp);
        else changed = true;
      });
      if (changed) setTypingUsers(next);
    }, 1000);
    return () => clearInterval(interval);
  }, [typingUsers]);




  // Files selection
  const handleFilesSelected = useCallback((event) => {
    const input = event.target;
    const incomingFiles = Array.from(input.files || []);

    if (!incomingFiles.length) return;

    const currentFiles = selectedFilesRef.current;
    const availableSlots = Math.max(0, 5 - currentFiles.length);
    const acceptedFiles = incomingFiles.slice(0, availableSlots);

    if (!acceptedFiles.length) {
      input.value = "";
      return;
    }

    const newPreviews = acceptedFiles.map((file) => {
      let url = null;

      if (
        file.type.startsWith("image/") &&
        typeof URL !== "undefined" &&
        URL.createObjectURL
      ) {
        url = URL.createObjectURL(file);
        previewUrlsRef.current.add(url);
      }

      return {
        name: file.name,
        url,
        type: file.type,
      };
    });

    const nextFiles = [...currentFiles, ...acceptedFiles];
    const nextPreviews = [...filePreviewsRef.current, ...newPreviews];

    selectedFilesRef.current = nextFiles;
    filePreviewsRef.current = nextPreviews;

    setSelectedFiles(nextFiles);
    setFilePreviews(nextPreviews);

    input.value = "";
  }, []);

  const removeFile = useCallback((index) => {
    const currentPreviews = filePreviewsRef.current;
    const preview = currentPreviews[index];

    if (preview?.url?.startsWith("blob:")) {
      URL.revokeObjectURL(preview.url);
      previewUrlsRef.current.delete(preview.url);
    }

    const nextPreviews = currentPreviews.filter(
      (_, itemIndex) => itemIndex !== index
    );

    const nextFiles = selectedFilesRef.current.filter(
      (_, itemIndex) => itemIndex !== index
    );

    filePreviewsRef.current = nextPreviews;
    selectedFilesRef.current = nextFiles;

    setFilePreviews(nextPreviews);
    setSelectedFiles(nextFiles);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Send message
  const handleSendMessage = async (event) => {
    event?.preventDefault?.();

    const conversationId = getEntityId(activeConvRef.current);

    if (!conversationId || !isValidObjectId(conversationId)) {
      return;
    }

    if (sendingRef.current.has(conversationId)) return;

    const textToSend = composerText.trim();
    const filesToSend = [...selectedFilesRef.current];

    if (!textToSend && filesToSend.length === 0) return;

    if (editingMessage) {
      const messageId = getEntityId(editingMessage);

      if (!textToSend || !messageId) return;

      sendingRef.current.add(conversationId);

      const originalMessage = editingMessage;

      setComposerText("");
      setEditingMessage(null);

      try {
        const response = await api.put(
          `/chats/messages/${messageId}`,
          { text: textToSend }
        );

        const updatedMessage =
          response.data?.message ||
          response.data?.data?.message;

        if (messageConversationRef.current === conversationId) {
          setMessages((previous) =>
            previous.map((message) =>
              getEntityId(message) === messageId
                ? updatedMessage || {
                    ...message,
                    text: textToSend,
                    isEdited: true,
                    editedAt: new Date().toISOString(),
                  }
                : message
            )
          );
        }
      } catch (error) {
        if (messageConversationRef.current === conversationId) {
          setComposerText(textToSend);
          setEditingMessage(originalMessage);
        }

        console.error("[CHAT] Message edit failed:", error);
      } finally {
        sendingRef.current.delete(conversationId);
      }

      return;
    }

    sendingRef.current.add(conversationId);

    const priorityToSend = messagePriority;
    const currentReply = replyingTo;
    const previewsToSend = [...filePreviewsRef.current];

    selectedFilesRef.current = [];
    filePreviewsRef.current = [];

    setComposerText("");
    setReplyingTo(null);
    setSelectedFiles([]);
    setFilePreviews([]);
    setShowInputEmojiPicker(false);
    setMessagePriority("standard");

    emitTyping(false);
    textareaRef.current?.focus();

    const clientMsgId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const optimisticMessage = {
      _id: `temp-${clientMsgId}`,
      clientMsgId,
      conversation: conversationId,
      sender: user,
      text: textToSend,
      attachments: filesToSend.map((file, index) => ({
        name: file.name,
        path: previewsToSend[index]?.url || "",
        type: file.type,
        size: file.size,
      })),
      replyTo: currentReply,
      priority: priorityToSend,
      reactions: [],
      readBy: [getEntityId(user)],
      createdAt: new Date().toISOString(),
      isOptimistic: true,
      sendFailed: false,
    };

    setMessages((previous) => {
      if (messageConversationRef.current !== conversationId) {
        return previous;
      }

      return mergeMessages(previous, [optimisticMessage]);
    });

    window.setTimeout(() => {
      if (messageConversationRef.current === conversationId) {
        scrollToBottom("smooth");
      }
    }, 10);

    setConversations((previous) => {
      let found = false;
      const updated = previous.map((conversation) => {
        if (getEntityId(conversation) === conversationId) {
          found = true;
          return {
            ...conversation,
            lastMessage: optimisticMessage,
            lastMessageAt: optimisticMessage.createdAt,
          };
        }
        return conversation;
      });

      if (!found && activeConvRef.current) {
        updated.unshift({
          ...activeConvRef.current,
          lastMessage: optimisticMessage,
          lastMessageAt: optimisticMessage.createdAt,
        });
      }

      return updated.sort(
        (a, b) =>
          new Date(b.lastMessageAt || 0).getTime() -
          new Date(a.lastMessageAt || 0).getTime()
      );
    });

    const formData = new FormData();

    formData.append("conversationId", conversationId);
    formData.append("clientMsgId", clientMsgId);

    if (textToSend) formData.append("text", textToSend);

    if (currentReply?._id) {
      formData.append("replyTo", currentReply._id);
    }

    if (priorityToSend && priorityToSend !== "standard") {
      formData.append("priority", priorityToSend);
    }

    filesToSend.forEach((file) => {
      formData.append("attachments", file);
    });

    try {
      const response = await api.post("/chats/messages", formData);

      const serverMessage =
        response.data?.message ||
        response.data?.data?.message;

      if (serverMessage) {
        setMessages((previous) => {
          if (messageConversationRef.current !== conversationId) {
            return previous;
          }

          return mergeMessages(previous, [serverMessage]);
        });

        setConversations((previous) =>
          previous.map((conversation) =>
            getEntityId(conversation) === conversationId
              ? {
                  ...conversation,
                  lastMessage: serverMessage,
                  lastMessageAt:
                    serverMessage.createdAt ||
                    conversation.lastMessageAt,
                }
              : conversation
          )
        );

        releasePreviews(previewsToSend);
      } else {
        setMessages((previous) =>
          previous.map((message) =>
            message.clientMsgId === clientMsgId
              ? {
                  ...message,
                  sendFailed: true,
                  sendError:
                    "Server response did not contain the saved message.",
                }
              : message
          )
        );
      }
    } catch (error) {
      console.error("[CHAT] Message send failed:", error);

      setMessages((previous) =>
        previous.map((message) =>
          message.clientMsgId === clientMsgId
            ? {
                ...message,
                isOptimistic: false,
                sendFailed: true,
                sendError:
                  error.response?.data?.message ||
                  error.message ||
                  "Message could not be sent. Please try again.",
              }
            : message
        )
      );
    } finally {
      sendingRef.current.delete(conversationId);
    }
  };

  // Direct contact selection
  const handleSelectContact = useCallback(
    async (recipient) => {
      if (!recipient || isSelfUser(recipient)) return;

      const recipientId = getEntityId(recipient);
      if (!recipientId) return;

      const existing = (conversationsRef.current || conversations).find(
        (conversation) => {
          if (conversation.isGroup) return false;

          return (
            conversation.participants?.some(
              (participant) => getEntityId(participant) === recipientId
            ) ||
            getEntityId(conversation.lastMessage?.sender) === recipientId
          );
        }
      );

      if (existing) {
        handleSelectConversation(existing);
        return;
      }

      try {
        const response = await api.post("/chats/conversations", {
          recipientId,
        });

        const serverConversation = response.data?.conversation;

        if (serverConversation) {
          const convId = getEntityId(serverConversation);
          setConversations((previous) => {
            const map = new Map();
            map.set(convId, serverConversation);
            for (const c of previous) {
              const id = getEntityId(c);
              if (id && !map.has(id)) {
                map.set(id, c);
              }
            }
            return Array.from(map.values());
          });

          handleSelectConversation(serverConversation);
        }
      } catch (error) {
        console.error("[CHAT] Error creating direct conversation:", error);
      }
    },
    [conversations, handleSelectConversation, isSelfUser]
  );

  // Group creation
  const handleCreateGroup = async (event) => {
    event.preventDefault();

    if (
      !groupName.trim() ||
      selectedGroupMembers.length === 0 ||
      creatingGroup
    ) {
      return;
    }

    setCreatingGroup(true);

    try {
      const response = await api.post("/chats/groups", {
        name: groupName.trim(),
        participantIds: selectedGroupMembers,
      });

      const newConversation = response.data?.conversation;

      if (newConversation) {
        setConversations((previous) => [
          newConversation,
          ...previous.filter(
            (conversation) =>
              getEntityId(conversation) !==
              getEntityId(newConversation)
          ),
        ]);

        handleSelectConversation(newConversation);
        setIsGroupModalOpen(false);
        setGroupName("");
        setSelectedGroupMembers([]);
        setGroupSearchQuery("");
      }
    } catch (error) {
      console.error("[CHAT] Failed to create group:", error);
    } finally {
      setCreatingGroup(false);
    }
  };

  // Open Group Info / Member Modal
  const handleOpenGroupInfo = useCallback(async () => {
    const convId = getEntityId(activeConvRef.current);
    if (!convId || !activeConvRef.current?.isGroup) return;

    setIsGroupInfoModalOpen(true);
    setGroupInfoLoading(true);
    setGroupMemberSearch("");

    try {
      const response = await api.get(`/chats/groups/${convId}/members`);
      if (response.data?.success) {
        setGroupMembersList(response.data.members || []);
        setGroupAdminUser(response.data.groupAdmin || null);
      }
    } catch (error) {
      console.error("[CHAT] Failed to load group members:", error);
    } finally {
      setGroupInfoLoading(false);
    }
  }, []);

  // Remove member from group (Group Admin or system Admin)
  const handleRemoveGroupMember = useCallback(
    async (memberId) => {
      const convId = getEntityId(activeConvRef.current);
      if (!convId || !memberId) return;

      if (!window.confirm("Are you sure you want to remove this member from the group?")) {
        return;
      }

      try {
        const response = await api.put(
          `/chats/groups/${convId}/members/remove`,
          { memberId }
        );

        if (response.data?.success) {
          setGroupMembersList((previous) =>
            previous.filter((m) => getEntityId(m) !== memberId)
          );

          setConversations((previous) =>
            previous.map((c) =>
              getEntityId(c) === convId
                ? {
                    ...c,
                    participants: Array.isArray(c.participants)
                      ? c.participants.filter(
                          (p) => getEntityId(p) !== memberId
                        )
                      : [],
                  }
                : c
            )
          );

          if (getEntityId(activeConvRef.current) === convId) {
            setActiveConversation((previous) => ({
              ...previous,
              participants: Array.isArray(previous?.participants)
                ? previous.participants.filter(
                    (p) => getEntityId(p) !== memberId
                  )
                : [],
            }));
          }
        }
      } catch (error) {
        console.error("[CHAT] Failed to remove member:", error);
        alert(error.response?.data?.message || "Failed to remove member.");
      }
    },
    []
  );

  // Delete Group completely
  const handleDeleteGroup = useCallback(async () => {
    const convId = getEntityId(activeConvRef.current);
    if (!convId) return;

    if (
      !window.confirm(
        "Are you sure you want to permanently delete this group and all its messages? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      const response = await api.delete(`/chats/groups/${convId}`);
      if (response.data?.success) {
        setIsGroupInfoModalOpen(false);
        setConversations((previous) =>
          previous.filter((c) => getEntityId(c) !== convId)
        );
        setActiveConversation(null);
        setMessages([]);
        localStorage.removeItem("localpro_last_active_conv");
      }
    } catch (error) {
      console.error("[CHAT] Failed to delete group:", error);
      alert(error.response?.data?.message || "Failed to delete group.");
    }
  }, []);

  // Leave Group (Regular Member)
  const handleLeaveGroup = useCallback(
    async (convId) => {
      const targetConvId = convId || getEntityId(activeConvRef.current);
      if (!targetConvId) return;

      if (!window.confirm("Are you sure you want to leave this group?")) {
        return;
      }

      try {
        const response = await api.put(
          `/chats/groups/${targetConvId}/members/remove`,
          { memberId: myUserId }
        );

        if (response.data?.success) {
          setIsGroupInfoModalOpen(false);
          setConversations((previous) =>
            previous.filter((c) => getEntityId(c) !== targetConvId)
          );
          setActiveConversation(null);
          setMessages([]);
          localStorage.removeItem("localpro_last_active_conv");
        }
      } catch (error) {
        console.error("[CHAT] Failed to leave group:", error);
        alert(error.response?.data?.message || "Failed to leave group.");
      }
    },
    [myUserId]
  );
  const handleToggleReaction = async (messageId, emoji) => {
    setActiveReactionPickerId(null);

    const targetId = String(messageId);
    const originalMessage = messages.find(
      (message) => getEntityId(message) === targetId
    );

    if (!originalMessage) return;

    const previousReactions = Array.isArray(originalMessage.reactions)
      ? [...originalMessage.reactions]
      : [];

    const myId = getEntityId(user);
    const nextReactions = [...previousReactions];

    const existingIndex = nextReactions.findIndex(
      (reaction) => getEntityId(reaction.user) === myId
    );

    if (existingIndex > -1) {
      if (nextReactions[existingIndex].emoji === emoji) {
        nextReactions.splice(existingIndex, 1);
      } else {
        nextReactions[existingIndex] = {
          ...nextReactions[existingIndex],
          emoji,
        };
      }
    } else {
      nextReactions.push({ user: myId, emoji });
    }

    setMessages((previous) =>
      previous.map((message) =>
        getEntityId(message) === targetId
          ? { ...message, reactions: nextReactions }
          : message
      )
    );

    try {
      const response = await api.post(
        `/chats/messages/${messageId}/reactions`,
        { emoji }
      );

      if (Array.isArray(response.data?.reactions)) {
        setMessages((previous) =>
          previous.map((message) =>
            getEntityId(message) === targetId
              ? { ...message, reactions: response.data.reactions }
              : message
          )
        );
      }
    } catch (error) {
      console.error("[CHAT] Reaction update failed:", error);

      setMessages((previous) =>
        previous.map((message) =>
          getEntityId(message) === targetId
            ? { ...message, reactions: previousReactions }
            : message
        )
      );
    }
  };

  // Pin / unpin
  const handleTogglePin = async (messageId) => {
    setActiveActionMenuId(null);

    try {
      const response = await api.post(
        `/chats/messages/${messageId}/pin`
      );

      setMessages((previous) =>
        previous.map((message) =>
          getEntityId(message) === String(messageId)
            ? {
                ...message,
                isPinned: response.data?.isPinned,
              }
            : message
        )
      );
    } catch (error) {
      console.error("[CHAT] Pin update failed:", error);
    }
  };

  // Forward message
  const handleForwardMessage = async () => {
    if (!forwardModalMsg || forwardSelectedConvs.length === 0) {
      return;
    }

    try {
      await api.post(
        `/chats/messages/${forwardModalMsg._id}/forward`,
        {
          targetConversationIds: forwardSelectedConvs,
        }
      );

      setForwardModalMsg(null);
      setForwardSelectedConvs([]);
    } catch (error) {
      console.error("[CHAT] Forward failed:", error);
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId, type = "me") => {
    setActiveActionMenuId(null);

    const targetId = String(messageId);
    const originalMessage = messages.find(
      (message) => getEntityId(message) === targetId
    );

    if (!originalMessage) return;

    setMessages((previous) =>
      type === "me"
        ? previous.filter(
            (message) => getEntityId(message) !== targetId
          )
        : previous.map((message) =>
            getEntityId(message) === targetId
              ? {
                  ...message,
                  isDeletedForEveryone: true,
                  text: "This message was deleted",
                  attachments: [],
                }
              : message
          )
    );

    try {
      await api.delete(`/chats/messages/${messageId}`, {
        data: { type },
      });
    } catch (error) {
      console.error("[CHAT] Message deletion failed:", error);

      setMessages((previous) => {
        const exists = previous.some(
          (message) => getEntityId(message) === targetId
        );

        if (exists) {
          return previous.map((message) =>
            getEntityId(message) === targetId
              ? originalMessage
              : message
          );
        }

        return mergeMessages(previous, [originalMessage]);
      });
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (conversationId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this chat history?"
      )
    ) {
      return;
    }

    const targetId = String(conversationId);
    const previousConversation = conversations.find(
      (conversation) => getEntityId(conversation) === targetId
    );

    const wasActive =
      getEntityId(activeConvRef.current) === targetId;

    setConversations((previous) =>
      previous.filter(
        (conversation) => getEntityId(conversation) !== targetId
      )
    );

    if (wasActive) {
      activeConvRef.current = null;
      messageConversationRef.current = "";
      setActiveConversation(null);
      setMessages([]);
    }

    try {
      await api.delete(`/chats/${conversationId}`);
    } catch (error) {
      console.error("[CHAT] Conversation deletion failed:", error);

      if (previousConversation) {
        setConversations((previous) => {
          if (
            previous.some(
              (conversation) => getEntityId(conversation) === targetId
            )
          ) {
            return previous;
          }

          return [...previous, previousConversation];
        });
      }

      if (wasActive && !activeConvRef.current && previousConversation) {
        activeConvRef.current = previousConversation;
        messageConversationRef.current = targetId;
        setActiveConversation(previousConversation);
      }
    }
  };

  // Download attachment
  const handleDownloadAttachment = async (
    messageId,
    attachmentIndex,
    originalName
  ) => {
    let downloadUrl = "";

    try {
      const response = await api.get(
        `/chats/attachments/${messageId}/${attachmentIndex}/download`,
        { responseType: "blob" }
      );

      const blob = new Blob([response.data]);
      downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = originalName || "attachment";

      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("[CHAT] Attachment download failed:", error);
    } finally {
      if (downloadUrl) {
        window.setTimeout(() => {
          window.URL.revokeObjectURL(downloadUrl);
        }, 1000);
      }
    }
  };

  const activeOtherParticipant = useMemo(() => {
    if (!activeConversation || activeConversation.isGroup) {
      return null;
    }

    const found = activeConversation.participants?.find(
      (participant) => !isSelfUser(participant)
    );

    if (found) {
      const foundId = getEntityId(found);
      return workspaceUsersMap.get(foundId) || found;
    }

    if (
      activeConversation.lastMessage?.sender &&
      !isSelfUser(activeConversation.lastMessage.sender)
    ) {
      const senderId = getEntityId(activeConversation.lastMessage.sender);
      return (
        workspaceUsersMap.get(senderId) ||
        activeConversation.lastMessage.sender
      );
    }

    return null;
  }, [activeConversation, isSelfUser, workspaceUsersMap]);

  const activeChatTitle = useMemo(() => {
    if (!activeConversation) return "";

    if (activeConversation.isGroup) {
      return activeConversation.groupName || "Team Group";
    }

    if (activeOtherParticipant) {
      const name = getDisplayName(activeOtherParticipant, workspaceUsersMap);
      if (
        name &&
        name.toLowerCase() !== "chat" &&
        name.toLowerCase() !== "user"
      ) {
        return name;
      }
    }

    return "Direct Chat";
  }, [
    activeConversation,
    activeOtherParticipant,
    workspaceUsersMap,
  ]);

  const isOtherOnline = useMemo(() => {
    if (!activeOtherParticipant) return false;

    return onlineUserIds.has(getEntityId(activeOtherParticipant));
  }, [activeOtherParticipant, onlineUserIds]);

  const pinnedMessages = useMemo(
    () =>
      messages.filter(
        (message) =>
          message.isPinned && !message.isDeletedForEveryone
      ),
    [messages]
  );

  return (
    <div
      onClick={requestNotificationPermission}
      className="flex h-[calc(100vh-120px)] max-h-[calc(100vh-120px)] w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm font-sans"
    >
      <ChatSidebar
        conversations={conversations}
        workspaceUsers={workspaceUsers}
        activeConversation={activeConversation}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onlineUserIds={onlineUserIds}
        workspaceUsersMap={workspaceUsersMap}
        user={user}
        formatMessageTime={formatMessageTime}
        onSelectConversation={handleSelectConversation}
        onSelectContact={handleSelectContact}
        onDeleteConversation={handleDeleteConversation}
        pinnedConvIds={pinnedConvIds}
        onTogglePinConversation={handleTogglePinConversation}
        customChatOrder={customChatOrder}
        onReorderChats={handleReorderChats}
      />

      <div className="flex h-full flex-1 flex-col overflow-hidden bg-white">
        {activeConversation ? (
          <>
            <ChatHeader
              activeConversation={activeConversation}
              activeOtherParticipant={activeOtherParticipant}
              isOtherOnline={isOtherOnline}
              activeChatTitle={activeChatTitle}
              getUserInitials={getUserInitials}
              workspaceUsersMap={workspaceUsersMap}
              onOpenGroupModal={() => setIsGroupModalOpen(true)}
              onOpenGroupInfo={handleOpenGroupInfo}
              onDeleteConversation={handleDeleteConversation}
              onLeaveGroup={handleLeaveGroup}
              showMenu={showChatHeaderMenu}
              setShowMenu={setShowChatHeaderMenu}
              notificationPermission={notificationPermission}
              onRequestNotificationPermission={requestNotificationPermission}
            />

            <ChatMessageArea
              messages={messages}
              activeConversation={activeConversation}
              activeChatTitle={activeChatTitle}
              activeOtherParticipant={activeOtherParticipant}
              user={user}
              workspaceUsersMap={workspaceUsersMap}
              serverBaseUrl={serverBaseUrl}
              highlightedMsgId={highlightedMsgId}
              pinnedMessages={pinnedMessages}
              typingUsers={typingUsers}
              activeReactionPickerId={activeReactionPickerId}
              setActiveReactionPickerId={setActiveReactionPickerId}
              activeActionMenuId={activeActionMenuId}
              setActiveActionMenuId={setActiveActionMenuId}
              quickEmojis={QUICK_EMOJIS}
              emojiPalette={EMOJI_PALETTE}
              messagesScrollRef={messagesScrollRef}
              isSelfUser={isSelfUser}
              getDisplayName={getDisplayName}
              getUserInitials={getUserInitials}
              formatMessageTime={formatMessageTime}
              formatMessageDateHeader={formatMessageDateHeader}
              formatFileSize={formatFileSize}
              scrollToMessage={scrollToMessage}
              onReply={(message) => {
                setReplyingTo(message);
                textareaRef.current?.focus();
              }}
              onStartEdit={(message) => {
                setEditingMessage(message);
                setComposerText(message.text || "");
                textareaRef.current?.focus();
              }}
              onForward={(message) => {
                setForwardModalMsg(message);
                setForwardSelectedConvs([]);
              }}
              onToggleReaction={handleToggleReaction}
              onTogglePin={handleTogglePin}
              onDeleteMessage={handleDeleteMessage}
              onDownloadAttachment={handleDownloadAttachment}
            />

            <ChatInput
              composerText={composerText}
              setComposerText={setComposerText}
              selectedFiles={selectedFiles}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              editingMessage={editingMessage}
              setEditingMessage={setEditingMessage}
              showInputEmojiPicker={showInputEmojiPicker}
              setShowInputEmojiPicker={setShowInputEmojiPicker}
              emojiPalette={EMOJI_PALETTE}
              fileInputRef={fileInputRef}
              textareaRef={textareaRef}
              workspaceUsersMap={workspaceUsersMap}
              getDisplayName={getDisplayName}
              onSendMessage={handleSendMessage}
              onFilesSelected={handleFilesSelected}
              onRemoveFile={removeFile}
              emitTyping={emitTyping}
              priority={messagePriority}
              setPriority={setMessagePriority}
              groupMembers={activeConversation?.participants || []}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center bg-gray-50 p-8 text-center text-gray-400 select-none">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-[#5B5FC7] shadow-xs">
              <MessageSquare size={32} />
            </div>

            <h3 className="text-base font-bold text-gray-900">
              Workspace Chat
            </h3>

            <p className="mt-1 max-w-sm text-xs text-gray-500">
              Select a conversation or contact to start messaging in real time.
            </p>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs select-none">
          <div className="w-full max-w-md animate-in overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-[#5B5FC7]">
                  <Users size={18} />
                </div>

                <h3 className="text-base font-bold text-gray-900">
                  New Group Chat
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 transition hover:text-gray-700"
                aria-label="Close group dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  Group Name
                </label>

                <input
                  type="text"
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="e.g. Project Delivery, Design Hub..."
                  required
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-xs text-gray-900 focus:border-[#5B5FC7] focus:ring-2 focus:ring-[#5B5FC7]/15 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-gray-700">
                  Select Members ({selectedGroupMembers.length} selected)
                </label>

                <div className="mb-2 flex items-center rounded-xl border border-transparent bg-gray-100 px-3 py-1.5 transition focus-within:border-[#5B5FC7] focus-within:bg-white">
                  <Search size={14} className="mr-2 shrink-0 text-gray-400" />

                  <input
                    type="text"
                    value={groupSearchQuery}
                    onChange={(event) =>
                      setGroupSearchQuery(event.target.value)
                    }
                    placeholder="Search by real name..."
                    className="w-full bg-transparent text-xs text-gray-800 placeholder-gray-400 focus:outline-none"
                  />
                </div>

                <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/50 p-2">
                  {workspaceUsers
                    .filter((workspaceUser) => {
                      if (isSelfUser(workspaceUser)) return false;

                      const query = groupSearchQuery.toLowerCase();

                      return (
                        getDisplayName(
                          workspaceUser,
                          workspaceUsersMap
                        )
                          .toLowerCase()
                          .includes(query) ||
                        (workspaceUser.email || "")
                          .toLowerCase()
                          .includes(query)
                      );
                    })
                    .map((workspaceUser) => {
                      const userId = getEntityId(workspaceUser);
                      const isSelected =
                        selectedGroupMembers.includes(userId);

                      const name = getDisplayName(
                        workspaceUser,
                        workspaceUsersMap
                      );

                      const initials = getUserInitials(
                        workspaceUser,
                        workspaceUsersMap
                      );

                      return (
                        <button
                          type="button"
                          key={userId}
                          onClick={() =>
                            setSelectedGroupMembers((previous) =>
                              previous.includes(userId)
                                ? previous.filter((id) => id !== userId)
                                : [...previous, userId]
                            )
                          }
                          className={`flex w-full items-center justify-between rounded-xl border p-2 text-left transition ${
                            isSelected
                              ? "border-indigo-200 bg-indigo-50 text-indigo-900"
                              : "border-transparent text-gray-800 hover:bg-white"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[10px] font-bold text-emerald-800">
                              {initials}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold">
                                {name}
                              </p>

                              <span className="text-[10px] capitalize text-gray-500">
                                {workspaceUser.role}
                              </span>
                            </div>
                          </div>

                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                              isSelected
                                ? "border-[#5B5FC7] bg-[#5B5FC7] text-white"
                                : "border-gray-300 bg-white"
                            }`}
                          >
                            {isSelected && <Check size={12} />}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-100"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    !groupName.trim() ||
                    selectedGroupMembers.length === 0 ||
                    creatingGroup
                  }
                  className={`rounded-xl px-5 py-2 text-xs font-bold shadow-xs transition ${
                    groupName.trim() &&
                    selectedGroupMembers.length > 0 &&
                    !creatingGroup
                      ? "bg-[#5B5FC7] text-white hover:bg-[#4a4ea8]"
                      : "cursor-not-allowed bg-gray-200 text-gray-400"
                  }`}
                >
                  {creatingGroup ? "Creating..." : "Create Group Chat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forward Message Modal */}
      {forwardModalMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs select-none">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
              <h3 className="text-sm font-bold text-gray-900">
                Forward Message
              </h3>

              <button
                type="button"
                onClick={() => {
                  setForwardModalMsg(null);
                  setForwardSelectedConvs([]);
                }}
                className="rounded-lg p-1 text-gray-400 hover:text-gray-700"
                aria-label="Close forward dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 p-4">
              <div className="line-clamp-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs italic text-gray-600">
                "{forwardModalMsg.text || "Attachment"}"
              </div>

              <div className="max-h-48 space-y-1 overflow-y-auto">
                {conversations.map((conversation) => {
                  const conversationId = getEntityId(conversation);
                  const isSelected =
                    forwardSelectedConvs.includes(conversationId);

                  const title = conversation.isGroup
                    ? conversation.groupName || "Team Group"
                    : getDisplayName(
                        conversation.participants?.find(
                          (participant) => !isSelfUser(participant)
                        ),
                        workspaceUsersMap
                      );

                  return (
                    <button
                      type="button"
                      key={conversationId}
                      onClick={() =>
                        setForwardSelectedConvs((previous) =>
                          isSelected
                            ? previous.filter(
                                (id) => id !== conversationId
                              )
                            : [...previous, conversationId]
                        )
                      }
                      className={`flex w-full items-center justify-between rounded-xl p-2 text-left text-xs font-semibold ${
                        isSelected
                          ? "bg-indigo-50 text-[#5B5FC7]"
                          : "text-gray-800 hover:bg-gray-100"
                      }`}
                    >
                      <span>{title}</span>

                      {isSelected && (
                        <Check size={14} className="text-[#5B5FC7]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 p-3">
              <button
                type="button"
                onClick={() => {
                  setForwardModalMsg(null);
                  setForwardSelectedConvs([]);
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleForwardMessage}
                disabled={forwardSelectedConvs.length === 0}
                className="rounded-lg bg-[#5B5FC7] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#4a4ea8] disabled:opacity-50"
              >
                Forward
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Info & Member Management Modal */}
      {isGroupInfoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs select-none">
          <div className="w-full max-w-md animate-in overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700 shadow-xs">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 leading-tight">
                    {activeConversation?.groupName || "Team Group"}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    {groupMembersList.length} {groupMembersList.length === 1 ? "member" : "members"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsGroupInfoModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close group info"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center rounded-xl border border-transparent bg-gray-100 px-3 py-1.5 transition focus-within:border-[#5B5FC7] focus-within:bg-white">
                <Search size={14} className="mr-2 shrink-0 text-gray-400" />
                <input
                  type="text"
                  value={groupMemberSearch}
                  onChange={(e) => setGroupMemberSearch(e.target.value)}
                  placeholder="Search members..."
                  className="w-full bg-transparent text-xs text-gray-800 placeholder-gray-400 focus:outline-none"
                />
              </div>

              {groupInfoLoading ? (
                <div className="py-8 text-center text-xs text-gray-400">Loading members...</div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-1">
                    Members ({groupMembersList.length})
                  </div>

                  <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-2xs">
                    {groupMembersList
                      .filter((member) => {
                        if (!groupMemberSearch) return true;
                        const q = groupMemberSearch.toLowerCase();
                        const name = getDisplayName(member, workspaceUsersMap).toLowerCase();
                        const email = (member.email || "").toLowerCase();
                        const role = (member.role || "").toLowerCase();
                        return name.includes(q) || email.includes(q) || role.includes(q);
                      })
                      .map((member) => {
                        const memberId = getEntityId(member);
                        const adminId = getEntityId(groupAdminUser || activeConversation?.groupAdmin);
                        const isThisMemberAdmin = Boolean(adminId && memberId === adminId);
                        const isMe = memberId === myUserId;
                        const canManageGroup =
                          myUserId === adminId ||
                          String(user?.role || "").toLowerCase() === "admin";

                        const name = getDisplayName(member, workspaceUsersMap) || "Member";
                        const initials = getUserInitials(member, workspaceUsersMap);

                        return (
                          <div
                            key={memberId}
                            className="flex items-center justify-between gap-3 p-3 transition hover:bg-gray-50/80"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative shrink-0">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-xs font-bold text-purple-800 shadow-2xs">
                                  {initials}
                                </div>
                                <span
                                  className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                                    onlineUserIds.has(memberId)
                                      ? "bg-blue-500"
                                      : "bg-gray-300"
                                  }`}
                                  title={
                                    onlineUserIds.has(memberId)
                                      ? "Active now"
                                      : "Offline"
                                  }
                                />
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-gray-900 truncate">
                                    {name}
                                  </span>
                                  {isMe && (
                                    <span className="text-[10px] font-medium text-gray-400">
                                      (You)
                                    </span>
                                  )}
                                  {isThisMemberAdmin && (
                                    <span className="flex items-center gap-0.5 rounded bg-purple-50 px-1.5 py-0.5 text-[9px] font-bold text-purple-700 border border-purple-200">
                                      <ShieldCheck size={10} />
                                      <span>Admin</span>
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-gray-500 truncate capitalize">
                                  {member.role || "Member"}
                                  {member.department ? ` • ${member.department}` : ""}
                                </p>
                              </div>
                            </div>

                            {canManageGroup && !isThisMemberAdmin && !isMe && (
                              <button
                                type="button"
                                onClick={() => handleRemoveGroupMember(memberId)}
                                className="flex shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-600 transition hover:bg-red-100 hover:border-red-300"
                                title="Remove member from group"
                              >
                                <UserMinus size={13} />
                                <span className="hidden sm:inline">Remove</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              {(myUserId === getEntityId(groupAdminUser || activeConversation?.groupAdmin) ||
                String(user?.role || "").toLowerCase() === "admin") ? (
                <button
                  type="button"
                  onClick={handleDeleteGroup}
                  className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 shadow-2xs transition hover:bg-red-50 hover:border-red-300"
                >
                  <Trash2 size={13} />
                  <span>Delete Group</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setIsGroupInfoModalOpen(false)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
