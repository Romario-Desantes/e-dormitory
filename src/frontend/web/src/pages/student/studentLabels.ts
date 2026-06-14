import { LampDesk, Sofa, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const repairCategories = ['Електрика', 'Сантехніка', 'Меблі', 'Інше'] as const

export function toTone(value: string): 'slate' | 'sky' | 'emerald' | 'rose' | 'amber' {
  switch (value) {
    case 'emerald':
      return 'emerald'
    case 'rose':
      return 'rose'
    case 'amber':
      return 'amber'
    case 'sky':
      return 'sky'
    default:
      return 'slate'
  }
}

export function toToneLabel(value: string) {
  switch (value) {
    case 'emerald':
      return 'Готово'
    case 'rose':
      return 'Терміново'
    case 'amber':
      return 'В роботі'
    case 'sky':
      return 'Нове'
    default:
      return 'Оновлення'
  }
}

export function ticketLabel(status: string) {
  switch (status) {
    case 'Completed':
      return 'Готово'
    case 'InProgress':
      return 'В роботі'
    case 'New':
      return 'Нова'
    default:
      return status
  }
}

export function ticketDot(status: string) {
  switch (status) {
    case 'Completed':
      return 'bg-emerald-500'
    case 'InProgress':
      return 'bg-sky-500'
    default:
      return 'bg-slate-400'
  }
}

export function passLabel(status: string) {
  switch (status) {
    case 'Expired':
      return 'Прострочена'
    case 'Exited':
      return 'Завершена'
    case 'Entered':
      return 'У гуртожитку'
    default:
      return 'Активна'
  }
}

export function categoryIcon(name: string): LucideIcon {
  const normalized = name.toLowerCase()

  if (normalized.includes('елект')) {
    return LampDesk
  }

  if (normalized.includes('сант')) {
    return Wrench
  }

  return Sofa
}
