// Server-only error types for the Azure DevOps proxy.

export class AdoAuthError extends Error {}

export class AdoNotFoundError extends Error {}

export class AdoRequestError extends Error {
  readonly status: number;
  readonly details?: string;

  constructor(message: string, status: number, details?: string) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export interface ApiErrorResponse {
  status: number;
  body: { error: string };
}

/** Maps a caught error to an HTTP status + JSON body, without ever including a PAT value. */
export function toApiError(error: unknown): ApiErrorResponse {
  if (error instanceof AdoAuthError) {
    return { status: 401, body: { error: error.message } };
  }
  if (error instanceof AdoNotFoundError) {
    return { status: 404, body: { error: error.message } };
  }
  if (error instanceof AdoRequestError) {
    return { status: 502, body: { error: error.details || error.message } };
  }
  return { status: 500, body: { error: "Unexpected server error." } };
}

/** Extracts a display-friendly message from a per-Task PATCH failure. */
export function extractTaskErrorMessage(reason: unknown): string {
  if (reason instanceof AdoRequestError) {
    return reason.details || reason.message;
  }
  if (reason instanceof Error) {
    return reason.message;
  }
  return "Unknown error.";
}
