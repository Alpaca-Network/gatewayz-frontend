export const DEFAULT_PREVIEW_REDIRECT_ORIGIN = "https://beta.gatewayz.ai";

interface BuildPreviewRedirectOptions {
  currentHref: string;
  targetOrigin?: string;
}

/**
 * Builds a preview-safe OAuth redirect URL by combining the canonical origin with the
 * current route (path, search params, and hash).
 */
export function buildPreviewSafeRedirectUrl(options: BuildPreviewRedirectOptions): string {
  const { currentHref, targetOrigin } = options;
  const canonicalOrigin = (targetOrigin && targetOrigin.trim()) || DEFAULT_PREVIEW_REDIRECT_ORIGIN;
  const fallbackOrigin = DEFAULT_PREVIEW_REDIRECT_ORIGIN;

  try {
    const currentUrl = new URL(currentHref);
    const canonicalUrl = new URL(canonicalOrigin);
    canonicalUrl.pathname = currentUrl.pathname || "/";
    canonicalUrl.search = currentUrl.search;
    canonicalUrl.hash = currentUrl.hash;
    return canonicalUrl.toString();
  } catch (error) {
    console.error("[Auth] Failed to build preview OAuth redirect URL", error);
    return fallbackOrigin;
  }
}
