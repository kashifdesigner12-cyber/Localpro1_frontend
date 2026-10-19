"use strict";
import React from "react";
import { MessageSquare, FileText, Download, Maximize2, CornerUpLeft, Pencil, Trash2, Loader2, Eye, CheckCheck } from "lucide-react";

export function ChatMessages({
  visibleMessages,
  getMessageBody,
  getMessageId,
  getSenderId,
  getFileUrl,
  getInitials,
  getUserName,
  getUserAvatar,
  formatMessageTime,
  formatDayLabel,
  sameId,
  editingMessageId,
  setEditingMessageId,
  editDraft,
  setEditDraft,
  messageActionBusy,
  handleSaveEditedMessage,
  handleReactToMessage,
  handleDeleteMessage,
  setReplyingTo,
  messageInputRef,
  setPreviewPhotoUrl,
  messagesEndRef
}) {
  return (
    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-white px-4 py-5 sm:px-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        {visibleMessages.length === 0 ? (
          <div className="flex min-h-[300px] flex-1 flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF1FD] text-[#5B5FC7]">
              <MessageSquare size={26} />
            </div>
            <h3 className="text-sm font-bold text-[#242424]">No messages yet</h3>
          </div>
        ) : (
          visibleMessages.map((item, index) => {
            const sender = item?.sender;
            const isDeleted = Boolean(item?.isDeletedForEveryone);
            const body = isDeleted ? "This message was deleted." : getMessageBody(item);
            const isOwn = String(sender?.role || "").toLowerCase() === "admin" || sender?.name === "You" || item?.isOwn === true;
            const messageId = getMessageId(item);
            const isEditing = sameId(editingMessageId, messageId);
            const attachments = Array.isArray(item?.attachments) ? item.attachments : [];
            const previous = visibleMessages[index - 1];
            const showDay = !previous || formatDayLabel(item?.createdAt) !== formatDayLabel(previous?.createdAt);
            const replyInfo = item?.replyTo;

            return (
                <div key={`${messageId || "msg"}-${index}`} className="group relative">
                {showDay && (
                  <div className="my-4 flex items-center justify-center">
                    <span className="rounded-full bg-[#F5F5F5] px-3 py-1 text-[11px] font-semibold text-[#616161]">
                      {formatDayLabel(item?.createdAt)}
                    </span>
                  </div>
                )}
                <div className={`flex w-full items-start gap-2.5 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
                  <div className="mt-0.5 h-8 w-8 shrink-0">
                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#5B5FC7] text-[11px] font-bold text-white">
                      {isOwn ? "You" : getUserAvatar(sender) ? <img src={getFileUrl(getUserAvatar(sender))} alt="" className="h-full w-full object-cover" /> : getInitials(getUserName(sender))}
                    </div>
                  </div>
                  <div className={`relative max-w-[85%] sm:max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                    <div className="mb-1 flex items-center gap-2 px-1 text-[11px] text-[#616161]">
                      <span className="font-semibold text-[#242424]">{isOwn ? "You" : getUserName(sender)}</span>
                      <span>{formatMessageTime(item?.createdAt)}</span>
                    </div>

                    <div className={`relative rounded-xl px-4 py-2.5 text-xs shadow-2xs ${isDeleted ? "border bg-[#F5F5F5] italic text-[#8A8886]" : isOwn ? "border bg-[#EEF1FD] text-[#242424]" : "border bg-white text-[#242424]"}`}>
                      {replyInfo && !isDeleted && (
                        <div className="mb-2 border-l-2 border-[#5B5FC7] bg-[#EDEBE9]/40 pl-2.5 py-1 text-[11px]">
                          <p className="font-semibold text-[#5B5FC7]">{getUserName(replyInfo.sender) || "User"}</p>
                          <p className="line-clamp-2 text-[#616161]">{getMessageBody(replyInfo) || "Attachment"}</p>
                        </div>
                      )}

                      {isEditing ? (
                        <div className="flex min-w-[240px] flex-col gap-2">
                          <textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            rows={2}
                            className="w-full rounded border bg-white p-2 text-xs outline-none"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => setEditingMessageId(null)} className="rounded px-2.5 py-1 text-[11px]">Cancel</button>
                            <button disabled={messageActionBusy || !editDraft.trim()} onClick={() => handleSaveEditedMessage(item)} className="rounded bg-[#5B5FC7] px-3 py-1 text-[11px] text-white">Save</button>
                          </div>
                        </div>
                      ) : (
                        <>
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
                        </>
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