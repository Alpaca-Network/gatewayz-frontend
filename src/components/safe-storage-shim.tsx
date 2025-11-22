import Script from "next/script";
import { STORAGE_GUARD_SCRIPT } from "@/lib/storage-guard-script";

/**
 * Injects the safe storage guard before any third-party SDKs run, ensuring
 * `localStorage` access gracefully falls back in environments where it's blocked.
 */
export function SafeStorageShim() {
  return (
    <Script id="gatewayz-storage-guard" strategy="beforeInteractive">
      {STORAGE_GUARD_SCRIPT}
    </Script>
  );
}
