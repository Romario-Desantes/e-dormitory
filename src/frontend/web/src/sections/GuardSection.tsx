import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { getPassLogs, validatePass } from '../lib/api'
import { Card, SectionFrame, SimpleTable, SubmitButton } from './ui'
import { formatDate, inputClass } from './utils'

const GuardScanner = lazy(() => import('./GuardScanner').then((module) => ({ default: module.GuardScanner })))

const validatePassSchema = z.object({
  accessCode: z.string().min(4),
  remarks: z.string().optional(),
})

type ValidatePassFormValues = z.infer<typeof validatePassSchema>

export function GuardSection({ isAdminView = false }: { isAdminView?: boolean }) {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const [scannerEnabled, setScannerEnabled] = useState(false)
  const passLogsQuery = useQuery({ queryKey: ['passLogs'], queryFn: getPassLogs })
  const validateForm = useForm<ValidatePassFormValues>({ resolver: zodResolver(validatePassSchema) })

  const validatePassMutation = useMutation({
    mutationFn: (values: ValidatePassFormValues) => validatePass(values),
    onSuccess: async () => {
      validateForm.reset()
      setNotice('Перепустку валідовано.')
      await queryClient.invalidateQueries({ queryKey: ['passLogs'] })
    },
  })

  return (
    <SectionFrame id="guard-hub" title={isAdminView ? 'Охорона' : 'Пост охорони'} description="QR/ручна валідація перепусток і one-click журнал проходу.">
      {notice ? <div className="mb-6 rounded-[1.5rem] border border-emerald-300 bg-emerald-50 px-5 py-4 text-emerald-900">{notice}</div> : null}
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card title="Валідація перепустки" subtitle="Для мобільних браузерів можна ввімкнути камеру.">
          <div className="mb-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => setScannerEnabled((value) => !value)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              {scannerEnabled ? 'Сховати камеру' : 'Увімкнути камеру'}
            </button>
          </div>

          {scannerEnabled ? (
            <Suspense fallback={<div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">Підключаємо модуль камери...</div>}>
              <GuardScanner onScan={(nextCode) => validateForm.setValue('accessCode', nextCode)} />
            </Suspense>
          ) : null}

          <form className="mt-4 grid gap-4" onSubmit={validateForm.handleSubmit((values) => validatePassMutation.mutate(values))}>
            <input className={inputClass} placeholder="Введіть або вставте код доступу" {...validateForm.register('accessCode')} />
            <textarea className={inputClass} rows={3} placeholder="Нотатка для журналу" {...validateForm.register('remarks')} />
            <SubmitButton pending={validatePassMutation.isPending} label="Провести валідацію" />
          </form>
        </Card>

        <Card title="Журнал проходу" subtitle="Одна і та сама перепустка фіксує вхід, а потім вихід.">
          <SimpleTable headers={['Гість', 'Охоронець', 'Вхід', 'Вихід', 'Нотатка']} rows={(passLogsQuery.data ?? []).map((log) => [log.guestFullName, log.guardName, log.entryTime ? formatDate(log.entryTime) : '—', log.exitTime ? formatDate(log.exitTime) : '—', log.remarks ?? '—'])} />
        </Card>
      </div>
    </SectionFrame>
  )
}
