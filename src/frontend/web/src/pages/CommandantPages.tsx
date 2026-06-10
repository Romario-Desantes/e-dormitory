import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, Search, ShieldAlert } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import {
  Badge,
  DataTable,
  Drawer,
  Input,
  Modal,
  PageSection,
  PrimaryButton,
  SecondaryButton,
  Select,
  SurfaceCard,
  TextArea,
  TextField,
} from '../components/AppPrimitives'
import {
  createViolation,
  getOccupancy,
  getRelocations,
  getRoomDetail,
  getViolations,
  reviewRelocation,
  searchUsers,
} from '../lib/api'
import { formatDate, formatMoney, toInputDateTime } from '../lib/format'

const violationSchema = z.object({
  userId: z.string().min(1),
  roomId: z.string().optional(),
  severity: z.enum(['Low', 'Medium', 'High']),
  description: z.string().min(8).max(500),
  occurredAt: z.string().min(1),
})

type ViolationFormValues = z.infer<typeof violationSchema>

export function CommandantOccupancyPage() {
  const occupancyQuery = useQuery({ queryKey: ['occupancy'], queryFn: getOccupancy })
  const [selectedFloor, setSelectedFloor] = useState<number | 'all'>('all')
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)

  const roomDetailQuery = useQuery({
    queryKey: ['room-detail', selectedRoomId],
    queryFn: () => getRoomDetail(selectedRoomId!),
    enabled: Boolean(selectedRoomId),
  })

  const floors = occupancyQuery.data ?? []
  const visibleFloors =
    selectedFloor === 'all' ? floors : floors.filter((block) => block.floor === selectedFloor)

  return (
    <PageSection
      eyebrow="Кімнати"
      title="Кімнати гуртожитку"
      description="Відкрийте кімнату, щоб побачити мешканців, вільні місця та тариф."
    >
      <SurfaceCard>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <Building2 className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Фільтр
              </p>
              <h2 className="text-2xl font-semibold text-slate-950">Оберіть поверх</h2>
            </div>
          </div>
          <Select
            className="max-w-xs"
            value={selectedFloor}
            onChange={(event) =>
              setSelectedFloor(event.target.value === 'all' ? 'all' : Number(event.target.value))
            }
          >
            <option value="all">Усі поверхи</option>
            {floors.map((block) => (
              <option key={block.floor} value={block.floor}>
                Поверх {block.floor}
              </option>
            ))}
          </Select>
        </div>
      </SurfaceCard>

      <div className="grid gap-5">
        {visibleFloors.map((block) => (
          <SurfaceCard key={block.floor}>
            <h2 className="mb-5 text-2xl font-semibold text-slate-950">Поверх {block.floor}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {block.rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => setSelectedRoomId(room.id)}
                  className={`rounded-[28px] p-6 text-left text-3xl font-semibold transition hover:scale-[1.01] ${
                    room.isUnderRepair
                      ? 'bg-slate-200 text-slate-700'
                      : room.occupied >= room.capacity
                        ? 'bg-slate-300 text-slate-900'
                        : 'bg-emerald-200 text-emerald-950'
                  }`}
                >
                  {room.roomNumber}
                </button>
              ))}
            </div>
          </SurfaceCard>
        ))}
      </div>

      <Drawer
        open={Boolean(selectedRoomId)}
        onClose={() => setSelectedRoomId(null)}
        title={roomDetailQuery.data ? `Кімната ${roomDetailQuery.data.roomNumber}` : 'Кімната'}
      >
        {roomDetailQuery.data ? (
          <div className="space-y-4">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-sm text-slate-500">Місткість</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">
                {roomDetailQuery.data.occupied}/{roomDetailQuery.data.capacity}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Тариф: {formatMoney(roomDetailQuery.data.monthlyRate)}
              </p>
            </div>

            {(roomDetailQuery.data.residents ?? []).map((resident) => (
              <SurfaceCard key={resident.id} className="rounded-[24px] bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{resident.fullName}</p>
                    <p className="mt-1 text-sm text-slate-500">{resident.phone}</p>
                  </div>
                  <Badge tone="sky">{resident.role}</Badge>
                </div>
              </SurfaceCard>
            ))}
          </div>
        ) : null}
      </Drawer>
    </PageSection>
  )
}

