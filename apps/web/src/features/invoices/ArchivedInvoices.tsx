import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { fetchArchivedInvoices, updateInvoiceExpirationThreshold } from './api'
import type { ArchivedInvoicePage } from './types'

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

export function ArchivedInvoices() {
  const [invoiceData, setInvoiceData] = useState<ArchivedInvoicePage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [thresholdDays, setThresholdDays] = useState(30)
  const [thresholdDraft, setThresholdDraft] = useState('30')
  const [editingThreshold, setEditingThreshold] = useState(false)
  const [savingThreshold, setSavingThreshold] = useState(false)
  const [thresholdError, setThresholdError] = useState('')
  const thresholdButtonRef = useRef<HTMLButtonElement>(null)

  const loadInvoices = useCallback(async (term: string, pageNumber: number) => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchArchivedInvoices(term, pageNumber)
      setInvoiceData(data)
      setThresholdDays(data.expirationThresholdDays)
      setThresholdDraft(String(data.expirationThresholdDays))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load archived invoices.')
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
    if (!editingThreshold) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingThreshold) {
        setEditingThreshold(false)
        thresholdButtonRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editingThreshold, savingThreshold])

  function openThresholdDialog() {
    setThresholdDraft(String(thresholdDays))
    setThresholdError('')
    setEditingThreshold(true)
  }

  function closeThresholdDialog() {
    if (savingThreshold) return
    setEditingThreshold(false)
    thresholdButtonRef.current?.focus()
  }

  async function handleThresholdSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const days = Number(new FormData(event.currentTarget).get('days'))
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      setThresholdError('Enter an expiration period from 1 to 3650 days.')
      return
    }

    setSavingThreshold(true)
    setThresholdError('')
    try {
      const updatedDays = await updateInvoiceExpirationThreshold(days)
      setThresholdDays(updatedDays)
      setThresholdDraft(String(updatedDays))
      setEditingThreshold(false)
      thresholdButtonRef.current?.focus()
      setPage(1)
      await loadInvoices(search, 1)
    } catch (saveError) {
      setThresholdError(saveError instanceof Error ? saveError.message : 'Could not update the expiration period.')
    } finally {
      setSavingThreshold(false)
    }
  }

  return (
    <>
    <section className="ledger-card" aria-label="Archived invoice records">
      <div className="ledger-toolbar">
        <label className="search-box"><span aria-hidden="true">⌕</span><input aria-label="Search archived invoices" placeholder="Search invoice, VIN, vehicle, buyer…" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /><kbd>↵</kbd></label>
        <div className="archive-toolbar-actions">
          <div className="record-count">{invoiceData ? `${invoiceData.total.toLocaleString()} archived invoices` : 'Loading archived invoices'}</div>
          <span className="record-count">Invoices expire after {thresholdDays} {thresholdDays === 1 ? 'day' : 'days'}</span>
          <button ref={thresholdButtonRef} className="button secondary" type="button" onClick={openThresholdDialog} aria-haspopup="dialog">Change expiration period</button>
        </div>
      </div>
      {error && <div className="ledger-message" role="alert">{error}<button className="button secondary" onClick={() => void loadInvoices(search, page)}>Retry</button></div>}
      <div className="table-scroll"><table><thead><tr><th>Invoice</th><th>Vehicle</th><th>VIN</th><th>Buyer</th><th>Sale date</th><th>Created</th><th>Expires</th><th>Total sales</th><th>Status</th></tr></thead><tbody>
        {loading && !invoiceData && <tr><td colSpan={9} className="empty-state">Loading archived invoices…</td></tr>}
        {!loading && invoiceData?.items.length === 0 && <tr><td colSpan={9} className="empty-state">{search ? 'No archived invoices match your search.' : 'No archived invoices yet.'}</td></tr>}
        {invoiceData?.items.map((invoice) => <tr key={invoice.invoiceNumber}>
          <td className="invoice-id">{invoice.invoiceNumber}</td>
          <td><strong>{invoice.year} {invoice.make}</strong><span className="cell-subtitle">{invoice.model}</span></td>
          <td className="vin-cell">{invoice.vin}</td>
          <td>{invoice.buyerCompany || '—'}</td>
          <td>{formatDate(invoice.saleDate)}</td>
          <td>{formatDate(invoice.createdAt)}</td>
          <td>{formatDate(invoice.expiresAt)}</td>
          <td className="money-cell">{formatMoney(invoice.totalSales)}</td>
          <td><span className={`status-pill ${invoice.verified?.toLowerCase() === 'yes' ? 'verified' : 'pending'}`}><i />{invoice.verified?.toLowerCase() === 'yes' ? 'Verified' : 'Pending'}</span></td>
        </tr>)}
      </tbody></table></div>
      <div className="ledger-footer"><span>{invoiceData ? `Showing ${invoiceData.total === 0 ? 0 : (page - 1) * invoiceData.pageSize + 1}–${Math.min(page * invoiceData.pageSize, invoiceData.total)} of ${invoiceData.total}` : ' '}</span><div className="pagination"><button className="button secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Previous</button><span>Page {page} of {invoiceData?.totalPages || 1}</span><button className="button secondary" disabled={!invoiceData || page >= invoiceData.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next →</button></div></div>
    </section>
    {editingThreshold && createPortal(
      <div className="expiration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeThresholdDialog() }}>
        <section className="expiration-modal" role="dialog" aria-modal="true" aria-labelledby="expiration-modal-title" aria-describedby="expiration-modal-description" onKeyDown={(event) => {
          if (event.key !== 'Tab') return
          const focusable = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')
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
          <div className="expiration-modal-header">
            <div>
              <h2 id="expiration-modal-title">Invoice expiration period</h2>
              <p id="expiration-modal-description">Set how long invoices stay active before they are archived.</p>
            </div>
            <button type="button" className="expiration-modal-close" aria-label="Close expiration settings" onClick={closeThresholdDialog} disabled={savingThreshold}>×</button>
          </div>
          <form onSubmit={(event) => void handleThresholdSubmit(event)}>
            <label className="expiration-modal-label" htmlFor="expiration-threshold-days">Invoices expire after</label>
            <div className="expiration-modal-input-row">
              <input autoFocus id="expiration-threshold-days" type="number" name="days" min="1" max="3650" required value={thresholdDraft} onChange={(event) => setThresholdDraft(event.target.value)} />
              <span>days after creation</span>
            </div>
            <p className="expiration-modal-note">This applies to existing invoices too. Invoices within the new period return to the active list.</p>
            {thresholdError && <p className="expiration-modal-error" role="alert">{thresholdError}</p>}
            <div className="expiration-modal-actions">
              <button className="button secondary" type="button" onClick={closeThresholdDialog} disabled={savingThreshold}>Cancel</button>
              <button className="button primary compact" type="submit" disabled={savingThreshold}>{savingThreshold ? 'Saving…' : 'Save period'}</button>
            </div>
          </form>
        </section>
      </div>,
      document.body,
    )}
    </>
  )
}