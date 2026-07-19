const AUTH_ERROR_REASONS = new Set([
  "invalid_grant",
  "unauthorized_client",
  "invalid_client",
  "invalid_request"
]);

export type GoogleAuthFailure = {
  isAuthFailure: boolean;
  code?: string;
  reason?: string;
  status?: number;
};

function readString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getNestedError(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== "object") return {};
  const root = error as Record<string, unknown>;
  const response = root.response && typeof root.response === "object" ? (root.response as Record<string, unknown>) : undefined;
  const data = response?.data && typeof response.data === "object" ? (response.data as Record<string, unknown>) : undefined;
  return {
    ...root,
    ...(response ?? {}),
    ...(data ?? {})
  };
}

export function detectGoogleAuthFailure(error: unknown): GoogleAuthFailure {
  const nested = getNestedError(error);
  const status = typeof nested.status === "number" ? nested.status : typeof nested.code === "number" ? nested.code : undefined;
  const code = readString(nested.error) ?? readString(nested.code);
  const message = readString(nested.error_description) ?? readString(nested.message) ?? (error instanceof Error ? error.message : undefined);
  const loweredMessage = message?.toLowerCase() ?? "";
  const loweredCode = code?.toLowerCase();

  const authCodeMatch = loweredCode ? AUTH_ERROR_REASONS.has(loweredCode) : false;
  const authMessageMatch =
    loweredMessage.includes("invalid_grant") ||
    loweredMessage.includes("invalid_client") ||
    loweredMessage.includes("unauthorized_client") ||
    loweredMessage.includes("refresh token") ||
    loweredMessage.includes("token has been expired") ||
    loweredMessage.includes("token has been revoked") ||
    loweredMessage.includes("invalid credentials") ||
    loweredMessage.includes("login required");
  const insufficientScopeMatch =
    loweredMessage.includes("insufficient authentication scopes") ||
    loweredMessage.includes("insufficient permission") ||
    loweredMessage.includes("access_token_scope_insufficient");

  const isAuthFailure = authCodeMatch || authMessageMatch || insufficientScopeMatch || status === 401;
  return {
    isAuthFailure,
    code: loweredCode ?? (insufficientScopeMatch ? "insufficient_scope" : status === 401 ? "unauthorized" : undefined),
    reason: message ?? (isAuthFailure ? "Google authorization is no longer valid" : undefined),
    status
  };
}
