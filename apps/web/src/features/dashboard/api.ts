import type { DashboardSummary } from './types'

const apiBase = import.meta.env.VITE_API_URL ?? ''

async function handleResponse(response: Response) {
  if (response.status === 204) return
  if (response.status === 401) throw new Error('Your session has expired. Sign in again.')
  if (response.status === 403) throw new Error('You do not have permission to access this data.')
  if (!response.ok) {
    const data = await response.json().catch(() => ({} as { error?: string }))
    throw new Error(data.error ?? 'Could not complete the request.')
  }
  return response.json()
}

export async function fetchDashboardSummary(fromDate: string, toDate: string): Promise<DashboardSummary> {
  const params = new URLSearchParams({ fromDate, toDate })
  const response = await fetch(`${apiBase}/api/invoices/analytics/summary?${params}`, {
    credentials: 'include',
  })
  return await handleResponse(response) as DashboardSummary
}
