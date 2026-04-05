import Link from "next/link";
import { ReactNode } from "react";

type TopbarProps = {
  title: string;
  actionLabel?: string;
  actionHref?: string;
  actionOnClick?: () => void;
  actions?: ReactNode;
  titleAdornment?: ReactNode;
  titlePrefix?: ReactNode;
};

export function Topbar({
  title,
  actionLabel,
  actionHref,
  actionOnClick,
  actions,
  titleAdornment,
  titlePrefix,
}: TopbarProps) {
  return (
    <div className="flex items-center justify-between border-b border-stone-200 bg-white px-8 py-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
          Nelo CRM
        </p>
        <div className="mt-2 flex items-center gap-3">
          {titlePrefix}
          <h1 className="text-2xl font-semibold tracking-tight text-stone-950">
            {title}
          </h1>
          {titleAdornment}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {actions}

        {actionLabel && actionHref ? (
          <Link
            href={actionHref}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
          >
            {actionLabel}
          </Link>
        ) : null}

        {actionLabel && !actionHref ? (
          <button
            type="button"
            onClick={actionOnClick}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
