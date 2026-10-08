"use client";

import { useMemo, useRef, useState } from "react";
import { submitPerTaskUpdates } from "@/lib/api-client";
import { usePbiLookup } from "@/lib/use-pbi-lookup";
import { useSessionInfo } from "@/lib/use-session-info";
import type { BulkTaskResult, PerTaskFieldUpdate, TaskItem } from "@/lib/types";
import { AssigneeCombobox } from "@/app/components/AssigneeCombobox";
import { PbiLookupBar } from "@/app/components/PbiLookupBar";
import { SettingsPrompt } from "@/app/components/SettingsPrompt";

// Pending, unsaved edits for one Task. Hours are kept as the raw input text so
// the field can be cleared while typing; empty means "unchanged".
interface TaskDraft {
  state?: string;
  assignedTo?: string;
  originalEstimate?: string;
  completedWork?: string;
}

interface SaveResult extends BulkTaskResult {
  title?: string;
}

const ORIGINAL_ESTIMATE_EDITABLE_STATES = new Set(["To Do", "Done"]);
const ORIGINAL_ESTIMATE_LOCKED_MESSAGE =
  "No se puede cambiar el Original Estimate: la tarea debe estar en To Do o Done.";

function canEditOriginalEstimate(state: string) {
  return ORIGINAL_ESTIMATE_EDITABLE_STATES.has(state);
}

function isInvalidHours(value: string | undefined) {
  if (value === undefined || value.trim() === "") return false;
  const parsed = Number(value);
  return !Number.isFinite(parsed) || parsed < 0;
}

function parseHours(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "" || isInvalidHours(value)) return undefined;
  return Number(value);
}

// Only the fields that actually differ from the Task's current values.
function buildUpdate(task: TaskItem, draft: TaskDraft | undefined): PerTaskFieldUpdate | null {
  if (!draft) return null;
  const update: PerTaskFieldUpdate = { id: task.id };

  if (draft.state && draft.state !== task.state) update.state = draft.state;
  if (draft.assignedTo && draft.assignedTo !== task.assignedToUniqueName) {
    update.assignedTo = draft.assignedTo;
  }
  const originalEstimate = parseHours(draft.originalEstimate);
  if (
    originalEstimate !== undefined &&
    originalEstimate !== task.originalEstimate &&
    canEditOriginalEstimate(task.state)
  ) {
    update.originalEstimate = originalEstimate;
  }
  const completedWork = parseHours(draft.completedWork);
  if (completedWork !== undefined && completedWork !== task.completedWork) {
    update.completedWork = completedWork;
  }

  return Object.keys(update).length > 1 ? update : null;
}

const UNASSIGNED_FILTER = "__unassigned__";

function matchesAssigneeFilter(task: TaskItem, filter: string) {
  if (filter === "") return true;
  if (filter === UNASSIGNED_FILTER) return !task.assignedToUniqueName;
  return task.assignedToUniqueName === filter;
}

const inputBaseClass =
  "w-full rounded border bg-white px-2 py-1 text-sm text-black dark:bg-zinc-900 dark:text-zinc-50";
const inputDefaultClass = "border-zinc-300 dark:border-zinc-700";
const inputChangedClass = "border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950";
const inputInvalidClass = "border-red-500 dark:border-red-700";

function cellInputClass(isChanged: boolean, isInvalid = false) {
  return `${inputBaseClass} ${
    isInvalid ? inputInvalidClass : isChanged ? inputChangedClass : inputDefaultClass
  }`;
}

