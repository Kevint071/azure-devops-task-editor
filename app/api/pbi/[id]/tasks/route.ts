import { NextRequest, NextResponse } from "next/server";
import { adoRequest } from "@/lib/azure-devops/client";
import { resolveAdoConfig, resolvePat } from "@/lib/azure-devops/session";
import { AdoAuthError, extractTaskErrorMessage, toApiError } from "@/lib/azure-devops/errors";
import type { AdoWorkItem } from "@/lib/azure-devops/types";
import type { CreateTaskResult, NewTaskInput } from "@/lib/types";

const CONCURRENCY_LIMIT = 4;

interface CreateTasksRequestBody {
  tasks?: unknown;
}

interface JsonPatchOperation {
  op: "add";
  path: string;
  value: unknown;
}

function isValidNewTaskInput(value: unknown): value is NewTaskInput {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.title !== "string" || record.title.trim() === "") return false;
  if (record.state !== undefined && typeof record.state !== "string") return false;
  if (record.assignedTo !== undefined && typeof record.assignedTo !== "string") return false;
  if (record.originalEstimate !== undefined && typeof record.originalEstimate !== "number") return false;
  if (record.completedWork !== undefined && typeof record.completedWork !== "number") return false;
  return true;
}

function buildCreateOperations(
  org: string,
  project: string,
  parentId: number,
  task: NewTaskInput
): JsonPatchOperation[] {
  const operations: JsonPatchOperation[] = [
    { op: "add", path: "/fields/System.Title", value: task.title.trim() },
  ];
  if (task.state) {
    operations.push({ op: "add", path: "/fields/System.State", value: task.state });
  }
  if (task.assignedTo) {
    operations.push({ op: "add", path: "/fields/System.AssignedTo", value: task.assignedTo });
  }
  if (task.originalEstimate !== undefined) {
    operations.push({
      op: "add",
      path: "/fields/Microsoft.VSTS.Scheduling.OriginalEstimate",
      value: task.originalEstimate,
    });
  }
  if (task.completedWork !== undefined) {
    operations.push({
      op: "add",
      path: "/fields/Microsoft.VSTS.Scheduling.CompletedWork",
      value: task.completedWork,
    });
  }
  operations.push({
    op: "add",
    path: "/relations/-",
    value: {
      rel: "System.LinkTypes.Hierarchy-Reverse",
      url: `https://dev.azure.com/${org}/${project}/_apis/wit/workItems/${parentId}`,
    },
  });
  return operations;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parentId = Number(id);
  const pat = resolvePat(request);

  let payload: CreateTasksRequestBody;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!pat.trim()) {
    return NextResponse.json({ error: "A Personal Access Token is required." }, { status: 401 });
  }
  if (!Number.isFinite(parentId)) {
    return NextResponse.json({ error: "Invalid PBI id." }, { status: 400 });
  }

  const tasks = payload.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0 || !tasks.every(isValidNewTaskInput)) {
    return NextResponse.json(
      { error: "At least one new Task with a title is required." },
      { status: 400 }
    );
  }

  const { org, project } = resolveAdoConfig(request);
  const results: CreateTaskResult[] = [];

  for (let i = 0; i < tasks.length; i += CONCURRENCY_LIMIT) {
    const chunk = tasks.slice(i, i + CONCURRENCY_LIMIT);
    const settled = await Promise.allSettled(
      chunk.map((task) =>
        adoRequest<AdoWorkItem>(pat, org, `/${project}/_apis/wit/workitems/$Task`, {
          method: "POST",
          body: buildCreateOperations(org, project, parentId, task),
          contentType: "application/json-patch+json",
        })
      )
    );

    for (let j = 0; j < settled.length; j++) {
      const result = settled[j];
      const index = i + j;

      if (result.status === "fulfilled") {
        results.push({ index, success: true, id: result.value.id });
        continue;
      }

      if (result.reason instanceof AdoAuthError) {
        // Same PAT for every call - an auth failure applies to the whole batch.
        const { status, body } = toApiError(result.reason);
        return NextResponse.json(body, { status });
      }

      results.push({ index, success: false, error: extractTaskErrorMessage(result.reason) });
    }
  }

  return NextResponse.json({ results });
}
