import React, { useState, useEffect } from 'react'
import type {
  ClearanceMetrics,
  TrendDataPoint,
  OperationalAccuracyData,
  SalesActivityItem,
} from './types'

// ============================================================================
// SAMPLE DATASETS WITH EXPLICIT CODE-LEVEL TODO CONTRACTS
// ============================================================================

/**
 * // TODO [Backend Query]: Fetch total registered customs team members,
 * // total clearance value (sum of total sales), verified invoices count,
 * // and pending invoices count from /api/invoices/analytics summary endpoint.
 */
const INITIAL_METRICS: ClearanceMetrics = {
  registeredUsers: 8,
  registeredUsersSubtitle: 'Active Customs Team',
  totalClearanceValueUsd: 7884405,
  totalClearanceValueSubtitle: 'Aggregate Customs USD',
  verifiedInvoices: 0,
  clearanceAccuracyPercentage: 0.0,
  pendingInvoices: 4232,
  pendingInvoicesSubtitle: 'Awaiting Agency Audit',
}

/**
 * // TODO [Backend Aggregation]: Implement time-series aggregation endpoint
 * // (/api/invoices/volume-trend) returning monthly clearance volume grouped by invoice saleDate.
 */
const TREND_POINTS: TrendDataPoint[] = [
  { month: 'DEC', value: 3 },
  { month: 'JAN', value: 3 },
  { month: 'FEB', value: 4 },
  { month: 'MAR', value: 24 },
  { month: 'APR', value: 36 },
  { month: 'MAY', value: 42 },
  { month: 'JUN', value: 50 },
  { month: 'JUL', value: 68 },
  { month: 'AUG', value: 72 },
  { month: 'SEP', value: 77 },
  { month: 'OCT', value: 85 },
  { month: 'NOV', value: 100 },
  { month: 'ACTIVE', value: 46, isActive: true },
]

/**
 * // TODO [Backend Metrics]: Calculate real-time prevalidation distributions
 * // from compliance audit records to bind dynamic progress bar widths and status badge.
 */
const ACCURACY_DATA: OperationalAccuracyData = {
  statusBadge: 'TARGET MET',
  items: [
    {
      id: 'anam-verified',
      label: 'ANAM Customs Verified Clearance',
      percentage: 0,
      targetLabel: '0%',
      barColor: 'green',
    },
    {
      id: 'pending-approvals',
      label: 'Pending Customs Approvals',
      percentage: 100,
      targetLabel: '100%',
      barColor: 'orange',
    },
    {
      id: 'compliance-rate',
      label: 'Compliance Verification Rate',
      percentage: 98.5,
      targetLabel: '98.5% Target',
      barColor: 'blue',
    },
  ],
}

/**
 * // TODO [Backend Query & Pagination]: Replace mock invoice rows with real records
 * // fetched from /api/invoices?limit=5&sort=desc; add pagination or link to full ledger.
 */
const SALES_ACTIVITY_ROWS: SalesActivityItem[] = [
  {
    invoiceId: '9400',
    date: '2026-11-04',
    vehicleYear: 2017,
    vehicleMake: 'Nissan',
    vehicleModel: 'Sentra',
    buyer: 'SOCIEDAD DE COMERCIANTES UNIDOS EN VENTA DE AUTOMOVILES SA DE CV',
    amount: 800,
    status: 'PENDING',
  },
  {
    invoiceId: '9401',
    date: '2026-11-04',
    vehicleYear: 2022,
    vehicleMake: 'Honda',
    vehicleModel: 'HR-V',
    buyer: 'SOCIEDAD DE COMERCIANTES UNIDOS EN VENTA DE AUTOMOVILES SA DE CV',
    amount: 2535,
    status: 'PENDING',
  },
  {
    invoiceId: '9402',
    date: '2026-11-04',
    vehicleYear: 2022,
    vehicleMake: 'Ford',
    vehicleModel: 'Bronco',
    buyer: 'SOCIEDAD DE COMERCIANTES UNIDOS EN VENTA DE AUTOMOVILES SA DE CV',
    amount: 2535,
    status: 'PENDING',
  },
  {
    invoiceId: '9403',
    date: '2026-11-04',
    vehicleYear: 2020,
    vehicleMake: 'Subaru',
    vehicleModel: 'Outback',
    buyer: 'SOCIEDAD DE COMERCIANTES UNIDOS EN VENTA DE AUTOMOVILES SA DE CV',
    amount: 1740,
    status: 'PENDING',
  },
  {
    invoiceId: '9404',
    date: '2026-11-04',
    vehicleYear: 2022,
    vehicleMake: 'Honda',
    vehicleModel: 'Civic',
    buyer: 'SOCIEDAD DE COMERCIANTES UNIDOS EN VENTA DE AUTOMOVILES SA DE CV',
    amount: 1875,
    status: 'PENDING',
  },
]

