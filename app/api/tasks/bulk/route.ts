import { NextRequest, NextResponse } from "next/server";
import { adoRequest } from "@/lib/azure-devops/client";
import { resolveAdoConfig, resolvePat } from "@/lib/azure-devops/session";
import { AdoAuthError, extractTaskErrorMessage, toApiError } from "@/lib/azure-devops/errors";
import type { BulkTaskResult, BulkUpdateFields } from "@/lib/types";

const CONCURRENCY_LIMIT = 4;

interface BulkUpdateRequestBody extends BulkUpdateFields {
  ids?: unknown;
  updates?: unknown;
}

interface JsonPatchOperation {
  op: "add";
  path: string;
  value: string | number;
}

interface PerTaskUpdate {
  id: number;
  originalEstimate?: number;
  completedWork?: number;
}

function buildPatchOperations(fields: BulkUpdateFields): JsonPatchOperation[] {
  const operations: JsonPatchOperation[] = [];
  if (fields.state !== undefined) {
    operations.push({ op: "add", path: "/fields/System.State", value: fields.state });
  }
  if (fields.assignedTo !== undefined) {
    operations.push({ op: "add", path: "/fields/System.AssignedTo", value: fields.assignedTo });
  }
  if (fields.originalEstimate !== undefined) {
    operations.push({
      op: "add",
      path: "/fields/Microsoft.VSTS.Scheduling.OriginalEstimate",
      value: fields.originalEstimate,
    });
  }
  if (fields.completedWork !== undefined) {
    operations.push({
      op: "add",
      path: "/fields/Microsoft.VSTS.Scheduling.CompletedWork",
      value: fields.completedWork,
    });
  }
  return operations;
}

function isValidPerTaskUpdate(value: unknown): value is PerTaskUpdate {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "number" || !Number.isFinite(record.id)) return false;

  const hasOriginalEstimate = record.originalEstimate !== undefined;
  const hasCompletedWork = record.completedWork !== undefined;
  if (!hasOriginalEstimate && !hasCompletedWork) return false;
  if (hasOriginalEstimate && typeof record.originalEstimate !== "number") return false;
  if (hasCompletedWork && typeof record.completedWork !== "number") return false;

  return true;
}

async function applyPatches(
  pat: string,
  org: string,
  project: string,
  items: { id: number; operations: JsonPatchOperation[] }[]
): Promise<{ results: BulkTaskResult[] } | { authError: NextResponse }> {
  const results: BulkTaskResult[] = [];

  for (let i = 0; i < items.length; i += CONCURRENCY_LIMIT) {
    const chunk = items.slice(i, i + CONCURRENCY_LIMIT);
    const settled = await Promise.allSettled(
      chunk.map((item) =>
        adoRequest(pat, org, `/${project}/_apis/wit/workitems/${item.id}`, {
          method: "PATCH",
          body: item.operations,
          contentType: "application/json-patch+json",
        })
      )
    );

    for (let j = 0; j < settled.length; j++) {
      const result = settled[j];
      const id = chunk[j].id;

      if (result.status === "fulfilled") {
        results.push({ id, success: true });
        continue;
      }

      if (result.reason instanceof AdoAuthError) {
        // Same PAT for every call - an auth failure applies to the whole batch.
        const { status, body } = toApiError(result.reason);
        return { authError: NextResponse.json(body, { status }) };
      }

      results.push({ id, success: false, error: extractTaskErrorMessage(result.reason) });
    }
  }

  return { results };
}

export async function PATCH(request: NextRequest) {
  const pat = resolvePat(request);

  let payload: BulkUpdateRequestBody;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!pat.trim()) {
    return NextResponse.json(
      { error: "A Personal Access Token is required." },
      { status: 401 }
    );
  }

  const { org, project } = resolveAdoConfig(request);

  // Per-task mode: each Task carries its own Original Estimate / Completed Work.
  if (Array.isArray(payload.updates) && payload.updates.length > 0) {
    if (!payload.updates.every(isValidPerTaskUpdate)) {
      return NextResponse.json(
        {
          error:
            "Each update must include a Task id and at least one of Original Estimate or Completed Work.",
        },
        { status: 400 }
      );
    }

    const items = (payload.updates as PerTaskUpdate[]).map((update) => ({
      id: update.id,
      operations: buildPatchOperations({
        originalEstimate: update.originalEstimate,
        completedWork: update.completedWork,
      }),
    }));

    const outcome = await applyPatches(pat, org, project, items);
    if ("authError" in outcome) return outcome.authError;
    return NextResponse.json({ results: outcome.results });
  }

  const ids = payload.ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => Number.isFinite(id))) {
    return NextResponse.json({ error: "At least one Task id is required." }, { status: 400 });
  }

  const patchOperations = buildPatchOperations(payload);
  if (patchOperations.length === 0) {
    return NextResponse.json(
      { error: "At least one field must be provided." },
      { status: 400 }
    );
  }

  const items = (ids as number[]).map((id) => ({ id, operations: patchOperations }));
  const outcome = await applyPatches(pat, org, project, items);
  if ("authError" in outcome) return outcome.authError;
  return NextResponse.json({ results: outcome.results });
}

