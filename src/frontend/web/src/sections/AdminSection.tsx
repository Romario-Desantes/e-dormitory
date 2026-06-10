import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { createTicketCategory, createUser, getRooms, getTicketCategories, getUsers } from '../lib/api'
import type { UserRole } from '../lib/types'
import { Card, SectionFrame, SimpleTable, SubmitButton } from './ui'
import { formatMoney, inputClass, roleTitle, roomNumberForUser } from './utils'

const userSchema = z.object({
  fullName: z.string().min(3).max(120),
  email: z.string().email(),
  phone: z.string().min(5).max(32),
  role: z.enum(['Student', 'Commandant', 'Master', 'Guard', 'Accountant', 'Admin']),
  roomId: z.string().optional(),
})

const categorySchema = z.object({
  categoryName: z.string().min(2).max(120),
  slaHours: z.coerce.number().min(1).max(720),
})

type UserFormValues = z.infer<typeof userSchema>
type CategoryFormInput = z.input<typeof categorySchema>
type CategoryFormValues = z.output<typeof categorySchema>

export function AdminSection() {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: getRooms })
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: getTicketCategories })

  const userForm = useForm<UserFormValues>({ resolver: zodResolver(userSchema), defaultValues: { role: 'Student' } })
  const categoryForm = useForm<CategoryFormInput, unknown, CategoryFormValues>({ resolver: zodResolver(categorySchema), defaultValues: { slaHours: 24 } })

  const createUserMutation = useMutation({
    mutationFn: (values: UserFormValues) => createUser({ ...values, roomId: values.roomId || undefined }),
    onSuccess: async () => {
      userForm.reset({ role: 'Student' })
      setNotice('Користувача створено. Тимчасовий пароль: ChangeMe123!')
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const createCategoryMutation = useMutation({
    mutationFn: (values: CategoryFormValues) => createTicketCategory(values),
    onSuccess: async () => {
      categoryForm.reset({ slaHours: 24 })
      setNotice('Категорію довідника створено.')
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })

  return (
    <SectionFrame id="admin-hub" title="Адмін" description="Користувачі, довідники та базові системні налаштування.">
      {notice ? <div className="mb-6 rounded-[1.5rem] border border-emerald-300 bg-emerald-50 px-5 py-4 text-emerald-900">{notice}</div> : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Створити користувача" subtitle="Акаунти створює адміністратор, користувач далі лише входить.">
          <form className="grid gap-4" onSubmit={userForm.handleSubmit((values) => createUserMutation.mutate(values))}>
            <input className={inputClass} placeholder="ПІБ" {...userForm.register('fullName')} />
            <input className={inputClass} placeholder="Email" {...userForm.register('email')} />
            <input className={inputClass} placeholder="Телефон" {...userForm.register('phone')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <select className={inputClass} {...userForm.register('role')}>
                {(['Student', 'Commandant', 'Master', 'Guard', 'Accountant', 'Admin'] as UserRole[]).map((role) => (
                  <option key={role} value={role}>{roleTitle[role]}</option>
                ))}
              </select>
              <select className={inputClass} {...userForm.register('roomId')}>
                <option value="">Без кімнати</option>
                {(roomsQuery.data ?? []).map((room) => (
                  <option key={room.id} value={room.id}>{room.roomNumber}</option>
                ))}
              </select>
            </div>
            <SubmitButton pending={createUserMutation.isPending} label="Створити акаунт" />
          </form>
        </Card>

        <Card title="Довідник категорій" subtitle="Категорії поломок та SLA для ticket-модуля.">
          <form className="grid gap-4" onSubmit={categoryForm.handleSubmit((values) => createCategoryMutation.mutate(values))}>
            <input className={inputClass} placeholder="Назва категорії" {...categoryForm.register('categoryName')} />
            <input className={inputClass} type="number" placeholder="SLA, год" {...categoryForm.register('slaHours')} />
            <SubmitButton pending={createCategoryMutation.isPending} label="Додати категорію" />
          </form>

          <div className="mt-5 grid gap-3">
            {(categoriesQuery.data ?? []).map((category) => (
              <div key={category.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {category.categoryName} · SLA {category.slaHours} год
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Реєстр користувачів" subtitle="Список активних облікових записів у системі.">
          <SimpleTable headers={['ПІБ', 'Email', 'Роль', 'Кімната', 'Заборгованість']} rows={(usersQuery.data ?? []).map((user) => [user.fullName, user.email, roleTitle[user.role], roomNumberForUser(user, roomsQuery.data ?? []), formatMoney(user.debtAmount ?? 0)])} />
        </Card>
      </div>
    </SectionFrame>
  )
}