export function CommandantRelocationsPage() {
  const queryClient = useQueryClient()
  const relocationsQuery = useQuery({ queryKey: ['relocations'], queryFn: getRelocations })

  const reviewMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'Approve' | 'Reject' }) =>
      reviewRelocation(id, { decision }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['relocations'] })
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  return (
    <PageSection
      eyebrow="Переселення"
      title="Прохання про переселення"
      description="Перегляньте причину студента й дайте зрозумілу відповідь щодо переїзду."
    >
      <SurfaceCard>
        <DataTable
          headers={['Студент', 'Звідки', 'Куди', 'Причина', 'Дія']}
          rows={(relocationsQuery.data ?? []).map((item) => [
            item.studentName,
            item.fromRoomNumber,
            item.toRoomNumber,
            item.reason,
            item.status === 'Pending' ? (
              <div className="flex flex-wrap gap-2">
                <PrimaryButton
                  className="px-4 py-2"
                  onClick={() => reviewMutation.mutate({ id: item.id, decision: 'Approve' })}
                >
                  Схвалити
                </PrimaryButton>
                <SecondaryButton
                  className="px-4 py-2"
                  onClick={() => reviewMutation.mutate({ id: item.id, decision: 'Reject' })}
                >
                  Відхилити
                </SecondaryButton>
              </div>
            ) : (
              <Badge tone={item.status === 'Approved' ? 'emerald' : 'rose'}>
                {item.status === 'Approved' ? 'Схвалено' : 'Відхилено'}
              </Badge>
            ),
          ])}
        />
      </SurfaceCard>
    </PageSection>
  )
}

