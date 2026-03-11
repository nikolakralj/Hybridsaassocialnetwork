/**
 * React Query Provider
 * Wraps the app with QueryClient for data fetching and caching
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Create QueryClient instance (useState ensures it's only created once)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Sensible defaults for timesheet data
            staleTime: 60 * 1000, // 1 minute
            gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
            retry: 1, // Retry failed requests once
            refetchOnWindowFocus: false, // Don't refetch on window focus (can be annoying)
            refetchOnReconnect: true, // Refetch when internet reconnects
          },
          mutations: {
            // Mutations don't retry by default
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
