import { ETHEREUM_ERROR_SUPPRESSOR_SCRIPT } from "@/lib/ethereum-error-suppressor-script";

/**
 * Injects an early error suppressor script that runs BEFORE wallet extensions.
 *
 * This addresses the "Cannot redefine property: ethereum" error from evmAsk.js
 * and other wallet extension scripts. Uses a native script tag in the head to ensure
 * it runs before any third-party scripts.
 *
 * This is complementary to the ErrorSuppressor React component:
 * - EarlyErrorSuppressor: Catches errors BEFORE React mounts (using inline script in head)
 * - ErrorSuppressor: Catches errors AFTER React mounts (using useEffect)
 *
 * Note: We use a native script tag instead of Next.js Script with beforeInteractive
 * because the App Router doesn't require a _document.js and native scripts in head
 * are rendered synchronously during SSR, ensuring they run immediately on page load.
 */
export function EarlyErrorSuppressor() {
  return (
    <script
      id="gatewayz-early-error-suppressor"
      dangerouslySetInnerHTML={{ __html: ETHEREUM_ERROR_SUPPRESSOR_SCRIPT }}
    />
  );
}
