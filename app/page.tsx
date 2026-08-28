"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  clearSession,
  fetchAssignees,
  fetchPbiTasks,
  fetchSessionInfo,
  fetchTaskStates,
  saveSession,
  submitBulkUpdate,
  submitPerTaskUpdates,
} from "@/lib/api-client";
import type { Assignee, BulkTaskResult, PbiSummary, PerTaskFieldUpdate, TaskItem } from "@/lib/types";

interface HoursDraft {
  originalEstimate: string;
  completedWork: string;
}

const ORIGINAL_ESTIMATE_EDITABLE_STATES = new Set(["To Do", "Done"]);

function canEditOriginalEstimate(state: string) {
  return ORIGINAL_ESTIMATE_EDITABLE_STATES.has(state);
}

const UNASSIGNED_FILTER = "__unassigned__";

function AssigneeCombobox({
  id,
  assignees,
  value,
  onChange,
  placeholder,
}: {
  id?: string;
  assignees: Assignee[];
  value: string;
  onChange: (uniqueName: string) => void;
  placeholder?: string;
}) {
  const selected = assignees.find((assignee) => assignee.uniqueName === value) ?? null;
  const [query, setQuery] = useState(selected?.displayName ?? "");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setQuery(selected?.displayName ?? "");
  }, [selected?.displayName]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "" || q === selected?.displayName.toLowerCase()) return assignees;
    return assignees.filter((assignee) => assignee.displayName.toLowerCase().includes(q));
  }, [assignees, query, selected]);

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        value={query}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setIsOpen(true);
          if (next === "") onChange("");
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
      {isOpen && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border border-zinc-300 bg-white text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {filtered.length === 0 ? (
            <li className="px-3 py-1.5 text-zinc-500 dark:text-zinc-400">No matches</li>
          ) : (
            filtered.map((assignee) => (
              <li key={assignee.uniqueName}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(assignee.uniqueName);
                    setQuery(assignee.displayName);
                    setIsOpen(false);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-black hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
                >
                  {assignee.displayName}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default function Home() {
  const [pat, setPat] = useState("");
  const [org, setOrg] = useState("");
  const [project, setProject] = useState("");
  const [team, setTeam] = useState("");
  const [hasStoredPat, setHasStoredPat] = useState(false);
  const [pbiId, setPbiId] = useState("");

  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [pbiInfo, setPbiInfo] = useState<PbiSummary | null>(null);
  const [tasks, setTasks] = useState<TaskItem[] | null>(null);
  const [taskStates, setTaskStates] = useState<string[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [stateValue, setStateValue] = useState("");
  const [assigneeValue, setAssigneeValue] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");

  const [hoursAssignMode, setHoursAssignMode] = useState(false);
  const [hoursDrafts, setHoursDrafts] = useState<Record<number, HoursDraft>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [taskColumnWidth, setTaskColumnWidth] = useState(280);
  const taskColumnResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // minmax(min, 1fr): fills all leftover row width by default; dragging raises the
  // min past that natural fill, which is when it starts forcing horizontal overflow
  const taskGridTemplateColumns = `28px minmax(${taskColumnWidth}px, 1fr) 100px 160px 100px 100px`;

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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkTaskResult[] | null>(null);

  const hasAnyFieldSet = stateValue !== "" || assigneeValue !== "";
  const canSubmit = selectedIds.size > 0 && hasAnyFieldSet && !isSubmitting;
  const canLookUp = (pat.trim() !== "" || hasStoredPat) && pbiId.trim() !== "" && !isLookingUp;

  useEffect(() => {
    fetchSessionInfo()
      .then((info) => {
        setOrg(info.org);
        setProject(info.project);
        setTeam(info.team);
        setHasStoredPat(info.hasPat);
      })
      .catch(() => {});
  }, []);

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

  async function handleLookup() {
    if (!canLookUp) return;

    setIsLookingUp(true);
    setLookupError(null);
    setPbiInfo(null);
    setTasks(null);
    setSelectedIds(new Set());
    setAssigneeFilter("");
    setResults(null);
    setSubmitError(null);

    try {
      await saveSession({
        pat: pat.trim() || undefined,
        org: org.trim() || undefined,
        project: project.trim() || undefined,
        team: team.trim() || undefined,
      });
      setHasStoredPat(true);

      const [pbiResult, statesResult, assigneesResult] = await Promise.all([
        fetchPbiTasks(pat, pbiId.trim()),
        fetchTaskStates(pat),
        fetchAssignees(pat),
      ]);
      setPbiInfo(pbiResult.pbi);
      setTasks(pbiResult.tasks);
      setTaskStates(statesResult.states);
      setAssignees(assigneesResult.assignees);
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : "Unexpected error.");
    } finally {
      setIsLookingUp(false);
    }
  }

  async function handleForgetSession() {
    await clearSession();
    setPat("");
    setOrg("");
    setProject("");
    setTeam("");
    setHasStoredPat(false);
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

  async function handleRefresh() {
    if ((pat.trim() === "" && !hasStoredPat) || pbiId.trim() === "") return;

    setIsRefreshing(true);
    setLookupError(null);

    try {
      const pbiResult = await fetchPbiTasks(pat, pbiId.trim());
      setPbiInfo(pbiResult.pbi);
      setTasks(pbiResult.tasks);
      const refreshedIds = new Set(pbiResult.tasks.map((task) => task.id));
      setSelectedIds((previous) => new Set(Array.from(previous).filter((id) => refreshedIds.has(id))));
      setHoursDrafts({});
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : "Unexpected error.");
    } finally {
      setIsRefreshing(false);
    }
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
      const response = await submitBulkUpdate(pat, Array.from(selectedIds), fields);
      setResults(response.results);
      if (response.results.every((result) => result.success)) {
        setStateValue("");
        setAssigneeValue("");
      }
      await handleRefresh();
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
      const response = await submitPerTaskUpdates(pat, updates);
      setResults(response.results);
      await handleRefresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unexpected error.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 font-sans dark:bg-black">
      {/* only the header/form stays narrow; the PBI title box and Tasks box share the wider width */}
      <main className="flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          <header>
            <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
              Azure DevOps Bulk Task Editor
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Look up a PBI, select its child Tasks, and apply the same State or Assignee to all of
              them at once - or set Original Estimate and Completed Work per Task.
            </p>
          </header>

        <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-1">
            <label htmlFor="pat" className="text-sm font-medium text-black dark:text-zinc-50">
              Personal Access Token
            </label>
            <input
              id="pat"
              type="password"
              autoComplete="off"
              value={pat}
              onChange={(event) => setPat(event.target.value)}
              placeholder={hasStoredPat ? "PAT saved - leave blank to keep using it" : "Paste your Azure DevOps PAT"}
              className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {hasStoredPat
                ? "Saved in an httpOnly cookie for up to 8h (not readable by page scripts). Type a new one to replace it."
                : "Saved in an httpOnly cookie for up to 8h once you look up a PBI - never exposed to page scripts."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="org" className="text-sm font-medium text-black dark:text-zinc-50">
                Organization
              </label>
              <input
                id="org"
                type="text"
                value={org}
                onChange={(event) => setOrg(event.target.value)}
                placeholder="e.g. my-org"
                className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="project" className="text-sm font-medium text-black dark:text-zinc-50">
                Project
              </label>
              <input
                id="project"
                type="text"
                value={project}
                onChange={(event) => setProject(event.target.value)}
                placeholder="e.g. my-project"
                className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="team" className="text-sm font-medium text-black dark:text-zinc-50">
                Team <span className="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span>
              </label>
              <input
                id="team"
                type="text"
                value={team}
                onChange={(event) => setTeam(event.target.value)}
                placeholder={`Defaults to "${project || "<project>"} Team"`}
                className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="pbiId" className="text-sm font-medium text-black dark:text-zinc-50">
                PBI id
              </label>
              <input
                id="pbiId"
                type="text"
                value={pbiId}
                onChange={(event) => setPbiId(event.target.value)}
                placeholder="e.g. 12345"
                className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <button
              type="button"
              onClick={handleLookup}
              disabled={!canLookUp}
              className="h-10 rounded bg-black px-4 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
            >
              {isLookingUp ? "Looking up…" : "Look up"}
            </button>
          </div>

          {hasStoredPat && (
            <button
              type="button"
              onClick={handleForgetSession}
              className="self-start text-xs font-medium text-zinc-600 underline underline-offset-2 hover:text-black dark:text-zinc-300 dark:hover:text-zinc-50"
            >
              Forget saved PAT / Organization / Project / Team
            </button>
          )}

          {lookupError && (
            <p className="text-sm text-red-600 dark:text-red-400">{lookupError}</p>
          )}
        </section>
        </div>

        {pbiInfo && (
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              PBI #{pbiInfo.id} · {pbiInfo.state}
            </p>
            <p className="text-base font-semibold text-black dark:text-zinc-50">{pbiInfo.title}</p>
          </div>
        )}

        {tasks && tasks.length === 0 && !lookupError && (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            This PBI has no child Tasks.
          </p>
        )}

        {tasks && tasks.length > 0 && (
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
                onClick={handleRefresh}
                disabled={isRefreshing || !pbiId.trim() || (!pat.trim() && !hasStoredPat)}
                className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium text-black disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-50"
              >
                {isRefreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>

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
