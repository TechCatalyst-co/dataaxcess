import { useEffect, useState } from 'react'
import './App.css'
import { getSession, signOutRequest } from './features/auth/api'
import { SignInForm } from './features/auth/SignInForm'
import type { User } from './features/auth/types'
import { InvoiceLedger } from './features/invoices/InvoiceLedger'
import { InvoiceForm } from './features/invoices/InvoiceForm'
import { Sidebar } from './features/dashboard/Sidebar'
import { ClearanceDashboard } from './features/dashboard/ClearanceDashboard'
import type { DashboardNavItemId } from './features/dashboard/types'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [message, setMessage] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const [activeView, setActiveView] = useState<'dashboard' | 'list' | 'create'>('dashboard')
  const [activeNav, setActiveNav] = useState<DashboardNavItemId>('overview')

  useEffect(() => {
    getSession().then(setUser)
      .catch(() => setMessage('Unable to connect to the sign-in service.'))
      .finally(() => setChecking(false))
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    setMessage('')
    try {
      await signOutRequest()
      setUser(null)
      setMessage('You are signed out.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sign out.')
    } finally {
      setSigningOut(false)
    }
  }

  const handleNavSelect = (navId: DashboardNavItemId) => {
    setActiveNav(navId)
    if (navId === 'overview') {
      setActiveView('dashboard')
    } else if (navId === 'view_all_invoices') {
      setActiveView('list')
    } else if (navId === 'new_invoice') {
      setActiveView('create')
    }
  }

  // 1. Loading check
  if (checking) {
    return (
      <main className="page">
        <p className="loading">Checking your secure session…</p>
      </main>
    )
  }

  // 2. Not logged in: Displays your original, untouched login page
  if (!user) {
    return (
      <main className="page">
        <header className="topbar">
          <a className="brand" href="/" aria-label="DataAxcess home">
            <span className="brand-mark">D</span>
            <span>DataAxcess</span>
          </a>
          <span className="secure-label"><span className="status-dot" /> Secure workspace</span>
        </header>
        <section className="welcome">
          <div className="eyebrow">ANAM · COMPLIANCE CONSOLE</div>
          <h1>Vehicle data, with clarity.</h1>
          <p className="intro">A secure workspace for vehicle records, VIN validation, and sales intelligence.</p>
          {message && <p className="form-message" role="alert">{message}</p>}
          <SignInForm onSignedIn={(signedInUser) => { setMessage(''); setUser(signedInUser) }} />
        </section>
        <section className="features" aria-label="Workspace capabilities">
          <article><span className="feature-number">01</span><h3>Invoice records</h3><p>Keep vehicle and sale details organized in one searchable workspace.</p></article>
          <article><span className="feature-number">02</span><h3>VIN validation</h3><p>Review vehicle identifiers and supporting history with confidence.</p></article>
          <article><span className="feature-number">03</span><h3>Clear oversight</h3><p>Give each team member access that matches their role.</p></article>
        </section>
        <footer>
          <span>© {new Date().getFullYear()} DataAxcess</span>
          <span>Built for careful, reliable vehicle data workflows</span>
        </footer>
      </main>
    )
  }

  // 3. Logged in: Replaces old dashboard with modern Clearance Analytics console
  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-800 antialiased font-sans">
      <Sidebar
        username={user.username}
        activeNav={activeNav}
        onSelectNav={handleNavSelect}
        onSignOut={handleSignOut}
        signingOut={signingOut}
      />

      {activeView === 'dashboard' && <ClearanceDashboard />}

      {activeView === 'list' && (
        <div className="flex-1 p-6 bg-slate-50 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 py-1.5 px-3 bg-white border border-slate-200 cursor-pointer"
                onClick={() => { setActiveView('dashboard'); setActiveNav('overview') }}
              >
                ← Back to Clearance Analytics
              </button>
              <button
                type="button"
                className="button primary compact"
                onClick={() => { setActiveView('create'); setActiveNav('new_invoice') }}
              >
                + New invoice
              </button>
            </div>
            <InvoiceLedger key="ledger" />
          </div>
        </div>
      )}

      {activeView === 'create' && (
        <div className="flex-1 p-6 bg-slate-50 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 py-1.5 px-3 bg-white border border-slate-200 cursor-pointer"
                onClick={() => { setActiveView('dashboard'); setActiveNav('overview') }}
              >
                ← Back to Clearance Analytics
              </button>
            </div>
            <InvoiceForm
              onCreated={() => { setActiveView('dashboard'); setActiveNav('overview') }}
              onCancel={() => { setActiveView('dashboard'); setActiveNav('overview') }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default App