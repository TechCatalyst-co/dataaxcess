import { useEffect, useState, type FormEvent } from 'react'
import { SignInForm } from '../auth/SignInForm'
import type { User } from '../auth/types'
import logo from '../../assets/DataAxcess-Logo.png'
import './HomePage.css'

type HomePageProps = { onSignedIn: (user: User) => void }
type VehicleData = Record<string, string>

const faq = [
  {
    question: 'What is DataAxcess and how does it secure customs data?',
    answer: 'DataAxcess is a federal-grade vehicle prevalidation tracking engine. Public users can access standard spec decoding (NHTSA vPIC) and external anti-theft lookups. All sensitive invoices, customs rates, compliance certificates, and audit logs are strictly protected behind encrypted login credentials.',
  },
  {
    question: 'How does the public VIN search operate?',
    answer: 'Our public verification engine integrates directly with the US Department of Transportation NHTSA API for spec decoding and references national stolen databases. It is prepared to integrate with vehicle registries for cross-border logistics audit logs.',
  },
  {
    question: 'Are the Prevalidador invoice records publicly visible?',
    answer: 'No. Prevalidador invoice details, including ANAM clearance logs, buyer companies, pricing, and transactional records, are kept completely isolated. They can only be accessed by authenticated Data Analysts or Administrators via the ANAM Compliance Portal.',
  },
]

const features = [
  ['Vehicle API Integration', 'Seamless connection to official vehicle specifications registers, enabling instant checks on make, model, year, and key performance metrics.'],
  ['Stolen Status Reference', 'Direct alignment with standard theft indexes to flag reported stolen statuses, ensuring strict cross-border compliance before transaction clearance.'],
  ['Secure Invoice Data', 'Encrypted ledger files containing invoice values, customs identifiers, and validation records, reserved solely for certified clearance analysts.'],
  ['Scalable Portal Design', 'A modular structural design prepared for dynamic billing controls, subscription profiles, usage statistics, and robust compliance reporting.'],
]

const access = [
  { title: 'Public Visitor', subtitle: 'Free diagnostic suite to validate trust', items: ['Basic Spec Decoding (NHTSA API)', 'NICB VINCheck® stolen reference', 'Public VIN validation'] },
  { title: 'ANAM Prevalidador', subtitle: 'Authorized custom agents & auditors', items: ['Invoice prevalidation records', 'Transaction logs & audit queries', 'Internal validation history', 'Export clearance documents'], operational: true },
  { title: 'Platform Admin', subtitle: 'Internal operations management', items: ['Compliance analytics dashboard', 'Auditor CRUD & User profiles', 'Audit logs & event log streams', 'Direct database migrations access', 'Prevalidador billing controls'] },
]

