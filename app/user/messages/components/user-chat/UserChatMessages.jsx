"use strict";
import React from "react";
import { MessageSquare, FileText, Download, Maximize2, CornerUpLeft, Loader2, Eye, CheckCheck } from "lucide-react";

export function UserChatMessages({
  visibleMessages,
  messagesLoading,
  selectedName,
  getMessageText,
  getMessageId,
  getUserId,
  getFileUrl,
  getInitials,
  formatMessageTime,
  formatDayLabel,
  sameId,
  currentUser,
  handleAddReaction,
  setReplyingTo,
  messageInputRef,
  setPreviewPhotoUrl,
  messagesEndRef
}) {
  return (
    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-white px-4 py-5 sm:px-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        {messagesLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[#5B5FC7]" />
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="flex min-h-[300px] flex-1 flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF1FD] text-[#5B5FC7]">
              <MessageSquare size={26} />
            </div>
            <h3 className="text-sm font-bold text-[#242424]">Official Admin Channel</h3>
            <p className="mt-1 max-w-xs text-xs text-[#616161]">
              All updates from your administration team will appear here. You can reply directly below.
            </p>
          </div>
        ) : (
          visibleMessages.map((item, index) => {
            const sender = item?.sender;
            const senderId = getUserId(sender);
            const myId = getUserId(currentUser);
            const isOwn = Boolean((senderId && myId && sameId(senderId, myId)) || sender?.name === "You" || String(sender?.role || "").toLowerCase() === "user");
            const msgId = getMessageId(item);
            const isDeleted = Boolean(item?.isDeletedForEveryone);
            const body = isDeleted ? "This message was deleted." : getMessageText(item);
            const attachments = Array.isArray(item?.attachments) ? item.attachments : [];
            const previous = visibleMessages[index - 1];
            const showDay = !previous || formatDayLabel(item?.createdAt) !== formatDayLabel(previous?.createdAt);
            const replyInfo = item?.replyTo;

            return (
              <div key={msgId || index} className="group relative">
                {showDay && (
                  <div className="my-4 flex items-center justify-center">
                    <span className="rounded-full bg-[#F5F5F5] px-3 py-1 text-[11px] font-semibold text-[#616161] shadow-2xs">
                      {formatDayLabel(item?.createdAt)}
                    </span>
                  </div>
                )}
                <div className={`flex w-full items-start gap-2.5 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
                  <div className="mt-0.5 h-8 w-8 shrink-0">
                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#5B5FC7] text-[11px] font-bold text-white shadow-2xs">
                      {isOwn ? "You" : getInitials(selectedName)}
                    </div>
                  </div>
                  <div className={`relative max-w-[85%] sm:max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                    <div className="mb-1 flex items-center gap-2 px-1 text-[11px] text-[#616161]">
                      <span className="font-semibold text-[#242424]">{isOwn ? "You" : selectedName}</span>
                      {!isOwn && <span className="rounded bg-[#EEF1FD] px-1 text-[10px] font-bold text-[#5B5FC7]">Admin</span>}
                      <span>{formatMessageTime(item?.createdAt)}</span>
                    </div>

                    <div className={`relative rounded-xl px-4 py-2.5 text-xs shadow-2xs ${isDeleted ? "border bg-[#F5F5F5] italic text-[#8A8886]" : isOwn ? "border bg-[#EEF1FD] text-[#242424]" : "border bg-white text-[#242424]"}`}>
                      {replyInfo && !isDeleted && (
                        <div className="mb-2 border-l-2 border-[#5B5FC7] bg-[#EDEBE9]/40 pl-2.5 py-1 text-[11px]">
                          <p className="font-semibold text-[#5B5FC7]">Admin Support</p>
                          <p className="line-clamp-2 text-[#616161]">{getMessageText(replyInfo) || "Attachment"}</p>
                        </div>
                      )}

                      {body && <p className="whitespace-pre-wrap break-words leading-relaxed">{body}</p>}
                      {attachments.length > 0 && !isDeleted && (
                        <div className={`flex flex-col gap-2 ${body ? "mt-2.5" : ""}`}>
                          {attachments.map((att, attIdx) => (
                            <div key={attIdx} onClick={() => setPreviewPhotoUrl(getFileUrl(att.url))} className="cursor-pointer overflow-hidden rounded-lg border">
                              <img src={getFileUrl(att.url)} alt="" className="max-h-72 max-w-full rounded object-contain" />
                            </div>
                          ))}
                        </div>
                      )}

                      {isOwn && !isDeleted && (
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#616161]">
                          {item?.sending ? <Loader2 size={11} className="animate-spin text-[#5B5FC7]" /> : <CheckCheck size={12} className="text-[#616161]" />}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}