import { useQuery } from '@tanstack/react-query'
import { getElements } from '../lib/api'

/** Master element catalog (every element across every station). */
export function useElements() {
  return useQuery({
    queryKey: ['elements'],
    queryFn: getElements,
    staleTime: 60 * 60 * 1000,
  })
}
