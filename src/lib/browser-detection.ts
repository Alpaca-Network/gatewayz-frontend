/**
 * Browser detection utilities
 * Used for feature detection and workarounds for browser-specific bugs
 */

/**
 * Check if the current browser is Safari.
 * Safari has known issues with IndexedDB that can cause hangs during
 * initialization of features like embedded wallets.
 * 
 * Detection method:
 * - Safari includes "Safari" in user agent but NOT "Chrome" or "Chromium"
 * - Chrome-based browsers include both "Chrome" and "Safari"
 */
export function isSafariBrowser(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent;
  
  // Safari includes "Safari" but not "Chrome" or "Chromium"
  // Chrome and Chromium-based browsers (Edge, Opera, Brave) include both
  const hasSafari = userAgent.includes('Safari');
  const hasChrome = userAgent.includes('Chrome') || userAgent.includes('Chromium');
  
  return hasSafari && !hasChrome;
}

/**
 * Check if the current browser is a WebKit-based browser (Safari, iOS browsers).
 * All browsers on iOS use WebKit, so they may have similar IndexedDB issues.
 */
export function isWebKitBrowser(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent;
  
  // Check for WebKit (Safari and all iOS browsers)
  // iOS forces all browsers to use WebKit
  const hasWebKit = userAgent.includes('AppleWebKit');
  const hasChrome = userAgent.includes('Chrome') || userAgent.includes('Chromium');
  
  // Return true for WebKit browsers that aren't Chrome-based
  // This catches Safari desktop and all iOS browsers
  return hasWebKit && !hasChrome;
}

/**
 * Check if we're on iOS (iPhone, iPad, iPod).
 * All iOS browsers use WebKit and may have similar IndexedDB issues.
 */
export function isIOSDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent;
  
  // Check for iOS devices
  return /iPhone|iPad|iPod/.test(userAgent);
}

/**
 * Check if the browser may have IndexedDB issues.
 * This includes Safari on desktop and all iOS browsers.
 * 
 * Known issues:
 * - Safari IndexedDB can hang during database open operations
 * - iOS browsers all use WebKit which has similar issues
 * - The bug typically manifests as `n.result.createObjectStore` being undefined
 */
export function hasIndexedDBIssues(): boolean {
  return isSafariBrowser() || isIOSDevice();
}
