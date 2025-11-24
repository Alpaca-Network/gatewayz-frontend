import Script from "next/script";
import { STORAGE_GUARD_SCRIPT } from "@/lib/storage-guard-script";

/**
 * Injects the safe storage guard, ensuring `localStorage` access gracefully
 * falls back in environments where it's blocked (e.g., private browsing).
 * Uses `afterInteractive` strategy as this is in app layout, not _document.
 */
export function SafeStorageShim() {
  return (
    <Script
      id="gatewayz-storage-guard"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: STORAGE_GUARD_SCRIPT }}
    />
  );
}
