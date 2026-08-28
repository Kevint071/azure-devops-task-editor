// Server-only. Resolves the PAT / org / project for a request, preferring
// values the client sent for this call over what was previously saved in
// cookies via /api/session.
import { NextRequest } from "next/server";
import { getAzureDevOpsConfig, type AzureDevOpsConfig } from "./config";

export const PAT_COOKIE = "ado_pat";
export const ORG_COOKIE = "ado_org";
export const PROJECT_COOKIE = "ado_project";
export const TEAM_COOKIE = "ado_team";

// Cookies expire on their own after this long, so a forgotten browser tab
// doesn't keep a PAT valid indefinitely.
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const PAT_HEADER = "x-ado-pat";

export function resolvePat(request: NextRequest): string {
  const headerPat = request.headers.get(PAT_HEADER);
  if (headerPat && headerPat.trim()) return headerPat.trim();
  return request.cookies.get(PAT_COOKIE)?.value ?? "";
}

export function resolveAdoConfig(request: NextRequest): AzureDevOpsConfig {
  return getAzureDevOpsConfig({
    org: request.cookies.get(ORG_COOKIE)?.value,
    project: request.cookies.get(PROJECT_COOKIE)?.value,
    team: request.cookies.get(TEAM_COOKIE)?.value,
  });
}
