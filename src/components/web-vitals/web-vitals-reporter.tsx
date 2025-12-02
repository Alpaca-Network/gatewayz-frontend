"use client";

import { useEffect, useRef } from "react";
import { setupWebVitals } from "@/lib/web-vitals-service";

interface WebVitalsReporterProps {
  /**
   * Enable or disable Web Vitals collection
   * @default true
   */
  enabled?: boolean;
  /**
   * Enable debug mode for console logging
   * @default false
   */
  debug?: boolean;
  /**
   * Sample rate for collecting metrics (0-1)
   * @default 1.0 (collect all)
   */
  sampleRate?: number;
}

/**
 * Web Vitals Reporter Component
 *
 * Add this component to your app layout to automatically collect
 * Core Web Vitals metrics (LCP, INP, CLS, FCP, TTFB).
 *
 * @example
 * ```tsx
 * // In your root layout.tsx
 * import { WebVitalsReporter } from "@/components/web-vitals";
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         {children}
 *         <WebVitalsReporter />
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function WebVitalsReporter({
  enabled = true,
  debug = false,
  sampleRate = 1.0,
}: WebVitalsReporterProps) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!enabled || initialized.current) return;

    initialized.current = true;

    // Setup Web Vitals collection
    setupWebVitals({
      enabled,
      debug,
      sampleRate,
      endpoint: "/api/vitals",
      batchSize: 5,
      flushInterval: 10000, // 10 seconds
    });

    if (debug) {
      console.log("[WebVitalsReporter] Initialized");
    }
  }, [enabled, debug, sampleRate]);

  // This component doesn't render anything
  return null;
}
