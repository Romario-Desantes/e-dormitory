import { useQuery } from '@tanstack/react-query'
import { CircleAlert, CreditCard, DoorOpen, QrCode, Sparkles, Wrench } from 'lucide-react'
import { useMemo } from 'react'
import { useCurrentUser } from '../../components/AppShellContext'
import {
  Badge,
  EmptyState,
  HeroMetric,
  MetricTile,
  PageSection,
  SurfaceCard,
  Timeline,
} from '../../components/AppPrimitives'
import {
  getCharges,
  getNotifications,
  getPasses,
  getRooms,
  getTickets,
} from '../../lib/api'
import { formatDate, formatMoney } from '../../lib/format'
import { QuickActionTile } from './StudentQuickActionTile'
import { toTone, toToneLabel } from './studentLabels'

export function StudentOverviewPage() {
  const currentUser = useCurrentUser()
  const notificationsQuery = useQuery({ queryKey: ['notifications', currentUser.id], queryFn: getNotifications })
  const passesQuery = useQuery({ queryKey: ['passes', currentUser.id], queryFn: getPasses })
  const chargesQuery = useQuery({ queryKey: ['charges', currentUser.id], queryFn: getCharges })
  const ticketsQuery = useQuery({ queryKey: ['tickets', currentUser.id], queryFn: getTickets })
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: getRooms })

  const activePasses = (passesQuery.data ?? []).filter((pass) => !['Exited', 'Expired'].includes(pass.status))
  const openTickets = (ticketsQuery.data ?? []).filter((ticket) => ticket.status !== 'Completed')
  const hasDebt = (chargesQuery.data ?? []).some((charge) => !charge.isSettled)
  const currentRoom = useMemo(
    () => (roomsQuery.data ?? []).find((room) => room.id === currentUser.roomId) ?? null,
    [currentUser.roomId, roomsQuery.data],
  )

  return (
    <PageSection
      eyebrow="Ваш кабінет"
      title="Як справи в гуртожитку?"
      description="Коротко показуємо оплату, гостей, прохання та новини — без зайвої бюрократії."
    >
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <HeroMetric
            label="До сплати"
          value={formatMoney(currentUser.debtAmount ?? 0)}
          meta={
            hasDebt
              ? 'Є сума, яку варто закрити найближчим часом.'
              : 'Усе добре — зараз нічого терміново оплачувати не потрібно.'
          }
          tone={hasDebt ? 'rose' : 'emerald'}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <MetricTile
            label="Гості сьогодні"
            value={String(activePasses.length)}
            note="Перепустки, які ще можуть знадобитися на вході."
          />
          <MetricTile
            label="Прохання"
            value={String(openTickets.length)}
            note="Те, з чим вам ще допомагають."
          />
          <MetricTile
            label="Кімната"
            value={currentRoom?.roomNumber ?? 'Не вказано'}
            note={
              currentRoom
                ? `Поверх ${currentRoom.floor}, місць ${currentRoom.occupied}/${currentRoom.capacity}.`
                : 'Кімната ще не призначена.'
            }
          />
          <MetricTile
            label="Усі нарахування"
            value={formatMoney((chargesQuery.data ?? []).reduce((sum, charge) => sum + Math.max(0, charge.amount - charge.paidAmount), 0))}
            note="Усе, що ще не закрито оплатою."
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
        <SurfaceCard>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <Sparkles className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                Швидкі дії
              </p>
              <p className="text-lg font-semibold text-slate-950">Що хочете зробити зараз?</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <QuickActionTile
              title="Попросити про ремонт"
              description="Написати, що зламалося або заважає."
              icon={<Wrench className="h-5 w-5" />}
              to="/app/tickets"
            />
            <QuickActionTile
              title="Запросити гостя"
              description="Створити QR-код для входу."
              icon={<QrCode className="h-5 w-5" />}
              to="/app/passes"
            />
            <QuickActionTile
              title="Перевірити оплату"
              description="Подивитися суму й історію платежів."
              icon={<CreditCard className="h-5 w-5" />}
              to="/app/finance"
            />
            <QuickActionTile
              title="Хочу переселитися"
              description="Подати прохання про іншу кімнату."
              icon={<DoorOpen className="h-5 w-5" />}
              to="/app/tickets"
            />
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <CircleAlert className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                Останні події
              </p>
              <p className="text-lg font-semibold text-slate-950">Що змінилося</p>
            </div>
          </div>

          <div className="mt-6 max-h-[420px] overflow-y-auto pr-1 sm:pr-2 lg:max-h-[560px]">
            {(notificationsQuery.data?.items ?? []).length > 0 ? (
              <Timeline
                items={(notificationsQuery.data?.items ?? []).map((item) => ({
                  id: item.id,
                  title: item.title,
                  description: item.description,
                  meta: formatDate(item.createdAt),
                  badge: <Badge tone={toTone(item.tone)}>{toToneLabel(item.tone)}</Badge>,
                }))}
              />
            ) : (
              <EmptyState
                title="Поки тихо"
                description="Новин немає, і це добре. Якщо щось зміниться, ми покажемо це тут."
              />
            )}
          </div>
        </SurfaceCard>
      </div>
    </PageSection>
  )
}
