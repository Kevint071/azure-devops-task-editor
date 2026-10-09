"use client";

import { AlertIcon, SearchIcon, SpinnerIcon } from "@/app/components/icons";

// PBI id search field. Pages show the PBI summary themselves (PbiSummaryCard):
// "hero" is the large centered landing field, "compact" the one in the page bar.
export function PbiLookupBar({
  label = "PBI id",
  idPrefix = "pbi",
  size = "hero",
  placeholder,
  pbiId,
  onPbiIdChange,
  onLookup,
  isLookingUp,
  canLookUp,
  lookupError,
}: {
  label?: string;
  idPrefix?: string;
  size?: "hero" | "compact";
  placeholder?: string;
  pbiId: string;
  onPbiIdChange: (value: string) => void;
  onLookup: () => void;
  isLookingUp: boolean;
  canLookUp: boolean;
  lookupError: string | null;
}) {
  const isHero = size === "hero";
  return (
    <div className={`flex w-full flex-col gap-2 ${isHero ? "items-center" : ""}`}>
      <label htmlFor={`${idPrefix}-id`} className="sr-only">
        {label}
      </label>
      <div
        className={`flex w-full items-center gap-2 border border-zinc-200 bg-white transition-[border-color,box-shadow] duration-200 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15 dark:border-zinc-800 dark:bg-zinc-950 ${
          isHero
            ? "rounded-2xl p-2 pl-5 shadow-lg shadow-zinc-900/6 dark:shadow-black/40"
            : "rounded-xl p-1 pl-3 shadow-sm shadow-zinc-900/5"
        }`}
      >
        <SearchIcon className={`shrink-0 text-zinc-400 ${isHero ? "size-5" : "size-4"}`} />
        <input
          id={`${idPrefix}-id`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus={isHero}
          value={pbiId}
          onChange={(event) => onPbiIdChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && canLookUp) onLookup();
          }}
          placeholder={placeholder ?? (isHero ? "PBI id, e.g. 12345" : "Another PBI id")}
          className={`min-w-0 flex-1 bg-transparent text-zinc-950 outline-none placeholder:text-zinc-400 dark:text-zinc-50 ${
            isHero ? "py-2 text-lg" : "py-1 text-sm"
          }`}
        />
        {isHero && (
          <kbd className="hidden rounded-md border border-zinc-200 px-1.5 py-0.5 font-sans text-[11px] text-zinc-400 sm:inline dark:border-zinc-700">
            Enter
          </kbd>
        )}
        <button
          type="button"
          onClick={onLookup}
          disabled={!canLookUp}
          className={`inline-flex items-center gap-2 bg-brand font-semibold text-white transition hover:bg-brand-hover active:scale-[0.97] disabled:opacity-40 ${
            isHero ? "h-11 rounded-xl px-5 text-sm" : "h-8 rounded-lg px-3 text-xs"
          }`}
        >
          {isLookingUp && <SpinnerIcon className="size-4 animate-spin" />}
          {isLookingUp ? "Looking up" : "Look up"}
        </button>
      </div>
      {lookupError && (
        <p
          role="alert"
          className="flex animate-fade-up items-center gap-1.5 text-sm text-red-600 dark:text-red-400"
        >
          <AlertIcon className="size-4 shrink-0" />
          {lookupError}
        </p>
      )}
    </div>
  );
}
