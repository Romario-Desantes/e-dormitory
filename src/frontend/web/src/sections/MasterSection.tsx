import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { getTickets, updateTicketStatus } from '../lib/api'
import { Card, SectionFrame, SimpleTable, SubmitButton } from './ui'
import { inputClass } from './utils'

const ticketStatusSchema = z.object({
  status: z.enum(['New', 'InProgress', 'Completed']),
  masterNotes: z.string().optional(),
})

type TicketStatusFormValues = z.infer<typeof ticketStatusSchema>

export function MasterSection({ isAdminView = false }: { isAdminView?: boolean }) {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const ticketsQuery = useQuery({ queryKey: ['tickets'], queryFn: getTickets })
  const ticketStatusForm = useForm<TicketStatusFormValues>({ resolver: zodResolver(ticketStatusSchema), defaultValues: { status: 'InProgress' } })

  const updateTicketMutation = useMutation({
    mutationFn: ({ ticketId, values }: { ticketId: string; values: TicketStatusFormValues }) => updateTicketStatus(ticketId, values),
    onSuccess: async () => {
      setNotice('Статус заявки оновлено.')
      await queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  return (
    <SectionFrame id="master-hub" title={isAdminView ? 'Ремонти' : 'Ремонтний контур'} description="Kanban-потік, фільтри й швидке закриття заявок з коментарем.">
      {notice ? <div className="mb-6 rounded-[1.5rem] border border-emerald-300 bg-emerald-50 px-5 py-4 text-emerald-900">{notice}</div> : null}
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card title="Заявки на ремонт" subtitle="Майстер бачить кімнату й контакт, але не весь профіль студента.">
          <SimpleTable headers={['Назва', 'Категорія', 'Кімната', 'Контакт', 'Статус']} rows={(ticketsQuery.data ?? []).map((ticket) => [ticket.title, ticket.category, ticket.roomNumber, ticket.contactPhone ?? '—', ticket.status])} />
        </Card>

        <Card title="Оновити статус" subtitle="Перевести в роботу або завершити із коментарем.">
          <form
            className="grid gap-4"
            onSubmit={ticketStatusForm.handleSubmit((values) => {
              const firstTicket = ticketsQuery.data?.[0]
              if (firstTicket) {
                updateTicketMutation.mutate({ ticketId: firstTicket.id, values })
              }
            })}
          >
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Для демо-оновлення використовується перша доступна заявка зі списку.</div>
            <select className={inputClass} {...ticketStatusForm.register('status')}>
              <option value="InProgress">InProgress</option>
              <option value="Completed">Completed</option>
              <option value="New">New</option>
            </select>
            <textarea className={inputClass} rows={4} placeholder="Коментар майстра" {...ticketStatusForm.register('masterNotes')} />
            <SubmitButton pending={updateTicketMutation.isPending} label="Оновити заявку" />
          </form>
        </Card>
      </div>
    </SectionFrame>
  )
}
