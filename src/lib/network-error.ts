/**
 * Helpers for normalizing network-related errors (timeouts, aborts, Safari quirks, etc.)
 */

type MaybeError = {
  name?: string;
  message?: string;
};

function getErrorParts(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name ?? 'Error', message: error.message ?? '' };
  }

  if (typeof error === 'object' && error !== null) {
    const { name = 'Error', message = '' } = error as MaybeError;
    return { name, message };
  }

  if (typeof error === 'string') {
    return { name: 'Error', message: error };
  }

  return { name: 'Error', message: '' };
}

/**
 * Safari (and some WebKit-based browsers) surface aborted fetches as
 * `TypeError: Load failed` instead of the standard `AbortError`.
 */
function isSafariLoadFailedError(name: string, message: string): boolean {
  return name === 'TypeError' && message === 'Load failed';
}

/**
 * Determines whether the provided error is the result of a timeout, abort,
 * or transient network failure that we can safely treat as a benign issue.
 */
export function isAbortOrNetworkError(error: unknown): boolean {
  const { name, message } = getErrorParts(error);
  const normalizedMessage = message.toLowerCase();

  if (name === 'AbortError' || name === 'TimeoutError') {
    return true;
  }

  if (isSafariLoadFailedError(name, message)) {
    return true;
  }

  if (
    normalizedMessage.includes('network request failed') ||
    normalizedMessage.includes('networkerror') ||
    normalizedMessage.includes('request timed out') ||
    normalizedMessage.includes('timeout')
  ) {
    return true;
  }

  return false;
}

/**
 * Returns a normalized, human-friendly message for logging or telemetry.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    const json = JSON.stringify(error);
    if (json) {
      return json;
    }
  } catch {
  }

  if (error === undefined || error === null) {
    return 'Unknown error';
  }

  return String(error);
}
