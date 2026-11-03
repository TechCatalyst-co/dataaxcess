import { useCallback, useEffect, useState } from 'react'
import { fetchInvoices } from './api'
import type { InvoicePage } from './types'

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

function formatMoney(value: string | null) {
  if (value === null) return '—'
  const amount = Number(value)
  return Number.isFinite(amount) ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount) : '—'
}

export function InvoiceLedger() {
  const [invoiceData, setInvoiceData] = useState<InvoicePage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const loadInvoices = useCallback(async (term: string, pageNumber: number) => {
    setLoading(true)
    setError('')
    try {
      setInvoiceData(await fetchInvoices(term, pageNumber))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load invoices.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadInvoices(search, page) }, 0)
    return () => window.clearTimeout(timer)
  }, [search, page, loadInvoices])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1)
      setSearch(searchInput.trim())
    }, 250)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  return (
    <section className="ledger-card" aria-label="Invoice records">
      <div className="ledger-toolbar"><label className="search-box"><span aria-hidden="true">⌕</span><input aria-label="Search invoices" placeholder="Search invoice, VIN, vehicle, buyer…" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /><kbd>↵</kbd></label><div className="record-count">{invoiceData ? `${invoiceData.total.toLocaleString()} records` : 'Loading records'}</div></div>
      {error && <div className="ledger-message" role="alert">{error}<button className="button secondary" onClick={() => void loadInvoices(search, page)}>Retry</button></div>}
      <div className="table-scroll"><table><thead><tr><th>Invoice</th><th>Vehicle</th><th>VIN</th><th>Buyer</th><th>Sale date</th><th>Total sales</th><th>Status</th></tr></thead><tbody>
        {loading && !invoiceData && <tr><td colSpan={7} className="empty-state">Loading invoices…</td></tr>}
        {!loading && invoiceData?.items.length === 0 && <tr><td colSpan={7} className="empty-state">{search ? 'No invoices match your search.' : 'No invoice records yet.'}</td></tr>}
        {invoiceData?.items.map((invoice) => <tr key={invoice.invoiceNumber}><td className="invoice-id">{invoice.invoiceNumber}</td><td><strong>{invoice.year} {invoice.make}</strong><span className="cell-subtitle">{invoice.model}</span></td><td className="vin-cell">{invoice.vin}</td><td>{invoice.buyerCompany || '—'}</td><td>{formatDate(invoice.saleDate)}</td><td className="money-cell">{formatMoney(invoice.totalSales)}</td><td><span className={`status-pill ${invoice.verified?.toLowerCase() === 'yes' ? 'verified' : 'pending'}`}><i />{invoice.verified?.toLowerCase() === 'yes' ? 'Verified' : 'Pending'}</span></td></tr>)}
      </tbody></table></div>
      <div className="ledger-footer"><span>{invoiceData ? `Showing ${invoiceData.total === 0 ? 0 : (page - 1) * invoiceData.pageSize + 1}–${Math.min(page * invoiceData.pageSize, invoiceData.total)} of ${invoiceData.total}` : ' '}</span><div className="pagination"><button className="button secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Previous</button><span>Page {page} of {invoiceData?.totalPages || 1}</span><button className="button secondary" disabled={!invoiceData || page >= invoiceData.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next →</button></div></div>
    </section>
  )
}
