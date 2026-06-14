import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, DoorOpen, TicketPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { useCurrentUser } from '../../components/AppShellContext'
import {
  EmptyState,
  Modal,
  PageSection,
  PrimaryButton,
  SecondaryButton,
  Select,
  SurfaceCard,
  TextArea,
  TextField,
} from '../../components/AppPrimitives'
import { createRelocation, createTicket, getRelocations, getRooms, getTickets } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { categoryIcon, repairCategories, ticketDot, ticketLabel } from './studentLabels'

const ticketSchema = z.object({
  category: z.string().min(1, 'Оберіть категорію.'),
  description: z.string().min(10, 'Додайте трохи деталей.'),
})

const relocationSchema = z.object({
  toRoomId: z.string().min(1, 'Оберіть кімнату.'),
  reason: z.string().min(8, 'Коротко поясніть причину.'),
})

type TicketFormValues = z.infer<typeof ticketSchema>
type RelocationFormValues = z.infer<typeof relocationSchema>

export function StudentTicketsPage() {
  const currentUser = useCurrentUser()
  const queryClient = useQueryClient()
  const ticketsQuery = useQuery({ queryKey: ['tickets', currentUser.id], queryFn: getTickets })
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: getRooms })
  const relocationsQuery = useQuery({ queryKey: ['relocations', currentUser.id], queryFn: getRelocations })

  const [ticketModalOpen, setTicketModalOpen] = useState(false)
  const [relocationModalOpen, setRelocationModalOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const ticketForm = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { category: '', description: '' },
  })
  const relocationForm = useForm<RelocationFormValues>({
    resolver: zodResolver(relocationSchema),
    defaultValues: { toRoomId: '', reason: '' },
  })

  const selectedCategory = useWatch({ control: ticketForm.control, name: 'category' }) ?? ''
  const tickets = ticketsQuery.data ?? []
  const relocationRequests = relocationsQuery.data ?? []

  const currentRoom = useMemo(
    () => (roomsQuery.data ?? []).find((room) => room.id === currentUser.roomId) ?? null,
    [currentUser.roomId, roomsQuery.data],
  )

  const availableRooms = useMemo(
    () =>
      (roomsQuery.data ?? []).filter(
        (room) => room.id !== currentUser.roomId && !room.isUnderRepair && room.occupied < room.capacity,
      ),
    [currentUser.roomId, roomsQuery.data],
  )

  const createTicketMutation = useMutation({
    mutationFn: (values: TicketFormValues) => {
      const description = values.description.trim().replace(/\s+/g, ' ')

      return createTicket({
        category: values.category,
        title: `${values.category}: ${description.slice(0, 60)}`,
        description: values.description,
        priority: 'Medium',
      })
    },
    onSuccess: async () => {
      ticketForm.reset({ category: '', description: '' })
      setTicketModalOpen(false)
      setSuccessMessage('Готово! Заявку передано майстру.')
      await queryClient.invalidateQueries({ queryKey: ['tickets', currentUser.id] })
      await queryClient.invalidateQueries({ queryKey: ['notifications', currentUser.id] })
    },
  })

  const relocationMutation = useMutation({
    mutationFn: (values: RelocationFormValues) => createRelocation(values),
    onSuccess: async () => {
      relocationForm.reset({ toRoomId: '', reason: '' })
      setRelocationModalOpen(false)
      setSuccessMessage('Готово! Запит на переселення надіслано коменданту.')
      await queryClient.invalidateQueries({ queryKey: ['relocations'] })
      await queryClient.invalidateQueries({ queryKey: ['notifications', currentUser.id] })
    },
  })

  return (
    <PageSection
      eyebrow="Мої прохання"
      title="Що потрібно вирішити?"
      description="Створіть заявку на ремонт або подайте прохання про переселення."
      actions={
        <>
          <PrimaryButton onClick={() => setTicketModalOpen(true)}>
            <TicketPlus className="mr-2 h-4 w-4" />
            Попросити про ремонт
          </PrimaryButton>
          <SecondaryButton onClick={() => setRelocationModalOpen(true)}>
            <DoorOpen className="mr-2 h-4 w-4" />
            Хочу переселитися
          </SecondaryButton>
        </>
      }
    >
      {successMessage ? (
        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">{successMessage}</span>
          </div>
        </div>
      ) : null}

      {tickets.length > 0 ? (
        <div className="grid gap-4">
          {tickets.map((ticket) => (
            <article
              key={ticket.id}
              className="flex flex-col items-start justify-between gap-4 rounded-[28px] border border-white/70 bg-white px-5 py-5 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.25)] sm:flex-row sm:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-slate-950">{ticket.title}</p>
                <p className="mt-1 text-sm text-slate-500">{formatDate(ticket.createdAt)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${ticketDot(ticket.status)}`} />
                <span className="text-sm font-medium text-slate-700">{ticketLabel(ticket.status)}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Прохань про ремонт ще немає" description="Якщо щось зламається, створіть заявку для майстра." />
      )}

      <SurfaceCard>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Переселення</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Мої прохання про кімнату</h2>
        </div>

        <div className="mt-6 grid gap-4">
          {relocationRequests.length > 0 ? (
            relocationRequests.map((request) => (
              <article key={request.id} className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-950">
                      {request.fromRoomNumber} {"→"} {request.toRoomNumber}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{request.reason}</p>
                    {request.reviewComment ? (
                      <p className="mt-3 text-sm text-slate-500">Відповідь коменданта: {request.reviewComment}</p>
                    ) : null}
                  </div>
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    {request.status}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <EmptyState title="Заявок на переселення ще немає" description="Оберіть доступну кімнату та коротко поясніть причину." />
          )}
        </div>
      </SurfaceCard>

      <Modal open={ticketModalOpen} onClose={() => setTicketModalOpen(false)} title="Попросити про ремонт">
        <form className="grid gap-5" onSubmit={ticketForm.handleSubmit((values) => createTicketMutation.mutate(values))}>
          <div className="grid gap-4 sm:grid-cols-2">
            {repairCategories.map((category) => {
              const Icon = categoryIcon(category)

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => ticketForm.setValue('category', category, { shouldValidate: true })}
                  className={`rounded-[24px] border px-5 py-5 text-left transition ${
                    selectedCategory === category
                      ? 'border-slate-950 bg-slate-950 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <p className="mt-3 text-lg font-semibold">{category}</p>
                </button>
              )
            })}
          </div>

          <TextField label="Опис проблеми">
            <TextArea rows={6} placeholder="Наприклад: у кімнаті не працює розетка біля столу." {...ticketForm.register('description')} />
          </TextField>

          <div className="flex justify-end gap-3">
            <SecondaryButton type="button" onClick={() => setTicketModalOpen(false)}>
              Скасувати
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={createTicketMutation.isPending}>
              {createTicketMutation.isPending ? 'Відправляємо...' : 'Передати майстру'}
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal open={relocationModalOpen} onClose={() => setRelocationModalOpen(false)} title="Хочу переселитися">
        <form className="grid gap-5" onSubmit={relocationForm.handleSubmit((values) => relocationMutation.mutate(values))}>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-sm text-slate-500">Поточна кімната</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">{currentRoom?.roomNumber ?? 'Ще не призначена'}</p>
          </div>

          <TextField label="Куди хотіли б переїхати">
            <Select {...relocationForm.register('toRoomId')}>
              <option value="">Оберіть кімнату</option>
              {availableRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  Кімната {room.roomNumber} · поверх {room.floor} · вільно {room.capacity - room.occupied} місць
                </option>
              ))}
            </Select>
          </TextField>

          <TextField label="Причина">
            <TextArea rows={5} placeholder="Коротко поясніть причину переселення." {...relocationForm.register('reason')} />
          </TextField>

          <div className="flex justify-end gap-3">
            <SecondaryButton type="button" onClick={() => setRelocationModalOpen(false)}>
              Скасувати
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={relocationMutation.isPending}>
              {relocationMutation.isPending ? 'Надсилаємо...' : 'Передати коменданту'}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </PageSection>
  )
}
