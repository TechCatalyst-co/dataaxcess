export type TeamUser = {
  id: number
  username: string
  fullName: string
  role: 'admin' | 'agent'
  createdAt: string
}

export type UserPage = {
  items: TeamUser[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type CreateTeamUserInput = {
  username: string
  fullName: string
  password: string
  role: 'admin' | 'agent'
}

export type UpdateTeamUserInput = {
  fullName?: string
  role?: 'admin' | 'agent'
}

export type ResetPasswordInput = {
  password: string
}

export type UserFilters = {
  q: string
  role: 'admin' | 'agent' | 'all'
}
