import { useEffect, useState } from 'react'
import './App.css'
import { getSession, signOutRequest } from './features/auth/api'
import { SignInForm } from './features/auth/SignInForm'
import type { User } from './features/auth/types'
import { InvoiceLedger } from './features/invoices/InvoiceLedger'
import { InvoiceForm } from './features/invoices/InvoiceForm'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [message, setMessage] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const [activeView, setActiveView] = useState<'list' | 'create'>('list')

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

  if (checking) return <main className="page"><p className="loading">Checking your secure session…</p></main>

  return (
    <main className="page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="DataAxcess home"><span className="brand-mark">D</span><span>DataAxcess</span></a>
        <span className="secure-label"><span className="status-dot" /> Secure workspace</span>
      </header>
      <section className="welcome">
        <div className="eyebrow">ANAM · COMPLIANCE CONSOLE</div>
        <h1>{user ? `Welcome back, ${user.username}` : 'Vehicle data, with clarity.'}</h1>
        <p className="intro">A secure workspace for vehicle records, VIN validation, and sales intelligence.</p>
        {message && <p className="form-message" role="alert">{message}</p>}
        {user ? (
          <div className="workspace">
            <header className="workspace-heading">
              <div><div className="eyebrow">RECORDS · SALES</div><h2>{activeView === 'list' ? 'Invoice ledger' : 'New invoice'}</h2><p>{activeView === 'list' ? 'Search and review vehicle sale records.' : 'Enter the vehicle, buyer, and sale details.'}</p></div>
              <div className="workspace-actions"><button className="button primary compact" onClick={() => setActiveView(activeView === 'list' ? 'create' : 'list')}>{activeView === 'list' ? '+ New invoice' : 'View invoices'}</button><div className="account-chip"><span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span><span className="session-copy"><strong>{user.username}</strong><span>{user.role === 'admin' ? 'Administrator' : 'Agent'}</span></span><button className="button secondary" onClick={handleSignOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button></div></div>
            </header>
            {activeView === 'list'
              ? <InvoiceLedger key="ledger" />
              : <InvoiceForm onCreated={() => setActiveView('list')} onCancel={() => setActiveView('list')} />}
          </div>
        ) : (
          <SignInForm onSignedIn={(signedInUser) => { setMessage(''); setUser(signedInUser) }} />
        )}
      </section>
      {!user && <><section className="features" aria-label="Workspace capabilities">
        <article><span className="feature-number">01</span><h3>Invoice records</h3><p>Keep vehicle and sale details organized in one searchable workspace.</p></article>
        <article><span className="feature-number">02</span><h3>VIN validation</h3><p>Review vehicle identifiers and supporting history with confidence.</p></article>
        <article><span className="feature-number">03</span><h3>Clear oversight</h3><p>Give each team member access that matches their role.</p></article>
      </section><footer><span>© {new Date().getFullYear()} DataAxcess</span><span>Built for careful, reliable vehicle data workflows</span></footer></>}
    </main>
  )
}

export default App
