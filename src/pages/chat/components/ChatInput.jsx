import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  CornerUpLeft,
  Edit2,
  FileText,
  Image as ImageIcon,
  MessageCircle,
  Paperclip,
  Plus,
  Send,
  Smile,
  X,
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  AlertCircle,
  AtSign,
} from "lucide-react";

const htmlToMarkdown = (html) => {
  if (!html || typeof html !== "string") return "";

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const body = doc.body;

    const walk = (node, listContext = null) => {
      if (!node) return "";

      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || "";
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        const childNodes = Array.from(node.childNodes);

        if (tag === "ul") {
          return "\n" + childNodes.map((child) => walk(child, { type: "ul" })).filter(Boolean).join("\n") + "\n";
        }
        if (tag === "ol") {
          let itemIndex = 1;
          return "\n" + childNodes.map((child) => {
            if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === "li") {
              const res = walk(child, { type: "ol", index: itemIndex });
              itemIndex++;
              return res;
            }
            return walk(child);
          }).filter(Boolean).join("\n") + "\n";
        }

        if (tag === "li") {
          const content = childNodes.map((child) => walk(child)).join("").trim();
          if (listContext?.type === "ol") {
            return `${listContext.index || 1}. ${content}`;
          }
          return `- ${content}`;
        }

        const inner = childNodes.map((child) => walk(child, listContext)).join("");

        if (tag === "strong" || tag === "b") {
          return inner.trim() ? `**${inner.trim()}**` : "";
        }
        if (tag === "em" || tag === "i") {
          return inner.trim() ? `*${inner.trim()}*` : "";
        }
        if (tag === "del" || tag === "s" || tag === "strike") {
          return inner.trim() ? `~~${inner.trim()}~~` : "";
        }
        if (tag === "code") {
          return inner.trim() ? `\`${inner.trim()}\`` : "";
        }
        if (tag === "p" || tag === "div") {
          return inner ? `${inner}\n` : "";
        }
        if (tag === "br") {
          return "\n";
        }

        return inner;
      }

      return "";
    };

    return walk(body).trim();
  } catch (e) {
    console.warn("Failed to parse HTML into markdown:", e);
    return "";
  }
};

