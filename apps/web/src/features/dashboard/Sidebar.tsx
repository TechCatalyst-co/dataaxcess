import React from 'react'
import type { DashboardNavItemId } from './types'

interface SidebarProps {
  username?: string
  userRole?: 'admin' | 'agent'
  activeNav?: DashboardNavItemId
  onSelectNav?: (navId: DashboardNavItemId) => void
  onSignOut: () => void
  signingOut?: boolean
}

export const Sidebar: React.FC<SidebarProps> = ({
  username = 'datacatalyst',
  userRole,
  activeNav = 'overview',
  onSelectNav,
  onSignOut,
  signingOut = false,
}) => {
  const handleLinkClick = (e: React.MouseEvent, navId: DashboardNavItemId) => {
    e.preventDefault()
    if (onSelectNav) {
      onSelectNav(navId)
    }
  }

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col justify-between min-h-screen px-4 py-5 select-none font-sans z-10">
      <div className="flex flex-col gap-6">
        {/* Brand Header */}
        <div className="px-2">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-slate-900 font-['Manrope',sans-serif]">
              DataAxcess
            </span>
          </div>
          <div className="text-xs font-medium text-slate-600 mt-0.5">
            ANAM COMPLIANCE CONSOLE
          </div>
        </div>

        {/* Main Workspace Section */}
        <div>
          <div className="text-xs font-semibold text-slate-400 px-2 mb-2">
            MAIN WORKSPACE
          </div>
          <nav className="flex flex-col gap-1">
            {/* Overview / Analytics (Active) */}
            <button
              type="button"
              onClick={(e) => handleLinkClick(e, 'overview')}
              className={`flex items-center justify-between w-full px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                activeNav === 'overview'
                  ? 'bg-[#4c39f5] text-white'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title="Overview & Analytics Dashboard"
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 shrink-0 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span>Overview / Analytics</span>
              </div>
            </button>

            <button
              type="button"
              onClick={(e) => handleLinkClick(e, 'audit')}
              className={`flex items-center justify-between w-full px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                activeNav === 'audit'
                  ? 'bg-[#4c39f5] text-white'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <span>Compliance Audit</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Quick Tools Section */}
        <div>
          <div className="text-xs font-semibold text-slate-400 px-2 mb-2">
            QUICK TOOLS
          </div>
          <nav className="flex flex-col gap-1">
            {/* + New Invoice */}
            <button
              type="button"
              onClick={(e) => handleLinkClick(e, 'new_invoice')}
              className={`flex items-center justify-between w-full px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                activeNav === 'new_invoice'
                  ? 'bg-[#4c39f5] text-white'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>New Invoice</span>
              </div>
            </button>

            {/* View All Invoices */}
            <button
              type="button"
              onClick={(e) => handleLinkClick(e, 'view_all_invoices')}
              className={`flex items-center justify-between w-full px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                activeNav === 'view_all_invoices'
                  ? 'bg-[#4c39f5] text-white'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
                <span>View All Invoices</span>
              </div>
            </button>

            {/* Manage Team */}
            {userRole !== 'agent' && (
              <button
                type="button"
                onClick={(e) => handleLinkClick(e, 'manage_team')}
                className={`flex items-center justify-between w-full px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                  activeNav === 'manage_team'
                    ? 'bg-[#4c39f5] text-white'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                  <span>Manage Team</span>
                </div>
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Footer Area: User Card & Sign Out */}
      <div className="pt-4 border-t border-slate-200 flex flex-col gap-3">
        {/* User Chip: Role tag removed */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-8 h-8 bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
            {username.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-slate-800 truncate">
              {username}
            </span>
          </div>
        </div>

        {/* Secure Sign Out Button */}
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold text-white bg-[#4c39f5] hover:bg-[#3829cb] transition-colors disabled:opacity-50 cursor-pointer"
          >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          <span>{signingOut ? 'Signing out…' : 'Secure Sign Out'}</span>
        </button>
      </div>
    </aside>
  )
}
