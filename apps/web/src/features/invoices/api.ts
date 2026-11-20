import type { UpdateInvoiceStatusInput } from '@dataaxcess/shared'
import type { ArchivedInvoicePage, InvoiceDetail, InvoicePage } from './types'

const apiBase = import.meta.env.VITE_API_URL ?? ''

export async function fetchInvoices(term: string, pageNumber: number): Promise<InvoicePage> {
  const params = new URLSearchParams({ page: String(pageNumber), pageSize: '20' })
  if (term) params.set('q', term)
  const response = await fetch(`${apiBase}/api/invoices?${params}`, { credentials: 'include' })
  if (response.status === 401) throw new Error('Your session has expired. Sign in again.')
  if (!response.ok) throw new Error('Could not load invoices.')
  return await response.json() as InvoicePage
}

export async function fetchInvoiceDetails(invoiceNumber: string): Promise<InvoiceDetail> {
  const response = await fetch(`${apiBase}/api/invoices/${encodeURIComponent(invoiceNumber)}`, { credentials: 'include' })
  if (response.status === 401) throw new Error('Your session has expired. Sign in again.')
  if (response.status === 403) throw new Error('Invoice details are available to administrators and agents only.')
  const data = await response.json() as InvoiceDetail & { error?: string }
  if (!response.ok) throw new Error(data.error ?? 'Could not load invoice details.')
  return data
}

export async function updateInvoiceStatus(input: UpdateInvoiceStatusInput): Promise<void> {
  const response = await fetch(`${apiBase}/api/invoices/status`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await response.json() as { error?: string }
  if (!response.ok) throw new Error(data.error ?? 'Could not update invoice status.')
}

export async function fetchArchivedInvoices(term: string, pageNumber: number): Promise<ArchivedInvoicePage> {
  const params = new URLSearchParams({ page: String(pageNumber), pageSize: '20' })
  if (term) params.set('q', term)
  const response = await fetch(`${apiBase}/api/invoices/archived?${params}`, { credentials: 'include' })
  if (response.status === 401) throw new Error('Your session has expired. Sign in again.')
  if (response.status === 403) throw new Error('Archived invoices are available to administrators only.')
  if (!response.ok) throw new Error('Could not load archived invoices.')
  return await response.json() as ArchivedInvoicePage
}

export async function updateInvoiceExpirationThreshold(days: number): Promise<number> {
  const response = await fetch(`${apiBase}/api/invoices/expiration-threshold`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days }),
  })
  const data = await response.json() as { expirationThresholdDays?: number; error?: string }
  if (!response.ok) throw new Error(data.error ?? 'Could not update the expiration period.')
  return data.expirationThresholdDays ?? days
}

export type CreateInvoiceInput = {
  invoiceNumber: string
  vin: string
  year: number
  make: string
  model: string
  buyerCompany?: string
  buyerRfc?: string
  buyerAddress?: string
  buyerCity?: string
  saleDate?: string
  totalSales?: string
  dataAnalyst?: string
}

export async function createInvoice(input: CreateInvoiceInput): Promise<void> {
  const response = await fetch(`${apiBase}/api/invoices`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await response.json() as { error?: string }
  if (!response.ok) throw new Error(data.error ?? 'Could not create invoice.')
}
