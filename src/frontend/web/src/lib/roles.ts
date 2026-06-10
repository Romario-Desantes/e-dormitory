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
  Student: 'Допомагає швидко вирішувати побутові питання в гуртожитку.',
  Commandant: 'Допомагає підтримувати порядок із кімнатами та зверненнями студентів.',
  Master: 'Бачить прохання про допомогу з ремонтом і позначає виконані роботи.',
  Guard: 'Швидко перевіряє гостьові перепустки на вході.',
  Accountant: 'Допомагає бачити оплати й нарахування без зайвої плутанини.',
  Admin: 'Налаштовує користувачів, ролі та довідники системи.',
}

const navigationMap: Record<UserRole, NavItem[]> = {
  Student: [
    {
      to: '/app/overview',
      label: 'Гуртожиток',
      shortLabel: 'Гуртожиток',
      description: 'Коротко про оплату, гостей і ваші прохання',
    },
    {
      to: '/app/tickets',
      label: 'Мої прохання',
      shortLabel: 'Прохання',
      description: 'Попросити про ремонт або подати на переселення',
    },
    {
      to: '/app/passes',
      label: 'Гості',
      shortLabel: 'Гості',
      description: 'Запросити гостя й показати QR-код охороні',
    },
    {
      to: '/app/finance',
      label: 'Мої фінанси',
      shortLabel: 'Фінанси',
      description: 'Перевірити оплату проживання',
    },
  ],
  Commandant: [
    {
      to: '/app/occupancy',
      label: 'Кімнати',
      shortLabel: 'Кімнати',
      description: 'Хто де живе та де є вільні місця',
    },
    {
      to: '/app/relocations',
      label: 'Переселення',
      shortLabel: 'Запити',
      description: 'Відповісти на прохання студентів',
    },
    {
      to: '/app/discipline',
      label: 'Зауваження',
      shortLabel: 'Зауваження',
      description: 'Акуратно вести історію важливих ситуацій',
    },
  ],
  Master: [
    {
      to: '/app/tasks',
      label: 'Ремонти',
      shortLabel: 'Ремонти',
      description: 'Прохання студентів, які треба полагодити',
    },
  ],
  Guard: [
    {
      to: '/app/guard',
      label: 'Вхід',
      shortLabel: 'Вхід',
      description: 'Перевірити QR-код гостя',
    },
  ],
  Accountant: [
    {
      to: '/app/payments',
      label: 'Оплати',
      shortLabel: 'Оплати',
      description: 'Нарахування та підтвердження платежів',
    },
  ],
  Admin: [
    {
      to: '/app/students',
      label: 'Студенти',
      shortLabel: 'Студенти',
      description: 'Мешканці, кімнати й контакти',
    },
    {
      to: '/app/staff',
      label: 'Персонал',
      shortLabel: 'Персонал',
      description: 'Команда гуртожитку та доступи',
    },
    {
      to: '/app/directories',
      label: 'Налаштування',
      shortLabel: 'Налаштув.',
      description: 'Тарифи, категорії та службові списки',
    },
  ],
}

const roleDefaults: Record<UserRole, string> = {
  Student: '/app/overview',
  Commandant: '/app/occupancy',
  Master: '/app/tasks',
  Guard: '/app/guard',
  Accountant: '/app/payments',
  Admin: '/app/students',
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
  return normalizedRole ? roleDescription[normalizedRole] : 'Поки не знаємо, який це доступ.'
}

export function getNavigation(role: UserRole): NavItem[] {
  return navigationMap[role]
}

export function getDefaultRoute(role: UserRole) {
  return roleDefaults[role]
}