export function CommandantDisciplinePage() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const deferredQuery = useDeferredValue(query)

  const violationsQuery = useQuery({ queryKey: ['violations'], queryFn: () => getViolations() })
  const selectedUserViolationsQuery = useQuery({
    queryKey: ['violations', selectedUserId],
    queryFn: () => getViolations(selectedUserId),
    enabled: selectedUserId.length > 0,
  })
  const usersQuery = useQuery({
    queryKey: ['user-search', deferredQuery.trim() || '__all__'],
    queryFn: () => searchUsers('Student', deferredQuery.trim()),
  })

  const form = useForm<ViolationFormValues>({
    resolver: zodResolver(violationSchema),
    mode: 'onChange',
    defaultValues: {
      userId: '',
      roomId: '',
      severity: 'Medium',
      description: '',
      occurredAt: toInputDateTime(new Date()),
    },
  })

  const userOptions = useMemo(() => usersQuery.data ?? [], [usersQuery.data])
  const selectedUser = useMemo(
    () => userOptions.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, userOptions],
  )

  const modalSelectedUserId = useWatch({ control: form.control, name: 'userId' }) ?? ''
  const modalSelectedUser = useMemo(
    () => userOptions.find((user) => user.id === modalSelectedUserId) ?? null,
    [modalSelectedUserId, userOptions],
  )

  useEffect(() => {
    if (!modalOpen) {
      return
    }

    if (modalSelectedUser) {
      form.setValue('roomId', modalSelectedUser.roomId ?? '', { shouldValidate: true })
    }
  }, [form, modalOpen, modalSelectedUser])

  const createViolationMutation = useMutation({
    mutationFn: (values: ViolationFormValues) =>
      createViolation({
        userId: values.userId,
        roomId: values.roomId || null,
        severity: values.severity,
        description: values.description,
        occurredAt: new Date(values.occurredAt).toISOString(),
      }),
    onSuccess: async () => {
      form.reset({
        userId: '',
        roomId: '',
        severity: 'Medium',
        description: '',
        occurredAt: toInputDateTime(new Date()),
      })
      setModalOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['violations'] })
      if (selectedUserId) {
        await queryClient.invalidateQueries({ queryKey: ['violations', selectedUserId] })
      }
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const canSave =
    form.formState.isValid && Boolean(modalSelectedUser) && !createViolationMutation.isPending

  return (
    <PageSection
      eyebrow="Зауваження"
      title="Важливі ситуації"
      description="Знайдіть студента, перегляньте історію й додайте коротке службове зауваження, якщо потрібно."
      actions={
        <PrimaryButton onClick={() => setModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Додати запис
        </PrimaryButton>
      }
    >
      <SurfaceCard>
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Пошук студента
            </p>
            <div className="mt-3 rounded-[24px] border border-slate-200 bg-slate-50 p-2">
              <Input
                placeholder="ПІБ, email або номер кімнати"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1">
                {userOptions.map((user) => {
                  const active = user.id === selectedUserId
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUserId(user.id)}
                      className={`rounded-[18px] border px-4 py-3 text-left transition ${
                        active
                          ? 'border-sky-300 bg-sky-50 shadow-sm'
                          : 'border-white bg-white hover:border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <p className="font-semibold text-slate-950">{user.fullName}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {user.roomNumber ? `Кімната ${user.roomNumber}` : 'Кімнату не вказано'}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <SurfaceCard className="bg-slate-50">
            {selectedUser ? (
              <div className="grid gap-5">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                    <ShieldAlert className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                      Профіль студента
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">{selectedUser.fullName}</h2>
                    <p className="mt-2 text-sm text-slate-600">
                      {selectedUser.roomNumber ? `Кімната ${selectedUser.roomNumber}` : 'Кімнату не вказано'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Усього зауважень
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-slate-950">
                      {selectedUserViolationsQuery.data?.length ?? 0}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Останнє
                    </p>
                    <p className="mt-3 text-sm text-slate-700">
                      {selectedUserViolationsQuery.data?.[0]
                        ? formatDate(selectedUserViolationsQuery.data[0].occurredAt)
                        : 'Ще немає записів'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3">
                  {(selectedUserViolationsQuery.data ?? []).length > 0 ? (
                    (selectedUserViolationsQuery.data ?? []).map((violation) => (
                      <article key={violation.id} className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <p className="font-semibold text-slate-950">{violation.description}</p>
                          <Badge
                            tone={
                              violation.severity === 'High'
                                ? 'rose'
                                : violation.severity === 'Medium'
                                  ? 'amber'
                                  : 'sky'
                            }
                          >
                            {violation.severity}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-slate-500">{formatDate(violation.occurredAt)}</p>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-slate-500">
                      Для цього студента ще немає зауважень.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-[22px] border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-slate-500">
                Оберіть студента ліворуч, щоб побачити історію зауважень.
              </div>
            )}
          </SurfaceCard>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <DataTable
          headers={['Студент', 'Кімната', 'Рівень', 'Опис', 'Дата']}
          rows={(violationsQuery.data ?? []).map((violation) => [
            violation.studentName,
            violation.roomNumber ?? '—',
            <Badge
              key={`${violation.id}-severity`}
              tone={
                violation.severity === 'High'
                  ? 'rose'
                  : violation.severity === 'Medium'
                    ? 'amber'
                    : 'sky'
              }
            >
              {violation.severity === 'High'
                ? 'Високий'
                : violation.severity === 'Medium'
                  ? 'Середній'
                  : 'Низький'}
            </Badge>,
            violation.description,
            formatDate(violation.occurredAt),
          ])}
        />
      </SurfaceCard>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Новий запис">
        <form
          className="grid gap-4"
          onSubmit={form.handleSubmit((values) => createViolationMutation.mutate(values))}
        >
          <TextField label="Студент">
            <Select
              value={modalSelectedUserId}
              onChange={(event) => form.setValue('userId', event.target.value, { shouldValidate: true })}
            >
              <option value="">Оберіть студента</option>
              {userOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName} {user.roomNumber ? `· кімната ${user.roomNumber}` : ''}
                </option>
              ))}
            </Select>
          </TextField>

          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Рівень">
              <Select {...form.register('severity')}>
                <option value="Low">Низький</option>
                <option value="Medium">Середній</option>
                <option value="High">Високий</option>
              </Select>
            </TextField>
            <TextField label="Дата">
              <Input type="datetime-local" {...form.register('occurredAt')} />
            </TextField>
          </div>

          <TextField label="Опис">
            <TextArea
              rows={5}
              placeholder="Коротко опишіть, що сталося."
              {...form.register('description')}
            />
          </TextField>

          <div className="flex justify-end gap-3">
            <SecondaryButton type="button" onClick={() => setModalOpen(false)}>
              Скасувати
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={!canSave}>
              <Search className="mr-2 h-4 w-4" />
              {createViolationMutation.isPending ? 'Зберігаємо…' : 'Зберегти'}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </PageSection>
  )
}
