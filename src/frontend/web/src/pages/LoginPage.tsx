import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Input, PrimaryButton, TextField } from '../components/AppPrimitives'
import { getCurrentUser, login } from '../lib/api'
import logoUrl from '../assets/new_logo.png'

const loginSchema = z.object({
  email: z.string().email('Перевірте, будь ласка, email. Здається, там бракує кількох символів.'),
  password: z.string().min(8, 'Пароль має бути не коротшим за 8 символів.'),
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
      setErrorMessage('Ой, не вдалося увійти. Перевірте email і пароль — і спробуємо ще раз.')
    },
  })

  const handleSubmit = form.handleSubmit((values) => {
    setErrorMessage(null)
    loginMutation.mutate(values)
  })

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(15,107,115,0.16),transparent_34%),linear-gradient(180deg,#f5f3ee_0%,#edf2f3_100%)] px-4 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
        <section className="w-full rounded-[34px] border border-white/80 bg-white/88 p-4 shadow-[0_40px_100px_-50px_rgba(15,23,42,0.45)] backdrop-blur sm:p-6">
          <div className="rounded-[30px] border border-slate-200 bg-white/95 p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.28)] sm:p-8">
            <div className="mb-7 flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white">
                <img src={logoUrl} alt="e-Dormitory" className="h-full w-full object-contain p-1" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
                  e-Dormitory
                </p>
                <p className="text-sm text-slate-500">Кабінет гуртожитку</p>
              </div>
            </div>

            <h1 className="font-display text-4xl leading-tight text-slate-950 sm:text-5xl">
              Ласкаво просимо! 
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Твій затишний дім, керування під рукою!
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
                      placeholder="Ваш пароль"
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
                  <span>{loginMutation.isPending ? 'Заходимо…' : 'Увійти в кабінет'}</span>
                  <ArrowRight className="h-4 w-4" />
                </PrimaryButton>
              </form>
          </div>
        </section>
      </div>
    </div>
  )
}
