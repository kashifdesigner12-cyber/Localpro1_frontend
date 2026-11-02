import React, { useState, useMemo, useCallback } from "react";
import { Search, X, Users, Trash2, Pin } from "lucide-react";

const EMPTY_ARRAY = [];
const EMPTY_SET = new Set();
const EMPTY_MAP = new Map();

const getId = (value) => {
  if (!value) return "";

  if (typeof value === "object") {
    return String(value._id || value.id || "");
  }

  return String(value);
};

const normalizeDate = (value) => {
  if (!value) return 0;

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const normalizeText = (value) =>
  String(value || "").trim().toLowerCase();

export default function ChatSidebar({
  conversations = EMPTY_ARRAY,
  workspaceUsers = EMPTY_ARRAY,
  activeConversation,
  activeTab = "all",
  setActiveTab,
  searchQuery = "",
  setSearchQuery,
  onlineUserIds = EMPTY_SET,
  workspaceUsersMap = EMPTY_MAP,
  user,
  formatMessageTime,
  onSelectConversation,
  onSelectContact,
  onDeleteConversation,
  pinnedConvIds = EMPTY_ARRAY,
  onTogglePinConversation,
  customChatOrder = EMPTY_ARRAY,
  onReorderChats,
}) {
  const myId = getId(user);
  const query = normalizeText(searchQuery);

  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const uniqueConversations = useMemo(() => {
    if (!Array.isArray(conversations)) return EMPTY_ARRAY;
    const map = new Map();
    for (const c of conversations) {
      const id = getId(c);
      if (id && !map.has(id)) {
        map.set(id, c);
      }
    }
    return Array.from(map.values());
  }, [conversations]);

  const safeConversations = uniqueConversations;

  const safePinnedConvIds = Array.isArray(pinnedConvIds)
    ? pinnedConvIds
    : EMPTY_ARRAY;

  const userMap = useMemo(() => {
    if (workspaceUsersMap instanceof Map) {
      return workspaceUsersMap;
    }

    const map = new Map();

    if (
      workspaceUsersMap &&
      typeof workspaceUsersMap === "object"
    ) {
      Object.entries(workspaceUsersMap).forEach(([id, person]) => {
        if (id && person) map.set(String(id), person);
      });
    }

    return map;
  }, [workspaceUsersMap]);

  const onlineIds = useMemo(() => {
    const ids = new Set();

    if (onlineUserIds instanceof Set || Array.isArray(onlineUserIds)) {
      onlineUserIds.forEach((item) => {
        const id = getId(item);
        if (id) ids.add(id);
      });
    } else if (
      onlineUserIds &&
      typeof onlineUserIds === "object"
    ) {
      Object.entries(onlineUserIds).forEach(([id, online]) => {
        if (online && id) ids.add(String(id));
      });
    }

    return ids;
  }, [onlineUserIds]);

  const resolveUser = useCallback(
    (value) => {
      if (!value) return null;

      const id = getId(value);
      const mappedUser = id ? userMap.get(id) : null;

      if (
        typeof value === "string" ||
        typeof value === "number"
      ) {
        return mappedUser || null;
      }

      if (mappedUser) {
        return {
          ...mappedUser,
          ...value,
          name: value.name || mappedUser.name,
          username: value.username || mappedUser.username,
          email: value.email || mappedUser.email,
          role: value.role || mappedUser.role,
          department:
            value.department || mappedUser.department,
        };
      }

      return value;
    },
    [userMap]
  );

  const isSelf = useCallback(
    (value) => {
      const person = resolveUser(value);
      const personId = getId(person || value);

      if (myId && personId && personId === myId) {
        return true;
      }

      const personUsername = normalizeText(person?.username);
      const myUsername = normalizeText(user?.username);

      return Boolean(
        personUsername &&
        myUsername &&
        personUsername === myUsername
      );
    },
    [myId, resolveUser, user?.username]
  );

  const safeWorkspaceUsers = useMemo(() => {
    if (!Array.isArray(workspaceUsers)) return EMPTY_ARRAY;
    const map = new Map();
    for (const u of workspaceUsers) {
      const id = getId(u);
      if (
        id &&
        !map.has(id) &&
        id !== myId &&
        !isSelf(u) &&
        !u.participants &&
        !u.conversationId &&
        !u.isGroup
      ) {
        map.set(id, u);
      }
    }
    return Array.from(map.values());
  }, [workspaceUsers, myId, isSelf]);

  const getDisplayName = useCallback(
    (value) => {
      if (!value) return "";

      const person =
        resolveUser(value) ||
        (typeof value === "object" ? value : null);

      if (!person) {
        const id = getId(value);
        if (id && userMap) {
          const mapped = userMap.get ? userMap.get(id) : userMap[id];
          if (mapped) return getDisplayName(mapped);
        }
        return "";
      }

      if (typeof person === "string") {
        const mapped = userMap?.get ? userMap.get(person) : userMap?.[person];
        if (mapped && mapped !== person) return getDisplayName(mapped);
        return person;
      }

      const fullName = `${person.firstName || ""} ${person.lastName || ""}`.trim();
      const extracted =
        (typeof person.name === "string" && person.name.trim() ? person.name.trim() : null) ||
        (fullName || null) ||
        (typeof person.username === "string" && person.username.trim() ? person.username.trim() : null) ||
        (typeof person.email === "string" && person.email.includes("@") ? person.email.split("@")[0] : null);

      if (extracted) {
        return extracted;
      }

      const id = getId(person);
      if (id && userMap) {
        const mapped = userMap?.get ? userMap.get(id) : userMap?.[id];
        if (mapped && mapped !== person) return getDisplayName(mapped);
      }

      return person.username || person.name || (person.email ? person.email.split("@")[0] : "") || "";
    },
    [resolveUser, userMap]
  );

  const getUserInitials = useCallback(
    (value) => {
      const name = getDisplayName(value);
      const parts = name.split(" ").filter(Boolean);

      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }

      return name.slice(0, 2).toUpperCase() || "DC";
    },
    [getDisplayName]
  );

  const getOtherParticipant = useCallback(
    (conversation) => {
      if (!Array.isArray(conversation?.participants)) {
        return null;
      }

      return (
        conversation.participants.find(
          (participant) => !isSelf(participant)
        ) || null
      );
    },
    [isSelf]
  );

  const getConversationTitle = useCallback(
    (conv) => {
      if (!conv) return "";
      if (conv.isGroup) return conv.groupName || "Team Group";

      const otherParticipant = conv.participants?.find((p) => {
        const pId = String(p?._id || p?.id || p || "");
        const myUserId = String(myId || user?._id || user?.id || "");
        return pId && pId !== myUserId;
      });

      if (otherParticipant) {
        return getDisplayName(otherParticipant);
      }

      if (conv.lastMessage?.sender && !isSelf(conv.lastMessage.sender)) {
        return getDisplayName(conv.lastMessage.sender);
      }

      return "Direct Chat";
    },
    [myId, user, getDisplayName, isSelf]
  );

  const getConversationInitials = useCallback(
    (conv, title, other) => {
      if (conv?.isGroup) {
        return String(title || "TG").slice(0, 2).toUpperCase();
      }

      if (other) {
        const inits = getUserInitials(other);
        if (inits && inits !== "U") return inits;
      }

      if (title && title !== "Direct Chat" && title !== "Chat") {
        const parts = title.split(" ").filter(Boolean);
        if (parts.length >= 2) {
          return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        }
        return title.slice(0, 2).toUpperCase();
      }

      return "DC";
    },
    [getUserInitials]
  );

  const isOnline = useCallback(
    (value) => {
      const id = getId(value);
      return Boolean(id && onlineIds.has(id));
    },
    [onlineIds]
  );

  const getPresenceState = useCallback(
    (person, online) => {
      if (!online) {
        return {
          color: "bg-gray-300 ring-2 ring-white h-2.5 w-2.5 rounded-full",
          title: "Offline",
        };
      }
      return {
        color: "bg-blue-500 ring-2 ring-white h-2.5 w-2.5 rounded-full",
        title: "Active now",
      };
    },
    []
  );

  const getTime = useCallback(
    (value) => {
      if (!value || typeof formatMessageTime !== "function") {
        return "";
      }

      try {
        return formatMessageTime(value) || "";
      } catch (error) {
        console.error(
          "Unable to format conversation time:",
          error
        );
        return "";
      }
    },
    [formatMessageTime]
  );

  const sortedConversations = useMemo(() => {
    return [...safeConversations].sort((a, b) => {
      const aId = getId(a);
      const bId = getId(b);

      const aIndex = customChatOrder.indexOf(aId);
      const bIndex = customChatOrder.indexOf(bId);

      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      const aTime = normalizeDate(
        a?.lastMessageAt || a?.updatedAt || a?.createdAt
      );

      const bTime = normalizeDate(
        b?.lastMessageAt || b?.updatedAt || b?.createdAt
      );

      return bTime - aTime;
    });
  }, [safeConversations, customChatOrder]);

  const existingChatUserIds = useMemo(() => {
    const ids = new Set();

    sortedConversations.forEach((conversation) => {
      if (!conversation?.isGroup) {
        if (Array.isArray(conversation?.participants)) {
          conversation.participants.forEach((participant) => {
            const participantId = getId(participant);

            if (participantId && participantId !== myId) {
              ids.add(participantId);
            }
          });
        }

        if (conversation?.lastMessage?.sender) {
          const senderId = getId(conversation.lastMessage.sender);
          if (senderId && senderId !== myId) {
            ids.add(senderId);
          }
        }
      }
    });

    return ids;
  }, [sortedConversations, myId]);

  const matchedConversations = useMemo(() => {
    const seen = new Set();
    return sortedConversations.filter((conversation) => {
      const convId = getId(conversation);
      if (!convId || seen.has(convId)) return false;
      seen.add(convId);
      if (
        activeTab === "unread" &&
        Number(conversation?.unreadCount || 0) <= 0
      ) {
        return false;
      }

      if (
        activeTab === "groups" &&
        !conversation?.isGroup
      ) {
        return false;
      }

      if (!query) return true;

      const lastMessage = conversation?.lastMessage;
      const lastMessageText = normalizeText(
        lastMessage?.text
      );

      if (conversation?.isGroup) {
        const groupName = normalizeText(
          conversation.groupName || "Team Group"
        );

        return (
          groupName.includes(query) ||
          lastMessageText.includes(query)
        );
      }

      const other = getOtherParticipant(conversation);
      const name = normalizeText(getDisplayName(other));
      const person = resolveUser(other);
      const email = normalizeText(person?.email);

      return (
        name.includes(query) ||
        email.includes(query) ||
        lastMessageText.includes(query)
      );
    });
  }, [
    sortedConversations,
    activeTab,
    query,
    getOtherParticipant,
    getDisplayName,
    resolveUser,
  ]);

  const pinnedConversations = useMemo(() => {
    return matchedConversations.filter((c) =>
      safePinnedConvIds.includes(getId(c))
    );
  }, [matchedConversations, safePinnedConvIds]);

  const recentConversations = useMemo(() => {
    return matchedConversations.filter(
      (c) => !safePinnedConvIds.includes(getId(c))
    );
  }, [matchedConversations, safePinnedConvIds]);

  const availableContacts = useMemo(() => {
    const seen = new Set();
    const list = safeWorkspaceUsers.filter((contact) => {
      if (!contact || isSelf(contact)) {
        return false;
      }

      const contactId = getId(contact);

      if (
        !contactId ||
        seen.has(contactId) ||
        existingChatUserIds.has(contactId)
      ) {
        return false;
      }

      seen.add(contactId);

      if (!query) return true;

      const name = normalizeText(getDisplayName(contact));
      const email = normalizeText(contact.email);
      const role = normalizeText(contact.role);
      const department = normalizeText(contact.department);

      return (
        name.includes(query) ||
        email.includes(query) ||
        role.includes(query) ||
        department.includes(query)
      );
    });

    return list.sort((a, b) => {
      const aId = getId(a);
      const bId = getId(b);
      const aIndex = customChatOrder.indexOf(aId);
      const bIndex = customChatOrder.indexOf(bId);

      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return 0;
    });
  }, [
    safeWorkspaceUsers,
    isSelf,
    existingChatUserIds,
    query,
    getDisplayName,
    customChatOrder,
  ]);

  const hasUnread = useMemo(
    () =>
      safeConversations.some(
        (item) => Number(item?.unreadCount || 0) > 0
      ),
    [safeConversations]
  );

  const selectedId = getId(activeConversation);
  const showContacts = activeTab === "all";

  const handleSearchChange = useCallback(
    (event) => {
      setSearchQuery?.(event.target.value);
    },
    [setSearchQuery]
  );

  const clearSearch = useCallback(() => {
    setSearchQuery?.("");
  }, [setSearchQuery]);

  // Drag and drop handlers
  const handleDragStart = (e, id) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDraggedId(id);
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== id) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = (e, id) => {
    if (dragOverId === id) {
      setDragOverId(null);
    }
  };

  const handleDrop = (e, targetId, listType = "conversation") => {
    e.preventDefault();
    setDragOverId(null);
    const sourceId = draggedId || e.dataTransfer.getData("text/plain");
    setDraggedId(null);

    if (!sourceId || !targetId || sourceId === targetId) return;

    const baseList =
      listType === "pinned"
        ? pinnedConversations.map((c) => getId(c))
        : listType === "recent"
          ? recentConversations.map((c) => getId(c))
          : listType === "contact"
            ? availableContacts.map((c) => getId(c))
            : matchedConversations.map((c) => getId(c));

    const fromIdx = baseList.indexOf(sourceId);
    const toIdx = baseList.indexOf(targetId);

    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...baseList];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    const remaining = (customChatOrder || []).filter(
      (id) => !reordered.includes(id)
    );
    const finalOrder = [...reordered, ...remaining];

    onReorderChats?.(finalOrder);
    try {
      localStorage.setItem("localpro_chat_order", JSON.stringify(finalOrder));
    } catch (err) {
      console.warn("Failed to save chat order:", err);
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const renderConversationItem = (conversation) => {
    const conversationId = getId(conversation);

    const selected = Boolean(
      conversationId &&
      conversationId === selectedId
    );

    const isPinned = safePinnedConvIds.includes(conversationId);

    const group = Boolean(conversation.isGroup);
    const other = group
      ? null
      : getOtherParticipant(conversation);

    const title = getConversationTitle(conversation);
    const initials = getConversationInitials(conversation, title, other);

    const otherId = getId(other);
    const otherPerson = resolveUser(other);
    const otherOnline = isOnline(otherId);
    const presence = getPresenceState(otherPerson, otherOnline);

    const lastMessage = conversation.lastMessage || null;

    const attachments = Array.isArray(
      lastMessage?.attachments
    )
      ? lastMessage.attachments
      : EMPTY_ARRAY;

    const preview = lastMessage?.isDeletedForEveryone
      ? "This message was deleted"
      : lastMessage?.text ||
        (attachments.length
          ? `📎 ${attachments[0]?.name || "Attachment"}`
          : "Start conversation");

    const lastSenderIsMe = isSelf(lastMessage?.sender);

    const unreadCount = Math.max(
      0,
      Number(conversation.unreadCount || 0)
    );

    const isDragging = draggedId === conversationId;
    const isDragOver = dragOverId === conversationId;

    return (
      <div
        key={
          conversationId ||
          `${title}-${conversation.updatedAt || "chat"}`
        }
        draggable
        onDragStart={(e) => handleDragStart(e, conversationId)}
        onDragOver={(e) => handleDragOver(e, conversationId)}
        onDragLeave={(e) => handleDragLeave(e, conversationId)}
        onDrop={(e) =>
          handleDrop(e, conversationId, isPinned ? "pinned" : "recent")
        }
        onDragEnd={handleDragEnd}
        className={`group relative flex items-center gap-3 rounded-xl border p-2.5 transition cursor-grab active:cursor-grabbing select-none ${
          isDragging ? "opacity-60 scale-[0.98]" : ""
        } ${
          isDragOver ? "border-t-2 border-blue-500 shadow-sm" : ""
        } ${
          selected
            ? "border-[#5B5FC7] bg-[#5B5FC7] text-white shadow-xs"
            : "border-transparent bg-white/40 text-gray-800 hover:bg-gray-200/60"
        }`}
      >
        <button
          type="button"
          onClick={() =>
            onSelectConversation?.(conversation)
          }
          aria-pressed={selected}
          aria-label={`Open chat with ${title}`}
          className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none"
        >
          <div className="relative shrink-0">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold shadow-xs ${
                selected
                  ? "bg-white text-[#5B5FC7]"
                  : group
                    ? "bg-purple-100 text-purple-700"
                    : "bg-indigo-100 text-indigo-700"
              }`}
            >
              {group ? <Users size={16} /> : initials}
            </div>

            {!group && (
              <span
                className={`absolute bottom-0 right-0 ${presence.color}`}
                title={presence.title}
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <h4 className="flex min-w-0 items-center gap-1 truncate text-xs font-bold leading-tight">
                <span className="truncate">{title}</span>

                {group && (
                  <span
                    className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold ${
                      selected
                        ? "bg-white/20 text-white"
                        : "bg-purple-50 text-purple-700"
                    }`}
                  >
                    Group
                  </span>
                )}
              </h4>

              <span
                className={`ml-1 shrink-0 text-[10px] font-medium ${
                  selected
                    ? "text-indigo-100"
                    : "text-gray-400"
                }`}
              >
                {getTime(
                  conversation.lastMessageAt ||
                    conversation.updatedAt
                )}
              </span>
            </div>

            <div className="mt-0.5 flex items-center justify-between gap-1">
              <p
                className={`truncate text-xs leading-snug ${
                  selected
                    ? "text-indigo-100"
                    : "text-gray-500"
                }`}
              >
                {lastMessage &&
                lastSenderIsMe &&
                !lastMessage.isDeletedForEveryone
                  ? "You: "
                  : ""}
                {preview}
              </p>

              {unreadCount > 0 && !selected && (
                <span className="ml-1.5 flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#5B5FC7] px-1.5 text-[10px] font-bold text-white shadow-xs">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-0.5 shrink-0 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={() => onTogglePinConversation?.(conversationId)}
            className={`rounded-lg p-1 hover:bg-black/10 transition ${
              selected
                ? "text-white"
                : isPinned
                  ? "text-amber-500"
                  : "text-gray-400 hover:text-gray-700"
            }`}
            title={isPinned ? "Unpin chat" : "Pin chat"}
            aria-label={isPinned ? "Unpin chat" : "Pin chat"}
          >
            <Pin
              size={13}
              className={`rotate-45 ${isPinned ? "fill-amber-500" : ""}`}
            />
          </button>

          <button
            type="button"
            onClick={() =>
              onDeleteConversation?.(conversationId)
            }
            className={`rounded-lg p-1 hover:bg-black/10 transition ${
              selected
                ? "text-white"
                : "text-gray-400 hover:text-red-600"
            }`}
            title="Delete chat"
            aria-label={`Delete chat with ${title}`}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <aside className="flex h-full min-h-0 w-80 shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-[#F5F6F8] sm:w-88">
      <div className="shrink-0 border-b border-gray-200 bg-white p-3">
        <div className="flex items-center rounded-xl border border-transparent bg-[#F3F4F6] px-3 py-2 shadow-2xs transition focus-within:border-[#5B5FC7] focus-within:bg-white">
          <Search
            size={15}
            className="mr-2 shrink-0 text-gray-400"
          />

          <input
            type="text"
            value={searchQuery || ""}
            onChange={handleSearchChange}
            placeholder="Search chats or contacts..."
            aria-label="Search chats or contacts"
            className="w-full bg-transparent text-xs font-medium text-gray-800 outline-none placeholder:text-gray-400"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="ml-1 rounded p-0.5 text-gray-400 hover:text-gray-700"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 border-b border-gray-200 bg-white px-3 py-2">
        {["all", "unread", "groups"].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab?.(tab)}
            aria-pressed={activeTab === tab}
            className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold capitalize transition ${
              activeTab === tab
                ? "bg-[#5B5FC7] text-white shadow-xs"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab === "groups" && <Users size={12} />}

            <span>{tab}</span>

            {tab === "unread" && hasUnread && (
              <span className="h-2 w-2 rounded-full bg-blue-600" />
            )}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2">
        {/* Pinned Section */}
        {pinnedConversations.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-600">
              <Pin size={11} className="rotate-45 fill-amber-500 text-amber-600" />
              <span>Pinned ({pinnedConversations.length})</span>
            </div>
            <div className="space-y-1">
              {pinnedConversations.map(renderConversationItem)}
            </div>
          </div>
        )}

        {/* Recent Chats Section */}
        {recentConversations.length > 0 && (
          <div>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Recent Chats
            </div>
            <div className="space-y-1">
              {recentConversations.map(renderConversationItem)}
            </div>
          </div>
        )}

        {showContacts && availableContacts.length > 0 && (
          <div className="pt-3">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Workspace Contacts ({availableContacts.length})
            </div>

            {availableContacts.map((contact) => {
              const contactId = getId(contact);
              const name = getDisplayName(contact) || "Contact";
              const online = isOnline(contactId);
              const presence = getPresenceState(contact, online);
              const isDragging = draggedId === contactId;
              const isDragOver = dragOverId === contactId;

              return (
                <div
                  key={contactId}
                  draggable
                  onDragStart={(e) => handleDragStart(e, contactId)}
                  onDragOver={(e) => handleDragOver(e, contactId)}
                  onDragLeave={(e) => handleDragLeave(e, contactId)}
                  onDrop={(e) => handleDrop(e, contactId, "contact")}
                  onDragEnd={handleDragEnd}
                  className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left text-gray-800 transition hover:bg-gray-200/60 cursor-grab active:cursor-grabbing select-none ${
                    isDragging ? "opacity-60 scale-[0.98]" : ""
                  } ${
                    isDragOver ? "border-t-2 border-blue-500 shadow-sm" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      const existing = sortedConversations.find((c) => {
                        if (c.isGroup) return false;
                        return (
                          (c.participants || []).some(
                            (p) => getId(p) === contactId
                          ) ||
                          getId(c.lastMessage?.sender) === contactId
                        );
                      });
                      if (existing) {
                        onSelectConversation?.(existing);
                      } else {
                        onSelectContact?.(contact);
                      }
                    }}
                    className="flex w-full items-center gap-3 text-left outline-none"
                  >
                    <div className="relative shrink-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-xs font-bold text-emerald-800 shadow-xs">
                        {getUserInitials(contact)}
                      </div>

                      <span
                        className={`absolute bottom-0 right-0 ${presence.color}`}
                        title={presence.title}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-xs font-bold leading-tight text-gray-900">
                        {name}
                      </h4>

                      <p className="truncate text-[11px] capitalize text-gray-500">
                        {contact.role || "Member"}
                        {contact.department
                          ? ` • ${contact.department}`
                          : ""}
                      </p>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {matchedConversations.length === 0 &&
          (!showContacts || availableContacts.length === 0) && (
            <div className="p-8 text-center text-xs font-medium text-gray-400">
              No chats or contacts found.
            </div>
          )}
      </div>
    </aside>
  );
}