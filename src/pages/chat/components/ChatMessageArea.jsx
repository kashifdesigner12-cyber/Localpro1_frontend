import React, { memo, useState, useEffect, useMemo } from "react";
import {
  Users,
  Pin,
  CornerUpLeft,
  Download,
  FileText,
  Check,
  CheckCheck,
  Smile,
  Edit2,
  Share2,
  MoreVertical,
  Copy,
  Trash2,
  AlertCircle,
  Clock,
  X,
} from "lucide-react";

const EMPTY_ARRAY = [];
const EMPTY_SET = new Set();

const getId = (value) => {
  if (!value) return "";

  if (typeof value === "object") {
    return String(value._id || value.id || "");
  }

  return String(value);
};

const getAttachmentUrl = (attachment, serverBaseUrl) => {
  const rawValue =
    attachment?.url ||
    attachment?.path ||
    attachment?.fileUrl ||
    "";

  const rawPath = String(rawValue || "").trim();

  if (!rawPath) return "";

  if (
    /^(https?:)?\/\//i.test(rawPath) ||
    /^(data|blob):/i.test(rawPath)
  ) {
    return rawPath;
  }

  const base = String(serverBaseUrl || "").replace(/\/+$/, "");
  const filePath = rawPath.replace(/^\/+/, "");

  return base ? `${base}/${filePath}` : `/${filePath}`;
};

// Tokenize and render inline markdown (bold, italic, strikethrough, inline code, @mentions)
const renderInlineMarkdown = (text) => {
  if (!text) return "";

  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*|_[^_]+_|@[A-Za-z0-9_.-]+)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith("@") && part.length >= 2) {
      return (
        <span
          key={index}
          className="inline-flex items-center rounded-sm bg-indigo-50 px-1 py-0.5 text-xs font-bold text-[#5B5FC7]"
        >
          {part}
        </span>
      );
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={index}
          className="rounded bg-black/10 px-1 py-0.5 font-mono text-xs text-inherit opacity-90"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={index} className="font-bold">
          {renderInlineMarkdown(part.slice(2, -2))}
        </strong>
      );
    }
    if (part.startsWith("~~") && part.endsWith("~~") && part.length >= 4) {
      return (
        <del key={index} className="line-through opacity-80">
          {renderInlineMarkdown(part.slice(2, -2))}
        </del>
      );
    }
    if (
      (part.startsWith("*") && part.endsWith("*") && part.length >= 2) ||
      (part.startsWith("_") && part.endsWith("_") && part.length >= 2)
    ) {
      return (
        <em key={index} className="italic">
          {renderInlineMarkdown(part.slice(1, -1))}
        </em>
      );
    }

    return part;
  });
};

// Pure React Markdown parser for bold, italic, strikethrough, code, and lists
const renderFormattedText = (rawText) => {
  if (!rawText) return null;

  const lines = rawText.split("\n");
  const elements = [];
  let currentList = null;

  const flushList = () => {
    if (!currentList) return;
    const ListTag = currentList.type;
    const listClass =
      currentList.type === "ol"
        ? "list-decimal list-inside my-1 space-y-0.5"
        : "list-disc list-inside my-1 space-y-0.5";

    elements.push(
      <ListTag key={`list-${elements.length}`} className={listClass}>
        {currentList.items.map((item, i) => (
          <li key={i} className="leading-relaxed">
            {renderInlineMarkdown(item)}
          </li>
        ))}
      </ListTag>
    );
    currentList = null;
  };

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);

    if (olMatch) {
      if (currentList && currentList.type !== "ol") {
        flushList();
      }
      if (!currentList) {
        currentList = { type: "ol", items: [] };
      }
      currentList.items.push(olMatch[2]);
    } else if (ulMatch) {
      if (currentList && currentList.type !== "ul") {
        flushList();
      }
      if (!currentList) {
        currentList = { type: "ul", items: [] };
      }
      currentList.items.push(ulMatch[1]);
    } else {
      flushList();
      if (trimmed === "" && lineIndex !== lines.length - 1) {
        elements.push(<span key={`br-${lineIndex}`} className="block h-2" />);
      } else {
        elements.push(
          <span key={`line-${lineIndex}`} className="block leading-relaxed">
            {renderInlineMarkdown(line)}
          </span>
        );
      }
    }
  });

  flushList();
  return elements;
};

