// Shared shapes used by both API routes and the client page.

export interface TaskItem {
  id: number;
  title: string;
  state: string;
  assignedTo: string | null;
  assignedToUniqueName: string | null;
  originalEstimate: number | null;
  completedWork: number | null;
}

export interface PbiSummary {
  id: number;
  title: string;
  state: string;
}

export interface Assignee {
  displayName: string;
  uniqueName: string;
}

export interface BulkUpdateFields {
  state?: string;
  assignedTo?: string;
  originalEstimate?: number;
  completedWork?: number;
}

// A per-task hours edit - unlike BulkUpdateFields, each task gets its own values.
export interface PerTaskFieldUpdate {
  id: number;
  originalEstimate?: number;
  completedWork?: number;
}

export interface BulkTaskResult {
  id: number;
  success: boolean;
  error?: string;
}

// A staged new Task, not yet created in Azure DevOps.
export interface NewTaskInput {
  title: string;
  state?: string;
  assignedTo?: string;
  originalEstimate?: number;
  completedWork?: number;
}

// `index` matches the position of the corresponding NewTaskInput in the request.
export interface CreateTaskResult {
  index: number;
  success: boolean;
  id?: number;
  error?: string;
}
