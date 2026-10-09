// Shared Tailwind class strings so every page uses the same controls.

const fieldBaseClass =
  "w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-zinc-400 focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-50";
// Inline-edit look: borderless on the wide table until hovered or focused;
// bordered in the stacked card layout below xl.
const fieldInlineClass =
  "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 xl:border-transparent xl:bg-transparent xl:hover:border-zinc-200 xl:hover:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:xl:border-transparent dark:xl:bg-transparent dark:xl:hover:border-zinc-700 dark:xl:hover:bg-zinc-900";
const fieldBoxedClass =
  "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const fieldChangedClass =
  "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700/70 dark:bg-amber-950/50 dark:text-amber-50";
const fieldInvalidClass =
  "border-red-400 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/50 dark:text-red-100";

export function fieldClass(isChanged: boolean, isInvalid = false, boxed = false) {
  const tone = isInvalid
    ? fieldInvalidClass
    : isChanged
      ? fieldChangedClass
      : boxed
        ? fieldBoxedClass
        : fieldInlineClass;
  return `${fieldBaseClass} ${tone}`;
}

export const boxedFieldClass = fieldClass(false, false, true);

export const fieldLabelClass = "text-xs font-medium text-zinc-500 dark:text-zinc-400";

export const cardClass =
  "rounded-2xl border border-zinc-200 bg-white shadow-sm shadow-zinc-900/3 dark:border-zinc-800 dark:bg-zinc-950";

export const primaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white shadow-sm shadow-brand/30 transition hover:bg-brand-hover active:scale-[0.97] disabled:opacity-40 disabled:shadow-none";

export const secondaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.97] disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900";

export const ghostButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-35 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

export const darkButtonClass =
  "inline-flex h-8.5 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-700 active:scale-[0.97] disabled:opacity-35 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200";
