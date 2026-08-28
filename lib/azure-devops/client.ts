// Server-only request helper for the Azure DevOps REST API.
import { AdoAuthError, AdoNotFoundError, AdoRequestError } from "./errors";

const API_VERSION = "7.1";

interface AdoRequestOptions {
  method?: string;
  body?: unknown;
  contentType?: string;
}

function buildAuthHeader(pat: string): string {
  return `Basic ${Buffer.from(`:${pat}`).toString("base64")}`;
}

/**
 * Calls an Azure DevOps REST endpoint under https://dev.azure.com/{org}.
 * `path` is everything after the org segment, e.g. `/{project}/_apis/wit/workitems/1`.
 */
export async function adoRequest<T>(
  pat: string,
  org: string,
  path: string,
  options: AdoRequestOptions = {}
): Promise<T> {
  if (!pat || !pat.trim()) {
    throw new AdoAuthError("A Personal Access Token is required.");
  }

  const separator = path.includes("?") ? "&" : "?";
  const url = `https://dev.azure.com/${org}${path}${separator}api-version=${API_VERSION}`;

  const headers: Record<string, string> = {
    Authorization: buildAuthHeader(pat),
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = options.contentType ?? "application/json";
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 || response.status === 403) {
    throw new AdoAuthError("Invalid or expired PAT.");
  }
  if (response.status === 404) {
    throw new AdoNotFoundError("The requested Azure DevOps resource was not found.");
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message: string | undefined;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      message = parsed.message;
    } catch {
      // Response body wasn't JSON; fall back to the raw text below.
    }
    throw new AdoRequestError(
      message || `Azure DevOps request failed with status ${response.status}`,
      response.status,
      message ?? text
    );
  }

  if (response.status === 204) {
    return null as T;
  }
  return (await response.json()) as T;
}
