import type { User } from './types'

const apiBase = import.meta.env.VITE_API_URL ?? ''

export async function getSession(): Promise<User | null> {
  const response = await fetch(`${apiBase}/api/auth/me`, { credentials: 'include' })
  if (response.status === 401) return null
  if (!response.ok) throw new Error('Could not check your session.')
  const data = await parseJsonBody<{ user: User }>(response)
  return data.user
}

export async function signInRequest(username: string, password: string): Promise<User> {
  const response = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await parseJsonBody<{ user?: User; error?: string }>(response)
  if (!response.ok || !data.user) throw new Error(data.error ?? 'Sign in failed.')
  return data.user
}

async function parseJsonBody<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!text) {
    throw new Error(`Server returned an empty response (status ${response.status})`)
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Server returned invalid JSON (status ${response.status})`)
  }
}

export async function signOutRequest(): Promise<void> {
  const response = await fetch(`${apiBase}/api/auth/logout`, { method: 'POST', credentials: 'include' })
  if (!response.ok && response.status !== 401) throw new Error('Could not sign out. Please try again.')
}
