"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MessageSquare, X, Loader2 } from "lucide-react";
import { io } from "socket.io-client";
import { authService } from "@/services/authService";

import { UserChatSidebar } from "./components/user-chat/UserChatSidebar";
import { UserChatHeader } from "./components/user-chat/UserChatHeader";
import { UserChatMessages } from "./components/user-chat/UserChatMessages";
import { UserChatComposer } from "./components/user-chat/UserChatComposer";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "");
const BACKEND_BASE_URL = API_URL.endsWith("/api") ? API_URL.slice(0, -4) : API_URL;
const DEFAULT_CONVERSATION_ID = "admin-default-chat";

const getStoredToken = () => {
  if (typeof window === "undefined") return "";
  for (const key of ["token", "accessToken", "jwt", "authToken"]) {
    try {
      const val = localStorage.getItem(key);
      if (val) return val.replace(/^Bearer\s+/i, "").trim();
    } catch {}
  }
  return "";
};

const apiRequest = async (endpoint, options = {}) => {
  const token = getStoredToken();
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
  return data;
};

const safeApiRequest = async (endpoint) => {
  try { return await apiRequest(endpoint); } catch { return null; }
};

const getUserId = (u) => u?._id || u?.id || null;
const getConversationId = (c) => c?._id || c?.id || null;
const getMessageId = (m) => m?._id || m?.id || null;
const getMessageConversationId = (m) => m?.conversationId || m?.conversation || null;
const getMessageText = (m) => m?.body || m?.message || "";
const normalizeConversations = (res) => Array.isArray(res?.conversations || res?.data || res) ? (res.conversations || res.data || res) : [];
const normalizeMessages = (res) => Array.isArray(res?.messages || res?.data || res) ? (res.messages || res.data || res) : [];
const sameId = (a, b) => String(a ?? "") === String(b ?? "");

const formatConversationDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const formatMessageTime = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const formatDayLabel = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
};

