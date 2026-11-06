import { useState } from 'react'

type ResetPasswordFormProps = {
  open: boolean
  onClose: () => void
  onSave: (password: string) => Promise<void>
}

export function ResetPasswordForm({ open, onClose, onSave }: ResetPasswordFormProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!password) { setError('New password is required.'); return }
    if (password.length < 12) { setError('Password must be at least 12 characters.'); return }
    if (!confirm) { setError('Please confirm the password.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setBusy(true)
    void onSave(password)
      .then(() => {
        setBusy(false)
        onClose()
      })
      .catch((submitError: unknown) => {
        setBusy(false)
        setError(submitError instanceof Error ? submitError.message : 'Could not reset password.')
      })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-white border border-slate-200 rounded-lg shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 font-['Manrope',sans-serif]">Reset password</h3>
          <button type="button" className="text-slate-400 hover:text-slate-600" onClick={onClose}>
            <span className="sr-only">Close</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {error && <div className="mb-3 p-2 rounded text-sm text-red-700 bg-red-50" role="alert">{error}</div>}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">New password <span className="text-red-500">*</span></label>
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={200}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-[#4c39f5] outline-none"
            />
            <p className="text-xs text-slate-500">Minimum 12 characters.</p>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">Confirm password <span className="text-red-500">*</span></label>
            <input
              name="confirm"
              type="password"
              required
              minLength={12}
              maxLength={200}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-[#4c39f5] outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors disabled:opacity-50 cursor-pointer"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#4c39f5] hover:bg-[#3829cb] rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={busy}
            >
              {busy ? 'Resetting…' : 'Reset password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
