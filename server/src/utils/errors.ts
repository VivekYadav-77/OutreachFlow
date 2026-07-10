export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 500,
    public readonly code = "INTERNAL_ERROR",
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class OAuthError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 401, "OAUTH_ERROR", details);
  }
}

export class QueueError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, "QUEUE_ERROR", details);
  }
}
