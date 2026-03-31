import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { createPass, createPayment, createRelocation, createTicket, getCharges, getPasses, getPayments, getRelocations, getRooms, getTicketCategories, getTickets, uploadFile } from '../lib/api'
import { Card, SectionFrame, SimpleTable, SubmitButton } from './ui'
import { formatDate, formatMoney, inputClass, toInputDateTime } from './utils'

const StudentPassCards = lazy(() => import('./StudentPassCards').then((module) => ({ default: module.StudentPassCards })))

const ticketSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().min(3).max(160),
  description: z.string().min(10).max(2000),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  attachment: z.any().optional(),
})

const passSchema = z.object({
  guestFullName: z.string().min(3).max(120),
  guestDocument: z.string().min(4).max(64),
  validFrom: z.string().min(1),
  validTo: z.string().min(1),
})

const relocationSchema = z.object({
  toRoomId: z.string().min(1),
  reason: z.string().min(8).max(500),
})

const paymentSchema = z.object({
  chargeId: z.string().optional(),
  amount: z.coerce.number().positive(),
  paymentMethod: z.enum(['Manual', 'MockGateway']),
  receipt: z.any().optional(),
})

type TicketFormValues = z.infer<typeof ticketSchema>
type PassFormValues = z.infer<typeof passSchema>
type RelocationFormValues = z.infer<typeof relocationSchema>
type PaymentFormInput = z.input<typeof paymentSchema>
type PaymentFormValues = z.output<typeof paymentSchema>

