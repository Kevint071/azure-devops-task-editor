// Server-only. Never import this from client components.

export interface AzureDevOpsConfig {
  org: string;
  project: string;
  team: string;
}

interface AzureDevOpsConfigOverrides {
  org?: string;
  project?: string;
  team?: string;
}

// `overrides` come from the per-request session cookie (see session.ts) -
// org/project/team are no longer read from environment variables.
export function getAzureDevOpsConfig(overrides?: AzureDevOpsConfigOverrides): AzureDevOpsConfig {
  const org = overrides?.org?.trim();
  const project = overrides?.project?.trim();

  if (!org || !project) {
    throw new Error(
      "Azure DevOps organization and project are required. Set them in the app first."
    );
  }

  const team = overrides?.team?.trim() || `${project} Team`;

  return { org, project, team };
}
