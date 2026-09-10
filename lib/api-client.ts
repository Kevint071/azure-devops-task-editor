// Browser-side helper for calling our own API routes.
// The PAT is carried in a request header so it works uniformly for GET and
// PATCH calls (fetch disallows a body on GET requests). It is optionally
// mirrored into an httpOnly session cookie via saveSession() so it survives
// a reload without ever being readable by client-side JS again.
import type {
  Assignee,
  BulkTaskResult,
  BulkUpdateFields,
  CreateTaskResult,
  NewTaskInput,
  PbiSummary,
  PerTaskFieldUpdate,
  TaskItem,
} from "./types";

const PAT_HEADER = "x-ado-pat";

async function apiRequest<T>(pat: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      [PAT_HEADER]: pat,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export function fetchPbiTasks(pat: string, pbiId: string): Promise<{ pbi: PbiSummary; tasks: TaskItem[] }> {
  return apiRequest(pat, `/api/pbi/${encodeURIComponent(pbiId)}`);
}

export function fetchTaskStates(pat: string): Promise<{ states: string[] }> {
  return apiRequest(pat, "/api/task-states");
}

export function fetchAssignees(pat: string): Promise<{ assignees: Assignee[] }> {
  return apiRequest(pat, "/api/assignees");
}

export function submitBulkUpdate(
  pat: string,
  ids: number[],
  fields: BulkUpdateFields
): Promise<{ results: BulkTaskResult[] }> {
  return apiRequest(pat, "/api/tasks/bulk", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, ...fields }),
  });
}

export function submitPerTaskUpdates(
  pat: string,
  updates: PerTaskFieldUpdate[]
): Promise<{ results: BulkTaskResult[] }> {
  return apiRequest(pat, "/api/tasks/bulk", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updates }),
  });
}

export function createTasks(
  pat: string,
  pbiId: string,
  tasks: NewTaskInput[]
): Promise<{ results: CreateTaskResult[] }> {
  return apiRequest(pat, `/api/pbi/${encodeURIComponent(pbiId)}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks }),
  });
}

export function moveTasks(
  pat: string,
  taskIds: number[],
  destinationPbiId: number
): Promise<{ results: BulkTaskResult[] }> {
  return apiRequest(pat, "/api/tasks/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskIds, destinationPbiId }),
  });
}

export interface SessionInfo {
  org: string;
  project: string;
  team: string;
  hasPat: boolean;
}

export async function fetchSessionInfo(): Promise<SessionInfo> {
  const response = await fetch("/api/session");
  return (await response.json()) as SessionInfo;
}

// Persists whichever fields are provided in an httpOnly (PAT) / regular
// (org, project, team) cookie, valid for a limited time - see SESSION_MAX_AGE_SECONDS.
export async function saveSession(data: {
  pat?: string;
  org?: string;
  project?: string;
  team?: string;
}): Promise<void> {
  await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function clearSession(): Promise<void> {
  await fetch("/api/session", { method: "DELETE" });
}
