import { useQuery } from '@tanstack/react-query'
import { framesFor } from './archive'
import { confirmDerived, fetchLatestFrames, fetchMonthFrames, fetchSchedule } from './fetch'
import { localToday } from './time'

const MIN = 60_000

/** Camera registry from the data2 archive. Changes rarely. */
export function usePhotoSchedule() {
  return useQuery({
    queryKey: ['photo-schedule'],
    queryFn: () => fetchSchedule(),
    staleTime: 60 * MIN,
  })
}

/** Today + yesterday (UTC) listings for each current direction. */
export function useLatestFrames(station: string | null) {
  const schedule = usePhotoSchedule()
  const cam = station ? schedule.data?.stations.get(station) : undefined
  return useQuery({
    queryKey: ['photo-latest', station],
    queryFn: () => fetchLatestFrames(schedule.data!, cam!),
    enabled: !!cam && cam.currentViews.length > 0,
    staleTime: 5 * MIN,
    refetchInterval: 5 * MIN,
  })
}

/** One local month's manifest. Past months are stable for the session. */
export function useMonthFrames(station: string | null, ym: string | null) {
  const schedule = usePhotoSchedule()
  const cam = station ? schedule.data?.stations.get(station) : undefined
  const current = ym === localToday().slice(0, 7)
  return useQuery({
    queryKey: ['photo-month', station, ym],
    queryFn: () => fetchMonthFrames(schedule.data!, cam!, ym!),
    enabled: !!cam && !!ym,
    staleTime: current ? 5 * MIN : Infinity,
  })
}

/**
 * One past local day's frames from its monthly manifest, newest first, with
 * derived (blank `webp_large`) frames confirmed against the bucket listing.
 */
export function usePastDayFrames(station: string | null, ymd: string | null) {
  const schedule = usePhotoSchedule()
  const cam = station ? schedule.data?.stations.get(station) : undefined
  const month = useMonthFrames(station, ymd ? ymd.slice(0, 7) : null)
  const day = useQuery({
    queryKey: ['photo-day', station, ymd, month.dataUpdatedAt],
    queryFn: () => confirmDerived(schedule.data!, cam!, framesFor(month.data!, ymd!)),
    enabled: !!cam && !!ymd && !!month.data,
    staleTime: Infinity,
  })
  return {
    data: day.data,
    isPending: month.isPending || (!!month.data && day.isPending),
    isError: month.isError || day.isError,
  }
}
