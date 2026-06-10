import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  Bell,
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
  UserRoundCog,
  Users,
  Wrench,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { formatDate, formatMoney } from '../lib/format'
import { getNotifications, markNotificationsRead } from '../lib/api'
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
  '/app/students': Users,
  '/app/staff': UserRoundCog,
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
  const queryClient = useQueryClient()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false)
  const notificationPanelRef = useRef<HTMLDivElement | null>(null)
  const navigation = getNavigation(currentUser.role)
  const notificationsQuery = useQuery({
    queryKey: ['notifications', currentUser.id],
    queryFn: getNotifications,
  })

  const markReadMutation = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications', currentUser.id] })
    },
  })

  const activeNavItem = useMemo(() => {
    return navigation.find((item) => location.pathname.startsWith(item.to)) ?? navigation[0]
  }, [location.pathname, navigation])

  useEffect(() => {
    if (!notificationPanelOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (notificationPanelRef.current && !notificationPanelRef.current.contains(event.target as Node)) {
        setNotificationPanelOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [notificationPanelOpen])

  const unreadCount = notificationsQuery.data?.unreadCount ?? 0
  const notificationItems = notificationsQuery.data?.items ?? []

  const openNotifications = () => {
    setNotificationPanelOpen((open) => {
      const nextOpen = !open
      if (!open && unreadCount > 0 && !markReadMutation.isPending) {
        markReadMutation.mutate()
      }
      return nextOpen
    })
  }

  return (
    <div className="min-h-screen bg-[var(--color-page)] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-[1800px] gap-0 lg:gap-5 lg:p-4">
        <aside className="hidden w-[176px] shrink-0 lg:block xl:w-[196px]">
          <div className="sticky top-4 flex h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[28px] border border-white/55 bg-[linear-gradient(180deg,#183342_0%,#5f7286_100%)] p-3 text-white shadow-[0_30px_80px_-42px_rgba(15,23,42,0.75)]">
            <BrandBlock />
            <NavPanel
              navigation={navigation}
              currentPath={location.pathname}
              onNavigate={() => undefined}
            />
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="relative z-10 border-b border-white/60 bg-[rgba(247,246,242,0.9)] backdrop-blur lg:rounded-[30px] lg:border lg:bg-[rgba(247,246,242,0.88)]">
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
                  <div className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-800">
                    До сплати: {formatMoney(currentUser.debtAmount ?? 0)}
                  </div>
                ) : null}

                <div className="relative" ref={notificationPanelRef}>
                  <button
                    type="button"
                    onClick={openNotifications}
                    className="relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    aria-label="Повідомлення"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 ? (
                      <span className="absolute bottom-2 right-2 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                    ) : null}
                  </button>

                  {notificationPanelOpen ? (
                    <div className="absolute right-0 top-14 z-30 w-[min(92vw,24rem)] overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_30px_70px_-35px_rgba(15,23,42,0.45)] backdrop-blur">
                      <div className="border-b border-slate-200 px-5 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Повідомлення</p>
                        <p className="mt-2 text-lg font-semibold text-slate-950">
                          {unreadCount > 0 ? `Є нові: ${unreadCount}` : 'Тут усе спокійно'}
                        </p>
                      </div>
                      <div className="max-h-[26rem] overflow-y-auto p-3">
                        {notificationItems.length > 0 ? (
                          <div className="grid gap-3">
                            {notificationItems.map((item) => (
                              <article key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                                <p className="font-semibold text-slate-900">{item.title}</p>
                                <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                                  {formatDate(item.createdAt)}
                                </p>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                            Повідомлень поки немає. Якщо щось зміниться — ми підкажемо.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

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

          <main className="flex-1 px-4 pt-6 pb-28 sm:px-6 sm:pb-32 lg:px-8 lg:pt-8 lg:pb-8">
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
              Закрити
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
    <div className="mb-4 flex items-center justify-center rounded-[22px] border border-white/10 bg-white/8 px-3 py-4">
      <div className="text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-white/95 text-sm font-black tracking-[0.18em] text-[var(--color-accent)]">
          ED
        </div>
        <p className="mt-2 text-[11px] font-semibold tracking-tight text-white">e-Dormitory</p>
      </div>
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
            className={`flex min-h-[72px] items-center justify-between gap-3 rounded-[22px] px-3 py-3 text-left transition ${active ? 'bg-white text-slate-950 ring-1 ring-white/70 shadow-[0_22px_48px_-28px_rgba(15,23,42,0.8)]' : 'text-white/88 hover:bg-white/12 hover:text-white'}`}
          >
            <span className={`min-w-0 flex-1 text-sm font-semibold leading-5 ${active ? 'text-slate-950' : 'text-white'}`}>
              {item.shortLabel}
            </span>
            <span
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${active ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]' : 'bg-white/10 text-white'}`}
            >
              <Icon className="h-5 w-5" />
            </span>
          </NavLink>
        )
      })}
    </div>
  )
}
