import { useState, type FormEvent } from 'react'
import { createInvoice } from './api'

type InvoiceFormProps = { onCreated: () => void; onCancel: () => void }

function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function InvoiceForm({ onCreated, onCancel }: InvoiceFormProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const year = Number(form.get('year'))
    const totalSales = String(form.get('totalSales') ?? '').trim()
    setBusy(true)
    setError('')
    try {
      await createInvoice({
        invoiceNumber: String(form.get('invoiceNumber') ?? '').trim(),
        vin: String(form.get('vin') ?? '').trim().toUpperCase(),
        year,
        make: String(form.get('make') ?? '').trim(),
        model: String(form.get('model') ?? '').trim(),
        buyerCompany: String(form.get('buyerCompany') ?? '').trim() || undefined,
        buyerRfc: String(form.get('buyerRfc') ?? '').trim() || undefined,
        buyerAddress: String(form.get('buyerAddress') ?? '').trim() || undefined,
        buyerCity: String(form.get('buyerCity') ?? '').trim() || undefined,
        saleDate: String(form.get('saleDate') ?? '') || undefined,
        totalSales: totalSales || undefined,
        dataAnalyst: String(form.get('dataAnalyst') ?? '').trim() || undefined,
      })
      onCreated()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not create invoice.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="invoice-form" onSubmit={handleSubmit}>
      <section className="form-section">
        <h3>Vehicle information</h3>
        <div className="form-grid">
          <label>Invoice number <span className="required">*</span><input name="invoiceNumber" required maxLength={50} placeholder="Enter invoice number…" /></label>
          <label>Full VIN <span className="required">*</span><input name="vin" required minLength={17} maxLength={17} pattern="[A-HJ-NPR-Z0-9]{17}" title="Enter a valid 17-character VIN" placeholder="Enter full VIN…" /></label>
          <label>Year <span className="required">*</span><input name="year" required type="number" min="1886" max="2100" placeholder="Enter year…" /></label>
          <label>Make <span className="required">*</span><input name="make" required maxLength={50} placeholder="Enter make…" /></label>
          <label>Model <span className="required">*</span><input name="model" required maxLength={50} placeholder="Enter model…" /></label>
        </div>
      </section>
      <section className="form-section">
        <h3>Buyer information</h3>
        <div className="form-grid">
          <label>Company name<input name="buyerCompany" maxLength={100} placeholder="Enter company name…" /></label>
          <label>RFC<input name="buyerRfc" maxLength={20} placeholder="Enter RFC…" /></label>
          <label className="full-width">Address<textarea name="buyerAddress" maxLength={200} rows={2} placeholder="Enter address…" /></label>
          <label className="full-width">City<input name="buyerCity" maxLength={100} placeholder="Enter city…" /></label>
        </div>
      </section>
      <section className="form-section">
        <h3>Sale information</h3>
        <div className="form-grid">
          <label>Sale date<input name="saleDate" type="date" defaultValue={localToday()} /></label>
          <label>Total sales price<input name="totalSales" type="number" min="0" max="99999999.99" step="0.01" placeholder="Enter total sales price…" /></label>
          <label>Data analyst<input name="dataAnalyst" maxLength={255} placeholder="Enter data analyst…" /></label>
        </div>
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="button secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button><button className="button primary compact" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create invoice'}</button></div>
    </form>
  )
}
