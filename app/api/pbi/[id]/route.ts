import { NextRequest, NextResponse } from "next/server";
import { adoRequest } from "@/lib/azure-devops/client";
import { resolveAdoConfig, resolvePat } from "@/lib/azure-devops/session";
import { toApiError } from "@/lib/azure-devops/errors";
import type {
  AdoIdentityRef,
  AdoWorkItem,
  AdoWorkItemBatchResponse,
} from "@/lib/azure-devops/types";
import type { PbiSummary, TaskItem } from "@/lib/types";

const CHILD_LINK_TYPE = "System.LinkTypes.Hierarchy-Forward";
const TASK_FIELDS = [
  "System.Title",
  "System.State",
  "System.AssignedTo",
  "Microsoft.VSTS.Scheduling.OriginalEstimate",
  "Microsoft.VSTS.Scheduling.CompletedWork",
  "System.AreaPath",
  "System.IterationPath",
];

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function asIdentity(value: unknown): AdoIdentityRef | null {
  if (value && typeof value === "object") {
    return value as AdoIdentityRef;
  }
  return null;
}

function extractChildIdFromRelationUrl(url: string): number | null {
  const segment = url.split("/").pop();
  const id = segment ? Number(segment) : NaN;
  return Number.isFinite(id) ? id : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pat = resolvePat(request);

  try {
    const { org, project } = resolveAdoConfig(request);

    const pbi = await adoRequest<AdoWorkItem>(
      pat,
      org,
      `/${project}/_apis/wit/workitems/${encodeURIComponent(id)}?$expand=relations`
    );

    const pbiSummary: PbiSummary = {
      id: pbi.id,
      title: asString(pbi.fields["System.Title"]),
      state: asString(pbi.fields["System.State"]),
      areaPath: asString(pbi.fields["System.AreaPath"]),
      iterationPath: asString(pbi.fields["System.IterationPath"]),
    };

    const childIds = (pbi.relations ?? [])
      .filter((relation) => relation.rel === CHILD_LINK_TYPE)
      .map((relation) => extractChildIdFromRelationUrl(relation.url))
      .filter((childId): childId is number => childId !== null);

    if (childIds.length === 0) {
      return NextResponse.json({ pbi: pbiSummary, tasks: [] satisfies TaskItem[] });
    }

    const batch = await adoRequest<AdoWorkItemBatchResponse>(
      pat,
      org,
      `/${project}/_apis/wit/workitems?ids=${childIds.join(",")}&fields=${TASK_FIELDS.join(",")}`
    );

    const tasks: TaskItem[] = batch.value.map((workItem) => {
      const assignedTo = asIdentity(workItem.fields["System.AssignedTo"]);
      return {
        id: workItem.id,
        title: asString(workItem.fields["System.Title"]),
        state: asString(workItem.fields["System.State"]),
        assignedTo: assignedTo?.displayName ?? null,
        assignedToUniqueName: assignedTo?.uniqueName ?? null,
        originalEstimate: asNumber(
          workItem.fields["Microsoft.VSTS.Scheduling.OriginalEstimate"]
        ),
        completedWork: asNumber(workItem.fields["Microsoft.VSTS.Scheduling.CompletedWork"]),
        areaPath: asString(workItem.fields["System.AreaPath"]),
        iterationPath: asString(workItem.fields["System.IterationPath"]),
      };
    });

    return NextResponse.json({ pbi: pbiSummary, tasks });
  } catch (error) {
    const { status, body } = toApiError(error);
    return NextResponse.json(body, { status });
  }
}
