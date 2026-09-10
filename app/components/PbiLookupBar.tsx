"use client";

import type { PbiSummary } from "@/lib/types";

export function PbiLookupBar({
  label = "PBI id",
  idPrefix = "pbi",
  pbiId,
  onPbiIdChange,
  onLookup,
  isLookingUp,
  canLookUp,
  pbiInfo,
  lookupError,
}: {
  label?: string;
  idPrefix?: string;
  pbiId: string;
  onPbiIdChange: (value: string) => void;
  onLookup: () => void;
  isLookingUp: boolean;
  canLookUp: boolean;
  pbiInfo: PbiSummary | null;
  lookupError: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={`${idPrefix}-id`} className="text-sm font-medium text-black dark:text-zinc-50">
            {label}
          </label>
          <input
            id={`${idPrefix}-id`}
            type="text"
            value={pbiId}
            onChange={(event) => onPbiIdChange(event.target.value)}
            placeholder="e.g. 12345"
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
        <button
          type="button"
          onClick={onLookup}
          disabled={!canLookUp}
          className="h-10 rounded bg-black px-4 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {isLookingUp ? "Looking up…" : "Look up"}
        </button>
      </div>

      {lookupError && <p className="text-sm text-red-600 dark:text-red-400">{lookupError}</p>}

      {pbiInfo && (
        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            PBI #{pbiInfo.id} · {pbiInfo.state}
          </p>
          <p className="text-base font-semibold text-black dark:text-zinc-50">{pbiInfo.title}</p>
        </div>
      )}
    </div>
  );
}
