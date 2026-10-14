// Where delegated staking may be offered. Counsel cleared the program
// everywhere except the United States and Canada (2026-10-14), so visitors
// Vercel places in either country never see it. The country comes from the
// edge (src/middleware.ts) as the `gw_geo` cookie; an unknown country (local
// dev, header missing) is allowed. IP location is easy to get around, which is
// why every wallet action also needs the self-attestation below.

export const RESTRICTED_DELEGATION_COUNTRIES: readonly string[] = ['US', 'CA'];

/** Non-HttpOnly cookie the middleware sets so client components can read the country. */
export const GEO_COOKIE = 'gw_geo';

/** localStorage key recording that this browser ticked the eligibility box. */
export const ATTESTATION_STORAGE_KEY = 'gatewayz_delegation_attested_v1';

export const ATTESTATION_LABEL = 'I am not a resident or citizen of the United States or Canada';

export function isRestrictedCountry(country: string | null | undefined): boolean {
  if (!country) return false;
  return RESTRICTED_DELEGATION_COUNTRIES.includes(country.trim().toUpperCase());
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

/** The `gw_geo` value from a `document.cookie` string, or null. */
export function countryFromCookie(cookie: string): string | null {
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === GEO_COOKIE) return decodeURIComponent(rest.join('=')) || null;
  }
  return null;
}

/** True when the visitor's edge-detected country is restricted. False on the server. */
export function isDelegationRegionBlocked(): boolean {
  if (typeof document === 'undefined') return false;
  return isRestrictedCountry(countryFromCookie(document.cookie));
}

export function hasAttested(): boolean {
  try {
    return window.localStorage.getItem(ATTESTATION_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function recordAttestation(): void {
  try {
    window.localStorage.setItem(ATTESTATION_STORAGE_KEY, 'true');
  } catch {
    // Storage blocked (private window): the box just shows again next visit.
  }
}