function HomePage({ onSignedIn }: HomePageProps) {
  const [vin, setVin] = useState('')
  const [vehicle, setVehicle] = useState<VehicleData | null>(null)
  const [vinError, setVinError] = useState('')
  const [vinBusy, setVinBusy] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    if (!loginOpen) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setLoginOpen(false) }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = '' }
  }, [loginOpen])

  async function checkVin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = vin.trim().toUpperCase()
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(value)) {
      setVinError('Enter a valid 17-character VIN.'); setVehicle(null); return
    }
    setVinBusy(true); setVinError(''); setVehicle(null)
    try {
      const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvaluesextended/${encodeURIComponent(value)}?format=json`)
      if (!response.ok) throw new Error('The vehicle lookup is temporarily unavailable. Please try again.')
      const data = await response.json() as { Results?: VehicleData[] }
      const result = data.Results?.[0]
      if (!result || result.ErrorCode === '1' || !result.Make) throw new Error('No vehicle details were found for this VIN. Check the VIN and try again.')
      setVehicle(result)
    } catch (error) {
      setVinError(error instanceof Error ? error.message : 'The vehicle lookup failed. Please try again.')
    } finally { setVinBusy(false) }
  }

  return <div className="marketing-site">
    <header className="marketing-nav">
      <div className="nav-inner">
        <a className="wordmark" href="#top" aria-label="DataAxcess home"><strong>DataAxcess</strong><span>SECURE VEHICLE DATA VALIDATION</span></a>
        <nav aria-label="Main navigation"><a href="#public-tools">PUBLIC TOOLS</a><a href="#secure-access">SECURE ACCESS</a><a href="#workflow">WORKFLOW</a><a href="#support">SUPPORT</a></nav>
        <button className="nav-login" onClick={() => setLoginOpen(true)}>♙ <span>ANAM Login</span></button>
      </div>
    </header>

    <main id="top">
      <section className="hero-section" id="public-tools">
        <div className="hero-copy">
          <span className="hero-pill"><i /> Public VIN checks + protected compliance data access</span>
          <h1>Secure vehicle validation for VIN checks, stolen status, and export workflows.</h1>
          <p>DataAxcess gives users a fast public VIN validation experience while keeping ANAM, Prevalidador, invoice, agency, and export transaction data protected behind secure login.</p>
          <div className="hero-actions"><a className="button-primary" href="#vin-check">Run Public VIN Check</a></div>
          <div className="hero-points"><span>✓ <b>Public VIN validation</b></span><span>✓ <b>NICB stolen vehicle lookup</b></span><span>✓ <b>Protected invoice data access</b></span><span>✓ <b>Built for ANAM / Prevalidador</b></span></div>
        </div>
        <div className="vin-panel" id="vin-check">
          <div className="vin-panel-heading"><div><h2>Public VIN Check</h2><p>No login required for basic validation</p></div><span className="public-badge">PUBLIC TOOL</span></div>
          <form onSubmit={checkVin} className="vin-form"><label htmlFor="public-vin">Enter VIN</label><input id="public-vin" value={vin} onChange={e => setVin(e.target.value.toUpperCase().slice(0, 17))} placeholder="EXAMPLE:  1HGCM82633A123456" maxLength={17} autoCapitalize="characters" />
            <small>Public result: basic vehicle decode, validation status, and stolen-status reference.</small>
            {vinError && <p className="vin-error" role="alert">{vinError}</p>}
            <button className="button-primary vin-submit" type="submit" disabled={vinBusy}>{vinBusy ? 'LOOKING UP VIN…' : 'VALIDATE VIN'}</button>
          </form>
          <div className="reference-links"><a href="https://www.nicb.org/vincheck" target="_blank" rel="noreferrer">NICB Stolen Lookup <span>Open ↗</span></a><a href="https://vpic.nhtsa.dot.gov/decoder/" target="_blank" rel="noreferrer">NHTSA VIN Decoder <span>Open ↗</span></a></div>
          <div className="result-card"><div className="result-title"><strong>{vehicle ? 'VIN Validation Result' : 'Sample Validation Result'}</strong><span>{vehicle ? 'VIN Format Valid' : 'VIN Format Valid'}</span></div>
            {vehicle ? <dl><dt>Vehicle</dt><dd>{[vehicle.ModelYear, vehicle.Make, vehicle.Model].filter(Boolean).join(' ') || 'Details unavailable'}</dd><dt>Body</dt><dd>{vehicle.BodyClass || 'Not provided'}</dd><dt>Engine</dt><dd>{[vehicle.EngineCylinders, vehicle.DisplacementL && `${vehicle.DisplacementL}L`].filter(Boolean).join(' ') || 'Not provided'}</dd><dt>Source</dt><dd>NHTSA vPIC Vehicle API</dd></dl> : <dl><dt>Vehicle</dt><dd>2020 Chevrolet Blazer</dd><dt>Country</dt><dd>United States / Mexico / Canada</dd><dt>Source</dt><dd>Vehicle API + DataAxcess</dd><dt>Stolen Status</dt><dd>Check via NICB</dd></dl>}
          </div>
          <div className="secure-callout"><strong>♧ &nbsp;Secure Portal Login</strong><p>ANAM, Prevalidador, invoice records, agency accounts, and export transaction history require authorized login.</p></div>
        </div>
      </section>

      <section className="capability-strip" id="workflow"><p>BUILT FOR MODERN VALIDATION AND COMPLIANCE OPERATIONS</p><div>{['Vehicle API Ready', 'NICB VINCheck®', 'ANAM Workflow', 'Prevalidador Access', 'Invoice Data', 'Secure Portal'].map(x => <span key={x}>{x}</span>)}</div></section>

      <section className="access-section content-section" id="secure-access"><div className="section-intro"><span className="eyebrow">PUBLIC VS. PROTECTED ACCESS</span><h2>Simple public checks. Secure access for sensitive export data.</h2><p>DataAxcess delivers a seamless public VIN validation experience while securing sensitive customs ledger invoices, client records, export parameters, and official agency workflows behind bank-grade authentication.</p></div><div className="access-columns"><article><h3>Public Access</h3>{['VIN validation through Vehicle API', 'Basic vehicle decode and validation status', 'NICB VINCheck® stolen vehicle lookup link', 'NHTSA VIN decoder reference link', 'Lead capture or request-access prompt'].map(x => <p key={x}><b>✓</b>{x}</p>)}</article><article><h3>Login Required</h3>{['ANAM / Prevalidador invoice data access', 'Agency and customer records', 'Export transaction history', 'Internal DataAxcess validation records', 'Audit logs, user activity, and compliance dashboard'].map(x => <p key={x}><b>✓</b>{x}</p>)}</article></div></section>

      <section className="features-section content-section"><div className="section-intro"><span className="eyebrow">CORE FEATURES</span><h2>Designed for vehicle data intake, validation, and secure compliance support.</h2><p>Our responsive cloud platform is optimized for seamless cross-border vehicle validation, offering robust API integrations, real-time tracking dashboards, and tamper-proof compliance histories.</p></div><div className="feature-grid">{features.map(([title, body], i) => <article key={title}><span className={`feature-icon icon-${i}`}>{['▦', '⛨', '▤', '▱'][i]}</span><h3>{title}</h3><p>{body}</p></article>)}</div></section>

      <section className="matrix-section content-section"><div className="center-intro"><h2>System Information Access Matrix</h2><p>Review what databases and tools are accessible publicly versus operational sections protected behind secure login gates.</p></div><div className="matrix-grid">{access.map((group, index) => <article className={group.operational ? 'operational' : ''} key={group.title}>{group.operational && <span className="operational-tag">OPERATIONAL</span>}<span className="matrix-icon">{['⊘', '▱', '▤'][index]}</span><h3>{group.title}</h3><p>{group.subtitle}</p><ul>{group.items.map(item => <li key={item}>{item}</li>)}</ul></article>)}</div></section>

      <section className="faq-section content-section" id="support"><div className="center-intro"><span className="faq-icon">?</span><h2>Frequently Asked Questions</h2><p>Learn more about how DataAxcess separates public lookups from operational customs data.</p></div><div className="faq-list">{faq.map((item, index) => <article className={openFaq === index ? 'faq-open' : ''} key={item.question}><button aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}>{item.question}<span>{openFaq === index ? '⌃' : '⌄'}</span></button>{openFaq === index && <p>{item.answer}</p>}</article>)}</div></section>
    </main>

    <footer className="marketing-footer"><div className="footer-inner"><div className="footer-top"><div className="footer-about"><a className="wordmark" href="#top"><strong>DataAxcess</strong><span>SECURE VEHICLE DATA VALIDATION</span></a><p>Advanced prevalidation utility delivering high-performance cross-border vehicle validation, public specification queries, and encrypted customs ledger controls.</p></div><div className="footer-links"><h3>PUBLIC TOOLS</h3><a href="#vin-check">VIN Validation →</a><a href="https://www.nicb.org/vincheck">NICB VINCheck® ↗</a><a href="https://vpic.nhtsa.dot.gov/decoder/">NHTSA Decoder ↗</a></div><div className="footer-links"><h3>SECURE PORTAL</h3><a href="#secure-access" onClick={e => { e.preventDefault(); setLoginOpen(true) }}>ANAM / Prevalidador →</a><a href="#secure-access" onClick={e => { e.preventDefault(); setLoginOpen(true) }}>Invoice Data →</a><a href="#secure-access" onClick={e => { e.preventDefault(); setLoginOpen(true) }}>Agency Records →</a><a href="#secure-access" onClick={e => { e.preventDefault(); setLoginOpen(true) }}>Audit Logs →</a></div></div><div className="footer-bottom"><p>© 2026 DataAxcess. All rights reserved. Registered Federal Prevalidation &amp; Customs Compliance Portal.</p><p>DataAxcess is a private prevalidation utility. Stolen vehicle history validation queries consult external national registries. NICB VINCheck® is a registered trademark of the National Insurance Crime Bureau. NHTSA vPIC data is supplied by the U.S. Department of Transportation.</p></div></div></footer>

    {loginOpen && <div className="login-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setLoginOpen(false) }}><section className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title"><button className="modal-close" aria-label="Close login" onClick={() => setLoginOpen(false)}>×</button><img src={logo} alt="DataAxcess — Seamless Data Validation"/><h2 id="login-title">ANAM Compliance Portal</h2><p className="modal-subtitle">Authorized customs Prevalidador credentials required</p><SignInForm onSignedIn={user => { setLoginOpen(false); onSignedIn(user) }}/></section></div>}
  </div>
}

export default HomePage
