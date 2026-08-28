import { NextRequest, NextResponse } from "next/server";
import { adoRequest } from "@/lib/azure-devops/client";
import { resolveAdoConfig, resolvePat } from "@/lib/azure-devops/session";
import { toApiError } from "@/lib/azure-devops/errors";
import type { AdoTeamMembersResponse } from "@/lib/azure-devops/types";
import type { Assignee } from "@/lib/types";

export async function GET(request: NextRequest) {
  const pat = resolvePat(request);

  try {
    const { org, project, team } = resolveAdoConfig(request);

    const data = await adoRequest<AdoTeamMembersResponse>(
      pat,
      org,
      `/_apis/projects/${encodeURIComponent(project)}/teams/${encodeURIComponent(team)}/members`
    );

    const assignees: Assignee[] = data.value
      .filter((member) => member.identity?.displayName && member.identity?.uniqueName)
      .map((member) => ({
        displayName: member.identity!.displayName!,
        uniqueName: member.identity!.uniqueName!,
      }));

    return NextResponse.json({ assignees });
  } catch (error) {
    const { status, body } = toApiError(error);
    return NextResponse.json(body, { status });
  }
}