export const ClearanceDashboard: React.FC = () => {
  const [currentDateTime, setCurrentDateTime] = useState('')
  const [fromDate, setFromDate] = useState('2024-01-01')
  const [toDate, setToDate] = useState('2026-12-31')
  const [hoveredTrend, setHoveredTrend] = useState<TrendDataPoint | null>(null)

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date()
      const formatted = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now).toUpperCase()
      setCurrentDateTime(formatted)
    }

    updateDateTime()
    const interval = setInterval(updateDateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat('en-US').format(val)
  }

  const chartWidth = 600
  const chartHeight = 150
  const paddingX = 35
  const paddingY = 20
  const availableWidth = chartWidth - paddingX * 2
  const availableHeight = chartHeight - paddingY * 2
  const maxVal = 100

  const getCoordinates = (index: number, value: number) => {
    const x = paddingX + (index / (TREND_POINTS.length - 1)) * availableWidth
    const y = chartHeight - paddingY - (value / maxVal) * availableHeight
    return { x, y }
  }

  const points = TREND_POINTS.map((pt, idx) => getCoordinates(idx, pt.value))

  let linePath = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i]
    const next = points[i + 1]
    const midX = (current.x + next.x) / 2
    linePath += ` Q ${current.x} ${current.y}, ${midX} ${(current.y + next.y) / 2} T ${next.x} ${next.y}`
  }

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`

  return (
    <div className="flex-1 bg-slate-50 min-h-screen px-6 py-8 overflow-y-auto font-sans text-slate-900">
      {/* Header Section */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-['Manrope',sans-serif] m-0 leading-tight tracking-tight">
            Clearance Analytics
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-medium">
            <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span className="tabular-nums tracking-tight">{currentDateTime || 'NOV 04, 2026, 10:57:56'}</span>
          </div>
        </div>
      </header>

      {/* KPI Metrics Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {/* KPI 1: REGISTERED CUSTOMS TEAM */}
        <div className="bg-white border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">
              Registered Customs Team
            </span>
            <div className="text-xl font-bold text-slate-900 mt-1 font-['Manrope',sans-serif] tabular-nums">
              {INITIAL_METRICS.registeredUsers}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {INITIAL_METRICS.registeredUsersSubtitle}
            </div>
          </div>
          <div className="w-8 h-8 bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
        </div>

        {/* KPI 2: TOTAL CLEARANCE VALUE */}
        <div className="bg-white border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">
              Total Clearance Value
            </span>
            <div className="text-xl font-bold text-slate-900 mt-1 font-['Manrope',sans-serif] tabular-nums">
              {formatCurrency(INITIAL_METRICS.totalClearanceValueUsd)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {INITIAL_METRICS.totalClearanceValueSubtitle}
            </div>
          </div>
          <div className="w-8 h-8 bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* KPI 3: VERIFIED INVOICES */}
        <div className="bg-white border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">
              Verified Invoices
            </span>
            <div className="text-xl font-bold text-slate-900 mt-1 font-['Manrope',sans-serif] tabular-nums">
              {INITIAL_METRICS.verifiedInvoices}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {INITIAL_METRICS.clearanceAccuracyPercentage.toFixed(1)}% Clearance Accuracy
            </div>
          </div>
          <div className="w-8 h-8 bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* KPI 4: PENDING INVOICES */}
        <div className="bg-white border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">
              Pending Invoices
            </span>
            <div className="text-xl font-bold text-slate-900 mt-1 font-['Manrope',sans-serif] tabular-nums">
              {formatNumber(INITIAL_METRICS.pendingInvoices)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {INITIAL_METRICS.pendingInvoicesSubtitle}
            </div>
          </div>
          <div className="w-8 h-8 bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </section>

      {/* Analytics Middle Row */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-8">
        {/* Middle Left: Clearance Volume Trend */}
        <div className="lg:col-span-7 bg-white border border-slate-200 p-4 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif]">
                Clearance Volume Trend
              </h2>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">From</span>
                <div className="flex items-center gap-1 px-2 py-1 border border-slate-200 bg-white text-slate-700 text-xs">
                  <input
                    type="text"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-20 bg-transparent outline-none text-xs"
                    title="From date filter (YYYY-MM-DD)"
                  />
                  <span className="text-slate-400">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">To</span>
                <div className="flex items-center gap-1 px-2 py-1 border border-slate-200 bg-white text-slate-700 text-xs">
                  <input
                    type="text"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-20 bg-transparent outline-none text-xs"
                    title="To date filter (YYYY-MM-DD)"
                  />
                  <span className="text-slate-400">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full relative mt-2">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-44 overflow-visible"
            >
              <line
                x1={paddingX}
                y1={chartHeight - paddingY}
                x2={chartWidth - paddingX}
                y2={chartHeight - paddingY}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <path d={areaPath} fill="#dcf2ea" />

              <path
                d={linePath}
                fill="none"
                stroke="#285442"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <line
                x1={points[points.length - 2].x}
                y1={points[points.length - 2].y}
                x2={points[points.length - 1].x}
                y2={points[points.length - 1].y}
                stroke="#d97706"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {TREND_POINTS.map((pt, idx) => {
                const coord = getCoordinates(idx, pt.value)
                const isAct = pt.isActive
                return (
                  <g key={pt.month}>
                    <circle
                      cx={coord.x}
                      cy={coord.y}
                      r={isAct ? 7 : 6}
                      fill={isAct ? '#d97706' : '#285442'}
                      stroke="#ffffff"
                      strokeWidth="2"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredTrend(pt)}
                      onMouseLeave={() => setHoveredTrend(null)}
                    />
                  </g>
                )
              })}
            </svg>

            {hoveredTrend && (
              <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] px-2.5 py-1 pointer-events-none">
                {hoveredTrend.month}: {hoveredTrend.value}
              </div>
            )}

            <div className="flex justify-between items-center px-4 mt-1 text-[10px] font-medium text-slate-400 tracking-tight">
              {TREND_POINTS.map((pt) => (
                <span
                  key={pt.month}
                  className={pt.isActive ? 'text-slate-700 font-bold' : 'text-slate-400'}
                >
                  {pt.month}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Middle Right: Operational Accuracy */}
        <div className="lg:col-span-5 bg-white border border-slate-200 p-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif] mb-4">
              Operational Accuracy
            </h2>

            <div className="flex flex-col gap-4 mt-4">
              {ACCURACY_DATA.items.map((item) => (
                <div key={item.id}>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1.5">
                    <span className="text-xs">{item.label}</span>
                    <span className="text-xs font-bold text-slate-900 tabular-nums">
                      {item.percentage}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-[#285442]"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Row: Recent Clearance Activity */}
      <section className="bg-white border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            <h2 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif]">
              Recent Clearance Activity
            </h2>
          </div>

          <span className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer">
            View all activity
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 tracking-tight bg-slate-50/60">
                <th className="py-3 px-4">INVOICE ID</th>
                <th className="py-3 px-4">DATE</th>
                <th className="py-3 px-4">VEHICLE</th>
                <th className="py-3 px-4">IMPORTER</th>
                <th className="py-3 px-4 text-right">AMOUNT</th>
                <th className="py-3 px-4 text-center">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {SALES_ACTIVITY_ROWS.map((row) => (
                <tr key={row.invoiceId} className="hover:bg-slate-50 transition-colors cursor-pointer">
                  <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                    {row.invoiceId}
                  </td>
                  <td className="py-3 px-4 text-slate-500 tabular-nums">
                    {row.date}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900">
                      {row.vehicleYear} {row.vehicleMake}
                    </span>{' '}
                    <span className="font-medium text-slate-800">
                      {row.vehicleModel}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={row.buyer}>
                    {row.buyer}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`status-pill ${row.status === 'PENDING' ? 'pending' : 'verified'}`}>
                      <i />
                      {row.status === 'PENDING' ? 'Pending' : 'Verified'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
