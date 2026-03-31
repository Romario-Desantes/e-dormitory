import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CreditCard } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { useCurrentUser } from '../../components/AppShellContext'
import {
  Badge,
  EmptyState,
  HeroMetric,
  Input,
  MetricTile,
  Modal,
  PageSection,
  PrimaryButton,
  SecondaryButton,
  Select,
  SurfaceCard,
  TextField,
} from '../../components/AppPrimitives'
import { confirmPayment, createPayment, getCharges, getPayments } from '../../lib/api'
import { formatDate, formatMoney } from '../../lib/format'

const sandboxPaymentSchema = z.object({
  chargeId: z.string().min(1),
  cardNumber: z.string().min(19),
  expiry: z.string().min(5),
  cvv: z.string().min(3),
  cardholder: z.string().min(3),
})

type SandboxPaymentFormValues = z.infer<typeof sandboxPaymentSchema>

export function StudentFinancePage() {
  const currentUser = useCurrentUser()
  const queryClient = useQueryClient()
  const chargesQuery = useQuery({
    queryKey: ['charges', currentUser.id],
    queryFn: getCharges,
  })
  const paymentsQuery = useQuery({
    queryKey: ['payments', currentUser.id],
    queryFn: getPayments,
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [paymentComplete, setPaymentComplete] = useState(false)

  const form = useForm<SandboxPaymentFormValues>({
    resolver: zodResolver(sandboxPaymentSchema),
    defaultValues: {
      cardNumber: '4111 1111 1111 1111',
      expiry: '12/30',
      cvv: '123',
      cardholder: 'STUDENT DEMO',
      chargeId: '',
    },
  })

  const payments = paymentsQuery.data ?? []
  const outstandingCharges = useMemo(
    () =>
      (chargesQuery.data ?? []).filter(
        (charge) => !charge.isSettled && charge.amount > charge.paidAmount,
      ),
    [chargesQuery.data],
  )
  const hasOutstandingCharges = outstandingCharges.length > 0
  const totalOutstanding = outstandingCharges.reduce(
    (sum, charge) => sum + (charge.amount - charge.paidAmount),
    0,
  )

  const selectedChargeId = useWatch({ control: form.control, name: 'chargeId' }) ?? ''
  const cardNumber = useWatch({ control: form.control, name: 'cardNumber' }) ?? ''
  const cardholder = useWatch({ control: form.control, name: 'cardholder' }) ?? ''
  const expiry = useWatch({ control: form.control, name: 'expiry' }) ?? ''

  useEffect(() => {
    if (!hasOutstandingCharges) {
      form.setValue('chargeId', '', { shouldDirty: false, shouldValidate: false })
      return
    }

    if (!outstandingCharges.some((charge) => charge.id === selectedChargeId)) {
      form.setValue('chargeId', outstandingCharges[0].id, {
        shouldDirty: false,
        shouldValidate: true,
      })
    }
  }, [form, hasOutstandingCharges, outstandingCharges, selectedChargeId])

  const sandboxPaymentMutation = useMutation({
    mutationFn: async (values: SandboxPaymentFormValues) => {
      const charge = outstandingCharges.find((item) => item.id === values.chargeId)
      if (!charge) {
        throw new Error('Charge not found')
      }

      const createdPayment = await createPayment({
        chargeId: charge.id,
        amount: charge.amount - charge.paidAmount,
        paymentMethod: 'MockGateway',
      })

      return confirmPayment(createdPayment.id, {
        externalReceiptId: `SANDBOX-${createdPayment.id}`,
      })
    },
    onSuccess: async () => {
      setPaymentComplete(true)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payments', currentUser.id] }),
        queryClient.invalidateQueries({ queryKey: ['charges', currentUser.id] }),
        queryClient.invalidateQueries({ queryKey: ['notifications', currentUser.id] }),
        queryClient.invalidateQueries({ queryKey: ['session'] }),
      ])
    },
  })

  const selectedCharge =
    outstandingCharges.find((charge) => charge.id === selectedChargeId) ?? null

  const openPaymentModal = () => {
    setPaymentComplete(false)
    setModalOpen(true)
  }

  return (
    <PageSection
      eyebrow="Фінанси"
      title="Оплата проживання"
      description="Перегляньте баланс, історію оплат і проведіть тестову оплату без збереження банківських даних."
      actions={
        <PrimaryButton onClick={openPaymentModal} disabled={!hasOutstandingCharges}>
          <CreditCard className="mr-2 h-4 w-4" />
          Оплатити проживання
        </PrimaryButton>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <HeroMetric
          label="Баланс"
          value={formatMoney(currentUser.balance)}
          meta={
            hasOutstandingCharges
              ? 'Є відкриті нарахування, які ще потрібно закрити.'
              : 'Наразі всі нарахування сплачені.'
          }
          tone={hasOutstandingCharges ? 'rose' : 'emerald'}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <MetricTile
            label="До сплати"
            value={formatMoney(totalOutstanding)}
            note="Загальна сума всіх активних нарахувань."
          />
          <MetricTile
            label="Платежі"
            value={String(payments.length)}
            note="Усі операції, які вже є у вашій історії."
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
        <SurfaceCard>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Нарахування
              </p>
              <h2 className="text-2xl font-semibold text-slate-950">Що потрібно оплатити</h2>
            </div>
            <Badge tone={hasOutstandingCharges ? 'rose' : 'emerald'}>
              {hasOutstandingCharges ? 'Є борг' : 'Все сплачено'}
            </Badge>
          </div>

          {hasOutstandingCharges ? (
            <div className="grid gap-4">
              {outstandingCharges.map((charge) => (
                <article
                  key={charge.id}
                  className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-950">{charge.title}</p>
                      <p className="mt-1 text-sm text-slate-500">До {formatDate(charge.dueDate)}</p>
                    </div>
                    <p className="text-lg font-semibold text-slate-950">
                      {formatMoney(charge.amount - charge.paidAmount)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Відкритих нарахувань немає"
              description="Коли адміністратор або бухгалтер створить нове нарахування, воно з’явиться тут."
            />
          )}
        </SurfaceCard>

        <SurfaceCard>
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Історія оплат
            </p>
            <h2 className="text-2xl font-semibold text-slate-950">Останні операції</h2>
          </div>
          {payments.length > 0 ? (
            <div className="grid max-h-[520px] gap-4 overflow-y-auto pr-2">
              {payments.map((payment) => (
                <article
                  key={payment.id}
                  className="flex flex-col items-start justify-between gap-4 rounded-[24px] border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="font-semibold text-slate-950">{formatMoney(payment.amount)}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {payment.paidAt
                        ? formatDate(payment.paidAt)
                        : 'Очікує підтвердження в системі'}
                    </p>
                  </div>
                  <Badge tone={payment.status === 'Confirmed' ? 'emerald' : 'amber'}>
                    {payment.status === 'Confirmed' ? 'Оплачено' : 'В роботі'}
                  </Badge>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Платежів ще немає"
              description="Після першої оплати тут з’явиться історія всіх ваших операцій."
            />
          )}
        </SurfaceCard>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Симуляція платіжного шлюзу"
      >
        {paymentComplete ? (
          <div className="grid gap-5">
            <div className="rounded-[30px] border border-emerald-200 bg-[linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)] px-6 py-8 text-center">
              <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="mt-5 font-display text-3xl text-emerald-950">
                Оплату успішно проведено
              </h3>
              <p className="mt-3 text-sm leading-6 text-emerald-900">
                Статус платежу, баланс і журнал подій уже оновлені у вашому кабінеті.
              </p>
            </div>
            <div className="flex justify-end">
              <PrimaryButton
                onClick={() => {
                  setModalOpen(false)
                  setPaymentComplete(false)
                }}
              >
                Готово
              </PrimaryButton>
            </div>
          </div>
        ) : hasOutstandingCharges ? (
          <form
            className="grid gap-5"
            onSubmit={form.handleSubmit((values) => sandboxPaymentMutation.mutate(values))}
          >
            <div className="rounded-[30px] bg-[linear-gradient(135deg,#12343b_0%,#0f172a_100%)] p-6 text-white shadow-[0_30px_70px_-40px_rgba(15,23,42,0.6)]">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/55">
                Demo Bank
              </p>
              <p className="mt-5 text-2xl font-semibold tracking-[0.18em]">
                {cardNumber || '4111 1111 1111 1111'}
              </p>
              <div className="mt-6 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/55">Власник</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {cardholder || 'STUDENT DEMO'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/55">Термін дії</p>
                  <p className="mt-2 text-sm font-semibold text-white">{expiry || '12/30'}</p>
                </div>
              </div>
            </div>

            <TextField label="Що оплатити">
              <Select {...form.register('chargeId')}>
                <option value="">Оберіть нарахування</option>
                {outstandingCharges.map((charge) => (
                  <option key={charge.id} value={charge.id}>
                    {charge.title} · {formatMoney(charge.amount - charge.paidAmount)}
                  </option>
                ))}
              </Select>
            </TextField>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Номер картки">
                <Input placeholder="4111 1111 1111 1111" {...form.register('cardNumber')} />
              </TextField>
              <TextField label="Ім’я власника">
                <Input placeholder="STUDENT DEMO" {...form.register('cardholder')} />
              </TextField>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Термін дії">
                <Input placeholder="12/30" {...form.register('expiry')} />
              </TextField>
              <TextField label="CVV">
                <Input placeholder="123" {...form.register('cvv')} />
              </TextField>
            </div>

            {selectedCharge ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
                <p className="text-sm text-slate-500">До сплати</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {formatMoney(selectedCharge.amount - selectedCharge.paidAmount)}
                </p>
              </div>
            ) : null}

            <div className="flex justify-end gap-3">
              <SecondaryButton type="button" onClick={() => setModalOpen(false)}>
                Скасувати
              </SecondaryButton>
              <PrimaryButton
                type="submit"
                disabled={sandboxPaymentMutation.isPending || !selectedCharge}
              >
                {sandboxPaymentMutation.isPending
                  ? 'Проводимо оплату…'
                  : 'Підтвердити оплату'}
              </PrimaryButton>
            </div>
          </form>
        ) : (
          <EmptyState
            title="Поки що немає чого оплачувати"
            description="Для цього акаунта ще не створено жодного відкритого нарахування."
          />
        )}
      </Modal>
    </PageSection>
  )
}
