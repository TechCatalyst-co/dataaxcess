import { useEffect, useRef, useState } from 'react'

type DeleteConfirmationProps = {
  open: boolean
  username: string
  onConfirm: () => void
  onCancel: () => void
}

const DELAY_SECONDS = 3

export function DeleteConfirmation({ open, username, onConfirm, onCancel }: DeleteConfirmationProps) {
  const [countdown, setCountdown] = useState(DELAY_SECONDS)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start the countdown immediately when the modal mounts (open === true).
  // Cleans up the interval on unmount (modal closes).
  useEffect(() => {
    if (!open) return

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [open])

  const handleCancel = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    onCancel()
  }

  const handleConfirm = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    onConfirm()
  }

  if (!open) return null

  const countingDown = countdown > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={handleCancel} />
      <div className="relative w-full max-w-md mx-4 bg-white border border-slate-200 rounded-lg shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 font-['Manrope',sans-serif]">Delete team member</h3>
          <button type="button" className="text-slate-400 hover:text-slate-600" onClick={handleCancel}>
            <span className="sr-only">Close</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="mb-4 p-3 rounded bg-rose-50 border border-rose-100 text-sm text-rose-700" role="alert">
          Deleting <strong>{username}</strong> is irreversible. The account cannot be recovered once removed.
        </div>
        <div className="space-y-3">
          {countingDown ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>Deleting in {countdown}…</span>
                <div className="w-5 h-5 border-2 border-slate-200 border-t-rose-600 rounded-full animate-spin" />
              </div>
              <p className="text-xs text-slate-500">Confirm becomes available when the countdown reaches zero.</p>
            </div>
          ) : (
            <p className="text-sm text-slate-600">Confirm to permanently remove this team member.</p>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors disabled:opacity-50 cursor-pointer"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              onClick={handleConfirm}
              disabled={countingDown}
            >
              Confirm delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
