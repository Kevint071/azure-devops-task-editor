// Shapes returned by the Azure DevOps REST API (subset actually used).

export interface AdoWorkItemRelation {
  rel: string;
  url: string;
}

export interface AdoWorkItem {
  id: number;
  fields: Record<string, unknown>;
  relations?: AdoWorkItemRelation[];
}

export interface AdoWorkItemBatchResponse {
  count: number;
  value: AdoWorkItem[];
}

export interface AdoWorkItemTypeState {
  name: string;
}

export interface AdoWorkItemTypeStatesResponse {
  count: number;
  value: AdoWorkItemTypeState[];
}

export interface AdoIdentityRef {
  displayName?: string;
  uniqueName?: string;
}

export interface AdoTeamMember {
  identity?: AdoIdentityRef;
}

export interface AdoTeamMembersResponse {
  count: number;
  value: AdoTeamMember[];
}
