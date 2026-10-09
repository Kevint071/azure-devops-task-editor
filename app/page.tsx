"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { useSessionInfo } from "@/lib/use-session-info";
import { PageHero, PageShell } from "@/app/components/PageShell";
import { ChevronRightIcon, MoveIcon, PencilIcon, PlusIcon } from "@/app/components/icons";
import { primaryButtonClass } from "@/app/components/styles";

const SECTIONS: {
  href: string;
  title: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  {
    href: "/create",
    title: "Create Tasks",
    description: "Stage new child Tasks for a PBI and create them all at once.",
    Icon: PlusIcon,
  },
  {
    href: "/edit",
    title: "Edit Tasks",
    description: "Change State, Assignee, Area, Iteration or hours of a PBI's Tasks in one table.",
    Icon: PencilIcon,
  },
  {
    href: "/move",
    title: "Move Tasks",
    description: "Pick Tasks from one PBI and move them under another.",
    Icon: MoveIcon,
  },
];

export default function Home() {
  const { sessionInfo, isConfigured } = useSessionInfo();

  return (
    <PageShell isLanding>
      <PageHero
        title="Azure DevOps Task Editor"
        description="Create, edit or move the child Tasks of a PBI in bulk, instead of opening them one by one."
      >
        {sessionInfo &&
          (isConfigured ? (
            <div className="inline-flex animate-fade-up flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-zinc-200 bg-white/80 py-1.5 pr-1.5 pl-4 text-sm shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/70">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-zinc-600 dark:text-zinc-400">
                Connected to{" "}
                <strong className="font-semibold text-zinc-950 dark:text-zinc-50">
                  {sessionInfo.org} / {sessionInfo.project}
                </strong>
              </span>
              <Link
                href="/settings"
                className="rounded-full px-3 py-1 text-xs font-medium text-brand transition hover:bg-brand/10 dark:text-sky-300"
              >
                Change
              </Link>
            </div>
          ) : (
            <div className="flex animate-fade-up flex-col items-center gap-3">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Start by connecting your Azure DevOps organization.
              </p>
              <Link href="/settings" className={`${primaryButtonClass} h-11 px-5`}>
                Connect in Settings
              </Link>
            </div>
          ))}
      </PageHero>

      <ul className="mx-auto mt-4 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        {SECTIONS.map(({ href, title, description, Icon }, index) => (
          // The entrance animation lives on the <li> so it doesn't override the card's hover lift.
          <li key={href} className="animate-fade-up" style={{ animationDelay: `${200 + index * 90}ms` }}>
            <Link
              href={href}
              className="group flex h-full flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-900/3 transition duration-200 hover:-translate-y-1 hover:border-brand/40 hover:shadow-xl hover:shadow-brand/10 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-sky-800"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors duration-200 group-hover:bg-brand group-hover:text-white dark:text-sky-300">
                <Icon className="size-5" />
              </span>
              <span className="flex flex-1 flex-col gap-1">
                <span className="text-base font-semibold text-zinc-950 dark:text-zinc-50">{title}</span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{description}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-brand dark:text-sky-300">
                Open
                <ChevronRightIcon className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
