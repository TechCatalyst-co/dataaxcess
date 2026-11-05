import type { UserPage, TeamUser, CreateTeamUserInput, UpdateTeamUserInput } from './types'

const apiBase = import.meta.env.VITE_API_URL ?? ''

async function handleResponse(response: Response) {
  if (response.status === 204) return // No content (e.g. successful DELETE)
  if (response.status === 401) throw new Error('Your session has expired. Sign in again.')
  if (response.status === 403) throw new Error('You do not have permission to manage team members.')
  if (!response.ok) {
    const data = await response.json().catch(() => ({} as { error?: string }))
    throw new Error(data.error ?? 'Could not complete the request.')
  }
  return response.json()
}

export async function fetchUsers(
  filters: { q: string; role: string },
  page: number,
  pageSize: number,
): Promise<UserPage> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  if (filters.q) params.set('q', filters.q)
  if (filters.role && filters.role !== 'all') params.set('role', filters.role)
  const response = await fetch(`${apiBase}/api/users?${params}`, { credentials: 'include' })
  const data = await handleResponse(response)
  return data as UserPage
}

export async function getUser(id: number): Promise<TeamUser> {
  const response = await fetch(`${apiBase}/api/users/${id}`, { credentials: 'include' })
  const data = await handleResponse(response)
  return data as TeamUser
}

export async function createUser(input: CreateTeamUserInput): Promise<TeamUser> {
  const response = await fetch(`${apiBase}/api/users`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await handleResponse(response)
  return data as TeamUser
}

export async function updateUser(id: number, input: UpdateTeamUserInput): Promise<TeamUser> {
  const response = await fetch(`${apiBase}/api/users/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await handleResponse(response)
  return data as TeamUser
}

export async function deleteUser(id: number): Promise<void> {
  const response = await fetch(`${apiBase}/api/users/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  await handleResponse(response)
}

export async function resetPassword(id: number, password: string): Promise<void> {
  const response = await fetch(`${apiBase}/api/users/${id}/password`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  await handleResponse(response)
}
