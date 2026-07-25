/**
 * Every failure the API produces is an AppError, so the error middleware has
 * exactly one shape to serialize: { error: { code, message, details? } }.
 * Anything else that escapes a handler is an unexpected bug and becomes a
 * generic 500 with the detail logged, never leaked.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  /** Expected failures (validation, 404) are logged at info, not error. */
  readonly expected: boolean;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { details?: unknown; expected?: boolean } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.expected = options.expected ?? status < 500;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, { details });

export const unauthorized = (message = 'Sign in to continue') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'You do not have access to this resource') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`);

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, 'CONFLICT', message, { details });

/**
 * A rule of cricket or of the tournament lifecycle was broken — distinct from
 * a malformed request. The UI shows these verbatim to the organizer/scorer.
 */
export const unprocessable = (code: string, message: string, details?: unknown) =>
  new AppError(422, code, message, { details });

export const tooManyRequests = (message: string, retryAfterSeconds: number) =>
  new AppError(429, 'RATE_LIMITED', message, { details: { retryAfterSeconds } });

export const internal = (message = 'Something went wrong') =>
  new AppError(500, 'INTERNAL_ERROR', message, { expected: false });
