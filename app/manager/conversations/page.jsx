"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCheck,
  Clock3,
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
  UserRound,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { authService } from "@/services/authService";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api";

const BACKEND_BASE_URL = API_URL.replace(/\/api\/?$/, "");

const getFileUrl = (url) => {
  if (!url) return "#";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${BACKEND_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

/* ============================================================
   AUDIO SYNTHESIZER: NOTIFICATION CHIME
   Uses Web Audio API (Zero external MP3 dependency, never 404s)
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
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Note 1 (E6 - 1318.5 Hz)
    createNote(1318.51, now, 0.12);
    // Note 2 (A6 - 1760 Hz)
    createNote(1760.00, now + 0.08, 0.32);
  } catch (err) {
    console.warn("Chime playback error:", err);
  }
};

/* =========================================================
   MANAGER CONVERSATIONS PAGE
========================================================= */

export default function ManagerConversationsPage() {
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);

  const [selectedConversation, setSelectedConversation] =
    useState(null);

  const [messages, setMessages] = useState([]);

  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);

  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] =
    useState(false);
  const [sending, setSending] = useState(false);

  const [error, setError] = useState("");
  const [messagesError, setMessagesError] =
    useState("");

  const [currentUser, setCurrentUser] =
    useState(null);

  // Sound enable/mute toggle
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Deletion modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [deletingMessage, setDeletingMessage] = useState(false);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const selectedConversationRef = useRef(null);

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // Auto scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /* =======================================================
     LOAD CONVERSATIONS + CONTACTS
  ======================================================= */

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      /* -----------------------------------------------
          AUTH
      ------------------------------------------------ */

      const me = await authService.me();

      if (!me) {
        window.location.href = "/login";
        return;
      }

      const user =
        me?.user ||
        me?.data?.user ||
        me?.data ||
        me;

      const role = String(
        user?.role || ""
      )
        .trim()
        .toLowerCase();

      setCurrentUser(user);

      if (role !== "manager" && role !== "admin") {
        if (role === "user") {
          window.location.href = "/user";
        } else {
          window.location.href = "/login";
        }

        return;
      }

      /* -----------------------------------------------
          GET BACKEND DATA
      ------------------------------------------------ */

      const response = await apiRequest(
        "/conversations",
        {
          method: "GET",
        }
      );

      const backendConversations =
        normalizeConversations(response);

      const backendContacts =
        normalizeContacts(response);

      setConversations(
        backendConversations
      );

      setContacts(
        backendContacts
      );
    } catch (err) {
      console.error(
        "Manager conversations error:",
        err
      );

      if (err?.status === 401) {
        window.location.href = "/login";
        return;
      }

      setError(
        err?.message ||
          "Unable to load conversations."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  /* =======================================================
     POLLING & INCOMING MESSAGE AUDIO NOTIFIER
  ======================================================= */
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
            const latestMsg = fetchedMessages[fetchedMessages.length - 1];
            const senderId = getUserId(latestMsg?.sender);
            const myId = getUserId(currentUser);

            // Play tone only if the message is from the other participant
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
      } catch (pollErr) {
        // Silent polling catch to avoid interrupting user interactions
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [currentUser, soundEnabled]);

  /* =======================================================
     BUILD DISPLAY LIST
  ======================================================= */

  const displayConversations = useMemo(() => {
    const conversationByUserId =
      new Map();

    conversations.forEach(
      (conversation) => {
        const participant =
          getOtherParticipant(
            conversation,
            currentUser
          );

        const participantId =
          getUserId(participant);

        if (participantId) {
          conversationByUserId.set(
            participantId,
            conversation
          );
        }
      }
    );

    const contactItems =
      contacts.map((contact) => {
        const contactId =
          getUserId(contact);

        const existing =
          contactId
            ? conversationByUserId.get(
                contactId
              )
            : null;

        if (existing) {
          return existing;
        }

        return {
          id: null,
          _id: null,
          participants: [
            contact,
          ],
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

    const contactIds =
      new Set(
        contacts
          .map(getUserId)
          .filter(Boolean)
      );

    const unmatchedConversations =
      conversations.filter(
        (conversation) => {
          const participant =
            getOtherParticipant(
              conversation,
              currentUser
            );

          const participantId =
            getUserId(participant);

          return (
            !participantId ||
            !contactIds.has(
              participantId
            )
          );
        }
      );

    return [
      ...contactItems,
      ...unmatchedConversations,
    ];
  }, [
    contacts,
    conversations,
    currentUser,
  ]);

  /* =======================================================
     FILTER
  ======================================================= */

  const filteredConversations =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return displayConversations;
      }

      return displayConversations.filter(
        (conversation) => {
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

          const phone =
            getParticipantPhone(
              conversation,
              currentUser
            );

          const role =
            getParticipantRole(
              conversation,
              currentUser
            );

          const lastMessage =
            String(
              conversation?.lastMessage ||
                conversation?.lastMessageText ||
                conversation?.preview ||
                ""
            );

          return `${name} ${email} ${phone} ${role} ${lastMessage}`
            .toLowerCase()
            .includes(query);
        }
      );
    }, [
      displayConversations,
      search,
      currentUser,
    ]);

  /* =======================================================
     FILE HANDLING
  ======================================================= */

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setSelectedFiles((prev) => [...prev, ...files].slice(0, 5));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  /* =======================================================
     SELECT CONVERSATION / CONTACT
  ======================================================= */

  async function handleSelectConversation(
    item
  ) {
    if (!item) {
      return;
    }

    setMessages([]);
    setMessagesError("");
    setSelectedFiles([]);

    let conversation =
      item;

    let conversationId =
      getConversationId(
        conversation
      );

    try {
      setMessagesLoading(true);

      if (
        !conversationId &&
        conversation?.isNewContact
      ) {
        const contact =
          getOtherParticipant(
            conversation,
            currentUser
          );

        const recipientId =
          getUserId(contact);

        if (!recipientId) {
          throw new Error(
            "Selected user does not have a valid user ID."
          );
        }

        const response =
          await apiRequest(
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
          response?.data ||
          null;

        if (!created) {
          throw new Error(
            "Backend did not return the created conversation."
          );
        }

        conversation =
          created;

        conversationId =
          getConversationId(
            created
          );

        setConversations(
          (current) => {
            const exists =
              current.some(
                (item) =>
                  getConversationId(
                    item
                  ) === conversationId
              );

            if (exists) {
              return current;
            }

            return [
              ...current,
              created,
            ];
          }
        );
      }

      if (!conversationId) {
        throw new Error(
          "This conversation does not have a valid ID."
        );
      }

      setSelectedConversation(
        conversation
      );

      const unreadCount =
        Number(
          conversation?.unreadCount ||
            conversation?.unread ||
            0
        );

      if (unreadCount > 0) {
        try {
          await markConversationRead(
            conversationId
          );

          setConversations(
            (current) =>
              current.map(
                (item) => {
                  if (
                    getConversationId(
                      item
                    ) !==
                    conversationId
                  ) {
                    return item;
                  }

                  return {
                    ...item,
                    unreadCount: 0,
                    unread: 0,
                  };
                }
              )
          );

          setSelectedConversation(
            (current) =>
              current
                ? {
                    ...current,
                    unreadCount: 0,
                    unread: 0,
                  }
                : current
          );
        } catch (readError) {
          console.error(
            "Mark conversation read error:",
            readError
          );
        }
      }

      const response =
        await getConversationMessages(
          conversationId
        );

      setMessages(
        normalizeMessages(
          response
        )
      );
    } catch (err) {
      console.error(
        "Conversation selection error:",
        err
      );

      if (err?.status === 401) {
        window.location.href =
          "/login";
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

  /* =======================================================
     SEND MESSAGE (SUPPORTS FILES + TEXT)
  ======================================================= */

  async function handleSendMessage(
    event
  ) {
    event.preventDefault();

    const body =
      message.trim();

    if (
      (!body && selectedFiles.length === 0) ||
      !selectedConversation ||
      sending
    ) {
      return;
    }

    let conversationId =
      getConversationId(
        selectedConversation
      );

    try {
      setSending(true);
      setMessagesError("");

      const contact =
        getOtherParticipant(
          selectedConversation,
          currentUser
        );

      const recipientId =
        getUserId(contact);

      if (!conversationId) {
        if (!recipientId) {
          throw new Error(
            "Recipient user ID is missing."
          );
        }

        const createResponse =
          await apiRequest(
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

        conversationId =
          getConversationId(
            created
          );

        setSelectedConversation(
          created
        );

        setConversations(
          (current) => {
            const exists =
              current.some(
                (item) =>
                  getConversationId(
                    item
                  ) === conversationId
              );

            return exists
              ? current
              : [
                  ...current,
                  created,
                ];
          }
        );
      }

      let response;

      if (selectedFiles.length > 0) {
        const formData = new FormData();
        formData.append("body", body);
        formData.append("recipientId", recipientId);
        formData.append("conversationId", conversationId);

        selectedFiles.forEach((file) => {
          formData.append("files", file);
        });

        const res = await fetch(`${API_URL}/messages`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        response = await res.json();
        if (!res.ok) {
          throw new Error(response?.message || "Failed to send files.");
        }
      } else {
        response =
          await apiRequest(
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

      if (sentMessage && typeof sentMessage === "object") {
        setMessages(
          (current) => [
            ...current,
            sentMessage,
          ]
        );
      } else {
        const refreshed =
          await getConversationMessages(
            conversationId
          );

        setMessages(
          normalizeMessages(
            refreshed
          )
        );
      }

      setMessage("");
      setSelectedFiles([]);

      await refreshConversations(
        conversationId
      );
    } catch (err) {
      console.error(
        "Send message error:",
        err
      );

      if (err?.status === 401) {
        window.location.href =
          "/login";
        return;
      }

      setMessagesError(
        err?.message ||
          "Unable to send message."
      );
    } finally {
      setSending(false);
    }
  }

  /* =======================================================
     DELETE MESSAGE (FOR ME / FOR EVERYONE)
  ======================================================= */

  function promptDeleteMessage(msg) {
    setMessageToDelete(msg);
    setDeleteModalOpen(true);
  }

  async function executeDeleteMessage(type) {
    if (!messageToDelete) return;

    const messageId = messageToDelete._id || messageToDelete.id;
    if (!messageId) return;

    try {
      setDeletingMessage(true);

      const endpoint =
        type === "everyone"
          ? `/messages/${messageId}/delete-for-everyone`
          : `/messages/${messageId}/delete-for-me`;

      const response = await apiRequest(endpoint, {
        method: "POST",
      });

      if (type === "me") {
        // Hide message from current screen
        setMessages((prev) =>
          prev.filter(
            (m) => (m._id || m.id).toString() !== messageId.toString()
          )
        );
      } else {
        // Update in-place to deleted message state
        const updatedMsg = response?.data || response?.message;
        setMessages((prev) =>
          prev.map((m) => {
            if ((m._id || m.id).toString() === messageId.toString()) {
              return {
                ...m,
                ...(updatedMsg || {}),
                body: "This message was deleted",
                message: "This message was deleted",
                isDeletedForEveryone: true,
                attachments: [],
              };
            }
            return m;
          })
        );
      }

      setDeleteModalOpen(false);
      setMessageToDelete(null);

      const conversationId = getConversationId(selectedConversation);
      if (conversationId) {
        refreshConversations(conversationId);
      }
    } catch (delError) {
      console.error("Delete message failed:", delError);
      alert(delError?.message || "Failed to delete message.");
    } finally {
      setDeletingMessage(false);
    }
  }

  /* =======================================================
     REFRESH CONVERSATIONS
  ======================================================= */

  async function refreshConversations(
    selectedId = null
  ) {
    try {
      const response =
        await apiRequest(
          "/conversations",
          {
            method: "GET",
          }
        );

      const normalized =
        normalizeConversations(
          response
        );

      const normalizedContacts =
        normalizeContacts(
          response
        );

      setConversations(
        normalized
      );

      setContacts(
        normalizedContacts
      );

      if (selectedId) {
        const updated =
          normalized.find(
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
      console.error(
        "Refresh conversations error:",
        err
      );

      if (err?.status === 401) {
        window.location.href =
          "/login";
      }
    }
  }

  /* =======================================================
     SELECTED USER
  ======================================================= */

  const selectedName =
    selectedConversation
      ? getParticipantName(
          selectedConversation,
          currentUser
        )
      : "Select a User";

  const selectedEmail =
    selectedConversation
      ? getParticipantEmail(
          selectedConversation,
          currentUser
        )
      : "";

  const selectedRole =
    selectedConversation
      ? getParticipantRole(
          selectedConversation,
          currentUser
        )
      : "";

  const selectedChannel =
    selectedConversation?.channel ||
    "chat";

  /* =======================================================
     UI (STABLE LAYOUT H-SCREEN OVERFLOW-HIDDEN)
  ======================================================= */

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F8FAFC]">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* =================================================
            HEADER
        ================================================= */}

        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#2563EB]">
              MANAGER WORKSPACE
            </p>
            <h1 className="text-sm font-bold text-[#171B3A]">
              Conversations
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* SOUND MUTE / UNMUTE TOGGLE */}
            <button
              type="button"
              onClick={() => {
                const nextState = !soundEnabled;
                setSoundEnabled(nextState);
                if (nextState) playNotificationChime();
              }}
              className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition ${
                soundEnabled
                  ? "border-blue-200 bg-blue-50 text-[#2563EB]"
                  : "border-slate-200 bg-white text-slate-400"
              }`}
              title={soundEnabled ? "Notification sound is ON" : "Notification sound is MUTED"}
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              <span className="hidden sm:inline">{soundEnabled ? "Sound ON" : "Muted"}</span>
            </button>

            <Link
              href="/manager"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#26344D] shadow-xs transition hover:bg-slate-50"
            >
              <ArrowLeft size={15} />
              Dashboard
            </Link>
          </div>
        </header>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <section className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 mx-4 mt-4">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>
          </section>
        )}

        {/* =================================================
            WORKSPACE (STABLE VIEWPORT LOCK)
        ================================================= */}

        <main className="flex min-h-0 flex-1 flex-col p-4 sm:p-5 lg:p-6">
          <section className="grid min-h-0 flex-1 w-full grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[340px_minmax(0,1fr)]">

            {/* =================================================
                LEFT: USER & CONVERSATION LIST
            ================================================= */}

            <aside className="flex min-h-0 flex-col border-b border-slate-200 lg:border-b-0 lg:border-r">

              {/* SEARCH */}

              <div className="shrink-0 border-b border-slate-100 p-4 sm:p-5">
                <div className="mb-4">
                  <h2 className="text-base font-bold text-[#171B3A]">
                    Users & Conversations
                  </h2>

                  <p className="mt-1 text-xs text-[#64748B]">
                    Select any available user
                    to start chatting.
                  </p>
                </div>

                <div className="relative">
                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]"
                  />

                  <input
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search users..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] pl-9 pr-3 text-sm text-[#26344D] outline-none transition placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              {/* LIST */}

              <div className="min-h-0 flex-1 overflow-y-auto">
                {loading ? (
                  <ConversationLoading />
                ) : filteredConversations.length >
                  0 ? (
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
                        (
                          id
                            ? getConversationId(
                                selectedConversation
                              ) === id
                            : getUserId(
                                getOtherParticipant(
                                  selectedConversation,
                                  currentUser
                                )
                              ) ===
                              participantId
                        );

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
                          className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-4 text-left transition ${
                            active
                              ? "bg-[#EEF4FF]"
                              : "hover:bg-[#F8FAFC]"
                          }`}
                        >
                          {/* AVATAR */}

                          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EEF4FF] text-[#2563EB]">
                            {avatar ? (
                              <img
                                src={avatar}
                                alt={name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <UserRound
                                size={19}
                              />
                            )}

                            {unread > 0 && (
                              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2563EB] px-1 text-[10px] font-bold text-white">
                                {unread >
                                99
                                  ? "99+"
                                  : unread}
                              </span>
                            )}
                          </div>

                          {/* INFO */}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p
                                className={`truncate text-sm ${
                                  unread >
                                  0
                                    ? "font-bold text-[#171B3A]"
                                    : "font-semibold text-[#171B3A]"
                                }`}
                              >
                                {name}
                              </p>

                              <span className="shrink-0 text-[10px] text-[#64748B]">
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
                              <p className="mt-1 text-[9px] font-bold uppercase text-[#2563EB]">
                                {role}
                              </p>
                            )}

                            <p className="mt-1 truncate text-xs text-[#64748B]">
                              {lastMessage}
                            </p>

                            <div className="mt-2 flex items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-600">
                                {conversation?.isNewContact
                                  ? "New Chat"
                                  : conversation?.channel ||
                                    "Chat"}
                              </span>

                              {conversation?.status && (
                                <span className="truncate text-[9px] font-medium text-slate-400">
                                  {
                                    conversation.status
                                  }
                                </span>
                              )}
                            </div>
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

            {/* =================================================
                RIGHT: CHAT PANE (INDEPENDENT SCROLL)
            ================================================= */}

            <div className="flex min-h-0 min-w-0 flex-col">

              {/* HEADER */}

              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EEF4FF] text-[#2563EB]">
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
                        size={20}
                      />
                    )}
                  </div>

                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-[#171B3A]">
                      {selectedName}
                    </h2>

                    <div className="mt-1 flex min-w-0 items-center gap-1.5">
                      <Clock3
                        size={12}
                        className="shrink-0 text-[#64748B]"
                      />

                      <p className="truncate text-xs text-[#64748B]">
                        {selectedConversation
                          ? selectedEmail ||
                            selectedRole ||
                            String(
                              selectedChannel
                            ).toUpperCase()
                          : "Choose a user to start a conversation"}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={
                    !selectedConversation
                  }
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  aria-label="Conversation options"
                >
                  <MoreVertical
                    size={18}
                  />
                </button>
              </div>

              {/* MESSAGES (SCROLLABLE AREA) */}

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
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
                ) : messages.length ===
                  0 ? (
                  <NoMessages />
                ) : (
                  <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
                    {messages.map(
                      (
                        item,
                        index
                      ) => (
                        <MessageBubble
                          key={
                            item?._id ||
                            item?.id ||
                            `${item?.createdAt || "message"}-${index}`
                          }
                          message={
                            item
                          }
                          currentUser={
                            currentUser
                          }
                          onDeletePrompt={
                            promptDeleteMessage
                          }
                        />
                      )
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* COMPOSER (FIXED BOTTOM) */}

              <div className="shrink-0 border-t border-slate-100 bg-white p-4 sm:p-5">
                
                {/* SELECTED ATTACHMENT CHIPS */}
                {selectedFiles.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[#F8FAFC] px-2.5 py-1 text-xs text-[#26344D]"
                      >
                        {file.type.startsWith("image/") ? (
                          <ImageIcon size={13} className="text-[#2563EB]" />
                        ) : (
                          <File size={13} className="text-[#2563EB]" />
                        )}
                        <span className="max-w-[140px] truncate font-medium">
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeSelectedFile(idx)}
                          className="ml-1 rounded text-slate-400 hover:text-red-500"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form
                  onSubmit={
                    handleSendMessage
                  }
                  className="flex items-end gap-2"
                >
                  {/* Hidden Multi-file input */}
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
                    disabled={
                      !selectedConversation ||
                      sending
                    }
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-[#2563EB] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
                    aria-label="Attach file"
                  >
                    <Paperclip
                      size={18}
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    <textarea
                      value={message}
                      onChange={(event) =>
                        setMessage(
                          event.target.value
                        )
                      }
                      onKeyDown={(
                        event
                      ) => {
                        if (
                          event.key ===
                            "Enter" &&
                          !event.shiftKey
                        ) {
                          event.preventDefault();

                          if (
                            (message.trim() || selectedFiles.length > 0) &&
                            selectedConversation &&
                            !sending
                          ) {
                            handleSendMessage(
                              event
                            );
                          }
                        }
                      }}
                      placeholder={
                        selectedConversation
                          ? `Message ${selectedName} or attach files...`
                          : "Select a user first..."
                      }
                      rows={1}
                      disabled={
                        !selectedConversation ||
                        sending
                      }
                      className="min-h-11 max-h-32 w-full resize-y rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={
                      (!message.trim() && selectedFiles.length === 0) ||
                      !selectedConversation ||
                      sending
                    }
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                    aria-label="Send message"
                  >
                    {sending ? (
                      <Loader2
                        size={18}
                        className="animate-spin"
                      />
                    ) : (
                      <Send
                        size={18}
                      />
                    )}
                  </button>
                </form>

                <p className="mt-2 px-1 text-[10px] text-[#64748B]">
                  Enter to send • Shift +
                  Enter for a new line • Click Paperclip to add files
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* =======================================================
          DELETE MESSAGE CONFIRMATION MODAL
      ======================================================= */}
      {deleteModalOpen && messageToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#171B3A]">
                  Delete Message?
                </h3>
                <p className="text-xs text-[#64748B]">
                  Choose how you want to delete this message.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs italic text-[#26344D]">
              &ldquo;
              {messageToDelete?.isDeletedForEveryone
                ? "This message was deleted"
                : messageToDelete?.body ||
                  messageToDelete?.message ||
                  (messageToDelete?.attachments?.length > 0 ? "Attachment" : "Message")}
              &rdquo;
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              {/* Delete for Everyone option (Manager role can delete any message for everyone) */}
              {!messageToDelete?.isDeletedForEveryone && (
                <button
                  type="button"
                  disabled={deletingMessage}
                  onClick={() => executeDeleteMessage("everyone")}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingMessage ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Users size={16} />
                  )}
                  Delete for Everyone
                </button>
              )}

              {/* Delete for Me option */}
              <button
                type="button"
                disabled={deletingMessage}
                onClick={() => executeDeleteMessage("me")}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#26344D] transition hover:bg-slate-50 disabled:opacity-50"
              >
                {deletingMessage ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
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
                className="mt-1 h-10 w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-50"
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

/* =========================================================
   MESSAGE BUBBLE WITH 3-DOTS MENU
========================================================= */

function MessageBubble({
  message,
  currentUser,
  onDeletePrompt,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const senderId =
    getUserId(
      message?.sender
    );

  const currentUserId =
    getUserId(
      currentUser
    );

  const isOutgoing =
    senderId &&
    currentUserId &&
    senderId.toString() ===
      currentUserId.toString();

  const isDeleted = Boolean(message?.isDeletedForEveryone);

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

  // Close popup menu on clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
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
      className={`group relative flex w-full items-center gap-2 ${
        isOutgoing
          ? "justify-end"
          : "justify-start"
      }`}
    >
      {/* 3-DOTS ACTION TRIGGER FOR OUTGOING MESSAGES (Left side of bubble) */}
      {isOutgoing && !isDeleted && (
        <div className="relative opacity-0 transition-opacity group-hover:opacity-100" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Message options"
          >
            <MoreVertical size={15} />
          </button>

          {menuOpen && (
            <div className="absolute bottom-full right-0 z-20 mb-1 w-44 rounded-xl border border-slate-100 bg-white py-1.5 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDeletePrompt(message);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-red-600 transition hover:bg-red-50"
              >
                <Trash2 size={13} />
                Delete Message
              </button>
            </div>
          )}
        </div>
      )}

      {/* BUBBLE */}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[75%] ${
          isDeleted
            ? "border border-slate-200 bg-slate-50 italic text-slate-400"
            : isOutgoing
            ? "rounded-br-md bg-[#2563EB] text-white"
            : "rounded-bl-md border border-slate-200 bg-white text-[#26344D]"
        }`}
      >
        {!isOutgoing &&
          sender &&
          !isDeleted && (
            <p className="mb-1 text-[10px] font-bold text-[#2563EB]">
              {sender}
            </p>
          )}

        {isDeleted ? (
          <div className="flex items-center gap-1.5 text-xs">
            <AlertTriangle size={13} />
            <span>This message was deleted</span>
          </div>
        ) : (
          body && (
            <p className="whitespace-pre-wrap break-words text-sm leading-6">
              {body}
            </p>
          )
        )}

        {/* ATTACHMENTS RENDERING */}
        {!isDeleted && Array.isArray(message?.attachments) && message.attachments.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.attachments.map((attachment, attachmentIndex) => {
              const mime = String(
                attachment?.mimeType || attachment?.fileType || ""
              ).toLowerCase();
              const isImg = mime.startsWith("image/");
              const fullUrl = getFileUrl(attachment?.url);

              if (isImg) {
                return (
                  <a
                    key={attachment?.url || attachmentIndex}
                    href={fullUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-2xs hover:opacity-95"
                  >
                    <img
                      src={fullUrl}
                      alt={attachment?.originalName || attachment?.filename || "Attached Image"}
                      className="max-h-60 w-auto rounded-lg object-contain"
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
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-2xs transition ${
                    isOutgoing
                      ? "border-blue-200 bg-blue-50 text-[#2563EB] hover:bg-blue-100"
                      : "border-slate-200 bg-white text-[#26344D] hover:bg-slate-50"
                  }`}
                >
                  <FileText size={15} className="shrink-0 text-[#2563EB]" />
                  <span className="max-w-[220px] truncate">
                    {attachment?.originalName || attachment?.filename || "Attached Document"}
                  </span>
                </a>
              );
            })}
          </div>
        )}

        <div
          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
            isDeleted
              ? "text-slate-400"
              : isOutgoing
              ? "text-blue-100"
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

          {isOutgoing && !isDeleted && (
            <CheckCheck
              size={12}
            />
          )}
        </div>
      </div>

      {/* 3-DOTS ACTION TRIGGER FOR INCOMING MESSAGES (Right side of bubble) */}
      {!isOutgoing && !isDeleted && (
        <div className="relative opacity-0 transition-opacity group-hover:opacity-100" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Message options"
          >
            <MoreVertical size={15} />
          </button>

          {menuOpen && (
            <div className="absolute bottom-full left-0 z-20 mb-1 w-44 rounded-xl border border-slate-100 bg-white py-1.5 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDeletePrompt(message);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-red-600 transition hover:bg-red-50"
              >
                <Trash2 size={13} />
                Delete Message
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   EMPTY LIST
========================================================= */

function EmptyConversationList({
  search,
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
        <MessageSquare
          size={25}
        />
      </div>

      <h3 className="mt-4 text-sm font-bold text-[#171B3A]">
        {search
          ? "No matching users"
          : "No users available"}
      </h3>

      <p className="mt-2 max-w-xs text-sm leading-6 text-[#64748B]">
        {search
          ? "No available backend user matches your search."
          : "The backend did not return any available users for messaging."}
      </p>
    </div>
  );
}

/* =========================================================
   NO SELECTED
========================================================= */

function NoConversationSelected() {
  return (
    <div className="flex h-full min-h-[400px] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
          <MessageSquare
            size={28}
          />
        </div>

        <h3 className="mt-5 text-base font-bold text-[#171B3A]">
          Select a user
        </h3>

        <p className="mt-2 text-sm leading-6 text-[#64748B]">
          Select any available user
          from the left side to start
          a conversation.
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   NO MESSAGES
========================================================= */

function NoMessages() {
  return (
    <div className="flex h-full min-h-[400px] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
          <MessageSquare
            size={25}
          />
        </div>

        <h3 className="mt-4 text-sm font-bold text-[#171B3A]">
          No messages yet
        </h3>

        <p className="mt-2 text-sm leading-6 text-[#64748B]">
          Start the conversation by
          sending the first message.
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   LOADING
========================================================= */

function ConversationLoading() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 px-6">
      <Loader2
        size={28}
        className="animate-spin text-[#2563EB]"
      />

      <p className="text-sm font-medium text-[#64748B]">
        Loading users...
      </p>
    </div>
  );
}

function MessagesLoading() {
  return (
    <div className="flex h-full min-h-[400px] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2
          size={28}
          className="animate-spin text-[#2563EB]"
        />

        <p className="text-sm font-medium text-[#64748B]">
          Loading messages...
        </p>
      </div>
    </div>
  );
}

function MessageError({
  message,
}) {
  return (
    <div className="flex h-full min-h-[400px] items-center justify-center">
      <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
        <p className="text-sm font-semibold text-red-700">
          {message}
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   USER HELPERS
========================================================= */

function getUserId(user) {
  if (!user) {
    return null;
  }

  if (
    typeof user ===
      "string" ||
    typeof user ===
      "number"
  ) {
    return user;
  }

  return (
    user?._id ||
    user?.id ||
    user?.userId ||
    null
  );
}

/* =========================================================
   PARTICIPANT
========================================================= */

function getOtherParticipant(
  conversation,
  currentUser
) {
  if (
    conversation?.contact
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

/* =========================================================
   PARTICIPANT NAME
========================================================= */

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
    conversation?.customerName ||
    conversation?.recipientName ||
    conversation?.email ||
    "User"
  );
}

/* =========================================================
   EMAIL
========================================================= */

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
    conversation?.userEmail ||
    conversation?.customerEmail ||
    ""
  );
}

/* =========================================================
   PHONE
========================================================= */

function getParticipantPhone(
  conversation,
  currentUser
) {
  const participant =
    getOtherParticipant(
      conversation,
      currentUser
    );

  return (
    participant?.phone ||
    participant?.phoneNumber ||
    conversation?.phone ||
    conversation?.userPhone ||
    ""
  );
}

/* =========================================================
   ROLE
========================================================= */

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

/* =========================================================
   AVATAR
========================================================= */

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
    participant?.profilePicture ||
    participant?.image ||
    conversation?.avatar ||
    conversation?.profileImage ||
    ""
  );
}

/* =========================================================
   CONVERSATION ID
========================================================= */

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

/* =========================================================
   NORMALIZE CONVERSATIONS
========================================================= */

function normalizeConversations(
  response
) {
  const possible =
    response?.conversations ||
    response?.data?.conversations ||
    response?.results ||
    response?.data?.results ||
    response?.items ||
    [];

  if (
    !Array.isArray(possible)
  ) {
    return [];
  }

  return possible;
}

/* =========================================================
   NORMALIZE CONTACTS
========================================================= */

function normalizeContacts(
  response
) {
  const possible =
    response?.contacts ||
    response?.users ||
    response?.data?.contacts ||
    response?.data?.users ||
    [];

  if (
    !Array.isArray(possible)
  ) {
    return [];
  }

  return possible.filter(
    Boolean
  );
}

/* =========================================================
   NORMALIZE MESSAGES
========================================================= */

function normalizeMessages(
  response
) {
  const possible =
    response?.messages ||
    response?.data?.messages ||
    response?.results ||
    response?.data?.results ||
    response?.items ||
    [];

  if (
    !Array.isArray(possible)
  ) {
    return [];
  }

  return possible;
}

/* =========================================================
   MARK READ
========================================================= */

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

/* =========================================================
   GET MESSAGES
========================================================= */

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

/* =========================================================
   API REQUEST
========================================================= */

async function apiRequest(
  endpoint,
  options = {}
) {
  const response =
    await fetch(
      `${API_URL}${endpoint}`,
      {
        ...options,

        credentials: "include",

        headers: {
          "Content-Type":
            "application/json",

          ...(options.headers ||
            {}),
        },
      }
    );

  let data = null;

  try {
    data =
      await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error =
      new Error(
        data?.message ||
          data?.error ||
          data?.errors?.[0]
            ?.message ||
          `Request failed with status ${response.status}`
      );

    error.status =
      response.status;

    throw error;
  }

  return data;
}

/* =========================================================
  DATE
========================================================= */

function formatDateTime(
  date
) {
  if (!date) {
    return "";
  }

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

  const sameYear =
    parsed.getFullYear() ===
    now.getFullYear();

  if (sameYear) {
    return parsed.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
      }
    );
  }

  return parsed.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

/* =========================================================
  TIME
========================================================= */

function formatTime(date) {
  if (!date) {
    return "";
  }

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