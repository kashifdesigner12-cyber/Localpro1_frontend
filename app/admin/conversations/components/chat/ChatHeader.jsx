"use strict";
import React from "react";
import { ArrowLeft, Video, Phone, Search, MoreHorizontal, Users, CheckCheck, Pin, Bell, BellOff, Trash2, X } from "lucide-react";

export function ChatHeader({
  selectedConversationId,
  setSelectedConversationId,
  selectedAvatar,
  isSelectedGroup,
  selectedName,
  selectedStatus,
  headerTab,
  setHeaderTab,
  showMessageSearch,
  setShowMessageSearch,
  messageSearch,
  setMessageSearch,
  chatMenuOpen,
  setChatMenuOpen,
  handleMarkUnread,
  togglePin,
  pinnedChats,
  selectedKey,
  toggleMute,
  mutedChats,
  handleDeleteConversation,
  getFileUrl,
  getInitials,
  TeamsPresenceBadge
}) {
  return (
    <header className="z-10 flex min-h-[58px] shrink-0 items-center justify-between border-b border-[#E1DFDD] bg-white px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={() => setSelectedConversationId(null)}
          className="mr-1 rounded p-1.5 text-[#616161] hover:bg-[#EDEBE9] md:hidden"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#5B5FC7] text-xs font-bold text-white shadow-xs">
          {selectedAvatar ? (
            <img src={getFileUrl(selectedAvatar)} alt="" className="h-full w-full object-cover" />
          ) : isSelectedGroup ? (
            <Users size={17} />
          ) : (
            getInitials(selectedName)
          )}
          {!isSelectedGroup && <TeamsPresenceBadge status={selectedStatus} className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5" />}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-bold text-[#242424]">{selectedName || "Conversation"}</h2>
          </div>
          <div className="mt-1 flex items-center gap-4">
            {["chat", "files", "photos", ...(!isSelectedGroup ? ["profile"] : [])].map((tabId) => (
              <button
                key={tabId}
                onClick={() => setHeaderTab(tabId)}
                className={`relative pb-1 text-xs font-semibold capitalize transition ${headerTab === tabId ? "text-[#5B5FC7]" : "text-[#616161] hover:text-[#242424]"}`}
              >
                {tabId}
                {headerTab === tabId && <span className="absolute bottom-0 left-0 h-[2px] w-full bg-[#5B5FC7]" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative flex items-center gap-1 text-[#616161]">
        {showMessageSearch && (
          <div className="absolute right-0 top-12 z-30 flex w-72 items-center rounded border border-[#E1DFDD] bg-white p-1.5 shadow-lg">
            <Search size={14} className="ml-1 text-[#616161]" />
            <input
              autoFocus
              value={messageSearch}
              onChange={(e) => setMessageSearch(e.target.value)}
              placeholder="Search in chat..."
              className="min-w-0 flex-1 px-2 py-0.5 text-xs outline-none"
            />
            <button onClick={() => setShowMessageSearch(false)} className="rounded p-1 hover:bg-[#EDEBE9]">
              <X size={13} />
            </button>
          </div>
        )}
        <button onClick={() => setShowMessageSearch((prev) => !prev)} className="flex h-8 w-8 items-center justify-center rounded hover:bg-[#EDEBE9]" title="Search">
          <Search size={16} />
        </button>
        <button onClick={() => setChatMenuOpen((prev) => !prev)} className="flex h-8 w-8 items-center justify-center rounded hover:bg-[#EDEBE9]" title="Options">
          <MoreHorizontal size={18} />
        </button>

        {chatMenuOpen && (
          <div className="absolute right-0 top-10 z-40 w-56 rounded-md border border-[#E1DFDD] bg-white py-1.5 shadow-lg">
            <button onClick={handleMarkUnread} className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#242424] hover:bg-[#F5F5F5]">
              <CheckCheck size={14} className="text-[#5B5FC7]" /> Mark as unread
            </button>
            <button onClick={() => togglePin()} className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#242424] hover:bg-[#F5F5F5]">
              <Pin size={14} className="text-[#5B5FC7]" /> {pinnedChats.includes(selectedKey) ? "Unpin" : "Pin"}
            </button>
            <button onClick={handleDeleteConversation} className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#C4314B] hover:bg-[#FDF3F4]">
              <Trash2 size={14} /> Delete chat
            </button>
          </div>
        )}
      </div>
    </header>
  );
}