export default function ChatInput({
  composerText,
  setComposerText,
  selectedFiles = [],
  replyingTo,
  setReplyingTo,
  editingMessage,
  setEditingMessage,
  showInputEmojiPicker,
  setShowInputEmojiPicker,
  emojiPalette = [],
  fileInputRef,
  textareaRef,
  workspaceUsersMap,
  getDisplayName,
  onSendMessage,
  onFilesSelected,
  onRemoveFile,
  emitTyping,
  priority = "standard",
  setPriority,
  groupMembers = [],
}) {
  const typingTimerRef = useRef(null);
  const emitTypingRef = useRef(emitTyping);
  const [mentionFilter, setMentionFilter] = useState(null);

  const safeFiles = Array.isArray(selectedFiles)
    ? selectedFiles
    : [];

  const safeEmojiPalette = Array.isArray(emojiPalette)
    ? emojiPalette
    : [];

  const safeGroupMembers = Array.isArray(groupMembers)
    ? groupMembers
    : [];

  const safeText =
    typeof composerText === "string" ? composerText : "";

  const hasContent = Boolean(
    safeText.trim() || safeFiles.length
  );

  const filteredMembers =
    mentionFilter !== null
      ? safeGroupMembers
          .filter((m) => {
            const name = (
              (typeof getDisplayName === "function"
                ? getDisplayName(m, workspaceUsersMap)
                : m?.name) ||
              m?.username ||
              ""
            ).toLowerCase();
            return name.includes(mentionFilter.toLowerCase());
          })
          .slice(0, 6)
      : [];

  // Keep the latest typing callback without restarting the timer
  // whenever the parent creates a new callback reference.
  emitTypingRef.current = emitTyping;

  const stopTyping = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    emitTypingRef.current?.(false);
  }, []);

  // Debounced typing indicator.
  useEffect(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    if (!safeText.trim()) {
      emitTypingRef.current?.(false);
      return undefined;
    }

    emitTypingRef.current?.(true);

    typingTimerRef.current = setTimeout(() => {
      emitTypingRef.current?.(false);
      typingTimerRef.current = null;
    }, 1500);

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, [safeText]);

  // Stop typing when the component is unmounted.
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }

      emitTypingRef.current?.(false);
    };
  }, []);

  // Automatically resize the textarea without increasing it
  // beyond the maximum height.
  useEffect(() => {
    const textarea = textareaRef?.current;

    if (!textarea) return;

    textarea.style.height = "auto";

    const nextHeight = Math.min(textarea.scrollHeight, 112);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > 112 ? "auto" : "hidden";
  }, [safeText, textareaRef]);

  const openFilePicker = () => {
    fileInputRef?.current?.click();
  };

  const handleTextChange = (event) => {
    const val = event.target.value;
    setComposerText(val);

    const cursor = event.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);
    const match = textBefore.match(/(?:^|\s)@([a-zA-Z0-9_.-]*)$/);

    if (match && safeGroupMembers.length > 0) {
      setMentionFilter(match[1]);
    } else {
      setMentionFilter(null);
    }
  };

  const insertMention = (member) => {
    const rawName =
      (typeof getDisplayName === "function"
        ? getDisplayName(member, workspaceUsersMap)
        : member?.name) ||
      member?.username ||
      "user";
    const cleanName = rawName.replace(/\s+/g, "");
    const mentionTag = `@${cleanName} `;

    const textarea = textareaRef?.current;
    if (!textarea) {
      setComposerText((previous) => `${previous || ""} ${mentionTag}`);
      setMentionFilter(null);
      return;
    }

    const cursor = textarea.selectionStart ?? safeText.length;
    const textBefore = safeText.slice(0, cursor);
    const textAfter = safeText.slice(cursor);
    const atIndex = textBefore.lastIndexOf("@");

    if (atIndex !== -1) {
      const updated = textBefore.slice(0, atIndex) + mentionTag + textAfter;
      setComposerText(updated);
      setMentionFilter(null);
      requestAnimationFrame(() => {
        if (!textareaRef.current) return;
        textareaRef.current.focus();
        const nextPos = atIndex + mentionTag.length;
        textareaRef.current.setSelectionRange(nextPos, nextPos);
      });
    } else {
      setMentionFilter(null);
    }
  };

  const handleFileChange = (event) => {
    try {
      onFilesSelected?.(event);
    } finally {
      // Allow selecting the same file again.
      event.target.value = "";
    }
  };

  const handleSubmit = (event) => {
    event?.preventDefault?.();

    if (!hasContent || typeof onSendMessage !== "function") {
      return;
    }

    setMentionFilter(null);
    stopTyping();
    onSendMessage(event);
  };

  const applyFormat = (type) => {
    const textarea = textareaRef?.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? safeText.length;
    const end = textarea.selectionEnd ?? start;
    const selected = safeText.slice(start, end);

    let prefix = "";
    let suffix = "";
    let defaultText = "";

    switch (type) {
      case "bold":
        prefix = "**";
        suffix = "**";
        defaultText = "bold text";
        break;
      case "italic":
        prefix = "*";
        suffix = "*";
        defaultText = "italic text";
        break;
      case "strike":
        prefix = "~~";
        suffix = "~~";
        defaultText = "strikethrough text";
        break;
      case "code":
        prefix = "`";
        suffix = "`";
        defaultText = "code";
        break;
      case "ul":
        prefix = "- ";
        suffix = "";
        defaultText = "item";
        break;
      case "ol":
        prefix = "1. ";
        suffix = "";
        defaultText = "item";
        break;
      default:
        return;
    }

    const replacement = selected ? `${prefix}${selected}${suffix}` : `${prefix}${defaultText}${suffix}`;
    const updatedText = safeText.slice(0, start) + replacement + safeText.slice(end);

    setComposerText(updatedText);

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      if (selected) {
        textareaRef.current.setSelectionRange(start, start + replacement.length);
      } else {
        textareaRef.current.setSelectionRange(start + prefix.length, start + prefix.length + defaultText.length);
      }
    });
  };

  const handlePaste = (event) => {
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    const html = clipboardData.getData("text/html");
    if (
      html &&
      (html.includes("<b") ||
        html.includes("<strong") ||
        html.includes("<i") ||
        html.includes("<em") ||
        html.includes("<ul") ||
        html.includes("<ol") ||
        html.includes("<s") ||
        html.includes("<code"))
    ) {
      const markdown = htmlToMarkdown(html);
      if (markdown) {
        event.preventDefault();
        const textarea = textareaRef?.current;
        if (!textarea) {
          setComposerText((previous) => `${previous || ""}${markdown}`);
          return;
        }

        const start = textarea.selectionStart ?? safeText.length;
        const end = textarea.selectionEnd ?? start;
        const updated = safeText.slice(0, start) + markdown + safeText.slice(end);

        setComposerText(updated);
        requestAnimationFrame(() => {
          if (!textareaRef.current) return;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(start + markdown.length, start + markdown.length);
        });
      }
    }
  };

  const handleKeyDown = (event) => {
    const isComposing =
      event.nativeEvent?.isComposing ||
      event.nativeEvent?.keyCode === 229;

    if (mentionFilter !== null) {
      if (event.key === "Escape") {
        setMentionFilter(null);
        return;
      }
      if ((event.key === "Enter" || event.key === "Tab") && filteredMembers.length > 0) {
        event.preventDefault();
        insertMention(filteredMembers[0]);
        return;
      }
    }

    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      if (event.key === "b" || event.key === "B") {
        event.preventDefault();
        applyFormat("bold");
        return;
      }
      if (event.key === "i" || event.key === "I") {
        event.preventDefault();
        applyFormat("italic");
        return;
      }
    }

    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !isComposing
    ) {
      event.preventDefault();

      if (hasContent) {
        handleSubmit(event);
      }
    }
  };

  const insertEmoji = (emoji) => {
    const textarea = textareaRef?.current;

    if (!textarea) {
      setComposerText((previous) => `${previous || ""}${emoji}`);
      setShowInputEmojiPicker?.(false);
      return;
    }

    const start = textarea.selectionStart ?? safeText.length;
    const end = textarea.selectionEnd ?? start;

    const updatedText =
      safeText.slice(0, start) +
      emoji +
      safeText.slice(end);

    const nextCursorPosition = start + emoji.length;

    setComposerText(updatedText);
    setShowInputEmojiPicker?.(false);

    requestAnimationFrame(() => {
      const currentTextarea = textareaRef?.current;

      if (!currentTextarea) return;

      currentTextarea.focus();
      currentTextarea.style.height = "auto";

      const nextHeight = Math.min(
        currentTextarea.scrollHeight,
        112
      );

      currentTextarea.style.height = `${nextHeight}px`;
      currentTextarea.style.overflowY =
        currentTextarea.scrollHeight > 112 ? "auto" : "hidden";

      currentTextarea.setSelectionRange(
        nextCursorPosition,
        nextCursorPosition
      );
    });
  };

  const cancelEditing = () => {
    setEditingMessage?.(null);
    setComposerText("");
    stopTyping();

    if (textareaRef?.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.overflowY = "hidden";
    }
  };

  const replySender =
    typeof getDisplayName === "function"
      ? getDisplayName(replyingTo?.sender, workspaceUsersMap)
      : "";

  const replyPreview =
    typeof replyingTo?.text === "string"
      ? replyingTo.text
      : replyingTo?.text
        ? "Message"
        : "Attachment";

  return (
    <div className="relative shrink-0 border-t border-gray-200 bg-white px-3 py-2 sm:px-4">
      {replyingTo && (
        <div className="mb-2 flex min-w-0 items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs">
          <div className="flex min-w-0 items-center gap-2">
            <CornerUpLeft
              size={14}
              className="shrink-0 text-[#5B5FC7]"
            />

            <span className="shrink-0 font-semibold text-[#5B5FC7]">
              Replying to {replySender || "message"}:
            </span>

            <span className="truncate text-gray-600">
              {replyPreview}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setReplyingTo?.(null)}
            className="ml-2 rounded-md p-1 text-gray-400 transition hover:bg-indigo-100 hover:text-gray-700"
            aria-label="Cancel reply"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {editingMessage && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
          <div className="flex items-center gap-2 text-amber-800">
            <Edit2 size={14} />
            <span className="font-semibold">
              Editing message
            </span>
          </div>

          <button
            type="button"
            onClick={cancelEditing}
            className="rounded-md p-1 text-amber-600 transition hover:bg-amber-100 hover:text-amber-900"
            aria-label="Cancel editing"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {safeFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
          {safeFiles.map((file, index) => (
            <div
              key={`${file.name || "file"}-${file.size || 0}-${index}`}
              className="flex max-w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-sm"
            >
              <FileText
                size={14}
                className="shrink-0 text-[#5B5FC7]"
              />

              <span className="max-w-[160px] truncate font-medium text-gray-700">
                {file.name || "Attachment"}
              </span>

              <button
                type="button"
                onClick={() => onRemoveFile?.(index)}
                className="rounded p-0.5 text-gray-400 hover:text-red-600"
                aria-label={`Remove ${file.name || "attachment"}`}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Mention Popup */}
      {mentionFilter !== null && filteredMembers.length > 0 && (
        <div className="absolute bottom-[calc(100%+8px)] left-4 z-50 w-64 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl">
          <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Mention Member
          </div>
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {filteredMembers.map((member, i) => {
              const name =
                (typeof getDisplayName === "function"
                  ? getDisplayName(member, workspaceUsersMap)
                  : member?.name) ||
                member?.username ||
                "User";
              return (
                <button
                  type="button"
                  key={member?._id || `mention-${i}`}
                  onClick={() => insertMention(member)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-gray-700 hover:bg-indigo-50 hover:text-[#5B5FC7] transition"
                >
                  <AtSign size={13} className="text-[#5B5FC7] shrink-0" />
                  <span className="truncate">{name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showInputEmojiPicker && (
        <div className="absolute bottom-[calc(100%+8px)] left-4 z-50 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="text-xs font-semibold text-gray-700">
              Choose an emoji
            </span>

            <button
              type="button"
              onClick={() => setShowInputEmojiPicker?.(false)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close emoji picker"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid max-h-48 grid-cols-7 gap-1 overflow-y-auto">
            {safeEmojiPalette.map((emoji, index) => (
              <button
                type="button"
                key={`${emoji}-${index}`}
                onClick={() => insertEmoji(emoji)}
                className="rounded-lg p-2 text-lg transition hover:bg-gray-100"
                aria-label={`Insert ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Formatting & Priority Toolbar */}
      <div className="mb-1.5 flex items-center justify-between gap-1 px-1 text-gray-500">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => applyFormat("bold")}
            className="rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            title="Bold (Ctrl+B)"
            aria-label="Bold"
          >
            <Bold size={13} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => applyFormat("italic")}
            className="rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            title="Italic (Ctrl+I)"
            aria-label="Italic"
          >
            <Italic size={13} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => applyFormat("strike")}
            className="rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            title="Strikethrough"
            aria-label="Strikethrough"
          >
            <Strikethrough size={13} strokeWidth={2.5} />
          </button>
          <span className="mx-1 h-3.5 w-px bg-gray-200" />
          <button
            type="button"
            onClick={() => applyFormat("code")}
            className="rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            title="Inline Code"
            aria-label="Code"
          >
            <Code size={13} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => applyFormat("ul")}
            className="rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            title="Bulleted List"
            aria-label="Bulleted List"
          >
            <List size={14} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => applyFormat("ol")}
            className="rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            title="Numbered List"
            aria-label="Numbered List"
          >
            <ListOrdered size={14} strokeWidth={2.2} />
          </button>
        </div>

        {/* Microsoft Teams Priority Toggle */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() =>
              setPriority?.((p) => (p === "important" ? "standard" : "important"))
            }
            className={`flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold transition ${
              priority === "important"
                ? "bg-red-50 text-red-600 ring-1 ring-red-200 shadow-2xs"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            }`}
            title={
              priority === "important"
                ? "Important Message (Click to revert to Standard)"
                : "Set priority to Important"
            }
          >
            <AlertCircle
              size={13}
              strokeWidth={2.2}
              className={priority === "important" ? "text-red-600" : "text-gray-400"}
            />
            <span className="text-[11px] font-bold">
              {priority === "important" ? "Important" : "Standard"}
            </span>
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex min-h-[52px] items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-1.5 shadow-sm transition focus-within:border-[#5B5FC7] focus-within:ring-1 focus-within:ring-[#5B5FC7]/30"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          id="chat-file-upload"
          className="hidden"
          onChange={handleFileChange}
        />

        <textarea
          ref={textareaRef}
          rows={1}
          value={safeText}
          onChange={handleTextChange}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          placeholder={
            editingMessage ? "Edit a message" : "Type a message"
          }
          aria-label="Type a message"
          className="max-h-28 min-h-[30px] min-w-0 flex-1 bg-transparent py-1.5 text-[15px] leading-5 text-gray-900 placeholder:text-gray-500 outline-none focus:outline-none focus:ring-0 focus:border-transparent border-0 ring-0 shadow-none resize-none overflow-y-hidden"
        />

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() =>
              setShowInputEmojiPicker?.((open) => !open)
            }
            className={`rounded-lg p-1.5 transition hover:bg-gray-100 ${
              showInputEmojiPicker
                ? "text-[#5B5FC7]"
                : "text-gray-600 hover:text-gray-900"
            }`}
            title="Emoji"
            aria-label="Open emoji picker"
          >
            <Smile size={22} strokeWidth={1.6} />
          </button>

          <button
            type="button"
            onClick={openFilePicker}
            className="rounded-lg p-1.5 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            title="Attach a file"
            aria-label="Attach a file"
          >
            <Paperclip size={22} strokeWidth={1.6} />
          </button>

          <button
            type="button"
            onClick={openFilePicker}
            className="rounded-lg p-1.5 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            title="Add a photo or image"
            aria-label="Add a photo or image"
          >
            <ImageIcon size={22} strokeWidth={1.6} />
          </button>

          <button
            type="button"
            onClick={openFilePicker}
            className="hidden rounded-lg p-1.5 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 sm:inline-flex"
            title="More attachment options"
            aria-label="More attachment options"
          >
            <MessageCircle size={21} strokeWidth={1.6} />
          </button>

          <button
            type="button"
            onClick={openFilePicker}
            className="rounded-lg p-1.5 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            title="More options"
            aria-label="More options"
          >
            <Plus size={23} strokeWidth={1.5} />
          </button>

          <span className="mx-0.5 hidden h-7 w-px bg-gray-200 sm:block" />

          <button
            type="submit"
            disabled={!hasContent}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
              hasContent
                ? "text-[#5B5FC7] hover:bg-indigo-50 hover:text-[#464aa8]"
                : "cursor-not-allowed text-gray-400"
            }`}
            title={editingMessage ? "Save edit" : "Send message"}
            aria-label={editingMessage ? "Save edit" : "Send message"}
          >
            <Send size={24} strokeWidth={1.5} />
          </button>
        </div>
      </form>
    </div>
  );
}