const DEMO_ADMIN_CONVERSATIONS = [
  { _id: "demo-admin-support", id: "demo-admin-support", name: "Admin Support", lastMessage: "Please submit your timesheet.", lastMessageAt: new Date().toISOString() }
];
const DEMO_ADMIN_MESSAGES = {
  "demo-admin-support": [{ _id: "demo-1", body: "Welcome to LocalPro!", createdAt: new Date().toISOString() }]
};

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
  const [socketConnected, setSocketConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [chatFilter, setChatFilter] = useState("all");
  const [headerTab, setHeaderTab] = useState("chat");
  const [messageSearch, setMessageSearch] = useState("");
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [formatActive, setFormatActive] = useState(false);
  const [pinnedChats, setPinnedChats] = useState([]);
  const [mutedChats, setMutedChats] = useState([]);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const socketRef = useRef(null);
  const selectedConversationIdRef = useRef(null);
  const currentUserRef = useRef(null);
  const messagesCache = useRef({});
  const sendingRef = useRef(false);

  const selectedConversationId = getConversationId(selectedConversation);

  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { selectedConversationIdRef.current = selectedConversationId; }, [selectedConversationId]);

  const scrollToBottom = useCallback((instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? "auto" : "smooth", block: "end" });
  }, []);

  useEffect(() => { if (messages.length) scrollToBottom(false); }, [messages, scrollToBottom]);

  const loadConversations = useCallback(async () => {
    try {
      const [me, chats] = await Promise.all([
        authService.me().catch(() => null),
        safeApiRequest("/conversations"),
      ]);
      const user = me?.user || me?.data || me;
      if (user) setCurrentUser(user);
      
      let list = normalizeConversations(chats);
      if (!list.length && !getStoredToken()) list = DEMO_ADMIN_CONVERSATIONS;
      
      setConversations(list);
      if (list.length > 0 && !selectedConversation) {
        setSelectedConversation(list[0]);
        selectedConversationIdRef.current = getConversationId(list[0]);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedConversation]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const loadMessages = useCallback(async (id) => {
    if (!id || id === DEFAULT_CONVERSATION_ID) return;
    if (id.startsWith("demo-")) {
      setMessages(DEMO_ADMIN_MESSAGES[id] || []);
      return;
    }
    try {
      setMessagesLoading(true);
      const res = await apiRequest(`/messages/${encodeURIComponent(id)}?limit=100`);
      const list = normalizeMessages(res);
      messagesCache.current[id] = list;
      if (sameId(selectedConversationIdRef.current, id)) setMessages(list);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedConversationId) loadMessages(selectedConversationId);
  }, [selectedConversationId, loadMessages]);

  // Socket
  useEffect(() => {
    const socket = io(BACKEND_BASE_URL, { auth: { token: getStoredToken() }, transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("receive_message", (payload) => {
      const msg = payload?.message || payload;
      const cId = getMessageConversationId(msg);
      if (sameId(selectedConversationIdRef.current, cId)) {
        setMessages((prev) => {
          if (prev.some((m) => sameId(getMessageId(m), getMessageId(msg)))) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
      }
    });
    return () => socket.disconnect();
  }, [scrollToBottom]);

  const handleSelectConversation = async (conv) => {
    setSelectedConversation(conv);
    selectedConversationIdRef.current = getConversationId(conv);
    setHeaderTab("chat");
    await loadMessages(getConversationId(conv));
  };

  // --- OPTIMIZED OPTIMISTIC UI SEND MESSAGE FOR USER ---
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const body = message.trim();
    if (!body && selectedFiles.length === 0) return;
    const cId = selectedConversationId;
    if (!cId || sendingRef.current) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      id: tempId,
      conversationId: cId,
      body,
      message: body,
      sender: currentUser || { name: "You", role: "user" },
      createdAt: new Date().toISOString(),
      sending: true
    };

    sendingRef.current = true;
    setSending(true);
    setMessage("");

    // 1. Instant UI Update
    setMessages((prev) => [...prev, optimisticMessage]);
    scrollToBottom(true);

    try {
      const res = await apiRequest("/messages", {
        method: "POST",
        body: JSON.stringify({ conversationId: cId, body, message: body, clientMessageId: tempId }),
      });
      const sent = res?.data || res?.message;
      if (sent) {
        // 2. Replace temporary message with confirmed database record
        setMessages((prev) => prev.map((m) => (sameId(getMessageId(m), tempId) ? sent : m)));
      }
    } catch (err) {
      // Revert on failure
      setMessages((prev) => prev.filter((m) => !sameId(getMessageId(m), tempId)));
      setMessage(body);
    } finally {
      sendingRef.current = false;
      setSending(false);
      messageInputRef.current?.focus();
    }
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => !search || c.lastMessage?.toLowerCase().includes(search.toLowerCase()));
  }, [conversations, search]);

  const visibleMessages = useMemo(() => {
    if (!messageSearch) return messages;
    return messages.filter((m) => getMessageText(m).toLowerCase().includes(messageSearch.toLowerCase()));
  }, [messages, messageSearch]);

  return (
    <div className="flex h-full w-full min-h-0 flex-1 overflow-hidden bg-[#F5F5F5] font-sans text-[#242424]">
      <section className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
        <UserChatSidebar
          search={search}
          setSearch={setSearch}
          chatFilter={chatFilter}
          setChatFilter={setChatFilter}
          socketConnected={socketConnected}
          loading={loading}
          filteredConversations={filteredConversations}
          selectedConversationId={selectedConversationId}
          handleSelectConversation={handleSelectConversation}
          getConversationId={getConversationId}
          getParticipantName={(c) => c.name || "Admin Support"}
          getParticipantAvatar={() => ""}
          getInitials={(n) => n[0]}
          getFileUrl={(u) => u}
          sameId={sameId}
          currentUser={currentUser}
          formatConversationDate={formatConversationDate}
          pinnedChats={pinnedChats}
          mutedChats={mutedChats}
        />

        <main className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white ${selectedConversationId ? "flex" : "hidden md:flex"}`}>
          {selectedConversationId ? (
            <div className="flex h-full flex-col overflow-hidden">
              <UserChatHeader
                setSelectedConversation={setSelectedConversation}
                selectedAvatar=""
                selectedName="Admin Support"
                headerTab={headerTab}
                setHeaderTab={setHeaderTab}
                showMessageSearch={showMessageSearch}
                setShowMessageSearch={setShowMessageSearch}
                messageSearch={messageSearch}
                setMessageSearch={setMessageSearch}
                menuOpen={menuOpen}
                setMenuOpen={setMenuOpen}
                togglePin={() => {}}
                toggleMute={() => {}}
                pinnedChats={pinnedChats}
                mutedChats={mutedChats}
                selectedConversationId={selectedConversationId}
                getFileUrl={(u) => u}
                getInitials={() => "AS"}
              />

              {headerTab === "chat" && (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
                  <UserChatMessages
                    visibleMessages={visibleMessages}
                    messagesLoading={messagesLoading}
                    selectedName="Admin Support"
                    getMessageText={getMessageText}
                    getMessageId={getMessageId}
                    getUserId={getUserId}
                    getFileUrl={(u) => u}
                    getInitials={() => "AS"}
                    formatMessageTime={formatMessageTime}
                    formatDayLabel={formatDayLabel}
                    sameId={sameId}
                    currentUser={currentUser}
                    handleAddReaction={() => {}}
                    setReplyingTo={setReplyingTo}
                    messageInputRef={messageInputRef}
                    setPreviewPhotoUrl={setPreviewPhotoUrl}
                    messagesEndRef={messagesEndRef}
                  />

                  <UserChatComposer
                    message={message}
                    setMessage={setMessage}
                    selectedFiles={selectedFiles}
                    setSelectedFiles={setSelectedFiles}
                    replyingTo={replyingTo}
                    setReplyingTo={setReplyingTo}
                    handleSendMessage={handleSendMessage}
                    sending={sending}
                    formatActive={formatActive}
                    setFormatActive={setFormatActive}
                    showEmojiPicker={showEmojiPicker}
                    setShowEmojiPicker={setShowEmojiPicker}
                    appendEmoji={(em) => setMessage((p) => p + em)}
                    fileInputRef={fileInputRef}
                    messageInputRef={messageInputRef}
                    selectedName="Admin Support"
                    getMessageText={getMessageText}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center bg-white p-6 text-center">
              <MessageSquare size={36} className="text-[#5B5FC7]" />
              <h2 className="mt-2 text-base font-bold">Select an Admin conversation</h2>
            </div>
          )}
        </main>
      </section>
    </div>
  );
}