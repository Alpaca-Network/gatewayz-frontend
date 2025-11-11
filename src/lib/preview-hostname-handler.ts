/**
 * Vercel Preview Deployment Hostname Handler
 *
 * This utility handles OAuth redirects for Vercel preview deployments.
 * When users authenticate via OAuth providers (Google, GitHub, etc.),
 * they are redirected away from the site and then back. However, Privy
 * might redirect to the production domain instead of the preview URL.
 *
 * This workaround:
 * 1. Detects if we're on a Vercel preview deployment
 * 2. Saves the preview hostname to localStorage before OAuth redirect
 * 3. Restores the correct preview hostname after OAuth callback
 */

const STORAGE_KEY = 'gatewayz_preview_hostname';
const STORAGE_TIMESTAMP_KEY = 'gatewayz_preview_hostname_timestamp';
const STORAGE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Detects if the current hostname is a Vercel preview deployment
 */
export function isVercelPreviewDeployment(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const hostname = window.location.hostname;

  // Vercel preview deployments follow patterns like:
  // - <project>-<hash>-<team>.vercel.app
  // - <project>-git-<branch>-<team>.vercel.app
  // - custom-domain-<hash>.vercel.app
  const isVercelDomain = hostname.includes('.vercel.app');
  const isNotProduction = !hostname.includes('beta.gatewayz.ai') &&
                          !hostname.includes('gatewayz.ai') &&
                          hostname !== 'localhost';

  return isVercelDomain && isNotProduction;
}

/**
 * Gets the current preview hostname if applicable
 */
export function getPreviewHostname(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!isVercelPreviewDeployment()) {
    return null;
  }

  return window.location.hostname;
}

/**
 * Saves the preview hostname to localStorage before OAuth redirect
 */
export function savePreviewHostname(): void {
  const hostname = getPreviewHostname();

  if (!hostname) {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, hostname);
    localStorage.setItem(STORAGE_TIMESTAMP_KEY, Date.now().toString());
    console.log('[Preview] Saved preview hostname:', hostname);
  } catch (error) {
    console.error('[Preview] Failed to save preview hostname:', error);
  }
}

/**
 * Retrieves the saved preview hostname from localStorage
 */
export function getSavedPreviewHostname(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const hostname = localStorage.getItem(STORAGE_KEY);
    const timestamp = localStorage.getItem(STORAGE_TIMESTAMP_KEY);

    if (!hostname || !timestamp) {
      return null;
    }

    // Check if the saved hostname has expired
    const age = Date.now() - parseInt(timestamp, 10);
    if (age > STORAGE_TTL) {
      console.log('[Preview] Saved hostname expired, clearing...');
      clearSavedPreviewHostname();
      return null;
    }

    return hostname;
  } catch (error) {
    console.error('[Preview] Failed to retrieve saved preview hostname:', error);
    return null;
  }
}

/**
 * Clears the saved preview hostname from localStorage
 */
export function clearSavedPreviewHostname(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
  } catch (error) {
    console.error('[Preview] Failed to clear saved preview hostname:', error);
  }
}

/**
 * Checks if we need to restore the preview hostname after OAuth callback
 * This happens when:
 * 1. We're NOT currently on a preview deployment
 * 2. We have a saved preview hostname in localStorage
 * 3. The saved hostname is different from the current hostname
 */
export function shouldRestorePreviewHostname(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const currentHostname = window.location.hostname;
  const savedHostname = getSavedPreviewHostname();

  if (!savedHostname) {
    return false;
  }

  // If we're already on the correct preview hostname, no need to restore
  if (currentHostname === savedHostname) {
    clearSavedPreviewHostname();
    return false;
  }

  // If we're on production but have a saved preview hostname, restore it
  const isOnProduction = currentHostname.includes('beta.gatewayz.ai') ||
                        currentHostname.includes('gatewayz.ai');

  return isOnProduction && !!savedHostname;
}

/**
 * Restores the preview hostname by redirecting to the saved preview URL
 */
export function restorePreviewHostname(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const savedHostname = getSavedPreviewHostname();

  if (!savedHostname) {
    console.log('[Preview] No saved hostname to restore');
    return;
  }

  const currentUrl = new URL(window.location.href);
  const newUrl = new URL(currentUrl.toString());
  newUrl.hostname = savedHostname;

  console.log('[Preview] Restoring preview hostname:', {
    from: currentUrl.hostname,
    to: savedHostname,
    fullUrl: newUrl.toString()
  });

  // Clear the saved hostname before redirecting to prevent loops
  clearSavedPreviewHostname();

  // Redirect to the preview deployment
  window.location.href = newUrl.toString();
}

/**
 * Initialize preview hostname handling
 * Call this early in your app initialization
 */
export function initializePreviewHostnameHandler(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Check if we need to restore the preview hostname (after OAuth callback)
  if (shouldRestorePreviewHostname()) {
    console.log('[Preview] Detected OAuth callback, restoring preview hostname...');
    restorePreviewHostname();
    return;
  }

  // If we're on a preview deployment, save the hostname
  if (isVercelPreviewDeployment()) {
    savePreviewHostname();
  }
}
