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
} from "lucide-react";

import { io } from "socket.io-client";
import { authService } from "@/services/authService";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.localpro1.net/api";

const CLEAN_API_URL = String(API_URL).trim().replace(/\/+$/, "");
const BACKEND_BASE_URL = CLEAN_API_URL.endsWith("/api")
  ? CLEAN_API_URL.slice(0, -4)
  : CLEAN_API_URL;

const getFileUrl = (url) => {
  if (!url) return "#";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }
  return `${BACKEND_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

export default function UserMessagesPage() {
  const [conversations, setConversations] = useState(() => {
    try {
      const cached = localStorage.getItem("cached_user_admin_chats");
      if (cached) return JSON.parse(cached);
    } catch {}
    return [
      {
        id: "admin-default-chat",
        _id: "admin-default-chat",
        participants: [{ name: "Admin / Support", role: "admin", email: "admin@localpro1.net" }],
        lastMessage: "Welcome to support chat",
        updatedAt: new Date().toISOString(),
      }
    ];
  });

  const [selectedConversation, setSelectedConversation] = useState(() => {
    try {
      const cached = localStorage.getItem("cached_user_admin_chats");
      const parsed = cached ? JSON.parse(cached) : [];
      return parsed[0] || null;
    } catch {
      return null;
    }
  });

  const [messages, setMessages] = useState(() => {
    try {
      const cachedMsg = localStorage.getItem("cached_user_messages_admin-default-chat");
      return cachedMsg ? JSON.parse(cachedMsg) : [];
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

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const cachedUser = localStorage.getItem("user");
      return cachedUser ? JSON.parse(cachedUser) : null;
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
  const selectedConversationIdRef = useRef(null);
  const messagesCache = useRef({});

  const scrollToBottom = useCallback((instant = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: instant ? "auto" : "smooth",
    });
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(false);
    }
  }, [messages, scrollToBottom]);

  /* ============================================================
     SOCKET.IO REAL-TIME SETUP (INSTANT 1S DELIVERY)
  ============================================================ */
  useEffect(() => {
    let token = null;
    try {
      token =
        localStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("token");
    } catch {}

    const socket = io(BACKEND_BASE_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    const handleIncomingMessage = (incomingMsg) => {
      if (!incomingMsg) return;

      const incomingConvId =
        incomingMsg.conversationId || incomingMsg.conversation || incomingMsg.conversation_id || "admin-default-chat";

      if (
        selectedConversationIdRef.current &&
        incomingConvId &&
        String(incomingConvId) === String(selectedConversationIdRef.current)
      ) {
        setMessages((prev) => {
          const exists = prev.some(
            (m) =>
              String(m.id || m._id) === String(incomingMsg.id || incomingMsg._id) ||
              (m.body === incomingMsg.body &&
                String(getUserId(m.sender)) === String(getUserId(incomingMsg.sender)) &&
                Math.abs(new Date(m.createdAt || Date.now()) - new Date(incomingMsg.createdAt || Date.now())) < 5000)
          );

          if (exists) {
            return prev.map((m) =>
              String(m.id || m._id).startsWith("temp-") && m.body === incomingMsg.body
                ? incomingMsg
                : m
            );
          }

          const updated = [...prev, incomingMsg];
          messagesCache.current[selectedConversationIdRef.current] = updated;
          try {
            localStorage.setItem(`cached_user_messages_${selectedConversationIdRef.current}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }

      loadConversations(true);
    };

    socket.on("receive_message", handleIncomingMessage);
    socket.on("message", handleIncomingMessage);
    socket.on("new_message", handleIncomingMessage);

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const activeId = getConversationId(selectedConversation);
    selectedConversationIdRef.current = activeId;
    if (socketRef.current && activeId) {
      socketRef.current.emit("join_room", activeId);
      socketRef.current.emit("join", activeId);
    }
  }, [selectedConversation]);

  /* ============================================================
     LOAD CONVERSATIONS (ADMIN ONLY, 1S FAST)
  ============================================================ */

  const loadConversations = useCallback(async (silent = false) => {
    try {
      if (!silent && conversations.length === 0) setLoading(true);
      setError("");

      const me = await authService.me().catch(() => null);
      const user = extractUser(me);

      if (user) {
        setCurrentUser(user);
        try {
          localStorage.setItem("user", JSON.stringify(user));
        } catch {}
      } else if (!currentUser) {
        window.location.href = "/login";
        return;
      }

      let response = await safeApiRequest("/conversations", null);
      if (!response || normalizeConversations(response).length === 0) {
        response = await safeApiRequest("/messages/conversations", null);
      }

      const rawConversations = normalizeConversations(response);
      
      const adminOnlyConversations = rawConversations.filter((conv) => {
        const adminPart = getAdminParticipant(conv, user || currentUser);
        return Boolean(adminPart);
      });

      const finalConvs = adminOnlyConversations.length > 0 ? adminOnlyConversations : [
        {
          id: "admin-default-chat",
          _id: "admin-default-chat",
          participants: [{ name: "Admin / Support", role: "admin", email: "admin@localpro1.net" }],
          lastMessage: "Welcome to support chat",
          updatedAt: new Date().toISOString(),
        }
      ];

      setConversations(finalConvs);

      try {
        localStorage.setItem("cached_user_admin_chats", JSON.stringify(finalConvs));
      } catch {}
    } catch (err) {
      console.error("User conversations error:", err);
      if (err?.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!silent) setError(err?.message || "Unable to load conversations.");
    } finally {
      setLoading(false);
    }
  }, [conversations.length, currentUser]);

  useEffect(() => {
    loadConversations(false);
  }, [loadConversations]);

  /* ============================================================
     FILTER CONVERSATIONS
  ============================================================ */

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;

    return conversations.filter((conversation) => {
      const name = getParticipantName(conversation, currentUser);
      const email = getParticipantEmail(conversation, currentUser);
      const role = getParticipantRole(conversation, currentUser);
      const lastMessage = String(
        conversation?.lastMessage || conversation?.lastMessageText || conversation?.preview || ""
      );

      return `${name} ${email} ${role} ${lastMessage}`.toLowerCase().includes(query);
    });
  }, [conversations, search, currentUser]);

  /* ============================================================
     FILE HANDLING
  ============================================================ */

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setSelectedFiles((prev) => [...prev, ...files].slice(0, 5));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  /* ============================================================
     SELECT CONVERSATION (INSTANT CACHE LOAD)
  ============================================================ */

  async function handleSelectConversation(item) {
    if (!item) return;

    setMessagesError("");
    setSelectedFiles([]);

    const conversation = item;
    const conversationId = getConversationId(conversation) || "admin-default-chat";

    try {
      setSelectedConversation(conversation);

      if (messagesCache.current[conversationId]) {
        setMessages(messagesCache.current[conversationId]);
      } else {
        try {
          const cachedMsgs = localStorage.getItem(`cached_user_messages_${conversationId}`);
          if (cachedMsgs) {
            const parsedMsgs = JSON.parse(cachedMsgs);
            setMessages(parsedMsgs);
            messagesCache.current[conversationId] = parsedMsgs;
          } else {
            setMessages([]);
            setMessagesLoading(true);
          }
        } catch {
          setMessages([]);
          setMessagesLoading(true);
        }
      }

      const response = await getConversationMessages(conversationId).catch(() => ({ messages: [] }));
      const fetched = normalizeMessages(response);

      messagesCache.current[conversationId] = fetched;
      setMessages(fetched);

      try {
        localStorage.setItem(`cached_user_messages_${conversationId}`, JSON.stringify(fetched));
      } catch {}

      const unreadCount = Number(
        conversation?.unreadCount || conversation?.unread || 0
      );

      if (unreadCount > 0) {
        try {
          await markConversationRead(conversationId);
          setConversations((current) =>
            current.map((item) => {
              if (getConversationId(item) !== conversationId) return item;
              return { ...item, unreadCount: 0, unread: 0 };
            })
          );
        } catch {}
      }
    } catch (err) {
      console.error("Conversation selection error:", err);
      setMessagesError(err?.message || "Unable to open conversation.");
    } finally {
      setMessagesLoading(false);
    }
  }

  /* ============================================================
     SEND MESSAGE (Optimized 1s Instant UI)
  ============================================================ */

  async function handleSendMessage(event) {
    event?.preventDefault();

    const body = message.trim();
    if ((!body && selectedFiles.length === 0) || !selectedConversation || sending) {
      return;
    }

    const conversationId = getConversationId(selectedConversation) || "admin-default-chat";
    const contact = getOtherParticipant(selectedConversation, currentUser);
    const recipientId = getUserId(contact);
    const tempId = `temp-${Date.now()}`;
    const filesToSend = [...selectedFiles];

    const optimisticMsg = {
      _id: tempId,
      id: tempId,
      body: body,
      message: body,
      sender: currentUser || { role: "user", name: "You" },
      createdAt: new Date().toISOString(),
      attachments: filesToSend.map((f) => ({
        filename: f.name,
        originalName: f.name,
        mimeType: f.type,
        url: URL.createObjectURL(f),
      })),
    };

    setMessages((prev) => {
      const updated = [...prev, optimisticMsg];
      if (conversationId) messagesCache.current[conversationId] = updated;
      try {
        localStorage.setItem(`cached_user_messages_${conversationId}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setMessage("");
    setSelectedFiles([]);
    scrollToBottom(true);

    try {
      setSending(true);
      setMessagesError("");

      let response;

      if (filesToSend.length > 0) {
        const formData = new FormData();
        formData.append("body", body);
        formData.append("recipientId", String(recipientId || ""));
        formData.append("conversationId", String(conversationId));

        filesToSend.forEach((file) => {
          formData.append("files", file);
        });

        let token = "";
        try {
          token = localStorage.getItem("token") || localStorage.getItem("authToken") || "";
        } catch {}

        const res = await fetch(`${API_URL}/messages`, {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
        });

        let responseData = null;
        try {
          const text = await res.text();
          if (text) responseData = JSON.parse(text);
        } catch {}

        if (!res.ok) {
          throw new Error(responseData?.message || "Failed to send file.");
        }
        response = responseData;
      } else {
        response = await apiRequest(`/conversations/${conversationId}/messages`, {
          method: "POST",
          body: JSON.stringify({
            body,
            message: body,
            messageType: "text",
            channel: "chat",
            direction: "internal",
          }),
        }).catch(() => null);
      }

      if (!response && recipientId) {
        response = await apiRequest(`/messages`, {
          method: "POST",
          body: JSON.stringify({
            recipientId,
            body,
            message: body,
          }),
        });
      }

      const sentMessage =
        response?.data ||
        response?.messageData ||
        response?.message ||
        null;

      if (sentMessage && typeof sentMessage === "object") {
        setMessages((current) => {
          const updated = current.map((m) =>
            String(m.id || m._id) === String(tempId) ? sentMessage : m
          );
          messagesCache.current[conversationId] = updated;
          try {
            localStorage.setItem(`cached_user_messages_${conversationId}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }

      loadConversations(true);
    } catch (err) {
      console.error("Send message error:", err);
      setMessagesError(err?.message || "Unable to send message.");
      setMessages((prev) => prev.filter((m) => String(m.id || m._id) !== String(tempId)));
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
    const messageId = messageToDelete?._id || messageToDelete?.id;
    if (!messageId) return;

    try {
      setDeletingMessage(true);
      const endpoint =
        type === "everyone"
          ? `/messages/${messageId}/delete-for-everyone`
          : `/messages/${messageId}/delete-for-me`;

      const response = await apiRequest(endpoint, { method: "POST" });

      if (type === "me") {
        setMessages((prev) =>
          prev.filter((m) => String(m?._id || m?.id) !== String(messageId))
        );
      } else {
        const updatedMsg = response?.data || response?.message;
        setMessages((prev) =>
          prev.map((m) => {
            if (String(m?._id || m?.id) !== String(messageId)) return m;
            return {
              ...m,
              ...(updatedMsg || {}),
              body: "This message was deleted",
              message: "This message was deleted",
              isDeletedForEveryone: true,
              attachments: [],
            };
          })
        );
      }

      setDeleteModalOpen(false);
      setMessageToDelete(null);
      loadConversations(true);
    } catch (delError) {
      console.error("Delete message failed:", delError);
      alert(delError?.message || "Failed to delete message.");
    } finally {
      setDeletingMessage(false);
    }
  }

  const selectedName = selectedConversation
    ? getParticipantName(selectedConversation, currentUser)
    : "";

  return (
    <div className="relative flex h-[calc(100vh-4rem)] min-h-0 w-full overflow-hidden bg-[#f7f8fc] text-slate-950 p-4 sm:p-6 lg:p-8 animate-fadeIn">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl animate-pulse" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden w-full">
        {error && (
          <section className="shrink-0 mb-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
            <p>{error}</p>
          </section>
        )}

        {/* ADMIN STYLE LAYOUT MATCHING IMAGE */}
        <section className="grid h-full min-h-0 min-w-0 flex-1 w-full grid-cols-1 grid-rows-[240px_minmax(0,1fr)] overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)] lg:grid-cols-[360px_minmax(0,1fr)] lg:grid-rows-1">
          {/* Contacts List (Admin Only) */}
          <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-b border-slate-100 lg:border-b-0 lg:border-r">
            <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 p-4 sm:p-5">
              <div className="mb-3.5">
                <h2 className="text-base font-extrabold text-slate-900">Chats & Teams</h2>
                <p className="mt-0.5 text-xs text-slate-400">Direct messages with Admin</p>
              </div>

              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
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
                  const participant = getOtherParticipant(conversation, currentUser);
                  const participantId = getUserId(participant);
                  const name = getParticipantName(conversation, currentUser);
                  const avatar = getParticipantAvatar(conversation, currentUser);
                  const lastMessage =
                    conversation?.lastMessage ||
                    conversation?.lastMessageText ||
                    conversation?.preview ||
                    "No messages yet";
                  const unread = Number(conversation?.unreadCount || conversation?.unread || 0);

                  const active =
                    selectedConversation &&
                    (id
                      ? getConversationId(selectedConversation) === id
                      : getUserId(getOtherParticipant(selectedConversation, currentUser)) === participantId);

                  return (
                    <button
                      key={id || participantId || `contact-${index}`}
                      type="button"
                      onClick={() => handleSelectConversation(conversation)}
                      className={`flex w-full items-start gap-3 border-b border-slate-100/80 px-4 py-3.5 text-left transition duration-150 ${
                        active ? "border-violet-200/60 bg-violet-50/70" : "hover:bg-slate-50/80"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-sm">
                          {avatar ? (
                            <img src={avatar} alt={name} className="h-full w-full object-cover" />
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
                          <p className={`truncate text-xs ${unread > 0 ? "font-bold text-slate-900" : "font-bold text-slate-800"}`}>
                            {name}
                          </p>
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {formatDateTime(conversation?.lastMessageAt || conversation?.updatedAt || conversation?.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">{lastMessage}</p>
                      </div>
                    </button>
                  );
                })
              ) : (
                <EmptyConversationList search={search} />
              )}
            </div>
          </aside>

          {/* Chat Panel */}
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5 sm:px-6">
              {selectedConversation ? (
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-bold text-white shadow-md shadow-purple-500/10">
                      {getParticipantAvatar(selectedConversation, currentUser) ? (
                        <img
                          src={getParticipantAvatar(selectedConversation, currentUser)}
                          alt={selectedName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <MessageSquare size={18} />
                      )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-extrabold text-slate-900">{selectedName}</h2>
                    <p className="truncate text-xs font-semibold text-violet-600">Admin Support</p>
                  </div>
                </div>
              ) : (
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
                    <MessageSquare size={17} />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-900">Select admin chat</h2>
                    <p className="text-[11px] text-slate-400">Choose from list</p>
                  </div>
                </div>
              )}
            </div>

            {/* Messages Scroll */}
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6">
              {!selectedConversation ? (
                <NoConversationSelected />
              ) : messagesLoading ? (
                <MessagesLoading />
              ) : messagesError ? (
                <MessageError message={messagesError} />
              ) : messages.length === 0 ? (
                <NoMessages />
              ) : (
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-3.5">
                  {messages.map((item, index) => (
                    <MessageBubble
                      key={item?._id || item?.id || `${item?.createdAt || "message"}-${index}`}
                      message={item}
                      currentUser={currentUser}
                      onDeletePrompt={promptDeleteMessage}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="shrink-0 border-t border-slate-100 bg-white p-4 sm:p-5">
              {selectedFiles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedFiles.map((file, idx) => (
                    <div key={`${file.name}-${idx}`} className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/70 px-3 py-1.5 text-xs text-violet-800">
                      {file.type.startsWith("image/") ? <ImageIcon size={14} className="text-violet-600" /> : <File size={14} className="text-violet-600" />}
                      <span className="max-w-[150px] truncate font-semibold">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(idx)}
                        className="ml-1 rounded-md text-violet-400 hover:bg-violet-200/50 hover:text-rose-600"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex items-end gap-2.5">
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
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if ((message.trim() || selectedFiles.length > 0) && selectedConversation && !sending) {
                          handleSendMessage(e);
                        }
                      }
                    }}
                    placeholder={selectedConversation ? `Message ${selectedName} or attach files...` : "Select chat first..."}
                    rows={1}
                    disabled={!selectedConversation || sending}
                    className="min-h-11 max-h-32 w-full resize-none rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 py-3 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <button
                  type="submit"
                  disabled={(!message.trim() && selectedFiles.length === 0) || !selectedConversation || sending}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-600/25 transition duration-150 hover:-translate-y-0.5 hover:bg-violet-700 active:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                  aria-label="Send message"
                >
                  {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>

      {/* Delete Modal */}
      {deleteModalOpen && messageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Message?</h3>
                <p className="text-xs text-slate-400">Choose how you want to delete this message.</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs italic text-slate-600">
              &ldquo;{messageToDelete?.isDeletedForEveryone ? "This message was deleted" : messageToDelete?.body || messageToDelete?.message || "Message"}&rdquo;
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              {getUserId(messageToDelete?.sender)?.toString() === getUserId(currentUser)?.toString() && !messageToDelete?.isDeletedForEveryone && (
                <button
                  type="button"
                  disabled={deletingMessage}
                  onClick={() => executeDeleteMessage("everyone")}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 text-xs font-bold text-white shadow-md shadow-rose-600/20 transition hover:bg-rose-700 disabled:opacity-50"
                >
                  {deletingMessage ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />}
                  Delete for Everyone
                </button>
              )}

              <button
                type="button"
                disabled={deletingMessage}
                onClick={() => executeDeleteMessage("me")}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {deletingMessage ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
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

/* ============================================================
   MESSAGE BUBBLE
============================================================ */

function MessageBubble({ message, currentUser, onDeletePrompt }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const senderId = getUserId(message?.sender);
  const currentUserId = getUserId(currentUser);

  const isOutgoing =
    senderId && currentUserId && String(senderId) === String(currentUserId);

  const isDeleted = Boolean(message?.isDeletedForEveryone);
  const body = isDeleted ? "This message was deleted" : message?.body || message?.message || "";
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
    <div className={`group relative flex w-full items-center gap-2.5 ${isOutgoing ? "justify-end" : "justify-start"}`}>
      {isOutgoing && !isDeleted && (
        <div className="relative opacity-0 transition-opacity group-hover:opacity-100" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Message options"
          >
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <div className="absolute bottom-full right-0 z-20 mb-1 w-40 overflow-hidden rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDeletePrompt(message);
                }}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-bold text-rose-600 transition hover:bg-rose-50"
              >
                <Trash2 size={13} /> Delete Message
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
        {!isOutgoing && sender && !isDeleted && (
          <p className="mb-1 text-[10px] font-bold text-violet-600">{sender}</p>
        )}

        {isDeleted ? (
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle size={13} />
            <span>This message was deleted</span>
          </div>
        ) : (
          body && <p className="whitespace-pre-wrap break-words text-xs font-medium leading-relaxed">{body}</p>
        )}

        {!isDeleted && Array.isArray(message?.attachments) && message.attachments.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.attachments.map((attachment, attachmentIndex) => {
              const mime = String(attachment?.mimeType || attachment?.fileType || "").toLowerCase();
              const isImg = mime.startsWith("image/");
              const fullUrl = getFileUrl(attachment?.url);

              if (isImg && fullUrl !== "#") {
                return (
                  <a
                    key={attachment?.url || attachmentIndex}
                    href={fullUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm transition hover:opacity-95"
                  >
                    <img
                      src={fullUrl}
                      alt={attachment?.originalName || attachment?.filename || "Attached Image"}
                      className="max-h-60 w-auto rounded-xl object-contain"
                    />
                  </a>
                );
              }

              return (
                <a
                  key={attachment?.url || attachmentIndex}
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
                  <span className="max-w-[200px] truncate">{attachment?.originalName || attachment?.filename || "Attached Document"}</span>
                </a>
              );
            })}
          </div>
        )}

        <div className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${isDeleted ? "text-slate-400" : isOutgoing ? "text-violet-200" : "text-slate-400"}`}>
          <span>{formatTime(message?.createdAt || message?.sentAt)}</span>
          {isOutgoing && !isDeleted && <CheckCheck size={12} />}
        </div>
      </div>

      {!isOutgoing && !isDeleted && (
        <div className="relative opacity-0 transition-opacity group-hover:opacity-100" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Message options"
          >
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <div className="absolute bottom-full left-0 z-20 mb-1 w-40 overflow-hidden rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDeletePrompt(message);
                }}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-bold text-rose-600 transition hover:bg-rose-50"
              >
                <Trash2 size={13} /> Delete for Me
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

function EmptyConversationList({ search }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
        <MessageSquare size={22} />
      </div>
      <h3 className="mt-4 text-sm font-bold text-slate-800">
        {search ? "No matching chats" : "No admin chats"}
      </h3>
      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">
        {search ? "No conversation matches your search." : "You can only chat with Admin / Support."}
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
      <h3 className="mt-4 text-sm font-bold text-slate-900">Select admin chat</h3>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">
        Choose from list
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
      <h3 className="mt-4 text-sm font-bold text-slate-900">No messages yet</h3>
      <p className="mt-1 text-xs text-slate-400">Send a message below to start your conversation with Admin.</p>
    </div>
  );
}

function ConversationLoading() {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center p-6 text-center">
      <Loader2 size={26} className="animate-spin text-violet-600" />
      <p className="mt-3 text-xs font-semibold text-slate-500">Loading chats...</p>
    </div>
  );
}

function MessagesLoading() {
  return (
    <div className="flex h-full min-h-[380px] flex-col items-center justify-center text-center">
      <Loader2 size={32} className="animate-spin text-violet-600" />
      <p className="mt-3 text-xs font-semibold text-slate-500">Loading messages...</p>
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

/* ============================================================
   HELPERS & STRICT ADMIN PRIVACY RULES
============================================================ */

function getUserId(user) {
  if (!user) return null;
  if (typeof user === "string" || typeof user === "number") return user;
  return user?._id || user?.id || user?.userId || user?.user?._id || user?.user?.id || null;
}

function getAdminParticipant(conversation, currentUser) {
  const participants = Array.isArray(conversation?.participants) ? conversation.participants : [];
  const currentUserId = getUserId(currentUser);

  const adminMember = participants.find((p) => {
    const pId = getUserId(p);
    const pRole = String(p?.role || "").trim().toLowerCase();
    const isSelf = currentUserId && pId && String(pId) === String(currentUserId);
    return !isSelf && (pRole === "admin" || pRole === "manager" || pRole === "support" || participants.length === 1);
  });

  return adminMember || participants.find((p) => {
    const pId = getUserId(p);
    return !currentUserId || !pId || String(pId) !== String(currentUserId);
  }) || { name: "Admin / Support", role: "admin" };
}

function getOtherParticipant(conversation, currentUser) {
  return getAdminParticipant(conversation, currentUser);
}

function getParticipantName(conversation, currentUser) {
  const participant = getOtherParticipant(conversation, currentUser);
  return participant?.name || participant?.fullName || participant?.displayName || participant?.username || participant?.email || conversation?.name || "Admin / Support";
}

function getParticipantEmail(conversation, currentUser) {
  const participant = getOtherParticipant(conversation, currentUser);
  return participant?.email || conversation?.email || "";
}

function getParticipantRole(conversation, currentUser) {
  const participant = getOtherParticipant(conversation, currentUser);
  return participant?.role || conversation?.role || "admin";
}

function getParticipantAvatar(conversation, currentUser) {
  const participant = getOtherParticipant(conversation, currentUser);
  return participant?.avatar || participant?.profileImage || participant?.image || "";
}

function getConversationId(conversation) {
  return conversation?._id || conversation?.id || conversation?.conversationId || conversation?.conversation?._id || null;
}

function normalizeConversations(response) {
  const possible = response?.conversations || response?.data?.conversations || response?.results || response?.data || [];
  return Array.isArray(possible) ? possible.filter(Boolean) : [];
}

function normalizeMessages(response) {
  const possible = response?.messages || response?.data?.messages || response?.results || response?.data || [];
  return Array.isArray(possible) ? possible.filter(Boolean) : [];
}

function getInitials(name) {
  if (!name) return "A";
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "A";
}

async function markConversationRead(conversationId) {
  if (conversationId === "admin-default-chat") return;
  return apiRequest(`/conversations/${conversationId}/read`, { method: "PUT" });
}

async function getConversationMessages(conversationId) {
  if (conversationId === "admin-default-chat") return { messages: [] };
  return apiRequest(`/conversations/${conversationId}/messages`, { method: "GET" });
}

async function safeApiRequest(endpoint, fallback = null) {
  try {
    return await apiRequest(endpoint, { method: "GET" });
  } catch (error) {
    if (error?.status === 401) throw error;
    return fallback;
  }
}

async function apiRequest(endpoint, options = {}) {
  let token = "";
  try {
    if (typeof window !== "undefined") {
      token = localStorage.getItem("token") || localStorage.getItem("authToken") || "";
    }
  } catch {}

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(isFormData ? {} : options.body ? { "Content-Type": "application/json" } : {}),
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
    const message = data?.message || data?.error || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status =Response.status;
    throw error;
  }

  return data;
}

function formatDateTime(date) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  const now = new Date();
  if (parsed.toDateString() === now.toDateString()) {
    return parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(date) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function extractUser(response) {
  return response?.user || response?.data?.user || response?.data || response || null;
}