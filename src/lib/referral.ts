/**
 * Referral Code Utilities
 * Manages referral code storage and retrieval from URL and localStorage
 */

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
 * Get stored referral code from localStorage
 */
export function getStoredReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFERRAL_CODE_KEY);
}

/**
 * Store referral code in localStorage
 * @param code The referral code to store
 * @param source Where the code came from (e.g., 'url', 'manual')
 */
export function storeReferralCode(code: string, source: string = 'url'): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(REFERRAL_CODE_KEY, code);
  localStorage.setItem(REFERRAL_SOURCE_KEY, source);

  console.log(`[Referral] Stored referral code: ${code} (source: ${source})`);
}

/**
 * Clear referral code from localStorage
 */
export function clearReferralCode(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(REFERRAL_CODE_KEY);
  localStorage.removeItem(REFERRAL_SOURCE_KEY);
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
    sessionStorage.removeItem('gatewayz_referral_toast_dismissed');
  } else {
    const storedCode = getStoredReferralCode();
    if (storedCode) {
      console.log('[Referral] Found stored referral code:', storedCode);
    }
  }
}

/**
 * Get the referral source
 */
export function getReferralSource(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFERRAL_SOURCE_KEY);
}
