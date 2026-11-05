/**
 * DataAxcess Clearance Analytics Dashboard Type Definitions
 * 
 * Contains data structures and contracts for customs compliance metrics,
 * time-series volume trends, operational accuracy distributions, and sales activity.
 */

// ============================================================================
// KPI METRICS
// ============================================================================

export interface ClearanceMetricsSummary {
  totalClearanceValueUsd: number
  verifiedInvoices: number
  clearanceAccuracyPercentage: number
  pendingInvoices: number
}

export interface ClearanceMetrics {
  /**
   * Total number of customs team members with active credentials.
   */
  registeredUsers: number
  registeredUsersSubtitle: string

  /**
   * Aggregate total USD valuation of all processed customs invoices.
   */
  totalClearanceValueUsd: number
  totalClearanceValueSubtitle: string

  /**
   * Count of invoices validated with ANAM customs stamp.
   */
  verifiedInvoices: number
  clearanceAccuracyPercentage: number

  /**
   * Count of invoices awaiting prevalidation agency audit.
   */
  pendingInvoices: number
  pendingInvoicesSubtitle: string
}

// ============================================================================
// VOLUME TREND
// ============================================================================

export interface TrendDataPoint {
  month: string
  value: number
  isActive?: boolean
}

export interface VolumeTrendFilter {
  fromDate: string
  toDate: string
}

// ============================================================================
// OPERATIONAL ACCURACY
// ============================================================================

export interface OperationalAccuracyItem {
  id: string
  label: string
  percentage: number
  targetLabel?: string
  barColor: 'green' | 'orange' | 'blue'
}

export interface OperationalAccuracyData {
  statusBadge: string
  items: OperationalAccuracyItem[]
}

// ============================================================================
// SALES ACTIVITY
// ============================================================================

export interface SalesActivityItem {
  invoiceId: string
  date: string
  vehicleYear: number
  vehicleMake: string
  vehicleModel: string
  buyer: string
  amount: number
  status: 'PENDING' | 'VERIFIED'
}

/**
 * Navigation item identifier with future routing targets.
 */
export type DashboardNavItemId =
  | 'overview'
  | 'audit'
  | 'new_invoice'
  | 'view_all_invoices'
  | 'manage_team'
