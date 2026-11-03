import type { InvoicePage } from './types'

const apiBase = import.meta.env.VITE_API_URL ?? ''

export async function fetchInvoices(term: string, pageNumber: number): Promise<InvoicePage> {
  const params = new URLSearchParams({ page: String(pageNumber), pageSize: '20' })
  if (term) params.set('q', term)
  const response = await fetch(`${apiBase}/api/invoices?${params}`, { credentials: 'include' })
  if (response.status === 401) throw new Error('Your session has expired. Sign in again.')
  if (!response.ok) throw new Error('Could not load invoices.')
  return await response.json() as InvoicePage
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
