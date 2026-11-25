import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

export function ErrorState({ title, message, children, icon }: { title: string; message: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-surface p-8 text-center">
      <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-warn/10 text-warn">{icon ?? <AlertTriangle size={20} />}</span>
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <p className="max-w-md text-muted">{message}</p>
      {children && <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  )
}
