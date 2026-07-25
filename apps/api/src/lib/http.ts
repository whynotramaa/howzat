import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { z, ZodTypeAny } from 'zod';
import { badRequest } from './errors';

/**
 * Express 4 does not forward rejected promises to the error middleware, so
 * every async handler is wrapped exactly once, here.
 */
export function asyncHandler<
  Req extends Request = Request,
  Res extends Response = Response,
>(fn: (req: Req, res: Res, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req as Req, res as Res, next).catch(next);
  };
}

/** Parses a body against a schema, converting Zod issues into a 400. */
export function parseBody<T extends ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw badRequest('The request body is invalid', flattenZodIssues(result.error));
  }
  return result.data;
}

export function parseQuery<T extends ZodTypeAny>(schema: T, query: unknown): z.infer<T> {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw badRequest('The query string is invalid', flattenZodIssues(result.error));
  }
  return result.data;
}

/**
 * Field-keyed messages, which is what a form needs — Zod's default nested
 * issue array is awkward to render next to an input.
 */
export function flattenZodIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** Reads a required route param, failing loudly rather than passing undefined on. */
export function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw badRequest(`Missing route parameter: ${name}`);
  }
  return value;
}
