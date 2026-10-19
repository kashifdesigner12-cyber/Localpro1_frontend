"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Maximize2, X, Loader2, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";

import { ChatSidebar } from "./components/chat/ChatSidebar";
import { ChatHeader } from "./components/chat/ChatHeader";
import { ChatMessages } from "./components/chat/ChatMessages";
import { ChatComposer } from "./components/chat/ChatComposer";
import { GroupModal } from "./components/chat/GroupModal";

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const CLEAN_API_URL = String(RAW_API_URL).trim().replace(/\/+$/, "");
const API_BASE_URL = CLEAN_API_URL.endsWith("/api") ? CLEAN_API_URL : `${CLEAN_API_URL}/api`;
const BACKEND_BASE_URL = API_BASE_URL.endsWith("/api") ? API_BASE_URL.slice(0, -4) : API_BASE_URL;

const getApiUrl = (path = "") => `${API_BASE_URL}${String(path).startsWith("/") ? path : `/${path}`}`;
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
    if (typeof parsed === "string") return parsed.replace(/^Bearer\s+/i, "").trim() || null;
    if (parsed && typeof parsed === "object") {
      return parsed.token || parsed.accessToken || parsed.access_token || parsed.jwt || null;
    }
  } catch {}
  return raw || null;
};

const getStoredToken = () => {
  if (typeof window === "undefined") return null;
  for (const key of ["token", "accessToken", "jwt", "authToken", "localpro_token"]) {
    try {
      const val = normalizeTokenValue(localStorage.getItem(key));
      if (val) return val;
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

const parseResponse = async (res) => {
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

const getId = (item) => item?._id || item?.id || item?.userId?._id || null;
const getUserName = (user) => user?.name || user?.fullName || user?.email || "Unknown User";
const getUserAvatar = (user) => user?.avatar || user?.profileImage || user?.image || "";
const getInitials = (name) => String(name || "U").trim().split(/\s+/).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
const formatMessageTime = (v) => (v ? new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");
const formatConversationTime = (v) => {
  if (!v) return "";
  const d = new Date(v);
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
};
const formatDayLabel = (v) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const normalizeUsers = (d) => Array.isArray(d) ? d : Array.isArray(d?.users) ? d.users : Array.isArray(d?.data) ? d.data : [];
const normalizeConversations = (d) => Array.isArray(d) ? d : Array.isArray(d?.conversations) ? d.conversations : Array.isArray(d?.data) ? d.data : [];
const extractMessages = (d) => Array.isArray(d) ? d : Array.isArray(d?.messages) ? d.messages : Array.isArray(d?.data?.messages) ? d.data.messages : [];
const getMessageId = (m) => m?._id || m?.id || null;
const getConversationId = (c) => c?._id || c?.id || null;
const getConversationIdFromMessage = (m) => m?.conversationId || m?.conversation?._id || m?.conversation || null;
const getUnreadCount = (c) => Number(c?.unreadCount || c?.unread || 0);
const getConversationLastMessage = (c) => typeof c?.lastMessage === "string" ? c.lastMessage : c?.lastMessage?.body || "";
const getConversationLastDate = (c) => c?.lastMessageAt || c?.updatedAt || null;
const getSenderId = (m) => getId(m?.sender) || null;
const getMessageBody = (m) => m?.body || m?.message || m?.content || "";
const sameId = (a, b) => String(a ?? "") === String(b ?? "");

function TeamsPresenceBadge({ status = "offline", className = "" }) {
  const bg = status === "available" ? "bg-[#2585F4]" : status === "busy" ? "bg-[#C4314B]" : status === "away" ? "bg-[#F2C80F]" : "bg-[#8A8886]";
  return <span title={status} className={`inline-block rounded-full border-2 border-white ${bg} ${className}`} />;
}

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
  const [startingConversation, setStartingConversation] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const [messageSearch, setMessageSearch] = useState("");
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [messageActionBusy, setMessageActionBusy] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [onlineUsers, setOnlineUsers] = useState({});
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [headerTab, setHeaderTab] = useState("chat");
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [chatFilter, setChatFilter] = useState("all");
  const [mutedChats, setMutedChats] = useState([]);
  const [pinnedChats, setPinnedChats] = useState([]);
  const [showNewChatDrawer, setShowNewChatDrawer] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [formatActive, setFormatActive] = useState(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const socketRef = useRef(null);
  const selectedConversationIdRef = useRef(null);
  const conversationsRef = useRef([]);
  const messagesCache = useRef({});
  const fetchingMessagesRef = useRef(new Set());
  const sendingRef = useRef(false);

  useEffect(() => {
    setIsClient(true);
    try {
      const cachedMsgs = JSON.parse(localStorage.getItem("localpro_admin_msgs") || "{}");
      if (cachedMsgs) messagesCache.current = cachedMsgs;
    } catch {}
  }, []);

  const scrollToBottom = useCallback((instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? "auto" : "smooth", block: "end" });
  }, []);

  const fetchData = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      const headers = getAuthHeaders();
      const [usersRes, convsRes] = await Promise.all([
        fetch(getApiUrl("/users?limit=500"), { headers, cache: "no-store" }),
        fetch(getApiUrl("/conversations"), { headers, cache: "no-store" }),
      ]);

      if (usersRes.status === 401 || convsRes.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("accessToken");
        router.replace("/login");
        return;
      }

      const [uData, cData] = await Promise.all([parseResponse(usersRes), parseResponse(convsRes)]);
      const rUsers = normalizeUsers(uData);
      const rConvs = normalizeConversations(cData);

      setUsers(rUsers);
      setConversations(rConvs);
      conversationsRef.current = rConvs;
      if (rConvs.length > 0 && !selectedConversationIdRef.current) {
        setSelectedConversationId(getConversationId(rConvs[0]));
        selectedConversationIdRef.current = getConversationId(rConvs[0]);
        setSelectedConversation(rConvs[0]);
      }
    } catch (err) {
      console.error("[Chat Data Fetch Error]:", err);
    } finally {
      setLoadingUsers(false);
    }
  }, [router]);

  useEffect(() => {
    if (isClient) fetchData();
  }, [isClient, fetchData]);

  const fetchMessages = useCallback(async (cId) => {
    if (!cId || fetchingMessagesRef.current.has(cId)) return;
    fetchingMessagesRef.current.add(cId);
    try {
      const res = await fetch(getApiUrl(`/messages?conversationId=${encodeURIComponent(cId)}`), { headers: getAuthHeaders() });
      const data = await parseResponse(res);
      const list = extractMessages(data);
      messagesCache.current[cId] = list;
      if (sameId(selectedConversationIdRef.current, cId)) setMessages(list);
    } catch (e) {
      setMessages(messagesCache.current[cId] || []);
    } finally {
      fetchingMessagesRef.current.delete(cId);
    }
  }, []);

  const openConversation = useCallback(async (conv, user = null) => {
    const cId = getConversationId(conv);
    if (!cId) return;
    selectedConversationIdRef.current = String(cId);
    setSelectedConversationId(String(cId));
    setSelectedConversation(conv);
    if (user) setSelectedUser(user);
    setMessages(messagesCache.current[String(cId)] || []);
    await fetchMessages(cId);
    socketRef.current?.emit("join_room", String(cId));
  }, [fetchMessages]);

  const handleSelectUser = useCallback(async (user) => {
    const uId = getId(user);
    if (!uId) return;
    setSelectedUser(user);
    const existing = conversationsRef.current.find((c) => !c.isGroup && c.participants?.some((p) => sameId(getId(p), uId)));
    if (existing) {
      await openConversation(existing, user);
      return;
    }
    setStartingConversation(true);
    try {
      const res = await fetch(getApiUrl("/conversations"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ recipientId: uId }),
      });
      const data = await parseResponse(res);
      const newConv = data?.conversation || data?.data;
      if (newConv) {
        setConversations((prev) => [newConv, ...prev]);
        conversationsRef.current = [newConv, ...conversationsRef.current];
        await openConversation(newConv, user);
      }
    } finally {
      setStartingConversation(false);
    }
  }, [openConversation]);

  // Socket setup
  useEffect(() => {
    if (!isClient) return;
    const token = getStoredToken();
    const socket = io(BACKEND_BASE_URL, { auth: token ? { token } : {} });
    socketRef.current = socket;

    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("receive_message", (payload) => {
      const msg = payload?.message || payload;
      const cId = getConversationIdFromMessage(msg);
      if (sameId(selectedConversationIdRef.current, cId)) {
        setMessages((prev) => {
          if (prev.some((m) => sameId(getMessageId(m), getMessageId(msg)))) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
      }
    });

    return () => socket.disconnect();
  }, [isClient, scrollToBottom]);

  // Optimized Real-Time Send Message with Optimistic UI
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const text = message.trim();
    if (!text && selectedFiles.length === 0) return;
    const cId = selectedConversationId;
    if (!cId || sendingRef.current) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      id: tempId,
      conversationId: cId,
      body: text,
      message: text,
      sender: { name: "You", role: "admin", isCurrentUser: true },
      createdAt: new Date().toISOString(),
      status: "sending"
    };

    sendingRef.current = true;
    setSendingMessage(true);
    setMessage("");

    setMessages((prev) => [...prev, optimisticMessage]);
    scrollToBottom(true);

    try {
      const res = await fetch(getApiUrl("/messages"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ conversationId: cId, body: text, message: text, clientMessageId: tempId }),
      });
      const data = await parseResponse(res);
      if (res.ok && data?.success) {
        const sent = data.data || data.message;
        setMessages((prev) => prev.map((m) => (sameId(getMessageId(m), tempId) ? sent : m)));
      } else {
        throw new Error("Failed to send");
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => !sameId(getMessageId(m), tempId)));
      setMessage(text);
    } finally {
      sendingRef.current = false;
      setSendingMessage(false);
      messageInputRef.current?.focus();
    }
  };

  const sortedConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (!search) return true;
      const name = c.isGroup ? c.groupName : getUserName(c.participants?.find(p => !sameId(getId(p), getStoredToken())) || c.participants?.[0]);
      return name.toLowerCase().includes(search.toLowerCase());
    });
  }, [conversations, search]);

  const peopleForList = useMemo(() => {
    return users.filter((u) => !search || getUserName(u).toLowerCase().includes(search.toLowerCase()));
  }, [users, search]);

  const visibleMessages = useMemo(() => {
    if (!messageSearch) return messages;
    return messages.filter((m) => getMessageBody(m).toLowerCase().includes(messageSearch.toLowerCase()));
  }, [messages, messageSearch]);

  const selectedName = selectedUser ? getUserName(selectedUser) : selectedConversation?.groupName || "";
  const selectedAvatar = selectedUser ? getUserAvatar(selectedUser) : selectedConversation?.avatar || "";
  const isSelectedGroup = Boolean(selectedConversation?.isGroup);

  return (
    <div className="relative flex h-[100dvh] w-full overflow-hidden bg-[#F5F5F5] font-sans text-[#242424]">
      <section className="flex h-full w-full overflow-hidden">
        <ChatSidebar
          search={search}
          setSearch={setSearch}
          chatFilter={chatFilter}
          setChatFilter={setChatFilter}
          showNewChatDrawer={showNewChatDrawer}
          setShowNewChatDrawer={setShowNewChatDrawer}
          setShowGroupModal={setShowGroupModal}
          loadingUsers={loadingUsers}
          users={users}
          sortedConversations={sortedConversations}
          pinnedConversations={conversations.filter((c) => pinnedChats.includes(getConversationId(c)))}
          recentConversations={sortedConversations.filter((c) => !pinnedChats.includes(getConversationId(c)))}
          peopleForList={peopleForList}
          selectedConversationId={selectedConversationId}
          openConversation={openConversation}
          handleSelectUser={handleSelectUser}
          getConversationId={getConversationId}
          getUnreadCount={getUnreadCount}
          getConversationLastMessage={getConversationLastMessage}
          getConversationLastDate={getConversationLastDate}
          formatConversationTime={formatConversationTime}
          getUserName={getUserName}
          getUserAvatar={getUserAvatar}
          getInitials={getInitials}
          getFileUrl={getFileUrl}
          sameId={sameId}
          socketConnected={socketConnected}
          togglePin={(id) => setPinnedChats((prev) => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
          mutedChats={mutedChats}
          onlineUsers={onlineUsers}
          startingConversation={startingConversation}
          TeamsPresenceBadge={TeamsPresenceBadge}
        />

        <main className={`flex h-full flex-1 flex-col overflow-hidden bg-white ${selectedConversationId ? "flex" : "hidden md:flex"}`}>
          {selectedConversationId ? (
            <div className="flex h-full flex-col overflow-hidden">
              <ChatHeader
                selectedConversationId={selectedConversationId}
                setSelectedConversationId={setSelectedConversationId}
                selectedAvatar={selectedAvatar}
                isSelectedGroup={isSelectedGroup}
                selectedName={selectedName}
                selectedStatus="available"
                headerTab={headerTab}
                setHeaderTab={setHeaderTab}
                showMessageSearch={showMessageSearch}
                setShowMessageSearch={setShowMessageSearch}
                messageSearch={messageSearch}
                setMessageSearch={setMessageSearch}
                chatMenuOpen={chatMenuOpen}
                setChatMenuOpen={setChatMenuOpen}
                handleMarkUnread={() => {}}
                togglePin={() => {}}
                pinnedChats={pinnedChats}
                selectedKey={selectedConversationId}
                toggleMute={() => {}}
                mutedChats={mutedChats}
                handleDeleteConversation={() => {}}
                getFileUrl={getFileUrl}
                getInitials={getInitials}
                TeamsPresenceBadge={TeamsPresenceBadge}
              />

              {headerTab === "chat" && (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
                  <div className="flex-1 overflow-y-auto min-h-0">
                    <ChatMessages
                      visibleMessages={visibleMessages}
                      getMessageBody={getMessageBody}
                      getMessageId={getMessageId}
                      getSenderId={getSenderId}
                      getFileUrl={getFileUrl}
                      getInitials={getInitials}
                      getUserName={getUserName}
                      getUserAvatar={getUserAvatar}
                      formatMessageTime={formatMessageTime}
                      formatDayLabel={formatDayLabel}
                      sameId={sameId}
                      editingMessageId={editingMessageId}
                      setEditingMessageId={setEditingMessageId}
                      editDraft={editDraft}
                      setEditDraft={setEditDraft}
                      messageActionBusy={messageActionBusy}
                      handleSaveEditedMessage={() => {}}
                      handleReactToMessage={() => {}}
                      handleDeleteMessage={() => {}}
                      setReplyingTo={setReplyingTo}
                      messageInputRef={messageInputRef}
                      setPreviewPhotoUrl={setPreviewPhotoUrl}
                      messagesEndRef={messagesEndRef}
                    />
                  </div>

                  <ChatComposer
                    message={message}
                    setMessage={setMessage}
                    selectedFiles={selectedFiles}
                    setSelectedFiles={setSelectedFiles}
                    replyingTo={replyingTo}
                    setReplyingTo={setReplyingTo}
                    typingUsers={typingUsers}
                    selectedConversationId={selectedConversationId}
                    socketRef={socketRef}
                    emitTypingTimerRef={{ current: null }}
                    handleSendMessage={handleSendMessage}
                    sendingMessage={sendingMessage}
                    formatActive={formatActive}
                    setFormatActive={setFormatActive}
                    showEmojiPicker={showEmojiPicker}
                    setShowEmojiPicker={setShowEmojiPicker}
                    appendEmoji={(em) => setMessage((p) => p + em)}
                    fileInputRef={fileInputRef}
                    messageInputRef={messageInputRef}
                    getUserName={getUserName}
                    getMessageBody={getMessageBody}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center bg-white p-6 text-center">
              <MessageSquare size={36} className="text-[#5B5FC7]" />
              <h2 className="mt-2 text-base font-bold">Select a chat to view messages</h2>
            </div>
          )}
        </main>
      </section>

      <GroupModal
        showGroupModal={showGroupModal}
        setShowGroupModal={setShowGroupModal}
        groupName={groupName}
        setGroupName={setGroupName}
        selectedGroupMembers={selectedGroupMembers}
        setSelectedGroupMembers={setSelectedGroupMembers}
        creatingGroup={creatingGroup}
        handleCreateGroup={async (e) => {
          e.preventDefault();
          setCreatingGroup(true);
          try {
            const res = await fetch(getApiUrl("/conversations"), {
              method: "POST",
              headers: getAuthHeaders(),
              body: JSON.stringify({ isGroup: true, groupName, participants: selectedGroupMembers }),
            });
            const data = await parseResponse(res);
            if (res.ok && data?.success) {
              setShowGroupModal(false);
              fetchData();
            }
          } finally {
            setCreatingGroup(false);
          }
        }}
        users={users}
        getId={getId}
        getUserName={getUserName}
        getUserAvatar={getUserAvatar}
        getInitials={getInitials}
        getFileUrl={getFileUrl}
        sameId={sameId}
      />
    </div>
  );
}