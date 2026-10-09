"use client";

import { useMemo, useState, type ReactNode } from "react";
import { createTasks } from "@/lib/api-client";
import { usePbiLookup } from "@/lib/use-pbi-lookup";
import { useSessionInfo } from "@/lib/use-session-info";
import { ActionDock, CountBubble } from "@/app/components/ActionDock";
import { AssigneeCombobox } from "@/app/components/AssigneeCombobox";
import { HoursInput } from "@/app/components/HoursInput";
import { LoadingCard, PageBar, PageHero, PageShell } from "@/app/components/PageShell";
import { PbiLookupBar } from "@/app/components/PbiLookupBar";
import { PbiSummaryCard } from "@/app/components/PbiSummaryCard";
import {
  PathSelect,
  areaOptions,
  iterationOptions,
  shortPath,
} from "@/app/components/PathSelect";
import { ResultBanner } from "@/app/components/ResultBanner";
import { SettingsPrompt } from "@/app/components/SettingsPrompt";
import { AlertIcon, ChevronUpIcon, PlusIcon, SpinnerIcon, TrashIcon } from "@/app/components/icons";
import {
  boxedFieldClass,
  cardClass,
  darkButtonClass,
  fieldLabelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/app/components/styles";

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

const CREATE_HINTS = [
  { title: "Stage first", text: "Add as many Tasks as you need." },
  { title: "Set once", text: "Apply State, Assignee or paths to all." },
  { title: "Create together", text: "One click sends them to Azure DevOps." },
];

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={htmlFor} className={fieldLabelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function CreateTasksPage() {
  const { sessionInfo, isConfigured } = useSessionInfo();
  const {
    pbiId,
    setPbiId,
    isLookingUp,
    lookupError,
    pbiInfo,
    tasks,
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
  // The newest draft's title gets focus when it mounts.
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [hoursAssignMode, setHoursAssignMode] = useState(false);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [stateValue, setStateValue] = useState("");
  const [assigneeValue, setAssigneeValue] = useState("");
  const [areaValue, setAreaValue] = useState("");
  const [iterationValue, setIterationValue] = useState("");
  const [isCreatingTasks, setIsCreatingTasks] = useState(false);
  const [createTasksError, setCreateTasksError] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState(0);

  const hasOpenPbi = isLookingUp || tasks !== null;
  const hasUntitledDraft = draftTasks.some((draft) => draft.title.trim() === "");
  const canCreateTasks = draftTasks.length > 0 && !hasUntitledDraft && !isCreatingTasks;
  const hasAnyFieldSet =
    stateValue !== "" || assigneeValue !== "" || areaValue !== "" || iterationValue !== "";
  const inheritedAreaLabel = pbiInfo?.areaPath
    ? `(from PBI: ${shortPath(pbiInfo.areaPath)})`
    : "(from PBI)";
  const inheritedIterationLabel = pbiInfo?.iterationPath
    ? `(from PBI: ${shortPath(pbiInfo.iterationPath)})`
    : "(from PBI)";
  const canApplyToDrafts = draftTasks.length > 0 && hasAnyFieldSet;
  const showDock = hasOpenPbi && !isLookingUp && draftTasks.length > 0;

  async function handleLookupAndReset() {
    setDraftTasks([]);
    setCreateTasksError(null);
    setCreatedCount(0);
    await handleLookup();
  }

  function addDraftTask() {
    const tempId = crypto.randomUUID();
    setLastAddedId(tempId);
    setDraftTasks((previous) => [
      ...previous,
      {
        tempId,
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
    <PageShell isLanding={!hasOpenPbi} hasDock={showDock}>
      {hasOpenPbi ? (
        <PageBar title="Create Tasks">{lookupBar("compact")}</PageBar>
      ) : (
        <PageHero
          title="Create Tasks"
          description="Look up a PBI, stage as many new child Tasks as you need, then create them all at once. Nothing reaches Azure DevOps until you press Create."
          hints={isConfigured ? CREATE_HINTS : undefined}
        >
          {sessionInfo && (isConfigured ? lookupBar("hero") : <SettingsPrompt />)}
        </PageHero>
      )}

      {isLookingUp && <LoadingCard />}

      {pbiInfo && tasks && !isLookingUp && (
        <PbiSummaryCard pbi={pbiInfo}>
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Already has{" "}
            <strong className="font-semibold text-zinc-950 tabular-nums dark:text-zinc-50">
              {tasks.length}
            </strong>{" "}
            child Task{tasks.length === 1 ? "" : "s"}. New Tasks inherit its Area and Iteration
            unless you pick others.
          </p>
        </PbiSummaryCard>
      )}

      {createdCount > 0 && !isLookingUp && (
        <ResultBanner
          tone="success"
          title={`Created ${createdCount} Task${createdCount === 1 ? "" : "s"}`}
          onDismiss={() => setCreatedCount(0)}
        >
          {draftTasks.length > 0
            ? "The ones that failed stay below with their error, ready to fix and retry."
            : "They are in Azure DevOps under this PBI."}
        </ResultBanner>
      )}

      {pbiInfo && tasks && !isLookingUp && (
        <section className={`animate-fade-up ${cardClass}`} style={{ animationDelay: "80ms" }}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              New Tasks
              {draftTasks.length > 0 && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 tabular-nums dark:bg-zinc-800 dark:text-zinc-300">
                  {draftTasks.length}
                </span>
              )}
            </h2>
            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={hoursAssignMode}
                onClick={toggleHoursAssignMode}
                className="group inline-flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                <span
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
                    hoursAssignMode ? "bg-brand" : "bg-zinc-200 dark:bg-zinc-700"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      hoursAssignMode ? "translate-x-4" : ""
                    }`}
                  />
                </span>
                Hours per Task
              </button>
              <button type="button" onClick={addDraftTask} className={secondaryButtonClass}>
                <PlusIcon className="size-4" />
                Add Task
              </button>
            </div>
          </div>

          {draftTasks.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand dark:text-sky-300">
                <PlusIcon className="size-5" />
              </div>
              <p className="mt-4 text-base font-semibold text-zinc-950 dark:text-zinc-50">
                No new Tasks yet
              </p>
              <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                Add one and type its title. Press Enter in a title to add the next one.
              </p>
              <button type="button" onClick={addDraftTask} className={`mt-5 ${primaryButtonClass}`}>
                <PlusIcon className="size-4" />
                Add first Task
              </button>
            </div>
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
                {draftTasks.map((draft) => (
                  <li
                    key={draft.tempId}
                    className={`relative flex animate-fade-up flex-col gap-3 px-4 py-4 ${
                      draft.error
                        ? "before:absolute before:inset-y-0 before:left-0 before:w-0.75 before:bg-red-500 before:content-['']"
                        : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <label className="sr-only" htmlFor={`draft-title-${draft.tempId}`}>
                        New Task title
                      </label>
                      <input
                        id={`draft-title-${draft.tempId}`}
                        type="text"
                        autoFocus={draft.tempId === lastAddedId}
                        value={draft.title}
                        onChange={(event) => updateDraftTask(draft.tempId, { title: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && draft.title.trim() !== "") {
                            event.preventDefault();
                            addDraftTask();
                          }
                        }}
                        placeholder="What needs to be done?"
                        className={`${boxedFieldClass} py-2 text-base font-medium`}
                      />
                      <button
                        type="button"
                        onClick={() => removeDraftTask(draft.tempId)}
                        aria-label="Remove new Task"
                        title="Remove"
                        className="mt-1 rounded-lg p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      >
                        <TrashIcon className="size-4" />
                      </button>
                    </div>

                    <div
                      className={`grid grid-cols-2 gap-3 pr-11 ${
                        hoursAssignMode
                          ? "sm:grid-cols-3 lg:grid-cols-[1fr_1.3fr_1fr_1.2fr_90px_90px]"
                          : "lg:grid-cols-4"
                      }`}
                    >
                      <Field label="State" htmlFor={`draft-state-${draft.tempId}`}>
                        <select
                          id={`draft-state-${draft.tempId}`}
                          value={draft.state}
                          onChange={(event) => updateDraftTask(draft.tempId, { state: event.target.value })}
                          className={boxedFieldClass}
                        >
                          <option value="">(default)</option>
                          {taskStates.map((state) => (
                            <option key={state} value={state}>
                              {state}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Assignee" htmlFor={`draft-assignee-${draft.tempId}`}>
                        <AssigneeCombobox
                          id={`draft-assignee-${draft.tempId}`}
                          assignees={assignees}
                          value={draft.assignedTo}
                          onChange={(uniqueName) => updateDraftTask(draft.tempId, { assignedTo: uniqueName })}
                          placeholder="Unassigned"
                          inputClassName={boxedFieldClass}
                        />
                      </Field>
                      <Field label="Area" htmlFor={`draft-area-${draft.tempId}`}>
                        <PathSelect
                          id={`draft-area-${draft.tempId}`}
                          value={draft.areaPath}
                          onChange={(path) => updateDraftTask(draft.tempId, { areaPath: path })}
                          options={teamAreaOptions}
                          emptyLabel={inheritedAreaLabel}
                          className={boxedFieldClass}
                        />
                      </Field>
                      <Field label="Iteration" htmlFor={`draft-iteration-${draft.tempId}`}>
                        <PathSelect
                          id={`draft-iteration-${draft.tempId}`}
                          value={draft.iterationPath}
                          onChange={(path) => updateDraftTask(draft.tempId, { iterationPath: path })}
                          options={teamIterationOptions}
                          emptyLabel={inheritedIterationLabel}
                          className={boxedFieldClass}
                        />
                      </Field>
                      {hoursAssignMode && (
                        <>
                          <Field label="Estimate" htmlFor={`draft-estimate-${draft.tempId}`}>
                            <HoursInput
                              id={`draft-estimate-${draft.tempId}`}
                              value={draft.originalEstimate}
                              onValueChange={(value) =>
                                updateDraftTask(draft.tempId, { originalEstimate: value })
                              }
                              placeholder="—"
                              className={`${boxedFieldClass} tabular-nums`}
                            />
                          </Field>
                          <Field label="Completed" htmlFor={`draft-worked-${draft.tempId}`}>
                            <HoursInput
                              id={`draft-worked-${draft.tempId}`}
                              value={draft.completedWork}
                              onValueChange={(value) =>
                                updateDraftTask(draft.tempId, { completedWork: value })
                              }
                              placeholder="—"
                              className={`${boxedFieldClass} tabular-nums`}
                            />
                          </Field>
                        </>
                      )}
                    </div>

                    {draft.error && (
                      <p className="flex animate-fade-up items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                        <AlertIcon className="size-3.5 shrink-0" />
                        {draft.error}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <div className="border-t border-zinc-100 p-3 dark:border-zinc-900">
                <button
                  type="button"
                  onClick={addDraftTask}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 py-2.5 text-sm font-medium text-zinc-500 transition hover:border-brand hover:bg-brand/5 hover:text-brand dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-sky-300"
                >
                  <PlusIcon className="size-4" />
                  Add another Task
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {showDock && (
        <ActionDock
          panel={
            isApplyOpen ? (
              <>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    Set for all {draftTasks.length} new Task(s)
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Only the fields you set change.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1fr_1.3fr_1fr_1fr_auto] lg:items-end">
                  <Field label="State" htmlFor="state">
                    <select
                      id="state"
                      value={stateValue}
                      onChange={(event) => setStateValue(event.target.value)}
                      className={boxedFieldClass}
                    >
                      <option value="">(unchanged)</option>
                      {taskStates.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Assignee" htmlFor="assignee">
                    <AssigneeCombobox
                      id="assignee"
                      assignees={assignees}
                      value={assigneeValue}
                      onChange={setAssigneeValue}
                      placeholder="(unchanged)"
                      dropUp
                      inputClassName={boxedFieldClass}
                    />
                  </Field>
                  <Field label="Area" htmlFor="area">
                    <PathSelect
                      id="area"
                      value={areaValue}
                      onChange={setAreaValue}
                      options={teamAreaOptions}
                      emptyLabel="(unchanged)"
                      className={boxedFieldClass}
                    />
                  </Field>
                  <Field label="Iteration" htmlFor="iteration">
                    <PathSelect
                      id="iteration"
                      value={iterationValue}
                      onChange={setIterationValue}
                      options={teamIterationOptions}
                      emptyLabel="(unchanged)"
                      className={boxedFieldClass}
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={handleApplyToDrafts}
                    disabled={!canApplyToDrafts}
                    className={`${darkButtonClass} col-span-2 lg:col-span-1`}
                  >
                    Apply
                  </button>
                </div>
              </>
            ) : undefined
          }
        >
          <div className="flex items-center gap-1.5">
            <CountBubble count={draftTasks.length} />
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">new Task(s)</span>
            <button
              type="button"
              onClick={() => setIsApplyOpen((open) => !open)}
              aria-expanded={isApplyOpen}
              className="ml-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand transition hover:bg-brand/10 dark:text-sky-300"
            >
              {isApplyOpen ? "Hide set for all" : "Set for all"}
              <ChevronUpIcon
                className={`size-3.5 transition-transform duration-200 ${isApplyOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            {hasUntitledDraft && (
              <span className="text-xs text-amber-700 dark:text-amber-400">Every Task needs a title.</span>
            )}
            <button
              type="button"
              onClick={handleCreateTasks}
              disabled={!canCreateTasks}
              className={primaryButtonClass}
            >
              {isCreatingTasks ? <SpinnerIcon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
              {isCreatingTasks ? "Creating" : `Create ${draftTasks.length} Task${draftTasks.length === 1 ? "" : "s"}`}
            </button>
          </div>

          {createTasksError && (
            <p className="flex w-full items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
              <AlertIcon className="size-3.5 shrink-0" />
              {createTasksError}
            </p>
          )}
        </ActionDock>
      )}
    </PageShell>
  );
}
