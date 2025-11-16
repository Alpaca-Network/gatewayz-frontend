'use client';

import { useEffect } from 'react';

export function ReactScanProvider() {
  useEffect(() => {
    // Only run in development
    if (process.env.NODE_ENV === 'development') {
      import('react-scan')
        .then(({ scan }) => {
          scan({
            enabled: true,
            showToolbar: true,
            animationSpeed: 'fast',
            trackUnnecessaryRenders: true,
          });
        })
        .catch((error) => {
          // Silently fail if react-scan is not available
          console.debug('react-scan not available:', error);
        });
    }
  }, []);

  return null;
}
