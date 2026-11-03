import { useState, type FormEvent } from 'react'
import { signInRequest } from './api'
import type { User } from './types'

type SignInFormProps = { onSignedIn: (user: User) => void }

export function SignInForm({ onSignedIn }: SignInFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const user = await signInRequest(username, password)
      setPassword('')
      onSignedIn(user)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sign in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="login-card" onSubmit={handleSubmit}>
      <div className="card-heading"><div><span className="eyebrow">STAFF ACCESS</span><h2>Sign in to continue</h2></div><span className="lock-icon" aria-hidden="true">⌑</span></div>
      <label htmlFor="username">Username</label>
      <input id="username" name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required maxLength={50} />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={200} />
      {message && <p className="form-message" role="alert">{message}</p>}
      <button className="button primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<span aria-hidden="true">→</span></button>
      <p className="privacy-note">Protected by server-verified access and an HttpOnly session.</p>
    </form>
  )
}
