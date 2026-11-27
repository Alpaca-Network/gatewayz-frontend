/**
 * Redacts credential-like query params from URLs before they leave the app in
 * Sentry events, transactions and breadcrumbs.
 *
 * Covers the retired `?token=&userId=` session hand-off, the one-time `?code=`
 * hand-off, and generic key params. The param stays (so the URL shape is still
 * useful when debugging) but its value becomes "[Filtered]".
 */

export const SENSITIVE_URL_PARAMS: readonly string[] = [
  'token',
  'code',
  'api_key',
  'apikey',
  'key',
  'access_token',
  'refresh_token',
  'id_token',
];

const FILTERED = '[Filtered]';
const SENSITIVE = new Set(SENSITIVE_URL_PARAMS.map((p) => p.toLowerCase()));

function scrubQuery(query: string): string {
  // Manual split keeps the original encoding and order of every other param.
  return query
    .split('&')
    .map((pair) => {
      const eq = pair.indexOf('=');
      const rawName = eq === -1 ? pair : pair.slice(0, eq);
      let name = rawName;
      try {
        name = decodeURIComponent(rawName.replace(/\+/g, ' '));
      } catch {
        // keep the raw name
      }
      return eq !== -1 && SENSITIVE.has(name.toLowerCase()) ? `${rawName}=${FILTERED}` : pair;
    })
    .join('&');
}

function scrubPart(part: string): string {
  const q = part.indexOf('?');
  if (q !== -1) {
    return part.slice(0, q + 1) + scrubQuery(part.slice(q + 1));
  }
  return part;
}

/**
 * Returns `url` with sensitive query param values redacted, in the query and
 * in a query-like fragment (`#code=...` or `#/path?code=...`). Non-strings pass
 * through.
 */
export function scrubUrl<T>(url: T): T {
  if (typeof url !== 'string' || (!url.includes('?') && !url.includes('#'))) {
    return url;
  }
  const hashAt = url.indexOf('#');
  if (hashAt === -1) {
    return scrubPart(url) as T;
  }
  const base = scrubPart(url.slice(0, hashAt));
  const fragment = url.slice(hashAt + 1);
  const scrubbedFragment = fragment.includes('?')
    ? scrubPart(fragment)
    : fragment.includes('=')
      ? scrubQuery(fragment)
      : fragment;
  return `${base}#${scrubbedFragment}` as T;
}

/** Same as scrubUrl, for a bare query string (with or without a leading "?"). */
export function scrubQueryString<T>(qs: T): T {
  if (typeof qs !== 'string' || qs.length === 0) {
    return qs;
  }
  return (qs.startsWith('?') ? `?${scrubQuery(qs.slice(1))}` : scrubQuery(qs)) as T;
}

type QueryStringValue = string | Array<[string, string]> | Record<string, string> | undefined;

function scrubQueryStringValue(qs: QueryStringValue): QueryStringValue {
  if (typeof qs === 'string') {
    return scrubQueryString(qs);
  }
  if (Array.isArray(qs)) {
    return qs.map(([k, v]) => [k, SENSITIVE.has(String(k).toLowerCase()) ? FILTERED : v] as [string, string]);
  }
  if (qs && typeof qs === 'object') {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(qs)) {
      out[k] = SENSITIVE.has(k.toLowerCase()) ? FILTERED : v;
    }
    return out;
  }
  return qs;
}

const URL_DATA_KEYS = ['url', 'from', 'to', 'href'] as const;

interface BreadcrumbLike {
  message?: string;
  data?: Record<string, unknown>;
}

/** Redacts URLs in a breadcrumb's `data.url/from/to/href` and message. Mutates and returns it. */
export function scrubBreadcrumb<T extends BreadcrumbLike | null | undefined>(breadcrumb: T): T {
  if (!breadcrumb) {
    return breadcrumb;
  }
  if (breadcrumb.data) {
    for (const key of URL_DATA_KEYS) {
      if (typeof breadcrumb.data[key] === 'string') {
        breadcrumb.data[key] = scrubUrl(breadcrumb.data[key] as string);
      }
    }
  }
  if (typeof breadcrumb.message === 'string' && breadcrumb.message.includes('?')) {
    breadcrumb.message = breadcrumb.message.replace(/\S*\?\S+/g, (m) => scrubUrl(m));
  }
  return breadcrumb;
}

interface EventLike {
  request?: { url?: string; query_string?: QueryStringValue; headers?: Record<string, string> };
  transaction?: string;
  breadcrumbs?: BreadcrumbLike[];
  tags?: Record<string, unknown>;
}

/** Redacts URLs in an event's request, transaction name, `url` tag and breadcrumbs. Mutates and returns it. */
export function scrubEventUrls<T extends EventLike | null | undefined>(event: T): T {
  if (!event) {
    return event;
  }
  if (event.request) {
    if (event.request.url) {
      event.request.url = scrubUrl(event.request.url);
    }
    if (event.request.query_string !== undefined) {
      event.request.query_string = scrubQueryStringValue(event.request.query_string);
    }
    const headers = event.request.headers;
    if (headers) {
      for (const name of Object.keys(headers)) {
        if (name.toLowerCase() === 'referer' || name.toLowerCase() === 'referrer') {
          headers[name] = scrubUrl(headers[name]);
        }
      }
    }
  }
  if (typeof event.transaction === 'string') {
    event.transaction = scrubUrl(event.transaction);
  }
  if (event.tags && typeof event.tags.url === 'string') {
    event.tags.url = scrubUrl(event.tags.url);
  }
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs.forEach((b) => scrubBreadcrumb(b));
  }
  return event;
}
