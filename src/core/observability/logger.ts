export type LogContext = Record<string, unknown>;
export type LogSeverity = 'debug' | 'info' | 'warn' | 'error' | 'critical';
export type LogCategory =
  | 'app'
  | 'auth'
  | 'billing'
  | 'generation'
  | 'analytics'
  | 'network'
  | 'ops'
  | 'ui'
  | 'unknown'
  | string;

export type LogOptions = {
  severity?: LogSeverity;
  category?: LogCategory;
  operation?: string;
  correlationId?: string;
  requestId?: string;
  tags?: string[];
};

const CORRELATION_ID_REGEX = /^[a-zA-Z0-9._:-]{8,128}$/;

const REDACT_KEYS = [
  'token',
  'secret',
  'password',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'session',
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return REDACT_KEYS.some((blocked) => normalized.includes(blocked));
}

function normalizeCorrelationId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || !CORRELATION_ID_REGEX.test(normalized)) return null;
  return normalized;
}

export function createCorrelationId(prefix = 'mf'): string {
  try {
    if (globalThis.crypto?.randomUUID) {
      return `${prefix}-${globalThis.crypto.randomUUID()}`;
    }
  } catch {
    // Fall through to non-crypto fallback.
  }

  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[truncated]';
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }
  if (!value || typeof value !== 'object') return value;

  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (isSensitiveKey(key)) {
      output[key] = '[redacted]';
      continue;
    }
    output[key] = redactValue(raw, depth + 1);
  }
  return output;
}

function log(
  level: 'info' | 'warn' | 'error',
  message: string,
  context?: LogContext,
  options?: LogOptions,
): void {
  try {
    const safeContext = context ? (redactValue(context) as LogContext) : undefined;
    const severity: LogSeverity =
      options?.severity ??
      (level === 'info' ? 'info' : level === 'warn' ? 'warn' : 'error');
    const correlationId =
      normalizeCorrelationId(options?.correlationId) ??
      normalizeCorrelationId(options?.requestId) ??
      normalizeCorrelationId(safeContext?.correlationId) ??
      normalizeCorrelationId(safeContext?.requestId);
    const timestamp = new Date().toISOString();
    const payloadContext: LogContext = {
      severity,
      category: options?.category ?? 'app',
      ...(options?.operation ? { operation: options.operation } : {}),
      ...(options?.tags?.length ? { tags: options.tags } : {}),
      ...(correlationId ? { correlationId } : {}),
      ...(safeContext ? { context: safeContext } : {}),
    };
    const payload = [timestamp, message, payloadContext];

    if (level === 'info') {
      console.info(...payload);
      return;
    }
    if (level === 'warn') {
      console.warn(...payload);
      return;
    }
    console.error(...payload);
  } catch {
    // Logging must never crash the app.
  }
}

export function logInfo(
  message: string,
  context?: LogContext,
  options?: LogOptions,
): void {
  log('info', message, context, options);
}

export function logWarn(
  message: string,
  context?: LogContext,
  options?: LogOptions,
): void {
  log('warn', message, context, options);
}

export function logError(
  message: string,
  error?: unknown,
  context?: LogContext,
  options?: LogOptions,
): void {
  const mergedContext: LogContext = {
    ...(context ?? {}),
  };

  if (error instanceof Error) {
    mergedContext.errorName = error.name;
    mergedContext.errorMessage = error.message;
    if (import.meta.env.DEV) {
      mergedContext.errorStack = error.stack;
    }
  } else if (typeof error === 'string') {
    mergedContext.errorMessage = error;
  } else if (error !== undefined) {
    mergedContext.error = redactValue(error);
  }

  log('error', message, mergedContext, options);
}
