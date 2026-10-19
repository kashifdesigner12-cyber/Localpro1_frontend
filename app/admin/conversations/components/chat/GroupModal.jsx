"use strict";
import React from "react";
import { X, Loader2 } from "lucide-react";

export function GroupModal({
  showGroupModal,
  setShowGroupModal,
  groupName,
  setGroupName,
  selectedGroupMembers,
  setSelectedGroupMembers,
  creatingGroup,
  handleCreateGroup,
  users,
  getId,
  getUserName,
  getUserAvatar,
  getInitials,
  getFileUrl,
  sameId
}) {
  if (!showGroupModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <form
        onSubmit={handleCreateGroup}
        className="w-full max-w-md overflow-hidden rounded-lg border border-[#E1DFDD] bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#E1DFDD] px-5 py-3.5">
          <h3 className="text-sm font-bold text-[#242424]">New group chat</h3>
          <button
            type="button"
            onClick={() => setShowGroupModal(false)}
            className="text-[#616161] hover:text-[#242424]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#242424]">Group name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Field Operations, Support Team"
              required
              maxLength={60}
              className="h-8 w-full rounded border border-[#E1DFDD] px-3 text-xs outline-none focus:border-[#5B5FC7]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#242424]">
              Add members ({selectedGroupMembers.length} selected; choose at least 2)
            </label>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded border border-[#E1DFDD] p-2">
              {users.map((user) => {
                const userId = getId(user);
                if (!userId) return null;
                const isChecked = selectedGroupMembers.some((id) => sameId(id, userId));
                return (
                  <label
                    key={userId}
                    className="flex cursor-pointer items-center gap-2.5 rounded p-1.5 hover:bg-[#F5F5F5]"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) =>
                        setSelectedGroupMembers((prev) =>
                          e.target.checked
                            ? [...prev.filter((id) => !sameId(id, userId)), userId]
                            : prev.filter((id) => !sameId(id, userId))
                        )
                      }
                      className="h-3.5 w-3.5 rounded border-[#E1DFDD] text-[#5B5FC7] focus:ring-[#5B5FC7]"
                    />
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#5B5FC7] text-[10px] font-bold text-white">
                      {getUserAvatar(user) ? (
                        <img src={getFileUrl(getUserAvatar(user))} alt="" className="h-full w-full rounded-full object-cover" />
                      ) : (
                        getInitials(getUserName(user))
                      )}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-xs text-[#242424]">
                      {getUserName(user)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#E1DFDD] bg-[#F5F5F5] px-5 py-3">
          <button
            type="button"
            onClick={() => setShowGroupModal(false)}
            className="rounded border border-[#E1DFDD] bg-white px-3 py-1.5 text-xs font-semibold text-[#242424] hover:bg-[#EDEBE9]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={creatingGroup || !groupName.trim() || selectedGroupMembers.length < 2}
            className="flex items-center gap-1.5 rounded bg-[#5B5FC7] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#4F52B2] disabled:opacity-50"
          >
            {creatingGroup && <Loader2 size={13} className="animate-spin" />}
            {creatingGroup ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}