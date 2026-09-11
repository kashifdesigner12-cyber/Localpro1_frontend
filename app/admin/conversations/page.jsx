"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";

import {
  AlertTriangle,
  FileText,
  File,
  Image as ImageIcon,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Search,
  Send,
  Users,
  RefreshCw,
  Trash2,
  X,
  Loader2,
} from "lucide-react";

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

/* ============================================================
   FILE URL
============================================================ */

const getFileUrl = (url) => {
  if (!url) {
    return "#";
  }

  const value = String(url);

  if (
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  return `${BACKEND_BASE_URL}${
    value.startsWith("/") ? "" : "/"
  }${value}`;
};

/* ============================================================
   TOKEN
============================================================ */

const normalizeTokenValue = (value) => {
  if (!value) {
    return null;
  }

  let rawValue = String(value).trim();

  if (!rawValue) {
    return null;
  }

  if (/^Bearer\s+/i.test(rawValue)) {
    rawValue = rawValue
      .replace(/^Bearer\s+/i, "")
      .trim();
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (typeof parsed === "string") {
      return (
        parsed.replace(/^Bearer\s+/i, "").trim() ||
        null
      );
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
  } catch {
    // Raw token.
  }

  return rawValue || null;
};

const getStoredToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

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

      if (localToken) {
        return localToken;
      }
    } catch {
      // Ignore storage errors.
    }

    try {
      const sessionToken = normalizeTokenValue(
        window.sessionStorage.getItem(key)
      );

      if (sessionToken) {
        return sessionToken;
      }
    } catch {
      // Ignore storage errors.
    }
  }

  return null;
};

/* ============================================================
   AUTH HEADERS
============================================================ */

const getAuthHeaders = (
  includeContentType = true
) => {
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

    if (!text) {
      return null;
    }

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
   AUDIO
============================================================ */

const playNotificationChime = () => {
  try {
    if (typeof window === "undefined") {
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioCtx) {
      return;
    }

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const createNote = (
      frequency,
      startTime,
      duration
    ) => {
      const oscillator =
        ctx.createOscillator();

      const gain =
        ctx.createGain();

      oscillator.type = "sine";

      oscillator.frequency.setValueAtTime(
        frequency,
        startTime
      );

      gain.gain.setValueAtTime(
        0.18,
        startTime
      );

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        startTime + duration
      );

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start(startTime);
      oscillator.stop(
        startTime + duration
      );
    };

    createNote(
      1318.51,
      now,
      0.12
    );

    createNote(
      1760,
      now + 0.08,
      0.32
    );
  } catch {
    // Audio is optional.
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
  if (!user?.role) {
    return "";
  }

  return (
    String(user.role).charAt(0).toUpperCase() +
    String(user.role).slice(1)
  );
};

const getInitials = (name) => {
  if (!name) {
    return "U";
  }

  return String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join("");
};

const formatMessageTime = (dateValue) => {
  if (!dateValue) {
    return "";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatConversationTime = (
  dateValue
) => {
  if (!dateValue) {
    return "";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();

  if (
    date.toDateString() ===
    now.toDateString()
  ) {
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
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.users)) {
    return data.users;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.users?.data)) {
    return data.users.data;
  }

  return [];
};

const normalizeConversations = (data) => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.conversations)) {
    return data.conversations;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (
    Array.isArray(
      data?.data?.conversations
    )
  ) {
    return data.data.conversations;
  }

  return [];
};

/* ============================================================
   MAIN PAGE
============================================================ */

