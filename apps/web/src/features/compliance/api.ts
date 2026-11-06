import type { User } from '../auth/types'

const apiBase = import.meta.env.VITE_API_URL ?? ''

export type ComplianceAuditData = {
  user: User
  session: {
    loginAt: string
    lastActivityAt: string
    expiresAt: string
    endedAt: string | null
    status: 'active' | 'ended' | 'expired'
  } | null
  vinActivity: {
    lastVin: string | null
    lastVehicle: { year: number; make: string; model: string } | null
    lastSubmittedAt: string | null
    submittedCount: number
  }
  invoiceActivity: {
    createdThisMonth: number
    pending: number
    verified: number
    verificationRate: number | null
  }
}

export async function fetchComplianceAudit(): Promise<ComplianceAuditData> {
  const response = await fetch(`${apiBase}/api/compliance/audit`, { credentials: 'include' })
  if (response.status === 401) throw new Error('Your session has expired. Sign in again.')
  if (!response.ok) throw new Error('Could not load your compliance activity.')
  return await response.json() as ComplianceAuditData
}
