/**
 * The backend returns a key's full value only once, in the create (or rotate)
 * response. Every list/read returns it masked, e.g. "gw_live_...a1b2".
 */

/** True for a masked key from a list response (not a usable credential). */
export function isMaskedApiKey(value: string | null | undefined): boolean {
  return typeof value === "string" && value.includes("...");
}

/** Short display form of a key we hold in full, e.g. "gw_live_abcd...a1b2". */
export function shortApiKey(value: string): string {
  if (isMaskedApiKey(value) || value.length <= 16) return value;
  return `${value.substring(0, 12)}...${value.substring(value.length - 4)}`;
}

/** Does the full key we hold match a masked list entry (same last 4)? */
export function matchesMaskedKey(fullKey: string | null | undefined, masked: string): boolean {
  if (!fullKey || isMaskedApiKey(fullKey)) return false;
  return masked.endsWith(fullKey.slice(-4));
}
