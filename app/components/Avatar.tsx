// Initials avatar with a color derived from the name, so a person keeps the
// same color everywhere on the page. A null name renders an "unassigned" ring.
const TONES = [
  "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200",
  "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200",
];

function initials(name: string) {
  const parts = name.split(/[\s._@-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

function toneFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}

export function Avatar({ name, size = "sm" }: { name: string | null; size?: "xs" | "sm" }) {
  const sizeClass = size === "xs" ? "size-5 text-[9px]" : "size-7 text-[11px]";

  if (!name) {
    return (
      <span
        aria-hidden="true"
        className={`${sizeClass} inline-flex shrink-0 rounded-full border border-dashed border-zinc-300 dark:border-zinc-600`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      title={name}
      className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${toneFor(name)}`}
    >
      {initials(name)}
    </span>
  );
}
