"use client";

import { useEffect, useRef } from 'react';
import { initializePreviewHostnameHandler } from '@/lib/preview-hostname-handler';

/**
 * Preview Hostname Restorer
 *
 * This component runs early in the app lifecycle to detect if we're returning
 * from an OAuth redirect and need to restore the preview deployment hostname.
 *
 * It should be placed high in the component tree, ideally in the root layout.
 */
export function PreviewHostnameRestorer() {
  const initialized = useRef(false);

  useEffect(() => {
    // Only run once
    if (initialized.current) {
      return;
    }

    initialized.current = true;

    // Initialize preview hostname handling
    // This will automatically detect and restore if needed
    initializePreviewHostnameHandler();
  }, []);

  // This component doesn't render anything
  return null;
}
