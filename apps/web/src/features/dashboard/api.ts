import type { Invoice } from '../invoices/types'
import type {
  ClearanceMetricsSummary,
  OperationalAccuracyData,
  SalesActivityItem,
  TrendDataPoint,
} from './types'

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

export async function fetchClearanceMetrics(): Promise<ClearanceMetricsSummary> {
  const response = await fetch(`${apiBase}/api/invoices/analytics/summary`, {
    credentials: 'include',
  })
  const data = await handleResponse(response)
  return data as ClearanceMetricsSummary
}

export async function fetchRegisteredUsers(): Promise<number> {
  const response = await fetch(`${apiBase}/api/users/count`, {
    credentials: 'include',
  })
  const data = await handleResponse(response)
  return (data as { count: number }).count
}

const MONTH_NAMES = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
]

function monthKey(saleDate: string): string {
  return saleDate.slice(0, 7) // 'YYYY-MM'
}

function formatMonth(key: string): string {
  const monthIndex = Number(key.slice(5, 7)) - 1
  return MONTH_NAMES[monthIndex] ?? ''
}

export async function fetchVolumeTrend(fromDate: string, toDate: string): Promise<TrendDataPoint[]> {
  const invoices = await fetchAllInvoices()

  // Filter invoices with a valid saleDate within [fromDate, toDate] inclusive.
  // saleDate is stored as 'YYYY-MM-DD' string, so lexicographic comparison is safe.
  const filtered = invoices.filter((invoice) => {
    const saleDate = invoice.saleDate
    if (!saleDate) return false
    return saleDate >= fromDate && saleDate <= toDate
  })

  if (filtered.length === 0) return []

  // Group invoices by calendar month key (YYYY-MM), counting invoices and
  // tracking the latest saleDate per month to determine the active point.
  const monthMap = new Map<string, { count: number; latestDate: string }>()
  for (const invoice of filtered) {
    const key = monthKey(invoice.saleDate!)
    const existing = monthMap.get(key)
    if (existing) {
      existing.count += 1
      if (invoice.saleDate! > existing.latestDate) {
        existing.latestDate = invoice.saleDate!
      }
    } else {
      monthMap.set(key, { count: 1, latestDate: invoice.saleDate! })
    }
  }

  // Identify the month containing the overall latest saleDate (isActive point).
  let latestMonthKey = ''
  let latestDate = ''
  for (const [key, data] of monthMap) {
    if (data.latestDate > latestDate) {
      latestDate = data.latestDate
      latestMonthKey = key
    }
  }

  // Sort month keys chronologically and build trend points.
  const sortedKeys = [...monthMap.keys()].sort()

  return sortedKeys.map((key) => {
    const data = monthMap.get(key)!
    return {
      month: formatMonth(key),
      value: data.count,
      isActive: key === latestMonthKey,
    }
  })
}

function computePercentage(part: number, total: number): number {
  if (total === 0) return 0
  return Math.round((part / total) * 1000) / 10
}

export async function fetchOperationalAccuracy(): Promise<OperationalAccuracyData> {
  const invoices = await fetchAllInvoices()

  const total = invoices.length
  const verified = invoices.filter((invoice) => invoice.verified === 'yes').length
  const pending = total - verified

  const complianceRate = computePercentage(verified, total)

  return {
    statusBadge: complianceRate >= 95 ? 'TARGET MET' : 'TARGET NOT MET',
    items: [
      {
        id: 'anam-verified',
        label: 'ANAM Customs Verified Clearance',
        percentage: complianceRate,
        targetLabel: `${complianceRate.toFixed(1)}%`,
        barColor: 'green',
      },
      {
        id: 'pending-approvals',
        label: 'Pending Customs Approvals',
        percentage: computePercentage(pending, total),
        targetLabel: `${computePercentage(pending, total).toFixed(1)}%`,
        barColor: 'orange',
      },
      {
        id: 'compliance-rate',
        label: 'Compliance Verification Rate',
        percentage: complianceRate,
        targetLabel: `${complianceRate.toFixed(1)}%`,
        barColor: 'blue',
      },
    ],
  }
}

export async function fetchRecentSalesActivity(limit = 5): Promise<SalesActivityItem[]> {
  const params = new URLSearchParams({ page: '1', pageSize: String(limit) })
  const response = await fetch(`${apiBase}/api/invoices?${params}`, {
    credentials: 'include',
  })
  const data = await handleResponse(response)
  const page = data as { items: Invoice[] }
  return page.items.map(mapInvoiceToActivity)
}

/**
 * Fetch every invoice across all pages of the paginated /api/invoices endpoint.
 * Used to compute a client-side total clearance value that does not depend on
 * the unconfirmed /api/invoices/analytics/summary endpoint.
 */
export async function fetchAllInvoices(): Promise<Invoice[]> {
  const invoices: Invoice[] = []
  let page = 1
  let totalPages = 1
  while (page <= totalPages) {
    const params = new URLSearchParams({ page: String(page), pageSize: '100' })
    const response = await fetch(`${apiBase}/api/invoices?${params}`, {
      credentials: 'include',
    })
    const data = await handleResponse(response)
    const pageData = data as { items: Invoice[]; totalPages?: number }
    invoices.push(...pageData.items)
    totalPages = pageData.totalPages ?? 1
    page += 1
  }
  return invoices
}

/**
 * Sum of every invoice's totalSales, treating null/missing as 0 and coercing
 * the string value to a number before adding. Null-safe by construction.
 */
export async function fetchTotalClearanceValueUsd(): Promise<number> {
  const invoices = await fetchAllInvoices()
  return invoices.reduce((total, invoice) => total + Number(invoice.totalSales ?? 0), 0)
}

export async function fetchVerifiedInvoices(): Promise<number> {
  const invoices = await fetchAllInvoices()
  return invoices.filter((invoice) => invoice.verified === 'yes').length
}

export async function fetchPendingInvoices(): Promise<number> {
  const invoices = await fetchAllInvoices()
  return invoices.filter((invoice) => invoice.verified !== 'yes').length
}

function mapInvoiceToActivity(invoice: Invoice): SalesActivityItem {
  return {
    invoiceId: invoice.invoiceNumber,
    date: invoice.saleDate ?? '',
    vehicleYear: invoice.year,
    vehicleMake: invoice.make,
    vehicleModel: invoice.model,
    buyer: invoice.buyerCompany ?? '',
    amount: Number(invoice.totalSales ?? 0),
    status: invoice.verified === 'yes' ? 'VERIFIED' : 'PENDING',
  }
}
