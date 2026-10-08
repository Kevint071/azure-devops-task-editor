"use client";

import { useMemo, useState } from "react";
import { moveTasks } from "@/lib/api-client";
import { usePbiLookup } from "@/lib/use-pbi-lookup";
import { useSessionInfo } from "@/lib/use-session-info";
import { PbiLookupBar } from "@/app/components/PbiLookupBar";
import { SettingsPrompt } from "@/app/components/SettingsPrompt";
import type { BulkTaskResult } from "@/lib/types";

export default function MoveTasksPage() {
  const { isConfigured } = useSessionInfo();
  const source = usePbiLookup();
  const destination = usePbiLookup();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isMoving, setIsMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkTaskResult[] | null>(null);

  const tasks = source.tasks;

  const allSelected = useMemo(
    () => (tasks && tasks.length > 0 ? tasks.every((task) => selectedIds.has(task.id)) : false),
    [tasks, selectedIds]
  );

  const destinationId = Number(destination.pbiId.trim());
  const hasValidDestination =
    destination.pbiInfo !== null && Number.isFinite(destinationId) && destinationId !== source.pbiInfo?.id;
  const canMove = selectedIds.size > 0 && hasValidDestination && !isMoving;

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

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
        <header>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Move Tasks</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Look up a source PBI, select its child Tasks, then move them to a different PBI.
          </p>
        </header>

        {isConfigured ? (
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-sm font-semibold text-black dark:text-zinc-50">Source PBI</h2>
              <PbiLookupBar
                idPrefix="source-pbi"
                label="Source PBI id"
                pbiId={source.pbiId}
                onPbiIdChange={source.setPbiId}
                onLookup={handleLookupSource}
                isLookingUp={source.isLookingUp}
                canLookUp={source.canLookUp}
                pbiInfo={source.pbiInfo}
                lookupError={source.lookupError}
              />
            </section>

            <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-sm font-semibold text-black dark:text-zinc-50">Destination PBI</h2>
              <PbiLookupBar
                idPrefix="destination-pbi"
                label="Destination PBI id"
                pbiId={destination.pbiId}
                onPbiIdChange={destination.setPbiId}
                onLookup={destination.handleLookup}
                isLookingUp={destination.isLookingUp}
                canLookUp={destination.canLookUp}
                pbiInfo={destination.pbiInfo}
                lookupError={destination.lookupError}
              />
            </section>
          </div>
        ) : (
          <SettingsPrompt />
        )}

        {tasks && (
          <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <input id="select-all" type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                <label htmlFor="select-all" className="text-sm font-medium text-black dark:text-zinc-50">
                  Select all
                </label>
              </div>
              <button
                type="button"
                onClick={() => source.handleRefresh()}
                disabled={source.isRefreshing || !source.pbiId.trim()}
                className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium text-black disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-50"
              >
                {source.isRefreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            {tasks.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                This PBI has no child Tasks to move.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
                {tasks.map((task) => (
                  <li key={task.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(task.id)}
                      onChange={() => toggleTask(task.id)}
                    />
                    <span className="min-w-0 flex-1 wrap-break-word font-medium text-black dark:text-zinc-50">
                      #{task.id} - {task.title}
                    </span>
                    <span className="text-black dark:text-zinc-300">{task.state}</span>
                    <span className="text-black dark:text-zinc-300">{task.assignedTo ?? "Unassigned"}</span>
                  </li>
                ))}
              </ul>
            )}

            {tasks.length > 0 && (
              <>
                <div className="flex flex-col items-start gap-1">
                  <button
                    type="button"
                    onClick={handleMove}
                    disabled={!canMove}
                    className="h-10 rounded bg-black px-4 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
                  >
                    {isMoving ? "Moving…" : "Move selected Tasks"}
                  </button>
                  {selectedIds.size > 0 && !destination.pbiInfo && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Look up a destination PBI above to enable moving.
                    </p>
                  )}
                  {destination.pbiInfo && !hasValidDestination && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Destination must be a different PBI than the source.
                    </p>
                  )}
                </div>
              </>
            )}

            {moveError && <p className="text-sm text-red-600 dark:text-red-400">{moveError}</p>}
          </section>
        )}

        {results && (
          <section className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-medium text-black dark:text-zinc-50">Results</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {results.map((result) => (
                <li
                  key={result.id}
                  className={result.success ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}
                >
                  #{result.id}: {result.success ? "Moved" : `Failed - ${result.error}`}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
