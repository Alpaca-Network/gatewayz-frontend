/**
 * Navigate to the given URL via full page redirect.
 * Extracted for testability — JSDOM cannot handle window.location.href assignments.
 */
export function navigateTo(url: string): void {
  window.location.href = url;
}
