'use client';

import { useEffect } from 'react';

export function ReactScanProvider() {
  useEffect(() => {
    // Only run in development
    if (process.env.NODE_ENV === 'development') {
      import('react-scan').then(({ scan }) => {
        scan({
          enabled: true,
          showToolbar: true,
          animationSpeed: 'fast',
          trackUnnecessaryRenders: true,
        });
      });
    }
  }, []);

  return null;
}
