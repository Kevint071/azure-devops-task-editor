// Shared shapes used by both API routes and the client page.

export interface TaskItem {
  id: number;
  title: string;
  state: string;
  assignedTo: string | null;
  assignedToUniqueName: string | null;
  originalEstimate: number | null;
  completedWork: number | null;
  areaPath: string;
  iterationPath: string;
}

export interface PbiSummary {
  id: number;
  title: string;
  state: string;
  areaPath: string;
  iterationPath: string;
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
  areaPath?: string;
  iterationPath?: string;
}

// A per-task edit - unlike BulkUpdateFields, each task gets its own values.
export interface PerTaskFieldUpdate {
  id: number;
  state?: string;
  assignedTo?: string;
  originalEstimate?: number;
  completedWork?: number;
  areaPath?: string;
  iterationPath?: string;
}

export interface BulkTaskResult {
  id: number;
  success: boolean;
  error?: string;
}

// A staged new Task, not yet created in Azure DevOps. Area and Iteration left
// out are inherited from the parent PBI.
export interface NewTaskInput {
  title: string;
  state?: string;
  assignedTo?: string;
  originalEstimate?: number;
  completedWork?: number;
  areaPath?: string;
  iterationPath?: string;
}

// An iteration selected in the Team's settings; `path` matches System.IterationPath.
export interface TeamIteration {
  path: string;
  name: string;
  timeFrame?: "past" | "current" | "future";
}

// `index` matches the position of the corresponding NewTaskInput in the request.
export interface CreateTaskResult {
  index: number;
  success: boolean;
  id?: number;
  error?: string;
}
