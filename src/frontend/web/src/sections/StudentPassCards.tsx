import { QRCodeSVG } from 'qrcode.react'
import type { GuestPass } from '../lib/types'
import { formatDate } from './utils'

export function StudentPassCards({ passes }: { passes: GuestPass[] }) {
  return (
    <div className="grid gap-4">
      {passes.map((pass) => (
        <div key={pass.id} className="grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto]">
          <div>
            <p className="font-semibold text-slate-900">{pass.guestFullName}</p>
            <p className="text-sm text-slate-600">{pass.guestDocument}</p>
            <p className="mt-2 text-sm text-slate-700">Код доступу: <span className="font-mono">{pass.accessCode}</span></p>
            <p className="mt-1 text-sm text-slate-500">{formatDate(pass.validFrom)} - {formatDate(pass.validTo)}</p>
          </div>
          <div className="rounded-2xl bg-white p-3">
            <QRCodeSVG value={pass.accessCode} size={110} />
          </div>
        </div>
      ))}
    </div>
  )
}
