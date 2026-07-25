import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { flattenZodIssues } from '../lib/http';
import { logger } from '../lib/logger';
import { isProduction } from '../config/env';
import type { ApiErrorBody } from '@howzat/shared';

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiErrorBody = {
    error: { code: 'NOT_FOUND', message: `No route matches ${req.method} ${req.path}` },
  };
  res.status(404).json(body);
};

/**
 * The single place an error becomes a response. Anything not already an
 * AppError is normalized here so clients never see a Prisma or Zod internal.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appError = normalize(err);

  const logPayload = {
    err,
    code: appError.code,
    status: appError.status,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
  };

  if (appError.expected) {
    logger.info(logPayload, appError.message);
  } else {
    logger.error(logPayload, 'Unhandled error');
  }

  if (appError.status === 429) {
    const retry = (appError.details as { retryAfterSeconds?: number } | undefined)
      ?.retryAfterSeconds;
    if (retry) res.setHeader('Retry-After', String(retry));
  }

  const body: ApiErrorBody = {
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details !== undefined ? { details: appError.details } : {}),
    },
  };

  res.status(appError.status).json(body);
};

function normalize(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    return new AppError(400, 'BAD_REQUEST', 'The request is invalid', {
      details: flattenZodIssues(err),
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const target = (err.meta?.target as string[] | undefined)?.join(', ');
        return new AppError(
          409,
          'DUPLICATE',
          target ? `That ${target} is already taken` : 'That value is already taken',
        );
      }
      case 'P2025':
        return new AppError(404, 'NOT_FOUND', 'Resource not found');
      case 'P2003':
        return new AppError(409, 'FK_CONSTRAINT', 'That reference points at something missing');
      default:
        break;
    }
  }

  // Unknown — log the detail, tell the client nothing useful to an attacker.
  return new AppError(
    500,
    'INTERNAL_ERROR',
    isProduction ? 'Something went wrong' : errorMessage(err),
    { expected: false },
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
