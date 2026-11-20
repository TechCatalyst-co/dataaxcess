import { PencilSimple } from '@phosphor-icons/react'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchInvoiceDetails, fetchInvoices, updateInvoiceStatus } from './api'
import type { InvoiceDetail, InvoicePage } from './types'

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

function formatTimestamp(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf())
    ? 'Not available'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function displayValue(value: string | number | null | undefined) {
  return value == null || value === '' ? '—' : String(value)
}

export function InvoiceLedger({ readOnly = false }: { readOnly?: boolean }) {
  const queryClient = useQueryClient()
  const [invoiceData, setInvoiceData] = useState<InvoicePage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusError, setStatusError] = useState('')
  const [savingInvoices, setSavingInvoices] = useState<Set<string>>(() => new Set())
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState<string | null>(null)
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const closeDetailButtonRef = useRef<HTMLButtonElement>(null)
  const detailTriggerRef = useRef<HTMLButtonElement>(null)

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

  useEffect(() => {
    if (!selectedInvoiceNumber) return
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedInvoiceNumber(null)
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    closeDetailButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      detailTriggerRef.current?.focus()
    }
  }, [selectedInvoiceNumber])

  async function loadInvoiceDetails(invoiceNumber: string) {
    setDetailLoading(true)
    setDetailError('')
    try {
      setInvoiceDetail(await fetchInvoiceDetails(invoiceNumber))
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : 'Could not load invoice details.')
    } finally {
      setDetailLoading(false)
    }
  }

  function openInvoiceDetails(invoiceNumber: string, trigger: HTMLButtonElement) {
    detailTriggerRef.current = trigger
    setSelectedInvoiceNumber(invoiceNumber)
    setInvoiceDetail(null)
    void loadInvoiceDetails(invoiceNumber)
  }

  async function toggleInvoiceStatus(invoiceNumber: string, status: 'pending' | 'verified') {
    setStatusError('')
    setSavingInvoices((current) => new Set(current).add(invoiceNumber))
    try {
      await updateInvoiceStatus({ invoiceNumber, status })
      setInvoiceData((current) => current ? {
        ...current,
        items: current.items.map((invoice) => invoice.invoiceNumber === invoiceNumber
          ? { ...invoice, verified: status === 'verified' ? 'Yes' : 'No' }
          : invoice),
      } : current)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['recentSalesActivity'] }),
        queryClient.invalidateQueries({ queryKey: ['operationalAccuracy'] }),
        queryClient.invalidateQueries({ queryKey: ['verifiedInvoices'] }),
        queryClient.invalidateQueries({ queryKey: ['pendingInvoices'] }),
        queryClient.invalidateQueries({ queryKey: ['clearanceMetrics'] }),
      ])
    } catch (saveError) {
      setStatusError(saveError instanceof Error ? saveError.message : 'Could not update invoice status.')
    } finally {
      setSavingInvoices((current) => {
        const next = new Set(current)
        next.delete(invoiceNumber)
        return next
      })
    }
  }

  return (
    <>
    <section className="ledger-card" aria-label="Invoice records">
      <div className="ledger-toolbar"><label className="search-box"><span aria-hidden="true">⌕</span><input aria-label="Search invoices" placeholder="Search invoice, VIN, vehicle, buyer…" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /><kbd>↵</kbd></label><div className="record-count">{invoiceData ? `${invoiceData.total.toLocaleString()} records` : 'Loading records'}</div></div>
      {error && <div className="ledger-message" role="alert">{error}<button className="button secondary" onClick={() => void loadInvoices(search, page)}>Retry</button></div>}
      {statusError && <div className="ledger-message" role="alert">{statusError}<button className="button secondary" onClick={() => setStatusError('')}>Dismiss</button></div>}
      <div className="table-scroll"><table><thead><tr><th>Invoice</th><th>Vehicle</th><th>VIN</th><th>Buyer</th><th>Sale date</th><th>Total sales</th><th>Status</th></tr></thead><tbody>
        {loading && !invoiceData && <tr><td colSpan={7} className="empty-state">Loading invoices…</td></tr>}
        {!loading && invoiceData?.items.length === 0 && <tr><td colSpan={7} className="empty-state">{search ? 'No invoices match your search.' : 'No invoice records yet.'}</td></tr>}
        {invoiceData?.items.map((invoice) => {
          const isVerified = invoice.verified?.toLowerCase() === 'yes'
          const status = isVerified ? 'verified' : 'pending'
          const nextStatus = isVerified ? 'pending' : 'verified'
          const isSaving = savingInvoices.has(invoice.invoiceNumber)
          return <tr key={invoice.invoiceNumber}><td className="invoice-id">{readOnly ? invoice.invoiceNumber : <button type="button" className="invoice-detail-trigger" aria-label={`View invoice ${invoice.invoiceNumber} details`} onClick={(event) => openInvoiceDetails(invoice.invoiceNumber, event.currentTarget)}>{invoice.invoiceNumber}</button>}</td><td><strong>{invoice.year} {invoice.make}</strong><span className="cell-subtitle">{invoice.model}</span></td><td className="vin-cell">{invoice.vin}</td><td>{invoice.buyerCompany || '—'}</td><td>{formatDate(invoice.saleDate)}</td><td className="money-cell">{formatMoney(invoice.totalSales)}</td><td>{readOnly ? <span className={`status-pill ${status}`}><i />{isVerified ? 'Verified' : 'Pending'}</span> : <button type="button" className={`status-pill status-pill-button ${status}`} aria-label={`Invoice ${invoice.invoiceNumber} is ${status}; mark as ${nextStatus}`} title={`Change status to ${nextStatus}`} aria-pressed={isVerified} disabled={isSaving} onClick={() => void toggleInvoiceStatus(invoice.invoiceNumber, nextStatus)}><i />{isSaving ? 'Saving…' : isVerified ? 'Verified' : 'Pending'}{!isSaving && <PencilSimple className="status-edit-icon" aria-hidden="true" />}</button>}</td></tr>
        })}
      </tbody></table></div>
      <div className="ledger-footer"><span>{invoiceData ? `Showing ${invoiceData.total === 0 ? 0 : (page - 1) * invoiceData.pageSize + 1}–${Math.min(page * invoiceData.pageSize, invoiceData.total)} of ${invoiceData.total}` : ' '}</span><div className="pagination"><button className="button secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Previous</button><span>Page {page} of {invoiceData?.totalPages || 1}</span><button className="button secondary" disabled={!invoiceData || page >= invoiceData.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next →</button></div></div>
    </section>
    {selectedInvoiceNumber && createPortal(
      <div className="invoice-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedInvoiceNumber(null) }}>
        <section className="invoice-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="invoice-detail-title" aria-busy={detailLoading} onKeyDown={(event) => {
          if (event.key !== 'Tab') return
          const focusable = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])')
          const first = focusable[0]
          const last = focusable[focusable.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first?.focus()
          }
        }}>
          <header className="invoice-detail-header">
            <div><p>Invoice record</p><h2 id="invoice-detail-title">{selectedInvoiceNumber}</h2></div>
            <button ref={closeDetailButtonRef} type="button" className="expiration-modal-close" aria-label="Close invoice details" onClick={() => setSelectedInvoiceNumber(null)}>×</button>
          </header>
          {detailLoading && <p className="invoice-detail-message" role="status">Loading invoice details…</p>}
          {detailError && <div className="invoice-detail-error" role="alert"><span>{detailError}</span><button type="button" className="button secondary" onClick={() => void loadInvoiceDetails(selectedInvoiceNumber)}>Retry</button></div>}
          {invoiceDetail && <>
            <div className="invoice-detail-status"><span>Current status</span><strong className={`status-pill ${invoiceDetail.verified.toLowerCase() === 'yes' ? 'verified' : 'pending'}`}><i />{invoiceDetail.verified.toLowerCase() === 'yes' ? 'Verified' : 'Pending'}</strong></div>
            <div className="invoice-detail-sections">
              <section className="invoice-detail-section">
                <h3>Vehicle information</h3>
                <dl><div><dt>Invoice number</dt><dd>{invoiceDetail.invoiceNumber}</dd></div><div><dt>Full VIN</dt><dd>{invoiceDetail.vin}</dd></div><div><dt>Year</dt><dd>{invoiceDetail.year}</dd></div><div><dt>Make</dt><dd>{invoiceDetail.make}</dd></div><div><dt>Model</dt><dd>{invoiceDetail.model}</dd></div></dl>
              </section>
              <section className="invoice-detail-section">
                <h3>Buyer information</h3>
                <dl><div><dt>Company name</dt><dd>{displayValue(invoiceDetail.buyerCompany)}</dd></div><div><dt>RFC</dt><dd>{displayValue(invoiceDetail.buyerRfc)}</dd></div><div><dt>Address</dt><dd>{displayValue(invoiceDetail.buyerAddress)}</dd></div><div><dt>City</dt><dd>{displayValue(invoiceDetail.buyerCity)}</dd></div></dl>
              </section>
              <section className="invoice-detail-section">
                <h3>Sale information</h3>
                <dl><div><dt>Sale date</dt><dd>{formatDate(invoiceDetail.saleDate)}</dd></div><div><dt>Total sales price</dt><dd>{formatMoney(invoiceDetail.totalSales)}</dd></div><div><dt>Data analyst</dt><dd>{displayValue(invoiceDetail.dataAnalyst)}</dd></div></dl>
              </section>
            </div>
            <section className="invoice-verification-log" aria-labelledby="invoice-verification-log-title">
              <div className="invoice-verification-log-heading"><div><h3 id="invoice-verification-log-title">Verification history</h3><span>{invoiceDetail.verificationHistory.length} events</span></div></div>
              {invoiceDetail.verificationHistory.length === 0
                ? <p className="invoice-detail-message">No verification events recorded.</p>
                : <div className="invoice-log-scroll"><table><thead><tr><th>Date and time</th><th>Action</th><th>Changed by</th><th>Source</th></tr></thead><tbody>
                  {[...invoiceDetail.verificationHistory].reverse().map((entry, index) => <tr key={`${entry.verifiedAt}-${index}`}><td>{formatTimestamp(entry.verifiedAt)}</td><td>{entry.status === 'pending' ? 'Set to pending' : 'Verified'}</td><td>{entry.user?.fullName || entry.user?.username || 'Former user'}{entry.user?.role && <span className="invoice-log-role">{entry.user.role}</span>}</td><td>{entry.source === 'sales_api' ? 'Sales API' : 'Ledger'}</td></tr>)}
                </tbody></table></div>}
            </section>
          </>}
        </section>
      </div>,
      document.body,
    )}
    </>
  )
}
