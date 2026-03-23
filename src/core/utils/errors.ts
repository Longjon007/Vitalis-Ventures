type ErrorLike = {
  message?: unknown;
  error?: unknown;
  error_description?: unknown;
  details?: unknown;
  hint?: unknown;
};

function toReadableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  const safeFallback = fallback.trim() || 'Something went wrong';

  if (error instanceof Error) {
    return toReadableString(error.message) ?? safeFallback;
  }

  const asString = toReadableString(error);
  if (asString) return asString;

  if (error && typeof error === 'object') {
    const err = error as ErrorLike;
    const message =
      toReadableString(err.message) ??
      toReadableString(err.error_description) ??
      toReadableString(err.error);
    const details = toReadableString(err.details);
    const hint = toReadableString(err.hint);

    if (message && details && !message.includes(details)) {
      return `${message} ${details}`;
    }
    if (message) return message;
    if (details && hint) return `${details} ${hint}`;
    if (details) return details;
    if (hint) return hint;
  }

  return safeFallback;
}
