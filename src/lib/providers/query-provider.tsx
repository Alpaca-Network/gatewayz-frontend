"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // OPTIMIZATION: Increased staleTime from 60s to 5 minutes
            // Most data (sessions, models) doesn't change frequently
            staleTime: 5 * 60 * 1000, // 5 minutes
            // Keep cached data for 30 minutes before garbage collection
            gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
            retry: 1,
            refetchOnWindowFocus: false,
            // OPTIMIZATION: Don't refetch on every mount - use cached data
            refetchOnMount: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
