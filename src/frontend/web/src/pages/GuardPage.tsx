import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, CheckCircle2, LogIn, LogOut, Search, XCircle } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  Badge,
  Input,
  PageSection,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
  TextField,
} from '../components/AppPrimitives'
import { getPassLogs, getPasses, validatePass } from '../lib/api'
import { formatDate } from '../lib/format'
import type { GuestPass } from '../lib/types'

const GuardScanner = lazy(() =>
  import('../sections/GuardScanner').then((module) => ({ default: module.GuardScanner })),
)

const guardSchema = z.object({
  accessCode: z.string().min(4, 'Введіть код'),
})

type GuardFormValues = z.infer<typeof guardSchema>
type ResultState = 'idle' | 'valid' | 'invalid'

export function GuardTerminalPage() {
  const queryClient = useQueryClient()
  const passesQuery = useQuery({ queryKey: ['passes'], queryFn: getPasses })
  const passLogsQuery = useQuery({ queryKey: ['passLogs'], queryFn: getPassLogs })
  const [scannerEnabled, setScannerEnabled] = useState(true)
  const [resultState, setResultState] = useState<ResultState>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [checkedPass, setCheckedPass] = useState<GuestPass | null>(null)

  const form = useForm<GuardFormValues>({
    resolver: zodResolver(guardSchema),
    defaultValues: { accessCode: '' },
  })

  const resetTerminal = () => {
    setResultState('idle')
    setCheckedPass(null)
    setMessage(null)
    form.reset()
  }

  const validateMutation = useMutation({
    mutationFn: (accessCode: string) => validatePass({ accessCode }),
    onSuccess: async () => {
      setMessage('Готово! Гість може проходити.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['passLogs'] }),
        queryClient.invalidateQueries({ queryKey: ['passes'] }),
      ])

      window.setTimeout(() => {
        resetTerminal()
      }, 900)
    },
    onError: () => {
      setResultState('invalid')
      setCheckedPass(null)
      setMessage('Цей QR-код не спрацював. Перевірте дату перепустки або попросіть студента створити нову.')
    },
  })

  const handleCheck = form.handleSubmit((values) => {
    setMessage(null)
    const pass = findPassByCode(passesQuery.data ?? [], values.accessCode)
    setCheckedPass(pass)
    setResultState(pass ? 'valid' : 'invalid')
  })

  const nextAction = checkedPass?.status === 'Entered' ? 'exit' : 'entry'

  return (
    <PageSection
      eyebrow="Охорона"
      title="Перевірка гостя"
      description="Скануйте QR-код або введіть номер вручну — система одразу підкаже, чи можна пропускати гостя."
    >
      <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
        <SurfaceCard className="overflow-hidden bg-[linear-gradient(180deg,#0f172a_0%,#12343b_100%)] text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/55">Сканер</p>
              <h2 className="mt-2 font-display text-3xl">Перевірка перепустки</h2>
            </div>
            <SecondaryButton
              className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
              onClick={() => setScannerEnabled((value) => !value)}
            >
              <Camera className="mr-2 h-4 w-4" />
              {scannerEnabled ? 'Вимкнути камеру' : 'Увімкнути камеру'}
            </SecondaryButton>
          </div>

          <div className="mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/45 p-4">
            {scannerEnabled ? (
              <Suspense
                fallback={
                  <div className="flex h-[340px] items-center justify-center text-white/70">
                    Підключаємо камеру…
                  </div>
                }
              >
                <GuardScanner onScan={(nextCode) => form.setValue('accessCode', nextCode, { shouldValidate: true })} />
              </Suspense>
            ) : (
              <div className="flex h-[340px] items-center justify-center rounded-[24px] border border-dashed border-white/20 px-6 text-center text-white/65">
                Камера вимкнена. Нижче можна ввести код вручну.
              </div>
            )}
          </div>

          <form className="mt-6 grid gap-4" onSubmit={handleCheck}>
            <TextField label="Код перепустки">
              <Input
                className="border-white/15 bg-white/8 text-white placeholder:text-white/40 focus:border-cyan-300"
                placeholder="Введіть або відскануйте код"
                {...form.register('accessCode')}
              />
            </TextField>
            <PrimaryButton type="submit" className="py-4 text-base">
              <Search className="mr-2 h-5 w-5" />
              Перевірити
            </PrimaryButton>
          </form>
        </SurfaceCard>

        {resultState === 'valid' && checkedPass ? (
          <SurfaceCard className="bg-[linear-gradient(180deg,#dcfce7_0%,#bbf7d0_100%)]">
            <div className="rounded-[28px] bg-white/72 p-5 text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 text-3xl font-semibold text-white">
                {initials(checkedPass.guestFullName)}
              </div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
                Перепустка дійсна
              </p>
              <h2 className="mt-3 font-display text-4xl text-emerald-950">{checkedPass.guestFullName}</h2>
              <p className="mt-3 text-sm text-emerald-900">Господар: {checkedPass.hostName}</p>
              <p className="mt-2 text-sm text-emerald-900">Код: {checkedPass.accessCode}</p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <PrimaryButton
                className="bg-emerald-600 py-4 text-base hover:bg-emerald-500"
                onClick={() => validateMutation.mutate(checkedPass.accessCode)}
                disabled={nextAction !== 'entry' || validateMutation.isPending}
              >
                <LogIn className="mr-2 h-5 w-5" />
                ПРОПУСТИТИ
              </PrimaryButton>
              <PrimaryButton
                className="bg-rose-600 py-4 text-base hover:bg-rose-500"
                onClick={() => validateMutation.mutate(checkedPass.accessCode)}
                disabled={nextAction !== 'exit' || validateMutation.isPending}
              >
                <LogOut className="mr-2 h-5 w-5" />
                ВИПУСТИТИ
              </PrimaryButton>
            </div>
            {message ? (
              <p className="mt-4 text-center text-sm font-semibold text-emerald-900">{message}</p>
            ) : null}
          </SurfaceCard>
        ) : (
          <SurfaceCard className={resultState === 'invalid' ? 'bg-[linear-gradient(180deg,#fee2e2_0%,#fecaca_100%)]' : ''}>
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-center">
              {resultState === 'invalid' ? (
                <>
                  <XCircle className="h-16 w-16 text-rose-600" />
                  <h2 className="mt-5 font-display text-4xl text-rose-900">НЕ ДІЙСНО</h2>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-rose-800">{message}</p>
                  <div className="mt-6">
                    <SecondaryButton onClick={resetTerminal}>Повернутись до сканера</SecondaryButton>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-16 w-16 text-slate-300" />
                  <h2 className="mt-5 font-display text-3xl text-slate-900">Готово до перевірки</h2>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
                    Після сканування тут з’явиться результат перевірки перепустки.
                  </p>
                </>
              )}
            </div>
          </SurfaceCard>
        )}
      </div>

      <SurfaceCard>
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Останні проходи</p>
          <h2 className="text-2xl font-semibold text-slate-950">Останні проходи</h2>
        </div>
        <div className="grid gap-3">
          {(passLogsQuery.data ?? []).slice(0, 6).map((log) => (
            <div
              key={log.id}
              className="flex flex-col items-start justify-between gap-4 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center"
            >
              <div>
                <p className="font-semibold text-slate-950">{log.guestFullName}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {log.entryTime ? formatDate(log.entryTime) : '—'}
                </p>
              </div>
              <Badge tone={log.exitTime ? 'slate' : 'emerald'}>
                {log.exitTime ? 'Вийшов' : 'Усередині'}
              </Badge>
            </div>
          ))}
        </div>
      </SurfaceCard>
    </PageSection>
  )
}

function findPassByCode(passes: GuestPass[], accessCode: string) {
  const pass = passes.find((item) => item.accessCode === accessCode)
  if (!pass) {
    return null
  }

  const now = Date.now()
  return now >= new Date(pass.validFrom).getTime() && now <= new Date(pass.validTo).getTime()
    ? pass
    : null
}

function initials(fullName: string) {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
