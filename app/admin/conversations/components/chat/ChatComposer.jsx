"use strict";
import React from "react";
import { Send, Paperclip, ImageIcon, Smile, FileText, X, Loader2, Pencil } from "lucide-react";

export function ChatComposer({
  message,
  setMessage,
  selectedFiles,
  setSelectedFiles,
  replyingTo,
  setReplyingTo,
  typingUsers,
  selectedConversationId,
  socketRef,
  emitTypingTimerRef,
  handleSendMessage,
  sendingMessage,
  formatActive,
  setFormatActive,
  showEmojiPicker,
  setShowEmojiPicker,
  appendEmoji,
  fileInputRef,
  messageInputRef,
  getUserName,
  getMessageBody
}) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  return (
    <div className="relative z-20 mt-auto w-full shrink-0 border-t border-[#E1DFDD] bg-white px-4 pb-3 pt-3 sm:px-6 shadow-md">
      <div className="mx-auto max-w-4xl">
        {replyingTo && (
          <div className="mb-2 flex items-center justify-between rounded-t border-l-2 border-[#5B5FC7] bg-[#EEF1FD] px-3 py-1.5 text-xs">
            <div>
              <span className="font-semibold text-[#5B5FC7]">Replying to {getUserName(replyingTo.sender)}</span>
              <p className="truncate text-[11px] text-[#616161]">{getMessageBody(replyingTo) || "Attachment"}</p>
            </div>
            <button type="button" onClick={() => setReplyingTo(null)} className="hover:text-red-500">
              <X size={14} />
            </button>
          </div>
        )}

        {selectedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded border bg-[#EEF1FD] px-2.5 py-1 text-xs">
                <FileText size={13} className="text-[#5B5FC7]" />
                <span className="max-w-[150px] truncate">{file.name}</span>
                <button type="button" onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            const convId = selectedConversationId;
            if (convId && socketRef.current?.connected) socketRef.current.emit("typing:stop", { conversationId: convId });
            handleSendMessage(e);
          }}
          className="flex min-h-[54px] w-full items-center rounded-lg border border-[#C8C6C4] bg-white shadow-sm focus-within:border-[#5B5FC7]"
        >
          <div className="flex min-h-[52px] w-full items-end gap-2 px-3 py-1.5">
            <textarea
              ref={messageInputRef}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                const convId = selectedConversationId;
                if (convId && socketRef.current?.connected) {
                  socketRef.current.emit("typing:start", { conversationId: convId });
                  clearTimeout(emitTypingTimerRef?.current);
                  if (emitTypingTimerRef) {
                    emitTypingTimerRef.current = setTimeout(() => {
                      socketRef.current.emit("typing:stop", { conversationId: convId });
                    }, 2000);
                  }
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type a message (Press Enter to send)"
              rows={1}
              className="block min-h-[40px] max-h-[96px] min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none text-[#242424]"
            />
            <div className="flex shrink-0 items-center gap-1 pb-1 text-[#616161]">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    setSelectedFiles(Array.from(e.target.files));
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded p-1.5 hover:bg-[#EDEBE9]"
                title="Attach file"
              >
                <Paperclip size={18} />
              </button>
              <button
                type="submit"
                disabled={(!message.trim() && selectedFiles.length === 0) || sendingMessage}
                className="ml-1 flex h-8 w-8 items-center justify-center rounded bg-[#5B5FC7] text-white hover:bg-[#474bc2] disabled:bg-[#F3F2F1] disabled:text-[#8A8886] transition-colors"
                title="Send message"
              >
                {sendingMessage ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}