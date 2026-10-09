"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { submitPerTaskUpdates } from "@/lib/api-client";
import { usePbiLookup } from "@/lib/use-pbi-lookup";
import { useSessionInfo } from "@/lib/use-session-info";
import type { BulkTaskResult, PerTaskFieldUpdate, TaskItem } from "@/lib/types";
import { ActionDock, CountBubble, PendingDot } from "@/app/components/ActionDock";
import { AssigneeCombobox } from "@/app/components/AssigneeCombobox";
import { Avatar } from "@/app/components/Avatar";
import { LoadingCard, PageBar, PageHero, PageShell } from "@/app/components/PageShell";
import { PbiLookupBar } from "@/app/components/PbiLookupBar";
import { PbiSummaryCard } from "@/app/components/PbiSummaryCard";
import { PathSelect, areaOptions, iterationOptions } from "@/app/components/PathSelect";
import { ResultBanner } from "@/app/components/ResultBanner";
import { SettingsPrompt } from "@/app/components/SettingsPrompt";
import { isDoneState, stateTone } from "@/app/components/StateBadge";
import { AlertIcon, CheckIcon, ChevronUpIcon, RefreshIcon, SpinnerIcon } from "@/app/components/icons";
import {
  boxedFieldClass,
  cardClass,
  darkButtonClass,
  fieldClass,
  ghostButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/app/components/styles";

// Pending, unsaved edits for one Task. Hours are kept as the raw input text so
// the field can be cleared while typing; empty means "unchanged".
interface TaskDraft {
  state?: string;
  assignedTo?: string;
  originalEstimate?: string;
  completedWork?: string;
  areaPath?: string;
  iterationPath?: string;
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
  if (draft.areaPath && draft.areaPath !== task.areaPath) update.areaPath = draft.areaPath;
  if (draft.iterationPath && draft.iterationPath !== task.iterationPath) {
    update.iterationPath = draft.iterationPath;
  }

  return Object.keys(update).length > 1 ? update : null;
}

const UNASSIGNED_FILTER = "__unassigned__";

function matchesAssigneeFilter(task: TaskItem, filter: string) {
  if (filter === "") return true;
  if (filter === UNASSIGNED_FILTER) return !task.assignedToUniqueName;
  return task.assignedToUniqueName === filter;
}

const EDIT_HINTS = [
  { title: "Edit in place", text: "Click any cell to change it." },
  { title: "Fill many at once", text: "Select rows, set values once." },
  { title: "Save once", text: "Review highlighted changes first." },
];

function formatHours(hours: number) {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}

// One table cell. Below xl the header row is hidden, so each cell shows its own label.
function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-1 xl:h-full xl:min-h-9">
      <span className="text-xs font-medium text-zinc-500 xl:hidden dark:text-zinc-400">{label}</span>
      {children}
    </div>
  );
}

