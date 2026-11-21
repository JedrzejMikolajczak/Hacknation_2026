import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { fail } from '../lib/envelope';

/** Brak dopasowanej ścieżki → 404 NOT_FOUND w kopercie. */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json(fail('NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};

function isJsonParseError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type: unknown }).type === 'entity.parse.failed'
  );
}

/** Błędy zod (i niepoprawny JSON) → 422 VALIDATION_ERROR, pozostałe → 500 INTERNAL_ERROR. */
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(422).json(fail('VALIDATION_ERROR', 'Request validation failed', err.issues));
    return;
  }
  if (isJsonParseError(err)) {
    res.status(422).json(fail('VALIDATION_ERROR', 'Request body is not valid JSON'));
    return;
  }
  console.error(err);
  res.status(500).json(fail('INTERNAL_ERROR', 'Internal server error'));
};
