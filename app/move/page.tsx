"use client";

import { useMemo, useState } from "react";
import { moveTasks } from "@/lib/api-client";
import { usePbiLookup } from "@/lib/use-pbi-lookup";
import { useSessionInfo } from "@/lib/use-session-info";
import type { BulkTaskResult } from "@/lib/types";
import { Avatar } from "@/app/components/Avatar";
import { LoadingCard, PageBar, PageHero, PageShell } from "@/app/components/PageShell";
import { PbiLookupBar } from "@/app/components/PbiLookupBar";
import { PbiSummaryCard } from "@/app/components/PbiSummaryCard";
import { ResultBanner } from "@/app/components/ResultBanner";
import { SettingsPrompt } from "@/app/components/SettingsPrompt";
import { StateBadge } from "@/app/components/StateBadge";
import { AlertIcon, ArrowDownIcon, MoveIcon, RefreshIcon, SpinnerIcon } from "@/app/components/icons";
import { cardClass, primaryButtonClass, secondaryButtonClass } from "@/app/components/styles";

const MOVE_HINTS = [
  { title: "Pick the source", text: "Look up the PBI the Tasks are under." },
  { title: "Choose Tasks", text: "Select one or many from its list." },
  { title: "Pick the destination", text: "Look up the new parent PBI and move." },
];

