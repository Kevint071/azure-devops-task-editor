import type { ReactNode } from "react";
import type { PbiSummary } from "@/lib/types";
import { shortPath } from "@/app/components/PathSelect";
import { StateBadge } from "@/app/components/StateBadge";
import { CalendarIcon, LayersIcon } from "@/app/components/icons";
import { cardClass } from "@/app/components/styles";

export function PbiSummaryCard({
  pbi,
  heading,
  action,
  size = "lg",
  children,
}: {
  pbi: PbiSummary;
  // Short context label above the card, e.g. "From" / "To" on Move Tasks.
  heading?: string;
  action?: ReactNode;
  size?: "lg" | "sm";
  children?: ReactNode;
}) {
  return (
    <section className={`animate-fade-up ${size === "lg" ? "p-5" : "p-4"} ${cardClass}`}>
      {heading && (
        <p className="mb-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">{heading}</p>
      )}
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand tabular-nums dark:text-sky-300">
              PBI {pbi.id}
            </span>
            <StateBadge state={pbi.state} />
          </div>
          <h2
            className={`mt-2 font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 ${
              size === "lg" ? "text-xl" : "text-base"
            }`}
          >
            {pbi.title}
          </h2>
          {(pbi.areaPath || pbi.iterationPath) && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              {pbi.areaPath && (
                <span className="inline-flex items-center gap-1.5" title={pbi.areaPath}>
                  <LayersIcon className="size-3.5" />
                  {shortPath(pbi.areaPath)}
                </span>
              )}
              {pbi.iterationPath && (
                <span className="inline-flex items-center gap-1.5" title={pbi.iterationPath}>
                  <CalendarIcon className="size-3.5" />
                  {shortPath(pbi.iterationPath)}
                </span>
              )}
            </div>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
