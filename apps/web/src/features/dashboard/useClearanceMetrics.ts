import { useQuery } from '@tanstack/react-query'
import { fetchDashboardSummary } from './api'
import type { DashboardSummary } from './types'

export function useDashboardSummary(fromDate: string, toDate: string) {
  return useQuery<DashboardSummary>({
    queryKey: ['dashboardSummary', fromDate, toDate],
    queryFn: () => fetchDashboardSummary(fromDate, toDate),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: Boolean(fromDate && toDate),
  })
}
