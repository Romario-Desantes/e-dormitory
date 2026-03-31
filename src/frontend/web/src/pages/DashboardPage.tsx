import { lazy, Suspense } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { logout } from '../lib/api'
import type { AuthenticatedUser } from '../lib/types'
import { Metric, StatCard } from '../sections/ui'
import { getRoleTitle, getSections, normalizeRole } from '../sections/utils'

const StudentSection = lazy(() => import('../sections/StudentSection').then((module) => ({ default: module.StudentSection })))
const CommandantSection = lazy(() => import('../sections/CommandantSection').then((module) => ({ default: module.CommandantSection })))
const MasterSection = lazy(() => import('../sections/MasterSection').then((module) => ({ default: module.MasterSection })))
const GuardSection = lazy(() => import('../sections/GuardSection').then((module) => ({ default: module.GuardSection })))
const AccountingSection = lazy(() => import('../sections/AccountingSection').then((module) => ({ default: module.AccountingSection })))
const AdminSection = lazy(() => import('../sections/AdminSection').then((module) => ({ default: module.AdminSection })))

export function DashboardPage({ currentUser }: { currentUser: AuthenticatedUser }) {
  const navigate = useNavigate()
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => navigate('/login', { replace: true }),
  })

  const normalizedRole = normalizeRole(currentUser.role)
  const isAdmin = normalizedRole === 'Admin'
  const sections = getSections(currentUser.role)

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.14),_transparent_28%),linear-gradient(180deg,#f7f3eb_0%,#efe5d0_100%)] px-4 py-4 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
          <div className="grid gap-6 border-b border-slate-200/70 bg-[linear-gradient(135deg,rgba(15,118,110,0.08),rgba(2,132,199,0.08),rgba(217,119,6,0.12))] px-6 py-8 sm:px-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-sm uppercase tracking-[0.38em] text-sky-700">e-Dormitory Cabinet</p>
              <h1 className="mt-4 font-serif text-3xl text-slate-900 sm:text-4xl">{currentUser.fullName}</h1>
              <p className="mt-2 text-lg text-slate-600">Роль: <span className="font-semibold text-slate-900">{getRoleTitle(currentUser.role)}</span></p>
              <p className="mt-4 max-w-2xl text-slate-600">
                Dashboard-секції lazy-loadяться за роллю, тому студент не тягне в стартовий bundle QR-сканер охорони чи адмінський контур.
              </p>
              {!normalizedRole ? (
                <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Отримано невідому роль. Перевірте налаштування API або сесію.
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 rounded-[1.75rem] border border-slate-200/70 bg-white/80 p-5">
              <Metric label="Email" value={currentUser.email} />
              <Metric label="Телефон" value={currentUser.phone} />
              <Metric label="Room ID" value={currentUser.roomId ?? 'Не призначено'} />
              <button type="button" onClick={() => logoutMutation.mutate()} className="mt-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                Вийти з сесії
              </button>
            </div>
          </div>

          <nav className="flex flex-wrap gap-3 px-6 py-4 sm:px-8">
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-500 hover:text-sky-700">
                {section.label}
              </a>
            ))}
          </nav>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard label="Активні модулі" value={String(sections.length)} tone="sky" />
          <StatCard label="Рольові контури" value={isAdmin ? '6' : normalizedRole ? '1' : '0'} tone="amber" />
          <StatCard label="Сесійна модель" value="Cookie-based JWT" tone="emerald" />
        </section>

        <Suspense fallback={<SectionSkeleton />}>
          {normalizedRole === 'Student' || isAdmin ? <StudentSection isAdminView={isAdmin} /> : null}
          {normalizedRole === 'Commandant' || isAdmin ? <CommandantSection isAdminView={isAdmin} /> : null}
          {normalizedRole === 'Master' || isAdmin ? <MasterSection isAdminView={isAdmin} /> : null}
          {normalizedRole === 'Guard' || isAdmin ? <GuardSection isAdminView={isAdmin} /> : null}
          {normalizedRole === 'Accountant' || isAdmin ? <AccountingSection isAdminView={isAdmin} /> : null}
          {isAdmin ? <AdminSection /> : null}
        </Suspense>
      </div>
    </div>
  )
}

function SectionSkeleton() {
  return (
    <div className="rounded-[2rem] border border-white/70 bg-white/80 p-8 text-slate-600 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.24)] backdrop-blur">
      Завантажуємо рольову секцію...
    </div>
  )
}
