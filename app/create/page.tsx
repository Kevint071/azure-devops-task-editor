"use client";

import { useMemo, useState } from "react";
import { createTasks } from "@/lib/api-client";
import { usePbiLookup } from "@/lib/use-pbi-lookup";
import { useSessionInfo } from "@/lib/use-session-info";
import { AssigneeCombobox } from "@/app/components/AssigneeCombobox";
import { PbiLookupBar } from "@/app/components/PbiLookupBar";
import {
  PathSelect,
  areaOptions,
  iterationOptions,
  shortPath,
} from "@/app/components/PathSelect";
import { SettingsPrompt } from "@/app/components/SettingsPrompt";

// Empty areaPath / iterationPath means "inherit from the parent PBI".
interface DraftTask {
  tempId: string;
  title: string;
  state: string;
  assignedTo: string;
  originalEstimate: string;
  completedWork: string;
  areaPath: string;
  iterationPath: string;
  error?: string;
}

export default function CreateTasksPage() {
  const { isConfigured } = useSessionInfo();
  const {
    pbiId,
    setPbiId,
    isLookingUp,
    lookupError,
    pbiInfo,
    taskStates,
    assignees,
    areas,
    iterations,
    canLookUp,
    handleLookup,
  } = usePbiLookup();
  const teamAreaOptions = useMemo(() => areaOptions(areas), [areas]);
  const teamIterationOptions = useMemo(() => iterationOptions(iterations), [iterations]);

  const [draftTasks, setDraftTasks] = useState<DraftTask[]>([]);
  const [hoursAssignMode, setHoursAssignMode] = useState(false);
  const [stateValue, setStateValue] = useState("");
  const [assigneeValue, setAssigneeValue] = useState("");
  const [areaValue, setAreaValue] = useState("");
  const [iterationValue, setIterationValue] = useState("");
  const [isCreatingTasks, setIsCreatingTasks] = useState(false);
  const [createTasksError, setCreateTasksError] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState(0);

  const canCreateTasks =
    draftTasks.length > 0 && draftTasks.every((draft) => draft.title.trim() !== "") && !isCreatingTasks;
  const hasAnyFieldSet =
    stateValue !== "" || assigneeValue !== "" || areaValue !== "" || iterationValue !== "";
  const inheritedAreaLabel = pbiInfo?.areaPath
    ? `(from PBI: ${shortPath(pbiInfo.areaPath)})`
    : "(from PBI)";
  const inheritedIterationLabel = pbiInfo?.iterationPath
    ? `(from PBI: ${shortPath(pbiInfo.iterationPath)})`
    : "(from PBI)";
  const canApplyToDrafts = draftTasks.length > 0 && hasAnyFieldSet;

  async function handleLookupAndReset() {
    setDraftTasks([]);
    setCreateTasksError(null);
    setCreatedCount(0);
    await handleLookup();
  }

  function addDraftTask() {
    setDraftTasks((previous) => [
      ...previous,
      {
        tempId: crypto.randomUUID(),
        title: "",
        state: "",
        assignedTo: "",
        originalEstimate: "",
        completedWork: "",
        areaPath: "",
        iterationPath: "",
      },
    ]);
  }

  function updateDraftTask(tempId: string, patch: Partial<DraftTask>) {
    setDraftTasks((previous) =>
      previous.map((draft) =>
        draft.tempId === tempId ? { ...draft, ...patch, error: undefined } : draft
      )
    );
  }

  function removeDraftTask(tempId: string) {
    setDraftTasks((previous) => previous.filter((draft) => draft.tempId !== tempId));
  }

  function toggleHoursAssignMode() {
    setHoursAssignMode((previous) => !previous);
  }

  function handleApplyToDrafts() {
    if (!canApplyToDrafts) return;
    setDraftTasks((previous) =>
      previous.map((draft) => ({
        ...draft,
        state: stateValue !== "" ? stateValue : draft.state,
        assignedTo: assigneeValue !== "" ? assigneeValue : draft.assignedTo,
        areaPath: areaValue !== "" ? areaValue : draft.areaPath,
        iterationPath: iterationValue !== "" ? iterationValue : draft.iterationPath,
        error: undefined,
      }))
    );
  }

  async function handleCreateTasks() {
    if (!canCreateTasks) return;

    setIsCreatingTasks(true);
    setCreateTasksError(null);

    try {
      const response = await createTasks(
        "",
        pbiId.trim(),
        draftTasks.map((draft) => ({
          title: draft.title.trim(),
          state: draft.state || undefined,
          assignedTo: draft.assignedTo || undefined,
          originalEstimate: draft.originalEstimate !== "" ? Number(draft.originalEstimate) : undefined,
          completedWork: draft.completedWork !== "" ? Number(draft.completedWork) : undefined,
          areaPath: draft.areaPath || undefined,
          iterationPath: draft.iterationPath || undefined,
        }))
      );

      const errorsByIndex = new Map<number, string>();
      for (const result of response.results) {
        if (!result.success) errorsByIndex.set(result.index, result.error ?? "Unknown error.");
      }

      setCreatedCount(response.results.length - errorsByIndex.size);
      setDraftTasks((previous) =>
        previous
          .map((draft, index): DraftTask | null =>
            errorsByIndex.has(index) ? { ...draft, error: errorsByIndex.get(index) } : null
          )
          .filter((draft): draft is DraftTask => draft !== null)
      );
    } catch (error) {
      setCreateTasksError(error instanceof Error ? error.message : "Unexpected error.");
    } finally {
      setIsCreatingTasks(false);
    }
  }

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
        <header>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Create Tasks</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Look up a PBI, stage as many new child Tasks as you need, then create them all at
            once - nothing is sent to Azure DevOps until you press Create Tasks.
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

        {pbiInfo && (
          <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                New Tasks (not yet created)
              </p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <input
                    id="hours-assign-mode"
                    type="checkbox"
                    checked={hoursAssignMode}
                    onChange={toggleHoursAssignMode}
                  />
                  <label htmlFor="hours-assign-mode" className="text-sm font-medium text-black dark:text-zinc-50">
                    Assign hours per task
                  </label>
                </div>
                <button
                  type="button"
                  onClick={addDraftTask}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium text-black dark:border-zinc-700 dark:text-zinc-50"
                >
                  + Add Task
                </button>
              </div>
            </div>

            {draftTasks.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                No new Tasks staged yet. Click &quot;+ Add Task&quot; to start one.
              </p>
            ) : (
              <>
                <ul className="flex flex-col gap-2">
                  {draftTasks.map((draft) => (
                    <li
                      key={draft.tempId}
                      className="flex flex-col gap-2 rounded border border-zinc-200 p-2 dark:border-zinc-800 sm:flex-row sm:flex-wrap sm:items-start"
                    >
                      <div className="flex flex-1 flex-col gap-1">
                        <label className="sr-only" htmlFor={`draft-title-${draft.tempId}`}>
                          New Task title
                        </label>
                        <input
                          id={`draft-title-${draft.tempId}`}
                          type="text"
                          value={draft.title}
                          onChange={(event) => updateDraftTask(draft.tempId, { title: event.target.value })}
                          placeholder="Task title"
                          className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                        />
                        {draft.error && (
                          <p className="text-xs text-red-600 dark:text-red-400">{draft.error}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1 sm:w-40">
                        <label className="sr-only" htmlFor={`draft-state-${draft.tempId}`}>
                          New Task state
                        </label>
                        <select
                          id={`draft-state-${draft.tempId}`}
                          value={draft.state}
                          onChange={(event) => updateDraftTask(draft.tempId, { state: event.target.value })}
                          className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                        >
                          <option value="">(default)</option>
                          {taskStates.map((state) => (
                            <option key={state} value={state}>
                              {state}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1 sm:w-48">
                        <label className="sr-only" htmlFor={`draft-assignee-${draft.tempId}`}>
                          New Task assignee
                        </label>
                        <AssigneeCombobox
                          id={`draft-assignee-${draft.tempId}`}
                          assignees={assignees}
                          value={draft.assignedTo}
                          onChange={(uniqueName) => updateDraftTask(draft.tempId, { assignedTo: uniqueName })}
                          placeholder="Unassigned"
                        />
                      </div>

                      {hoursAssignMode && (
                        <>
                          <div className="flex flex-col gap-1 sm:w-24">
                            <label className="sr-only" htmlFor={`draft-estimate-${draft.tempId}`}>
                              New Task original estimate
                            </label>
                            <input
                              id={`draft-estimate-${draft.tempId}`}
                              type="number"
                              min={0}
                              step="0.5"
                              value={draft.originalEstimate}
                              onChange={(event) =>
                                updateDraftTask(draft.tempId, { originalEstimate: event.target.value })
                              }
                              placeholder="Est"
                              className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                            />
                          </div>

                          <div className="flex flex-col gap-1 sm:w-24">
                            <label className="sr-only" htmlFor={`draft-worked-${draft.tempId}`}>
                              New Task completed work
                            </label>
                            <input
                              id={`draft-worked-${draft.tempId}`}
                              type="number"
                              min={0}
                              step="0.5"
                              value={draft.completedWork}
                              onChange={(event) =>
                                updateDraftTask(draft.tempId, { completedWork: event.target.value })
                              }
                              placeholder="Worked"
                              className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                            />
                          </div>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => removeDraftTask(draft.tempId)}
                        aria-label="Remove new Task"
                        className="self-start rounded px-2 py-1.5 text-sm font-medium text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
                      >
                        ✕
                      </button>

                      {/* basis-full wraps Area/Iteration onto their own line so the main row doesn't get wider */}
                      <div className="grid grid-cols-1 gap-2 sm:basis-full sm:grid-cols-2">
                        <PathSelect
                          ariaLabel="New Task area"
                          value={draft.areaPath}
                          onChange={(path) => updateDraftTask(draft.tempId, { areaPath: path })}
                          options={teamAreaOptions}
                          emptyLabel={inheritedAreaLabel}
                          className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                        />
                        <PathSelect
                          ariaLabel="New Task iteration"
                          value={draft.iterationPath}
                          onChange={(path) => updateDraftTask(draft.tempId, { iterationPath: path })}
                          options={teamIterationOptions}
                          emptyLabel={inheritedIterationLabel}
                          className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                        />
                      </div>
                    </li>
                  ))}
                </ul>

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

                  <div className="flex flex-col gap-1">
                    <label htmlFor="area" className="text-sm font-medium text-black dark:text-zinc-50">
                      Area
                    </label>
                    <PathSelect
                      id="area"
                      value={areaValue}
                      onChange={setAreaValue}
                      options={teamAreaOptions}
                      emptyLabel="(unchanged)"
                      className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="iteration" className="text-sm font-medium text-black dark:text-zinc-50">
                      Iteration
                    </label>
                    <PathSelect
                      id="iteration"
                      value={iterationValue}
                      onChange={setIterationValue}
                      options={teamIterationOptions}
                      emptyLabel="(unchanged)"
                      className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCreateTasks}
                    disabled={!canCreateTasks}
                    className="h-10 rounded bg-black px-4 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
                  >
                    {isCreatingTasks ? "Creating…" : "Create Tasks"}
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyToDrafts}
                    disabled={!canApplyToDrafts}
                    className="h-10 rounded border border-black px-4 text-sm font-medium text-black disabled:opacity-40 dark:border-white dark:text-white"
                  >
                    Apply to new Tasks
                  </button>
                </div>

                {createTasksError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{createTasksError}</p>
                )}
              </>
            )}

            {createdCount > 0 && (
              <p className="text-sm text-green-700 dark:text-green-400">
                Created {createdCount} Task{createdCount === 1 ? "" : "s"}.
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