export default function MoveTasksPage() {
  const { sessionInfo, isConfigured } = useSessionInfo();
  const source = usePbiLookup();
  const destination = usePbiLookup();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isMoving, setIsMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkTaskResult[] | null>(null);

  const tasks = source.tasks;
  const hasOpenSource = source.isLookingUp || tasks !== null;

  const allSelected = useMemo(
    () => (tasks && tasks.length > 0 ? tasks.every((task) => selectedIds.has(task.id)) : false),
    [tasks, selectedIds]
  );
  const someSelected = selectedIds.size > 0 && !allSelected;

  const destinationId = Number(destination.pbiId.trim());
  const hasValidDestination =
    destination.pbiInfo !== null && Number.isFinite(destinationId) && destinationId !== source.pbiInfo?.id;
  const canMove = selectedIds.size > 0 && hasValidDestination && !isMoving;

  const failedResults = (results ?? []).filter((result) => !result.success);
  const movedCount = (results ?? []).length - failedResults.length;

  async function handleLookupSource() {
    setSelectedIds(new Set());
    setResults(null);
    setMoveError(null);
    await source.handleLookup();
  }

  function toggleTask(id: number) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (!tasks || tasks.length === 0) return;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const task of tasks) {
        if (allSelected) {
          next.delete(task.id);
        } else {
          next.add(task.id);
        }
      }
      return next;
    });
  }

  async function handleMove() {
    if (!canMove) return;

    setIsMoving(true);
    setMoveError(null);
    setResults(null);

    try {
      const response = await moveTasks("", Array.from(selectedIds), destinationId);
      setResults(response.results);
      if (response.results.every((result) => result.success)) {
        setSelectedIds(new Set());
      }
      await source.handleRefresh();
    } catch (error) {
      setMoveError(error instanceof Error ? error.message : "Unexpected error.");
    } finally {
      setIsMoving(false);
    }
  }

  const sourceLookup = (size: "hero" | "compact") => (
    <PbiLookupBar
      size={size}
      idPrefix="source-pbi"
      label="Source PBI id"
      placeholder={size === "hero" ? "Source PBI id, e.g. 12345" : "Another source PBI id"}
      pbiId={source.pbiId}
      onPbiIdChange={source.setPbiId}
      onLookup={handleLookupSource}
      isLookingUp={source.isLookingUp}
      canLookUp={source.canLookUp}
      lookupError={source.lookupError}
    />
  );

  return (
    <PageShell isLanding={!hasOpenSource}>
      {hasOpenSource ? (
        <PageBar title="Move Tasks">{sourceLookup("compact")}</PageBar>
      ) : (
        <PageHero
          title="Move Tasks"
          description="Pick Tasks from one PBI and move them under another. Nothing moves until you confirm."
          hints={isConfigured ? MOVE_HINTS : undefined}
        >
          {sessionInfo && (isConfigured ? sourceLookup("hero") : <SettingsPrompt />)}
        </PageHero>
      )}

      {source.isLookingUp && <LoadingCard />}

      {results && (
        <ResultBanner
          tone={failedResults.length > 0 ? "error" : "success"}
          title={
            failedResults.length === 0
              ? `Moved ${movedCount} Task(s)`
              : `Moved ${movedCount} of ${results.length} Task(s)`
          }
          onDismiss={() => setResults(null)}
        >
          {failedResults.length === 0 ? (
            "They now sit under the destination PBI."
          ) : (
            <ul className="flex flex-col gap-0.5 text-red-700 dark:text-red-300">
              {failedResults.map((result) => (
                <li key={result.id}>
                  #{result.id}: {result.error}
                </li>
              ))}
            </ul>
          )}
        </ResultBanner>
      )}

      {source.pbiInfo && tasks && !source.isLookingUp && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-6">
            <PbiSummaryCard
              pbi={source.pbiInfo}
              heading="From"
              action={
                <button
                  type="button"
                  onClick={() => source.handleRefresh()}
                  disabled={source.isRefreshing || !source.pbiId.trim()}
                  className={secondaryButtonClass}
                >
                  <RefreshIcon className={`size-4 ${source.isRefreshing ? "animate-spin" : ""}`} />
                  {source.isRefreshing ? "Refreshing" : "Refresh"}
                </button>
              }
            />

            <section
              className={`animate-fade-up overflow-hidden ${cardClass}`}
              style={{ animationDelay: "80ms" }}
            >
              {tasks.length === 0 ? (
                <p className="px-6 py-14 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  This PBI has no child Tasks to move.
                </p>
              ) : (
                <>
                  <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-zinc-900 select-none dark:text-zinc-100">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(element) => {
                          if (element) element.indeterminate = someSelected;
                        }}
                        onChange={toggleSelectAll}
                        className="size-4 cursor-pointer accent-brand"
                      />
                      {selectedIds.size > 0
                        ? `${selectedIds.size} of ${tasks.length} selected`
                        : "Select all"}
                    </label>
                  </div>
                  <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
                    {tasks.map((task, index) => {
                      const isSelected = selectedIds.has(task.id);
                      return (
                        <li
                          key={task.id}
                          className="animate-fade-up"
                          style={{ animationDelay: `${120 + Math.min(index, 14) * 35}ms` }}
                        >
                          <label
                            className={`flex cursor-pointer items-center gap-3 px-4 py-3 text-sm transition-colors ${
                              isSelected
                                ? "bg-brand/5 dark:bg-brand/10"
                                : "hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleTask(task.id)}
                              className="size-4 shrink-0 cursor-pointer accent-brand"
                            />
                            <span className="min-w-0 flex-1 wrap-break-word text-zinc-900 dark:text-zinc-100">
                              <span className="mr-1.5 text-xs font-medium text-zinc-400 tabular-nums dark:text-zinc-500">
                                #{task.id}
                              </span>
                              <span className="font-medium">{task.title}</span>
                            </span>
                            <StateBadge state={task.state} />
                            <span className="hidden w-40 shrink-0 items-center gap-2 sm:flex">
                              <Avatar name={task.assignedTo} />
                              <span className="truncate text-zinc-600 dark:text-zinc-400">
                                {task.assignedTo ?? "Unassigned"}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>
          </div>

          <aside
            className={`flex animate-fade-up flex-col gap-4 p-4 lg:sticky lg:top-20 ${cardClass}`}
            style={{ animationDelay: "160ms" }}
          >
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand dark:text-sky-300">
                <MoveIcon className="size-4" />
              </span>
              <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">To</p>
            </div>

            <PbiLookupBar
              size="compact"
              idPrefix="destination-pbi"
              label="Destination PBI id"
              placeholder="Destination PBI id"
              pbiId={destination.pbiId}
              onPbiIdChange={destination.setPbiId}
              onLookup={destination.handleLookup}
              isLookingUp={destination.isLookingUp}
              canLookUp={destination.canLookUp}
              lookupError={destination.lookupError}
            />

            {destination.pbiInfo && !destination.isLookingUp && (
              <div className="flex animate-fade-up flex-col gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand tabular-nums dark:text-sky-300">
                    PBI {destination.pbiInfo.id}
                  </span>
                  <StateBadge state={destination.pbiInfo.state} />
                </div>
                <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {destination.pbiInfo.title}
                </p>
              </div>
            )}

            {selectedIds.size > 0 && hasValidDestination && (
              <p className="flex animate-fade-up items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <ArrowDownIcon className="size-4 shrink-0 text-brand dark:text-sky-300" />
                {selectedIds.size} Task(s) will move from PBI {source.pbiInfo.id} to PBI {destinationId}.
              </p>
            )}
            {selectedIds.size === 0 && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Select the Tasks to move first.</p>
            )}
            {selectedIds.size > 0 && !destination.pbiInfo && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Look up a destination PBI to enable moving.
              </p>
            )}
            {destination.pbiInfo && !hasValidDestination && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Destination must be a different PBI than the source.
              </p>
            )}

            <button
              type="button"
              onClick={handleMove}
              disabled={!canMove}
              className={`${primaryButtonClass} h-10 w-full`}
            >
              {isMoving ? <SpinnerIcon className="size-4 animate-spin" /> : <MoveIcon className="size-4" />}
              {isMoving ? "Moving" : `Move ${selectedIds.size} Task(s)`}
            </button>

            {moveError && (
              <p role="alert" className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
                <AlertIcon className="size-4 shrink-0" />
                {moveError}
              </p>
            )}
          </aside>
        </div>
      )}
    </PageShell>
  );
}
