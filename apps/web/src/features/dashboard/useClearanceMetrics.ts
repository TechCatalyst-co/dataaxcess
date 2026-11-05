import { useQuery } from '@tanstack/react-query'
import {
  fetchClearanceMetrics,
  fetchRegisteredUsers,
  fetchTotalClearanceValueUsd,
  fetchVerifiedInvoices,
  fetchPendingInvoices,
  fetchVolumeTrend,
  fetchOperationalAccuracy,
  fetchRecentSalesActivity,
} from './api'
import type { ClearanceMetricsSummary, OperationalAccuracyData, SalesActivityItem, TrendDataPoint } from './types'

export function useRegisteredUsers() {
  return useQuery<number>({
    queryKey: ['registeredUsers'],
    queryFn: fetchRegisteredUsers,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useTotalClearanceValue() {
  return useQuery<number>({
    queryKey: ['totalClearanceValue'],
    queryFn: fetchTotalClearanceValueUsd,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useVerifiedInvoices() {
  return useQuery<number>({
    queryKey: ['verifiedInvoices'],
    queryFn: fetchVerifiedInvoices,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

export function usePendingInvoices() {
  return useQuery<number>({
    queryKey: ['pendingInvoices'],
    queryFn: fetchPendingInvoices,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useClearanceMetrics() {
  return useQuery<ClearanceMetricsSummary>({
    queryKey: ['clearanceMetrics'],
    queryFn: fetchClearanceMetrics,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useVolumeTrend(fromDate: string, toDate: string) {
  return useQuery<TrendDataPoint[]>({
    queryKey: ['volumeTrend', fromDate, toDate],
    queryFn: () => fetchVolumeTrend(fromDate, toDate),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: Boolean(fromDate && toDate),
  })
}

export function useOperationalAccuracy() {
  return useQuery<OperationalAccuracyData>({
    queryKey: ['operationalAccuracy'],
    queryFn: fetchOperationalAccuracy,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useRecentSalesActivity(limit = 5) {
  return useQuery<SalesActivityItem[]>({
    queryKey: ['recentSalesActivity', limit],
    queryFn: () => fetchRecentSalesActivity(limit),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
