import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { CalculationError } from '@shared/engine';
import { fail } from '../lib/envelope';
import { validationMessage } from '../lib/validationMessage';

/** Brak dopasowanej ścieżki → 404 NOT_FOUND w kopercie. */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json(fail('NOT_FOUND', 'Nie znaleziono żądanego zasobu.'));
};

function isJsonParseError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type: unknown }).type === 'entity.parse.failed'
  );
}

/** Błędy zod, CalculationError i niepoprawny JSON → 422 VALIDATION_ERROR, pozostałe → 500 INTERNAL_ERROR. */
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof CalculationError) {
    res
      .status(422)
      .json(fail('VALIDATION_ERROR', err.message, [{ field: err.field, message: err.message }]));
    return;
  }
  if (err instanceof ZodError) {
    const issues = err.issues.map((issue) => ({ ...issue, message: validationMessage(issue) }));
    res.status(422).json(fail('VALIDATION_ERROR', issues[0]?.message ?? 'Sprawdź dane w formularzu.', issues));
    return;
  }
  if (isJsonParseError(err)) {
    res.status(422).json(fail('VALIDATION_ERROR', 'Dane mają nieprawidłowy format. Wprowadź je ponownie lub sprawdź plik.'));
    return;
  }
  console.error(err);
  res.status(500).json(fail('INTERNAL_ERROR', 'Wystąpił błąd serwera. Spróbuj ponownie.'));
};
