const DONE_STATES = new Set(["done", "closed", "completed", "resolved"]);
const ACTIVE_STATES = new Set(["in progress", "active", "committed", "doing"]);
const REMOVED_STATES = new Set(["removed", "cut"]);

export function isDoneState(state: string) {
  return DONE_STATES.has(state.toLowerCase());
}

// Badge colors per work item state; unknown states stay neutral.
export function stateTone(state: string) {
  const key = state.toLowerCase();
  if (DONE_STATES.has(key)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300";
  }
  if (ACTIVE_STATES.has(key)) {
    return "border-brand/25 bg-brand/10 text-brand dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300";
  }
  if (REMOVED_STATES.has(key)) {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300";
  }
  return "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

export function StateBadge({ state }: { state: string }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${stateTone(state)}`}
    >
      {state}
    </span>
  );
}
