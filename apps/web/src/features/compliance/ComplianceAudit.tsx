import { useEffect, useState } from 'react'
import { fetchComplianceAudit, type ComplianceAuditData } from './api'
import './compliance.css'

type Props = { user: { id: number; username: string; fullName?: string; role: 'admin' | 'agent' } }

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not available'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not available' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function formatSubmissionDate(value: string | null | undefined): string {
  if (!value) return 'Not available'
  // MySQL DATETIME has no timezone. Preserve its wall-clock time instead of
  // parsing it as UTC and shifting it to the browser's timezone.
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) return formatDate(value)
  const [, year, month, day, hour, minute, second = '0'] = match
  const localDate = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(localDate)
}

function duration(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return 'Not available'
  const startMs = new Date(start).getTime()
  const endMs = end ? new Date(end).getTime() : Date.now()
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 'Not available'
  const minutes = Math.max(0, Math.floor((endMs - startMs) / 60000))
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return hours ? `${hours} hr ${remainingMinutes} min` : `${remainingMinutes} min`
}

function AuditCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return <section className="audit-card"><header className="audit-card-heading"><span aria-hidden="true">{icon}</span><h2>{title}</h2></header><div className="audit-card-content">{children}</div></section>
}

function AuditRow({ label, value, status }: { label: string; value: string; status?: 'active' | 'neutral' }) {
  return <div className="audit-row"><span className="audit-row-icon" aria-hidden="true">•</span><div className="audit-row-copy"><span className="audit-label">{label}</span><strong>{value}</strong></div>{status && <span className={`audit-badge ${status}`}>{status === 'active' ? 'Active' : 'Current'}</span>}</div>
}

export function ComplianceAudit({ user }: Props) {
  const [data, setData] = useState<ComplianceAuditData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetchComplianceAudit().then((result) => { if (active) setData(result) })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load your compliance activity.') })
    return () => { active = false }
  }, [])

  const currentUser = data?.user ?? user
  const currentSession = data?.session

  return <main className="audit-page">
    <div className="audit-page-heading"><div><div className="audit-eyebrow">ACCOUNT OVERSIGHT</div><h1>Compliance Audit</h1><p>Session, user, VIN, and invoice activity for your account.</p></div><div className="audit-as-of">Updated {formatDate(data?.session?.lastActivityAt)}</div></div>
    {error && <div className="audit-error" role="alert">{error} Data below may be incomplete.</div>}
    {!data && !error && <div className="audit-loading" role="status">Loading your compliance activity…</div>}
    <div className="audit-grid">
      <AuditCard title="Session Activity" icon="◷">
        <AuditRow label="Login time" value={formatDate(currentSession?.loginAt)} />
        <AuditRow label="Last activity" value={formatDate(currentSession?.lastActivityAt)} />
        <AuditRow label="Session duration" value={duration(currentSession?.loginAt, currentSession?.endedAt)} />
        {currentSession && <AuditRow label="Session expires" value={formatDate(currentSession.expiresAt)} />}
      </AuditCard>
      <AuditCard title="User Details" icon="♙">
        <AuditRow label="User ID" value={`USR-${String(currentUser.id).padStart(6, '0')}`} />
        <AuditRow label="Full name" value={currentUser.fullName || 'Name not set'} />
        <AuditRow label="Username" value={currentUser.username} />
        <AuditRow label="Role" value={currentUser.role === 'admin' ? 'Administrator' : 'Agent'} />
      </AuditCard>
      <AuditCard title="VIN Verification" icon="⌕">
        <AuditRow label="Last VIN submitted" value={data?.vinActivity.lastVin ?? 'No VIN submitted yet'} />
        <AuditRow label="Vehicle" value={data?.vinActivity.lastVehicle ? `${data.vinActivity.lastVehicle.year} ${data.vinActivity.lastVehicle.make} ${data.vinActivity.lastVehicle.model}` : 'No vehicle details yet'} />
        <AuditRow label="Last submission" value={formatSubmissionDate(data?.vinActivity.lastSubmittedAt)} />
        <AuditRow label="Total VINs Submitted" value={data ? data.vinActivity.submittedCount.toLocaleString() : 'Loading…'} />
      </AuditCard>
      <AuditCard title="Invoice Activity" icon="▤">
        <AuditRow label="Invoices created this month" value={data ? data.invoiceActivity.createdThisMonth.toLocaleString() : 'Loading…'} />
        <AuditRow label="Pending invoices" value={data ? data.invoiceActivity.pending.toLocaleString() : 'Loading…'} />
        <AuditRow label="Verified invoices" value={data ? data.invoiceActivity.verified.toLocaleString() : 'Loading…'} status={data && data.invoiceActivity.verified > 0 ? 'active' : undefined} />
        <AuditRow label="Verification rate" value={data?.invoiceActivity.verificationRate == null ? 'No verification history yet' : `${data.invoiceActivity.verificationRate}%`} />
      </AuditCard>
    </div>
  </main>
}
