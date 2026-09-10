"use client";

import { useMemo, useRef, useState } from "react";
import { submitBulkUpdate, submitPerTaskUpdates } from "@/lib/api-client";
import { usePbiLookup } from "@/lib/use-pbi-lookup";
import { useSessionInfo } from "@/lib/use-session-info";
import type { BulkTaskResult, PerTaskFieldUpdate } from "@/lib/types";
import { AssigneeCombobox } from "@/app/components/AssigneeCombobox";
import { PbiLookupBar } from "@/app/components/PbiLookupBar";
import { SettingsPrompt } from "@/app/components/SettingsPrompt";

interface HoursDraft {
  originalEstimate: string;
  completedWork: string;
}

const ORIGINAL_ESTIMATE_EDITABLE_STATES = new Set(["To Do", "Done"]);

function canEditOriginalEstimate(state: string) {
  return ORIGINAL_ESTIMATE_EDITABLE_STATES.has(state);
}

const UNASSIGNED_FILTER = "__unassigned__";

export default function EditTasksPage() {
  const { isConfigured } = useSessionInfo();
  const {
    pbiId,
    setPbiId,
    isLookingUp,
    isRefreshing,
    lookupError,
    pbiInfo,
    tasks,
    taskStates,
    assignees,
    canLookUp,
    handleLookup,
    handleRefresh,
  } = usePbiLookup();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [assigneeFilter, setAssigneeFilter] = useState("");

  const [stateValue, setStateValue] = useState("");
  const [assigneeValue, setAssigneeValue] = useState("");

  const [hoursAssignMode, setHoursAssignMode] = useState(false);
  const [hoursDrafts, setHoursDrafts] = useState<Record<number, HoursDraft>>({});

  const [taskColumnWidth, setTaskColumnWidth] = useState(280);
  const taskColumnResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const taskGridTemplateColumns = `28px minmax(${taskColumnWidth}px, 1fr) 100px 160px 100px 100px`;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkTaskResult[] | null>(null);

  const hasAnyFieldSet = stateValue !== "" || assigneeValue !== "";
  const canSubmit = selectedIds.size > 0 && hasAnyFieldSet && !isSubmitting;

  const assigneeFilterOptions = useMemo(() => {
    if (!tasks) return [];
    const byUniqueName = new Map<string, string>();
    let hasUnassigned = false;
    for (const task of tasks) {
      if (task.assignedToUniqueName) {
        byUniqueName.set(task.assignedToUniqueName, task.assignedTo ?? task.assignedToUniqueName);
      } else {
        hasUnassigned = true;
      }
    }
    const options = Array.from(byUniqueName.entries())
      .map(([uniqueName, displayName]) => ({ uniqueName, displayName }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    if (hasUnassigned) options.push({ uniqueName: UNASSIGNED_FILTER, displayName: "Unassigned" });
    return options;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    if (assigneeFilter === "") return tasks;
    if (assigneeFilter === UNASSIGNED_FILTER) return tasks.filter((task) => !task.assignedToUniqueName);
    return tasks.filter((task) => task.assignedToUniqueName === assigneeFilter);
  }, [tasks, assigneeFilter]);

  const allSelected = useMemo(
    () => (filteredTasks.length > 0 ? filteredTasks.every((task) => selectedIds.has(task.id)) : false),
    [filteredTasks, selectedIds]
  );

  const hasAnyHoursSet = useMemo(
    () =>
      tasks
        ? tasks.some((task) => {
            const draft = hoursDrafts[task.id];
            return draft !== undefined && (draft.originalEstimate !== "" || draft.completedWork !== "");
          })
        : false,
    [tasks, hoursDrafts]
  );
  const canSubmitHours = hoursAssignMode && hasAnyHoursSet && !isSubmitting;

  function handleTaskColumnResizeMove(event: MouseEvent) {
    const resizeState = taskColumnResizeRef.current;
    if (!resizeState) return;
    const delta = event.clientX - resizeState.startX;
    setTaskColumnWidth(Math.max(160, resizeState.startWidth + delta));
  }

  function handleTaskColumnResizeEnd() {
    taskColumnResizeRef.current = null;
    window.removeEventListener("mousemove", handleTaskColumnResizeMove);
    window.removeEventListener("mouseup", handleTaskColumnResizeEnd);
  }

  function handleTaskColumnResizeStart(event: React.MouseEvent) {
    event.preventDefault();
    taskColumnResizeRef.current = { startX: event.clientX, startWidth: taskColumnWidth };
    window.addEventListener("mousemove", handleTaskColumnResizeMove);
    window.addEventListener("mouseup", handleTaskColumnResizeEnd);
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
    if (filteredTasks.length === 0) return;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const task of filteredTasks) {
        if (allSelected) {
          next.delete(task.id);
        } else {
          next.add(task.id);
        }
      }
      return next;
    });
  }

  function toggleHoursAssignMode() {
    setHoursAssignMode((previous) => !previous);
    setHoursDrafts({});
  }

  function updateHoursDraft(taskId: number, field: keyof HoursDraft, value: string) {
    setHoursDrafts((previous) => ({
      ...previous,
      [taskId]: {
        originalEstimate: previous[taskId]?.originalEstimate ?? "",
        completedWork: previous[taskId]?.completedWork ?? "",
        [field]: value,
      },
    }));
  }

  async function handleLookupAndReset() {
    setSelectedIds(new Set());
    setAssigneeFilter("");
    setResults(null);
    setSubmitError(null);
    setHoursDrafts({});
    await handleLookup();
  }

  async function handleRefreshAndReset() {
    const refreshedTasks = await handleRefresh();
    if (refreshedTasks) {
      const refreshedIds = new Set(refreshedTasks.map((task) => task.id));
      setSelectedIds((previous) => new Set(Array.from(previous).filter((id) => refreshedIds.has(id))));
    }
    setHoursDrafts({});
  }

  async function handleSubmit() {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setResults(null);

    try {
      const fields = {
        ...(stateValue !== "" ? { state: stateValue } : {}),
        ...(assigneeValue !== "" ? { assignedTo: assigneeValue } : {}),
      };
      const response = await submitBulkUpdate("", Array.from(selectedIds), fields);
      setResults(response.results);
      if (response.results.every((result) => result.success)) {
        setStateValue("");
        setAssigneeValue("");
      }
      await handleRefreshAndReset();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unexpected error.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitHours() {
    if (!canSubmitHours || !tasks) return;

    const updates: PerTaskFieldUpdate[] = [];
    for (const task of tasks) {
      const draft = hoursDrafts[task.id];
      if (!draft) continue;

      const update: PerTaskFieldUpdate = { id: task.id };
      if (draft.originalEstimate !== "" && canEditOriginalEstimate(task.state)) {
        update.originalEstimate = Number(draft.originalEstimate);
      }
      if (draft.completedWork !== "") update.completedWork = Number(draft.completedWork);
      if (update.originalEstimate !== undefined || update.completedWork !== undefined) {
        updates.push(update);
      }
    }
    if (updates.length === 0) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setResults(null);

    try {
      const response = await submitPerTaskUpdates("", updates);
      setResults(response.results);
      await handleRefreshAndReset();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unexpected error.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          <header>
            <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Edit Tasks</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Look up a PBI, select its child Tasks, and apply the same State or Assignee to all of
              them at once - or set Original Estimate and Completed Work per Task.
            </p>
          </header>

          {isConfigured ? (
            <PbiLookupBar
              pbiId={pbiId}
              onPbiIdChange={setPbiId}
              onLookup={handleLookupAndReset}
              isLookingUp={isLookingUp}
              canLookUp={canLookUp}
              pbiInfo={pbiInfo}
              lookupError={lookupError}
            />
          ) : (
            <SettingsPrompt />
          )}
        </div>

        {tasks && (
          <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            {assigneeFilterOptions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Filter by assignee:
                </span>
                <button
                  type="button"
                  onClick={() => setAssigneeFilter("")}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    assigneeFilter === ""
                      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                      : "border-zinc-300 text-zinc-700 hover:border-black dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-white"
                  }`}
                >
                  All ({tasks.length})
                </button>
                {assigneeFilterOptions.map((option) => {
                  const count = tasks.filter((task) =>
                    option.uniqueName === UNASSIGNED_FILTER
                      ? !task.assignedToUniqueName
                      : task.assignedToUniqueName === option.uniqueName
                  ).length;
                  const isActive = assigneeFilter === option.uniqueName;
                  return (
                    <button
                      key={option.uniqueName}
                      type="button"
                      onClick={() => setAssigneeFilter(isActive ? "" : option.uniqueName)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        isActive
                          ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                          : "border-zinc-300 text-zinc-700 hover:border-black dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-white"
                      }`}
                    >
                      {option.displayName} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    id="select-all"
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium text-black dark:text-zinc-50">
                    Select all
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="hours-assign-mode"
                    type="checkbox"
                    checked={hoursAssignMode}
                    onChange={toggleHoursAssignMode}
                  />
                  <label
                    htmlFor="hours-assign-mode"
                    className="text-sm font-medium text-black dark:text-zinc-50"
                  >
                    Assign hours per task
                  </label>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRefreshAndReset}
                disabled={isRefreshing || !pbiId.trim()}
                className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium text-black disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-50"
              >
                {isRefreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            {tasks.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                This PBI has no child Tasks yet - use Create Tasks to add one.
              </p>
            ) : (
              <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
                <div
                  className="grid min-w-[720px] items-center gap-x-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                  style={{ gridTemplateColumns: taskGridTemplateColumns }}
                >
                  <span />
                  <span className="relative pr-2">
                    Task
                    {/* drag handle to resize the Task column like an Excel column border */}
                    <div
                      onMouseDown={handleTaskColumnResizeStart}
                      className="absolute -right-1 top-1/2 z-10 h-4 w-2 -translate-y-1/2 cursor-col-resize select-none rounded hover:bg-zinc-400 dark:hover:bg-zinc-500"
                    />
                  </span>
                  <span>State</span>
                  <span>Assignee</span>
                  <span>Estimate</span>
                  <span>Completed</span>
                </div>

                {filteredTasks.length === 0 && (
                  <p className="px-3 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                    No Tasks match this assignee filter.
                  </p>
                )}

                <ul className="flex min-w-[720px] flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredTasks.map((task) => (
                    <li
                      key={task.id}
                      className="grid gap-x-3 px-3 py-2 text-sm"
                      style={{ gridTemplateColumns: taskGridTemplateColumns }}
                    >
                      {/* h-full + min-h keeps every cell centered across the full row height, so short columns don't leave a gap next to a wrapped title */}
                      <div className="flex h-full min-h-[34px] items-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(task.id)}
                          onChange={() => toggleTask(task.id)}
                        />
                      </div>
                      <div className="flex h-full min-h-[34px] min-w-0 items-center">
                        <p className="min-w-0 whitespace-normal break-words font-medium text-black dark:text-zinc-50">
                          #{task.id} - {task.title}
                        </p>
                      </div>
                      <div className="flex h-full min-h-[34px] items-center">
                        <p className="truncate text-black dark:text-zinc-300">{task.state}</p>
                      </div>
                      <div className="flex h-full min-h-[34px] items-center">
                        <p className="truncate text-black dark:text-zinc-300">
                          {task.assignedTo ?? "Unassigned"}
                        </p>
                      </div>
                      <div className="flex h-full min-h-[34px] items-center">
                        {hoursAssignMode ? (
                          <>
                            <label
                              className="sr-only"
                              htmlFor={`estimate-${task.id}`}
                              title={
                                canEditOriginalEstimate(task.state)
                                  ? undefined
                                  : "No se puede cambiar el Original Estimate: la tarea debe estar en To Do o Done."
                              }
                            >
                              New estimate for task #{task.id}
                            </label>
                            <input
                              id={`estimate-${task.id}`}
                              type="number"
                              min={0}
                              step="0.5"
                              value={hoursDrafts[task.id]?.originalEstimate ?? ""}
                              onChange={(event) =>
                                updateHoursDraft(task.id, "originalEstimate", event.target.value)
                              }
                              disabled={!canEditOriginalEstimate(task.state)}
                              placeholder={String(task.originalEstimate ?? "—")}
                              title={
                                canEditOriginalEstimate(task.state)
                                  ? undefined
                                  : "No se puede cambiar el Original Estimate: la tarea debe estar en To Do o Done."
                              }
                              className={`w-full rounded border px-2 py-1 text-sm text-black disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-900 dark:text-zinc-50 ${
                                canEditOriginalEstimate(task.state)
                                  ? "border-zinc-300 bg-white dark:border-zinc-700"
                                  : "border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950"
                              }`}
                            />
                          </>
                        ) : (
                          <p className="text-black dark:text-zinc-300">{task.originalEstimate ?? "—"}</p>
                        )}
                      </div>
                      <div className="flex h-full min-h-[34px] items-center">
                        {hoursAssignMode ? (
                          <>
                            <label className="sr-only" htmlFor={`worked-${task.id}`}>
                              New worked hours for task #{task.id}
                            </label>
                            <input
                              id={`worked-${task.id}`}
                              type="number"
                              min={0}
                              step="0.5"
                              value={hoursDrafts[task.id]?.completedWork ?? ""}
                              onChange={(event) =>
                                updateHoursDraft(task.id, "completedWork", event.target.value)
                              }
                              placeholder={String(task.completedWork ?? "—")}
                              className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                            />
                          </>
                        ) : (
                          <p className="text-black dark:text-zinc-300">{task.completedWork ?? "—"}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tasks.length > 0 && (
              <>
                <div className="grid grid-cols-1 gap-4 border-t border-zinc-200 pt-4 sm:grid-cols-2 dark:border-zinc-800">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="state" className="text-sm font-medium text-black dark:text-zinc-50">
                      State
                    </label>
                    <select
                      id="state"
                      value={stateValue}
                      onChange={(event) => setStateValue(event.target.value)}
                      className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    >
                      <option value="">(unchanged)</option>
                      {taskStates.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="assignee" className="text-sm font-medium text-black dark:text-zinc-50">
                      Assignee
                    </label>
                    <AssigneeCombobox
                      id="assignee"
                      assignees={assignees}
                      value={assigneeValue}
                      onChange={setAssigneeValue}
                      placeholder="(unchanged) - type a name…"
                    />
                  </div>
                </div>

                {hoursAssignMode && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Fill in the Est / Worked inputs next to each Task above, then apply - each Task
                    keeps its own values instead of receiving the same one.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="h-10 rounded bg-black px-4 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
                  >
                    {isSubmitting ? "Applying…" : "Apply to selected Tasks"}
                  </button>

                  {hoursAssignMode && (
                    <button
                      type="button"
                      onClick={handleSubmitHours}
                      disabled={!canSubmitHours}
                      className="h-10 rounded border border-black px-4 text-sm font-medium text-black disabled:opacity-40 dark:border-white dark:text-white"
                    >
                      {isSubmitting ? "Applying…" : "Apply hours per task"}
                    </button>
                  )}
                </div>

                {submitError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
                )}
              </>
            )}
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
                  #{result.id}: {result.success ? "Updated" : `Failed - ${result.error}`}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
