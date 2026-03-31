import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, CreditCard, DoorOpen, QrCode, Sparkles, Wrench } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useCurrentUser } from '../../components/AppShellContext'
import {
  Badge,
  EmptyState,
  HeroMetric,
  MetricTile,
  Modal,
  PageSection,
  PrimaryButton,
  SecondaryButton,
  Select,
  SurfaceCard,
  TextArea,
  Timeline,
} from '../../components/AppPrimitives'
import {
  createRelocation,
  getCharges,
  getNotifications,
  getPasses,
  getRelocations,
  getRooms,
  getTickets,
} from '../../lib/api'
import { formatDate, formatMoney } from '../../lib/format'
import { QuickActionTile } from './StudentQuickActionTile'
import { toTone, toToneLabel } from './studentLabels'

export function StudentOverviewPage() {
  const currentUser = useCurrentUser()
  const queryClient = useQueryClient()
  const notificationsQuery = useQuery({ queryKey: ['notifications', currentUser.id], queryFn: getNotifications })
  const passesQuery = useQuery({ queryKey: ['passes', currentUser.id], queryFn: getPasses })
  const chargesQuery = useQuery({ queryKey: ['charges', currentUser.id], queryFn: getCharges })
  const ticketsQuery = useQuery({ queryKey: ['tickets', currentUser.id], queryFn: getTickets })
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: getRooms })
  const relocationsQuery = useQuery({ queryKey: ['relocations', currentUser.id], queryFn: getRelocations })

  const [relocationOpen, setRelocationOpen] = useState(false)
  const [targetRoomId, setTargetRoomId] = useState('')
  const [relocationReason, setRelocationReason] = useState('')
  const [relocationMessage, setRelocationMessage] = useState<string | null>(null)

  const activePasses = (passesQuery.data ?? []).filter((pass) => !['Exited', 'Expired'].includes(pass.status))
  const openTickets = (ticketsQuery.data ?? []).filter((ticket) => ticket.status !== 'Completed')
  const hasDebt = (chargesQuery.data ?? []).some((charge) => !charge.isSettled)
  const rooms = useMemo(() => roomsQuery.data ?? [], [roomsQuery.data])
  const relocationRequests = useMemo(() => relocationsQuery.data ?? [], [relocationsQuery.data])

  const currentRoom = useMemo(
    () => rooms.find((room) => room.id === currentUser.roomId) ?? null,
    [currentUser.roomId, rooms],
  )

  const availableRooms = useMemo(() => {
    return rooms.filter(
      (room) =>
        room.id !== currentUser.roomId &&
        !room.isUnderRepair &&
        room.occupied < room.capacity,
    )
  }, [currentUser.roomId, rooms])

  const relocationMutation = useMutation({
    mutationFn: () =>
      createRelocation({
        toRoomId: targetRoomId,
        reason: relocationReason.trim(),
      }),
    onSuccess: async () => {
      setRelocationMessage('Заяву на переселення надіслано коменданту.')
      setRelocationOpen(false)
      setTargetRoomId('')
      setRelocationReason('')
      await queryClient.invalidateQueries({ queryKey: ['relocations'] })
    },
  })

  useEffect(() => {
    if (!relocationMessage) {
      return
    }

    const timeout = window.setTimeout(() => setRelocationMessage(null), 3000)
    return () => window.clearTimeout(timeout)
  }, [relocationMessage])

  const canSubmitRelocation =
    targetRoomId.length > 0 && relocationReason.trim().length >= 8 && !relocationMutation.isPending

  return (
    <PageSection
      eyebrow="Ваш кабінет"
      title="Головне на сьогодні"
      description="Усе важливе в одному місці: баланс, заявки, гості, переселення та останні події."
    >
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <HeroMetric
          label="Баланс"
          value={formatMoney(currentUser.balance)}
          meta={
            hasDebt
              ? 'Є нарахування, які ще потрібно оплатити.'
              : 'Усе в порядку, прострочених оплат немає.'
          }
          tone={hasDebt ? 'rose' : 'emerald'}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <MetricTile
            label="Активні перепустки"
            value={String(activePasses.length)}
            note="Гості, яких ви вже запросили."
          />
          <MetricTile
            label="Заявки"
            value={String(openTickets.length)}
            note="Проблеми, які ще залишаються в роботі."
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
            label="Переселення"
            value={String(relocationRequests.length)}
            note="Ваші заявки на зміну кімнати та їхній поточний стан."
          />
        </div>
      </div>

      {relocationMessage ? (
        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800 shadow-sm">
          {relocationMessage}
        </div>
      ) : null}

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
              title="Нова заявка"
              description="Швидко повідомити про проблему в кімнаті."
              icon={<Wrench className="h-5 w-5" />}
              to="/app/tickets"
            />
            <QuickActionTile
              title="Запросити гостя"
              description="Створити перепустку з QR-кодом."
              icon={<QrCode className="h-5 w-5" />}
              to="/app/passes"
            />
            <QuickActionTile
              title="Оплатити"
              description="Відкрити сторінку з нарахуваннями та оплатою."
              icon={<CreditCard className="h-5 w-5" />}
              to="/app/finance"
            />
            <button
              type="button"
              onClick={() => setRelocationOpen(true)}
              className="rounded-[26px] border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-slate-300 hover:bg-white"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-900 shadow-sm">
                <DoorOpen className="h-5 w-5" />
              </span>
              <p className="mt-4 font-semibold text-slate-900">Подати заявку на переселення</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Обрати іншу кімнату та залишити причину для коменданта.
              </p>
            </button>
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
            {(notificationsQuery.data ?? []).length > 0 ? (
              <Timeline
                items={(notificationsQuery.data ?? []).map((item) => ({
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
                description="Коли з’являться оновлення по заявках, оплатах або гостях, вони будуть тут."
              />
            )}
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Переселення
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Мої заявки</h2>
            <p className="mt-2 text-sm text-slate-600">
              Тут видно, куди ви хочете переселитися і що вже вирішив комендант.
            </p>
          </div>
          <PrimaryButton onClick={() => setRelocationOpen(true)}>
            <DoorOpen className="mr-2 h-4 w-4" />
            Нова заявка
          </PrimaryButton>
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
                        Коментар коменданта: {request.reviewComment}
                      </p>
                    ) : null}
                  </div>
                  <Badge
                    tone={
                      request.status === 'Approved'
                        ? 'emerald'
                        : request.status === 'Rejected'
                          ? 'rose'
                          : 'amber'
                    }
                  >
                    {request.status === 'Approved'
                      ? 'Схвалено'
                      : request.status === 'Rejected'
                        ? 'Відхилено'
                        : 'На розгляді'}
                  </Badge>
                </div>
              </article>
            ))
          ) : (
            <EmptyState
              title="Заявок на переселення ще немає"
              description="Якщо хочете змінити кімнату, подайте коротку заявку для коменданта."
              action={
                <PrimaryButton onClick={() => setRelocationOpen(true)}>
                  <DoorOpen className="mr-2 h-4 w-4" />
                  Подати заявку
                </PrimaryButton>
              }
            />
          )}
        </div>
      </SurfaceCard>

      <Modal
        open={relocationOpen}
        onClose={() => setRelocationOpen(false)}
        title="Заява на переселення"
      >
        <div className="grid gap-5">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-sm text-slate-500">Поточна кімната</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {currentRoom?.roomNumber ?? 'Ще не призначена'}
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Куди переселитися</p>
            <Select value={targetRoomId} onChange={(event) => setTargetRoomId(event.target.value)}>
              <option value="">Оберіть кімнату</option>
              {availableRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  Кімната {room.roomNumber} · поверх {room.floor} · вільно {room.capacity - room.occupied} місць
                </option>
              ))}
            </Select>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Причина</p>
            <TextArea
              rows={5}
              value={relocationReason}
              onChange={(event) => setRelocationReason(event.target.value)}
              placeholder="Коротко поясніть, чому хочете змінити кімнату."
            />
          </div>

          <div className="flex justify-end gap-3">
            <SecondaryButton onClick={() => setRelocationOpen(false)}>Скасувати</SecondaryButton>
            <PrimaryButton
              onClick={() => relocationMutation.mutate()}
              disabled={!canSubmitRelocation}
            >
              {relocationMutation.isPending ? 'Надсилаємо…' : 'Надіслати заявку'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </PageSection>
  )
}
