import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, QrCode, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { QRCodeSVG } from 'qrcode.react'
import {
  Badge,
  EmptyState,
  Input,
  PageSection,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
  TextField,
} from '../../components/AppPrimitives'
import { createPass, getPasses } from '../../lib/api'
import { formatDate } from '../../lib/format'
import type { GuestPass } from '../../lib/types'
import { useCurrentUser } from '../../components/AppShellContext'
import { passLabel } from './studentLabels'

const passSchema = z.object({
  guestFullName: z.string().min(3, 'Напишіть ім’я гостя повністю.'),
  guestDocument: z.string().min(4, 'Додайте документ, який гість покаже на вході.'),
  visitDate: z.string().min(1, 'Оберіть дату візиту.'),
})

type PassFormValues = z.infer<typeof passSchema>

export function StudentPassesPage() {
  const currentUser = useCurrentUser()
  const queryClient = useQueryClient()
  const passesQuery = useQuery({ queryKey: ['passes', currentUser.id], queryFn: getPasses })
  const [createdPass, setCreatedPass] = useState<GuestPass | null>(null)
  const [shareMessage, setShareMessage] = useState<string | null>(null)

  const form = useForm<PassFormValues>({
    resolver: zodResolver(passSchema),
    defaultValues: { visitDate: '' },
  })

  const createPassMutation = useMutation({
    mutationFn: (values: PassFormValues) => {
      const start = new Date(`${values.visitDate}T09:00:00`)
      const end = new Date(`${values.visitDate}T22:00:00`)
      return createPass({
        guestFullName: values.guestFullName,
        guestDocument: values.guestDocument,
        validFrom: start.toISOString(),
        validTo: end.toISOString(),
      })
    },
    onSuccess: async (pass) => {
      setCreatedPass(pass)
      form.reset({ visitDate: '' })
      await queryClient.invalidateQueries({ queryKey: ['passes', currentUser.id] })
      await queryClient.invalidateQueries({ queryKey: ['notifications', currentUser.id] })
    },
  })

  useEffect(() => {
    if (!shareMessage) {
      return
    }
    const timeout = window.setTimeout(() => setShareMessage(null), 2400)
    return () => window.clearTimeout(timeout)
  }, [shareMessage])

  const passes = passesQuery.data ?? []
  const allPasses = createdPass && !passes.some((item) => item.id === createdPass.id) ? [createdPass, ...passes] : passes

  const handleDownload = (pass: GuestPass) => {
    const svg = document.querySelector(`#pass-card-${pass.id} svg`)
    if (!(svg instanceof SVGElement)) {
      return
    }
    const serialized = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `guest-pass-${pass.guestFullName}.svg`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleShare = async (pass: GuestPass) => {
    const text = [`Перепустка для ${pass.guestFullName}`, `Код: ${pass.accessCode}`, `Дійсна до: ${formatDate(pass.validTo)}`].join('\n')

    if (navigator.share) {
      await navigator.share({ title: 'Гостьова перепустка', text })
      return
    }

    await navigator.clipboard.writeText(text)
    setShareMessage('Готово! Дані перепустки скопійовано.')
  }

  return (
    <PageSection
      eyebrow="Гості"
      title="Запросити гостя"
      description="Створіть QR-перепустку — гість покаже її на вході, а охорона швидко перевірить."
    >
      {shareMessage ? <div className="rounded-[24px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">{shareMessage}</div> : null}

      <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
        <SurfaceCard>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Новий гість</p>
          <h2 className="mt-3 font-display text-2xl text-slate-950 sm:text-3xl">Кого чекаємо?</h2>
          <form className="mt-6 grid gap-4" onSubmit={form.handleSubmit((values) => createPassMutation.mutate(values))}>
            <TextField label="Ім’я гостя">
              <Input placeholder="Наприклад, Марія Ковальчук" {...form.register('guestFullName')} />
            </TextField>
            <TextField label="Документ">
              <Input placeholder="Паспорт або ID-картка" {...form.register('guestDocument')} />
            </TextField>
            <TextField label="Дата візиту">
              <Input type="date" {...form.register('visitDate')} />
            </TextField>
            <PrimaryButton type="submit" disabled={createPassMutation.isPending}>
              <QrCode className="mr-2 h-4 w-4" />
              {createPassMutation.isPending ? 'Створюємо…' : 'Створити QR-перепустку'}
            </PrimaryButton>
          </form>
        </SurfaceCard>

        <div className="grid gap-4">
          {allPasses.length > 0 ? (
            allPasses.map((pass) => (
              <SurfaceCard key={pass.id} id={`pass-card-${pass.id}`} className="rounded-[30px] bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(18,52,59,0.98))] text-white">
                <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
                  <div className="rounded-[24px] bg-white p-4">
                    <div className="flex items-center justify-center rounded-[18px] bg-white p-2">
                      <QRCodeSVG value={pass.accessCode} size={160} includeMargin />
                    </div>
                  </div>
                  <div className="flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/55">Гість</p>
                          <h3 className="mt-2 text-2xl font-semibold">{pass.guestFullName}</h3>
                          <p className="mt-2 text-sm text-white/72">{pass.guestDocument}</p>
                        </div>
                        <Badge tone={pass.status === 'Expired' ? 'rose' : pass.status === 'Exited' ? 'slate' : 'emerald'}>{passLabel(pass.status)}</Badge>
                      </div>
                      <div className="mt-5 grid gap-2 text-sm text-white/78">
                        <p>Код доступу: <span className="font-mono font-semibold text-white">{pass.accessCode}</span></p>
                        <p>Дійсна з {formatDate(pass.validFrom)}</p>
                        <p>До {formatDate(pass.validTo)}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <PrimaryButton className="w-full !border !border-slate-200 !bg-white !text-slate-950 shadow-sm hover:!bg-slate-100 sm:w-auto" onClick={() => handleDownload(pass)}>
                        <Download className="mr-2 h-4 w-4" />
                        Завантажити
                      </PrimaryButton>
                      <SecondaryButton className="w-full border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white sm:w-auto" onClick={() => void handleShare(pass)}>
                        <Share2 className="mr-2 h-4 w-4" />
                        Поділитися
                      </SecondaryButton>
                    </div>
                  </div>
                </div>
              </SurfaceCard>
            ))
          ) : (
            <EmptyState title="Гостей поки немає" description="Коли запросите когось, QR-перепустка одразу з’явиться тут." />
          )}
        </div>
      </div>
    </PageSection>
  )
}
