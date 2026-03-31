import type { DormUser, UserRole } from '../lib/types'

type SectionLink = { id: string; label: string }

const sectionMap: Record<UserRole, SectionLink[]> = {
  Student: [{ id: 'student-hub', label: 'Кабінет мешканця' }],
  Commandant: [{ id: 'commandant-hub', label: 'Комендантський контур' }],
  Master: [{ id: 'master-hub', label: 'Ремонтний контур' }],
  Guard: [{ id: 'guard-hub', label: 'Пост охорони' }],
  Accountant: [{ id: 'accounting-hub', label: 'Фінансовий контур' }],
  Admin: [
    { id: 'student-hub', label: 'Мешканці' },
    { id: 'commandant-hub', label: 'Комендант' },
    { id: 'master-hub', label: 'Ремонти' },
    { id: 'guard-hub', label: 'Охорона' },
    { id: 'accounting-hub', label: 'Фінанси' },
    { id: 'admin-hub', label: 'Адмін' },
  ],
}

const roleMap: Record<string, UserRole> = {
  student: 'Student',
  commandant: 'Commandant',
  master: 'Master',
  guard: 'Guard',
  accountant: 'Accountant',
  admin: 'Admin',
}

export function roomNumberForUser(user: DormUser, rooms: { id: string; roomNumber: string }[]) {
  return rooms.find((room) => room.id === user.roomId)?.roomNumber ?? '—'
}

export function normalizeRole(role: string | null | undefined): UserRole | null {
  if (!role) {
    return null
  }

  return roleMap[role.trim().toLowerCase()] ?? null
}

export function getSections(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role)
  return normalizedRole ? sectionMap[normalizedRole] : []
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', maximumFractionDigits: 2 }).format(amount)
}

export function toInputDateTime(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export const inputClass =
  'w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100'

export const roleTitle: Record<UserRole, string> = {
  Student: 'Студент',
  Commandant: 'Комендант',
  Master: 'Майстер',
  Guard: 'Охоронець',
  Accountant: 'Бухгалтер',
  Admin: 'Адміністратор',
}

export function getRoleTitle(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role)
  return normalizedRole ? roleTitle[normalizedRole] : 'Невідома роль'
}