function BulkField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function EditTasksPage() {
  const { sessionInfo, isConfigured } = useSessionInfo();
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
    areas,
    iterations,
    canLookUp,
    handleLookup,
    handleRefresh,
  } = usePbiLookup();
  const teamAreaOptions = useMemo(() => areaOptions(areas), [areas]);
  const teamIterationOptions = useMemo(() => iterationOptions(iterations), [iterations]);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [assigneeFilter, setAssigneeFilter] = useState("");

  const [drafts, setDrafts] = useState<Record<number, TaskDraft>>({});

  const [bulkState, setBulkState] = useState("");
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [bulkEstimate, setBulkEstimate] = useState("");
  const [bulkCompleted, setBulkCompleted] = useState("");
  const [bulkArea, setBulkArea] = useState("");
  const [bulkIteration, setBulkIteration] = useState("");
  const [isBulkCollapsed, setIsBulkCollapsed] = useState(false);
  const [fillNotice, setFillNotice] = useState<string | null>(null);

  const [taskColumnWidth, setTaskColumnWidth] = useState(260);
  const taskColumnResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const taskGridTemplateColumns = `28px minmax(${taskColumnWidth}px, 1fr) 140px 190px 140px 180px 80px 90px`;

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
  const someSelected = selectedVisibleTasks.length > 0 && !allSelected;

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
    bulkState !== "" ||
    bulkAssignee !== "" ||
    bulkEstimate !== "" ||
    bulkCompleted !== "" ||
    bulkArea !== "" ||
    bulkIteration !== "";
  const hasInvalidBulkHours = isInvalidHours(bulkEstimate) || isInvalidHours(bulkCompleted);
  const canFill = selectedVisibleTasks.length > 0 && hasBulkValue && !hasInvalidBulkHours;
  // The dock appears only when there is something to act on.
  const showActionBar =
    tasks !== null &&
    tasks.length > 0 &&
    (selectedVisibleTasks.length > 0 || pendingUpdates.length > 0 || submitError !== null);
  const isBulkPanelOpen = selectedVisibleTasks.length > 0 && !isBulkCollapsed;
  // Landing (centered hero) until a lookup starts; a failed lookup goes back to it.
  const hasOpenPbi = isLookingUp || tasks !== null;

  const failedById = useMemo(
    () =>
      new Map(
        (results ?? [])
          .filter((result) => !result.success)
          .map((result) => [result.id, result.error ?? "Failed"])
      ),
    [results]
  );

  const totals = useMemo(() => {
    if (!tasks) return null;
    let estimate = 0;
    let completed = 0;
    let done = 0;
    for (const task of tasks) {
      estimate += task.originalEstimate ?? 0;
      completed += task.completedWork ?? 0;
      if (isDoneState(task.state)) done += 1;
    }
    return { estimate, completed, done };
  }, [tasks]);
  const donePercent =
    tasks && totals && tasks.length > 0 ? Math.round((totals.done / tasks.length) * 100) : 0;

  function assigneeName(uniqueName: string | null | undefined, fallback: string | null) {
    if (!uniqueName) return fallback;
    return assignees.find((assignee) => assignee.uniqueName === uniqueName)?.displayName ?? fallback;
  }

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
        if (bulkArea !== "") draft.areaPath = bulkArea;
        if (bulkIteration !== "") draft.iterationPath = bulkIteration;
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
    setBulkArea("");
    setBulkIteration("");
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

  const failedResults = (results ?? []).filter((result) => !result.success);
  const savedCount = (results ?? []).length - failedResults.length;

  const lookupBar = (size: "hero" | "compact") => (
    <PbiLookupBar
      size={size}
      pbiId={pbiId}
      onPbiIdChange={setPbiId}
      onLookup={handleLookupAndReset}
      isLookingUp={isLookingUp}
      canLookUp={canLookUp}
      lookupError={lookupError}
    />
  );

  return (
    <PageShell isLanding={!hasOpenPbi} hasDock={showActionBar}>
      {hasOpenPbi ? (
        <PageBar title="Edit Tasks">{lookupBar("compact")}</PageBar>
      ) : (
        <PageHero
          title="Edit Tasks"
          description="Look up a PBI and change its Tasks right in the table, or select several and fill them at once. Nothing reaches Azure DevOps until you save."
          hints={isConfigured ? EDIT_HINTS : undefined}
        >
          {sessionInfo && (isConfigured ? lookupBar("hero") : <SettingsPrompt />)}
        </PageHero>
      )}

      {isLookingUp && <LoadingCard />}

      {pbiInfo && tasks && !isLookingUp && (
        <PbiSummaryCard
          pbi={pbiInfo}
          action={
            <button
              type="button"
              onClick={handleRefreshAndPrune}
              disabled={isRefreshing || lookedUpPbiId === ""}
              className={secondaryButtonClass}
            >
              <RefreshIcon className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Refreshing" : "Refresh"}
            </button>
          }
        >
          {tasks.length > 0 && totals && (
            <div className="mt-5 flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">
                  <strong className="font-semibold text-zinc-950 tabular-nums dark:text-zinc-50">
                    {totals.done} of {tasks.length}
                  </strong>{" "}
                  Tasks done
                </span>
                <span className="text-zinc-500 tabular-nums dark:text-zinc-400">
                  {formatHours(totals.completed)} completed of {formatHours(totals.estimate)} estimated
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full origin-left animate-grow-x rounded-full bg-emerald-500 transition-[width] duration-700 ease-out"
                  style={{ width: `${donePercent}%` }}
                />
              </div>
            </div>
          )}
        </PbiSummaryCard>
      )}

      {results && (
        <ResultBanner
          tone={failedResults.length > 0 ? "error" : "success"}
          title={
            failedResults.length === 0
              ? `Saved ${savedCount} Task(s)`
              : `Saved ${savedCount} of ${results.length} Task(s)`
          }
          onDismiss={() => setResults(null)}
        >
          {failedResults.length === 0 ? (
            "All changes are in Azure DevOps."
          ) : (
            <ul className="flex flex-col gap-0.5 text-red-700 dark:text-red-300">
              {failedResults.map((result) => (
                <li key={result.id}>
                  #{result.id}
                  {result.title ? ` ${result.title}` : ""}: {result.error}
                </li>
              ))}
            </ul>
          )}
        </ResultBanner>
      )}

      {tasks && !isLookingUp && (
        <section
          className={`animate-fade-up overflow-hidden ${cardClass}`}
          style={{ animationDelay: "80ms" }}
        >
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <p className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                This PBI has no child Tasks yet
              </p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Add some first, then come back to edit them here.
              </p>
              <Link href="/create" className={`mt-4 ${primaryButtonClass}`}>
                Create Tasks
              </Link>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
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
                  {selectedVisibleTasks.length > 0
                    ? `${selectedVisibleTasks.length} of ${filteredTasks.length} selected`
                    : "Select all"}
                </label>

                {assigneeFilterOptions.length > 0 && (
                  <div
                    role="group"
                    aria-label="Filter by assignee"
                    className="flex flex-wrap items-center gap-1.5 sm:ml-auto"
                  >
                    <button
                      type="button"
                      onClick={() => changeAssigneeFilter("")}
                      aria-pressed={assigneeFilter === ""}
                      className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                        assigneeFilter === ""
                          ? "border-brand bg-brand text-white"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      }`}
                    >
                      All
                      <span className={assigneeFilter === "" ? "text-white/75" : "text-zinc-400"}>
                        {tasks.length}
                      </span>
                    </button>
                    {assigneeFilterOptions.map((option) => {
                      const count = tasks.filter((task) =>
                        matchesAssigneeFilter(task, option.uniqueName)
                      ).length;
                      const isActive = assigneeFilter === option.uniqueName;
                      const isUnassigned = option.uniqueName === UNASSIGNED_FILTER;
                      return (
                        <button
                          key={option.uniqueName}
                          type="button"
                          onClick={() => changeAssigneeFilter(isActive ? "" : option.uniqueName)}
                          aria-pressed={isActive}
                          className={`inline-flex h-7 items-center gap-1.5 rounded-full border pr-3 pl-1 text-xs font-medium transition-colors ${
                            isActive
                              ? "border-brand bg-brand text-white"
                              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                          }`}
                        >
                          <Avatar name={isUnassigned ? null : option.displayName} size="xs" />
                          {option.displayName}
                          <span className={isActive ? "text-white/75" : "text-zinc-400"}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div
                className="group/header hidden items-center gap-x-3 border-b border-zinc-200 bg-zinc-50/70 px-4 py-2.5 text-xs font-medium text-zinc-500 xl:grid dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400"
                style={{ gridTemplateColumns: taskGridTemplateColumns }}
              >
                <span />
                <span className="relative">
                  Task
                  {/* drag handle to resize the Task column like an Excel column border */}
                  <div
                    onMouseDown={handleTaskColumnResizeStart}
                    title="Drag to resize"
                    className="absolute top-1/2 -right-2 z-10 h-5 w-1.5 -translate-y-1/2 cursor-col-resize rounded-full bg-zinc-300 opacity-0 transition-opacity select-none group-hover/header:opacity-70 hover:opacity-100 dark:bg-zinc-600"
                  />
                </span>
                <span className="pl-1">State</span>
                <span className="pl-9">Assignee</span>
                <span className="pl-2.5">Area</span>
                <span className="pl-2.5">Iteration</span>
                <span className="pr-2.5 text-right">Estimate</span>
                <span className="pr-2.5 text-right">Completed</span>
              </div>

              {filteredTasks.length === 0 && (
                <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
                  No Tasks match this assignee filter.
                </p>
              )}

              <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
                {filteredTasks.map((task, index) => {
                  const draft = drafts[task.id];
                  const update = buildUpdate(task, draft);
                  const estimateEditable = canEditOriginalEstimate(task.state);
                  const rowError = failedById.get(task.id);
                  const isSelected = selectedIds.has(task.id);
                  const currentState = draft?.state ?? task.state;
                  const stateOptions = taskStates.includes(task.state)
                    ? taskStates
                    : [task.state, ...taskStates];
                  const assigneeKnown = assignees.some(
                    (assignee) => assignee.uniqueName === task.assignedToUniqueName
                  );
                  const currentAssigneeName = draft?.assignedTo
                    ? assigneeName(draft.assignedTo, task.assignedTo)
                    : task.assignedTo;

                  return (
                    <li
                      key={task.id}
                      className={`relative flex animate-fade-up flex-col gap-3 px-4 py-4 text-sm transition-colors xl:grid xl:items-center xl:gap-x-3 xl:py-2 ${
                        isSelected
                          ? "bg-brand/5 dark:bg-brand/10"
                          : "xl:hover:bg-zinc-50/80 dark:xl:hover:bg-zinc-900/40"
                      } ${
                        update
                          ? "before:absolute before:inset-y-0 before:left-0 before:w-0.75 before:origin-top before:animate-grow-y before:bg-amber-400 before:content-['']"
                          : ""
                      }`}
                      style={{
                        gridTemplateColumns: taskGridTemplateColumns,
                        animationDelay: `${120 + Math.min(index, 14) * 35}ms`,
                      }}
                    >
                      {/* xl:contents puts these cells straight on the table grid; below xl they stack as a card. */}
                      <div className="flex items-start gap-3 xl:contents">
                        <div className="flex pt-0.5 xl:h-full xl:min-h-9 xl:items-center xl:pt-0">
                          <input
                            type="checkbox"
                            aria-label={`Select task #${task.id}`}
                            checked={isSelected}
                            onChange={() => toggleTask(task.id)}
                            className="size-4 cursor-pointer accent-brand"
                          />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 xl:h-full xl:min-h-9">
                          <p className="min-w-0 wrap-break-word text-zinc-900 dark:text-zinc-100">
                            <span className="mr-1.5 text-xs font-medium text-zinc-400 tabular-nums dark:text-zinc-500">
                              #{task.id}
                            </span>
                            <span className="font-medium">{task.title}</span>
                            {update && (
                              <span className="ml-2 inline-block animate-pop rounded-full bg-amber-100 px-1.5 py-px align-middle text-[11px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                                Edited
                              </span>
                            )}
                          </p>
                          {rowError && (
                            <p className="flex animate-fade-up items-center gap-1 text-xs text-red-600 dark:text-red-400">
                              <AlertIcon className="size-3.5 shrink-0" />
                              {rowError}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pl-7 sm:grid-cols-3 lg:grid-cols-[1fr_1.4fr_1fr_1.3fr_0.6fr_0.6fr] xl:contents">
                        <Cell label="State">
                          <select
                            aria-label={`State for task #${task.id}`}
                            value={currentState}
                            onChange={(event) => updateDraft(task.id, "state", event.target.value)}
                            title={update?.state !== undefined ? `Was: ${task.state}` : undefined}
                            className={`w-full cursor-pointer rounded-full border px-3 py-1 text-xs font-medium outline-none transition focus:ring-2 focus:ring-brand/30 ${stateTone(currentState)} ${
                              update?.state !== undefined
                                ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-white dark:ring-offset-zinc-950"
                                : ""
                            }`}
                          >
                            {stateOptions.map((state) => (
                              <option key={state} value={state}>
                                {state}
                              </option>
                            ))}
                          </select>
                        </Cell>

                        <Cell label="Assignee">
                          <div className="flex min-w-0 items-center gap-2">
                            <Avatar name={currentAssigneeName} />
                            <select
                              aria-label={`Assignee for task #${task.id}`}
                              value={draft?.assignedTo || task.assignedToUniqueName || ""}
                              onChange={(event) =>
                                updateDraft(task.id, "assignedTo", event.target.value)
                              }
                              title={
                                update?.assignedTo !== undefined
                                  ? `Was: ${task.assignedTo ?? "Unassigned"}`
                                  : undefined
                              }
                              className={fieldClass(update?.assignedTo !== undefined)}
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
                        </Cell>

                        <Cell label="Area">
                          <PathSelect
                            ariaLabel={`Area for task #${task.id}`}
                            value={draft?.areaPath || task.areaPath}
                            onChange={(path) => updateDraft(task.id, "areaPath", path)}
                            options={teamAreaOptions}
                            title={
                              update?.areaPath !== undefined ? `Was: ${task.areaPath}` : undefined
                            }
                            className={fieldClass(update?.areaPath !== undefined)}
                          />
                        </Cell>

                        <Cell label="Iteration">
                          <PathSelect
                            ariaLabel={`Iteration for task #${task.id}`}
                            value={draft?.iterationPath || task.iterationPath}
                            onChange={(path) => updateDraft(task.id, "iterationPath", path)}
                            options={teamIterationOptions}
                            title={
                              update?.iterationPath !== undefined
                                ? `Was: ${task.iterationPath}`
                                : undefined
                            }
                            className={fieldClass(update?.iterationPath !== undefined)}
                          />
                        </Cell>

                        <Cell label="Estimate">
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
                            className={`${fieldClass(
                              update?.originalEstimate !== undefined,
                              estimateEditable && isInvalidHours(draft?.originalEstimate)
                            )} text-right tabular-nums`}
                          />
                        </Cell>

                        <Cell label="Completed">
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
                            className={`${fieldClass(
                              update?.completedWork !== undefined,
                              isInvalidHours(draft?.completedWork)
                            )} text-right tabular-nums`}
                          />
                        </Cell>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      )}

      {showActionBar && (
        <ActionDock
          panel={
            isBulkPanelOpen ? (
              <>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    Fill {selectedVisibleTasks.length} selected Task(s)
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Only the fields you set change. Review the highlighted cells, then save.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[1fr_1.3fr_1fr_1fr_88px_88px_auto] lg:items-end">
                  <BulkField label="State" htmlFor="bulk-state">
                    <select
                      id="bulk-state"
                      value={bulkState}
                      onChange={(event) => setBulkState(event.target.value)}
                      className={boxedFieldClass}
                    >
                      <option value="">(unchanged)</option>
                      {taskStates.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </BulkField>
                  <BulkField label="Assignee" htmlFor="bulk-assignee">
                    <AssigneeCombobox
                      id="bulk-assignee"
                      assignees={assignees}
                      value={bulkAssignee}
                      onChange={setBulkAssignee}
                      placeholder="(unchanged)"
                      dropUp
                      inputClassName={boxedFieldClass}
                    />
                  </BulkField>
                  <BulkField label="Area" htmlFor="bulk-area">
                    <PathSelect
                      id="bulk-area"
                      value={bulkArea}
                      onChange={setBulkArea}
                      options={teamAreaOptions}
                      emptyLabel="(unchanged)"
                      className={boxedFieldClass}
                    />
                  </BulkField>
                  <BulkField label="Iteration" htmlFor="bulk-iteration">
                    <PathSelect
                      id="bulk-iteration"
                      value={bulkIteration}
                      onChange={setBulkIteration}
                      options={teamIterationOptions}
                      emptyLabel="(unchanged)"
                      className={boxedFieldClass}
                    />
                  </BulkField>
                  <BulkField label="Estimate" htmlFor="bulk-estimate">
                    <input
                      id="bulk-estimate"
                      type="number"
                      min={0}
                      step="0.5"
                      value={bulkEstimate}
                      onChange={(event) => setBulkEstimate(event.target.value)}
                      placeholder="—"
                      title="Only applies to Tasks in To Do or Done."
                      className={`${fieldClass(false, isInvalidHours(bulkEstimate), true)} tabular-nums`}
                    />
                  </BulkField>
                  <BulkField label="Completed" htmlFor="bulk-completed">
                    <input
                      id="bulk-completed"
                      type="number"
                      min={0}
                      step="0.5"
                      value={bulkCompleted}
                      onChange={(event) => setBulkCompleted(event.target.value)}
                      placeholder="—"
                      className={`${fieldClass(false, isInvalidHours(bulkCompleted), true)} tabular-nums`}
                    />
                  </BulkField>
                  <button
                    type="button"
                    onClick={handleFillSelected}
                    disabled={!canFill}
                    className={`${darkButtonClass} max-sm:col-span-2 sm:col-span-3 lg:col-span-1`}
                  >
                    Apply
                  </button>
                </div>
                {fillNotice && (
                  <p className="mt-3 flex animate-fade-up items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertIcon className="size-3.5 shrink-0" />
                    {fillNotice}
                  </p>
                )}
              </>
            ) : undefined
          }
        >
          {selectedVisibleTasks.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <CountBubble count={selectedVisibleTasks.length} />
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">selected</span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="ml-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsBulkCollapsed((collapsed) => !collapsed)}
                aria-expanded={isBulkPanelOpen}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand transition hover:bg-brand/10 dark:text-sky-300"
              >
                {isBulkPanelOpen ? "Hide bulk edit" : "Bulk edit"}
                <ChevronUpIcon
                  className={`size-3.5 transition-transform duration-200 ${isBulkPanelOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>
          ) : (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Select Tasks to fill them at once
            </span>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {pendingUpdates.length > 0 && (
              <span className="mr-1 inline-flex items-center gap-2 text-sm text-zinc-600 tabular-nums dark:text-zinc-300">
                <PendingDot />
                {pendingFieldCount} change(s) in {pendingUpdates.length} Task(s)
              </span>
            )}
            <button
              type="button"
              onClick={handleDiscard}
              disabled={Object.keys(drafts).length === 0 || isSubmitting}
              className={ghostButtonClass}
            >
              Discard
            </button>
            <button type="button" onClick={handleSave} disabled={!canSave} className={primaryButtonClass}>
              {isSubmitting ? (
                <SpinnerIcon className="size-4 animate-spin" />
              ) : (
                <CheckIcon className="size-4" />
              )}
              {isSubmitting ? "Saving" : "Save changes"}
            </button>
          </div>

          {(hiddenPendingCount > 0 || hasInvalidDraft || submitError) && (
            <div className="flex w-full flex-wrap gap-x-4 gap-y-1 text-xs">
              {hiddenPendingCount > 0 && (
                <span className="text-amber-700 dark:text-amber-400">
                  {hiddenPendingCount} Task(s) with changes are hidden by the filter.
                </span>
              )}
              {hasInvalidDraft && (
                <span className="text-red-600 dark:text-red-400">
                  Hours must be numbers greater than or equal to 0.
                </span>
              )}
              {submitError && (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <AlertIcon className="size-3.5 shrink-0" />
                  {submitError}
                </span>
              )}
            </div>
          )}
        </ActionDock>
      )}
    </PageShell>
  );
}
