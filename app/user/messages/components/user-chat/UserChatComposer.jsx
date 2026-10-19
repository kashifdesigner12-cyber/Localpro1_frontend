"use strict";
import React from "react";
import { Send, Paperclip, ImageIcon, Smile, FileText, X, Bold, Italic, List, Pencil } from "lucide-react";

export function UserChatComposer({
  message,
  setMessage,
  selectedFiles,
  setSelectedFiles,
  replyingTo,
  setReplyingTo,
  handleSendMessage,
  sending,
  formatActive,
  setFormatActive,
  showEmojiPicker,
  setShowEmojiPicker,
  appendEmoji,
  fileInputRef,
  messageInputRef,
  selectedName,
  getMessageText
}) {
  return (
    <div className="shrink-0 bg-white px-4 pb-4 pt-1 sm:px-6">
      <div className="mx-auto max-w-4xl">
        {replyingTo && (
          <div className="mb-2 flex items-center justify-between rounded-t border-l-2 border-[#5B5FC7] bg-[#EEF1FD] px-3 py-1.5 text-xs">
            <div>
              <span className="font-semibold text-[#5B5FC7]">Replying directly to Admin message</span>
              <p className="truncate text-[11px] text-[#616161]">{getMessageText(replyingTo) || "Attachment"}</p>
            </div>
            <button onClick={() => setReplyingTo(null)}><X size={14} /></button>
          </div>
        )}

        {selectedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded border bg-[#EEF1FD] px-2.5 py-1 text-xs">
                <FileText size={13} className="text-[#5B5FC7]" />
                <span className="max-w-[150px] truncate">{file.name}</span>
                <button onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))}><X size={12} /></button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSendMessage} className="rounded-lg border border-[#E1DFDD] bg-white shadow-2xs focus-within:border-[#5B5FC7]">
          {formatActive && (
            <div className="flex items-center gap-1 border-b border-[#E1DFDD] bg-[#F5F5F5] px-3 py-1 text-[#616161]">
              <button type="button" onClick={() => setMessage((p) => `**${p}**`)} className="rounded p-1 hover:bg-[#EDEBE9]"><Bold size={13} /></button>
              <button type="button" onClick={() => setMessage((p) => `*${p}*`)} className="rounded p-1 hover:bg-[#EDEBE9]"><Italic size={13} /></button>
              <button type="button" onClick={() => setMessage((p) => `\n- ${p}`)} className="rounded p-1 hover:bg-[#EDEBE9]"><List size={13} /></button>
            </div>
          )}

          <div className="px-3 pt-2.5">
            <textarea
              ref={messageInputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder={`Reply directly to ${selectedName}...`}
              rows={1}
              className="min-h-[40px] max-h-32 w-full resize-none bg-transparent text-xs leading-relaxed text-[#242424] outline-none"
            />
          </div>

          <div className="flex items-center justify-between px-2 pb-2 pt-1 text-[#616161]">
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={() => setFormatActive((prev) => !prev)} className="rounded p-1.5 hover:bg-[#EDEBE9]"><Pencil size={15} /></button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded p-1.5 hover:bg-[#EDEBE9]"><Paperclip size={15} /></button>
              <button type="button" onClick={() => setShowEmojiPicker((prev) => !prev)} className="rounded p-1.5 hover:bg-[#EDEBE9]"><Smile size={15} /></button>
              <input ref={fileInputRef} type="file" multiple onChange={(e) => setSelectedFiles((prev) => [...prev, ...Array.from(e.target.files || [])])} className="hidden" />
            </div>

            <button type="submit" disabled={(!message.trim() && selectedFiles.length === 0) || sending} className="flex h-7 w-7 items-center justify-center rounded text-[#5B5FC7] hover:bg-[#EEF1FD] disabled:text-[#8A8886]">
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}