export function StudentSection({ isAdminView = false }: { isAdminView?: boolean }) {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const [defaultPassDates] = useState(() => ({
    validFrom: toInputDateTime(new Date()),
    validTo: toInputDateTime(new Date(Date.now() + 3 * 60 * 60 * 1000)),
  }))
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: getRooms })
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: getTicketCategories })
  const ticketsQuery = useQuery({ queryKey: ['tickets'], queryFn: getTickets })
  const passesQuery = useQuery({ queryKey: ['passes'], queryFn: getPasses })
  const chargesQuery = useQuery({ queryKey: ['charges'], queryFn: getCharges })
  const paymentsQuery = useQuery({ queryKey: ['payments'], queryFn: getPayments })
  const relocationsQuery = useQuery({ queryKey: ['relocations'], queryFn: getRelocations })

  const ticketForm = useForm<TicketFormValues>({ resolver: zodResolver(ticketSchema), defaultValues: { priority: 'Medium' } })
  const passForm = useForm<PassFormValues>({
    resolver: zodResolver(passSchema),
    defaultValues: defaultPassDates,
  })
  const relocationForm = useForm<RelocationFormValues>({ resolver: zodResolver(relocationSchema) })
  const paymentForm = useForm<PaymentFormInput, unknown, PaymentFormValues>({ resolver: zodResolver(paymentSchema), defaultValues: { paymentMethod: 'Manual' } })

  const createTicketMutation = useMutation({
    mutationFn: async (values: TicketFormValues) => {
      const file = values.attachment?.[0] as File | undefined
      let attachmentIds: string[] | undefined
      if (file) {
        const uploaded = await uploadFile(file, 'tickets')
        attachmentIds = [uploaded.id]
      }

      return createTicket({ categoryId: values.categoryId, title: values.title, description: values.description, priority: values.priority, attachmentIds })
    },
    onSuccess: async () => {
      ticketForm.reset({ priority: 'Medium' })
      setNotice('Заявку на ремонт створено.')
      await queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  const createPassMutation = useMutation({
    mutationFn: (values: PassFormValues) => createPass({
      guestFullName: values.guestFullName,
      guestDocument: values.guestDocument,
      validFrom: new Date(values.validFrom).toISOString(),
      validTo: new Date(values.validTo).toISOString(),
    }),
    onSuccess: async () => {
      passForm.reset(defaultPassDates)
      setNotice('Перепустку створено.')
      await queryClient.invalidateQueries({ queryKey: ['passes'] })
    },
  })

  const createRelocationMutation = useMutation({
    mutationFn: (values: RelocationFormValues) => createRelocation(values),
    onSuccess: async () => {
      relocationForm.reset()
      setNotice('Запит на переселення подано.')
      await queryClient.invalidateQueries({ queryKey: ['relocations'] })
    },
  })

  const createPaymentMutation = useMutation({
    mutationFn: async (values: PaymentFormValues) => {
      const receipt = values.receipt?.[0] as File | undefined
      let receiptFileId: string | undefined
      if (receipt) {
        const uploaded = await uploadFile(receipt, 'payments')
        receiptFileId = uploaded.id
      }

      return createPayment({ chargeId: values.chargeId || undefined, amount: values.amount, paymentMethod: values.paymentMethod, receiptFileId })
    },
    onSuccess: async () => {
      paymentForm.reset({ paymentMethod: 'Manual' })
      setNotice('Платіж створено.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payments'] }),
        queryClient.invalidateQueries({ queryKey: ['charges'] }),
      ])
    },
  })

  return (
    <SectionFrame id="student-hub" title={isAdminView ? 'Мешканці' : 'Кабінет мешканця'} description="Побутові сценарії студента: ремонти, гості, нарахування та переселення.">
      {notice ? <div className="mb-6 rounded-[1.5rem] border border-emerald-300 bg-emerald-50 px-5 py-4 text-emerald-900">{notice}</div> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Створити заявку на ремонт" subtitle="Не більше 4 кліків до збереження заявки.">
          <form className="grid gap-4" onSubmit={ticketForm.handleSubmit((values) => createTicketMutation.mutate(values))}>
            <select className={inputClass} {...ticketForm.register('categoryId')}>
              <option value="">Оберіть категорію</option>
              {categoriesQuery.data?.map((category) => (
                <option key={category.id} value={category.id}>{category.categoryName} · SLA {category.slaHours} год</option>
              ))}
            </select>
            <input className={inputClass} placeholder="Короткий заголовок проблеми" {...ticketForm.register('title')} />
            <textarea className={inputClass} rows={4} placeholder="Що саме сталося і де?" {...ticketForm.register('description')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <select className={inputClass} {...ticketForm.register('priority')}>
                {['Low', 'Medium', 'High', 'Critical'].map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
              <input className={inputClass} type="file" accept="image/*" {...ticketForm.register('attachment')} />
            </div>
            <SubmitButton pending={createTicketMutation.isPending} label="Надіслати заявку" />
          </form>
        </Card>

        <Card title="Оформити гостьову перепустку" subtitle="QR-код генерується одразу після створення.">
          <form className="grid gap-4" onSubmit={passForm.handleSubmit((values) => createPassMutation.mutate(values))}>
            <input className={inputClass} placeholder="ПІБ гостя" {...passForm.register('guestFullName')} />
            <input className={inputClass} placeholder="Документ / серія / номер" {...passForm.register('guestDocument')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <input className={inputClass} type="datetime-local" {...passForm.register('validFrom')} />
              <input className={inputClass} type="datetime-local" {...passForm.register('validTo')} />
            </div>
            <SubmitButton pending={createPassMutation.isPending} label="Створити перепустку" />
          </form>
        </Card>

        <Card title="Подати запит на переселення" subtitle="Доступні кімнати беремо з реєстру житлового фонду.">
          <form className="grid gap-4" onSubmit={relocationForm.handleSubmit((values) => createRelocationMutation.mutate(values))}>
            <select className={inputClass} {...relocationForm.register('toRoomId')}>
              <option value="">Оберіть цільову кімнату</option>
              {roomsQuery.data?.map((room) => (
                <option key={room.id} value={room.id}>{room.roomNumber} · поверх {room.floor} · {room.occupied}/{room.capacity}</option>
              ))}
            </select>
            <textarea className={inputClass} rows={3} placeholder="Поясніть причину переселення" {...relocationForm.register('reason')} />
            <SubmitButton pending={createRelocationMutation.isPending} label="Надіслати запит" />
          </form>
        </Card>

        <Card title="Створити платіж" subtitle="Підтримано ручне підтвердження та mock provider abstraction.">
          <form className="grid gap-4" onSubmit={paymentForm.handleSubmit((values) => createPaymentMutation.mutate(values))}>
            <select className={inputClass} {...paymentForm.register('chargeId')}>
              <option value="">Без прив'язки до нарахування</option>
              {chargesQuery.data?.map((charge) => (
                <option key={charge.id} value={charge.id}>{charge.title} · {formatMoney(charge.amount)}</option>
              ))}
            </select>
            <div className="grid gap-4 sm:grid-cols-2">
              <input className={inputClass} type="number" step="0.01" placeholder="Сума" {...paymentForm.register('amount')} />
              <select className={inputClass} {...paymentForm.register('paymentMethod')}>
                <option value="Manual">Manual</option>
                <option value="MockGateway">MockGateway</option>
              </select>
            </div>
            <input className={inputClass} type="file" accept="image/*,application/pdf" {...paymentForm.register('receipt')} />
            <SubmitButton pending={createPaymentMutation.isPending} label="Створити платіж" />
          </form>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Мої заявки" subtitle="Видно лише заявки, створені поточним користувачем.">
          <SimpleTable headers={['Назва', 'Категорія', 'Кімната', 'Статус', 'Створено']} rows={(ticketsQuery.data ?? []).map((ticket) => [ticket.title, ticket.category, ticket.roomNumber, ticket.status, formatDate(ticket.createdAt)])} />
        </Card>

        <Card title="Мої перепустки" subtitle="QR-код можна показати охороні прямо з телефону.">
          <Suspense fallback={<div className="text-sm text-slate-500">Завантажуємо QR-картки...</div>}>
            <StudentPassCards passes={passesQuery.data ?? []} />
          </Suspense>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Нарахування" subtitle="Баланс і прив'язані платежі.">
          <SimpleTable headers={['Нарахування', 'Сума', 'Сплачено', 'Строк', 'Статус']} rows={(chargesQuery.data ?? []).map((charge) => [charge.title, formatMoney(charge.amount), formatMoney(charge.paidAmount), formatDate(charge.dueDate), charge.isSettled ? 'Сплачено' : 'Очікує'])} />
        </Card>

        <Card title="Історія платежів" subtitle="Manual confirm та mock gateway відображаються в єдиному списку.">
          <SimpleTable headers={['Сума', 'Метод', 'Статус', 'Квитанція', 'Дата']} rows={(paymentsQuery.data ?? []).map((payment) => [formatMoney(payment.amount), payment.paymentMethod, payment.status, payment.externalReceiptId ?? '—', payment.paidAt ? formatDate(payment.paidAt) : 'Очікує'])} />
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Запити на переселення" subtitle="Історія власних або доступних запитів.">
          <SimpleTable headers={['Студент', 'Звідки', 'Куди', 'Статус', 'Коментар']} rows={(relocationsQuery.data ?? []).map((item) => [item.studentName, item.fromRoomNumber, item.toRoomNumber, item.status, item.reviewComment ?? '—'])} />
        </Card>
      </div>
    </SectionFrame>
  )
}
