import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import {
  Badge,
  DataTable,
  Input,
  Modal,
  PageSection,
  PrimaryButton,
  SecondaryButton,
  Select,
  SurfaceCard,
  TextField,
} from '../components/AppPrimitives'
import { createUser, deleteUser, getRoles, getRooms, getUsers } from '../lib/api'
import { formatMoney } from '../lib/format'
import { getRoleDescription, getRoleTitle } from '../lib/roles'
import type { DormUser, UserRole } from '../lib/types'

const userSchema = z.object({
  fullName: z.string().min(3, 'Вкажіть ПІБ'),
  email: z.string().email('Вкажіть коректний email'),
  phone: z.string().min(8, 'Вкажіть телефон'),
  role: z.string().min(1, 'Оберіть роль'),
  roomId: z.string().optional(),
})

type UserFormValues = z.infer<typeof userSchema>
type UserCatalogMode = 'students' | 'staff'

export function AdminStudentsPage() {
  return <AdminUsersCatalogPage mode="students" />
}

export function AdminStaffPage() {
  return <AdminUsersCatalogPage mode="staff" />
}

function AdminUsersCatalogPage({ mode }: { mode: UserCatalogMode }) {
  const queryClient = useQueryClient()
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: getRoles })
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: getRooms })
  const [modalOpen, setModalOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<DormUser | null>(null)

  const defaultRole: UserRole = mode === 'students' ? 'Student' : 'Commandant'

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role: defaultRole,
      roomId: '',
    },
  })

  const selectedRole = useWatch({ control: form.control, name: 'role' })
  const isStudentRole = selectedRole === 'Student'

  useEffect(() => {
    if (!isStudentRole) {
      form.setValue('roomId', '')
    }
  }, [form, isStudentRole])

  const users = usersQuery.data ?? []
  const rooms = roomsQuery.data ?? []
  const filteredUsers = users.filter((user) =>
    mode === 'students' ? user.role === 'Student' : user.role !== 'Student',
  )

  const createUserMutation = useMutation({
    mutationFn: (values: UserFormValues) =>
      createUser({
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        role: values.role,
        roomId: values.role === 'Student' ? values.roomId || null : null,
      }),
    onSuccess: async () => {
      form.reset({ role: defaultRole, roomId: '' })
      setModalOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      await queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: async () => {
      setUserToDelete(null)
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      await queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })

  const roomNumberById = (roomId: string | null) =>
    rooms.find((room) => room.id === roomId)?.roomNumber ?? '—'

  return (
    <PageSection
      eyebrow="Адміністрування"
      title={mode === 'students' ? 'Студенти' : 'Персонал'}
      description={
        mode === 'students'
          ? 'Список мешканців із кімнатами, контактами та поточним станом оплати.'
          : 'Команда гуртожитку, ролі та доступи до потрібних розділів.'
      }
      actions={
        <PrimaryButton
          onClick={() => {
            form.reset({ role: defaultRole, roomId: '' })
            setModalOpen(true)
          }}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Створити акаунт
        </PrimaryButton>
      }
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <SurfaceCard>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Усього профілів</p>
          <p className="mt-3 font-display text-4xl text-slate-950">{filteredUsers.length}</p>
        </SurfaceCard>
        <SurfaceCard>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Активні акаунти</p>
          <p className="mt-3 font-display text-4xl text-slate-950">{filteredUsers.filter((user) => user.isActive).length}</p>
        </SurfaceCard>
        <SurfaceCard>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            {mode === 'students' ? 'З кімнатою' : 'Ролей у списку'}
          </p>
          <p className="mt-3 font-display text-4xl text-slate-950">
            {mode === 'students'
              ? filteredUsers.filter((user) => user.roomId).length
              : new Set(filteredUsers.map((user) => user.role)).size}
          </p>
        </SurfaceCard>
      </div>

      <SurfaceCard>
        <DataTable
          headers={
            mode === 'students'
              ? ['ПІБ', 'Email', 'Телефон', 'Кімната', 'До сплати', 'Стан', 'Дії']
              : ['ПІБ', 'Email', 'Телефон', 'Роль', 'Стан', 'Дії']
          }
          rows={filteredUsers.map((user) =>
            mode === 'students'
              ? [
                  user.fullName,
                  user.email,
                  user.phone,
                  roomNumberById(user.roomId),
                  formatMoney(user.debtAmount ?? 0),
                  <Badge tone={user.isActive ? 'emerald' : 'slate'}>
                    {user.isActive ? 'Активний' : 'Неактивний'}
                  </Badge>,
                  <SecondaryButton onClick={() => setUserToDelete(user)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Видалити
                  </SecondaryButton>,
                ]
              : [
                  user.fullName,
                  user.email,
                  user.phone,
                  <Badge tone="sky">{getRoleTitle(user.role)}</Badge>,
                  <Badge tone={user.isActive ? 'emerald' : 'slate'}>
                    {user.isActive ? 'Активний' : 'Неактивний'}
                  </Badge>,
                  <SecondaryButton onClick={() => setUserToDelete(user)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Видалити
                  </SecondaryButton>,
                ],
          )}
        />
      </SurfaceCard>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Новий акаунт">
        <form className="grid gap-4" onSubmit={form.handleSubmit((values) => createUserMutation.mutate(values))}>
          <TextField label="ПІБ">
            <Input placeholder="Наприклад, Ірина Кравець" {...form.register('fullName')} />
          </TextField>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Email">
              <Input type="email" placeholder="name@edormitory.local" {...form.register('email')} />
            </TextField>
            <TextField label="Телефон">
              <Input placeholder="+380..." {...form.register('phone')} />
            </TextField>
          </div>
          <TextField label="Роль">
            <Select {...form.register('role')}>
              {(rolesQuery.data ?? [])
                .filter((role) => (mode === 'students' ? role.name === 'Student' : role.name !== 'Student'))
                .map((role) => (
                  <option key={role.id} value={role.name}>
                    {getRoleTitle(role.name)}
                  </option>
                ))}
            </Select>
          </TextField>
          {isStudentRole ? (
            <TextField label="Кімната" hint="Опціонально">
              <Select {...form.register('roomId')}>
                <option value="">Без прив’язки</option>
                {rooms.map((room) => {
                  const isUnavailable = room.isUnderRepair || room.occupied >= room.capacity

                  return (
                    <option key={room.id} value={room.id} disabled={isUnavailable}>
                      Кімната {room.roomNumber} · {room.occupied}/{room.capacity}
                      {room.isUnderRepair ? ' · ремонт' : room.occupied >= room.capacity ? ' · заповнено' : ''}
                    </option>
                  )
                })}
              </Select>
            </TextField>
          ) : null}
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Початкове нарахування для студента формується за місячною ставкою обраної кімнати.
          </div>
          <div className="flex justify-end gap-3">
            <SecondaryButton type="button" onClick={() => setModalOpen(false)}>Скасувати</SecondaryButton>
            <PrimaryButton type="submit" disabled={createUserMutation.isPending}>
              {createUserMutation.isPending ? 'Створюємо...' : 'Створити'}
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(userToDelete)} onClose={() => setUserToDelete(null)} title="Видалення користувача">
        {userToDelete ? (
          <div className="grid gap-5">
            <p className="text-sm leading-6 text-slate-600">
              Користувача <span className="font-semibold text-slate-950">{userToDelete.fullName}</span> буде деактивовано.
            </p>
            <div className="flex justify-end gap-3">
              <SecondaryButton onClick={() => setUserToDelete(null)}>Скасувати</SecondaryButton>
              <PrimaryButton onClick={() => deleteUserMutation.mutate(userToDelete.id)} disabled={deleteUserMutation.isPending}>
                {deleteUserMutation.isPending ? 'Видаляємо...' : 'Підтвердити'}
              </PrimaryButton>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageSection>
  )
}

export function AdminDirectoriesPage() {
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: getRoles })

  return (
    <PageSection
      eyebrow="Налаштування"
      title="Ролі системи"
      description="У спрощеній 12-табличній схемі залишено лише рольовий довідник; категорії ремонтів і тарифи не є окремими таблицями."
    >
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {(rolesQuery.data ?? []).map((role) => (
          <SurfaceCard key={role.id}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Роль</p>
                <h2 className="text-2xl font-semibold text-slate-950">{getRoleTitle(role.name)}</h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{getRoleDescription(role.name)}</p>
          </SurfaceCard>
        ))}
      </div>
    </PageSection>
  )
}
