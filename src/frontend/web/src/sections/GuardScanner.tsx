import { Scanner } from '@yudiel/react-qr-scanner'

export function GuardScanner({ onScan }: { onScan: (code: string) => void }) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200">
      <Scanner
        constraints={{ facingMode: 'environment' }}
        onScan={(codes) => {
          const nextCode = codes[0]?.rawValue
          if (nextCode) {
            onScan(nextCode)
          }
        }}
      />
    </div>
  )
}
