import { cn } from "@/utils";

type Props = { page: number; total: number; onPageChange: (page: number) => void };

const btn =
  "flex h-9 min-w-9 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/3";

// Pages to show: first, last, current ±1, with null for a gap.
function pageList(page: number, total: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || Math.abs(p - page) <= 1) out.push(p);
    else if (out[out.length - 1] !== null) out.push(null);
  }
  return out;
}

export default function Pagination({ page, total, onPageChange }: Props) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3">
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </button>
      <div className="flex items-center gap-1">
        {pageList(page, total).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="px-2 text-sm text-gray-400">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "flex size-9 items-center justify-center rounded-lg text-sm font-medium",
                p === page
                  ? "bg-brand-500 text-white"
                  : "text-gray-700 hover:bg-brand-500/8 hover:text-brand-500 dark:text-gray-400",
              )}
            >
              {p}
            </button>
          ),
        )}
      </div>
      <button type="button" className={btn} disabled={page >= total} onClick={() => onPageChange(page + 1)}>
        Next
      </button>
    </div>
  );
}
