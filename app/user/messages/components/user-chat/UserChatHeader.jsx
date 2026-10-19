"use strict";
import React from "react";
import { ArrowLeft, Search, MoreHorizontal, ShieldCheck, Pin, Bell, BellOff, X } from "lucide-react";

export function UserChatHeader({
  setSelectedConversation,
  selectedAvatar,
  selectedName,
  headerTab,
  setHeaderTab,
  showMessageSearch,
  setShowMessageSearch,
  messageSearch,
  setMessageSearch,
  menuOpen,
  setMenuOpen,
  togglePin,
  toggleMute,
  pinnedChats,
  mutedChats,
  selectedConversationId,
  getFileUrl,
  getInitials
}) {
  return (
    <header className="z-10 flex min-h-[58px] shrink-0 items-center justify-between border-b border-[#E1DFDD] bg-white px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={() => setSelectedConversation(null)}
          className="mr-1 rounded p-1.5 text-[#616161] hover:bg-[#EDEBE9] md:hidden"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#5B5FC7] text-xs font-bold text-white shadow-xs">
          {selectedAvatar ? <img src={getFileUrl(selectedAvatar)} alt="" className="h-full w-full object-cover" /> : getInitials(selectedName)}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-bold text-[#242424]">{selectedName}</h2>
            <span className="rounded bg-[#EEF1FD] px-1.5 py-0.5 text-[10px] font-semibold text-[#5B5FC7]">Verified Admin</span>
          </div>

          <div className="mt-1 flex items-center gap-4">
            {["chat", "files", "photos"].map((tabId) => (
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

      <div className="relative flex shrink-0 items-center gap-1 text-[#616161]">
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
            <button onClick={() => setShowMessageSearch(false)} className="rounded p-1 hover:bg-[#EDEBE9]"><X size={13} /></button>
          </div>
        )}
        <button onClick={() => setShowMessageSearch((prev) => !prev)} className="flex h-8 w-8 items-center justify-center rounded hover:bg-[#EDEBE9]">
          <Search size={16} />
        </button>
        <button onClick={() => setMenuOpen((prev) => !prev)} className="flex h-8 w-8 items-center justify-center rounded hover:bg-[#EDEBE9]">
          <MoreHorizontal size={18} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-10 z-40 w-52 rounded-md border border-[#E1DFDD] bg-white py-1.5 shadow-lg">
            <button onClick={() => togglePin()} className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#242424] hover:bg-[#F5F5F5]">
              <Pin size={14} className="text-[#5B5FC7]" /> {pinnedChats.includes(String(selectedConversationId)) ? "Unpin chat" : "Pin chat"}
            </button>
            <button onClick={() => toggleMute()} className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#242424] hover:bg-[#F5F5F5]">
              {mutedChats.includes(String(selectedConversationId)) ? <Bell size={14} /> : <BellOff size={14} />} Mute notifications
            </button>
          </div>
        )}
      </div>
    </header>
  );
}