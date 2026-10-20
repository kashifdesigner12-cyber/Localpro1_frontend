"use strict";
import React from "react";
import { Search, Filter, Pencil, Wifi, WifiOff, Users, MessageSquare, Pin, BellOff, X, Loader2 } from "lucide-react";

export function ChatSidebar({
  search,
  setSearch,
  chatFilter,
  setChatFilter,
  showNewChatDrawer,
  setShowNewChatDrawer,
  setShowGroupModal,
  loadingUsers,
  users,
  sortedConversations,
  pinnedConversations,
  recentConversations,
  peopleForList,
  selectedConversationId,
  openConversation,
  handleSelectUser,
  getConversationId,
  getUnreadCount,
  getConversationLastMessage,
  getConversationLastDate,
  formatConversationTime,
  getUserName,
  getUserAvatar,
  getInitials,
  getFileUrl,
  sameId,
  socketConnected,
  togglePin,
  mutedChats,
  onlineUsers,
  startingConversation,
  TeamsPresenceBadge
}) {
  return (
    <aside className="flex h-full w-full min-w-0 shrink-0 flex-col overflow-hidden border-r border-[#E1DFDD] bg-[#F5F5F5] transition-[width] duration-200 md:w-[300px] lg:w-[340px] xl:w-[360px]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#E1DFDD] bg-[#F5F5F5] px-4 py-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-[#242424]">Chat</h1>
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${socketConnected ? "text-[#237B4B]" : "text-[#8A8886]"}`}>
            {socketConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setChatFilter((prev) => (prev === "all" ? "unread" : "all"))}
            className={`flex h-8 w-8 items-center justify-center rounded transition ${chatFilter === "unread" ? "bg-[#EDEBE9] text-[#5B5FC7]" : "text-[#616161] hover:bg-[#EDEBE9]"}`}
            title="Filter unread"
          >
            <Filter size={16} />
          </button>
          <button
            onClick={() => setShowNewChatDrawer((prev) => !prev)}
            className="flex h-8 w-8 items-center justify-center rounded text-[#616161] hover:bg-[#EDEBE9] hover:text-[#5B5FC7]"
            title="New chat"
          >
            <Pencil size={17} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 bg-[#F5F5F5] px-3 pb-2 pt-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#616161]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="h-8 w-full rounded border border-[#E1DFDD] bg-white pl-8 pr-3 text-xs text-[#242424] outline-none focus:border-[#5B5FC7]"
          />
        </div>
      </div>

      {/* New Chat Drawer */}
      {showNewChatDrawer && (
        <div className="border-b border-[#E1DFDD] bg-white p-3 shadow-xs shrink-0">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-[#5B5FC7]">New chat</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowGroupModal(true); setShowNewChatDrawer(false); }}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#5B5FC7] hover:underline"
              >
                <Users size={12} /> Group
              </button>
              <button onClick={() => setShowNewChatDrawer(false)} className="text-[#616161]">
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {loadingUsers ? (
              <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-[#5B5FC7]" /></div>
            ) : users.map((user) => (
              <button
                key={user._id || user.id}
                onClick={() => { handleSelectUser(user); setShowNewChatDrawer(false); }}
                className="flex w-full items-center gap-2.5 rounded p-1.5 text-left text-xs hover:bg-[#F5F5F5]"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#5B5FC7] text-[11px] font-bold text-white shrink-0">
                  {getUserAvatar(user) ? <img src={getFileUrl(getUserAvatar(user))} alt="" className="h-full w-full rounded-full object-cover" /> : getInitials(getUserName(user))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[#242424]">{getUserName(user)}</p>
                  <p className="truncate text-[10px] text-[#616161]">{user.role || user.email}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* List - Scrollable container with hidden/clean scrollbar */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {pinnedConversations.length > 0 && (
          <div className="mb-2">
            <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#616161]">Pinned</div>
            {pinnedConversations.map((conv) => {
              const id = getConversationId(conv);
              const isGroup = Boolean(conv.isGroup);
              const other = conv.participants?.find((p) => p) || {};
              const name = isGroup ? conv.groupName || "Group chat" : getUserName(other);
              const avatar = isGroup ? conv.avatar : getUserAvatar(other);
              const isSelected = sameId(selectedConversationId, id);
              const unread = getUnreadCount(conv);

              return (
                <div
                  key={id}
                  onClick={() => openConversation(conv, isGroup ? null : other)}
                  className={`group relative flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors ${isSelected ? "bg-white shadow-xs" : "hover:bg-[#EDEBE9]"}`}
                >
                  {isSelected && <span className="absolute left-0 top-0 h-full w-[3px] bg-[#5B5FC7]" />}
                  <div className="relative h-9 w-9 shrink-0">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#5B5FC7] text-xs font-bold text-white">
                      {avatar ? <img src={getFileUrl(avatar)} alt="" className="h-full w-full object-cover" /> : isGroup ? <Users size={16} /> : getInitials(name)}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`truncate text-xs ${unread > 0 ? "font-bold text-[#242424]" : "text-[#242424]"}`}>{name}</span>
                      <span className="text-[10px] text-[#616161]">{formatConversationTime(getConversationLastDate(conv))}</span>
                    </div>
                    <p className="truncate text-[11px] text-[#616161]">{getConversationLastMessage(conv) || "Start a chat"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent Section */}
        <div>
          <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#616161]">Recent</div>
          {recentConversations.map((conv) => {
            const id = getConversationId(conv);
            const isGroup = Boolean(conv.isGroup);
            const other = conv.participants?.find((p) => p) || {};
            const name = isGroup ? conv.groupName || "Group chat" : getUserName(other);
            const avatar = isGroup ? conv.avatar : getUserAvatar(other);
            const isSelected = sameId(selectedConversationId, id);
            const unread = getUnreadCount(conv);
            const isOnline = Boolean(onlineUsers[String(other?._id || other?.id)] ?? other?.isOnline);

            return (
              <div
                key={id}
                onClick={() => openConversation(conv, isGroup ? null : other)}
                className={`group relative flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors ${isSelected ? "bg-white shadow-xs" : "hover:bg-[#EDEBE9]"}`}
              >
                {isSelected && <span className="absolute left-0 top-0 h-full w-[3px] bg-[#5B5FC7]" />}
                <div className="relative h-9 w-9 shrink-0">
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#5B5FC7] text-xs font-bold text-white">
                    {avatar ? <img src={getFileUrl(avatar)} alt="" className="h-full w-full object-cover" /> : isGroup ? <Users size={16} /> : getInitials(name)}
                  </div>
                  {!isGroup && <TeamsPresenceBadge status={isOnline ? "available" : "offline"} className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`truncate text-xs ${unread > 0 ? "font-bold text-[#242424]" : "text-[#242424]"}`}>{name}</span>
                    <span className="text-[10px] text-[#616161]">{formatConversationTime(getConversationLastDate(conv))}</span>
                  </div>
                  <p className="truncate text-[11px] text-[#616161]">{getConversationLastMessage(conv) || "Start a chat"}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}