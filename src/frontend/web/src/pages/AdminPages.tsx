import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BookText,
  PencilLine,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import {
  Badge,
  DataTable,
  EmptyState,
  Input,
  Modal,
  PageSection,
  PrimaryButton,
  SecondaryButton,
  Select,
  SurfaceCard,
  TextField,
} from '../components/AppPrimitives'
import {
  createTariff,
  createTicketCategory,
  createUser,
  deleteTariff,
  deleteUser,
  getRoles,
  getRooms,
  getTariffs,
  getTicketCategories,
  getUsers,
  updateTariff,
} from '../lib/api'
import { formatMoney } from '../lib/format'
import { getRoleDescription, getRoleTitle } from '../lib/roles'
import type { DormUser, Tariff, UserRole } from '../lib/types'

const userSchema = z.object({
  fullName: z.string().min(3, 'Вкажіть ПІБ'),
  email: z.string().email('Вкажіть коректний email'),
  phone: z.string().min(8, 'Вкажіть телефон'),
  role: z.string().min(1, 'Оберіть роль'),
  roomId: z.string().optional(),
  tariffId: z.string().optional(),
})

const categorySchema = z.object({
  categoryName: z.string().min(2, 'Вкажіть назву категорії'),
  slaHours: z.coerce.number().int().positive('SLA має бути додатним'),
})

const tariffSchema = z.object({
  name: z.string().min(2, 'Вкажіть назву тарифу'),
  monthlyRate: z.coerce.number().positive('Сума має бути додатною'),
  floor: z.union([z.coerce.number().int().positive(), z.nan()]).optional(),
  isDefault: z.boolean(),
})

type UserFormValues = z.infer<typeof userSchema>
type CategoryFormInput = z.input<typeof categorySchema>
type CategoryFormValues = z.output<typeof categorySchema>
type TariffFormInput = z.input<typeof tariffSchema>
type TariffFormValues = z.output<typeof tariffSchema>
type DirectoryTab = 'roles' | 'categories' | 'tariffs'
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
  const tariffsQuery = useQuery({ queryKey: ['tariffs'], queryFn: getTariffs })
  const [modalOpen, setModalOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<DormUser | null>(null)

  const defaultRole: UserRole = mode === 'students' ? 'Student' : 'Commandant'

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role: defaultRole,
      roomId: '',
      tariffId: '',
    },
  })

  const selectedRole = useWatch({ control: form.control, name: 'role' })
  const isStudentRole = selectedRole === 'Student'

  useEffect(() => {
    if (!isStudentRole) {
      form.setValue('roomId', '')
      form.setValue('tariffId', '')
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
        tariffId: values.role === 'Student' ? values.tariffId || null : null,
      }),
    onSuccess: async () => {
      form.reset({ role: defaultRole, roomId: '', tariffId: '' })
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
            form.reset({ role: defaultRole, roomId: '', tariffId: '' })
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
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Усього профілів
          </p>
          <p className="mt-3 font-display text-4xl text-slate-950">{filteredUsers.length}</p>
        </SurfaceCard>
        <SurfaceCard>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Активні акаунти
          </p>
          <p className="mt-3 font-display text-4xl text-slate-950">
            {filteredUsers.filter((user) => user.isActive).length}
          </p>
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
        <form
          className="grid gap-4"
          onSubmit={form.handleSubmit((values) => createUserMutation.mutate(values))}
        >
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
            <>
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

              <TextField label="Тариф" hint="Опціонально">
                <Select {...form.register('tariffId')}>
                  <option value="">Автоматично за кімнатою або без тарифу</option>
                  {(tariffsQuery.data ?? []).map((tariff) => (
                    <option key={tariff.id} value={tariff.id}>
                      {tariff.name} · {formatMoney(tariff.monthlyRate)}
                    </option>
                  ))}
                </Select>
              </TextField>
            </>
          ) : null}

          <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Тимчасовий пароль і примусова зміна пароля налаштовуються сервером. Фронтенд не зберігає жодних секретів.
          </div>

          <div className="flex justify-end gap-3">
            <SecondaryButton type="button" onClick={() => setModalOpen(false)}>
              Скасувати
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={createUserMutation.isPending}>
              {createUserMutation.isPending ? 'Створюємо...' : 'Створити'}
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(userToDelete)}
        onClose={() => setUserToDelete(null)}
        title="Видалення користувача"
      >
        {userToDelete ? (
          <div className="grid gap-5">
            <p className="text-sm leading-6 text-slate-600">
              Користувача <span className="font-semibold text-slate-950">{userToDelete.fullName}</span> буде деактивовано.
              Акаунт зникне з активних списків і не зможе увійти до системи.
            </p>
            <div className="flex justify-end gap-3">
              <SecondaryButton onClick={() => setUserToDelete(null)}>Скасувати</SecondaryButton>
              <PrimaryButton
                onClick={() => deleteUserMutation.mutate(userToDelete.id)}
                disabled={deleteUserMutation.isPending}
              >
                {deleteUserMutation.isPending ? 'Видаляємо…' : 'Підтвердити'}
              </PrimaryButton>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageSection>
  )
}

