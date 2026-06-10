import clsx from 'clsx'
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

export function PageSection({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--color-accent)]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-display text-3xl leading-none text-slate-950 sm:text-4xl">{title}</h1>
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex w-full flex-wrap gap-3 sm:w-auto">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

export function SurfaceCard({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & {
  className?: string
  children: ReactNode
}) {
  return (
    <article
      {...props}
      className={clsx(
        'rounded-[28px] border border-white/70 bg-[var(--color-surface)] p-4 shadow-[0_28px_80px_-34px_rgba(15,23,42,0.2)] ring-1 ring-slate-950/5 sm:rounded-[32px] sm:p-6',
        className,
      )}
    >
      {children}
    </article>
  )
}

export function HeroMetric({
  label,
  value,
  meta,
  tone = 'sky',
}: {
  label: string
  value: string
  meta?: string
  tone?: 'sky' | 'emerald' | 'rose' | 'amber'
}) {
  const tones = {
    sky: 'from-sky-500/20 via-cyan-500/10 to-white',
    emerald: 'from-emerald-500/20 via-teal-500/10 to-white',
    rose: 'from-rose-500/20 via-orange-500/10 to-white',
    amber: 'from-amber-400/22 via-orange-300/10 to-white',
  }

  return (
    <SurfaceCard className={clsx('overflow-hidden bg-gradient-to-br', tones[tone])}>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{label}</p>
      <p className="mt-4 font-display text-3xl text-slate-950 sm:text-5xl">{value}</p>
      {meta ? <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">{meta}</p> : null}
    </SurfaceCard>
  )
}

export function MetricTile({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string
}) {
  return (
    <SurfaceCard className="rounded-[28px] bg-[var(--color-panel-soft)]">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
      {note ? <p className="mt-2 text-sm leading-6 text-slate-600">{note}</p> : null}
    </SurfaceCard>
  )
}

export function Badge({
  tone,
  children,
}: {
  tone: 'slate' | 'sky' | 'emerald' | 'rose' | 'amber'
  children: ReactNode
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    sky: 'bg-sky-100 text-sky-700 ring-sky-200',
    emerald: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    rose: 'bg-rose-100 text-rose-700 ring-rose-200',
    amber: 'bg-amber-100 text-amber-700 ring-amber-200',
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

export function PrimaryButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mb-2 flex items-end justify-between gap-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
    </div>
  )
}

export function TextField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <FieldLabel label={label} hint={hint} />
      {children}
    </label>
  )
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        'w-full rounded-[22px] border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-[var(--color-accent)] focus:ring-4 focus:ring-[var(--color-accent-soft)]',
        className,
      )}
    />
  )
}

export function TextArea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(
        'w-full rounded-[22px] border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-[var(--color-accent)] focus:ring-4 focus:ring-[var(--color-accent-soft)]',
        className,
      )}
    />
  )
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        'w-full rounded-[22px] border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-[var(--color-accent)] focus:ring-4 focus:ring-[var(--color-accent-soft)]',
        className,
      )}
    >
      {children}
    </select>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <SurfaceCard className="rounded-[28px] border-dashed bg-slate-50/80 text-center">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </SurfaceCard>
  )
}

export function DataTable({
  headers,
  rows,
}: {
  headers: string[]
  rows: ReactNode[][]
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
      <div className="grid gap-3 p-3 md:hidden">
        {rows.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-center text-slate-500">
            Тут поки порожньо. Коли щось з’явиться, ми покажемо це тут.
          </div>
        ) : (
          rows.map((row, rowIndex) => (
            <article
              key={rowIndex}
              className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
            >
              <div className="grid gap-3">
                {row.map((cell, cellIndex) => (
                  <div key={`${rowIndex}-${cellIndex}`} className="grid gap-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                      {headers[cellIndex]}
                    </p>
                    <div className="text-sm leading-6 text-slate-700">{cell}</div>
                  </div>
                ))}
              </div>
            </article>
          ))
        )}
      </div>

      <div className="hidden overflow-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-4 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-4 py-8 text-center text-slate-500">
                  Тут поки порожньо. Коли щось з’явиться, ми покажемо це тут.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="align-top">
                  {row.map((cell, cellIndex) => (
                    <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-4 text-slate-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function Timeline({
  items,
}: {
  items: {
    id: string
    title: string
    description: string
    meta: string
    badge?: ReactNode
  }[]
}) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex gap-4 rounded-[24px] border border-slate-200 bg-white/80 p-4"
        >
          <div className="mt-1 h-3 w-3 rounded-full bg-[var(--color-accent)]" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-semibold text-slate-900">{item.title}</p>
              {item.badge}
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">{item.meta}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function Modal({
  open,
  title,
  children,
  onClose,
  size = 'md',
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  size?: 'md' | 'lg'
}) {
  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 p-3 pt-6 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={clsx(
          'max-h-[92vh] w-full overflow-auto rounded-[28px] border border-white/70 bg-white p-4 shadow-[0_40px_100px_-40px_rgba(15,23,42,0.65)] sm:rounded-[32px] sm:p-6',
          size === 'lg' ? 'max-w-4xl' : 'max-w-2xl',
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="font-display text-2xl text-slate-950">{title}</h2>
          <SecondaryButton onClick={onClose}>Повернутися</SecondaryButton>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Drawer({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className={clsx('fixed inset-0 z-50 transition', open ? 'pointer-events-auto' : 'pointer-events-none')}>
      <div
        className={clsx(
          'absolute inset-0 bg-slate-950/35 transition-opacity',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        className={clsx(
          'absolute right-0 top-0 h-full w-full max-w-xl overflow-auto border-l border-white/70 bg-[var(--color-surface)] p-4 shadow-[0_40px_100px_-40px_rgba(15,23,42,0.65)] transition-transform sm:p-6',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="font-display text-2xl text-slate-950">{title}</h2>
          <SecondaryButton onClick={onClose}>Повернутися</SecondaryButton>
        </div>
        {children}
      </aside>
    </div>
  )
}

export function FloatingActionButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        'fixed bottom-24 right-4 z-30 inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-white shadow-[0_24px_50px_-20px_rgba(15,23,42,0.6)] transition hover:bg-slate-800 sm:right-6 lg:hidden',
        props.className,
      )}
    >
      {children}
    </button>
  )
}
