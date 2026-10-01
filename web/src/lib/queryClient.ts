import { QueryClient } from '@tanstack/react-query'
import { HttpError } from './api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      // Retry network failures and 5xx; a 4xx won't succeed on retry.
      retry: (failureCount, error) => {
        if (error instanceof HttpError && error.status < 500) return false
        return failureCount < 2
      },
    },
  },
})
