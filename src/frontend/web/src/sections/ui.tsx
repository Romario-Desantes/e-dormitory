import clsx from 'clsx'
import type { ReactNode } from 'react'

export function SectionFrame({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.24)] backdrop-blur sm:p-8">
      <p className="text-sm uppercase tracking-[0.32em] text-sky-700">{title}</p>
      <p className="mt-3 max-w-3xl text-slate-600">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  )
}

export function Card({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <article className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-5">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </article>
  )
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

export function StatCard({ label, value, tone }: { label: string; value: string; tone: 'sky' | 'amber' | 'emerald' }) {
  const tones = {
    sky: 'border-sky-200 bg-sky-50',
    amber: 'border-amber-200 bg-amber-50',
    emerald: 'border-emerald-200 bg-emerald-50',
  }

  return (
    <div className={clsx('rounded-[1.75rem] border px-5 py-4 shadow-sm', tones[tone])}>
      <p className="text-sm uppercase tracking-[0.26em] text-slate-500">{label}</p>
      <p className="mt-3 font-serif text-3xl text-slate-900">{value}</p>
    </div>
  )
}

export function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200">
      <div className="overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 font-medium">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-5 text-slate-500" colSpan={headers.length}>Поки що немає даних.</td>
              </tr>
            ) : rows.map((row, rowIndex) => (
              <tr key={`${row.join('-')}-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 text-slate-700">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button type="submit" disabled={pending} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70">
      {pending ? 'Виконуємо...' : label}
    </button>
  )
}
