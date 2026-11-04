/**
 * DataAxcess Clearance Analytics Dashboard Type Definitions
 * 
 * Contains data structures and contracts for customs compliance metrics,
 * time-series volume trends, operational accuracy distributions, and sales activity.
 */

// ============================================================================
// KPI METRICS
// ============================================================================

export interface ClearanceMetrics {
  /**
   * Total number of customs team members with active credentials.
   * // TODO [Backend Query]: Fetch total registered customs team members count
   * // from /api/users or auth directory service (COUNT of active users),
   * // replacing the hardcoded value (8).
   */
  registeredUsers: number
  registeredUsersSubtitle: string

  /**
   * Aggregate total USD valuation of all processed customs invoices.
   * // TODO [Backend Query]: Calculate and fetch aggregate total clearance sales
   * // (SUM of totalSales column across all customs invoices) via /api/invoices/summary,
   * // replacing the hardcoded value ($7,884,405).
   */
  totalClearanceValueUsd: number
  totalClearanceValueSubtitle: string

  /**
   * Count of invoices validated with ANAM customs stamp.
   * // TODO [Backend Query]: Fetch verified invoice count (COUNT WHERE verified = 'yes')
   * // and compute clearance accuracy percentage ((verified / total) * 100),
   * // replacing hardcoded values (0 and 0.0%).
   */
  verifiedInvoices: number
  clearanceAccuracyPercentage: number

  /**
   * Count of invoices awaiting prevalidation agency audit.
   * // TODO [Backend Query]: Query database for invoices awaiting agency audit
   * // (COUNT WHERE verified != 'yes' OR status = 'pending'), replacing hardcoded value (4,232).
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
  /**
   * Start date for monthly sales volume aggregation.
   * // TODO [Interactive Filtering]: Wire 'From' date picker to state handlers
   * // that trigger refetching of the clearance volume trend for the selected date range.
   */
  fromDate: string

  /**
   * End date for monthly sales volume aggregation.
   * // TODO [Interactive Filtering]: Wire 'To' date picker to state handlers
   * // that trigger refetching of the clearance volume trend for the selected date range.
   */
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

/**
 * // TODO [Backend Metrics]: Calculate real-time prevalidation distributions
 * // from compliance audit records to bind dynamic progress bar widths and
 * // threshold status badge ('TARGET MET').
 */
export interface OperationalAccuracyData {
  statusBadge: string
  items: OperationalAccuracyItem[]
}

// ============================================================================
// SALES ACTIVITY
// ============================================================================

export interface SalesActivityItem {
  /**
   * Customs invoice identifier.
   * // TODO [Navigation / Detail Modal]: Attach click handler to invoice rows
   * // to open detailed vehicle verification modal or invoice inspection drawer.
   */
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
