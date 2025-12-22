import { INDEXEDDB_SHIM_SCRIPT } from "@/lib/indexeddb-shim-script";

/**
 * Injects an early IndexedDB shim that provides fallback for Safari Private Browsing.
 *
 * Safari's Private Browsing mode restricts IndexedDB access, causing libraries like
 * `idb-keyval` (used by wallet connectors via unstorage) to crash when they try to
 * access `request.result.createObjectStore()` and `request.result` is undefined.
 *
 * This shim:
 * 1. Wraps `indexedDB.open()` to detect restricted environments
 * 2. Provides an in-memory fallback when IndexedDB fails
 * 3. Prevents the "undefined is not an object (evaluating 'n.result.createObjectStore')" error
 *
 * This must be placed in the <head> element to run BEFORE any wallet connectors
 * or libraries that depend on IndexedDB initialize.
 *
 * Uses a native script tag (not Next.js Script with beforeInteractive) because
 * the App Router doesn't require a _document.js and native scripts in head
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
