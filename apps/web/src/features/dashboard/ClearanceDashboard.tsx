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
 * // (/api/invoices/volume-trend) returning monthly sales volume grouped by invoice saleDate.
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
  // Live formatted clock for the top-right indicator
  // // TODO [System Clock / Timezone]: Ensure timestamp syncs with agency timezone or customs server time.
  const [currentDateTime, setCurrentDateTime] = useState('')
  const [fromDate, setFromDate] = useState('2024-01-01')
  const [toDate, setToDate] = useState('2026-12-31')
  const [hoveredTrend, setHoveredTrend] = useState<TrendDataPoint | null>(null)

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date()
      // e.g. "NOV 04, 2026, 10:57:56"
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

  // Formatting helpers
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

  // SVG Chart math calculation for the volume trend
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

  // Build SVG path data for area fill and stroke
  const points = TREND_POINTS.map((pt, idx) => getCoordinates(idx, pt.value))
  
  // Create smooth curved path
  let linePath = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i]
    const next = points[i + 1]
    const midX = (current.x + next.x) / 2
    linePath += ` Q ${current.x} ${current.y}, ${midX} ${(current.y + next.y) / 2} T ${next.x} ${next.y}`
  }

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`

  return (
    <div className="flex-1 bg-[#f8fafc] min-h-screen px-7 py-6 overflow-y-auto font-sans text-slate-800">
      {/* Header Section */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xs font-bold tracking-wider text-slate-900 uppercase font-['Manrope',sans-serif] m-0 leading-tight">
            CLEARANCE ANALYTICS
          </h1>
          <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mt-1 m-0 leading-tight">
            OVERVIEW AND STATS
          </p>
        </div>

        {/* Right Header: Date/Time Badge (Dark mode button omitted per instructions) */}
        <div className="flex items-center gap-2.5">
          {/* TODO [System Clock / Timezone]: Connect to local system clock with 1-second interval update or synchronized customs server clock. */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200/90 text-slate-600 text-xs font-mono font-medium shadow-sm">
            <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span className="tabular-nums tracking-tight">{currentDateTime || 'NOV 04, 2026, 10:57:56'}</span>
          </div>
        </div>
      </header>

      {/* 4 KPI Metrics Strip with Distinct Borders & Drop Shadows */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* KPI 1: REGISTERED USERS */}
        {/* TODO [Backend Query]: Fetch total registered customs team members count from /api/users or auth directory service (COUNT of active users), replacing the hardcoded value (8). */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              REGISTERED USERS
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1.5 font-['Manrope',sans-serif] tabular-nums">
              {INITIAL_METRICS.registeredUsers}
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-1">
              {INITIAL_METRICS.registeredUsersSubtitle}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
        </div>

        {/* KPI 2: TOTAL CLEARANCE VALUE */}
        {/* TODO [Backend Query]: Calculate and fetch aggregate total clearance sales (SUM of totalSales column across all customs invoices) via /api/invoices/summary, replacing the hardcoded value ($7,884,405). */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              TOTAL CLEARANCE VALUE
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1.5 font-['Manrope',sans-serif] tabular-nums">
              {formatCurrency(INITIAL_METRICS.totalClearanceValueUsd)}
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-1">
              {INITIAL_METRICS.totalClearanceValueSubtitle}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* KPI 3: VERIFIED INVOICES */}
        {/* TODO [Backend Query]: Fetch verified invoice count (COUNT WHERE verified = 'yes') and compute clearance accuracy percentage ((verified / total) * 100), replacing hardcoded values (0 and 0.0%). */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              VERIFIED INVOICES
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1.5 font-['Manrope',sans-serif] tabular-nums">
              {INITIAL_METRICS.verifiedInvoices}
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-1">
              {INITIAL_METRICS.clearanceAccuracyPercentage.toFixed(1)}% Clearance Accuracy
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* KPI 4: PENDING INVOICES */}
        {/* TODO [Backend Query]: Query database for invoices awaiting agency audit (COUNT WHERE verified != 'yes' OR status = 'pending'), replacing hardcoded value (4,232). */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              PENDING INVOICES
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1.5 font-['Manrope',sans-serif] tabular-nums">
              {formatNumber(INITIAL_METRICS.pendingInvoices)}
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-1">
              {INITIAL_METRICS.pendingInvoicesSubtitle}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </section>

      {/* Analytics Middle Row: Volume Trend & Operational Accuracy with Distinct Cards */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">
        {/* Middle Left: Clearance Volume Trend (Col span 7) */}
        {/* TODO [Backend Aggregation]: Implement time-series aggregation endpoint (/api/invoices/volume-trend) returning monthly sales volume grouped by invoice saleDate to draw real trend points. */}
        <div className="lg:col-span-7 bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif]">
                Clearance Volume Trend
              </h2>
              <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mt-0.5">
                MONTHLY SALES INDEX
              </div>
            </div>

            {/* Date Range Inputs */}
            {/* TODO [Interactive Filtering]: Wire 'From' and 'To' date pickers to state handlers that trigger refetching of the clearance volume trend for the selected date range. */}
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500 font-medium">From</span>
                <div className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-slate-50/70 text-slate-700 text-xs shadow-2xs">
                  <input
                    type="text"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-20 bg-transparent outline-none font-mono text-[11px]"
                    title="From date filter (YYYY-MM-DD)"
                  />
                  <span className="text-slate-400">
                    <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500 font-medium">To</span>
                <div className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-slate-50/70 text-slate-700 text-xs shadow-2xs">
                  <input
                    type="text"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-20 bg-transparent outline-none font-mono text-[11px]"
                    title="To date filter (YYYY-MM-DD)"
                  />
                  <span className="text-slate-400">
                    <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SVG Area Chart */}
          <div className="w-full relative mt-2">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-44 overflow-visible"
            >
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid guide lines */}
              <line
                x1={paddingX}
                y1={chartHeight - paddingY}
                x2={chartWidth - paddingX}
                y2={chartHeight - paddingY}
                stroke="#e2e8f0"
                strokeWidth="1"
              />

              {/* Gradient Area Fill */}
              <path d={areaPath} fill="url(#trendGradient)" />

              {/* Solid Trend Curve */}
              <path
                d={linePath}
                fill="none"
                stroke="#4f46e5"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Active segment tail in cyan/teal */}
              <line
                x1={points[points.length - 2].x}
                y1={points[points.length - 2].y}
                x2={points[points.length - 1].x}
                y2={points[points.length - 1].y}
                stroke="#06b6d4"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Data points */}
              {TREND_POINTS.map((pt, idx) => {
                const coord = getCoordinates(idx, pt.value)
                const isAct = pt.isActive
                return (
                  <g key={pt.month} className="cursor-pointer group">
                    <circle
                      cx={coord.x}
                      cy={coord.y}
                      r={isAct ? 4 : 3}
                      fill={isAct ? '#06b6d4' : '#4f46e5'}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      onMouseEnter={() => setHoveredTrend(pt)}
                      onMouseLeave={() => setHoveredTrend(null)}
                      className="transition-transform group-hover:scale-150"
                    />
                  </g>
                )
              })}
            </svg>

            {/* Hover Tooltip */}
            {hoveredTrend && (
              <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] font-mono px-2.5 py-1 rounded shadow-md pointer-events-none">
                {hoveredTrend.month}: {hoveredTrend.value} Index
              </div>
            )}

            {/* Month Labels along X-Axis */}
            <div className="flex justify-between items-center px-6 mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-tight">
              {TREND_POINTS.map((pt) => (
                <span
                  key={pt.month}
                  className={pt.isActive ? 'text-cyan-600 font-extrabold' : 'text-slate-400'}
                >
                  {pt.month}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Middle Right: Operational Accuracy (Col span 5) */}
        {/* TODO [Backend Metrics]: Calculate real-time prevalidation distributions from compliance audit records to bind dynamic progress bar widths and threshold status badge ('TARGET MET'). */}
        <div className="lg:col-span-5 bg-white rounded-xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif]">
                  Operational Accuracy
                </h2>
                <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mt-0.5">
                  PREVALIDATION SUCCESS DISTRIBUTIONS
                </div>
              </div>

              {/* Status Badge */}
              <span className="text-[10px] font-bold tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/70 rounded px-2.5 py-1 shadow-2xs">
                {ACCURACY_DATA.statusBadge}
              </span>
            </div>

            {/* Progress Bars Stack */}
            <div className="flex flex-col gap-5 mt-3">
              {/* Item 1: ANAM Customs Verified Clearance (0%) */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                  <span className="text-[11px]">ANAM Customs Verified Clearance</span>
                  <span className="text-[11px] font-mono font-bold text-emerald-600">0%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '0%' }} />
                </div>
              </div>

              {/* Item 2: Pending Customs Approvals (100%) */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                  <span className="text-[11px]">Pending Customs Approvals</span>
                  <span className="text-[11px] font-mono font-bold text-amber-600">100%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full shadow-2xs"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Item 3: Compliance Verification Rate (98.5% Target) */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                  <span className="text-[11px]">Compliance Verification Rate</span>
                  <span className="text-[11px] font-mono font-bold text-indigo-600">98.5% Target</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full shadow-2xs"
                    style={{ width: '98.5%' }}
                  />
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Bottom Row: Latest Sales Activity (Expanded Full Width) */}
      {/* TODO [Backend Query & Pagination]: Replace mock invoice rows with real records fetched from /api/invoices?limit=5&sort=desc; add pagination or link to full ledger. */}
      <section className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            <h2 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif]">
              Latest Sales Activity
            </h2>
          </div>

          <span className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer">
            View all activity →
          </span>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/60">
                <th className="py-3 px-5">INVOICE ID</th>
                <th className="py-3 px-5">DATE</th>
                <th className="py-3 px-5">VEHICLE</th>
                <th className="py-3 px-5">BUYER</th>
                <th className="py-3 px-5 text-right">AMOUNT</th>
                <th className="py-3 px-5 text-center">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {SALES_ACTIVITY_ROWS.map((row) => (
                <tr
                  key={row.invoiceId}
                  className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                >
                  {/* INVOICE ID */}
                  {/* TODO [Navigation / Detail Modal]: Attach click handler to invoice rows to open detailed vehicle verification modal or invoice inspection drawer. */}
                  <td className="py-3.5 px-5 font-bold text-slate-900 font-mono">
                    {row.invoiceId}
                  </td>

                  {/* DATE */}
                  <td className="py-3.5 px-5 text-slate-500 font-mono text-[11px]">
                    {row.date}
                  </td>

                  {/* VEHICLE */}
                  <td className="py-3.5 px-5">
                    <span className="font-bold text-slate-900">
                      {row.vehicleYear} {row.vehicleMake}
                    </span>{' '}
                    <span className="font-medium text-slate-800">
                      {row.vehicleModel}
                    </span>
                  </td>

                  {/* BUYER */}
                  <td className="py-3.5 px-5 text-slate-600 max-w-xs truncate" title={row.buyer}>
                    {row.buyer}
                  </td>

                  {/* AMOUNT */}
                  <td className="py-3.5 px-5 text-right font-bold font-mono text-emerald-600 tabular-nums">
                    {formatCurrency(row.amount)}
                  </td>

                  {/* STATUS */}
                  <td className="py-3.5 px-5 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                      <svg className="w-3 h-3 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {row.status}
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
