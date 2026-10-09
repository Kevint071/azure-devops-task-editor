// Page frame shared by every page: a centered landing hero (with a soft brand
// glow) that gives way to a compact title bar once the page has content.
import type { ReactNode } from "react";
import { cardClass } from "@/app/components/styles";

export function PageShell({
  isLanding,
  hasDock = false,
  width = "wide",
  children,
}: {
  isLanding: boolean;
  // Leaves room at the bottom for the floating ActionDock.
  hasDock?: boolean;
  width?: "wide" | "narrow";
  children: ReactNode;
}) {
  return (
    <div className="relative flex flex-1 justify-center overflow-x-clip bg-zinc-50 font-sans dark:bg-black">
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-130 bg-[radial-gradient(55%_60%_at_50%_0%,rgb(0_120_212/0.14),transparent)] transition-opacity duration-700 dark:bg-[radial-gradient(55%_60%_at_50%_0%,rgb(0_120_212/0.22),transparent)] ${
          isLanding ? "opacity-100" : "opacity-0"
        }`}
      />
      <main
        className={`relative flex w-full flex-col gap-6 px-4 sm:px-6 ${
          width === "wide" ? "max-w-7xl" : "max-w-3xl"
        } ${isLanding ? "pt-20 sm:pt-28" : "pt-8"} ${hasDock ? "pb-96" : "pb-16"}`}
      >
        {children}
      </main>
    </div>
  );
}

export interface PageHint {
  title: string;
  text: string;
}

export function PageHero({
  title,
  description,
  children,
  hints,
}: {
  title: string;
  description: ReactNode;
  children?: ReactNode;
  hints?: PageHint[];
}) {
  return (
    <header className="mx-auto flex w-full max-w-2xl animate-fade-up flex-col items-center text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl dark:text-zinc-50">
        {title}
      </h1>
      <p className="mt-4 max-w-xl text-base text-zinc-600 dark:text-zinc-400">{description}</p>
      {children && <div className="mt-10 flex w-full max-w-xl flex-col items-center">{children}</div>}
      {hints && hints.length > 0 && (
        <ul className="mt-10 grid w-full gap-3 text-left sm:grid-cols-3">
          {hints.map((hint, index) => (
            <li
              key={hint.title}
              className="animate-fade-up rounded-xl border border-zinc-200/80 bg-white/70 px-4 py-3 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/60"
              style={{ animationDelay: `${150 + index * 80}ms` }}
            >
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{hint.title}</p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint.text}</p>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}

export function PageBar({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex animate-fade-up flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{title}</h1>
      {children && <div className="w-full sm:w-80">{children}</div>}
    </header>
  );
}

export function LoadingCard() {
  return (
    <div aria-hidden="true" className={`flex animate-pulse flex-col gap-4 p-5 ${cardClass}`}>
      <div className="h-4 w-24 rounded-md bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-6 w-2/5 rounded-md bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-900" />
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} className="flex items-center gap-4">
          <div className="size-4 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 flex-1 rounded-md bg-zinc-200 dark:bg-zinc-800" />
          <div className="hidden h-6 w-24 rounded-full bg-zinc-200 sm:block dark:bg-zinc-800" />
          <div className="hidden h-6 w-32 rounded-md bg-zinc-200 md:block dark:bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}
