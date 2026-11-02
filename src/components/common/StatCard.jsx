
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export default function StatCard({
  title,
  value = 0,
  description,
  icon: Icon,
  color = "violet",
  trend,
  trendLabel,
  onClick,
}) {
  const colors = {
    violet: {
      icon: "bg-violet-100 text-violet-700",
      accent: "bg-violet-500",
      ring: "group-hover:ring-violet-100",
    },
    blue: {
      icon: "bg-blue-100 text-blue-700",
      accent: "bg-blue-500",
      ring: "group-hover:ring-blue-100",
    },
    green: {
      icon: "bg-emerald-100 text-emerald-700",
      accent: "bg-emerald-500",
      ring: "group-hover:ring-emerald-100",
    },
    orange: {
      icon: "bg-orange-100 text-orange-700",
      accent: "bg-orange-500",
      ring: "group-hover:ring-orange-100",
    },
    rose: {
      icon: "bg-rose-100 text-rose-700",
      accent: "bg-rose-500",
      ring: "group-hover:ring-rose-100",
    },
    cyan: {
      icon: "bg-cyan-100 text-cyan-700",
      accent: "bg-cyan-500",
      ring: "group-hover:ring-cyan-100",
    },
  };

  const theme = colors[color] || colors.violet;

  const isClickable = typeof onClick === "function";

  const cardClass = `group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${theme.ring} ${
    isClickable ? "cursor-pointer" : ""
  }`;

  const content = (
    <>
      <div
        className={`absolute inset-x-0 top-0 h-1 ${theme.accent} opacity-0 transition group-hover:opacity-100`}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${theme.icon}`}
        >
          {Icon ? <Icon size={23} strokeWidth={1.9} /> : null}
        </div>
      </div>

      {(description || trend !== undefined) && (
        <div className="mt-4 flex min-h-5 flex-wrap items-center gap-2">
          {trend !== undefined && trend !== null && (
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                Number(trend) > 0
                  ? "text-emerald-600"
                  : Number(trend) < 0
                    ? "text-rose-600"
                    : "text-slate-500"
              }`}
            >
              {Number(trend) > 0 ? (
                <ArrowUpRight size={15} />
              ) : Number(trend) < 0 ? (
                <ArrowDownRight size={15} />
              ) : (
                <Minus size={14} />
              )}

              {Math.abs(Number(trend))}%
            </span>
          )}

          {trendLabel && (
            <span className="text-xs text-slate-400">{trendLabel}</span>
          )}

          {description && (
            <span className="text-xs text-slate-500">{description}</span>
          )}
        </div>
      )}
    </>
  );

  if (isClickable) {
    return (
      <button type="button" onClick={onClick} className={cardClass}>
        {content}
      </button>
    );
  }

  return <div className={cardClass}>{content}</div>;
}
