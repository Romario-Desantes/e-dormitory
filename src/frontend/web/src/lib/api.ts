import axios from 'axios'
import { normalizeRole } from './roles'
import type {
  AuthenticatedUser,
  Charge,
  DormUser,
  GuestPass,
  NotificationFeed,
  PassLog,
  Payment,
  RelocationRequest,
  RoleDirectory,
  Room,
  RoomDetail,
  RoomOccupancy,
  Ticket,
  TicketDetail,
  UserLookup,
  Violation,
  CreateDormUserPayload,
} from './types'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
})

const ticketPriorityMap = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
} as const

const ticketStatusMap = {
  New: 1,
  InProgress: 2,
  Completed: 3,
} as const

const paymentMethodMap = {
  Manual: 1,
  MockGateway: 2,
} as const

const relocationDecisionMap = {
  Approve: 1,
  Reject: 2,
} as const

function parseAuthenticatedUser(payload: unknown): AuthenticatedUser {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Unexpected auth payload.')
  }

  const candidate = payload as Record<string, unknown>
  const role = normalizeRole(typeof candidate.role === 'string' ? candidate.role : null)

  if (!role) {
    throw new Error('Unexpected user role.')
  }

  return {
    id: String(candidate.id ?? ''),
    fullName: String(candidate.fullName ?? ''),
    email: String(candidate.email ?? ''),
    phone: String(candidate.phone ?? ''),
    role,
    roomId: typeof candidate.roomId === 'string' ? candidate.roomId : null,
    mustChangePassword: Boolean(candidate.mustChangePassword),
    debtAmount:
      candidate.debtAmount === null || candidate.debtAmount === undefined
        ? null
        : Number(candidate.debtAmount),
  }
}

api.interceptors.request.use((config) => {
  const method = config.method?.toLowerCase()
  if (method && !['get', 'head', 'options'].includes(method)) {
    const csrfToken = document.cookie
      .split('; ')
      .find((chunk) => chunk.startsWith('edormitory_csrf='))
      ?.split('=')[1]

    if (csrfToken) {
      config.headers['X-CSRF-TOKEN'] = decodeURIComponent(csrfToken)
    }
  }

  return config
})

export async function login(payload: { email: string; password: string }) {
  const response = await api.post('/auth/login', payload)
  return {
    user: parseAuthenticatedUser((response.data as { user?: unknown }).user),
    expiresAt: String((response.data as { expiresAt?: unknown }).expiresAt ?? ''),
  }
}

export async function logout() {
  await api.post('/auth/logout')
}

export async function getCurrentUser() {
  const response = await api.get('/auth/me')
  return parseAuthenticatedUser(response.data)
}

export async function getNotifications() {
  const response = await api.get('/notifications')
  return response.data as NotificationFeed
}

export async function markNotificationsRead() {
  await api.post('/notifications/read')
}

export async function getRooms() {
  const response = await api.get('/rooms')
  return response.data as Room[]
}

export async function getRoomDetail(id: string) {
  const response = await api.get(`/rooms/${id}`)
  return response.data as RoomDetail
}

export async function getOccupancy() {
  const response = await api.get('/rooms/occupancy')
  return response.data as RoomOccupancy[]
}

export async function getRelocations() {
  const response = await api.get('/rooms/relocations')
  return response.data as RelocationRequest[]
}

export async function createRelocation(payload: { toRoomId: string; reason: string }) {
  const response = await api.post('/rooms/relocations', payload)
  return response.data as RelocationRequest
}

export async function reviewRelocation(id: string, payload: { decision: 'Approve' | 'Reject'; reviewComment?: string }) {
  const response = await api.post(`/rooms/relocations/${id}/review`, {
    decision: relocationDecisionMap[payload.decision],
    reviewComment: payload.reviewComment,
  })
  return response.data as RelocationRequest
}

export async function getViolations(userId?: string) {
  const response = await api.get('/rooms/violations', {
    params: userId ? { userId } : undefined,
  })
  return response.data as Violation[]
}

export async function createViolation(payload: { userId: string; roomId?: string | null; severity: string; description: string; occurredAt: string }) {
  const response = await api.post('/rooms/violations', payload)
  return response.data as Violation
}

export async function searchUsers(role: string, query: string) {
  const response = await api.get('/users/search', {
    params: {
      role,
      q: query,
    },
  })

  return response.data as UserLookup[]
}

export async function getRoles() {
  const response = await api.get('/directories/roles')
  return response.data as RoleDirectory[]
}

export async function getTickets() {
  const response = await api.get('/tickets')
  return response.data as Ticket[]
}

export async function getTicketDetail(id: string) {
  const response = await api.get(`/tickets/${id}`)
  return response.data as TicketDetail
}

export async function createTicket(payload: {
  category: string
  title: string
  description: string
  priority: 'Low' | 'Medium' | 'High' | 'Critical'
}) {
  const response = await api.post('/tickets', {
    ...payload,
    priority: ticketPriorityMap[payload.priority],
  })
  return response.data as Ticket
}

export async function updateTicketStatus(id: string, payload: { status: 'New' | 'InProgress' | 'Completed'; masterNotes?: string }) {
  const response = await api.post(`/tickets/${id}/status`, {
    status: ticketStatusMap[payload.status],
    masterNotes: payload.masterNotes,
  })
  return response.data as Ticket
}

export async function getPasses() {
  const response = await api.get('/passes')
  return response.data as GuestPass[]
}

export async function createPass(payload: { guestFullName: string; guestDocument: string; validFrom: string; validTo: string }) {
  const response = await api.post('/passes', payload)
  return response.data as GuestPass
}

export async function validatePass(payload: { accessCode: string; remarks?: string }) {
  const response = await api.post('/passes/validate', payload)
  return response.data as PassLog
}

export async function getPassLogs() {
  const response = await api.get('/passes/logs')
  return response.data as PassLog[]
}

export async function getCharges() {
  const response = await api.get('/payments/charges')
  return response.data as Charge[]
}

export async function getPayments() {
  const response = await api.get('/payments')
  return response.data as Payment[]
}

export async function createPayment(payload: { chargeId?: string | null; amount: number; paymentMethod: 'Manual' | 'MockGateway' }) {
  const response = await api.post('/payments', {
    ...payload,
    paymentMethod: paymentMethodMap[payload.paymentMethod],
  })
  return response.data as Payment
}

export async function confirmPayment(id: string, payload: { externalReceiptId?: string }) {
  const response = await api.post(`/payments/${id}/confirm`, payload)
  return response.data as Payment
}

export async function getUsers() {
  const response = await api.get('/users')
  return response.data as DormUser[]
}

export async function createUser(payload: CreateDormUserPayload) {
  const response = await api.post('/users', payload)
  return response.data as DormUser
}

export async function deleteUser(id: string) {
  await api.delete(`/users/${id}`)
}