export function AdminDirectoriesPage() {
  const queryClient = useQueryClient()
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: getRoles })
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: getTicketCategories })
  const tariffsQuery = useQuery({ queryKey: ['tariffs'], queryFn: getTariffs })

  const [activeTab, setActiveTab] = useState<DirectoryTab>('roles')
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [tariffModalOpen, setTariffModalOpen] = useState(false)
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null)
  const [tariffToDelete, setTariffToDelete] = useState<Tariff | null>(null)

  const categoryForm = useForm<CategoryFormInput, unknown, CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { slaHours: 24 },
  })

  const tariffForm = useForm<TariffFormInput, unknown, TariffFormValues>({
    resolver: zodResolver(tariffSchema),
    defaultValues: { monthlyRate: 3200, isDefault: false },
  })

  const createCategoryMutation = useMutation({
    mutationFn: (values: CategoryFormValues) => createTicketCategory(values),
    onSuccess: async () => {
      categoryForm.reset({ slaHours: 24 })
      setCategoryModalOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })

  const saveTariffMutation = useMutation({
    mutationFn: (values: TariffFormValues) => {
      const payload = {
        name: values.name,
        monthlyRate: values.monthlyRate,
        floor: Number.isNaN(values.floor) ? null : values.floor ?? null,
        isDefault: values.isDefault,
      }

      return editingTariff ? updateTariff(editingTariff.id, payload) : createTariff(payload)
    },
    onSuccess: async () => {
      tariffForm.reset({ monthlyRate: 3200, isDefault: false })
      setEditingTariff(null)
      setTariffModalOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['tariffs'] })
    },
  })

  const deleteTariffMutation = useMutation({
    mutationFn: (tariffId: string) => deleteTariff(tariffId),
    onSuccess: async () => {
      setTariffToDelete(null)
      await queryClient.invalidateQueries({ queryKey: ['tariffs'] })
    },
  })

  const tabs = useMemo(
    () => [
      { id: 'roles' as const, label: 'Ролі', icon: ShieldCheck },
      { id: 'categories' as const, label: 'Категорії поломок', icon: BookText },
      { id: 'tariffs' as const, label: 'Тарифи', icon: Settings2 },
    ],
    [],
  )

  return (
    <PageSection
      eyebrow="Налаштування"
      title="Списки та тарифи"
      description="Тут зібрані ролі, категорії звернень і тарифи, які бачать користувачі системи."
    >
      <SurfaceCard>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${active ? 'bg-slate-950 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </SurfaceCard>

      {activeTab === 'roles' ? (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {(rolesQuery.data ?? []).map((role) => (
            <SurfaceCard key={role.id}>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Роль</p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">{getRoleTitle(role.name)}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{getRoleDescription(role.name)}</p>
            </SurfaceCard>
          ))}
        </div>
      ) : null}

      {activeTab === 'categories' ? (
        <SurfaceCard>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Категорії</p>
              <h2 className="text-2xl font-semibold text-slate-950">Типи прохань про ремонт</h2>
            </div>
            <PrimaryButton onClick={() => setCategoryModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Додати категорію
            </PrimaryButton>
          </div>

          <DataTable
            headers={['Назва', 'SLA']}
            rows={(categoriesQuery.data ?? []).map((category) => [
              category.categoryName,
              `${category.slaHours} год.`,
            ])}
          />
        </SurfaceCard>
      ) : null}

      {activeTab === 'tariffs' ? (
        (tariffsQuery.data ?? []).length > 0 ? (
          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {(tariffsQuery.data ?? []).map((tariff) => (
              <SurfaceCard key={tariff.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Тариф</p>
                    <h2 className="mt-3 text-2xl font-semibold text-slate-950">{tariff.name}</h2>
                  </div>
                  {tariff.isDefault ? <Badge tone="emerald">За замовчуванням</Badge> : null}
                </div>
                <p className="mt-4 font-display text-4xl text-slate-950">{formatMoney(tariff.monthlyRate)}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {tariff.floor ? `Поверх ${tariff.floor}` : 'Універсальний тариф'}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <SecondaryButton
                    onClick={() => {
                      setEditingTariff(tariff)
                      tariffForm.reset({
                        name: tariff.name,
                        monthlyRate: tariff.monthlyRate,
                        floor: tariff.floor ?? Number.NaN,
                        isDefault: tariff.isDefault,
                      })
                      setTariffModalOpen(true)
                    }}
                  >
                    <PencilLine className="mr-2 h-4 w-4" />
                    Редагувати
                  </SecondaryButton>
                  <SecondaryButton onClick={() => setTariffToDelete(tariff)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Видалити
                  </SecondaryButton>
                </div>
              </SurfaceCard>
            ))}

            <SurfaceCard className="border-dashed bg-slate-50/80">
              <div className="flex h-full flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Новий тариф</p>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-950">Додати тарифний план</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Створіть окремий тариф для поверху або встановіть новий базовий план.
                  </p>
                </div>
                <PrimaryButton
                  className="mt-6"
                  onClick={() => {
                    setEditingTariff(null)
                    tariffForm.reset({ monthlyRate: 3200, isDefault: false })
                    setTariffModalOpen(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Додати
                </PrimaryButton>
              </div>
            </SurfaceCard>
          </div>
        ) : (
          <EmptyState
            title="Тарифів поки немає"
            description="Додайте перший тариф, щоб студентам було зрозуміло, за що вони платять."
            action={
              <PrimaryButton
                onClick={() => {
                  setEditingTariff(null)
                  tariffForm.reset({ monthlyRate: 3200, isDefault: false })
                  setTariffModalOpen(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Додати тариф
              </PrimaryButton>
            }
          />
        )
      ) : null}

      <Modal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title="Нова категорія поломок"
      >
        <form
          className="grid gap-4"
          onSubmit={categoryForm.handleSubmit((values) => createCategoryMutation.mutate(values))}
        >
          <TextField label="Назва категорії">
            <Input placeholder="Наприклад, Електрика" {...categoryForm.register('categoryName')} />
          </TextField>
          <TextField label="SLA, годин">
            <Input type="number" min={1} step={1} {...categoryForm.register('slaHours')} />
          </TextField>
          <div className="flex justify-end gap-3">
            <SecondaryButton type="button" onClick={() => setCategoryModalOpen(false)}>
              Скасувати
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={createCategoryMutation.isPending}>
              {createCategoryMutation.isPending ? 'Зберігаємо...' : 'Зберегти'}
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={tariffModalOpen}
        onClose={() => setTariffModalOpen(false)}
        title={editingTariff ? 'Редагування тарифу' : 'Новий тариф'}
      >
        <form
          className="grid gap-4"
          onSubmit={tariffForm.handleSubmit((values) => saveTariffMutation.mutate(values))}
        >
          <TextField label="Назва тарифу">
            <Input placeholder="Наприклад, Базовий тариф" {...tariffForm.register('name')} />
          </TextField>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Щомісячна ставка">
              <Input type="number" min={0} step="0.01" {...tariffForm.register('monthlyRate')} />
            </TextField>
            <TextField label="Поверх" hint="Опціонально">
              <Input type="number" min={1} step={1} {...tariffForm.register('floor')} />
            </TextField>
          </div>
          <label className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input type="checkbox" {...tariffForm.register('isDefault')} />
            Зробити тарифом за замовчуванням
          </label>
          <div className="flex justify-end gap-3">
            <SecondaryButton type="button" onClick={() => setTariffModalOpen(false)}>
              Скасувати
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={saveTariffMutation.isPending}>
              {saveTariffMutation.isPending ? 'Зберігаємо...' : 'Зберегти'}
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(tariffToDelete)}
        onClose={() => setTariffToDelete(null)}
        title="Видалення тарифу"
      >
        {tariffToDelete ? (
          <div className="grid gap-5">
            <p className="text-sm leading-6 text-slate-600">
              Тариф <span className="font-semibold text-slate-950">{tariffToDelete.name}</span> буде деактивовано й прибрано з активного списку.
            </p>
            <div className="flex justify-end gap-3">
              <SecondaryButton onClick={() => setTariffToDelete(null)}>Скасувати</SecondaryButton>
              <PrimaryButton
                onClick={() => deleteTariffMutation.mutate(tariffToDelete.id)}
                disabled={deleteTariffMutation.isPending}
              >
                {deleteTariffMutation.isPending ? 'Видаляємо…' : 'Підтвердити'}
              </PrimaryButton>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageSection>
  )
}
