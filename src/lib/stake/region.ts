// Where the /stake pages may be shown. The program is not available to US or
// Canadian persons, so visitors Vercel places in either country are served
// /stake/unavailable instead (src/middleware.ts). The country comes from the
// edge; an unknown country (local dev, header missing) is allowed.

export const RESTRICTED_STAKE_COUNTRIES: readonly string[] = ['US', 'CA'];

/** Non-HttpOnly cookie the middleware sets so client components can read the country. */
export const GEO_COOKIE = 'gw_geo';

export function isRestrictedCountry(country: string | null | undefined): boolean {
  if (!country) return false;
  return RESTRICTED_STAKE_COUNTRIES.includes(country.trim().toUpperCase());
}

/** Served in place of /stake pages to restricted visitors. */
export const STAKE_UNAVAILABLE_PATH = '/stake/unavailable';

/**
 * Whether the middleware should serve STAKE_UNAVAILABLE_PATH for this request.
 * Every /stake page is blocked except the terms (readable everywhere) and the
 * unavailable page itself.
 */
export function shouldBlockStakePath(pathname: string, country: string | null | undefined): boolean {
  if (!isRestrictedCountry(country)) return false;
  if (pathname !== '/stake' && !pathname.startsWith('/stake/')) return false;
  return pathname !== '/stake/terms' && pathname !== STAKE_UNAVAILABLE_PATH;
}
