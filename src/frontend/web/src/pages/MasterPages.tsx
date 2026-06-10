import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eye, SquareCheckBig, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import {
  Badge,
  EmptyState,
  Modal,
  PageSection,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
  TextArea,
  TextField,
} from '../components/AppPrimitives'
import { getTicketDetail, getTickets, updateTicketStatus } from '../lib/api'
import { formatDate } from '../lib/format'

const ticketNotesSchema = z.object({
  masterNotes: z.string().max(2000).optional(),
})

type TicketNotesFormValues = z.infer<typeof ticketNotesSchema>
type BoardStatus = 'New' | 'InProgress' | 'Completed'

export function MasterTasksPage() {
  const queryClient = useQueryClient()
  const ticketsQuery = useQuery({ queryKey: ['tickets'], queryFn: getTickets })
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null)
  const [pendingComplete, setPendingComplete] = useState<{ id: string; title: string } | null>(null)
  const [completeComment, setCompleteComment] = useState('')

  const tickets = ticketsQuery.data ?? []
  const columns = useMemo(
    () => [
      { id: 'New' as const, label: 'Нові' },
      { id: 'InProgress' as const, label: 'В процесі' },
      { id: 'Completed' as const, label: 'Завершено' },
    ],
    [],
  )

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      status,
      masterNotes,
    }: {
      id: string
      status: BoardStatus
      masterNotes?: string
    }) => updateTicketStatus(id, { status, masterNotes }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  const handleDrop = (status: BoardStatus) => {
    if (!draggedTicketId) {
      return
    }

    const current = tickets.find((ticket) => ticket.id === draggedTicketId)
    if (!current || current.status === status) {
      setDraggedTicketId(null)
      return
    }

    if (status === 'Completed') {
      setPendingComplete({ id: current.id, title: current.title })
      setDraggedTicketId(null)
      return
    }

    updateMutation.mutate({ id: current.id, status })
    setDraggedTicketId(null)
  }

  const completeTicket = () => {
    if (!pendingComplete) {
      return
    }

    updateMutation.mutate({
      id: pendingComplete.id,
      status: 'Completed',
      masterNotes: completeComment.trim() || undefined,
    })
    setPendingComplete(null)
    setCompleteComment('')
  }

  return (
    <PageSection
      eyebrow="Ремонти"
      title="Що треба полагодити"
      description="Перетягуйте картки між колонками, щоб команда бачила актуальний стан роботи."
    >
      {tickets.length === 0 ? (
        <EmptyState
          title="Поки все спокійно"
          description="Нові прохання від мешканців з’являться тут, щойно їх створять."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {columns.map((column) => (
            <SurfaceCard
              key={column.id}
              className="bg-[var(--color-panel-soft)]"
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(column.id)}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-950">{column.label}</h2>
                <Badge tone={statusTone(column.id)}>
                  {tickets.filter((ticket) => ticket.status === column.id).length}
                </Badge>
              </div>
              <div className="grid gap-4">
                {tickets
                  .filter((ticket) => ticket.status === column.id)
                  .map((ticket) => (
                    <Link
                      key={ticket.id}
                      to={`/app/tasks/${ticket.id}`}
                      draggable
                      onDragStart={() => setDraggedTicketId(ticket.id)}
                      className="block rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.28)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                            Кімната {ticket.roomNumber}
                          </p>
                          <h3 className="mt-2 text-lg font-semibold text-slate-950">{ticket.title}</h3>
                        </div>
                        <Badge tone={priorityTone(ticket.priority)}>{priorityLabel(ticket.priority)}</Badge>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{ticket.description}</p>
                    </Link>
                  ))}
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}

      <Modal open={Boolean(pendingComplete)} onClose={() => setPendingComplete(null)} title="Що зробили?">
        <div className="grid gap-4">
          <p className="text-sm text-slate-600">
            Додайте короткий коментар, щоб мешканець побачив результат роботи.
          </p>
          <TextArea rows={6} value={completeComment} onChange={(event) => setCompleteComment(event.target.value)} placeholder="Наприклад: замінили змішувач і перевірили підтікання." />
          <div className="flex justify-end gap-3">
            <SecondaryButton onClick={() => setPendingComplete(null)}>Скасувати</SecondaryButton>
            <PrimaryButton onClick={completeTicket} disabled={updateMutation.isPending}>
              <SquareCheckBig className="mr-2 h-4 w-4" />
              Завершити
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </PageSection>
  )
}

export function MasterTaskDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [phoneVisible, setPhoneVisible] = useState(false)

  const ticketQuery = useQuery({
    queryKey: ['ticket-detail', ticketId],
    queryFn: () => getTicketDetail(ticketId!),
    enabled: Boolean(ticketId),
  })

  const form = useForm<TicketNotesFormValues>({
    resolver: zodResolver(ticketNotesSchema),
    defaultValues: { masterNotes: '' },
  })

  useEffect(() => {
    if (ticketQuery.data?.masterNotes) {
      form.setValue('masterNotes', ticketQuery.data.masterNotes)
    }
  }, [form, ticketQuery.data?.masterNotes])

  const updateMutation = useMutation({
    mutationFn: ({
      status,
      masterNotes,
    }: {
      status: BoardStatus
      masterNotes?: string
    }) => updateTicketStatus(ticketId!, { status, masterNotes }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['ticket-detail', ticketId] }),
      ])
    },
  })

  const ticket = ticketQuery.data

  return (
    <PageSection
      eyebrow="Прохання"
      title={ticket?.title ?? 'Деталі'}
      description={ticket ? `Кімната ${ticket.roomNumber}` : 'Завантажуємо деталі.'}
      actions={<SecondaryButton onClick={() => navigate('/app/tasks')}><ArrowLeft className="mr-2 h-4 w-4" />Назад</SecondaryButton>}
    >
      {ticket ? (
        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <SurfaceCard>
              <p className="text-base leading-7 text-slate-700">{ticket.description}</p>
            </SurfaceCard>

            {(ticket.attachments ?? []).length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {ticket.attachments.map((attachment) => (
                  <SurfaceCard key={attachment.id} className="overflow-hidden p-0">
                    {attachment.contentType.startsWith('image/') ? (
                      <img src={attachment.previewUrl} alt={attachment.fileName} className="h-56 w-full object-cover" />
                    ) : (
                      <div className="flex h-56 items-center justify-center bg-slate-100 text-slate-500">{attachment.fileName}</div>
                    )}
                  </SurfaceCard>
                ))}
              </div>
            ) : (
          <EmptyState title="Фото немає" description="Студент не додав фото, тож орієнтуйтеся на опис." />
            )}
          </div>

          <div className="space-y-5">
            <SurfaceCard>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                  <Wrench className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Деталі прохання</p>
                  <h2 className="text-2xl font-semibold text-slate-950">Деталі</h2>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                <DetailRow label="Пріоритет" value={<Badge tone={priorityTone(ticket.priority)}>{priorityLabel(ticket.priority)}</Badge>} />
                <DetailRow label="Створено" value={formatDate(ticket.createdAt)} />
                <DetailRow label="Мешканець" value={ticket.createdBy} />
                <DetailRow
                  label="Телефон"
                  value={
                    ticket.contactPhone ? (
                      phoneVisible ? (
                        ticket.contactPhone
                      ) : (
                        <button type="button" className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700" onClick={() => setPhoneVisible(true)}>
                          <Eye className="h-4 w-4" />
                          Показати номер
                        </button>
                      )
                    ) : (
                      '—'
                    )
                  }
                />
              </div>
            </SurfaceCard>

            <SurfaceCard>
              <form className="grid gap-4" onSubmit={form.handleSubmit((values) => updateMutation.mutate({ status: 'Completed', masterNotes: values.masterNotes }))}>
                <TextField label="Коментар">
                  <TextArea rows={6} placeholder="Що саме зробили?" {...form.register('masterNotes')} />
                </TextField>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SecondaryButton type="button" onClick={() => updateMutation.mutate({ status: 'InProgress', masterNotes: form.getValues('masterNotes') })}>
                    Взяти в роботу
                  </SecondaryButton>
                  <PrimaryButton type="submit" className="bg-emerald-600 hover:bg-emerald-500">
                    <SquareCheckBig className="mr-2 h-4 w-4" />
                    Завершити ремонт
                  </PrimaryButton>
                </div>
              </form>
            </SurfaceCard>
          </div>
        </div>
      ) : (
      <EmptyState title="Не знайшли це прохання" description="Можливо, його вже закрили або воно більше недоступне." />
      )}
    </PageSection>
  )
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col items-start justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  )
}

function statusTone(status: BoardStatus): 'slate' | 'sky' | 'emerald' | 'rose' | 'amber' {
  if (status === 'Completed') {
    return 'emerald'
  }

  if (status === 'InProgress') {
    return 'sky'
  }

  return 'amber'
}

function priorityTone(priority: string): 'slate' | 'sky' | 'emerald' | 'rose' | 'amber' {
  if (priority === 'Critical') {
    return 'rose'
  }

  if (priority === 'High') {
    return 'amber'
  }

  return 'slate'
}

function priorityLabel(priority: string) {
  switch (priority) {
    case 'Critical':
      return 'Критичний'
    case 'High':
      return 'Високий'
    case 'Medium':
      return 'Середній'
    case 'Low':
      return 'Низький'
    default:
      return priority
  }
}
