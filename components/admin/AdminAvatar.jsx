"use client";

export default function AdminAvatar({
  user,
  size = "md",
}) {
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-9 w-9 text-xs",
    lg: "h-12 w-12 text-sm",
  };

  const initials =
    user?.name
      ?.charAt(0)
      ?.toUpperCase() || "A";

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EEF4FF] font-bold text-[#2563EB] ${
        sizeClasses[size] || sizeClasses.md
      }`}
    >
      {user?.avatar ? (
        <img
          src={user.avatar}
          alt={user.name || "Administrator"}
          className="h-full w-full object-cover"
        />
      ) : (
        initials
      )}
    </div>
  );
}