export default function AdminConversationsPage() {
  const [search, setSearch] = useState("");

  const [users, setUsers] = useState([]);

  const [
    conversations,
    setConversations,
  ] = useState([]);

  const [
    selectedUser,
    setSelectedUser,
  ] = useState(null);

  const [
    selectedConversationId,
    setSelectedConversationId,
  ] = useState(null);

  const [
    selectedConversation,
    setSelectedConversation,
  ] = useState(null);

  const [messages, setMessages] =
    useState([]);

  const [message, setMessage] =
    useState("");

  const [
    selectedFiles,
    setSelectedFiles,
  ] = useState([]);

  const [
    loadingUsers,
    setLoadingUsers,
  ] = useState(true);

  const [
    loadingConversations,
    setLoadingConversations,
  ] = useState(true);

  const [
    loadingMessages,
    setLoadingMessages,
  ] = useState(false);

  const [
    startingConversation,
    setStartingConversation,
  ] = useState(false);

  const [
    sendingMessage,
    setSendingMessage,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [
    messagesError,
    setMessagesError,
  ] = useState("");

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    soundEnabled,
    setSoundEnabled,
  ] = useState(true);

  const [
    deleteModalOpen,
    setDeleteModalOpen,
  ] = useState(false);

  const [
    messageToDelete,
    setMessageToDelete,
  ] = useState(null);

  const [
    deletingMessage,
    setDeletingMessage,
  ] = useState(false);

  const fileInputRef =
    useRef(null);

  const messagesEndRef =
    useRef(null);

  const selectedConversationIdRef =
    useRef(null);

  const conversationsRef =
    useRef([]);

  const usersRef =
    useRef([]);

  const mountedRef =
    useRef(false);

  const usersLoadedRef =
    useRef(false);

  const usersRequestRef =
    useRef(false);

  const conversationsRequestRef =
    useRef(false);

  const messagesRequestRef =
    useRef(false);

  const startingConversationRef =
    useRef(false);

  const pollingRequestRef =
    useRef(false);

  const soundEnabledRef =
    useRef(soundEnabled);

  const lastMessageIdRef =
    useRef(null);

  const pollingInitializedRef =
    useRef(false);

  /* ==========================================================
     MOUNT
  ========================================================== */

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ==========================================================
     SYNC REFS
  ========================================================== */

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    conversationsRef.current =
      conversations;
  }, [conversations]);

  useEffect(() => {
    selectedConversationIdRef.current =
      selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    soundEnabledRef.current =
      soundEnabled;
  }, [soundEnabled]);

  /* ==========================================================
     AUTO SCROLL
  ========================================================== */

  const scrollToBottom = useCallback(
    () => {
      messagesEndRef.current?.scrollIntoView(
        {
          behavior: "smooth",
        }
      );
    },
    []
  );

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /* ==========================================================
     FETCH USERS
     ONLY ONCE
  ========================================================== */

  const fetchUsers = useCallback(
    async () => {
      if (usersLoadedRef.current) {
        return usersRef.current;
      }

      if (usersRequestRef.current) {
        return usersRef.current;
      }

      usersRequestRef.current = true;

      try {
        if (mountedRef.current) {
          setLoadingUsers(true);
        }

        const response =
          await fetch(
            getApiUrl("/users"),
            {
              method: "GET",
              credentials: "include",
              headers:
                getAuthHeaders(),
              cache: "no-store",
            }
          );

        const data =
          await parseResponse(
            response
          );

        if (response.status === 401) {
          if (mountedRef.current) {
            setError(
              "Authentication failed. Please sign in again if the problem continues."
            );
          }

          return usersRef.current;
        }

        if (response.status === 403) {
          throw new Error(
            data?.message ||
              "You do not have permission to load users."
          );
        }

        if (!response.ok) {
          throw new Error(
            data?.message ||
              "Failed to load users."
          );
        }

        const userData =
          normalizeUsers(data);

        const availableUsers =
          userData.filter((user) => {
            if (!user) {
              return false;
            }

            const role = String(
              user?.role || ""
            ).toLowerCase();

            return (
              role === "user" ||
              role === "manager"
            );
          });

        usersRef.current =
          availableUsers;

        usersLoadedRef.current =
          true;

        if (mountedRef.current) {
          setUsers(
            availableUsers
          );
        }

        return availableUsers;
      } catch (fetchError) {
        console.error(
          "Admin users fetch error:",
          fetchError
        );

        if (mountedRef.current) {
          setError(
            fetchError?.message ||
              "Unable to load users."
          );
        }

        return usersRef.current;
      } finally {
        usersRequestRef.current =
          false;

        if (mountedRef.current) {
          setLoadingUsers(false);
        }
      }
    },
    []
  );

  /* ==========================================================
     FETCH CONVERSATIONS
  ========================================================== */

  const fetchConversations =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (
          conversationsRequestRef.current
        ) {
          return conversationsRef.current;
        }

        conversationsRequestRef.current =
          true;

        try {
          if (mountedRef.current) {
            if (silent) {
              setRefreshing(true);
            } else {
              setLoadingConversations(
                true
              );
            }
          }

          const response =
            await fetch(
              getApiUrl(
                "/conversations"
              ),
              {
                method: "GET",
                credentials: "include",
                headers:
                  getAuthHeaders(),
                cache: "no-store",
              }
            );

          const data =
            await parseResponse(
              response
            );

          if (response.status === 401) {
            if (mountedRef.current) {
              setError(
                "Authentication failed. Please sign in again if the problem continues."
              );
            }

            return conversationsRef.current;
          }

          if (response.status === 403) {
            throw new Error(
              data?.message ||
                "You do not have permission to load conversations."
            );
          }

          if (!response.ok) {
            throw new Error(
              data?.message ||
                "Failed to load conversations."
            );
          }

          const conversationData =
            normalizeConversations(
              data
            );

          conversationsRef.current =
            conversationData;

          if (mountedRef.current) {
            setConversations(
              conversationData
            );
          }

          return conversationData;
        } catch (fetchError) {
          console.error(
            "Admin conversations fetch error:",
            fetchError
          );

          if (mountedRef.current) {
            setError(
              fetchError?.message ||
                "Unable to load conversations."
            );
          }

          return conversationsRef.current;
        } finally {
          conversationsRequestRef.current =
            false;

          if (mountedRef.current) {
            setLoadingConversations(
              false
            );
            setRefreshing(false);
          }
        }
      },
      []
    );

  /* ==========================================================
     INITIAL LOAD
  ========================================================== */

  useEffect(() => {
    let cancelled = false;

    const loadInitialData =
      async () => {
        if (cancelled) {
          return;
        }

        await Promise.all([
          fetchUsers(),
          fetchConversations(),
        ]);
      };

    loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [
    fetchUsers,
    fetchConversations,
  ]);

  /* ==========================================================
     MESSAGE POLLING
  ========================================================== */

  useEffect(() => {
    const pollMessages =
      async () => {
        const activeConvId =
          selectedConversationIdRef.current;

        if (!activeConvId) {
          return;
        }

        if (
          pollingRequestRef.current
        ) {
          return;
        }

        if (
          typeof document !==
            "undefined" &&
          document.visibilityState !==
            "visible"
        ) {
          return;
        }

        pollingRequestRef.current =
          true;

        try {
          const response =
            await fetch(
              getApiUrl(
                `/conversations/${activeConvId}/messages?limit=100`
              ),
              {
                method: "GET",
                credentials: "include",
                headers:
                  getAuthHeaders(),
                cache: "no-store",
              }
            );

          if (!response.ok) {
            return;
          }

          const data =
            await parseResponse(
              response
            );

          if (
            activeConvId !==
            selectedConversationIdRef.current
          ) {
            return;
          }

          const fetchedMessages =
            Array.isArray(
              data?.messages
            )
              ? data.messages
              : Array.isArray(
                    data?.data
                  )
              ? data.data
              : [];

          if (!mountedRef.current) {
            return;
          }

          const latestMessage =
            fetchedMessages[
              fetchedMessages.length - 1
            ];

          const latestMessageId =
            latestMessage
              ? getId(latestMessage)
              : null;

          const previousLastId =
            lastMessageIdRef.current;

          const hasNewMessage =
            pollingInitializedRef.current &&
            Boolean(
              latestMessageId &&
                previousLastId &&
                String(
                  latestMessageId
                ) !==
                  String(
                    previousLastId
                  )
            );

          lastMessageIdRef.current =
            latestMessageId;

          pollingInitializedRef.current =
            true;

          setMessages(
            (previousMessages) => {
              if (
                fetchedMessages.length ===
                  previousMessages.length &&
                !hasNewMessage
              ) {
                return previousMessages;
              }

              if (
                hasNewMessage &&
                soundEnabledRef.current
              ) {
                const senderRole =
                  String(
                    latestMessage?.sender
                      ?.role || ""
                  ).toLowerCase();

                if (
                  senderRole !==
                  "admin"
                ) {
                  playNotificationChime();
                }
              }

              return fetchedMessages;
            }
          );
        } catch {
          // Silent polling failure.
        } finally {
          pollingRequestRef.current =
            false;
        }
      };

    pollMessages();

    const interval =
      setInterval(
        pollMessages,
        5000
      );

    return () => {
      clearInterval(interval);
    };
  }, []);

  /* ==========================================================
     FIND CONVERSATION
  ========================================================== */

  const findConversationForUser =
    useCallback(
      (
        userId,
        conversationList
      ) => {
        if (!userId) {
          return null;
        }

        const list =
          Array.isArray(
            conversationList
          )
            ? conversationList
            : conversationsRef.current;

        return (
          list.find(
            (conversation) => {
              const participants =
                Array.isArray(
                  conversation?.participants
                )
                  ? conversation.participants
                  : [];

              return participants.some(
                (participant) => {
                  const participantId =
                    getId(
                      participant
                    );

                  return (
                    participantId &&
                    String(
                      participantId
                    ) ===
                      String(userId)
                  );
                }
              );
            }
          ) || null
        );
      },
      []
    );

  /* ==========================================================
     FETCH MESSAGES
  ========================================================== */

  const fetchMessages =
    useCallback(
      async (conversationId) => {
        if (!conversationId) {
          return [];
        }

        if (
          messagesRequestRef.current
        ) {
          return [];
        }

        messagesRequestRef.current =
          true;

        try {
          if (mountedRef.current) {
            setLoadingMessages(true);
            setMessagesError("");
          }

          const response =
            await fetch(
              getApiUrl(
                `/conversations/${conversationId}/messages?limit=100`
              ),
              {
                method: "GET",
                credentials: "include",
                headers:
                  getAuthHeaders(),
                cache: "no-store",
              }
            );

          const data =
            await parseResponse(
              response
            );

          if (response.status === 401) {
            if (mountedRef.current) {
              setMessagesError(
                "Authentication failed. Please sign in again if the problem continues."
              );
            }

            return [];
          }

          if (response.status === 403) {
            throw new Error(
              data?.message ||
                "You do not have permission to view these messages."
            );
          }

          if (!response.ok) {
            throw new Error(
              data?.message ||
                "Failed to load messages."
            );
          }

          const messageData =
            Array.isArray(
              data?.messages
            )
              ? data.messages
              : Array.isArray(
                    data?.data
                  )
              ? data.data
              : [];

          if (
            conversationId !==
            selectedConversationIdRef.current
          ) {
            return [];
          }

          const lastMessage =
            messageData[
              messageData.length - 1
            ];

          lastMessageIdRef.current =
            lastMessage
              ? getId(lastMessage)
              : null;

          pollingInitializedRef.current =
            false;

          if (mountedRef.current) {
            setMessages(
              messageData
            );
          }

          return messageData;
        } catch (fetchError) {
          console.error(
            "Conversation messages fetch error:",
            fetchError
          );

          if (mountedRef.current) {
            setMessagesError(
              fetchError?.message ||
                "Unable to load messages."
            );

            setMessages([]);
          }

          return [];
        } finally {
          messagesRequestRef.current =
            false;

          if (mountedRef.current) {
            setLoadingMessages(false);
          }
        }
      },
      []
    );

  /* ==========================================================
     OPEN CONVERSATION
  ========================================================== */

  const openConversation =
    useCallback(
      async (
        conversation,
        user = null
      ) => {
        const conversationId =
          conversation?.id ||
          conversation?._id;

        if (!conversationId) {
          return;
        }

        selectedConversationIdRef.current =
          conversationId;

        setSelectedUser(user);
        setSelectedConversationId(
          conversationId
        );
        setSelectedConversation(
          conversation
        );
        setMessages([]);
        setMessagesError("");
        setSelectedFiles([]);

        lastMessageIdRef.current =
          null;

        pollingInitializedRef.current =
          false;

        await fetchMessages(
          conversationId
        );

        if (
          conversationId !==
          selectedConversationIdRef.current
        ) {
          return;
        }

        try {
          const response =
            await fetch(
              getApiUrl(
                `/conversations/${conversationId}/read`
              ),
              {
                method: "PUT",
                credentials: "include",
                headers:
                  getAuthHeaders(),
                cache: "no-store",
              }
            );

          if (!response.ok) {
            const data =
              await parseResponse(
                response
              );

            console.warn(
              "Mark conversation read failed:",
              data?.message ||
                `HTTP ${response.status}`
            );

            return;
          }

          if (!mountedRef.current) {
            return;
          }

          setConversations(
            (current) => {
              const updated =
                current.map(
                  (item) => {
                    const id =
                      item?.id ||
                      item?._id;

                    if (
                      String(id) ===
                      String(
                        conversationId
                      )
                    ) {
                      return {
                        ...item,
                        unreadCount: 0,
                      };
                    }

                    return item;
                  }
                );

              conversationsRef.current =
                updated;

              return updated;
            }
          );
        } catch (readError) {
          console.warn(
            "Mark conversation read error:",
            readError
          );
        }
      },
      [fetchMessages]
    );

  /* ==========================================================
     CREATE CONVERSATION
  ========================================================== */

  const createNewConversation =
    useCallback(
      async (user) => {
        const userId = getId(user);

        if (
          !userId ||
          startingConversationRef.current
        ) {
          return;
        }

        startingConversationRef.current =
          true;

        try {
          setStartingConversation(
            true
          );

          setMessagesError("");
          setError("");

          const latestConversations =
            await fetchConversations({
              silent: true,
            });

          const existingConversation =
            findConversationForUser(
              userId,
              latestConversations
            );

          if (existingConversation) {
            await openConversation(
              existingConversation,
              user
            );

            return;
          }

          const response =
            await fetch(
              getApiUrl(
                "/conversations"
              ),
              {
                method: "POST",
                credentials: "include",
                headers:
                  getAuthHeaders(),
                cache: "no-store",
                body: JSON.stringify({
                  recipientId:
                    userId,
                }),
              }
            );

          const data =
            await parseResponse(
              response
            );

          if (response.status === 401) {
            throw new Error(
              "Authentication failed. Please sign in again if the problem continues."
            );
          }

          if (response.status === 403) {
            throw new Error(
              data?.message ||
                "You do not have permission to create conversations."
            );
          }

          if (!response.ok) {
            throw new Error(
              data?.message ||
                "Failed to create conversation."
            );
          }

          const newConversation =
            data?.conversation ||
            data?.data ||
            data;

          const newConversationId =
            newConversation?.id ||
            newConversation?._id;

          if (!newConversationId) {
            const refreshedConversations =
              await fetchConversations({
                silent: true,
              });

            const refreshedConversation =
              findConversationForUser(
                userId,
                refreshedConversations
              );

            if (
              refreshedConversation
            ) {
              await openConversation(
                refreshedConversation,
                user
              );

              return;
            }

            throw new Error(
              "Conversation was created but no conversation ID was returned."
            );
          }

          if (mountedRef.current) {
            setConversations(
              (current) => {
                const alreadyExists =
                  current.some(
                    (item) =>
                      String(
                        item?.id ||
                          item?._id
                      ) ===
                      String(
                        newConversationId
                      )
                  );

                if (
                  alreadyExists
                ) {
                  return current;
                }

                const updated = [
                  newConversation,
                  ...current,
                ];

                conversationsRef.current =
                  updated;

                return updated;
              }
            );
          }

          await openConversation(
            newConversation,
            user
          );
        } catch (createError) {
          console.error(
            "Create conversation error:",
            createError
          );

          if (mountedRef.current) {
            setMessagesError(
              createError?.message ||
                "Unable to start conversation."
            );
          }
        } finally {
          startingConversationRef.current =
            false;

          if (mountedRef.current) {
            setStartingConversation(
              false
            );
          }
        }
      },
      [
        fetchConversations,
        findConversationForUser,
        openConversation,
      ]
    );

  /* ==========================================================
     SELECT USER
  ========================================================== */

  const handleSelectUser =
    useCallback(
      async (user) => {
        const userId = getId(user);

        if (!userId) {
          setMessagesError(
            "Selected user does not have a valid user ID."
          );

          return;
        }

        setSelectedUser(user);
        setMessagesError("");

        const existingConversation =
          findConversationForUser(
            userId
          );

        if (existingConversation) {
          await openConversation(
            existingConversation,
            user
          );

          return;
        }

        await createNewConversation(
          user
        );
      },
      [
        findConversationForUser,
        openConversation,
        createNewConversation,
      ]
    );

  /* ==========================================================
     FILTER USERS
  ========================================================== */

  const filteredUsers =
    useMemo(() => {
      const searchText =
        search.trim().toLowerCase();

      if (!searchText) {
        return users;
      }

      return users.filter(
        (user) => {
          const text = `
            ${user?.name || ""}
            ${user?.fullName || ""}
            ${user?.email || ""}
            ${user?.phone || ""}
            ${user?.role || ""}
            ${user?.status || ""}
          `.toLowerCase();

          return text.includes(
            searchText
          );
        }
      );
    }, [users, search]);

  /* ==========================================================
     FILE HANDLING
  ========================================================== */

  const handleFileChange = (
    event
  ) => {
    const files = Array.from(
      event.target.files || []
    );

    if (files.length === 0) {
      return;
    }

    setSelectedFiles(
      (previous) =>
        [
          ...previous,
          ...files,
        ].slice(0, 5)
    );

    if (fileInputRef.current) {
      fileInputRef.current.value =
        "";
    }
  };

  const removeSelectedFile = (
    index
  ) => {
    setSelectedFiles(
      (previous) =>
        previous.filter(
          (_, currentIndex) =>
            currentIndex !== index
        )
    );
  };

  /* ==========================================================
     SEND MESSAGE
  ========================================================== */

  const handleSendMessage =
    async (event) => {
      event.preventDefault();

      const cleanMessage =
        message.trim();

      if (
        (!cleanMessage &&
          selectedFiles.length ===
            0) ||
        !selectedConversationId ||
        !selectedUser ||
        sendingMessage
      ) {
        return;
      }

      const recipientId =
        getId(selectedUser);

      if (!recipientId) {
        setMessagesError(
          "No valid recipient was found."
        );

        return;
      }

      try {
        setSendingMessage(true);
        setMessagesError("");

        let response;

        if (
          selectedFiles.length > 0
        ) {
          const formData =
            new FormData();

          formData.append(
            "body",
            cleanMessage
          );

          formData.append(
            "recipientId",
            recipientId
          );

          formData.append(
            "conversationId",
            selectedConversationId
          );

          selectedFiles.forEach(
            (file) => {
              formData.append(
                "files",
                file
              );
            }
          );

          const token =
            getStoredToken();

          const headers = {
            Accept:
              "application/json",
          };

          if (token) {
            headers.Authorization =
              `Bearer ${token}`;
          }

          response = await fetch(
            getApiUrl("/messages"),
            {
              method: "POST",
              credentials: "include",
              headers,
              body: formData,
            }
          );
        } else {
          response = await fetch(
            getApiUrl(
              `/conversations/${selectedConversationId}/messages`
            ),
            {
              method: "POST",
              credentials: "include",
              headers:
                getAuthHeaders(),
              cache: "no-store",
              body: JSON.stringify({
                body: cleanMessage,
                recipientId,
              }),
            }
          );
        }

        const data =
          await parseResponse(
            response
          );

        if (response.status === 401) {
          throw new Error(
            "Authentication failed. Please sign in again if the problem continues."
          );
        }

        if (response.status === 403) {
          throw new Error(
            data?.message ||
              "You do not have permission to send this message."
          );
        }

        if (!response.ok) {
          throw new Error(
            data?.message ||
              "Failed to send message."
          );
        }

        const newMessage =
          data?.data ||
          data?.messageData ||
          data?.message;

        if (
          newMessage &&
          typeof newMessage ===
            "object"
        ) {
          if (mountedRef.current) {
            setMessages(
              (current) => [
                ...current,
                newMessage,
              ]
            );

            lastMessageIdRef.current =
              getId(newMessage);
          }
        } else {
          await fetchMessages(
            selectedConversationId
          );
        }

        if (mountedRef.current) {
          setMessage("");
          setSelectedFiles([]);
        }

        await fetchConversations({
          silent: true,
        });
      } catch (sendError) {
        console.error(
          "Send admin message error:",
          sendError
        );

        if (mountedRef.current) {
          setMessagesError(
            sendError?.message ||
              "Unable to send message."
          );
        }
      } finally {
        if (mountedRef.current) {
          setSendingMessage(false);
        }
      }
    };

  /* ==========================================================
     DELETE MESSAGE
  ========================================================== */

  const promptDeleteMessage = (
    msg
  ) => {
    setMessageToDelete(msg);
    setDeleteModalOpen(true);
  };

  const executeDeleteMessage =
    async (type) => {
      if (!messageToDelete) {
        return;
      }

      const messageId =
        messageToDelete._id ||
        messageToDelete.id;

      if (!messageId) {
        return;
      }

      try {
        setDeletingMessage(true);

        const endpoint =
          type === "everyone"
            ? `/messages/${messageId}/delete-for-everyone`
            : `/messages/${messageId}/delete-for-me`;

        const response =
          await fetch(
            getApiUrl(endpoint),
            {
              method: "POST",
              credentials: "include",
              headers:
                getAuthHeaders(),
              cache: "no-store",
            }
          );

        const data =
          await parseResponse(
            response
          );

        if (response.status === 401) {
          throw new Error(
            "Authentication failed. Please sign in again if the problem continues."
          );
        }

        if (!response.ok) {
          throw new Error(
            data?.message ||
              "Failed to delete message."
          );
        }

        if (type === "me") {
          if (mountedRef.current) {
            setMessages(
              (previous) =>
                previous.filter(
                  (item) =>
                    String(
                      item?._id ||
                        item?.id
                    ) !==
                    String(messageId)
                )
            );
          }
        } else {
          const updatedMessage =
            data?.data ||
            data?.message;

          if (mountedRef.current) {
            setMessages(
              (previous) =>
                previous.map(
                  (item) => {
                    if (
                      String(
                        item?._id ||
                          item?.id
                      ) ===
                      String(messageId)
                    ) {
                      return {
                        ...item,
                        ...(updatedMessage ||
                          {}),
                        body:
                          "This message was deleted",
                        message:
                          "This message was deleted",
                        isDeletedForEveryone:
                          true,
                        attachments: [],
                      };
                    }

                    return item;
                  }
                )
            );
          }
        }

        if (mountedRef.current) {
          setDeleteModalOpen(false);
          setMessageToDelete(null);
        }

        if (selectedConversationId) {
          await fetchConversations({
            silent: true,
          });
        }
      } catch (deleteError) {
        console.error(
          "Delete message failed:",
          deleteError
        );

        if (mountedRef.current) {
          setMessagesError(
            deleteError?.message ||
              "Failed to delete message."
          );
        }
      } finally {
        if (mountedRef.current) {
          setDeletingMessage(false);
        }
      }
    };

  /* ==========================================================
     REFRESH
  ========================================================== */

  const handleRefresh =
    async () => {
      if (refreshing) {
        return;
      }

      await fetchConversations({
        silent: true,
      });

      if (
        selectedConversationId
      ) {
        await fetchMessages(
          selectedConversationId
        );
      }
    };

  /* ==========================================================
     DELETE CONVERSATION
  ========================================================== */

  const handleDeleteConversation =
    async () => {
      if (!selectedConversationId) {
        return;
      }

      const confirmed =
        window.confirm(
          "Are you sure you want to delete this conversation and all of its messages?"
        );

      if (!confirmed) {
        return;
      }

      try {
        const response =
          await fetch(
            getApiUrl(
              `/conversations/${selectedConversationId}`
            ),
            {
              method: "DELETE",
              credentials: "include",
              headers:
                getAuthHeaders(),
              cache: "no-store",
            }
          );

        const data =
          await parseResponse(
            response
          );

        if (response.status === 401) {
          throw new Error(
            "Authentication failed. Please sign in again if the problem continues."
          );
        }

        if (!response.ok) {
          throw new Error(
            data?.message ||
              "Failed to delete conversation."
          );
        }

        if (mountedRef.current) {
          setConversations(
            (current) => {
              const updated =
                current.filter(
                  (conversation) => {
                    const id =
                      conversation?.id ||
                      conversation?._id;

                    return (
                      String(id) !==
                      String(
                        selectedConversationId
                      )
                    );
                  }
                );

              conversationsRef.current =
                updated;

              return updated;
            }
          );

          selectedConversationIdRef.current =
            null;

          setSelectedConversationId(
            null
          );

          setSelectedConversation(
            null
          );

          setSelectedUser(null);

          setMessages([]);

          lastMessageIdRef.current =
            null;

          pollingInitializedRef.current =
            false;

          setMessage("");

          setSelectedFiles([]);

          setMessagesError("");
        }
      } catch (deleteError) {
        console.error(
          "Delete conversation error:",
          deleteError
        );

        if (mountedRef.current) {
          setMessagesError(
            deleteError?.message ||
              "Unable to delete conversation."
          );
        }
      }
    };

  /* ============================================================
     RENDER
     
     IMPORTANT:
     - Whole page is locked to available viewport height.
     - Whole page does NOT scroll.
     - Contacts list scrolls independently.
     - Chat messages scroll independently.
     - Chat header stays fixed.
     - Composer stays fixed.
  ============================================================ */

  return (
    <div
      className="
        flex
        h-[calc(100dvh-4rem)]
        max-h-[calc(100dvh-4rem)]
        min-h-0
        w-full
        min-w-0
        flex-1
        overflow-hidden
        overscroll-none
        bg-[#F8FAFC]
      "
    >
      <div
        className="
          flex
          h-full
          min-h-0
          min-w-0
          flex-1
          flex-col
          overflow-hidden
        "
      >
        <main
          className="
            flex
            h-full
            min-h-0
            flex-1
            flex-col
            overflow-hidden
            p-4
            sm:p-5
            lg:p-6
          "
        >
          <section
            className="
              grid
              h-full
              min-h-0
              w-full
              flex-1
              grid-rows-[minmax(0,1fr)]
              overflow-hidden
              rounded-2xl
              border
              border-slate-200
              bg-white
              shadow-sm
              lg:grid-cols-[370px_minmax(0,1fr)]
              lg:grid-rows-1
            "
          >
            {/* ==================================================
                USERS / CONTACTS
            ================================================== */}

            <aside
              className="
                flex
                h-full
                min-h-0
                min-w-0
                flex-col
                overflow-hidden
                border-b
                border-slate-200
                lg:border-b-0
                lg:border-r
              "
            >
              {/* CONTACT HEADER - FIXED */}

              <div
                className="
                  shrink-0
                  border-b
                  border-slate-100
                  bg-white
                  p-4
                  sm:p-5
                "
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-[#171B3A]">
                      All Users
                    </h2>

                    <p className="mt-1 text-xs text-[#64748B]">
                      {users.length} user
                      {users.length !== 1
                        ? "s"
                        : ""}
                    </p>
                  </div>

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB]">
                    <Users size={18} />
                  </div>
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
                    placeholder="Search users or managers..."
                    className="
                      h-10
                      w-full
                      rounded-xl
                      border
                      border-slate-200
                      bg-[#F8FAFC]
                      pl-9
                      pr-3
                      text-sm
                      text-[#26344D]
                      outline-none
                      focus:border-[#2563EB]
                      focus:ring-2
                      focus:ring-blue-100
                    "
                  />
                </div>
              </div>

              {/* CONTACT LIST - ONLY THIS SCROLLS */}

              <div
                className="
                  min-h-0
                  min-w-0
                  flex-1
                  overflow-x-hidden
                  overflow-y-auto
                  overscroll-contain
                  [scrollbar-gutter:stable]
                "
              >
                {loadingUsers ? (
                  <div className="flex min-h-[300px] items-center justify-center px-6 text-center">
                    <div>
                      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#2563EB]" />

                      <p className="mt-4 text-sm font-medium text-[#64748B]">
                        Loading users...
                      </p>
                    </div>
                  </div>
                ) : filteredUsers.length >
                  0 ? (
                  filteredUsers.map(
                    (user) => {
                      const userId =
                        getId(user);

                      const existingConversation =
                        findConversationForUser(
                          userId
                        );

                      const isSelected =
                        String(
                          getId(
                            selectedUser
                          )
                        ) ===
                        String(userId);

                      return (
                        <button
                          key={
                            userId ||
                            `${user?.email}-${user?.name}`
                          }
                          type="button"
                          onClick={() =>
                            handleSelectUser(
                              user
                            )
                          }
                          disabled={
                            startingConversation &&
                            isSelected
                          }
                          className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-4 text-left transition ${
                            isSelected
                              ? "bg-[#EEF4FF]"
                              : "hover:bg-[#F8FAFC]"
                          }`}
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-xs font-bold text-[#2563EB]">
                            {getInitials(
                              getUserName(
                                user
                              )
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-[#171B3A]">
                                  {getUserName(
                                    user
                                  )}
                                </p>

                                <p className="mt-0.5 text-[11px] font-medium text-[#2563EB]">
                                  {getRole(
                                    user
                                  )}
                                </p>
                              </div>

                              {existingConversation && (
                                <span className="shrink-0 text-[10px] text-[#64748B]">
                                  {formatConversationTime(
                                    existingConversation.lastMessageAt ||
                                      existingConversation.updatedAt
                                  )}
                                </span>
                              )}
                            </div>

                            <p className="mt-1 truncate text-xs text-[#64748B]">
                              {existingConversation?.lastMessage ||
                                user?.email ||
                                "Start a conversation"}
                            </p>

                            {existingConversation?.unreadCount >
                              0 && (
                              <span className="mt-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[#2563EB] px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {
                                  existingConversation.unreadCount
                                }
                              </span>
                            )}

                            {!existingConversation && (
                              <span className="mt-2 inline-flex rounded-lg bg-[#EEF4FF] px-2 py-1 text-[10px] font-semibold text-[#2563EB]">
                                Start conversation
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    }
                  )
                ) : (
                  <div className="flex min-h-[300px] flex-col items-center justify-center px-6 py-10 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                      <Users size={28} />
                    </div>

                    <h3 className="mt-5 text-base font-bold text-[#171B3A]">
                      {search
                        ? "No matching users"
                        : "No users available"}
                    </h3>

                    <p className="mt-2 max-w-xs text-sm leading-6 text-[#64748B]">
                      {search
                        ? "Try another name, email, phone, or role."
                        : "No users or managers were returned by the backend."}
                    </p>
                  </div>
                )}
              </div>
            </aside>

            {/* ==================================================
                CHAT
            ================================================== */}

            <div
              className="
                flex
                h-full
                min-h-0
                min-w-0
                flex-col
                overflow-hidden
              "
            >
              {/* CHAT HEADER - FIXED */}

              <div
                className="
                  flex
                  shrink-0
                  items-center
                  justify-between
                  border-b
                  border-slate-100
                  bg-white
                  px-5
                  py-4
                  sm:px-6
                "
              >
                {selectedUser ? (
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-xs font-bold text-[#2563EB]">
                      {getInitials(
                        getUserName(
                          selectedUser
                        )
                      )}
                    </div>

                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold text-[#171B3A]">
                        {getUserName(
                          selectedUser
                        )}
                      </h2>

                      <div className="mt-1 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />

                        <p className="text-xs text-[#64748B]">
                          {getRole(
                            selectedUser
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EEF4FF] text-[#2563EB]">
                      <MessageSquare size={20} />
                    </div>

                    <div>
                      <h2 className="text-sm font-bold text-[#171B3A]">
                        Select a User
                      </h2>

                      <p className="mt-1 text-xs text-[#64748B]">
                        Select a user or manager to start
                        messaging.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1">
                  {selectedConversation && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          fetchMessages(
                            selectedConversationId
                          )
                        }
                        disabled={
                          loadingMessages
                        }
                        className="flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#2563EB] hover:bg-[#EEF4FF]"
                      >
                        <RefreshCw
                          size={14}
                          className={
                            loadingMessages
                              ? "animate-spin"
                              : ""
                          }
                        />

                        Refresh
                      </button>

                      <button
                        type="button"
                        onClick={
                          handleDeleteConversation
                        }
                        className="flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* ==================================================
                  CHAT MESSAGES - ONLY THIS SCROLLS
              ================================================== */}

              <div
                className="
                  min-h-0
                  min-w-0
                  flex-1
                  overflow-x-hidden
                  overflow-y-auto
                  overscroll-contain
                  px-5
                  py-6
                  sm:px-6
                  [scrollbar-gutter:stable]
                "
              >
                {startingConversation ? (
                  <div className="flex min-h-[400px] items-center justify-center">
                    <div className="text-center">
                      <Loader2
                        size={30}
                        className="mx-auto animate-spin text-[#2563EB]"
                      />

                      <p className="mt-4 text-sm text-[#64748B]">
                        Starting conversation...
                      </p>
                    </div>
                  </div>
                ) : loadingMessages ? (
                  <div className="flex min-h-[400px] items-center justify-center">
                    <div className="text-center">
                      <Loader2
                        size={30}
                        className="mx-auto animate-spin text-[#2563EB]"
                      />

                      <p className="mt-4 text-sm text-[#64748B]">
                        Loading messages...
                      </p>
                    </div>
                  </div>
                ) : messagesError ? (
                  <div className="flex min-h-[400px] items-center justify-center">
                    <div className="max-w-md rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-center text-sm font-medium text-red-700">
                      {messagesError}
                    </div>
                  </div>
                ) : !selectedUser ? (
                  <div className="flex min-h-[400px] items-center justify-center">
                    <div className="max-w-md text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                        <MessageSquare size={29} />
                      </div>

                      <h3 className="mt-5 text-base font-bold text-[#171B3A]">
                        No user selected
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-[#64748B]">
                        Select any user or manager from
                        the list to start a conversation.
                      </p>
                    </div>
                  </div>
                ) : messages.length ===
                  0 ? (
                  <div className="flex min-h-[400px] items-center justify-center">
                    <div className="max-w-md text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
                        <MessageSquare size={29} />
                      </div>

                      <h3 className="mt-5 text-base font-bold text-[#171B3A]">
                        No messages yet
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-[#64748B]">
                        Write a message below to start the
                        conversation.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map(
                      (item, index) => {
                        const sender =
                          item?.sender;

                        const senderName =
                          getUserName(
                            sender
                          );

                        const isDeleted =
                          Boolean(
                            item?.isDeletedForEveryone
                          );

                        const body =
                          isDeleted
                            ? "This message was deleted"
                            : item?.body ||
                              item?.message ||
                              "";

                        const isAdminMessage =
                          String(
                            sender?.role ||
                              ""
                          ).toLowerCase() ===
                          "admin";

                        return (
                          <AdminMessageRow
                            key={
                              item?.id ||
                              item?._id ||
                              `${item?.createdAt}-${index}`
                            }
                            item={item}
                            senderName={
                              senderName
                            }
                            body={body}
                            isDeleted={
                              isDeleted
                            }
                            isAdminMessage={
                              isAdminMessage
                            }
                            onDeletePrompt={
                              promptDeleteMessage
                            }
                          />
                        );
                      }
                    )}

                    <div
                      ref={
                        messagesEndRef
                      }
                    />
                  </div>
                )}
              </div>

              {/* ==================================================
                  COMPOSER - FIXED
              ================================================== */}

              <div
                className="
                  shrink-0
                  border-t
                  border-slate-100
                  bg-white
                  p-4
                  sm:p-5
                "
              >
                {selectedFiles.length >
                  0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {selectedFiles.map(
                      (
                        file,
                        index
                      ) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[#F8FAFC] px-2.5 py-1 text-xs text-[#26344D]"
                        >
                          {file.type.startsWith(
                            "image/"
                          ) ? (
                            <ImageIcon
                              size={13}
                              className="text-[#2563EB]"
                            />
                          ) : (
                            <File
                              size={13}
                              className="text-[#2563EB]"
                            />
                          )}

                          <span className="max-w-[140px] truncate font-medium">
                            {file.name}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              removeSelectedFile(
                                index
                              )
                            }
                            className="ml-1 rounded text-slate-400 hover:text-red-500"
                          >
                            <X size={13} />
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
                  className="flex items-end gap-2"
                >
                  <input
                    type="file"
                    multiple
                    ref={fileInputRef}
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
                      !selectedUser ||
                      !selectedConversationId ||
                      sendingMessage
                    }
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-[#2563EB] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
                  >
                    <Paperclip size={18} />
                  </button>

                  <div className="relative flex-1">
                    <textarea
                      value={message}
                      onChange={(event) =>
                        setMessage(
                          event.target.value
                        )
                      }
                      placeholder={
                        selectedUser
                          ? "Write a message or attach files..."
                          : "Select a user first..."
                      }
                      rows={1}
                      disabled={
                        !selectedUser ||
                        !selectedConversationId ||
                        sendingMessage
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

                          handleSendMessage(
                            event
                          );
                        }
                      }}
                      className="min-h-11 w-full resize-none rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#26344D] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={
                      (!message.trim() &&
                        selectedFiles.length ===
                          0) ||
                      !selectedUser ||
                      !selectedConversationId ||
                      sendingMessage
                    }
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    {sendingMessage ? (
                      <Loader2
                        size={18}
                        className="animate-spin"
                      />
                    ) : (
                      <Send size={18} />
                    )}
                  </button>
                </form>

                <p className="mt-2 px-1 text-[10px] text-[#64748B]">
                  Enter to send • Shift + Enter for
                  a new line • Click Paperclip to add
                  images/docs
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* ======================================================
          DELETE MESSAGE MODAL
      ====================================================== */}

      {deleteModalOpen &&
        messageToDelete && (
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
                    Choose how you want to delete this
                    message.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs italic text-[#26344D]">
                &ldquo;

                {messageToDelete?.isDeletedForEveryone
                  ? "This message was deleted"
                  : messageToDelete?.body ||
                    messageToDelete?.message ||
                    (messageToDelete?.attachments
                      ?.length > 0
                      ? "Attachment"
                      : "Message")}

                &rdquo;
              </div>

              <div className="mt-6 flex flex-col gap-2.5">
                {!messageToDelete?.isDeletedForEveryone && (
                  <button
                    type="button"
                    disabled={deletingMessage}
                    onClick={() =>
                      executeDeleteMessage(
                        "everyone"
                      )
                    }
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
                  >
                    {deletingMessage ? (
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      <Users size={16} />
                    )}

                    Delete for Everyone
                  </button>
                )}

                <button
                  type="button"
                  disabled={deletingMessage}
                  onClick={() =>
                    executeDeleteMessage(
                      "me"
                    )
                  }
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#26344D] transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {deletingMessage ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Trash2 size={16} />
                  )}

                  Delete for Me
                </button>

                <button
                  type="button"
                  disabled={deletingMessage}
                  onClick={() => {
                    setDeleteModalOpen(
                      false
                    );

                    setMessageToDelete(
                      null
                    );
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

/* ============================================================
   ADMIN MESSAGE ROW
============================================================ */

function AdminMessageRow({
  item,
  senderName,
  body,
  isDeleted,
  isAdminMessage,
  onDeletePrompt,
}) {
  const [menuOpen, setMenuOpen] =
    useState(false);

  const menuRef =
    useRef(null);

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
      className={`group relative flex items-start gap-3 ${
        isAdminMessage
          ? "justify-end"
          : ""
      }`}
    >
      {!isAdminMessage && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-[11px] font-bold text-[#2563EB]">
          {getInitials(
            senderName
          )}
        </div>
      )}

      {isAdminMessage &&
        !isDeleted && (
          <div
            className="relative self-center opacity-0 transition-opacity group-hover:opacity-100"
            ref={menuRef}
          >
            <button
              type="button"
              onClick={() =>
                setMenuOpen(
                  (previous) =>
                    !previous
                )
              }
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Message options"
            >
              <MoreVertical
                size={15}
              />
            </button>

            {menuOpen && (
              <div className="absolute bottom-full right-0 z-20 mb-1 w-44 rounded-xl border border-slate-100 bg-white py-1.5 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);

                    onDeletePrompt(
                      item
                    );
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

      <div
        className={`min-w-0 max-w-[80%] ${
          isAdminMessage
            ? "items-end"
            : ""
        }`}
      >
        <div
          className={`mb-1 flex items-center gap-2 ${
            isAdminMessage
              ? "justify-end"
              : ""
          }`}
        >
          <p className="text-xs font-bold text-[#171B3A]">
            {senderName}
          </p>

          {item?.sender?.role && (
            <span className="text-[10px] capitalize text-[#2563EB]">
              {item.sender.role}
            </span>
          )}

          <span className="text-[10px] text-[#64748B]">
            {formatMessageTime(
              item?.createdAt
            )}
          </span>
        </div>

        {isDeleted ? (
          <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs italic text-slate-400">
            <AlertTriangle
              size={13}
            />

            <span>
              This message was deleted
            </span>
          </div>
        ) : (
          body && (
            <div
              className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                isAdminMessage
                  ? "rounded-tr-md bg-[#2563EB] text-white"
                  : "rounded-tl-md bg-[#F8FAFC] text-[#26344D]"
              }`}
            >
              {body}
            </div>
          )
        )}

        {!isDeleted &&
          Array.isArray(
            item?.attachments
          ) &&
          item.attachments.length >
            0 && (
            <div className="mt-2 space-y-1.5">
              {item.attachments.map(
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

                  const isImage =
                    mime.startsWith(
                      "image/"
                    );

                  const fullUrl =
                    getFileUrl(
                      attachment?.url
                    );

                  if (
                    isImage &&
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
                        className="block overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-2xs hover:opacity-95"
                      >
                        <img
                          src={fullUrl}
                          alt={
                            attachment?.originalName ||
                            attachment?.filename ||
                            "Attached Image"
                          }
                          className="max-h-60 w-auto rounded-lg object-contain"
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
                      href={fullUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-2xs transition ${
                        isAdminMessage
                          ? "border-blue-200 bg-blue-50 text-[#2563EB] hover:bg-blue-100"
                          : "border-slate-200 bg-white text-[#26344D] hover:bg-slate-50"
                      }`}
                    >
                      <FileText
                        size={15}
                        className="shrink-0 text-[#2563EB]"
                      />

                      <span className="max-w-[220px] truncate">
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
      </div>

      {!isAdminMessage &&
        !isDeleted && (
          <div
            className="relative self-center opacity-0 transition-opacity group-hover:opacity-100"
            ref={menuRef}
          >
            <button
              type="button"
              onClick={() =>
                setMenuOpen(
                  (previous) =>
                    !previous
                )
              }
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Message options"
            >
              <MoreVertical
                size={15}
              />
            </button>

            {menuOpen && (
              <div className="absolute bottom-full left-0 z-20 mb-1 w-44 rounded-xl border border-slate-100 bg-white py-1.5 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);

                    onDeletePrompt(
                      item
                    );
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

      {isAdminMessage && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-[11px] font-bold text-white">
          A
        </div>
      )}
    </div>
  );
}