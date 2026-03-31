import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { createViolation, getOccupancy, getRelocations, getRooms, getUsers, getViolations, reviewRelocation } from '../lib/api'
import { Card, SectionFrame, SimpleTable, SubmitButton } from './ui'
import { formatDate, formatMoney, inputClass } from './utils'

const violationSchema = z.object({
  userId: z.string().min(1),
  roomId: z.string().optional(),
  severity: z.enum(['Low', 'Medium', 'High']),
  description: z.string().min(8).max(500),
  occurredAt: z.string().min(1),
})

type ViolationFormValues = z.infer<typeof violationSchema>

export function CommandantSection({ isAdminView = false }: { isAdminView?: boolean }) {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const occupancyQuery = useQuery({ queryKey: ['occupancy'], queryFn: getOccupancy })
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: getRooms })
  const relocationsQuery = useQuery({ queryKey: ['relocations'], queryFn: getRelocations })
  const violationsQuery = useQuery({ queryKey: ['violations'], queryFn: getViolations })

  const violationForm = useForm<ViolationFormValues>({
    resolver: zodResolver(violationSchema),
    defaultValues: { severity: 'Medium', occurredAt: new Date().toISOString().slice(0, 16) },
  })

  const createViolationMutation = useMutation({
    mutationFn: (values: ViolationFormValues) => createViolation({ userId: values.userId, roomId: values.roomId || null, severity: values.severity, description: values.description, occurredAt: new Date(values.occurredAt).toISOString() }),
    onSuccess: async () => {
      setNotice('Порушення зафіксовано.')
      await queryClient.invalidateQueries({ queryKey: ['violations'] })
    },
  })

  const reviewRelocationMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'Approve' | 'Reject' }) => reviewRelocation(id, { decision }),
    onSuccess: async () => {
      setNotice('Запит на переселення оброблено.')
      await queryClient.invalidateQueries({ queryKey: ['relocations'] })
    },
  })

  return (
    <SectionFrame id="commandant-hub" title={isAdminView ? 'Комендант' : 'Комендантський контур'} description="Шахматка, порушення та запити на переселення.">
      {notice ? <div className="mb-6 rounded-[1.5rem] border border-emerald-300 bg-emerald-50 px-5 py-4 text-emerald-900">{notice}</div> : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Шахматка" subtitle="Поверхи згруповані для швидкого огляду вільних місць.">
          <div className="grid gap-4">
            {(occupancyQuery.data ?? []).map((floorBlock) => (
              <div key={floorBlock.floor} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Поверх {floorBlock.floor}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {floorBlock.rooms.map((room) => (
                    <div key={room.id} className={`rounded-2xl border px-4 py-3 ${room.occupied < room.capacity ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                      <p className="font-semibold text-slate-900">Кімната {room.roomNumber}</p>
                      <p className="text-sm text-slate-600">{room.occupied}/{room.capacity} місць · {formatMoney(room.monthlyRate)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Фіксація порушення" subtitle="Запис порушення з описом і рівнем серйозності.">
          <form className="grid gap-4" onSubmit={violationForm.handleSubmit((values) => createViolationMutation.mutate(values))}>
            <select className={inputClass} {...violationForm.register('userId')}>
              <option value="">Оберіть студента</option>
              {(usersQuery.data ?? []).filter((user) => user.role === 'Student').map((user) => (
                <option key={user.id} value={user.id}>{user.fullName}</option>
              ))}
            </select>
            <select className={inputClass} {...violationForm.register('roomId')}>
              <option value="">Без прив'язки до кімнати</option>
              {(roomsQuery.data ?? []).map((room) => (
                <option key={room.id} value={room.id}>{room.roomNumber}</option>
              ))}
            </select>
            <div className="grid gap-4 sm:grid-cols-2">
              <select className={inputClass} {...violationForm.register('severity')}>
                {['Low', 'Medium', 'High'].map((severity) => (
                  <option key={severity} value={severity}>{severity}</option>
                ))}
              </select>
              <input className={inputClass} type="datetime-local" {...violationForm.register('occurredAt')} />
            </div>
            <textarea className={inputClass} rows={4} placeholder="Опис порушення правил проживання" {...violationForm.register('description')} />
            <SubmitButton pending={createViolationMutation.isPending} label="Зафіксувати порушення" />
          </form>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Запити на переселення" subtitle="Підтвердіть або відхиліть заявку з одного місця.">
          <div className="grid gap-4">
            {(relocationsQuery.data ?? []).map((item) => (
              <div key={item.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">{item.studentName}</p>
                <p className="mt-1 text-sm text-slate-600">{item.fromRoomNumber} → {item.toRoomNumber}</p>
                <p className="mt-2 text-sm text-slate-700">{item.reason}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button type="button" onClick={() => reviewRelocationMutation.mutate({ id: item.id, decision: 'Approve' })} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Підтвердити</button>
                  <button type="button" onClick={() => reviewRelocationMutation.mutate({ id: item.id, decision: 'Reject' })} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white">Відхилити</button>
                  <span className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-600">{item.status}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Журнал порушень" subtitle="Окремий облік дисциплінарних записів.">
          <SimpleTable headers={['Студент', 'Кімната', 'Рівень', 'Опис', 'Дата']} rows={(violationsQuery.data ?? []).map((violation) => [violation.studentName, violation.roomNumber ?? '—', violation.severity, violation.description, formatDate(violation.occurredAt)])} />
        </Card>
      </div>
    </SectionFrame>
  )
}
