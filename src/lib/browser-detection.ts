/**
 * Browser detection utilities for handling problematic environments
 *
 * Certain browsers (especially iOS in-app browsers) have issues with IndexedDB
 * that can cause the Privy SDK's embedded wallet initialization to fail.
 *
 * Known issues:
 * - iOS WebKit can delete IndexedDB databases due to storage eviction (ITP)
 * - In-app browsers (Twitter, Facebook, Instagram, etc.) use restricted WebViews
 * - This causes "Database deleted by request of the user" errors
 * - Tauri desktop apps use tauri.localhost which is not HTTPS, causing
 *   "Embedded wallet is only available over HTTPS" errors
 */

/**
 * Check if the current browser is an iOS in-app browser
 * These browsers use WebKit with restricted storage that can cause IndexedDB issues
 */
export function isIOSInAppBrowser(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent || "";
  
  // Check if iOS (iPhone, iPad, iPod)
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  if (!isIOS) {
    return false;
  }
  
  // Check for known in-app browser indicators
  // These are WebViews that have storage restrictions
  const inAppIndicators = [
    /FBAN|FBAV/i,        // Facebook app
    /Twitter/i,           // Twitter app (X)
    /Instagram/i,         // Instagram app  
    /Line\//i,           // Line app
    /KAKAOTALK/i,        // KakaoTalk app
    /Snapchat/i,         // Snapchat app
    /WhatsApp/i,         // WhatsApp app
    /LinkedIn/i,         // LinkedIn app
    /Pinterest/i,        // Pinterest app
    /TikTok/i,           // TikTok app
    /Telegram/i,         // Telegram app
    /Discord/i,          // Discord app
    /Slack/i,            // Slack app
  ];
  
  // Check if running in a WebView (not Safari or Chrome)
  // Safari has "Safari" in UA, Chrome has "CriOS"
  const isSafari = /Safari/i.test(ua) && !/CriOS/i.test(ua);
  const isChrome = /CriOS/i.test(ua);
  const isFirefox = /FxiOS/i.test(ua);
  const isStandaloneBrowser = isSafari || isChrome || isFirefox;
  
  // Check for in-app browser indicators
  const hasInAppIndicator = inAppIndicators.some(pattern => pattern.test(ua));
  
  // If has an in-app indicator, it's definitely an in-app browser
  if (hasInAppIndicator) {
    return true;
  }
  
  // Additional check: iOS WebView often lacks Safari in the UA
  // but has "AppleWebKit" and "Mobile"
  const isWebView = /AppleWebKit/i.test(ua) && 
                    /Mobile/i.test(ua) && 
                    !isStandaloneBrowser;
  
  return isWebView;
}

/**
 * Check if IndexedDB is available and working
 * Returns a promise that resolves to true if IndexedDB is functional
 */
export async function checkIndexedDBAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return false;
  }
  
  const testDbName = "__gatewayz_idb_test__";
  
  return new Promise((resolve) => {
    try {
      // Try to open a test database
      const request = indexedDB.open(testDbName, 1);
      
      // Set a timeout in case the request hangs
      const timeout = setTimeout(() => {
        resolve(false);
      }, 3000);
      
      request.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
      
      request.onsuccess = () => {
        clearTimeout(timeout);
        // Clean up test database
        try {
          request.result.close();
          indexedDB.deleteDatabase(testDbName);
        } catch {
          // Ignore cleanup errors
        }
        resolve(true);
      };
      
      request.onblocked = () => {
        clearTimeout(timeout);
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}

/**
 * Check if we're running in a Tauri desktop app
 * Tauri uses tauri.localhost which is treated as HTTP, not HTTPS
 */
export function isTauriDesktop(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  // Check for Tauri global object
  if ("__TAURI__" in window) {
    return true;
  }

  // Also check for tauri.localhost hostname
  if (
    typeof window.location !== "undefined" &&
    window.location.hostname === "tauri.localhost"
  ) {
    return true;
  }

  return false;
}

/**
 * Synchronously check if we should disable embedded wallets
 * This is a quick check that doesn't require async operations
 */
export function shouldDisableEmbeddedWallets(): boolean {
  // Disable embedded wallets on Tauri desktop apps
  // Tauri uses tauri.localhost which is not HTTPS, causing
  // "Embedded wallet is only available over HTTPS" error
  if (isTauriDesktop()) {
    return true;
  }

  // Disable embedded wallets on iOS in-app browsers
  // These environments have unreliable IndexedDB storage
  return isIOSInAppBrowser();
}

/**
 * Async check if embedded wallets should be disabled
 * This includes an IndexedDB availability check
 */
export async function shouldDisableEmbeddedWalletsAsync(): Promise<boolean> {
  // Quick check for Tauri desktop first
  if (isTauriDesktop()) {
    return true;
  }

  // Quick check for iOS in-app browsers
  if (isIOSInAppBrowser()) {
    return true;
  }

  // If not an obvious problematic browser, verify IndexedDB works
  const idbAvailable = await checkIndexedDBAvailable();
  return !idbAvailable;
}

/**
 * Get browser environment info for debugging
 */
export function getBrowserEnvironmentInfo(): {
  isIOS: boolean;
  isInAppBrowser: boolean;
  isTauri: boolean;
  userAgent: string;
  indexedDBSupported: boolean;
} {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      isIOS: false,
      isInAppBrowser: false,
      isTauri: false,
      userAgent: "",
      indexedDBSupported: false,
    };
  }

  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  return {
    isIOS,
    isInAppBrowser: isIOSInAppBrowser(),
    isTauri: isTauriDesktop(),
    userAgent: ua,
    indexedDBSupported: typeof indexedDB !== "undefined",
  };
}
