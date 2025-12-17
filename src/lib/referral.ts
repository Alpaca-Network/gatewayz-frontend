/**
 * Referral Code Utilities
 * Manages referral code storage and retrieval from URL and localStorage (with safe storage fallback)
 */

import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from './safe-storage';

const REFERRAL_CODE_KEY = 'gatewayz_referral_code';
const REFERRAL_SOURCE_KEY = 'gatewayz_referral_source';

/**
 * Extract referral code from URL parameters
 */
export function getReferralCodeFromURL(): string | null {
  if (typeof window === 'undefined') return null;

  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('ref') || urlParams.get('referral');
}

/**
 * Get stored referral code from localStorage (with safe storage fallback)
 */
export function getStoredReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  return safeLocalStorageGet(REFERRAL_CODE_KEY);
}

/**
 * Store referral code in localStorage (with safe storage fallback)
 * @param code The referral code to store
 * @param source Where the code came from (e.g., 'url', 'manual')
 */
export function storeReferralCode(code: string, source: string = 'url'): void {
  if (typeof window === 'undefined') return;

  safeLocalStorageSet(REFERRAL_CODE_KEY, code);
  safeLocalStorageSet(REFERRAL_SOURCE_KEY, source);

  console.log(`[Referral] Stored referral code: ${code} (source: ${source})`);
}

/**
 * Clear referral code from localStorage (with safe storage fallback)
 */
export function clearReferralCode(): void {
  if (typeof window === 'undefined') return;

  safeLocalStorageRemove(REFERRAL_CODE_KEY);
  safeLocalStorageRemove(REFERRAL_SOURCE_KEY);
}

/**
 * Get referral code from URL or localStorage
 * Priority: URL > localStorage
 */
export function getReferralCode(): string | null {
  // First check URL
  const urlCode = getReferralCodeFromURL();
  if (urlCode) {
    // Store it for future use
    storeReferralCode(urlCode, 'url');
    return urlCode;
  }

  // Fall back to stored code
  return getStoredReferralCode();
}

/**
 * Initialize referral code tracking on page load
 * Should be called early in the app lifecycle
 */
export function initializeReferralTracking(): void {
  if (typeof window === 'undefined') return;

  const urlCode = getReferralCodeFromURL();
  if (urlCode) {
    storeReferralCode(urlCode, 'url');
    console.log('[Referral] Captured referral code from URL:', urlCode);
    // Clear any previous dismissal when a new referral code arrives
    // Note: sessionStorage used intentionally here for non-persistent dismissal state
    try {
      sessionStorage.removeItem('gatewayz_referral_toast_dismissed');
    } catch {
      // Silently fail if sessionStorage is unavailable
    }

    // CRITICAL FIX: Remove the ref parameter from the URL to prevent it from interfering with chat functionality
    // The referral code is now safely stored in localStorage and will be sent during authentication
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('ref');
      url.searchParams.delete('referral');
      // Use replaceState to update URL without triggering a page reload
      window.history.replaceState({}, '', url.toString());
      console.log('[Referral] Removed ref parameter from URL');
    } catch (error) {
      console.warn('[Referral] Failed to remove ref parameter from URL:', error);
    }
  } else {
    const storedCode = getStoredReferralCode();
    if (storedCode) {
      console.log('[Referral] Found stored referral code:', storedCode);
    }
  }
}

/**
 * Get the referral source (with safe storage fallback)
 */
export function getReferralSource(): string | null {
  if (typeof window === 'undefined') return null;
  return safeLocalStorageGet(REFERRAL_SOURCE_KEY);
}
