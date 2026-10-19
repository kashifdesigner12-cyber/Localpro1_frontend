"use strict";
import React from "react";
import { Search, Filter, ShieldCheck, Wifi, WifiOff, MessageSquare, Pin, BellOff, X, Loader2 } from "lucide-react";

export function UserChatSidebar({
  search,
  setSearch,
  chatFilter,
  setChatFilter,
  socketConnected,
  loading,
  filteredConversations,
  selectedConversationId,
  handleSelectConversation,
  getConversationId,
  getParticipantName,
  getParticipantAvatar,
  getInitials,
  getFileUrl,
  sameId,
  currentUser,
  formatConversationDate,
  pinnedChats,
  mutedChats
}) {
  return (
    <aside className={`flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-r border-[#E1DFDD] bg-[#F5F5F5] transition-all md:w-[340px] lg:w-[360px] xl:w-[380px] ${selectedConversationId ? "hidden md:flex" : "flex"}`}>
      {/* Header Bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#E1DFDD] bg-[#F5F5F5] px-4 py-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-[#242424]">Chat</h1>
          <span className="flex items-center gap-1 rounded bg-[#EEF1FD] px-1.5 py-0.5 text-[10px] font-semibold text-[#5B5FC7]">
            <ShieldCheck size={11} /> Admin Channels
          </span>
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${socketConnected ? "text-[#237B4B]" : "text-[#8A8886]"}`}>
            {socketConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
          </span>
        </div>

        <button
          onClick={() => setChatFilter((prev) => (prev === "all" ? "unread" : "all"))}
          className={`flex h-8 w-8 items-center justify-center rounded transition ${chatFilter === "unread" ? "bg-[#EDEBE9] text-[#5B5FC7]" : "text-[#616161] hover:bg-[#EDEBE9]"}`}
          title="Filter unread messages"
        >
          <Filter size={16} />
        </button>
      </div>

      {/* Search Box */}
      <div className="shrink-0 bg-[#F5F5F5] px-3 pb-2 pt-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#616161]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Admin messages"
            className="h-8 w-full rounded border border-[#E1DFDD] bg-white pl-8 pr-3 text-xs text-[#242424] outline-none focus:border-[#5B5FC7]"
          />
        </div>
      </div>

      {/* Chat List Items */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading && filteredConversations.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={22} className="animate-spin text-[#5B5FC7]" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="px-6 py-12 text-center text-[#616161]">
            <MessageSquare size={28} className="mx-auto mb-2 text-[#8A8886]" />
            <p className="text-xs font-semibold">No messages found</p>
          </div>
        ) : (
          <div className="py-1">
            <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#616161]">Official Communications</div>
            {filteredConversations.map((conv) => {
              const id = getConversationId(conv);
              const name = getParticipantName(conv, currentUser);
              const avatar = getParticipantAvatar(conv, currentUser);
              const isSelected = sameId(selectedConversationId, id);
              const unread = Number(conv.unreadCount || conv.unread || 0);

              return (
                <div
                  key={id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`group relative flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors ${isSelected ? "bg-white text-[#242424] shadow-xs" : "hover:bg-[#EDEBE9]"}`}
                >
                  {isSelected && <span className="absolute left-0 top-0 h-full w-[3px] bg-[#5B5FC7]" />}
                  <div className="relative h-9 w-9 shrink-0">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#5B5FC7] text-xs font-bold text-white shadow-xs">
                      {avatar ? <img src={getFileUrl(avatar)} alt="" className="h-full w-full object-cover" /> : getInitials(name)}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`truncate text-xs ${unread > 0 ? "font-bold text-[#242424]" : "text-[#242424]"}`}>{name}</span>
                      <span className="text-[10px] text-[#616161]">{formatConversationDate(conv.lastMessageAt || conv.updatedAt)}</span>
                    </div>
                    <p className={`truncate text-[11px] ${unread > 0 ? "font-bold text-[#242424]" : "text-[#616161]"}`}>
                      {conv.lastMessage || "Admin communication"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}