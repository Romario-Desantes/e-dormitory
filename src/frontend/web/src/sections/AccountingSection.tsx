import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { confirmPayment, getCharges, getPayments } from '../lib/api'
import { Card, SectionFrame, SimpleTable } from './ui'
import { formatMoney } from './utils'

export function AccountingSection({ isAdminView = false }: { isAdminView?: boolean }) {
  const queryClient = useQueryClient()
  const paymentsQuery = useQuery({ queryKey: ['payments'], queryFn: getPayments })
  const chargesQuery = useQuery({ queryKey: ['charges'], queryFn: getCharges })

  const confirmPaymentMutation = useMutation({
    mutationFn: ({ paymentId, externalReceiptId }: { paymentId: string; externalReceiptId: string }) => confirmPayment(paymentId, { externalReceiptId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payments'] }),
        queryClient.invalidateQueries({ queryKey: ['charges'] }),
      ])
    },
  })

  return (
    <SectionFrame id="accounting-hub" title={isAdminView ? 'Фінанси' : 'Фінансовий контур'} description="Нарахування, ручне підтвердження платежів і контроль квитанцій.">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card title="Платежі" subtitle="Підтвердьте зарахування коштів вручну.">
          <div className="grid gap-4">
            {(paymentsQuery.data ?? []).map((payment) => (
              <div key={payment.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{payment.userName}</p>
                    <p className="text-sm text-slate-600">{formatMoney(payment.amount)} · {payment.paymentMethod}</p>
                  </div>
                  <span className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-600">{payment.status}</span>
                </div>
                <button
                  type="button"
                  disabled={payment.status === 'Confirmed' || confirmPaymentMutation.isPending}
                  onClick={() => confirmPaymentMutation.mutate({ paymentId: payment.id, externalReceiptId: `MANUAL-${payment.id.slice(0, 8)}` })}
                  className="mt-4 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Підтвердити платіж
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Нарахування" subtitle="Швидкий перегляд відкритих боргів по гуртожитку.">
          <SimpleTable headers={['Нарахування', 'Сума', 'Сплачено', 'Статус']} rows={(chargesQuery.data ?? []).map((charge) => [charge.title, formatMoney(charge.amount), formatMoney(charge.paidAmount), charge.isSettled ? 'Закрито' : 'Відкрите'])} />
        </Card>
      </div>
    </SectionFrame>
  )
}
