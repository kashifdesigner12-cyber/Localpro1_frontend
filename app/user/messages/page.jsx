"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCheck,
  ClipboardList,
  Clock3,
  File,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  MoreVertical,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { authService } from "@/services/authService";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.localpro1.net/api";

const BACKEND_BASE_URL = API_URL.replace(/\/api\/?$/, "");

const getFileUrl = (url) => {
  if (!url) return "#";

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${BACKEND_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

/* ============================================================
   AUDIO SYNTHESIZER
============================================================ */

const playNotificationChime = () => {
  try {
    if (typeof window === "undefined") return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const createNote = (frequency, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, startTime);

      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        startTime + duration
      );

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    createNote(1318.51, now, 0.12);
    createNote(1760, now + 0.08, 0.32);
  } catch (err) {
    console.warn("Chime playback error:", err);
  }
};

/* ============================================================
   SIDEBAR NAVIGATION
============================================================ */

const navigation = [
  { label: "Dashboard", href: "/user", icon: LayoutDashboard },
  { label: "My Tasks", href: "/user/tasks", icon: ClipboardList },
  { label: "Calendar", href: "/user/calendar", icon: CalendarDays },
  { label: "Attendance", href: "/user/attendance", icon: Clock3 },
  { label: "Messages", href: "/user/messages", icon: MessageSquare },
  { label: "Notifications", href: "/user/notifications", icon: Bell },
  { label: "Leave Requests", href: "/user/leave-requests", icon: FileText },
  { label: "Profile", href: "/user/profile", icon: UserRound },
  { label: "Settings", href: "/user/settings", icon: Settings },
  { label: "Policies", href: "/user/policies", icon: ShieldCheck },
];

/* ============================================================
   USER MESSAGES PAGE
============================================================ */

export default function UserMessagesPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [messagesError, setMessagesError] = useState("");

  const [currentUser, setCurrentUser] = useState(() =>
    extractUser(authService?.getUser?.())
  );

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [deletingMessage, setDeletingMessage] = useState(false);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const selectedConversationRef = useRef(null);

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  const scrollToBottom = (instant = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: instant ? "auto" : "smooth",
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /* ============================================================
     LOAD CONVERSATIONS
  ============================================================ */

  const loadConversations = useCallback(async () => {
    try {
      setError("");

      const me = await authService.me();
      const user = extractUser(me);

      if (!user) {
        window.location.href = "/login";
        return;
      }

      setCurrentUser(user);

      const response = await safeApiRequest("/conversations", null);

      const backendConversations = normalizeConversations(response);
      const backendContacts = normalizeContacts(response);

      setConversations(backendConversations);
      setContacts(backendContacts);
    } catch (err) {
      console.error("User conversations error:", err);

      if (err?.status === 401) {
        window.location.href = "/login";
        return;
      }

      setError(err?.message || "Unable to load conversations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  /* ============================================================
     POLLING
  ============================================================ */

  useEffect(() => {
    const interval = setInterval(async () => {
      const activeConv = selectedConversationRef.current;
      const conversationId = getConversationId(activeConv);

      if (!conversationId) return;

      try {
        const response = await getConversationMessages(conversationId);
        const fetchedMessages = normalizeMessages(response);

        setMessages((prevMessages) => {
          if (fetchedMessages.length > prevMessages.length) {
            const latestMsg =
              fetchedMessages[fetchedMessages.length - 1];

            const senderId = getUserId(latestMsg?.sender);
            const myId = getUserId(currentUser);

            if (
              soundEnabled &&
              senderId &&
              myId &&
              senderId.toString() !== myId.toString()
            ) {
              playNotificationChime();
            }

            return fetchedMessages;
          }

          return prevMessages;
        });
      } catch {}
    }, 4000);

    return () => clearInterval(interval);
  }, [currentUser, soundEnabled]);

  /* ============================================================
     DISPLAY CONVERSATIONS
  ============================================================ */

  const displayConversations = useMemo(() => {
    const conversationByUserId = new Map();

    conversations.forEach((conversation) => {
      const participant = getOtherParticipant(
        conversation,
        currentUser
      );

      const participantId = getUserId(participant);

      if (participantId) {
        conversationByUserId.set(
          participantId.toString(),
          conversation
        );
      }
    });

    const contactItems = contacts.map((contact) => {
      const contactId = getUserId(contact);

      const existing = contactId
        ? conversationByUserId.get(contactId.toString())
        : null;

      if (existing) {
        return existing;
      }

      return {
        id: null,
        _id: null,
        participants: [contact],
        contact,
        lastMessage: "",
        lastMessageAt: null,
        updatedAt: null,
        createdAt: null,
        unreadCount: 0,
        unread: 0,
        status: "new",
        channel: "chat",
        isNewContact: true,
      };
    });

    const contactIds = new Set(
      contacts
        .map(getUserId)
        .filter(Boolean)
        .map((id) => id.toString())
    );

    const unmatchedConversations = conversations.filter(
      (conversation) => {
        const participant = getOtherParticipant(
          conversation,
          currentUser
        );

        const participantId = getUserId(participant);

        return (
          !participantId ||
          !contactIds.has(participantId.toString())
        );
      }
    );

    return [...contactItems, ...unmatchedConversations];
  }, [contacts, conversations, currentUser]);

  /* ============================================================
     FILTER
  ============================================================ */

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return displayConversations;
    }

    return displayConversations.filter((conversation) => {
      const name = getParticipantName(
        conversation,
        currentUser
      );

      const email = getParticipantEmail(
        conversation,
        currentUser
      );

      const role = getParticipantRole(
        conversation,
        currentUser
      );

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
  }, [displayConversations, search, currentUser]);

  /* ============================================================
     FILE HANDLING
  ============================================================ */

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    setSelectedFiles((prev) =>
      [...prev, ...files].slice(0, 5)
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles((prev) =>
      prev.filter((_, i) => i !== index)
    );
  };

  /* ============================================================
     SELECT CONVERSATION
  ============================================================ */

  async function handleSelectConversation(item) {
    if (!item) return;

    setMessages([]);
    setMessagesError("");
    setSelectedFiles([]);

    let conversation = item;
    let conversationId = getConversationId(conversation);

    try {
      setMessagesLoading(true);

      if (!conversationId && conversation?.isNewContact) {
        const contact = getOtherParticipant(
          conversation,
          currentUser
        );

        const recipientId = getUserId(contact);

        if (!recipientId) {
          throw new Error(
            "Selected user does not have a valid user ID."
          );
        }

        const response = await apiRequest(
          "/conversations",
          {
            method: "POST",
            body: JSON.stringify({
              recipientId,
            }),
          }
        );

        const created =
          response?.conversation ||
          response?.data?.conversation ||
          response?.data;

        if (!created) {
          throw new Error(
            "Backend did not return the created conversation."
          );
        }

        conversation = created;
        conversationId = getConversationId(created);

        setConversations((current) => {
          const exists = current.some(
            (item) =>
              getConversationId(item) === conversationId
          );

          return exists
            ? current
            : [...current, created];
        });
      }

      if (!conversationId) {
        throw new Error(
          "This conversation does not have a valid ID."
        );
      }

      setSelectedConversation(conversation);

      const unreadCount = Number(
        conversation?.unreadCount ||
          conversation?.unread ||
          0
      );

      if (unreadCount > 0) {
        try {
          await markConversationRead(conversationId);

          setConversations((current) =>
            current.map((item) => {
              if (
                getConversationId(item) !==
                conversationId
              ) {
                return item;
              }

              return {
                ...item,
                unreadCount: 0,
                unread: 0,
              };
            })
          );
        } catch {}
      }

      const response =
        await getConversationMessages(conversationId);

      const fetched = normalizeMessages(response);

      setMessages(fetched);
    } catch (err) {
      console.error(
        "Conversation selection error:",
        err
      );

      if (err?.status === 401) {
        window.location.href = "/login";
        return;
      }

      setMessagesError(
        err?.message ||
          "Unable to open conversation."
      );
    } finally {
      setMessagesLoading(false);
    }
  }

  /* ============================================================
     SEND MESSAGE
  ============================================================ */

  async function handleSendMessage(event) {
    event.preventDefault();

    const body = message.trim();

    if (
      (!body && selectedFiles.length === 0) ||
      !selectedConversation ||
      sending
    ) {
      return;
    }

    let conversationId =
      getConversationId(selectedConversation);

    const contact = getOtherParticipant(
      selectedConversation,
      currentUser
    );

    const recipientId = getUserId(contact);

    const tempId = `temp-${Date.now()}`;

    const optimisticMsg = {
      _id: tempId,
      id: tempId,
      body: body,
      message: body,
      sender: currentUser || {
        role: "user",
        name: "You",
      },
      createdAt: new Date().toISOString(),
      attachments: selectedFiles.map((f) => ({
        filename: f.name,
        originalName: f.name,
        mimeType: f.type,
      })),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setMessage("");

    const filesToSend = [...selectedFiles];

    setSelectedFiles([]);
    scrollToBottom(true);

    try {
      setSending(true);
      setMessagesError("");

      if (!conversationId) {
        if (!recipientId) {
          throw new Error("Recipient user ID is missing.");
        }

        const createResponse = await apiRequest(
          "/conversations",
          {
            method: "POST",
            body: JSON.stringify({
              recipientId,
            }),
          }
        );

        const created =
          createResponse?.conversation ||
          createResponse?.data?.conversation ||
          createResponse?.data;

        if (!created) {
          throw new Error(
            "Unable to create conversation."
          );
        }

        conversationId = getConversationId(created);

        setSelectedConversation(created);

        setConversations((current) => {
          const exists = current.some(
            (item) =>
              getConversationId(item) ===
              conversationId
          );

          return exists
            ? current
            : [...current, created];
        });
      }

      let response;

      if (filesToSend.length > 0) {
        const formData = new FormData();

        formData.append("body", body);
        formData.append(
          "recipientId",
          String(recipientId || "")
        );
        formData.append(
          "conversationId",
          String(conversationId)
        );

        filesToSend.forEach((file) => {
          formData.append("files", file);
        });

        let token = "";

        try {
          token =
            localStorage.getItem("token") ||
            localStorage.getItem("authToken") ||
            "";
        } catch {}

        const res = await fetch(
          `${API_URL}/messages`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              Accept: "application/json",
              ...(token
                ? {
                    Authorization: `Bearer ${token}`,
                  }
                : {}),
            },
            body: formData,
          }
        );

        let responseData = null;

        try {
          const text = await res.text();

          if (text) {
            responseData = JSON.parse(text);
          }
        } catch {}

        if (!res.ok) {
          throw new Error(
            responseData?.message ||
              "Failed to send file."
          );
        }

        response = responseData;
      } else {
        response = await apiRequest(
          `/conversations/${conversationId}/messages`,
          {
            method: "POST",
            body: JSON.stringify({
              body,
              message: body,
              messageType: "text",
              channel: "chat",
              direction: "internal",
            }),
          }
        );
      }

      const sentMessage =
        response?.data ||
        response?.messageData ||
        response?.message ||
        null;

      if (
        sentMessage &&
        typeof sentMessage === "object"
      ) {
        setMessages((current) =>
          current.map((m) =>
            m.id === tempId ||
            m._id === tempId
              ? sentMessage
              : m
          )
        );
      }

      await refreshConversations(
        conversationId
      );
    } catch (err) {
      console.error(
        "Send message error:",
        err
      );

      if (err?.status === 401) {
        window.location.href = "/login";
        return;
      }

      setMessagesError(
        err?.message ||
          "Unable to send message."
      );

      setMessages((prev) =>
        prev.filter(
          (m) =>
            m.id !== tempId &&
            m._id !== tempId
        )
      );
    } finally {
      setSending(false);
    }
  }

  /* ============================================================
     DELETE MESSAGE
  ============================================================ */

  function promptDeleteMessage(msg) {
    setMessageToDelete(msg);
    setDeleteModalOpen(true);
  }

  async function executeDeleteMessage(type) {
    if (!messageToDelete) return;

    const messageId =
      messageToDelete?._id ||
      messageToDelete?.id;

    if (!messageId) return;

    try {
      setDeletingMessage(true);

      const endpoint =
        type === "everyone"
          ? `/messages/${messageId}/delete-for-everyone`
          : `/messages/${messageId}/delete-for-me`;

      const response = await apiRequest(
        endpoint,
        {
          method: "POST",
        }
      );

      if (type === "me") {
        setMessages((prev) =>
          prev.filter(
            (m) =>
              String(
                m?._id || m?.id
              ) !==
              String(messageId)
          )
        );
      } else {
        const updatedMsg =
          response?.data ||
          response?.message;

        setMessages((prev) =>
          prev.map((m) => {
            if (
              String(
                m?._id || m?.id
              ) !==
              String(messageId)
            ) {
              return m;
            }

            return {
              ...m,
              ...(updatedMsg || {}),
              body: "This message was deleted",
              message:
                "This message was deleted",
              isDeletedForEveryone: true,
              attachments: [],
            };
          })
        );
      }

      setDeleteModalOpen(false);
      setMessageToDelete(null);

      const conversationId =
        getConversationId(
          selectedConversation
        );

      if (conversationId) {
        refreshConversations(
          conversationId
        );
      }
    } catch (delError) {
      console.error(
        "Delete message failed:",
        delError
      );

      alert(
        delError?.message ||
          "Failed to delete message."
      );
    } finally {
      setDeletingMessage(false);
    }
  }

  /* ============================================================
     REFRESH CONVERSATIONS
  ============================================================ */

  async function refreshConversations(
    selectedId = null
  ) {
    try {
      const response = await apiRequest(
        "/conversations",
        {
          method: "GET",
        }
      );

      const normalized =
        normalizeConversations(response);

      const normalizedContacts =
        normalizeContacts(response);

      setConversations(normalized);
      setContacts(normalizedContacts);

      if (selectedId) {
        const updated = normalized.find(
          (conversation) =>
            getConversationId(
              conversation
            ) === selectedId
        );

        if (updated) {
          setSelectedConversation(
            updated
          );
        }
      }
    } catch (err) {
      if (err?.status === 401) {
        window.location.href = "/login";
      }
    }
  }

  /* ============================================================
     USER DATA
  ============================================================ */

  const selectedName = selectedConversation
    ? getParticipantName(
        selectedConversation,
        currentUser
      )
    : "Select a Contact";

  const selectedEmail = selectedConversation
    ? getParticipantEmail(
        selectedConversation,
        currentUser
      )
    : "";

  const selectedRole = selectedConversation
    ? getParticipantRole(
        selectedConversation,
        currentUser
      )
    : "";

  const userName =
    currentUser?.name ||
    currentUser?.fullName ||
    currentUser?.displayName ||
    currentUser?.email ||
    "User";

  const userEmail =
    currentUser?.email ||
    "User Account";

  const userInitial =
    String(userName)
      .trim()
      .charAt(0)
      .toUpperCase() || "U";

  async function handleLogout() {
    try {
      await authService.logout();
    } catch {}

    window.location.href = "/login";
  }

  return (
    <div className="relative flex h-screen min-h-0 w-full overflow-hidden bg-[#f7f8fc] text-slate-950">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl animate-pulse" />

        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-pink-400/10 blur-3xl" />

        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() =>
            setSidebarOpen(false)
          }
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#171B3A] text-white shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <Link
            href="/user"
            onClick={() =>
              setSidebarOpen(false)
            }
            className="flex items-center gap-3 text-white"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-md shadow-purple-600/20">
              <ShieldCheck size={22} />
            </div>

            <div>
              <h1 className="text-sm font-bold text-white">
                Local Pro 1
              </h1>

              <p className="text-[11px] font-semibold text-violet-400">
                User Workspace
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() =>
              setSidebarOpen(false)
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition hover:bg-white/10 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Workspace
          </p>

          <div className="space-y-1.5">
            {navigation.map((item) => (
              <UserNavItem
                key={item.href}
                item={item}
                onNavigate={() =>
                  setSidebarOpen(false)
                }
              />
            ))}
          </div>
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-600 text-xs font-bold text-white">
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={userName}
                  className="h-full w-full object-cover"
                />
              ) : (
                userInitial
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                {userName}
              </p>

              <p className="truncate text-xs font-medium text-slate-400">
                {userEmail}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut size={17} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden w-full">
        {/* Top Bar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-5 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

            <div>
              <p className="text-xs font-semibold text-slate-400">
                Workspace
              </p>

              <p className="text-sm font-bold text-slate-900">
                Messages
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const nextState =
                  !soundEnabled;

                setSoundEnabled(
                  nextState
                );

                if (nextState) {
                  playNotificationChime();
                }
              }}
              className={`flex h-9 items-center gap-1.5 rounded-2xl border px-3 text-xs font-bold transition ${
                soundEnabled
                  ? "border-violet-200 bg-violet-50 text-violet-700"
                  : "border-slate-200 bg-white text-slate-400"
              }`}
              title={
                soundEnabled
                  ? "Notification sound is ON"
                  : "Notification sound is MUTED"
              }
            >
              {soundEnabled ? (
                <Volume2 size={15} />
              ) : (
                <VolumeX size={15} />
              )}

              <span className="hidden sm:inline">
                {soundEnabled
                  ? "Sound ON"
                  : "Muted"}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                loadConversations()
              }
              disabled={loading}
              className="inline-flex h-9 items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={
                  loading
                    ? "animate-spin text-violet-600"
                    : ""
                }
              />

              <span className="hidden sm:inline">
                Refresh
              </span>
            </button>

            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-sm">
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={userName}
                  className="h-full w-full object-cover"
                />
              ) : (
                userInitial
              )}
            </div>
          </div>
        </header>

        {/* Workspace */}
        <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 animate-slideUp sm:p-5 lg:p-6">
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
            {error && (
              <section className="shrink-0 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
                <p>{error}</p>
              </section>
            )}

            <section className="grid h-full min-h-0 min-w-0 flex-1 w-full grid-cols-1 grid-rows-[280px_minmax(0,1fr)] overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)] lg:grid-cols-[360px_minmax(0,1fr)] lg:grid-rows-1">
              {/* Contacts */}
              <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-b border-slate-100 lg:border-b-0 lg:border-r">
                <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 p-4 sm:p-5">
                  <div className="mb-3.5">
                    <h2 className="text-base font-extrabold text-slate-900">
                      Team Contacts
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-400">
                      Select a team member to chat
                    </p>
                  </div>

                  <div className="relative">
                    <Search
                      size={16}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      type="text"
                      value={search}
                      onChange={(e) =>
                        setSearch(
                          e.target.value
                        )
                      }
                      placeholder="Search contacts..."
                      className="h-10 w-full rounded-2xl border border-slate-200/90 bg-white pl-9 pr-3 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                    />
                  </div>
                </div>

                {/* Independent Contacts Scroll */}
                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
                  {loading &&
                  conversations.length === 0 ? (
                    <ConversationLoading />
                  ) : filteredConversations.length > 0 ? (
                    filteredConversations.map(
                      (
                        conversation,
                        index
                      ) => {
                        const id =
                          getConversationId(
                            conversation
                          );

                        const participant =
                          getOtherParticipant(
                            conversation,
                            currentUser
                          );

                        const participantId =
                          getUserId(
                            participant
                          );

                        const name =
                          getParticipantName(
                            conversation,
                            currentUser
                          );

                        const email =
                          getParticipantEmail(
                            conversation,
                            currentUser
                          );

                        const role =
                          getParticipantRole(
                            conversation,
                            currentUser
                          );

                        const avatar =
                          getParticipantAvatar(
                            conversation,
                            currentUser
                          );

                        const lastMessage =
                          conversation?.lastMessage ||
                          conversation?.lastMessageText ||
                          conversation?.preview ||
                          "No messages yet";

                        const unread =
                          Number(
                            conversation?.unreadCount ||
                              conversation?.unread ||
                              0
                          );

                        const active =
                          selectedConversation &&
                          (id
                            ? getConversationId(
                                selectedConversation
                              ) === id
                            : getUserId(
                                getOtherParticipant(
                                  selectedConversation,
                                  currentUser
                                )
                              ) ===
                              participantId);

                        return (
                          <button
                            key={
                              id ||
                              participantId ||
                              `contact-${index}`
                            }
                            type="button"
                            onClick={() =>
                              handleSelectConversation(
                                conversation
                              )
                            }
                            className={`flex w-full items-start gap-3 border-b border-slate-100/80 px-4 py-3.5 text-left transition duration-150 ${
                              active
                                ? "border-violet-200/60 bg-violet-50/70"
                                : "hover:bg-slate-50/80"
                            }`}
                          >
                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-sm">
                              {avatar ? (
                                <img
                                  src={avatar}
                                  alt={name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                getInitials(
                                  name
                                )
                              )}

                              {unread > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white shadow-sm">
                                  {unread >
                                  99
                                    ? "99+"
                                    : unread}
                                </span>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p
                                  className={`truncate text-xs ${
                                    unread >
                                    0
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

                              {email && (
                                <p className="mt-0.5 truncate text-[10px] text-slate-400">
                                  {email}
                                </p>
                              )}

                              {role && (
                                <p className="mt-0.5 text-[9px] font-bold uppercase text-violet-600">
                                  {role}
                                </p>
                              )}

                              <p className="mt-1 truncate text-xs text-slate-500">
                                {lastMessage}
                              </p>
                            </div>
                          </button>
                        );
                      }
                    )
                  ) : (
                    <EmptyConversationList
                      search={search}
                    />
                  )}
                </div>
              </aside>

              {/* Chat */}
              <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
                {/* Chat Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5 sm:px-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-md shadow-purple-500/10">
                      {selectedConversation &&
                      getParticipantAvatar(
                        selectedConversation,
                        currentUser
                      ) ? (
                        <img
                          src={getParticipantAvatar(
                            selectedConversation,
                            currentUser
                          )}
                          alt={
                            selectedName
                          }
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <MessageSquare
                          size={18}
                        />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-extrabold text-slate-900">
                        {selectedName}
                      </h2>

                      <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />

                        <p className="truncate text-xs font-semibold text-violet-600">
                          {selectedConversation
                            ? selectedEmail ||
                              selectedRole ||
                              "Active Chat"
                            : "Choose a contact to start messaging"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Independent Messages Scroll */}
                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6">
                  {!selectedConversation ? (
                    <NoConversationSelected />
                  ) : messagesLoading ? (
                    <MessagesLoading />
                  ) : messagesError ? (
                    <MessageError
                      message={
                        messagesError
                      }
                    />
                  ) : messages.length === 0 ? (
                    <NoMessages />
                  ) : (
                    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3.5">
                      {messages.map(
                        (
                          item,
                          index
                        ) => (
                          <MessageBubble
                            key={
                              item?._id ||
                              item?.id ||
                              `${
                                item?.createdAt ||
                                "message"
                              }-${index}`
                            }
                            message={item}
                            currentUser={
                              currentUser
                            }
                            onDeletePrompt={
                              promptDeleteMessage
                            }
                          />
                        )
                      )}

                      <div
                        ref={
                          messagesEndRef
                        }
                      />
                    </div>
                  )}
                </div>

                {/* Composer - Always Visible */}
                <div className="shrink-0 border-t border-slate-100 bg-white p-4 sm:p-5">
                  {selectedFiles.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {selectedFiles.map(
                        (
                          file,
                          idx
                        ) => (
                          <div
                            key={`${file.name}-${idx}`}
                            className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/70 px-3 py-1.5 text-xs text-violet-800"
                          >
                            {file.type.startsWith(
                              "image/"
                            ) ? (
                              <ImageIcon
                                size={14}
                                className="text-violet-600"
                              />
                            ) : (
                              <File
                                size={14}
                                className="text-violet-600"
                              />
                            )}

                            <span className="max-w-[150px] truncate font-semibold">
                              {file.name}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                removeSelectedFile(
                                  idx
                                )
                              }
                              className="ml-1 rounded-md text-violet-400 hover:bg-violet-200/50 hover:text-rose-600"
                            >
                              <X
                                size={
                                  13
                                }
                              />
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <form
                    onSubmit={
                      handleSendMessage
                    }
                    className="flex items-end gap-2.5"
                  >
                    <input
                      type="file"
                      multiple
                      ref={
                        fileInputRef
                      }
                      onChange={
                        handleFileChange
                      }
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        fileInputRef.current?.click()
                      }
                      disabled={
                        !selectedConversation ||
                        sending
                      }
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-slate-50/50 text-slate-500 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Attach file"
                    >
                      <Paperclip
                        size={18}
                      />
                    </button>

                    <div className="min-w-0 flex-1">
                      <textarea
                        value={
                          message
                        }
                        onChange={(e) =>
                          setMessage(
                            e.target.value
                          )
                        }
                        onKeyDown={(e) => {
                          if (
                            e.key ===
                              "Enter" &&
                            !e.shiftKey
                          ) {
                            e.preventDefault();

                            if (
                              (message.trim() ||
                                selectedFiles.length >
                                  0) &&
                              selectedConversation &&
                              !sending
                            ) {
                              handleSendMessage(
                                e
                              );
                            }
                          }
                        }}
                        placeholder={
                          selectedConversation
                            ? `Message ${selectedName} or attach files...`
                            : "Select a contact first..."
                        }
                        rows={1}
                        disabled={
                          !selectedConversation ||
                          sending
                        }
                        className="min-h-11 max-h-32 w-full resize-none rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 py-3 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={
                        (!message.trim() &&
                          selectedFiles.length ===
                            0) ||
                        !selectedConversation ||
                        sending
                      }
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-600/25 transition duration-150 hover:-translate-y-0.5 hover:bg-violet-700 active:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                      aria-label="Send message"
                    >
                      {sending ? (
                        <Loader2
                          size={17}
                          className="animate-spin"
                        />
                      ) : (
                        <Send
                          size={17}
                        />
                      )}
                    </button>
                  </form>

                  <p className="mt-2 px-1 text-[10px] text-slate-400">
                    Enter to send • Shift +
                    Enter for a new line •
                    Click Paperclip to add
                    files
                  </p>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* Delete Modal */}
      {deleteModalOpen &&
        messageToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                  <Trash2
                    size={20}
                  />
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Delete Message?
                  </h3>

                  <p className="text-xs text-slate-400">
                    Choose how you want to
                    delete this message.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs italic text-slate-600">
                &ldquo;
                {messageToDelete?.isDeletedForEveryone
                  ? "This message was deleted"
                  : messageToDelete?.body ||
                    messageToDelete?.message ||
                    (messageToDelete
                      ?.attachments
                      ?.length > 0
                      ? "Attachment"
                      : "Message")}
                &rdquo;
              </div>

              <div className="mt-6 flex flex-col gap-2.5">
                {getUserId(
                  messageToDelete?.sender
                )?.toString() ===
                  getUserId(
                    currentUser
                  )?.toString() &&
                  !messageToDelete?.isDeletedForEveryone && (
                    <button
                      type="button"
                      disabled={
                        deletingMessage
                      }
                      onClick={() =>
                        executeDeleteMessage(
                          "everyone"
                        )
                      }
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 text-xs font-bold text-white shadow-md shadow-rose-600/20 transition hover:bg-rose-700 disabled:opacity-50"
                    >
                      {deletingMessage ? (
                        <Loader2
                          size={15}
                          className="animate-spin"
                        />
                      ) : (
                        <Users
                          size={15}
                        />
                      )}

                      Delete for Everyone
                    </button>
                  )}

                <button
                  type="button"
                  disabled={
                    deletingMessage
                  }
                  onClick={() =>
                    executeDeleteMessage(
                      "me"
                    )
                  }
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {deletingMessage ? (
                    <Loader2
                      size={15}
                      className="animate-spin"
                    />
                  ) : (
                    <Trash2
                      size={15}
                    />
                  )}

                  Delete for Me
                </button>

                <button
                  type="button"
                  disabled={
                    deletingMessage
                  }
                  onClick={() => {
                    setDeleteModalOpen(
                      false
                    );
                    setMessageToDelete(
                      null
                    );
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

/* ============================================================
   MESSAGE BUBBLE
============================================================ */

function MessageBubble({
  message,
  currentUser,
  onDeletePrompt,
}) {
  const [menuOpen, setMenuOpen] =
    useState(false);

  const menuRef = useRef(null);

  const senderId = getUserId(
    message?.sender
  );

  const currentUserId = getUserId(
    currentUser
  );

  const isOutgoing =
    senderId &&
    currentUserId &&
    senderId.toString() ===
      currentUserId.toString();

  const isDeleted = Boolean(
    message?.isDeletedForEveryone
  );

  const body = isDeleted
    ? "This message was deleted"
    : message?.body ||
      message?.message ||
      message?.text ||
      message?.content ||
      "";

  const sender =
    message?.sender?.name ||
    message?.senderName ||
    message?.from?.name ||
    "";

  useEffect(() => {
    function handleClickOutside(
      event
    ) {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target
        )
      ) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener(
        "mousedown",
        handleClickOutside
      );
    }

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, [menuOpen]);

  return (
    <div
      className={`group relative flex w-full items-center gap-2.5 ${
        isOutgoing
          ? "justify-end"
          : "justify-start"
      }`}
    >
      {isOutgoing &&
        !isDeleted && (
          <div
            className="relative opacity-0 transition-opacity group-hover:opacity-100"
            ref={menuRef}
          >
            <button
              type="button"
              onClick={() =>
                setMenuOpen(
                  !menuOpen
                )
              }
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Message options"
            >
              <MoreVertical
                size={14}
              />
            </button>

            {menuOpen && (
              <div className="absolute bottom-full right-0 z-20 mb-1 w-40 overflow-hidden rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(
                      false
                    );
                    onDeletePrompt(
                      message
                    );
                  }}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                >
                  <Trash2
                    size={13}
                  />
                  Delete Message
                </button>
              </div>
            )}
          </div>
        )}

      <div
        className={`max-w-[82%] rounded-[20px] px-4 py-3 shadow-sm sm:max-w-[72%] ${
          isDeleted
            ? "border border-slate-200/80 bg-slate-50 italic text-slate-400"
            : isOutgoing
            ? "rounded-tr-xs bg-violet-600 text-white shadow-violet-600/15"
            : "rounded-tl-xs border border-slate-100 bg-white text-slate-800 shadow-[0_4px_20px_rgba(45,35,100,0.03)]"
        }`}
      >
        {!isOutgoing &&
          sender &&
          !isDeleted && (
            <p className="mb-1 text-[10px] font-bold text-violet-600">
              {sender}
            </p>
          )}

        {isDeleted ? (
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle
              size={13}
            />

            <span>
              This message was deleted
            </span>
          </div>
        ) : (
          body && (
            <p className="whitespace-pre-wrap break-words text-xs font-medium leading-relaxed">
              {body}
            </p>
          )
        )}

        {!isDeleted &&
          Array.isArray(
            message?.attachments
          ) &&
          message.attachments.length >
            0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map(
                (
                  attachment,
                  attachmentIndex
                ) => {
                  const mime =
                    String(
                      attachment?.mimeType ||
                        attachment?.fileType ||
                        ""
                    ).toLowerCase();

                  const isImg =
                    mime.startsWith(
                      "image/"
                    );

                  const fullUrl =
                    getFileUrl(
                      attachment?.url
                    );

                  if (
                    isImg &&
                    fullUrl !== "#"
                  ) {
                    return (
                      <a
                        key={
                          attachment?.url ||
                          attachmentIndex
                        }
                        href={fullUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm transition hover:opacity-95"
                      >
                        <img
                          src={
                            fullUrl
                          }
                          alt={
                            attachment?.originalName ||
                            attachment?.filename ||
                            "Attached Image"
                          }
                          className="max-h-60 w-auto rounded-xl object-contain"
                        />
                      </a>
                    );
                  }

                  return (
                    <a
                      key={
                        attachment?.url ||
                        attachmentIndex
                      }
                      href={
                        fullUrl
                      }
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-bold shadow-sm transition ${
                        isOutgoing
                          ? "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                          : "border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <FileText
                        size={15}
                        className="shrink-0 text-violet-600"
                      />

                      <span className="max-w-[200px] truncate">
                        {attachment?.originalName ||
                          attachment?.filename ||
                          "Attached Document"}
                      </span>
                    </a>
                  );
                }
              )}
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
          <span>
            {formatTime(
              message?.createdAt ||
                message?.sentAt ||
                message?.timestamp
            )}
          </span>

          {isOutgoing &&
            !isDeleted && (
              <CheckCheck
                size={12}
              />
            )}
        </div>
      </div>

      {!isOutgoing &&
        !isDeleted && (
          <div
            className="relative opacity-0 transition-opacity group-hover:opacity-100"
            ref={menuRef}
          >
            <button
              type="button"
              onClick={() =>
                setMenuOpen(
                  !menuOpen
                )
              }
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Message options"
            >
              <MoreVertical
                size={14}
              />
            </button>

            {menuOpen && (
              <div className="absolute bottom-full left-0 z-20 mb-1 w-40 overflow-hidden rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(
                      false
                    );
                    onDeletePrompt(
                      message
                    );
                  }}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                >
                  <Trash2
                    size={13}
                  />
                  Delete for Me
                </button>
              </div>
            )}
          </div>
        )}
    </div>
  );
}

/* ============================================================
   EMPTY / LOADING COMPONENTS
============================================================ */

function EmptyConversationList({
  search,
}) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
        <MessageSquare
          size={22}
        />
      </div>

      <h3 className="mt-4 text-sm font-bold text-slate-800">
        {search
          ? "No matching contacts"
          : "No contacts available"}
      </h3>

      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">
        {search
          ? "No team user matches your search."
          : "No contacts found."}
      </p>
    </div>
  );
}

function NoConversationSelected() {
  return (
    <div className="flex h-full min-h-[380px] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
        <MessageSquare
          size={26}
        />
      </div>

      <h3 className="mt-4 text-sm font-bold text-slate-900">
        No contact selected
      </h3>

      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">
        Pick a contact from the left list to
        review message histories or start a
        fresh discussion.
      </p>
    </div>
  );
}

function NoMessages() {
  return (
    <div className="flex h-full min-h-[380px] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
        <MessageSquare
          size={26}
        />
      </div>

      <h3 className="mt-4 text-sm font-bold text-slate-900">
        No messages yet
      </h3>

      <p className="mt-1 text-xs text-slate-400">
        Send a message below to start your
        conversation.
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
        Loading contacts...
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

function MessageError({
  message,
}) {
  return (
    <div className="flex h-full min-h-[380px] items-center justify-center p-4">
      <div className="max-w-md rounded-2xl border border-rose-100 bg-rose-50 p-4 text-center text-xs font-semibold text-rose-600">
        {message}
      </div>
    </div>
  );
}

/* ============================================================
   NAV ITEM
============================================================ */

function UserNavItem({
  item,
  onNavigate,
}) {
  const pathname =
    usePathname();

  const Icon = item.icon;

  const isActive =
    pathname === item.href ||
    (item.href !== "/user" &&
      pathname.startsWith(
        `${item.href}/`
      ));

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold transition duration-150 ${
        isActive
          ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon
        size={18}
        className={`transition duration-150 ${
          isActive
            ? "text-white"
            : "text-slate-400 group-hover:text-white"
        }`}
      />

      <span>
        {item.label}
      </span>
    </Link>
  );
}

/* ============================================================
   HELPERS
============================================================ */

function getUserId(user) {
  if (!user) return null;

  if (
    typeof user === "string" ||
    typeof user === "number"
  ) {
    return user;
  }

  return (
    user?._id ||
    user?.id ||
    user?.userId ||
    user?.user?._id ||
    user?.user?.id ||
    user?._doc?._id ||
    user?._doc?.id ||
    null
  );
}

function getOtherParticipant(
  conversation,
  currentUser
) {
  if (
    conversation?.contact &&
    typeof conversation.contact ===
      "object"
  ) {
    return conversation.contact;
  }

  const participants =
    Array.isArray(
      conversation?.participants
    )
      ? conversation.participants
      : [];

  if (
    participants.length ===
    0
  ) {
    return (
      conversation?.recipient ||
      conversation?.user ||
      conversation?.contact ||
      {}
    );
  }

  const currentUserId =
    getUserId(currentUser);

  const other =
    participants.find(
      (participant) => {
        const id =
          getUserId(
            participant
          );

        return (
          !currentUserId ||
          !id ||
          id.toString() !==
            currentUserId.toString()
        );
      }
    );

  return (
    other ||
    participants[0] ||
    {}
  );
}

function getParticipantName(
  conversation,
  currentUser
) {
  const participant =
    getOtherParticipant(
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
    conversation?.userName ||
    "User"
  );
}

function getParticipantEmail(
  conversation,
  currentUser
) {
  const participant =
    getOtherParticipant(
      conversation,
      currentUser
    );

  return (
    participant?.email ||
    conversation?.email ||
    ""
  );
}

function getParticipantRole(
  conversation,
  currentUser
) {
  const participant =
    getOtherParticipant(
      conversation,
      currentUser
    );

  return (
    participant?.role ||
    conversation?.role ||
    ""
  );
}

function getParticipantAvatar(
  conversation,
  currentUser
) {
  const participant =
    getOtherParticipant(
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

function getConversationId(
  conversation
) {
  return (
    conversation?._id ||
    conversation?.id ||
    conversation?.conversationId ||
    conversation?.conversation?._id ||
    conversation?.conversation?.id ||
    null
  );
}

function normalizeConversations(
  response
) {
  const possible =
    response?.conversations ||
    response?.data?.conversations ||
    response?.results ||
    response?.data ||
    [];

  return Array.isArray(
    possible
  )
    ? possible.filter(Boolean)
    : [];
}

function normalizeContacts(
  response
) {
  const possible =
    response?.contacts ||
    response?.users ||
    response?.data?.contacts ||
    response?.data?.users ||
    [];

  return Array.isArray(
    possible
  )
    ? possible.filter(Boolean)
    : [];
}

function normalizeMessages(
  response
) {
  const possible =
    response?.messages ||
    response?.data?.messages ||
    response?.results ||
    response?.data ||
    [];

  return Array.isArray(
    possible
  )
    ? possible.filter(Boolean)
    : [];
}

async function markConversationRead(
  conversationId
) {
  return apiRequest(
    `/conversations/${conversationId}/read`,
    {
      method: "PUT",
    }
  );
}

async function getConversationMessages(
  conversationId
) {
  return apiRequest(
    `/conversations/${conversationId}/messages`,
    {
      method: "GET",
    }
  );
}

async function safeApiRequest(
  endpoint,
  fallback = null
) {
  try {
    return await apiRequest(
      endpoint,
      {
        method: "GET",
      }
    );
  } catch (error) {
    if (error?.status === 401) {
      throw error;
    }

    return fallback;
  }
}

async function apiRequest(
  endpoint,
  options = {}
) {
  let token = "";

  try {
    if (
      typeof window !==
      "undefined"
    ) {
      token =
        localStorage.getItem(
          "token"
        ) ||
        localStorage.getItem(
          "authToken"
        ) ||
        "";
    }
  } catch {}

  const isFormData =
    typeof FormData !==
      "undefined" &&
    options.body instanceof
      FormData;

  const headers = {
    Accept:
      "application/json",

    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),

    ...(isFormData
      ? {}
      : options.body
      ? {
          "Content-Type":
            "application/json",
        }
      : {}),

    ...(options.headers ||
      {}),
  };

  const response =
    await fetch(
      `${API_URL}${endpoint}`,
      {
        ...options,
        credentials:
          "include",
        cache:
          "no-store",
        headers,
      }
    );

  let data = null;

  try {
    const text =
      await response.text();

    if (text) {
      try {
        data =
          JSON.parse(
            text
          );
      } catch {
        data = {
          message: text,
        };
      }
    }
  } catch {}

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      `Request failed with status ${response.status}`;

    const error =
      new Error(message);

    error.status =
      response.status;

    throw error;
  }

  return data;
}

function formatDateTime(
  date
) {
  if (!date) return "";

  const parsed =
    new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "";
  }

  const now =
    new Date();

  if (
    parsed.toDateString() ===
    now.toDateString()
  ) {
    return parsed.toLocaleTimeString(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
      }
    );
  }

  return parsed.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
    }
  );
}

function formatTime(
  date
) {
  if (!date) return "";

  const parsed =
    new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "";
  }

  return parsed.toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function getInitials(
  name
) {
  if (!name) return "U";

  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (part) =>
          part[0]?.toUpperCase()
      )
      .join("") || "U"
  );
}

function extractUser(
  response
) {
  return (
    response?.user ||
    response?.data?.user ||
    response?.data ||
    response ||
    null
  );
}