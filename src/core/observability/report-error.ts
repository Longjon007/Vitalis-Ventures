import { createCorrelationId, logError, type LogCategory, type LogSeverity } from './logger';

type ErrorContext = Record<string, unknown>;
type ErrorReportOptions = {
  severity?: Extract<LogSeverity, 'error' | 'critical'>;
  category?: LogCategory;
  operation?: string;
  correlationId?: string;
  tags?: string[];
};

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  return new Error('Unknown error');
}

function reportToOptionalSentry(error: Error, context?: ErrorContext): void {
  if (typeof window === 'undefined') return;

  const maybeSentry = (window as Window & {
    Sentry?: { captureException?: (err: Error, options?: { extra?: ErrorContext }) => void };
  }).Sentry;

  if (!maybeSentry?.captureException) return;

  try {
    maybeSentry.captureException(error, { extra: context });
  } catch {
    // Ignore provider failures.
  }
}

export function reportError(error: unknown, context?: ErrorContext): void {
  try {
    const normalized = normalizeError(error);
    const derivedCorrelationId =
      (typeof context?.correlationId === 'string' && context.correlationId.trim()) ||
      (typeof context?.requestId === 'string' && context.requestId.trim()) ||
      createCorrelationId('client');
    const enrichedContext: ErrorContext = {
      ...(context ?? {}),
      correlationId: derivedCorrelationId,
    };

    logError('Reported application error', normalized, enrichedContext, {
      severity: 'error',
      category: 'app',
      operation: 'report_error',
      correlationId: derivedCorrelationId,
      tags: ['error-report'],
    });
    reportToOptionalSentry(normalized, enrichedContext);
  } catch {
    // Error reporting must never throw.
  }
}

export function reportOperationalError(
  error: unknown,
  context?: ErrorContext,
  options?: ErrorReportOptions,
): void {
  try {
    const normalized = normalizeError(error);
    const derivedCorrelationId =
      options?.correlationId ||
      (typeof context?.correlationId === 'string' ? context.correlationId.trim() : '') ||
      (typeof context?.requestId === 'string' ? context.requestId.trim() : '') ||
      createCorrelationId('ops');
    const enrichedContext: ErrorContext = {
      ...(context ?? {}),
      correlationId: derivedCorrelationId,
    };

    logError('Reported operational error', normalized, enrichedContext, {
      severity: options?.severity ?? 'error',
      category: options?.category ?? 'ops',
      operation: options?.operation ?? 'operational_error',
      correlationId: derivedCorrelationId,
      tags: options?.tags ?? ['ops'],
    });
    reportToOptionalSentry(normalized, enrichedContext);
  } catch {
    // Error reporting must never throw.
  }
}