const copyTextToClipboard = async (text) => {
  if (!text) return false;

  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard?.writeText
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    if (typeof document === "undefined") {
      return false;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";

    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);

    return copied;
  } catch (error) {
    console.error("Unable to copy chat message:", error);
    return false;
  }
};

function ChatMessageArea({
  messages = EMPTY_ARRAY,
  activeConversation,
  activeChatTitle,
  activeOtherParticipant,
  user,
  workspaceUsersMap,
  serverBaseUrl,
  highlightedMsgId,
  pinnedMessages = EMPTY_ARRAY,
  typingUsers = EMPTY_SET,
  activeReactionPickerId,
  setActiveReactionPickerId,
  activeActionMenuId,
  setActiveActionMenuId,
  quickEmojis = EMPTY_ARRAY,
  emojiPalette = EMPTY_ARRAY,
  messagesScrollRef,
  isSelfUser,
  getDisplayName,
  getUserInitials,
  formatMessageTime,
  formatMessageDateHeader,
  formatFileSize,
  scrollToMessage,
  onReply,
  onStartEdit,
  onForward,
  onToggleReaction,
  onTogglePin,
  onDeleteMessage,
  onDownloadAttachment,
}) {
  const safeMessages = Array.isArray(messages)
    ? messages
    : EMPTY_ARRAY;

  const safePinnedMessages = Array.isArray(pinnedMessages)
    ? pinnedMessages
    : EMPTY_ARRAY;

  const safeQuickEmojis = Array.isArray(quickEmojis)
    ? quickEmojis
    : EMPTY_ARRAY;

  const safeEmojiPalette = Array.isArray(emojiPalette)
    ? emojiPalette
    : EMPTY_ARRAY;

  const typingUserNames = useMemo(() => {
    let ids = [];
    if (typingUsers instanceof Map) {
      ids = Array.from(typingUsers.keys());
    } else if (typingUsers instanceof Set || Array.isArray(typingUsers)) {
      ids = Array.from(typingUsers);
    } else if (typingUsers && typeof typingUsers === "object") {
      ids = Object.keys(typingUsers);
    }

    const myId = getId(user);

    return ids
      .filter((id) => getId(id) && getId(id) !== myId)
      .map((id) => {
        if (typeof getDisplayName === "function") {
          const resolved = getDisplayName(id, workspaceUsersMap);
          if (resolved) return resolved;
        }
        return "Someone";
      })
      .filter(Boolean);
  }, [typingUsers, user, getDisplayName, workspaceUsersMap]);

  const typingLabel = useMemo(() => {
    if (!typingUserNames.length) return "";
    if (typingUserNames.length === 1) {
      return `${typingUserNames[0]} is typing...`;
    }
    if (typingUserNames.length === 2) {
      return `${typingUserNames[0]} and ${typingUserNames[1]} are typing...`;
    }
    return `${typingUserNames[0]} and ${typingUserNames.length - 1} others are typing...`;
  }, [typingUserNames]);

  useEffect(() => {
    if (typingLabel && messagesScrollRef?.current) {
      const el = messagesScrollRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
      if (isNearBottom) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }
    }
  }, [typingLabel, messagesScrollRef]);

  const [lightboxImage, setLightboxImage] = useState(null);

  useEffect(() => {
    if (!lightboxImage) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setLightboxImage(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxImage]);

  const handleCopy = async (text) => {
    const copied = await copyTextToClipboard(text);

    if (!copied) {
      console.warn("Unable to copy message text.");
    }

    setActiveActionMenuId?.(null);
  };

  return (
    <div className="flex flex-1 flex-col h-full min-h-0 overflow-hidden bg-white">
      {safePinnedMessages.length > 0 && (
        <div className="flex items-center justify-between px-6 py-2 bg-amber-50/80 border-b border-amber-200 text-xs text-amber-900 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Pin size={13} className="text-amber-700 shrink-0" />

            <span className="font-bold">Pinned:</span>

            <button
              type="button"
              onClick={() => {
                const pinnedId = getId(
                  safePinnedMessages[0]?._id ||
                  safePinnedMessages[0]?.id
                );

                if (pinnedId) scrollToMessage?.(pinnedId);
              }}
              className="truncate text-left cursor-pointer hover:underline"
            >
              {safePinnedMessages[0]?.text || "Attachment"}
            </button>
          </div>

          <span className="text-[10px] text-amber-700 font-semibold">
            {safePinnedMessages.length} pinned
          </span>
        </div>
      )}

      <div
        ref={messagesScrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-3 bg-[#F8F9FA] overscroll-contain"
      >
        {safeMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center select-none">
            <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-[#5B5FC7] font-bold text-xl mb-2 shadow-xs">
              {activeConversation?.isGroup ? (
                <Users size={24} />
              ) : (
                "👋"
              )}
            </div>

            <h4 className="text-sm font-bold text-gray-800">
              {activeChatTitle || "Chat"}
            </h4>

            <p className="text-xs text-gray-500 mt-1 max-w-sm">
              {activeConversation?.isGroup
                ? "Start collaborating with your team in this group chat."
                : "Direct message history. Send a message to start conversing."}
            </p>
          </div>
        ) : (
          safeMessages.map((msg, idx) => {
            const messageId =
              getId(msg?._id || msg?.id) || `message-${idx}`;

            const senderId = getId(msg?.sender);
            const currentUserId = getId(user);

            const isMe =
              typeof isSelfUser === "function"
                ? Boolean(isSelfUser(msg?.sender))
                : Boolean(
                    senderId &&
                    currentUserId &&
                    senderId === currentUserId
                  );

            const senderName =
              getDisplayName?.(msg?.sender, workspaceUsersMap) ||
              (msg?.sender?.name || (msg?.sender?.firstName ? `${msg.sender.firstName} ${msg.sender.lastName || ""}`.trim() : "") || msg?.sender?.username || (msg?.sender?.email ? msg.sender.email.split("@")[0] : "") || senderId || "");

            const senderInitials =
              getUserInitials?.(msg?.sender, workspaceUsersMap) ||
              (senderName ? senderName.slice(0, 2).toUpperCase() : "");

            const prevMsg = idx > 0 ? safeMessages[idx - 1] : null;

            const currentDateHeader =
              formatMessageDateHeader?.(msg?.createdAt) || "";

            const prevDateHeader = prevMsg
              ? formatMessageDateHeader?.(prevMsg.createdAt) || ""
              : null;

            const showDateHeader =
              idx === 0 || currentDateHeader !== prevDateHeader;

            const otherPartId = getId(activeOtherParticipant);

            const readBy = Array.isArray(msg?.readBy)
              ? msg.readBy
              : EMPTY_ARRAY;

            const isReadByRecipient = activeConversation?.isGroup
              ? readBy.some(
                  (reader) => getId(reader) !== senderId
                )
              : Boolean(
                  otherPartId &&
                  readBy.some(
                    (reader) => getId(reader) === otherPartId
                  )
                );

            const reactions = Array.isArray(msg?.reactions)
              ? msg.reactions
              : EMPTY_ARRAY;

            const reactionMap = Object.create(null);

            reactions.forEach((reaction) => {
              if (!reaction?.emoji) return;

              if (!reactionMap[reaction.emoji]) {
                reactionMap[reaction.emoji] = [];
              }

              reactionMap[reaction.emoji].push(reaction.user);
            });

            const attachments = Array.isArray(msg?.attachments)
              ? msg.attachments
              : EMPTY_ARRAY;

            const isDeleted = Boolean(msg?.isDeletedForEveryone);
            const isImportant = Boolean(msg?.priority === "important" || msg?.priority === "urgent");

            const isFailed = Boolean(
              msg?.sendFailed || msg?.status === "failed"
            );

            const isPending = Boolean(
              msg?.pending ||
              msg?.sending ||
              msg?.status === "sending"
            );

            return (
              <div
                key={messageId}
                id={`msg-${messageId}`}
                className="w-full"
              >
                {showDateHeader && currentDateHeader && (
                  <div className="flex items-center justify-center my-4">
                    <span className="rounded-full bg-gray-200/80 px-3 py-1 text-[10px] font-bold text-gray-600 shadow-2xs select-none">
                      {currentDateHeader}
                    </span>
                  </div>
                )}

                <div
                  className={`flex w-full mb-2.5 items-end gap-2.5 ${
                    isMe ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isMe && (
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#5B5FC7] text-white font-bold text-xs shadow-xs mb-1 select-none"
                      title={senderName}
                    >
                      {senderInitials}
                    </div>
                  )}

                  <div
                    className={`group relative flex flex-col ${
                      isMe ? "items-end" : "items-start"
                    } max-w-[85%] sm:max-w-[75%] md:max-w-[68%] ${
                      highlightedMsgId === messageId
                        ? "ring-2 ring-indigo-500 rounded-2xl"
                        : ""
                    }`}
                  >
                    {!isMe && (
                      <div className="flex items-center gap-1.5 mb-1 px-1 select-none">
                        <span className="text-xs font-semibold text-[#5B5FC7]">
                          {senderName}
                        </span>

                        <span className="text-[10px] text-gray-400">
                          {formatMessageTime?.(msg?.createdAt)}
                        </span>
                      </div>
                    )}

                    <div
                      className={`relative px-4 py-2.5 shadow-xs transition ${
                        isMe
                          ? isImportant ? "bg-[#5B5FC7] text-white rounded-2xl rounded-br-xs border-l-4 border-l-red-300" : "bg-[#5B5FC7] text-white rounded-2xl rounded-br-xs"
                          : isImportant ? "bg-white text-gray-900 border border-gray-200/90 border-l-4 border-l-red-500 rounded-2xl rounded-bl-xs" : "bg-white text-gray-900 border border-gray-200/90 rounded-2xl rounded-bl-xs"
                      }`}
                    >
                      {isImportant && (
                        <div
                          className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider mb-1.5 select-none ${
                            isMe ? "text-red-200" : "text-red-600"
                          }`}
                        >
                          <AlertCircle size={13} strokeWidth={2.5} />
                          <span>Important</span>
                        </div>
                      )}

                      {msg?.isPinned && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-300 mb-1">
                          <Pin size={11} />
                          <span>Pinned Message</span>
                        </div>
                      )}

                      {msg?.replyTo && (
                        <button
                          type="button"
                          onClick={() => {
                            const replyId = getId(
                              msg.replyTo?._id || msg.replyTo?.id
                            );

                            if (replyId) scrollToMessage?.(replyId);
                          }}
                          className={`mb-2 w-full text-left rounded-lg p-2 text-xs border-l-3 cursor-pointer ${
                            isMe
                              ? "bg-black/15 text-indigo-100 border-white/80 hover:bg-black/20"
                              : "bg-gray-100 text-gray-700 border-[#5B5FC7] hover:bg-gray-200/70"
                          }`}
                        >
                          <span className="block font-bold text-[10px] uppercase tracking-wider mb-0.5">
                            {getDisplayName?.(
                              msg.replyTo.sender,
                              workspaceUsersMap
                            ) || "Reply"}
                          </span>

                          <span className="block truncate italic line-clamp-1">
                            {msg.replyTo.isDeletedForEveryone
                              ? "🚫 Deleted message"
                              : msg.replyTo.text || "Attachment"}
                          </span>
                        </button>
                      )}

                      {isDeleted ? (
                        <p className="italic text-gray-400 flex items-center gap-1.5 py-0.5 text-xs">
                          <span>🚫</span>
                          <span>This message was deleted</span>
                        </p>
                      ) : (
                        msg?.text && (
                          <div className="text-sm font-normal leading-relaxed break-words select-text">
                            {renderFormattedText(msg.text)}
                          </div>
                        )
                      )}

                      {!isDeleted &&
                        attachments.map((att, attIdx) => {
                          const fileUrl = getAttachmentUrl(
                            att,
                            serverBaseUrl
                          );

                          const mimeType = String(
                            att?.type || att?.mimeType || ""
                          ).toLowerCase();

                          const isImage = mimeType.startsWith("image/");
                          const isVideo = mimeType.startsWith("video/");
                          const isAudio = mimeType.startsWith("audio/");

                          const attachmentName =
                            att?.name ||
                            att?.originalname ||
                            "Attachment";

                          return (
                            <div
                              key={`${messageId}-attachment-${attIdx}`}
                              className="mt-2"
                            >
                              {isImage && fileUrl ? (
                                <div
                                  className="relative rounded-xl overflow-hidden border border-gray-200/60 max-w-[280px] sm:max-w-[320px] shadow-xs cursor-pointer group mt-1.5"
                                  onClick={() =>
                                    setLightboxImage({
                                      url: fileUrl,
                                      name: attachmentName,
                                    })
                                  }
                                >
                                  <img
                                    src={fileUrl}
                                    alt={attachmentName}
                                    className="w-full h-auto max-h-[300px] object-cover rounded-xl block transition-transform duration-200 group-hover:scale-[1.01]"
                                    loading="lazy"
                                    decoding="async"
                                  />

                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onDownloadAttachment?.(
                                          messageId,
                                          attIdx,
                                          attachmentName
                                        );
                                      }}
                                      className="flex items-center gap-1 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-bold text-gray-800 shadow hover:bg-white transition"
                                      title="Download image"
                                    >
                                      <Download size={13} />
                                      <span>Download</span>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border ${
                                    isMe
                                      ? "bg-white/15 border-white/20 text-white"
                                      : "bg-gray-50 border-gray-200 text-gray-800"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div
                                      className={`p-2 rounded-lg ${
                                        isMe
                                          ? "bg-white/20 text-white"
                                          : "bg-indigo-50 text-[#5B5FC7]"
                                      }`}
                                    >
                                      <FileText size={18} />
                                    </div>

                                    <div className="min-w-0">
                                      <p className="truncate text-xs font-bold leading-tight">
                                        {attachmentName}
                                      </p>

                                      <span className="text-[10px] opacity-75">
                                        {typeof formatFileSize === "function"
                                          ? formatFileSize(att?.size || 0)
                                          : ""}
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      onDownloadAttachment?.(
                                        messageId,
                                        attIdx,
                                        attachmentName
                                      )
                                    }
                                    className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg transition shrink-0 ${
                                      isMe
                                        ? "bg-white text-[#5B5FC7] hover:bg-white/90"
                                        : "bg-[#5B5FC7] text-white hover:bg-[#4a4ea8]"
                                    }`}
                                  >
                                    <Download size={12} />
                                    <span>Download</span>
                                  </button>
                                </div>
                              )}

                              {isVideo && fileUrl && (
                                <video
                                  className="mt-2 max-h-64 max-w-xs rounded-xl"
                                  src={fileUrl}
                                  controls
                                  preload="metadata"
                                />
                              )}

                              {isAudio && fileUrl && (
                                <audio
                                  className="mt-2 max-w-xs"
                                  src={fileUrl}
                                  controls
                                  preload="metadata"
                                />
                              )}
                            </div>
                          );
                        })}

                      <div
                        className={`flex items-center justify-end gap-1 mt-1 text-[10px] font-medium select-none ${
                          isMe
                            ? "text-indigo-200"
                            : "text-gray-400"
                        }`}
                      >
                        {msg?.isEdited && (
                          <span className="italic mr-1">(edited)</span>
                        )}

                        <span>
                          {formatMessageTime?.(msg?.createdAt)}
                        </span>

                        {isMe && (
                          <span
                            className="ml-0.5 inline-flex items-center"
                            title={
                              isReadByRecipient
                                ? "Read"
                                : isPending
                                  ? "Sending"
                                  : isFailed
                                    ? "Failed to send"
                                    : !msg?.isOptimistic
                                      ? "Delivered"
                                      : "Sent"
                            }
                          >
                            {isFailed ? (
                              <AlertCircle
                                size={14}
                                className="text-red-300"
                              />
                            ) : isPending ? (
                              <Clock
                                size={13}
                                className="text-indigo-200"
                              />
                            ) : isReadByRecipient ? (
                              <CheckCheck
                                size={14}
                                className="text-[#38BDF8]"
                              />
                            ) : !msg?.isOptimistic ? (
                              <CheckCheck
                                size={14}
                                className="text-indigo-200"
                              />
                            ) : (
                              <Check
                                size={14}
                                className="text-indigo-200"
                              />
                            )}
                          </span>
                        )}
                      </div>

                      {isFailed && (
                        <p
                          className="mt-1 text-[10px] font-semibold text-red-200"
                          role="status"
                        >
                          {msg?.sendError ||
                            "Message failed to send. Please try again."}
                        </p>
                      )}

                      {Object.entries(reactionMap).length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          {Object.entries(reactionMap).map(
                            ([emoji, userIds]) => {
                              const myId = getId(user);

                              const hasReacted = userIds.some(
                                (id) => getId(id) === myId
                              );

                              return (
                                <button
                                  type="button"
                                  key={emoji}
                                  onClick={() =>
                                    onToggleReaction?.(
                                      messageId,
                                      emoji
                                    )
                                  }
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition border ${
                                    hasReacted
                                      ? "bg-indigo-100/90 border-[#5B5FC7] text-[#5B5FC7]"
                                      : isMe
                                        ? "bg-white/20 border-white/30 text-white hover:bg-white/30"
                                        : "bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200"
                                  }`}
                                  title="Toggle reaction"
                                >
                                  <span>{emoji}</span>
                                  <span className="text-[10px]">
                                    {userIds.length}
                                  </span>
                                </button>
                              );
                            }
                          )}
                        </div>
                      )}
                    </div>

                    {!isDeleted && (
                      <div
                        className={`absolute -top-3.5 z-20 hidden group-hover:flex items-center bg-white rounded-lg shadow-md border border-gray-200 px-1 py-0.5 gap-0.5 select-none ${
                          isMe ? "right-2" : "left-2"
                        }`}
                      >
                        {safeQuickEmojis.slice(0, 4).map((emoji) => (
                          <button
                            type="button"
                            key={emoji}
                            onClick={() =>
                              onToggleReaction?.(messageId, emoji)
                            }
                            className="p-1 hover:bg-gray-100 rounded text-sm transition"
                            title={`React ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() =>
                            setActiveReactionPickerId?.(
                              activeReactionPickerId === messageId
                                ? null
                                : messageId
                            )
                          }
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-800 transition"
                          title="More reactions"
                        >
                          <Smile size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => onReply?.(msg)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-800 transition"
                          title="Reply"
                        >
                          <CornerUpLeft size={14} />
                        </button>

                        {msg?.text && (
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.text)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-800 transition"
                            title="Copy text"
                          >
                            <Copy size={13} />
                          </button>
                        )}

                        {isMe && (
                          <button
                            type="button"
                            onClick={() => onStartEdit?.(msg)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-800 transition"
                            title="Edit message"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onForward?.(msg)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-800 transition"
                          title="Forward message"
                        >
                          <Share2 size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setActiveActionMenuId?.(
                              activeActionMenuId === messageId
                                ? null
                                : messageId
                            )
                          }
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600 transition"
                          title="More options"
                        >
                          <MoreVertical size={14} />
                        </button>
                      </div>
                    )}

                    {activeReactionPickerId === messageId && (
                      <div
                        className={`absolute -top-12 z-30 flex flex-wrap gap-1 bg-white p-2 rounded-xl border border-gray-200 shadow-xl max-w-xs ${
                          isMe ? "right-2" : "left-2"
                        }`}
                      >
                        {safeEmojiPalette.map((emoji) => (
                          <button
                            type="button"
                            key={emoji}
                            onClick={() =>
                              onToggleReaction?.(messageId, emoji)
                            }
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-base transition text-center"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {activeActionMenuId === messageId && (
                      <div
                        className={`absolute -top-24 z-30 w-44 bg-white rounded-xl border border-gray-200 shadow-xl py-1 text-xs font-semibold ${
                          isMe ? "right-2" : "left-2"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onTogglePin?.(messageId);
                            setActiveActionMenuId?.(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-100 transition"
                        >
                          <Pin size={13} />
                          <span>
                            {msg?.isPinned
                              ? "Unpin message"
                              : "Pin message"}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopy(msg?.text || "")}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-100 transition"
                        >
                          <Copy size={13} />
                          <span>Copy text</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onDeleteMessage?.(messageId, "me");
                            setActiveActionMenuId?.(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-100 transition"
                        >
                          <Trash2 size={13} />
                          <span>Delete for me</span>
                        </button>

                        {(isMe || user?.role === "admin") && (
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteMessage?.(
                                messageId,
                                "everyone"
                              );
                              setActiveActionMenuId?.(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-red-600 hover:bg-red-50 transition"
                          >
                            <Trash2 size={13} />
                            <span>Delete for everyone</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {isMe && (
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#464775] text-white font-bold text-xs shadow-xs mb-1 select-none"
                      title="You"
                    >
                      {getUserInitials?.(user, workspaceUsersMap) ||
                        "You"}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {typingLabel ? (
        <div className="px-4 sm:px-6 py-2 bg-white/95 border-t border-gray-100 shrink-0 select-none flex items-center">
          <div className="bg-gray-100/70 text-gray-500 text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 shadow-2xs">
            <span>{typingLabel}</span>
            <span className="flex items-center gap-1 ml-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-gray-500 animate-bounce" />
            </span>
          </div>
        </div>
      ) : null}

      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full mb-3 text-white">
              <span className="text-sm font-semibold truncate max-w-md">
                {lightboxImage.name}
              </span>
              <div className="flex items-center gap-3">
                <a
                  href={lightboxImage.url}
                  download={lightboxImage.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-semibold text-white transition"
                >
                  <Download size={14} />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="p-1 rounded-lg hover:bg-white/20 text-white transition"
                  title="Close (Esc)"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name}
              className="max-h-[80vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ChatMessageArea);