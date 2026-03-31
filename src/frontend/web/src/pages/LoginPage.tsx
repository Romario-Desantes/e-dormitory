import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Eye, EyeOff, Mail, LockKeyhole } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Input, PrimaryButton, TextField } from '../components/AppPrimitives'
import { getCurrentUser, login } from '../lib/api'

const loginSchema = z.object({
  email: z.string().email('Введіть коректний email'),
  password: z.string().min(8, 'Пароль має містити щонайменше 8 символів'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'student@edormitory.local',
      password: 'ChangeMe123!',
    },
  })

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: async () => {
      await queryClient.fetchQuery({
        queryKey: ['session'],
        queryFn: getCurrentUser,
      })

      navigate('/app', { replace: true })
    },
    onError: () => {
      setErrorMessage('Не вдалося увійти. Перевірте email і пароль.')
    },
  })

  const handleSubmit = form.handleSubmit((values) => {
    setErrorMessage(null)
    loginMutation.mutate(values)
  })

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(15,107,115,0.18),transparent_32%),linear-gradient(180deg,#f5f3ee_0%,#edf2f3_100%)] px-4 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full gap-6 rounded-[36px] border border-white/80 bg-white/70 p-4 shadow-[0_40px_100px_-50px_rgba(15,23,42,0.45)] backdrop-blur sm:p-6 lg:grid-cols-[1.08fr_0.92fr] lg:p-8">
          <section className="hidden rounded-[30px] bg-[linear-gradient(180deg,#173945_0%,#102432_100%)] p-8 text-white lg:block">
            <p className="text-xs uppercase tracking-[0.38em] text-white/60">e-Dormitory</p>
            <h1 className="mt-6 max-w-md font-display text-5xl leading-tight">
              Ласкаво просимо до e-Dormitory
            </h1>
            <p className="mt-5 max-w-lg text-base leading-8 text-white/76">
              Керуйте заявками, перепустками та оплатами в одному зручному кабінеті.
            </p>
          </section>

          <section className="flex items-center">
            <div className="w-full rounded-[30px] border border-slate-200 bg-white/95 p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.28)] sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--color-accent)]">
                Вхід
              </p>
              <h2 className="mt-4 font-display text-4xl text-slate-950">Радий вас бачити</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Увійдіть, щоб перейти до свого кабінету.
              </p>

              <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
                <TextField label="Email">
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="email"
                      placeholder="student@university.edu.ua"
                      className="pl-11"
                      {...form.register('email')}
                    />
                  </div>
                </TextField>

                <TextField label="Пароль">
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Введіть пароль"
                      className="pl-11 pr-12"
                      {...form.register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-900"
                      aria-label={showPassword ? 'Сховати пароль' : 'Показати пароль'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </TextField>

                {form.formState.errors.email || form.formState.errors.password || errorMessage ? (
                  <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {form.formState.errors.email?.message ??
                      form.formState.errors.password?.message ??
                      errorMessage}
                  </div>
                ) : null}

                <PrimaryButton
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="w-full justify-between px-6 py-4"
                >
                  <span>{loginMutation.isPending ? 'Входимо…' : 'Увійти'}</span>
                  <ArrowRight className="h-4 w-4" />
                </PrimaryButton>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
