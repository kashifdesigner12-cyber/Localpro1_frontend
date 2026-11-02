
import { ArrowRight } from "lucide-react";

export default function PageHeader({
  title,
  description,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
  eyebrow,
  children,
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-xs font-bold uppercase tracking-[1.8px] text-violet-600">
            {eyebrow}
          </p>
        )}

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h1>

        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-[15px]">
            {description}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {children}

        {actionLabel && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-violet-200 transition duration-200 hover:bg-violet-700 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-violet-100"
          >
            {ActionIcon ? (
              <ActionIcon size={18} />
            ) : (
              <ArrowRight size={17} />
            )}

            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
