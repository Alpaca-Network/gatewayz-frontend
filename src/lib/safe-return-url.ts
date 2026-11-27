/**
 * Open-redirect guard for `returnUrl`-style query params.
 *
 * Only same-origin relative paths are allowed:
 * - must start with exactly one '/' (rejects '//evil.com' protocol-relative URLs)
 * - no backslashes anywhere (browsers treat '/\evil.com' like '//evil.com')
 * - no ASCII control characters or whitespace (the URL parser strips tabs/newlines,
 *   so '/\t/evil.com' would otherwise become '//evil.com')
 * - no scheme ('javascript:', 'https:', ...), which the leading '/' already implies
 * - must still resolve to the same origin when parsed as a URL
 *
 * Anything else returns `fallback`.
 */
const PLACEHOLDER_ORIGIN = 'https://return-url.invalid';

export function safeReturnUrl(value: unknown, fallback: string = '/'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) {
    return fallback;
  }

  if (value[0] !== '/' || value[1] === '/') {
    return fallback;
  }

  if (value.includes('\\')) {
    return fallback;
  }

  // Control characters (C0 + DEL) and any whitespace
  if (/[\u0000-\u001F\u007F\s]/.test(value)) {
    return fallback;
  }

  try {
    const parsed = new URL(value, PLACEHOLDER_ORIGIN);
    if (parsed.origin !== PLACEHOLDER_ORIGIN) {
      return fallback;
    }
  } catch {
    return fallback;
  }

  return value;
}
