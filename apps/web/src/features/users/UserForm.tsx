import { useState, type FormEvent } from 'react'
import type { TeamUser, CreateTeamUserInput, UpdateTeamUserInput } from './types'

type UserFormProps = {
  open: boolean
  onClose: () => void
  onSave: (user: TeamUser) => void
  editingUser: TeamUser | null
}

export function UserForm({ open, onClose, onSave, editingUser }: UserFormProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isCreate = editingUser === null

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const username = String(form.get('username') ?? '').trim()
    const fullName = String(form.get('fullName') ?? '').trim()
    const role = String(form.get('role') ?? '') as 'admin' | 'agent'
    const password = String(form.get('password') ?? '')

    setError('')
    if (!username) { setError('Username is required.'); return }
    if (!fullName) { setError('Full name is required.'); return }
    if (!role) { setError('Select a role.'); return }
    if (isCreate && !password) { setError('Password is required.'); return }
    if (isCreate && password.length < 12) { setError('Password must be at least 12 characters.'); return }

    setBusy(true)
    const payload: { username?: string; fullName?: string; role?: 'admin' | 'agent'; password?: string } = {
      username,
      fullName,
      role,
    }
    if (isCreate) payload.password = password

    void (isCreate ? createUserFlow(payload as CreateTeamUserInput) : updateUserFlow(editingUser!.id, payload as UpdateTeamUserInput))
  }

  async function createUserFlow(input: CreateTeamUserInput) {
    try {
      const { createUser } = await import('./api')
      const user = await createUser(input)
      onSave(user)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not create user.')
    } finally {
      setBusy(false)
    }
  }

  async function updateUserFlow(id: number, input: UpdateTeamUserInput) {
    try {
      const { updateUser } = await import('./api')
      const user = await updateUser(id, input)
      onSave(user)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not update user.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-white border border-slate-200 rounded-lg shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 font-['Manrope',sans-serif]">
            {isCreate ? 'Add team member' : 'Edit team member'}
          </h3>
          <button type="button" className="text-slate-400 hover:text-slate-600" onClick={onClose}>
            <span className="sr-only">Close</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {error && <div className="mb-3 p-2 rounded text-sm text-red-700 bg-red-50" role="alert">{error}</div>}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">Username <span className="text-red-500">*</span></label>
            <input name="username" required maxLength={50} defaultValue={isCreate ? '' : editingUser?.username} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-[#4c39f5] outline-none" />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">Full name <span className="text-red-500">*</span></label>
            <input name="fullName" required maxLength={100} defaultValue={isCreate ? '' : editingUser?.fullName} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-[#4c39f5] outline-none" />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">Role</label>
            <select name="role" defaultValue={isCreate ? 'agent' : editingUser?.role} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-[#4c39f5] outline-none bg-white">
              <option value="admin">Admin</option>
              <option value="agent">Agent</option>
            </select>
          </div>
          {isCreate && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">Password <span className="text-red-500">*</span></label>
              <input name="password" type="password" required minLength={12} maxLength={200} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-[#4c39f5] outline-none" />
              <p className="text-xs text-slate-500">Minimum 12 characters.</p>
            </div>
          )}
          <div className="form-actions flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button type="button" className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors disabled:opacity-50" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-[#4c39f5] hover:bg-[#3829cb] rounded transition-colors disabled:opacity-50" disabled={busy}>
              {busy ? 'Saving…' : isCreate ? 'Create user' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
