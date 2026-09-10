import { NextRequest, NextResponse } from "next/server";
import { adoRequest } from "@/lib/azure-devops/client";
import { resolveAdoConfig, resolvePat } from "@/lib/azure-devops/session";
import { AdoAuthError, extractTaskErrorMessage, toApiError } from "@/lib/azure-devops/errors";
import type { AdoWorkItem } from "@/lib/azure-devops/types";
import type { BulkTaskResult } from "@/lib/types";

const CONCURRENCY_LIMIT = 4;
const PARENT_LINK_TYPE = "System.LinkTypes.Hierarchy-Reverse";

interface MoveTasksRequestBody {
  taskIds?: unknown;
  destinationPbiId?: unknown;
}

interface JsonPatchOperation {
  op: "add" | "remove";
  path: string;
  value?: unknown;
}

async function buildMoveOperations(
  pat: string,
  org: string,
  project: string,
  taskId: number,
  destinationUrl: string
): Promise<JsonPatchOperation[]> {
  const current = await adoRequest<AdoWorkItem>(
    pat,
    org,
    `/${project}/_apis/wit/workitems/${taskId}?$expand=relations`
  );

  const operations: JsonPatchOperation[] = [];
  const parentIndex = (current.relations ?? []).findIndex(
    (relation) => relation.rel === PARENT_LINK_TYPE
  );
  if (parentIndex !== -1) {
    operations.push({ op: "remove", path: `/relations/${parentIndex}` });
  }
  operations.push({
    op: "add",
    path: "/relations/-",
    value: { rel: PARENT_LINK_TYPE, url: destinationUrl },
  });

  return operations;
}

export async function POST(request: NextRequest) {
  const pat = resolvePat(request);

  let payload: MoveTasksRequestBody;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!pat.trim()) {
    return NextResponse.json({ error: "A Personal Access Token is required." }, { status: 401 });
  }

  const taskIds = payload.taskIds;
  const destinationPbiId = payload.destinationPbiId;
  if (!Array.isArray(taskIds) || taskIds.length === 0 || !taskIds.every((id) => Number.isFinite(id))) {
    return NextResponse.json({ error: "At least one Task id is required." }, { status: 400 });
  }
  if (typeof destinationPbiId !== "number" || !Number.isFinite(destinationPbiId)) {
    return NextResponse.json({ error: "A destination PBI id is required." }, { status: 400 });
  }

  const { org, project } = resolveAdoConfig(request);
  const destinationUrl = `https://dev.azure.com/${org}/${project}/_apis/wit/workItems/${destinationPbiId}`;
  const ids = taskIds as number[];
  const results: BulkTaskResult[] = [];

  for (let i = 0; i < ids.length; i += CONCURRENCY_LIMIT) {
    const chunk = ids.slice(i, i + CONCURRENCY_LIMIT);
    const settled = await Promise.allSettled(
      chunk.map(async (id) => {
        const operations = await buildMoveOperations(pat, org, project, id, destinationUrl);
        return adoRequest(pat, org, `/${project}/_apis/wit/workitems/${id}`, {
          method: "PATCH",
          body: operations,
          contentType: "application/json-patch+json",
        });
      })
    );

    for (let j = 0; j < settled.length; j++) {
      const result = settled[j];
      const id = chunk[j];

      if (result.status === "fulfilled") {
        results.push({ id, success: true });
        continue;
      }

      if (result.reason instanceof AdoAuthError) {
        // Same PAT for every call - an auth failure applies to the whole batch.
        const { status, body } = toApiError(result.reason);
        return NextResponse.json(body, { status });
      }

      results.push({ id, success: false, error: extractTaskErrorMessage(result.reason) });
    }
  }

  return NextResponse.json({ results });
}
