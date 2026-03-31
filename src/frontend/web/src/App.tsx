import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { getCurrentUser, logout } from './lib/api'
import { getDefaultRoute } from './lib/roles'
import type { UserRole } from './lib/types'
import { LoginPage } from './pages/LoginPage'

const StudentOverviewPage = lazy(() =>
  import('./pages/StudentPages').then((module) => ({ default: module.StudentOverviewPage })),
)
const StudentTicketsPage = lazy(() =>
  import('./pages/StudentPages').then((module) => ({ default: module.StudentTicketsPage })),
)
const StudentPassesPage = lazy(() =>
  import('./pages/StudentPages').then((module) => ({ default: module.StudentPassesPage })),
)
const StudentFinancePage = lazy(() =>
  import('./pages/StudentPages').then((module) => ({ default: module.StudentFinancePage })),
)
const CommandantOccupancyPage = lazy(() =>
  import('./pages/CommandantPages').then((module) => ({
    default: module.CommandantOccupancyPage,
  })),
)
const CommandantRelocationsPage = lazy(() =>
  import('./pages/CommandantPages').then((module) => ({
    default: module.CommandantRelocationsPage,
  })),
)
const CommandantDisciplinePage = lazy(() =>
  import('./pages/CommandantPages').then((module) => ({
    default: module.CommandantDisciplinePage,
  })),
)
const MasterTasksPage = lazy(() =>
  import('./pages/MasterPages').then((module) => ({ default: module.MasterTasksPage })),
)
const MasterTaskDetailPage = lazy(() =>
  import('./pages/MasterPages').then((module) => ({ default: module.MasterTaskDetailPage })),
)
const GuardTerminalPage = lazy(() =>
  import('./pages/GuardPage').then((module) => ({ default: module.GuardTerminalPage })),
)
const AccountantPaymentsPage = lazy(() =>
  import('./pages/AccountantPage').then((module) => ({ default: module.AccountantPaymentsPage })),
)
const AdminUsersPage = lazy(() =>
  import('./pages/AdminPages').then((module) => ({ default: module.AdminUsersPage })),
)
const AdminDirectoriesPage = lazy(() =>
  import('./pages/AdminPages').then((module) => ({ default: module.AdminDirectoriesPage })),
)

export default function App() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const skippedSessionProbe =
    location.pathname === '/login' &&
    new URLSearchParams(location.search).get('logged_out') === '1'

  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: getCurrentUser,
    enabled: !skippedSessionProbe,
    retry: false,
  })

  if (sessionQuery.isLoading) {
    return <LoadingScreen />
  }

  const session = sessionQuery.data ?? null

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      // If the server session is already gone, we still need to clear the client state.
    }
    queryClient.clear()
    queryClient.setQueryData(['session'], null)
    window.location.replace('/login?logged_out=1')
  }

  return (
    <Suspense fallback={<LoadingScreen compact />}>
      <Routes>
        <Route
          path="/login"
          element={session ? <Navigate to={getDefaultRoute(session.role)} replace /> : <LoginPage />}
        />
        <Route
          path="/app"
          element={
            session ? (
              <AppShell currentUser={session} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          {session ? renderRoleRoutes(session) : null}
        </Route>
        <Route
          path="/"
          element={<Navigate to={session ? getDefaultRoute(session.role) : '/login'} replace />}
        />
        <Route
          path="*"
          element={<Navigate to={session ? getDefaultRoute(session.role) : '/login'} replace />}
        />
      </Routes>
    </Suspense>
  )
}

function renderRoleRoutes(session: { id: string; role: UserRole }) {
  const defaultRoute = getDefaultRoute(session.role)
  const routeKey = session.id

  switch (session.role) {
    case 'Student':
      return (
        <>
          <Route index element={<Navigate to={defaultRoute} replace />} />
          <Route path="overview" element={<StudentOverviewPage key={`student-overview-${routeKey}`} />} />
          <Route path="tickets" element={<StudentTicketsPage key={`student-tickets-${routeKey}`} />} />
          <Route path="passes" element={<StudentPassesPage key={`student-passes-${routeKey}`} />} />
          <Route path="finance" element={<StudentFinancePage key={`student-finance-${routeKey}`} />} />
          <Route path="*" element={<Navigate to={defaultRoute} replace />} />
        </>
      )
    case 'Commandant':
      return (
        <>
          <Route index element={<Navigate to={defaultRoute} replace />} />
          <Route path="occupancy" element={<CommandantOccupancyPage />} />
          <Route path="relocations" element={<CommandantRelocationsPage />} />
          <Route path="discipline" element={<CommandantDisciplinePage />} />
          <Route path="*" element={<Navigate to={defaultRoute} replace />} />
        </>
      )
    case 'Master':
      return (
        <>
          <Route index element={<Navigate to={defaultRoute} replace />} />
          <Route path="tasks" element={<MasterTasksPage />} />
          <Route path="tasks/:ticketId" element={<MasterTaskDetailPage />} />
          <Route path="*" element={<Navigate to={defaultRoute} replace />} />
        </>
      )
    case 'Guard':
      return (
        <>
          <Route index element={<Navigate to={defaultRoute} replace />} />
          <Route path="guard" element={<GuardTerminalPage />} />
          <Route path="*" element={<Navigate to={defaultRoute} replace />} />
        </>
      )
    case 'Accountant':
      return (
        <>
          <Route index element={<Navigate to={defaultRoute} replace />} />
          <Route path="payments" element={<AccountantPaymentsPage />} />
          <Route path="*" element={<Navigate to={defaultRoute} replace />} />
        </>
      )
    case 'Admin':
      return (
        <>
          <Route index element={<Navigate to={defaultRoute} replace />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="directories" element={<AdminDirectoriesPage />} />
          <Route path="*" element={<Navigate to={defaultRoute} replace />} />
        </>
      )
    default:
      return <Route path="*" element={<Navigate to="/login" replace />} />
  }
}

function LoadingScreen({ compact = false }: { compact?: boolean }) {
  return (
    <div className="min-h-screen bg-[var(--color-page)] px-4 py-8 sm:px-6 lg:px-8">
      <div
        className={`mx-auto rounded-[36px] border border-white/70 bg-white/80 shadow-[0_32px_90px_-45px_rgba(15,23,42,0.35)] backdrop-blur ${compact ? 'max-w-3xl p-8' : 'max-w-5xl p-10'}`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--color-accent)]">
          e-Dormitory
        </p>
        <h1 className="mt-5 font-display text-4xl text-slate-950">Вхід до системи…</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
          Готуємо ваш кабінет і відкриваємо потрібні розділи.
        </p>
      </div>
    </div>
  )
}
