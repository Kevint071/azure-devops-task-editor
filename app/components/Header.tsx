"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListChecksIcon } from "@/app/components/icons";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/create", label: "Create Tasks" },
  { href: "/edit", label: "Edit Tasks" },
  { href: "/move", label: "Move Tasks" },
  { href: "/settings", label: "Settings" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-lg text-sm font-semibold tracking-tight text-zinc-950 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none dark:text-zinc-50"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-brand text-white shadow-sm shadow-brand/30">
            <ListChecksIcon className="size-4" />
          </span>
          <span className="hidden sm:inline">Task Editor</span>
        </Link>

        {/* Scrolls sideways on narrow screens instead of wrapping onto a second line. */}
        <nav className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 py-1 scrollbar-none sm:justify-end">
          {NAV_LINKS.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none ${
                  isActive
                    ? "bg-brand/10 font-semibold text-brand dark:bg-sky-950/60 dark:text-sky-300"
                    : "font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
