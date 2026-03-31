import type { NavItem, UserRole } from './types'

const roleMap: Record<string, UserRole> = {
  student: 'Student',
  commandant: 'Commandant',
  master: 'Master',
  guard: 'Guard',
  accountant: 'Accountant',
  admin: 'Admin',
}

const roleTitle: Record<UserRole, string> = {
  Student: 'Студент',
  Commandant: 'Комендант',
  Master: 'Майстер',
  Guard: 'Охоронець',
  Accountant: 'Бухгалтер',
  Admin: 'Адміністратор',
}

const roleDescription: Record<UserRole, string> = {
  Student: 'Мешканець гуртожитку, який подає заявки, оформлює перепустки та сплачує нарахування.',
  Commandant: 'Керує кімнатами, переселеннями та дисциплінарними записами.',
  Master: 'Опрацьовує ремонтні заявки та фіксує виконані роботи.',
  Guard: 'Перевіряє перепустки й контролює вхід та вихід гостей.',
  Accountant: 'Контролює нарахування, платежі та підтвердження оплат.',
  Admin: 'Керує акаунтами, ролями, тарифами та системними довідниками.',
}

const navigationMap: Record<UserRole, NavItem[]> = {
  Student: [
    {
      to: '/app/overview',
      label: 'Головна',
      shortLabel: 'Головна',
      description: 'Баланс, перепустки та швидкі дії',
    },
    {
      to: '/app/tickets',
      label: 'Заявки',
      shortLabel: 'Заявки',
      description: 'Звернення на ремонт і їхній стан',
    },
    {
      to: '/app/passes',
      label: 'Перепустки',
      shortLabel: 'Гості',
      description: 'Запрошення гостей та QR-коди',
    },
    {
      to: '/app/finance',
      label: 'Фінанси',
      shortLabel: 'Оплата',
      description: 'Баланс, нарахування та оплати',
    },
  ],
  Commandant: [
    {
      to: '/app/occupancy',
      label: 'Шахматка',
      shortLabel: 'Кімнати',
      description: 'Заселення та вільні місця',
    },
    {
      to: '/app/relocations',
      label: 'Переселення',
      shortLabel: 'Запити',
      description: 'Погодження заяв на переселення',
    },
    {
      to: '/app/discipline',
      label: 'Порушення',
      shortLabel: 'Порушення',
      description: 'Пошук студента та записи',
    },
  ],
  Master: [
    {
      to: '/app/tasks',
      label: 'Завдання',
      shortLabel: 'Завдання',
      description: 'Дошка ремонтів і коментарі',
    },
  ],
  Guard: [
    {
      to: '/app/guard',
      label: 'Термінал',
      shortLabel: 'Термінал',
      description: 'Перевірка перепусток і проходів',
    },
  ],
  Accountant: [
    {
      to: '/app/payments',
      label: 'Платежі',
      shortLabel: 'Платежі',
      description: 'Нарахування, квитанції та звірка',
    },
  ],
  Admin: [
    {
      to: '/app/users',
      label: 'Користувачі',
      shortLabel: 'Користувачі',
      description: 'Акаунти та ролі',
    },
    {
      to: '/app/directories',
      label: 'Довідники',
      shortLabel: 'Довідники',
      description: 'Категорії, тарифи та налаштування',
    },
  ],
}

const roleDefaults: Record<UserRole, string> = {
  Student: '/app/overview',
  Commandant: '/app/occupancy',
  Master: '/app/tasks',
  Guard: '/app/guard',
  Accountant: '/app/payments',
  Admin: '/app/users',
}

export function normalizeRole(role: string | null | undefined): UserRole | null {
  if (!role) {
    return null
  }

  return roleMap[role.trim().toLowerCase()] ?? null
}

export function getRoleTitle(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role)
  return normalizedRole ? roleTitle[normalizedRole] : 'Невідома роль'
}

export function getRoleDescription(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role)
  return normalizedRole ? roleDescription[normalizedRole] : 'Опис ролі недоступний.'
}

export function getNavigation(role: UserRole): NavItem[] {
  return navigationMap[role]
}

export function getDefaultRoute(role: UserRole) {
  return roleDefaults[role]
}
