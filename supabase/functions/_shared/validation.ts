export type JsonRecord = Record<string, unknown>;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_ID_REGEX = /^[a-zA-Z0-9._:-]{8,128}$/;

const DEFAULT_ALLOWED_HEADERS = [
  'authorization',
  'content-type',
  'stripe-signature',
  'x-api-key',
  'x-request-id',
  'x-correlation-id',
];

const DEFAULT_ALLOWED_METHODS = ['POST', 'OPTIONS'];

function createFallbackRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeRequestId(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (!REQUEST_ID_REGEX.test(normalized)) return null;
  return normalized;
}

function normalizeOrigin(value: string): string | null {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function parseAllowedOriginsFromEnv(): string[] {
  const rawAllowed = Deno.env.get('ALLOWED_ORIGINS') ?? '';
  const appOrigin = Deno.env.get('APP_ORIGIN') ?? '';

  const candidates = [...rawAllowed.split(','), appOrigin]
    .map((value) => value.trim())
    .filter(Boolean);

  const uniqueOrigins = new Set<string>();
  for (const value of candidates) {
    const normalized = normalizeOrigin(value);
    if (normalized) {
      uniqueOrigins.add(normalized);
    }
  }

  return [...uniqueOrigins];
}

export function getRequestOrigin(req: Request): string | null {
  const originHeader = req.headers.get('origin');
  if (!originHeader) return null;
  return normalizeOrigin(originHeader);
}

export function isOriginAllowed(
  req: Request,
  allowedOrigins: string[],
): boolean {
  const requestOrigin = getRequestOrigin(req);
  if (!requestOrigin) return true;
  return allowedOrigins.includes(requestOrigin);
}

export function buildCorsHeaders(
  req: Request,
  allowedOrigins: string[],
  options?: {
    allowHeaders?: string[];
    allowMethods?: string[];
    allowCredentials?: boolean;
    exposeHeaders?: string[];
  },
): HeadersInit {
  const requestOrigin = getRequestOrigin(req);
  const allowOrigin =
    requestOrigin && allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : 'null';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': (options?.allowHeaders ?? DEFAULT_ALLOWED_HEADERS).join(', '),
    'Access-Control-Allow-Methods': (options?.allowMethods ?? DEFAULT_ALLOWED_METHODS).join(', '),
    ...(options?.exposeHeaders?.length
      ? { 'Access-Control-Expose-Headers': options.exposeHeaders.join(', ') }
      : {}),
    ...(options?.allowCredentials ? { 'Access-Control-Allow-Credentials': 'true' } : {}),
    Vary: 'Origin',
  };
}

export function jsonResponse(
  body: JsonRecord,
  status = 200,
  headers: HeadersInit = {},
): Response {
  const mergedHeaders = new Headers(headers);
  mergedHeaders.set('Content-Type', 'application/json');

  return new Response(JSON.stringify(body), {
    status,
    headers: mergedHeaders,
  });
}

export function errorResponse(
  status: number,
  error: string,
  headers: HeadersInit = {},
  details?: JsonRecord,
): Response {
  return jsonResponse(
    {
      ok: false,
      error,
      ...(details ? { details } : {}),
    },
    status,
    headers,
  );
}

export function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function requireString(
  value: unknown,
  fieldName: string,
  options?: { minLength?: number; maxLength?: number },
): ValidationResult<string> {
  const normalized = normalizeString(value);
  if (!normalized) {
    return { ok: false, error: `${fieldName} is required.` };
  }

  if (options?.minLength && normalized.length < options.minLength) {
    return {
      ok: false,
      error: `${fieldName} must be at least ${options.minLength} characters.`,
    };
  }

  if (options?.maxLength && normalized.length > options.maxLength) {
    return {
      ok: false,
      error: `${fieldName} must be at most ${options.maxLength} characters.`,
    };
  }

  return { ok: true, value: normalized };
}

export function requireEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fieldName: string,
): ValidationResult<T> {
  const normalized = normalizeString(value)?.toLowerCase() as T | undefined;
  if (!normalized || !allowedValues.includes(normalized)) {
    return {
      ok: false,
      error: `${fieldName} must be one of: ${allowedValues.join(', ')}.`,
    };
  }
  return { ok: true, value: normalized };
}

export function requireNumberInRange(
  value: unknown,
  fieldName: string,
  min: number,
  max: number,
  options?: { integer?: boolean },
): ValidationResult<number> {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return { ok: false, error: `${fieldName} must be a valid number.` };
  }

  if (parsed < min || parsed > max) {
    return {
      ok: false,
      error: `${fieldName} must be between ${min} and ${max}.`,
    };
  }

  if (options?.integer && !Number.isInteger(parsed)) {
    return { ok: false, error: `${fieldName} must be an integer.` };
  }

  return { ok: true, value: parsed };
}

export function requireUuid(
  value: unknown,
  fieldName: string,
): ValidationResult<string> {
  const stringResult = requireString(value, fieldName, { maxLength: 64 });
  if (!stringResult.ok) return stringResult;

  if (!UUID_REGEX.test(stringResult.value)) {
    return {
      ok: false,
      error: `${fieldName} must be a valid UUID.`,
    };
  }

  return stringResult;
}

export function getOrCreateRequestId(req: Request): string {
  const fromRequestId = normalizeRequestId(req.headers.get('x-request-id'));
  if (fromRequestId) return fromRequestId;

  const fromCorrelationId = normalizeRequestId(req.headers.get('x-correlation-id'));
  if (fromCorrelationId) return fromCorrelationId;

  try {
    return crypto.randomUUID();
  } catch {
    return createFallbackRequestId();
  }
}

export function withRequestIdHeader(
  headers: HeadersInit = {},
  requestId: string,
): HeadersInit {
  const merged = new Headers(headers);
  merged.set('X-Request-Id', requestId);
  return Object.fromEntries(merged.entries());
}

export function withRequestIdDetails(
  requestId: string,
  details?: JsonRecord,
): JsonRecord {
  return {
    requestId,
    ...(details ?? {}),
  };
}

export function isAllowedHttpUrl(
  value: string | null,
  allowedOrigins: string[],
): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return allowedOrigins.includes(parsed.origin);
  } catch {
    return false;
  }
}

export function safeLogInfo(event: string, context: JsonRecord = {}): void {
  console.info(`[edge:${event}]`, context);
}

export function safeLogWarn(event: string, context: JsonRecord = {}): void {
  console.warn(`[edge:${event}]`, context);
}
