import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function QuickActionTile({
  title,
  description,
  icon,
  to,
}: {
  title: string
  description: string
  icon: ReactNode
  to: string
}) {
  return (
    <Link
      to={to}
      className="rounded-[26px] border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-slate-300 hover:bg-white"
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-900 shadow-sm">
        {icon}
      </span>
      <p className="mt-4 font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
    </Link>
  )
}
