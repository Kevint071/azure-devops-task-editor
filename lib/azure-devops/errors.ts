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

// Azure DevOps field-status codes (the "Invalid*" token in a TF401320 rule
// error) mapped to a plain explanation. The other tokens in the code list
// (Required, HasValues, LimitedToValues...) only describe the rule itself.
const RULE_ERROR_DESCRIPTIONS: Record<string, string> = {
  InvalidEmpty:
    "es obligatorio para este cambio (por ejemplo, el nuevo State lo exige) y está vacío. Complétalo y guarda de nuevo.",
  InvalidNotEmpty: "debe quedar vacío para este cambio.",
  InvalidListValue: "tiene un valor no permitido.",
  InvalidOldValue: "no se puede cambiar en esta situación.",
  InvalidFormat: "tiene un formato no válido.",
  InvalidType: "tiene un tipo de valor no válido.",
  InvalidTooLong: "es demasiado largo.",
};

const RULE_ERROR_PATTERN = /^(TF\d+): Rule Error for field (.+?)\. Error code: ([^.]+)\./;
const ADDITIONAL_ERRORS_PATTERN = /(One|\d+) additional errors? occurred/;

/** Rewrites a TF401320-style rule error into a readable message; null if it isn't one we understand. */
function describeRuleError(message: string): string | null {
  const match = RULE_ERROR_PATTERN.exec(message);
  if (!match) return null;
  const [, errorCode, fieldName, codeList] = match;

  const statusCode = codeList
    .split(",")
    .map((code) => code.trim())
    .find((code) => code in RULE_ERROR_DESCRIPTIONS);
  if (!statusCode) return null;

  let description = `${fieldName} ${RULE_ERROR_DESCRIPTIONS[statusCode]}`;
  const additional = ADDITIONAL_ERRORS_PATTERN.exec(message);
  if (additional) {
    const count = additional[1] === "One" ? 1 : Number(additional[1]);
    description += ` (+${count} ${count === 1 ? "error" : "errores"} más que Azure DevOps no detalla)`;
  }
  return `${description} [${errorCode}]`;
}

/** Extracts a display-friendly message from a per-Task PATCH failure. */
export function extractTaskErrorMessage(reason: unknown): string {
  if (reason instanceof AdoRequestError) {
    const message = reason.details || reason.message;
    return describeRuleError(message) ?? message;
  }
  if (reason instanceof Error) {
    return reason.message;
  }
  return "Unknown error.";
}
