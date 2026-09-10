"use client";

import Link from "next/link";
import { useSessionInfo } from "@/lib/use-session-info";

const SECTIONS = [
  {
    href: "/create",
    title: "Create Tasks",
    description: "Stage new child Tasks for a PBI and create them all at once.",
  },
  {
    href: "/edit",
    title: "Edit Tasks",
    description: "Bulk-edit the State, Assignee or hours of a PBI's existing Tasks.",
  },
  {
    href: "/move",
    title: "Move Tasks",
    description: "Move selected Tasks from one PBI to a different PBI.",
  },
  {
    href: "/settings",
    title: "Settings",
    description: "Save your Personal Access Token, Organization and Project once.",
  },
];

export default function Home() {
  const { sessionInfo, isConfigured } = useSessionInfo();

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
        <header>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Azure DevOps Bulk Task Editor
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Create, edit, or move child Tasks of a PBI in Azure DevOps - in bulk.
          </p>
        </header>

        {sessionInfo && !isConfigured && (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
            Start in{" "}
            <Link
              href="/settings"
              className="font-medium text-black underline underline-offset-2 dark:text-zinc-50"
            >
              Settings
            </Link>{" "}
            to save your Personal Access Token, Organization and Project.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-4 hover:border-black dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-white"
            >
              <span className="text-base font-semibold text-black dark:text-zinc-50">
                {section.title}
              </span>
              <span className="text-sm text-zinc-600 dark:text-zinc-300">{section.description}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
