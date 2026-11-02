import React, { useCallback, useEffect, useId, useRef } from "react";
import { Users, UserPlus, MoreVertical, Trash2, X, LogOut, Bell } from "lucide-react";

export default function ChatHeader({
  activeConversation,
  activeOtherParticipant,
  isOtherOnline,
  activeChatTitle,
  getUserInitials,
  workspaceUsersMap,
  onOpenGroupModal,
  onOpenGroupInfo,
  onDeleteConversation,
  onLeaveGroup,
  showMenu,
  setShowMenu,
  notificationPermission,
  onRequestNotificationPermission,
}) {
  const menuRef = useRef(null);
  const menuId = useId();

  const conversationId =
    activeConversation?._id || activeConversation?.id || null;

  const isGroup = Boolean(activeConversation?.isGroup);

  const participantCount = Array.isArray(activeConversation?.participants)
    ? activeConversation.participants.length
    : 0;

  const title =
    activeChatTitle?.trim() || (isGroup ? "Team Group" : "Direct Chat");

  const initials = (() => {
    if (typeof getUserInitials !== "function") return "";

    try {
      return (
        getUserInitials(activeOtherParticipant, workspaceUsersMap) ||
        (title && title !== "Direct Chat"
          ? title.slice(0, 2).toUpperCase()
          : "DC")
      );
    } catch {
      return "DC";
    }
  })();

  const presenceInfo = (() => {
    if (isGroup) return null;
    if (!isOtherOnline) {
      return {
        badgeClass: "bg-gray-300 ring-2 ring-white h-2.5 w-2.5 rounded-full",
        dotClass: "bg-gray-300",
        label: "Offline",
      };
    }
    return {
      badgeClass: "bg-blue-500 ring-2 ring-white h-2.5 w-2.5 rounded-full",
      dotClass: "bg-blue-500",
      label: "Active now",
    };
  })();

  const closeMenu = useCallback(() => {
    setShowMenu?.(false);
  }, [setShowMenu]);

  useEffect(() => {
    if (!showMenu) return undefined;

    const handlePointerDown = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        closeMenu();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showMenu, closeMenu]);

  const handleToggleMenu = () => {
    setShowMenu?.((current) => !current);
  };

  const handleDelete = () => {
    closeMenu();

    if (
      conversationId &&
      typeof onDeleteConversation === "function"
    ) {
      onDeleteConversation(conversationId);
    }
  };

  const handleLeave = () => {
    closeMenu();
    if (conversationId && typeof onLeaveGroup === "function") {
      onLeaveGroup(conversationId);
    }
  };

  if (!activeConversation) return null;

  return (
    <header className="relative z-20 flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-2xs select-none sm:px-6">
      <div
        className={`flex min-w-0 items-center gap-3 ${
          isGroup && typeof onOpenGroupInfo === "function"
            ? "cursor-pointer rounded-xl p-1 -m-1 hover:bg-gray-50 transition"
            : ""
        }`}
        onClick={isGroup && typeof onOpenGroupInfo === "function" ? onOpenGroupInfo : undefined}
        title={isGroup ? "Click to view group members" : undefined}
      >
        <div className="relative shrink-0">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-xs shadow-xs ${
              isGroup
                ? "bg-purple-100 text-purple-700"
                : "bg-[#5B5FC7] text-white"
            }`}
          >
            {isGroup ? <Users size={18} /> : initials}
          </div>

          {!isGroup && presenceInfo && (
            <span
              className={`absolute bottom-0 right-0 ${presenceInfo.badgeClass}`}
              title={presenceInfo.label}
            />
          )}
        </div>

        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold leading-tight text-gray-900">
            {title}
          </h3>

          <p className="mt-0.5 truncate text-xs font-medium text-gray-500 flex items-center gap-1.5">
            {isGroup ? (
              `${participantCount} ${
                participantCount === 1 ? "member" : "members"
              } • View info`
            ) : isOtherOnline ? (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                <span className="text-blue-600 font-semibold">Active now</span>
              </>
            ) : (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-gray-300 shrink-0" />
                <span>Offline</span>
              </>
            )}
          </p>
        </div>
      </div>

      <div
        ref={menuRef}
        className="relative ml-3 flex shrink-0 items-center gap-2 text-gray-600"
      >
        {isGroup && typeof onOpenGroupInfo === "function" && (
          <button
            type="button"
            onClick={onOpenGroupInfo}
            className="flex items-center gap-1.5 rounded-lg bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 shadow-2xs transition hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-400/30"
            title="View group members"
          >
            <Users size={14} />
            <span className="hidden sm:inline">Members</span>
          </button>
        )}

        {notificationPermission === "default" && typeof onRequestNotificationPermission === "function" && (
          <button
            type="button"
            onClick={onRequestNotificationPermission}
            className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 shadow-2xs transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            title="Enable Windows desktop notifications for new messages"
          >
            <Bell size={13} className="text-amber-600" />
            <span className="hidden sm:inline">Enable Alerts</span>
          </button>
        )}

        {typeof onOpenGroupModal === "function" && (
          <button
            type="button"
            onClick={onOpenGroupModal}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-[#5B5FC7] shadow-2xs transition hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-[#5B5FC7]/30"
            title="Create new group chat"
          >
            <UserPlus size={14} />
            <span className="hidden sm:inline">New Group</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleToggleMenu}
          aria-label="Chat actions"
          aria-haspopup="menu"
          aria-expanded={Boolean(showMenu)}
          aria-controls={menuId}
          className="rounded-lg p-2 text-gray-600 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#5B5FC7]/30"
          title="More actions"
        >
          {showMenu ? <X size={18} /> : <MoreVertical size={18} />}
        </button>

        {showMenu && (
          <div
            id={menuId}
            role="menu"
            aria-label="Chat actions menu"
            className="absolute right-0 top-11 z-50 w-48 rounded-xl border border-gray-200 bg-white py-1.5 text-xs font-semibold shadow-lg"
          >
            {typeof onRequestNotificationPermission === "function" && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  onRequestNotificationPermission();
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-gray-700 transition hover:bg-gray-50 focus:outline-none"
              >
                <Bell size={14} className="text-[#5B5FC7]" />
                <span>
                  {notificationPermission === "granted"
                    ? "Desktop alerts active"
                    : "Enable desktop alerts"}
                </span>
              </button>
            )}

            {isGroup && typeof onOpenGroupInfo === "function" && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  onOpenGroupInfo();
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-gray-700 transition hover:bg-gray-50 focus:outline-none"
              >
                <Users size={14} className="text-purple-600" />
                <span>Group members</span>
              </button>
            )}

            {isGroup && typeof onLeaveGroup === "function" && (
              <button
                type="button"
                role="menuitem"
                onClick={handleLeave}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-gray-700 transition hover:bg-gray-50 focus:outline-none"
              >
                <LogOut size={14} className="text-gray-500" />
                <span>Leave group</span>
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={handleDelete}
              disabled={
                !conversationId ||
                typeof onDeleteConversation !== "function"
              }
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-red-600 transition hover:bg-red-50 focus:outline-none focus:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={14} />
              <span>{isGroup ? "Delete group" : "Delete chat history"}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
