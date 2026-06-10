import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  ImagePlus,
  TicketPlus,
  Upload,
  X,
} from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import {
  createRelocation,
  createTicket,
  getRelocations,
  getRooms,
  getTicketCategories,
  getTickets,
  uploadFile,
} from '../../lib/api'
import { formatDate } from '../../lib/format'
import type { UploadedFile } from '../../lib/types'
import { categoryIcon, ticketDot, ticketLabel } from './studentLabels'

const ticketSchema = z.object({
  categoryId: z.string().min(1, 'Оберіть, з чим потрібна допомога.'),
  description: z.string().min(10, 'Додайте трохи деталей, щоб майстру було легше допомогти.'),
})

const relocationSchema = z.object({
  toRoomId: z.string().min(1, 'Оберіть кімнату, в яку хотіли б переїхати.'),
  reason: z.string().min(8, 'Напишіть кілька слів про причину переселення.'),
})

type TicketFormValues = z.infer<typeof ticketSchema>
type RelocationFormValues = z.infer<typeof relocationSchema>
type TicketWizardStep = 1 | 2 | 3

export function StudentTicketsPage() {
  const currentUser = useCurrentUser()
  const queryClient = useQueryClient()
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: getTicketCategories })
  const ticketsQuery = useQuery({ queryKey: ['tickets', currentUser.id], queryFn: getTickets })
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: getRooms })
  const relocationsQuery = useQuery({ queryKey: ['relocations', currentUser.id], queryFn: getRelocations })

  const [ticketModalOpen, setTicketModalOpen] = useState(false)
  const [relocationModalOpen, setRelocationModalOpen] = useState(false)
  const [step, setStep] = useState<TicketWizardStep>(1)
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null)
  const [uploadedAttachment, setUploadedAttachment] = useState<UploadedFile | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [stepTransitionLocked, setStepTransitionLocked] = useState(false)
  const stepTransitionTimerRef = useRef<number | null>(null)

  const ticketForm = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { categoryId: '', description: '' },
  })
  const relocationForm = useForm<RelocationFormValues>({
    resolver: zodResolver(relocationSchema),
    defaultValues: { toRoomId: '', reason: '' },
  })

  const categoryId = useWatch({ control: ticketForm.control, name: 'categoryId' }) ?? ''
  const description = useWatch({ control: ticketForm.control, name: 'description' }) ?? ''
  const categories = categoriesQuery.data ?? []
  const tickets = ticketsQuery.data ?? []
  const relocationRequests = relocationsQuery.data ?? []
  const canSubmitTicket = Boolean(categoryId && description.trim().length >= 10)

  const currentRoom = useMemo(
    () => (roomsQuery.data ?? []).find((room) => room.id === currentUser.roomId) ?? null,
    [currentUser.roomId, roomsQuery.data],
  )

  const availableRooms = useMemo(
    () =>
      (roomsQuery.data ?? []).filter(
        (room) =>
          room.id !== currentUser.roomId &&
          !room.isUnderRepair &&
          room.occupied < room.capacity,
      ),
    [currentUser.roomId, roomsQuery.data],
  )

  useEffect(() => {
    if (!successMessage) {
      return
    }

    const timeout = window.setTimeout(() => setSuccessMessage(null), 2800)
    return () => window.clearTimeout(timeout)
  }, [successMessage])

  useEffect(() => {
    return () => {
      if (stepTransitionTimerRef.current) {
        window.clearTimeout(stepTransitionTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview.url)
      }
    }
  }, [preview])

  const uploadAttachmentMutation = useMutation({
    mutationFn: (file: File) => uploadFile(file, 'tickets'),
    onSuccess: (uploadedFile, file) => {
      setUploadedAttachment(uploadedFile)
      setUploadError(null)
      if (preview) {
        URL.revokeObjectURL(preview.url)
      }
      setPreview({ name: file.name, url: URL.createObjectURL(file) })
    },
    onError: () => {
      setUploadedAttachment(null)
      setUploadError('Не вдалося завантажити фото. Спробуйте ще раз.')
    },
  })

  const createTicketMutation = useMutation({
    mutationFn: async (values: TicketFormValues) => {
      const category = categories.find((item) => item.id === values.categoryId)
      const plainDescription = values.description.trim().replace(/\s+/g, ' ')

      return createTicket({
        categoryId: values.categoryId,
        title: category
          ? `${category.categoryName}: ${plainDescription.slice(0, 60)}`
          : plainDescription.slice(0, 60),
        description: values.description,
        priority: 'Medium',
        attachmentIds: uploadedAttachment ? [uploadedAttachment.id] : undefined,
      })
    },
    onSuccess: async () => {
      ticketForm.reset({ categoryId: '', description: '' })
      setStep(1)
      setUploadedAttachment(null)
      setUploadError(null)
      setStepTransitionLocked(false)
      if (stepTransitionTimerRef.current) {
        window.clearTimeout(stepTransitionTimerRef.current)
        stepTransitionTimerRef.current = null
      }
      if (preview) {
        URL.revokeObjectURL(preview.url)
      }
      setPreview(null)
      setTicketModalOpen(false)
      setSuccessMessage('Готово! Ми передали ваше прохання майстру.')
      await queryClient.invalidateQueries({ queryKey: ['tickets', currentUser.id] })
      await queryClient.invalidateQueries({ queryKey: ['notifications', currentUser.id] })
    },
  })

  const relocationMutation = useMutation({
    mutationFn: (values: RelocationFormValues) => createRelocation(values),
    onSuccess: async () => {
      relocationForm.reset({ toRoomId: '', reason: '' })
      setRelocationModalOpen(false)
      setSuccessMessage('Готово! Комендант уже бачить ваше прохання про переселення.')
      await queryClient.invalidateQueries({ queryKey: ['relocations'] })
      await queryClient.invalidateQueries({ queryKey: ['notifications', currentUser.id] })
    },
  })

  const handleAttachmentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0]
    if (!nextFile) {
      return
    }

    setUploadError(null)
    setUploadedAttachment(null)
    await uploadAttachmentMutation.mutateAsync(nextFile)
    event.target.value = ''
  }

  const clearAttachment = () => {
    setUploadedAttachment(null)
    setUploadError(null)
    if (preview) {
      URL.revokeObjectURL(preview.url)
    }
    setPreview(null)
  }

  const goToNextStep = () => {
    if (step === 1) {
      setStep(2)
      return
    }

    if (step === 2) {
      setStepTransitionLocked(true)
      setStep(3)
      if (stepTransitionTimerRef.current) {
        window.clearTimeout(stepTransitionTimerRef.current)
      }

      stepTransitionTimerRef.current = window.setTimeout(() => {
        setStepTransitionLocked(false)
        stepTransitionTimerRef.current = null
      }, 300)
    }
  }

  return (
    <PageSection
      eyebrow="Мої прохання"
      title="Що потрібно вирішити?"
      description="Оберіть одну з двох дій: попросити про ремонт або подати прохання про переселення."
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
                <span className="text-sm font-medium text-slate-700">
                  {ticketLabel(ticket.status)}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Прохань про ремонт ще немає"
          description="Якщо щось зламається або заважатиме жити комфортно, натисніть «Попросити про ремонт» угорі."
        />
      )}

      <SurfaceCard>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Переселення
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Мої прохання про кімнату</h2>
            <p className="mt-2 text-sm text-slate-600">
              Тут буде видно, що відповів комендант щодо переселення.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {relocationRequests.length > 0 ? (
            relocationRequests.map((request) => (
              <article
                key={request.id}
                className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-950">
                      {request.fromRoomNumber} → {request.toRoomNumber}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{request.reason}</p>
                    {request.reviewComment ? (
                      <p className="mt-3 text-sm text-slate-500">
                        Відповідь коменданта: {request.reviewComment}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      request.status === 'Approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : request.status === 'Rejected'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {request.status === 'Approved'
                       ? 'Можна переїжджати'
                      : request.status === 'Rejected'
                        ? 'Поки не вийде'
                        : 'Чекає відповіді'}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <EmptyState
              title="Заявок на переселення ще немає"
              description="Якщо хочете змінити кімнату, натисніть «Хочу переселитися» угорі та коротко поясніть причину."
            />
          )}
        </div>
      </SurfaceCard>

      <Modal open={ticketModalOpen} onClose={() => setTicketModalOpen(false)} title="Попросити про ремонт" size="lg">
        <form
          className="grid gap-6"
          onSubmit={ticketForm.handleSubmit((values) => createTicketMutation.mutate(values))}
        >
          <div className="grid gap-3 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className={`rounded-[24px] px-4 py-4 ${
                  step === item
                    ? 'bg-slate-950 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <p className="text-xs uppercase tracking-[0.28em] opacity-70">Крок {item}</p>
                <p className="mt-2 font-semibold">
                  {item === 1 ? 'Що сталося' : item === 2 ? 'Деталі' : 'Фото'}
                </p>
              </div>
            ))}
          </div>

          {step === 1 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => {
                const Icon = categoryIcon(category.categoryName)

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => ticketForm.setValue('categoryId', category.id, { shouldValidate: true })}
                    className={`rounded-[28px] border px-5 py-6 text-left transition ${
                      categoryId === category.id
                        ? 'border-slate-950 bg-slate-950 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-current">
                      <Icon className="h-6 w-6" />
                    </span>
                    <p className="mt-4 text-lg font-semibold">{category.categoryName}</p>
                  </button>
                )
              })}
            </div>
          ) : null}

          {step === 2 ? (
            <TextArea
              rows={7}
              placeholder="Наприклад: у кімнаті не працює розетка біля столу."
              {...ticketForm.register('description')}
            />
          ) : null}

          {step === 3 ? (
            <div className="grid gap-4">
              <div className="rounded-[28px] border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <ImagePlus className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-3 font-medium text-slate-700">
                  Додайте фото проблеми, якщо хочете показати деталі майстру
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Фото необов’язкове. Якщо додасте його тут, майстер краще зрозуміє ситуацію.
                </p>
                <input
                  id="ticket-photo-input"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => void handleAttachmentChange(event)}
                />
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <label
                    htmlFor="ticket-photo-input"
                    className="inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadAttachmentMutation.isPending ? 'Завантажуємо…' : 'Обрати фото'}
                  </label>
                  {preview ? (
                    <button
                      type="button"
                      onClick={clearAttachment}
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Прибрати фото
                    </button>
                  ) : null}
                </div>
              </div>

              {uploadError ? (
                <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {uploadError}
                </div>
              ) : null}

              {preview ? (
                <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
                    <img src={preview.url} alt={preview.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
                    <p className="font-semibold text-slate-900">Фото завантажено</p>
                    <p className="mt-2 text-sm text-slate-600">{preview.name}</p>
                    <p className="mt-3 text-sm text-slate-500">
                      Фото додасться до вашого прохання після відправлення.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-3">
              <SecondaryButton type="button" onClick={() => setTicketModalOpen(false)}>
                Скасувати
              </SecondaryButton>
              {step > 1 ? (
                <SecondaryButton type="button" onClick={() => setStep((step - 1) as TicketWizardStep)}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Назад
                </SecondaryButton>
              ) : null}
            </div>
            {step < 3 ? (
              <PrimaryButton
                type="button"
                onClick={goToNextStep}
                disabled={(step === 1 && !categoryId) || (step === 2 && description.trim().length < 10)}
              >
                Далі
                <ChevronRight className="ml-2 h-4 w-4" />
              </PrimaryButton>
            ) : (
              <PrimaryButton
                type="submit"
                disabled={
                  !canSubmitTicket ||
                  createTicketMutation.isPending ||
                  uploadAttachmentMutation.isPending ||
                  stepTransitionLocked
                }
              >
                <TicketPlus className="mr-2 h-4 w-4" />
                {createTicketMutation.isPending ? 'Відправляємо…' : 'Передати майстру'}
              </PrimaryButton>
            )}
          </div>
        </form>
      </Modal>

      <Modal
        open={relocationModalOpen}
        onClose={() => setRelocationModalOpen(false)}
        title="Хочу переселитися"
      >
        <form
          className="grid gap-5"
          onSubmit={relocationForm.handleSubmit((values) => relocationMutation.mutate(values))}
        >
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-sm text-slate-500">Поточна кімната</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {currentRoom?.roomNumber ?? 'Ще не призначена'}
            </p>
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

          <TextField label="Чому хочете переїхати">
            <TextArea
              rows={5}
              placeholder="Наприклад: хочу жити ближче до групи або потрібні тихіші умови для навчання."
              {...relocationForm.register('reason')}
            />
          </TextField>

          <div className="flex justify-end gap-3">
            <SecondaryButton type="button" onClick={() => setRelocationModalOpen(false)}>
              Скасувати
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={relocationMutation.isPending}>
              {relocationMutation.isPending ? 'Надсилаємо…' : 'Передати коменданту'}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </PageSection>
  )
}
