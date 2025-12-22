import { INDEXEDDB_SHIM_SCRIPT } from "@/lib/indexeddb-shim-script";

/**
 * Injects an IndexedDB shim for restricted browser environments.
 *
 * This component addresses the "ReferenceError: Can't find variable: indexedDB"
 * error that occurs in restricted environments like Facebook's iOS in-app browser.
 * WalletConnect's idb-keyval dependency tries to access indexedDB directly without
 * checking if it exists, causing the app to crash.
 *
 * This shim provides a minimal no-op IndexedDB implementation that:
 * 1. Prevents the ReferenceError from occurring
 * 2. Allows WalletConnect to fail gracefully (returning errors instead of crashing)
 * 3. Lets the rest of the app function normally (non-wallet auth still works)
 *
 * This is placed in the <head> to ensure it runs before any scripts that depend
 * on indexedDB (specifically before Privy/WalletConnect initializes).
 *
 * Note: Uses a native script tag instead of Next.js Script with beforeInteractive
 * because the App Router doesn't require a _document.js and native scripts in head
 * are rendered synchronously during SSR, ensuring they run immediately on page load.
 */
export function IndexedDBShim() {
  return (
    <script
      id="gatewayz-indexeddb-shim"
      dangerouslySetInnerHTML={{ __html: INDEXEDDB_SHIM_SCRIPT }}
    />
  );
}
