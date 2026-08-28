import { NextRequest, NextResponse } from "next/server";
import { adoRequest } from "@/lib/azure-devops/client";
import { resolveAdoConfig, resolvePat } from "@/lib/azure-devops/session";
import { toApiError } from "@/lib/azure-devops/errors";
import type { AdoWorkItemTypeStatesResponse } from "@/lib/azure-devops/types";

export async function GET(request: NextRequest) {
  const pat = resolvePat(request);

  try {
    const { org, project } = resolveAdoConfig(request);

    const data = await adoRequest<AdoWorkItemTypeStatesResponse>(
      pat,
      org,
      `/${project}/_apis/wit/workitemtypes/Task/states`
    );

    const states = Array.from(new Set(data.value.map((state) => state.name)));

    return NextResponse.json({ states });
  } catch (error) {
    const { status, body } = toApiError(error);
    return NextResponse.json(body, { status });
  }
}
