
import { LoaderCircle } from "lucide-react";

const variants = {
  primary:
    "bg-violet-600 text-white shadow-sm shadow-violet-200 hover:bg-violet-700 focus-visible:ring-violet-300",
  secondary:
    "bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:ring-slate-300",
  outline:
    "border border-slate-200 bg-white text-slate-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 focus-visible:ring-violet-300",
  danger:
    "bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus-visible:ring-rose-300",
  success:
    "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus-visible:ring-emerald-300",
  ghost:
    "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-300",
};

const sizes = {
  sm: "min-h-9 gap-1.5 rounded-lg px-3 py-2 text-xs",
  md: "min-h-11 gap-2 rounded-xl px-4 py-2.5 text-sm",
  lg: "min-h-12 gap-2 rounded-xl px-6 py-3 text-sm",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  type = "button",
  onClick,
  disabled = false,
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  className = "",
  fullWidth = false,
}) {
  const variantClass = variants[variant] || variants.primary;
  const sizeClass = sizes[size] || sizes.md;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center whitespace-nowrap font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50 ${variantClass} ${sizeClass} ${
        fullWidth ? "w-full" : ""
      } ${className}`}
    >
      {loading ? (
        <LoaderCircle size={17} className="animate-spin" />
      ) : Icon ? (
        <Icon size={17} />
      ) : null}

      {children}

      {!loading && IconRight && <IconRight size={17} />}
    </button>
  );
}
