// Floating action bar pinned to the bottom of the window. `panel` expands above
// the main row (e.g. bulk-edit fields). Pages render it only when there is
// something to act on, and pass hasDock to PageShell to keep content visible.
import type { ReactNode } from "react";

export function ActionDock({ panel, children }: { panel?: ReactNode; children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3 sm:pb-5">
      <div className="pointer-events-auto w-full max-w-5xl animate-dock-in rounded-2xl border border-zinc-200/80 bg-white/90 shadow-2xl shadow-zinc-900/15 backdrop-blur-xl dark:border-zinc-700/70 dark:bg-zinc-900/90 dark:shadow-black/50">
        {panel && (
          <div className="animate-expand border-b border-zinc-200/80 p-4 dark:border-zinc-700/70">{panel}</div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4">{children}</div>
      </div>
    </div>
  );
}

// Count bubble that pops whenever the number changes.
export function CountBubble({ count }: { count: number }) {
  return (
    <span
      key={count}
      className="inline-flex h-7 min-w-7 animate-pop items-center justify-center rounded-full bg-brand px-2 text-xs font-semibold text-white tabular-nums"
    >
      {count}
    </span>
  );
}

// Pulsing amber dot for "unsaved changes".
export function PendingDot() {
  return (
    <span className="relative flex size-2">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
      <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
    </span>
  );
}
