// Shared client-side hook for pages that need to look up a single PBI and
// its child Tasks. The PAT is never handled here - requests are sent with an
// empty PAT header, and the server falls back to the httpOnly session cookie
// saved from the Settings page (see lib/azure-devops/session.ts).
import { useState } from "react";
import { fetchAssignees, fetchPbiTasks, fetchTaskStates } from "./api-client";
import type { Assignee, PbiSummary, TaskItem } from "./types";

export function usePbiLookup() {
  const [pbiId, setPbiId] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [pbiInfo, setPbiInfo] = useState<PbiSummary | null>(null);
  const [tasks, setTasks] = useState<TaskItem[] | null>(null);
  const [taskStates, setTaskStates] = useState<string[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);

  const canLookUp = pbiId.trim() !== "" && !isLookingUp;

  async function handleLookup() {
    if (!canLookUp) return;

    setIsLookingUp(true);
    setLookupError(null);
    setPbiInfo(null);
    setTasks(null);

    try {
      const [pbiResult, statesResult, assigneesResult] = await Promise.all([
        fetchPbiTasks("", pbiId.trim()),
        fetchTaskStates(""),
        fetchAssignees(""),
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

  async function handleRefresh(): Promise<TaskItem[] | null> {
    if (pbiId.trim() === "") return null;

    setIsRefreshing(true);
    setLookupError(null);

    try {
      const pbiResult = await fetchPbiTasks("", pbiId.trim());
      setPbiInfo(pbiResult.pbi);
      setTasks(pbiResult.tasks);
      return pbiResult.tasks;
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : "Unexpected error.");
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }

  return {
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
  };
}
