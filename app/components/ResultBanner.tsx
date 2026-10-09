import type { ReactNode } from "react";
import { AlertIcon, CheckIcon, XIcon } from "@/app/components/icons";

export function ResultBanner({
  tone,
  title,
  children,
  onDismiss,
}: {
  tone: "success" | "error";
  title: string;
  children?: ReactNode;
  onDismiss?: () => void;
}) {
  const isError = tone === "error";
  return (
    <section
      role={isError ? "alert" : "status"}
      className={`flex animate-fade-up items-start gap-3 rounded-2xl border p-4 ${
        isError
          ? "border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30"
          : "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30"
      }`}
    >
      <span
        className={`mt-0.5 flex size-7 shrink-0 animate-pop items-center justify-center rounded-full text-white ${
          isError ? "bg-red-500" : "bg-emerald-500"
        }`}
      >
        {isError ? <AlertIcon className="size-4" /> : <CheckIcon className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{title}</p>
        {children && <div className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="rounded-md p-1 text-zinc-500 transition hover:bg-black/5 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-zinc-100"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </section>
  );
}
