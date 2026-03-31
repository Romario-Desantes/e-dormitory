import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  BookOpen,
  ClipboardList,
  DoorOpen,
  Landmark,
  LayoutGrid,
  LogOut,
  Menu,
  ScanLine,
  ShieldAlert,
  UserCog,
  Users,
  Wrench,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { formatMoney } from '../lib/format'
import { getNavigation, getRoleTitle } from '../lib/roles'
import type { AuthenticatedUser, NavItem } from '../lib/types'
import { PrimaryButton, SecondaryButton } from './AppPrimitives'

const iconMap: Record<string, LucideIcon> = {
  '/app/overview': LayoutGrid,
  '/app/tickets': Wrench,
  '/app/passes': BadgeCheck,
  '/app/finance': Landmark,
  '/app/occupancy': LayoutGrid,
  '/app/relocations': DoorOpen,
  '/app/discipline': ShieldAlert,
  '/app/tasks': ClipboardList,
  '/app/guard': ScanLine,
  '/app/payments': Landmark,
  '/app/users': Users,
  '/app/directories': BookOpen,
}

export function AppShell({
  currentUser,
  onLogout,
}: {
  currentUser: AuthenticatedUser
  onLogout: () => void | Promise<void>
}) {
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const navigation = getNavigation(currentUser.role)

  const activeNavItem = useMemo(() => {
    return navigation.find((item) => location.pathname.startsWith(item.to)) ?? navigation[0]
  }, [location.pathname, navigation])

  return (
    <div className="min-h-screen bg-[var(--color-page)] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-[1800px] gap-0 lg:gap-4 lg:p-4">
        <aside className="hidden w-[280px] shrink-0 lg:block xl:w-[312px]">
          <div className="sticky top-4 flex h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[36px] border border-white/60 bg-[linear-gradient(180deg,#14313c_0%,#0d1f2d_100%)] p-6 text-white shadow-[0_34px_90px_-40px_rgba(15,23,42,0.75)]">
            <BrandBlock />
            <NavPanel
              navigation={navigation}
              currentPath={location.pathname}
              onNavigate={() => undefined}
            />
            <div className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-white/55">Зараз відкрито</p>
              <p className="mt-2 text-lg font-semibold">{activeNavItem?.label}</p>
              <p className="mt-2 text-sm leading-6 text-white/72">{activeNavItem?.description}</p>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-white/60 bg-[rgba(247,246,242,0.84)] backdrop-blur lg:top-4 lg:rounded-[32px] lg:border lg:bg-[rgba(247,246,242,0.82)]">
            <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-white lg:hidden"
                  onClick={() => setMobileNavOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
                    {getRoleTitle(currentUser.role)}
                  </p>
                  <p className="truncate font-display text-xl text-slate-950 sm:text-2xl">
                    {activeNavItem?.label ?? 'e-Dormitory'}
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                {currentUser.role === 'Student' ? (
                  <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-sm font-semibold text-emerald-800">
                    Баланс: {formatMoney(currentUser.balance)}
                  </div>
                ) : null}
                <div className="rounded-full border border-slate-300 bg-white px-4 py-2 text-center text-sm text-slate-700">
                  {currentUser.fullName}
                </div>
                <PrimaryButton onClick={() => void onLogout()} className="px-4 py-2.5">
                  <LogOut className="mr-2 h-4 w-4" />
                  Вийти
                </PrimaryButton>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 pb-28 sm:px-6 sm:pb-32 lg:px-8 lg:py-8 lg:pb-8">
            <Outlet context={currentUser} />
          </main>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-40 lg:hidden ${mobileNavOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <div
          className={`absolute inset-0 bg-slate-950/40 transition-opacity ${mobileNavOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMobileNavOpen(false)}
        />
        <div
          className={`absolute left-0 top-0 h-full w-[86vw] max-w-sm bg-[linear-gradient(180deg,#14313c_0%,#0d1f2d_100%)] p-5 text-white shadow-2xl transition-transform ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex min-h-full flex-col">
            <BrandBlock />
            <NavPanel
              navigation={navigation}
              currentPath={location.pathname}
              onNavigate={() => setMobileNavOpen(false)}
            />
            <SecondaryButton
              className="mt-auto bg-white/10 text-white hover:bg-white/15 hover:text-white"
              onClick={() => setMobileNavOpen(false)}
            >
              Закрити меню
            </SecondaryButton>
          </div>
        </div>
      </div>

      <nav className="fixed bottom-4 left-1/2 z-30 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-full border border-white/70 bg-white/92 p-2 shadow-[0_26px_50px_-24px_rgba(15,23,42,0.55)] backdrop-blur lg:hidden">
        <div className="flex items-stretch gap-2">
          {navigation.slice(0, 4).map((item) => {
            const Icon = iconMap[item.to] ?? UserCog
            const active = location.pathname.startsWith(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full px-2 py-2 text-center text-[11px] font-semibold transition sm:px-3 ${active ? 'bg-slate-950' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-slate-600'}`} />
                <span className={`block max-w-full truncate ${active ? 'text-white' : 'text-slate-600'}`}>
                  {item.shortLabel}
                </span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function BrandBlock() {
  return (
    <div className="mb-8 rounded-[28px] border border-white/10 bg-white/5 p-5">
      <p className="text-xs uppercase tracking-[0.34em] text-white/55">e-Dormitory</p>
      <h1 className="mt-4 font-display text-2xl text-white xl:text-3xl">Кабінет гуртожитку</h1>
      <p className="mt-3 text-sm leading-6 text-white/70">
        Усі щоденні дії для мешканців і персоналу в одному зручному просторі.
      </p>
    </div>
  )
}

function NavPanel({
  navigation,
  currentPath,
  onNavigate,
}: {
  navigation: NavItem[]
  currentPath: string
  onNavigate: () => void
}) {
  return (
    <div className="space-y-2">
      {navigation.map((item) => {
        const Icon = iconMap[item.to] ?? UserCog
        const active = currentPath.startsWith(item.to)

        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`flex items-start gap-3 rounded-[24px] px-4 py-4 transition ${active ? 'bg-[linear-gradient(135deg,#f8fafc_0%,#dbeafe_100%)] text-slate-950 ring-1 ring-white/70 shadow-[0_22px_48px_-28px_rgba(15,23,42,0.8)]' : 'text-white/78 hover:bg-white/8 hover:text-white'}`}
          >
            <span
              className={`mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl ${active ? 'bg-[var(--color-accent)] text-white shadow-sm' : 'bg-white/10 text-white'}`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className={`block font-semibold ${active ? 'text-slate-950' : ''}`}>{item.label}</span>
              <span className={`mt-1 block text-sm leading-6 ${active ? 'text-slate-700' : 'text-white/58'}`}>
                {item.description}
              </span>
            </span>
          </NavLink>
        )
      })}
    </div>
  )
}
