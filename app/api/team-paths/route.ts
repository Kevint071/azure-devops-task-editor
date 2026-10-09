import { NextRequest, NextResponse } from "next/server";
import { adoRequest } from "@/lib/azure-devops/client";
import { resolveAdoConfig, resolvePat } from "@/lib/azure-devops/session";
import { toApiError } from "@/lib/azure-devops/errors";
import type {
  AdoClassificationNode,
  AdoTeamFieldValuesResponse,
  AdoTeamIteration,
  AdoTeamIterationsResponse,
} from "@/lib/azure-devops/types";
import type { TeamIteration } from "@/lib/types";

const AREA_PATH_FIELD = "System.AreaPath";
const AREA_NODE_DEPTH = 10;

// Builds child paths from node names: a node's own `path` contains an extra
// "\Area\" segment and doesn't match System.AreaPath values.
function collectChildAreaPaths(parentPath: string, node: AdoClassificationNode, into: string[]) {
  for (const child of node.children ?? []) {
    const childPath = `${parentPath}\\${child.name}`;
    into.push(childPath);
    collectChildAreaPaths(childPath, child, into);
  }
}

async function fetchSubAreaPaths(
  pat: string,
  org: string,
  project: string,
  areaPath: string
): Promise<string[]> {
  // The first segment of an area path is the project root, which is the
  // Areas node itself in the classification-nodes API.
  const relativeSegments = areaPath.split("\\").slice(1);
  const nodePath = relativeSegments.map(encodeURIComponent).join("/");
  const root = await adoRequest<AdoClassificationNode>(
    pat,
    org,
    `/${project}/_apis/wit/classificationnodes/Areas${nodePath ? `/${nodePath}` : ""}?$depth=${AREA_NODE_DEPTH}`
  );
  const paths: string[] = [];
  collectChildAreaPaths(areaPath, root, paths);
  return paths;
}

async function fetchTeamAreas(
  pat: string,
  org: string,
  project: string,
  team: string
): Promise<string[]> {
  const fieldValues = await adoRequest<AdoTeamFieldValuesResponse>(
    pat,
    org,
    `/${encodeURIComponent(project)}/${encodeURIComponent(team)}/_apis/work/teamsettings/teamfieldvalues`
  );
  // Teams can be keyed on a custom field instead of Area Path; those values
  // aren't area paths, so there is nothing to offer.
  if (fieldValues.field?.referenceName && fieldValues.field.referenceName !== AREA_PATH_FIELD) {
    return [];
  }

  const subAreaLists = await Promise.all(
    fieldValues.values
      .filter((entry) => entry.includeChildren)
      .map((entry) => fetchSubAreaPaths(pat, org, project, entry.value))
  );
  const all = [...fieldValues.values.map((entry) => entry.value), ...subAreaLists.flat()];
  return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b));
}

function startTime(iteration: AdoTeamIteration): number | null {
  const startDate = iteration.attributes?.startDate;
  if (!startDate) return null;
  const time = Date.parse(startDate);
  return Number.isFinite(time) ? time : null;
}

async function fetchTeamIterations(
  pat: string,
  org: string,
  project: string,
  team: string
): Promise<TeamIteration[]> {
  const data = await adoRequest<AdoTeamIterationsResponse>(
    pat,
    org,
    `/${encodeURIComponent(project)}/${encodeURIComponent(team)}/_apis/work/teamsettings/iterations`
  );
  // Dated iterations first, by start date; undated ones keep Azure DevOps' order.
  const ordered = data.value
    .map((iteration, index) => ({ iteration, index, start: startTime(iteration) }))
    .sort((a, b) => {
      if (a.start !== null && b.start !== null) return a.start - b.start;
      if (a.start !== null) return -1;
      if (b.start !== null) return 1;
      return a.index - b.index;
    });
  return ordered.map(({ iteration }) => ({
    path: iteration.path,
    name: iteration.name,
    timeFrame: iteration.attributes?.timeFrame,
  }));
}

export async function GET(request: NextRequest) {
  const pat = resolvePat(request);

  try {
    const { org, project, team } = resolveAdoConfig(request);

    const [areas, iterations] = await Promise.all([
      fetchTeamAreas(pat, org, project, team),
      fetchTeamIterations(pat, org, project, team),
    ]);

    return NextResponse.json({ areas, iterations });
  } catch (error) {
    const { status, body } = toApiError(error);
    return NextResponse.json(body, { status });
  }
}
