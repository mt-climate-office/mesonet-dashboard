import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const message = (error as Error)?.message ?? ''
        if (/4\d\d/.test(message)) return false
        return failureCount < 2
      },
    },
  },
})
