import { PencilSimple, Trash, Key } from '@phosphor-icons/react'
import { useState } from 'react'
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useResetPassword,
  type TeamUser,
} from './useUsers'
import { UserForm } from './UserForm'
import { DeleteConfirmation } from './DeleteConfirmation'
import { ResetPasswordForm } from './ResetPasswordForm'
import type { UserFilters } from './types'

type UserManagementProps = {
  currentUserId?: number | null
  onBack?: () => void
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

function roleBadge(role: 'admin' | 'agent') {
  return role === 'admin'
    ? 'px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white'
    : 'px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700'
}

export function UserManagement({ currentUserId, onBack }: UserManagementProps) {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<UserFilters>({ q: '', role: 'all' })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [usernameToDelete, setUsernameToDelete] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false)
  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | null>(null)
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null)

  const { data: userPage, isLoading, error, refetch } = useUsers(filters, page)
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const resetPassword = useResetPassword()

  const users = userPage?.items ?? []
  const total = userPage?.total ?? 0
  const totalPages = userPage?.totalPages ?? 1
  const loading = isLoading && !userPage

  const queryErrorMessage = error instanceof Error ? error.message : error ?? ''
  const displayError = queryErrorMessage || deleteError || resetPasswordError || undefined

  const handleSearch = (value: string) => {
    setFilters({ ...filters, q: value })
    setPage(1)
  }

  const handleCreate = () => {
    setEditingUser(null)
    setDialogOpen(true)
  }
  const handleEdit = (user: TeamUser) => {
    setEditingUser(user)
    setDialogOpen(true)
  }
  const handleSave = () => {
    setDialogOpen(false)
    setEditingUser(null)
    void refetch()
  }
  const handleDelete = (id: number, username: string) => {
    setPendingDeleteId(id)
    setUsernameToDelete(username)
  }
  const handleCancelDelete = () => {
    setPendingDeleteId(null)
    setUsernameToDelete(null)
  }
  const handleConfirmedDelete = async (id: number) => {
    setDeleteError(null)
    try {
      await deleteUser.mutateAsync(id)
      setPendingDeleteId(null)
      setUsernameToDelete(null)
      setPage(1)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not delete user.')
    }
  }

  const handleResetPasswordOpen = (id: number) => {
    setResetPasswordUserId(id)
    setResetPasswordOpen(true)
  }
  const handleResetPasswordClose = () => {
    setResetPasswordOpen(false)
    setResetPasswordUserId(null)
  }
  const handleSaveResetPassword = async (password: string) => {
    if (resetPasswordUserId == null) return
    setResetPasswordError(null)
    try {
      await resetPassword.mutateAsync({ id: resetPasswordUserId, password })
      setResetPasswordOpen(false)
      setResetPasswordUserId(null)
      void refetch()
    } catch (error) {
      setResetPasswordError(error instanceof Error ? error.message : 'Could not reset password.')
    }
  }

  const isOwnRow = (id: number) => currentUserId != null && id === currentUserId

  return (
    <div className="flex-1 p-6 bg-slate-50 overflow-y-auto font-sans text-slate-900">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 font-['Manrope',sans-serif] m-0 leading-tight tracking-tight">Manage Team</h1>
            <p className="text-xs text-slate-500 mt-1">Add, edit, and control team member access.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 py-1.5 px-3 bg-white border border-slate-300 rounded shadow-sm transition-all cursor-pointer"
              onClick={onBack}
            >
              ← Back to Clearance Analytics
            </button>
          </div>
        </div>

        {displayError && (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-100 text-sm text-red-700" role="alert">
            {displayError}
            <button
              type="button"
              className="ml-3 text-xs underline underline-offset-2 hover:text-red-900"
              onClick={() => void refetch()}
            >
              Retry
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Search</span>
            <input
              type="text"
              placeholder="Search username, name…"
              value={filters.q}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-64 px-3 py-2 text-xs border border-slate-200 rounded focus:ring-2 focus:ring-[#285442] outline-none"
            />
          </div>
          <div className="flex items-center justify-end flex-1">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#285442] hover:bg-[#1e4434] rounded transition-colors disabled:opacity-50 cursor-pointer"
              onClick={handleCreate}
              disabled={createUser.isPending}
            >
              {createUser.isPending ? 'Creating…' : '+ Add user'}
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 tracking-tight bg-slate-50/60">
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Full name</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400">Loading team members…</td></tr>
              )}
              {!loading && users.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-slate-400">No team members found.</td></tr>
              )}
              {!loading &&
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">{user.username}</td>
                    <td className="py-3 px-4 text-slate-700">{user.fullName}</td>
                    <td className="py-3 px-4"><span className={roleBadge(user.role)}>{user.role}</span></td>
                    <td className="py-3 px-4 text-slate-500">{formatDate(user.createdAt)}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Edit user"
                          onClick={() => handleEdit(user)}
                          disabled={updateUser.isPending || deleteUser.isPending}
                        >
                          <PencilSimple className="w-4 h-4" />
                        </button>
                        {isOwnRow(user.id) ? (
                          <button
                            type="button"
                            className="p-1.5 text-slate-400 cursor-not-allowed transition-all disabled:opacity-50"
                            title="Cannot remove your own account."
                            disabled
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        ) : pendingDeleteId === user.id ? null : (
                          <button
                            type="button"
                            className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete user"
                            onClick={() => handleDelete(user.id, user.username)}
                            disabled={deleteUser.isPending}
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Reset password"
                          onClick={() => handleResetPasswordOpen(user.id)}
                          disabled={resetPassword.isPending || deleteUser.isPending}
                        >
                          <Key className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>

          {!loading && users.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                Showing {users.length} of {total.toLocaleString()} members
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((v) => Math.max(1, v - 1))}
                >
                  ← Previous
                </button>
                <span className="text-xs text-slate-500">Page {page} of {Math.max(1, totalPages)}</span>
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  disabled={!userPage || page >= totalPages || loading}
                  onClick={() => setPage((v) => v + 1)}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>

        {pendingDeleteId != null && usernameToDelete != null && (
          <DeleteConfirmation
            open
            username={usernameToDelete}
            onConfirm={() => {
              if (pendingDeleteId != null) {
                void handleConfirmedDelete(pendingDeleteId)
              }
            }}
            onCancel={handleCancelDelete}
          />
        )}

        {resetPasswordOpen && resetPasswordUserId != null && (
          <ResetPasswordForm
            open={resetPasswordOpen}
            onClose={handleResetPasswordClose}
            onSave={handleSaveResetPassword}
          />
        )}

        <UserForm
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditingUser(null) }}
          onSave={handleSave}
          editingUser={editingUser}
        />
      </div>
    </div>
  )
}
