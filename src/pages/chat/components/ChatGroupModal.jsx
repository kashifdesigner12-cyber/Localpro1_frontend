import React, { useEffect, useMemo, useRef } from "react";
import { Check, Search, Users, X } from "lucide-react";

export default function ChatGroupModal({
  workspaceUsers = [],
  workspaceUsersMap = new Map(),
  isSelfUser,
  getDisplayName,
  getUserInitials,
  groupName,
  setGroupName,
  selectedGroupMembers = [],
  setSelectedGroupMembers,
  groupSearchQuery,
  setGroupSearchQuery,
  creatingGroup = false,
  handleCreateGroup,
  onClose,
}) {
  const nameInputRef = useRef(null);

  useEffect(() => {
    nameInputRef.current?.focus();
    const handleEscape = (event) => {
      if (event.key === "Escape" && !creatingGroup) onClose?.();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [creatingGroup, onClose]);

  const filteredUsers = useMemo(() => {
    const query = String(groupSearchQuery || "").trim().toLowerCase();

    return workspaceUsers.filter((member) => {
      if (typeof isSelfUser === "function" && isSelfUser(member)) return false;

      const name =
        typeof getDisplayName === "function"
          ? getDisplayName(member, workspaceUsersMap)
          : member?.name || member?.username || "";
      const email = member?.email || "";
      return (
        !query ||
        String(name).toLowerCase().includes(query) ||
        String(email).toLowerCase().includes(query)
      );
    });
  }, [
    workspaceUsers,
    workspaceUsersMap,
    groupSearchQuery,
    isSelfUser,
    getDisplayName,
  ]);

  const toggleMember = (id) => {
    if (typeof setSelectedGroupMembers !== "function") return;
    setSelectedGroupMembers((previous) =>
      previous.includes(id)
        ? previous.filter((memberId) => memberId !== id)
        : [...previous, id]
    );
  };

  const submit = (event) => {
    event.preventDefault();
    if (
      !String(groupName || "").trim() ||
      selectedGroupMembers.length === 0 ||
      creatingGroup ||
      typeof handleCreateGroup !== "function"
    ) {
      return;
    }
    handleCreateGroup(event);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !creatingGroup) onClose?.();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-group-modal-title"
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-[#5B5FC7]">
              <Users size={18} />
            </div>
            <div>
              <h2 id="chat-group-modal-title" className="text-sm font-bold text-gray-900">
                New Group Chat
              </h2>
              <p className="text-[11px] text-gray-500">Create a group with your workspace members</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={creatingGroup}
            aria-label="Close group dialog"
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
          >
            <X size={17} />
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 space-y-4 overflow-y-auto p-5">
            <div>
              <label htmlFor="chat-group-name" className="mb-1.5 block text-xs font-bold text-gray-700">
                Group name
              </label>
              <input
                ref={nameInputRef}
                id="chat-group-name"
                type="text"
                value={groupName || ""}
                onChange={(event) => setGroupName?.(event.target.value)}
                maxLength={80}
                placeholder="e.g. Project Delivery"
                required
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#5B5FC7] focus:ring-2 focus:ring-[#5B5FC7]/15"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor="chat-group-search" className="text-xs font-bold text-gray-700">
                  Add members
                </label>
                <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-[#5B5FC7]">
                  {selectedGroupMembers.length} selected
                </span>
              </div>

              <div className="mb-2 flex items-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-[#5B5FC7] focus-within:bg-white">
                <Search size={14} className="mr-2 shrink-0 text-gray-400" />
                <input
                  id="chat-group-search"
                  type="search"
                  value={groupSearchQuery || ""}
                  onChange={(event) => setGroupSearchQuery?.(event.target.value)}
                  placeholder="Search name or email..."
                  className="w-full bg-transparent text-xs text-gray-800 outline-none placeholder:text-gray-400"
                />
                {groupSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setGroupSearchQuery?.("")}
                    aria-label="Clear search"
                    className="ml-1 text-gray-400 hover:text-gray-700"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/60 p-2">
                {filteredUsers.length === 0 ? (
                  <p className="px-3 py-8 text-center text-xs text-gray-500">
                    No workspace members found.
                  </p>
                ) : (
                  filteredUsers.map((member) => {
                    const id = String(member?._id || member?.id || "");
                    if (!id) return null;

                    const selected = selectedGroupMembers.includes(id);
                    const name =
                      typeof getDisplayName === "function"
                        ? getDisplayName(member, workspaceUsersMap)
                        : member?.name || member?.username || "Team Member";
                    const initials =
                      typeof getUserInitials === "function"
                        ? getUserInitials(member, workspaceUsersMap)
                        : String(name).slice(0, 2).toUpperCase();

                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleMember(id)}
                        aria-pressed={selected}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border p-2.5 text-left transition ${
                          selected
                            ? "border-indigo-200 bg-indigo-50 text-indigo-900"
                            : "border-transparent text-gray-800 hover:border-gray-200 hover:bg-white"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-[10px] font-bold text-emerald-800">
                            {initials}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-bold">{name}</span>
                            <span className="block truncate text-[10px] capitalize text-gray-500">
                              {member?.role || "Member"}
                              {member?.department ? ` · ${member.department}` : ""}
                            </span>
                          </span>
                        </span>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                            selected
                              ? "border-[#5B5FC7] bg-[#5B5FC7] text-white"
                              : "border-gray-300 bg-white text-transparent"
                          }`}
                        >
                          <Check size={12} />
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 bg-white px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={creatingGroup}
              className="rounded-xl px-4 py-2.5 text-xs font-bold text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                !String(groupName || "").trim() ||
                selectedGroupMembers.length === 0 ||
                creatingGroup
              }
              className="rounded-xl bg-[#5B5FC7] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#4a4ea8] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
            >
              {creatingGroup ? "Creating..." : "Create Group"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
