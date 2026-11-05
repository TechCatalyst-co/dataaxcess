import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
} from './api'
import type { UserFilters, TeamUser, CreateTeamUserInput, UpdateTeamUserInput } from './types'

export function useUsers(filters: UserFilters, page: number) {
  return useQuery({
    queryKey: ['users', filters, page],
    queryFn: () => fetchUsers(filters, page, 20),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTeamUserInput) => createUser(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateTeamUserInput }) =>
      updateUser(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error) => {
      console.error('Delete user failed:', error)
    },
  })
}

export function useResetPassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      resetPassword(id, password),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export type { TeamUser }
