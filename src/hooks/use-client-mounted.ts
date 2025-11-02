import { useState, useEffect } from 'react';

/**
 * Hook to detect if component is mounted on client-side
 * Useful for preventing hydration mismatches and SSR issues
 *
 * @returns boolean - true if component is mounted on client
 *
 * @example
 * const mounted = useClientMounted();
 * if (!mounted) return <LoadingState />;
 * return <YourComponent />;
 */
export function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