export default function EditTasksPage() {
  const { isConfigured } = useSessionInfo();
  const {
    pbiId,
    setPbiId,
    lookedUpPbiId,
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

  const [drafts, setDrafts] = useState<Record<number, TaskDraft>>({});

  const [bulkState, setBulkState] = useState("");
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [bulkEstimate, setBulkEstimate] = useState("");
  const [bulkCompleted, setBulkCompleted] = useState("");
  const [fillNotice, setFillNotice] = useState<string | null>(null);

  const [taskColumnWidth, setTaskColumnWidth] = useState(260);
  const taskColumnResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const taskGridTemplateColumns = `28px minmax(${taskColumnWidth}px, 1fr) 130px 190px 90px 90px`;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [results, setResults] = useState<SaveResult[] | null>(null);

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

  const filteredTasks = useMemo(
    () => (tasks ? tasks.filter((task) => matchesAssigneeFilter(task, assigneeFilter)) : []),
    [tasks, assigneeFilter]
  );

  // Bulk fill only ever targets rows the user can see.
  const selectedVisibleTasks = useMemo(
    () => filteredTasks.filter((task) => selectedIds.has(task.id)),
    [filteredTasks, selectedIds]
  );

  const allSelected =
    filteredTasks.length > 0 && selectedVisibleTasks.length === filteredTasks.length;

  const pendingUpdates = useMemo(
    () =>
      tasks
        ? tasks
            .map((task) => buildUpdate(task, drafts[task.id]))
            .filter((update): update is PerTaskFieldUpdate => update !== null)
        : [],
    [tasks, drafts]
  );
  const pendingFieldCount = pendingUpdates.reduce(
    (count, update) => count + Object.keys(update).length - 1,
    0
  );
  const hiddenPendingCount = useMemo(() => {
    const visibleIds = new Set(filteredTasks.map((task) => task.id));
    return pendingUpdates.filter((update) => !visibleIds.has(update.id)).length;
  }, [filteredTasks, pendingUpdates]);

  const hasInvalidDraft = Object.values(drafts).some(
    (draft) => isInvalidHours(draft.originalEstimate) || isInvalidHours(draft.completedWork)
  );
  const canSave = pendingUpdates.length > 0 && !hasInvalidDraft && !isSubmitting;

  const hasBulkValue =
    bulkState !== "" || bulkAssignee !== "" || bulkEstimate !== "" || bulkCompleted !== "";
  const hasInvalidBulkHours = isInvalidHours(bulkEstimate) || isInvalidHours(bulkCompleted);
  const canFill = selectedVisibleTasks.length > 0 && hasBulkValue && !hasInvalidBulkHours;

  const failedById = useMemo(
    () =>
      new Map(
        (results ?? [])
          .filter((result) => !result.success)
          .map((result) => [result.id, result.error ?? "Failed"])
      ),
    [results]
  );

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

  function changeAssigneeFilter(filter: string) {
    setAssigneeFilter(filter);
    // Drop selections that the new filter hides, so nothing invisible stays selected.
    if (!tasks) return;
    const visibleIds = new Set(
      tasks.filter((task) => matchesAssigneeFilter(task, filter)).map((task) => task.id)
    );
    setSelectedIds((previous) => new Set(Array.from(previous).filter((id) => visibleIds.has(id))));
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

  function updateDraft(taskId: number, field: keyof TaskDraft, value: string) {
    setDrafts((previous) => ({
      ...previous,
      [taskId]: { ...previous[taskId], [field]: value },
    }));
  }

  function handleFillSelected() {
    if (!canFill) return;

    setDrafts((previous) => {
      const next = { ...previous };
      for (const task of selectedVisibleTasks) {
        const draft = { ...next[task.id] };
        if (bulkState !== "") draft.state = bulkState;
        if (bulkAssignee !== "") draft.assignedTo = bulkAssignee;
        if (bulkCompleted !== "") draft.completedWork = bulkCompleted;
        if (bulkEstimate !== "" && canEditOriginalEstimate(task.state)) {
          draft.originalEstimate = bulkEstimate;
        }
        next[task.id] = draft;
      }
      return next;
    });

    const skipped =
      bulkEstimate !== ""
        ? selectedVisibleTasks.filter((task) => !canEditOriginalEstimate(task.state)).length
        : 0;
    setFillNotice(
      skipped > 0
        ? `Original Estimate was not filled on ${skipped} Task(s) - only To Do or Done Tasks accept it.`
        : null
    );
    setBulkState("");
    setBulkAssignee("");
    setBulkEstimate("");
    setBulkCompleted("");
  }

  async function handleLookupAndReset() {
    if (
      pendingUpdates.length > 0 &&
      !window.confirm(`Discard unsaved changes on ${pendingUpdates.length} Task(s)?`)
    ) {
      return;
    }
    setSelectedIds(new Set());
    setAssigneeFilter("");
    setResults(null);
    setSubmitError(null);
    setDrafts({});
    setFillNotice(null);
    await handleLookup();
  }

  // Keeps unsaved drafts; only drops selections and drafts for Tasks that no longer exist.
  async function handleRefreshAndPrune() {
    const refreshedTasks = await handleRefresh();
    if (!refreshedTasks) return;
    const refreshedIds = new Set(refreshedTasks.map((task) => task.id));
    setSelectedIds((previous) => new Set(Array.from(previous).filter((id) => refreshedIds.has(id))));
    setDrafts((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([id]) => refreshedIds.has(Number(id))))
    );
  }

  async function handleSave() {
    if (!canSave || !tasks) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setResults(null);

    try {
      const titleById = new Map(tasks.map((task) => [task.id, task.title]));
      const response = await submitPerTaskUpdates("", pendingUpdates);
      setResults(response.results.map((result) => ({ ...result, title: titleById.get(result.id) })));

      // Failed Tasks keep their drafts so the user can fix and retry.
      const succeededIds = new Set(
        response.results.filter((result) => result.success).map((result) => result.id)
      );
      setDrafts((previous) =>
        Object.fromEntries(Object.entries(previous).filter(([id]) => !succeededIds.has(Number(id))))
      );
      await handleRefreshAndPrune();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unexpected error.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDiscard() {
    setDrafts({});
    setFillNotice(null);
  }

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          <header>
            <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Edit Tasks</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Look up a PBI and edit its child Tasks directly in the table, or select several and
              fill the same values on all of them. Nothing is sent to Azure DevOps until you save.
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
                  onClick={() => changeAssigneeFilter("")}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    assigneeFilter === ""
                      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                      : "border-zinc-300 text-zinc-700 hover:border-black dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-white"
                  }`}
                >
                  All ({tasks.length})
                </button>
                {assigneeFilterOptions.map((option) => {
                  const count = tasks.filter((task) => matchesAssigneeFilter(task, option.uniqueName)).length;
                  const isActive = assigneeFilter === option.uniqueName;
                  return (
                    <button
                      key={option.uniqueName}
                      type="button"
                      onClick={() => changeAssigneeFilter(isActive ? "" : option.uniqueName)}
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
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  ({selectedVisibleTasks.length} selected)
                </span>
              </div>

              <button
                type="button"
                onClick={handleRefreshAndPrune}
                disabled={isRefreshing || lookedUpPbiId === ""}
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
                  className="grid min-w-205 items-center gap-x-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
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

                <ul className="flex min-w-205 flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredTasks.map((task) => {
                    const draft = drafts[task.id];
                    const update = buildUpdate(task, draft);
                    const estimateEditable = canEditOriginalEstimate(task.state);
                    const rowError = failedById.get(task.id);
                    const stateOptions = taskStates.includes(task.state)
                      ? taskStates
                      : [task.state, ...taskStates];
                    const assigneeKnown = assignees.some(
                      (assignee) => assignee.uniqueName === task.assignedToUniqueName
                    );

                    return (
                      <li
                        key={task.id}
                        className={`grid gap-x-3 px-3 py-2 text-sm ${
                          update ? "bg-amber-50/40 dark:bg-amber-950/20" : ""
                        }`}
                        style={{ gridTemplateColumns: taskGridTemplateColumns }}
                      >
                        {/* h-full + min-h keeps every cell centered across the full row height, so short columns don't leave a gap next to a wrapped title */}
                        <div className="flex h-full min-h-8.5 items-center">
                          <input
                            type="checkbox"
                            aria-label={`Select task #${task.id}`}
                            checked={selectedIds.has(task.id)}
                            onChange={() => toggleTask(task.id)}
                          />
                        </div>
                        <div className="flex h-full min-h-8.5 min-w-0 flex-col justify-center">
                          <p className="min-w-0 whitespace-normal wrap-break-word font-medium text-black dark:text-zinc-50">
                            #{task.id} - {task.title}
                          </p>
                          {rowError && (
                            <p className="text-xs text-red-600 dark:text-red-400">{rowError}</p>
                          )}
                        </div>
                        <div className="flex h-full min-h-8.5 items-center">
                          <select
                            aria-label={`State for task #${task.id}`}
                            value={draft?.state ?? task.state}
                            onChange={(event) => updateDraft(task.id, "state", event.target.value)}
                            title={update?.state !== undefined ? `Was: ${task.state}` : undefined}
                            className={cellInputClass(update?.state !== undefined)}
                          >
                            {stateOptions.map((state) => (
                              <option key={state} value={state}>
                                {state}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex h-full min-h-8.5 items-center">
                          <select
                            aria-label={`Assignee for task #${task.id}`}
                            value={draft?.assignedTo || task.assignedToUniqueName || ""}
                            onChange={(event) => updateDraft(task.id, "assignedTo", event.target.value)}
                            title={
                              update?.assignedTo !== undefined
                                ? `Was: ${task.assignedTo ?? "Unassigned"}`
                                : undefined
                            }
                            className={cellInputClass(update?.assignedTo !== undefined)}
                          >
                            {!task.assignedToUniqueName && (
                              <option value="" disabled>
                                Unassigned
                              </option>
                            )}
                            {task.assignedToUniqueName && !assigneeKnown && (
                              <option value={task.assignedToUniqueName}>
                                {task.assignedTo ?? task.assignedToUniqueName}
                              </option>
                            )}
                            {assignees.map((assignee) => (
                              <option key={assignee.uniqueName} value={assignee.uniqueName}>
                                {assignee.displayName}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex h-full min-h-8.5 items-center">
                          <input
                            type="number"
                            min={0}
                            step="0.5"
                            aria-label={`Original Estimate for task #${task.id}`}
                            value={
                              estimateEditable
                                ? draft?.originalEstimate ?? String(task.originalEstimate ?? "")
                                : String(task.originalEstimate ?? "")
                            }
                            onChange={(event) =>
                              updateDraft(task.id, "originalEstimate", event.target.value)
                            }
                            disabled={!estimateEditable}
                            placeholder="—"
                            title={
                              !estimateEditable
                                ? ORIGINAL_ESTIMATE_LOCKED_MESSAGE
                                : update?.originalEstimate !== undefined
                                  ? `Was: ${task.originalEstimate ?? "—"}`
                                  : undefined
                            }
                            className={`${cellInputClass(
                              update?.originalEstimate !== undefined,
                              estimateEditable && isInvalidHours(draft?.originalEstimate)
                            )} disabled:cursor-not-allowed disabled:opacity-50`}
                          />
                        </div>
                        <div className="flex h-full min-h-8.5 items-center">
                          <input
                            type="number"
                            min={0}
                            step="0.5"
                            aria-label={`Completed Work for task #${task.id}`}
                            value={draft?.completedWork ?? String(task.completedWork ?? "")}
                            onChange={(event) =>
                              updateDraft(task.id, "completedWork", event.target.value)
                            }
                            placeholder="—"
                            title={
                              update?.completedWork !== undefined
                                ? `Was: ${task.completedWork ?? "—"}`
                                : undefined
                            }
                            className={cellInputClass(
                              update?.completedWork !== undefined,
                              isInvalidHours(draft?.completedWork)
                            )}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {tasks.length > 0 && (
              <>
                <div className="flex flex-col gap-3 rounded border border-zinc-200 p-3 dark:border-zinc-800">
                  <p className="text-sm font-medium text-black dark:text-zinc-50">
                    Fill selected Tasks ({selectedVisibleTasks.length})
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.4fr_100px_100px]">
                    <div className="flex flex-col gap-1">
                      <label htmlFor="bulk-state" className="text-xs text-zinc-600 dark:text-zinc-400">
                        State
                      </label>
                      <select
                        id="bulk-state"
                        value={bulkState}
                        onChange={(event) => setBulkState(event.target.value)}
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
                      <label htmlFor="bulk-assignee" className="text-xs text-zinc-600 dark:text-zinc-400">
                        Assignee
                      </label>
                      <AssigneeCombobox
                        id="bulk-assignee"
                        assignees={assignees}
                        value={bulkAssignee}
                        onChange={setBulkAssignee}
                        placeholder="(unchanged) - type a name…"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor="bulk-estimate" className="text-xs text-zinc-600 dark:text-zinc-400">
                        Estimate
                      </label>
                      <input
                        id="bulk-estimate"
                        type="number"
                        min={0}
                        step="0.5"
                        value={bulkEstimate}
                        onChange={(event) => setBulkEstimate(event.target.value)}
                        placeholder="—"
                        title="Only applies to Tasks in To Do or Done."
                        className={`${cellInputClass(false, isInvalidHours(bulkEstimate))} py-2`}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor="bulk-completed" className="text-xs text-zinc-600 dark:text-zinc-400">
                        Completed
                      </label>
                      <input
                        id="bulk-completed"
                        type="number"
                        min={0}
                        step="0.5"
                        value={bulkCompleted}
                        onChange={(event) => setBulkCompleted(event.target.value)}
                        placeholder="—"
                        className={`${cellInputClass(false, isInvalidHours(bulkCompleted))} py-2`}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleFillSelected}
                      disabled={!canFill}
                      className="h-9 rounded border border-black px-4 text-sm font-medium text-black disabled:opacity-40 dark:border-white dark:text-white"
                    >
                      Fill {selectedVisibleTasks.length} selected
                    </button>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Fills the table only - review the highlighted cells, then save.
                    </span>
                  </div>
                  {fillNotice && (
                    <p className="text-xs text-amber-700 dark:text-amber-400">{fillNotice}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!canSave}
                    className="h-10 rounded bg-black px-4 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
                  >
                    {isSubmitting
                      ? "Saving…"
                      : `Save changes (${pendingUpdates.length} Task(s), ${pendingFieldCount} field(s))`}
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscard}
                    disabled={Object.keys(drafts).length === 0 || isSubmitting}
                    className="h-10 rounded border border-zinc-300 px-4 text-sm font-medium text-black disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-50"
                  >
                    Discard
                  </button>
                  {hiddenPendingCount > 0 && (
                    <span className="text-xs text-amber-700 dark:text-amber-400">
                      {hiddenPendingCount} Task(s) with changes are hidden by the filter.
                    </span>
                  )}
                  {hasInvalidDraft && (
                    <span className="text-xs text-red-600 dark:text-red-400">
                      Hours must be numbers greater than or equal to 0.
                    </span>
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
                  #{result.id}
                  {result.title ? ` ${result.title}` : ""}:{" "}
                  {result.success ? "Updated" : `Failed - ${result.error}`}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
