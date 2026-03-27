export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    retryableStatuses = [429, 500, 502, 503],
    onRetry,
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries || !isRetryable(error, retryableStatuses)) {
        throw error;
      }
      const delayMs = calculateDelay(attempt, baseDelayMs, maxDelayMs, error);
      onRetry?.(attempt + 1, delayMs, error);
      await sleep(delayMs);
    }
  }
  throw new Error("Unreachable");
}

function isRetryable(error: unknown, statuses: number[]): boolean {
  if (error instanceof Error && error.cause instanceof Response) {
    return statuses.includes(error.cause.status);
  }
  // Network errors (no Response)
  if (error instanceof TypeError) return true;
  return false;
}

function calculateDelay(
  attempt: number,
  baseMs: number,
  maxMs: number,
  error: unknown,
): number {
  // Respect Retry-After header if present
  if (error instanceof Error && error.cause instanceof Response) {
    const retryAfter = error.cause.headers.get("retry-after");
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) return seconds * 1000;
    }
  }
  // Exponential backoff with full jitter
  const exponential = baseMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxMs);
  return Math.random() * capped;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
