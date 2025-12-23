import { EARLY_STORAGE_SHIM_SCRIPT } from "@/lib/early-storage-shim-script";

/**
 * Injects an early storage shim that runs BEFORE any JavaScript modules load.
 *
 * This addresses the SecurityError that occurs when WalletConnect and other
 * modules try to access localStorage/sessionStorage synchronously during
 * webpack module initialization on iOS Safari Private Mode.
 *
 * CRITICAL: This component must be placed in the <head> element, NOT the <body>.
 * Using a native script tag in the head ensures it runs synchronously during
 * SSR/hydration, BEFORE any bundled JavaScript (including WalletConnect) executes.
 *
 * This is different from the SafeStorageShim component which uses Next.js Script
 * with "afterInteractive" strategy - that runs too late to protect against
 * synchronous module initialization errors.
 *
 * How it works:
 * 1. Wraps window.localStorage and window.sessionStorage getters
 * 2. When accessed, tests if storage is actually available
 * 3. If access throws SecurityError, returns an in-memory fallback instead
 * 4. All subsequent accesses use the cached result (either real or fallback)
 */
export function EarlyStorageShim() {
  return (
    <script
      id="gatewayz-early-storage-shim"
      dangerouslySetInnerHTML={{ __html: EARLY_STORAGE_SHIM_SCRIPT }}
    />
  );
}
