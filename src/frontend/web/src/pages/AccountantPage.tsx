import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Filter, Landmark, Receipt, RotateCcw } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import {
  Badge,
  DataTable,
  HeroMetric,
  Input,
  Modal,
  PageSection,
  PrimaryButton,
  SecondaryButton,
  Select,
  SurfaceCard,
  TextField,
} from '../components/AppPrimitives'
import { confirmPayment, getCharges, getPayments } from '../lib/api'
import { formatDate, formatMoney } from '../lib/format'
import type { Charge, Payment } from '../lib/types'

type StatusFilter = 'all' | 'Pending' | 'Confirmed'

export function AccountantPaymentsPage() {
  const queryClient = useQueryClient()
  const chargesQuery = useQuery({ queryKey: ['charges'], queryFn: getCharges })
  const paymentsQuery = useQuery({ queryKey: ['payments'], queryFn: getPayments })

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [receiptReference, setReceiptReference] = useState('')

  const deferredSearch = useDeferredValue(search.trim().toLowerCase())
  const charges = useMemo(() => chargesQuery.data ?? [], [chargesQuery.data])
  const payments = useMemo(() => paymentsQuery.data ?? [], [paymentsQuery.data])

  const confirmMutation = useMutation({
    mutationFn: ({ id, externalReceiptId }: { id: string; externalReceiptId?: string }) =>
      confirmPayment(id, { externalReceiptId }),
    onSuccess: async () => {
      setSelectedPayment(null)
      setReceiptReference('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payments'] }),
        queryClient.invalidateQueries({ queryKey: ['charges'] }),
        queryClient.invalidateQueries({ queryKey: ['session'] }),
      ])
    },
  })

  const totalOutstanding = useMemo(() => {
    return charges.reduce((sum, charge) => sum + (charge.amount - charge.paidAmount), 0)
  }, [charges])

  const filteredCharges = useMemo(() => {
    return charges.filter((charge) => {
      const matchesSearch =
        deferredSearch.length === 0 || charge.title.toLowerCase().includes(deferredSearch)
      const dueTime = new Date(charge.dueDate).getTime()
      const matchesDateFrom = dateFrom ? dueTime >= new Date(dateFrom).getTime() : true
      const matchesDateTo = dateTo ? dueTime <= new Date(dateTo).getTime() + 86_399_000 : true
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'Pending' ? !charge.isSettled : charge.isSettled)

      return matchesSearch && matchesDateFrom && matchesDateTo && matchesStatus
    })
  }, [charges, dateFrom, dateTo, deferredSearch, statusFilter])

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const haystack =
        `${payment.userName} ${payment.paymentMethod} ${payment.externalReceiptId ?? ''}`.toLowerCase()
      const matchesSearch = deferredSearch.length === 0 || haystack.includes(deferredSearch)
      const matchesStatus = statusFilter === 'all' || payment.status === statusFilter
      const paidTime = payment.paidAt ? new Date(payment.paidAt).getTime() : null
      const matchesDateFrom = dateFrom
        ? paidTime !== null && paidTime >= new Date(dateFrom).getTime()
        : true
      const matchesDateTo = dateTo
        ? paidTime !== null && paidTime <= new Date(dateTo).getTime() + 86_399_000
        : true

      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo
    })
  }, [payments, statusFilter, deferredSearch, dateFrom, dateTo])

  const resetFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <PageSection
      eyebrow="Бухгалтер"
      title="Платежі та ручне підтвердження"
      description="Фільтри нижче одночасно звужують список нарахувань і журнал оплат. Пошук працює за назвою нарахування, способом оплати та номером квитанції."
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <HeroMetric
          label="Відкрито до сплати"
          value={formatMoney(totalOutstanding)}
          meta="Сумарний залишок по всіх нарахуваннях, які ще не закриті платежами."
          tone={totalOutstanding > 0 ? 'rose' : 'emerald'}
        />
        <HeroMetric
          label="Оплати в роботі"
          value={String(payments.filter((payment) => payment.status === 'Pending').length)}
          meta="Платежі, які очікують ручного підтвердження або звірки з квитанцією."
          tone="amber"
        />
        <HeroMetric
          label="Записів після фільтра"
          value={`${filteredCharges.length} / ${filteredPayments.length}`}
          meta="Ліворуч показані нарахування, праворуч — журнал оплат після застосованих фільтрів."
          tone="sky"
        />
      </div>

      <SurfaceCard className="lg:sticky lg:top-24 lg:z-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <Filter className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Панель фільтрів
              </p>
              <h2 className="text-2xl font-semibold text-slate-950">Пошук і звірка</h2>
              <p className="mt-1 text-sm text-slate-600">
                Статус «Очікує» показує борги та платежі без підтвердження. «Підтверджено» — уже закриті записи.
              </p>
            </div>
          </div>

          <SecondaryButton onClick={resetFilters}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Скинути фільтри
          </SecondaryButton>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-4">
          <TextField label="Пошук">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Нарахування, квитанція або метод"
            />
          </TextField>
          <TextField label="Статус">
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="all">Усі записи</option>
              <option value="Pending">Очікує</option>
              <option value="Confirmed">Підтверджено</option>
            </Select>
          </TextField>
          <TextField label="Від дати">
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </TextField>
          <TextField label="До дати">
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </TextField>
        </div>
      </SurfaceCard>

      <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
        <SurfaceCard>
          <div className="mb-5 flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Landmark className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Нарахування
              </p>
              <h2 className="text-2xl font-semibold text-slate-950">Поточний рахунок</h2>
            </div>
          </div>

          <DataTable
            headers={['Нарахування', 'Сума', 'Сплачено', 'Строк', 'Стан']}
            rows={filteredCharges.map((charge) => [
              charge.title,
              formatMoney(charge.amount),
              formatMoney(charge.paidAmount),
              formatDate(charge.dueDate),
              <ChargeStatusBadge key={`${charge.id}-status`} charge={charge} />,
            ])}
          />
        </SurfaceCard>

        <SurfaceCard>
          <div className="mb-5 flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <Receipt className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Журнал оплат
              </p>
              <h2 className="text-2xl font-semibold text-slate-950">Квитанції та статуси</h2>
            </div>
          </div>

          <DataTable
            headers={['Студент', 'Сума', 'Метод', 'Статус', 'Квитанція', 'Дія']}
            rows={filteredPayments.map((payment) => [
              payment.userName,
              formatMoney(payment.amount),
              payment.paymentMethod === 'MockGateway' ? 'Онлайн-оплата' : 'Ручне внесення',
              <Badge key={`${payment.id}-status`} tone={payment.status === 'Confirmed' ? 'emerald' : 'amber'}>
                {payment.status === 'Confirmed' ? 'Підтверджено' : 'Очікує'}
              </Badge>,
              payment.externalReceiptId ?? '—',
              payment.status === 'Pending' ? (
                <PrimaryButton
                  key={`${payment.id}-action`}
                  className="px-4 py-2"
                  onClick={() => {
                    setReceiptReference('')
                    setSelectedPayment(payment)
                  }}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Підтвердити
                </PrimaryButton>
              ) : (
                '—'
              ),
            ])}
          />
        </SurfaceCard>
      </div>

      <Modal
        open={Boolean(selectedPayment)}
        onClose={() => {
          setSelectedPayment(null)
          setReceiptReference('')
        }}
        title="Підтвердження оплати"
      >
        {selectedPayment ? (
          <div className="grid gap-5">
            <SurfaceCard className="rounded-[28px] bg-[var(--color-panel-soft)]">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Платіж
              </p>
              <p className="mt-3 text-xl font-semibold text-slate-950">{selectedPayment.userName}</p>
              <p className="mt-2 text-sm text-slate-600">
                {formatMoney(selectedPayment.amount)} ·{' '}
                {selectedPayment.paymentMethod === 'MockGateway' ? 'Онлайн-оплата' : 'Ручне внесення'}
              </p>
            </SurfaceCard>

            <TextField label="Номер квитанції" hint="Опціонально">
              <Input
                value={receiptReference}
                onChange={(event) => setReceiptReference(event.target.value)}
                placeholder="Наприклад, BANK-4829"
              />
            </TextField>

            <div className="flex justify-end gap-3">
              <SecondaryButton
                onClick={() => {
                  setSelectedPayment(null)
                  setReceiptReference('')
                }}
              >
                Скасувати
              </SecondaryButton>
              <PrimaryButton
                onClick={() =>
                  confirmMutation.mutate({
                    id: selectedPayment.id,
                    externalReceiptId: receiptReference.trim() || undefined,
                  })
                }
                disabled={confirmMutation.isPending}
              >
                {confirmMutation.isPending ? 'Підтверджуємо…' : 'Підтвердити оплату'}
              </PrimaryButton>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageSection>
  )
}

function ChargeStatusBadge({ charge }: { charge: Charge }) {
  return (
    <Badge tone={charge.isSettled ? 'emerald' : 'amber'}>
      {charge.isSettled ? 'Сплачено' : 'Очікує'}
    </Badge>
  )
}
