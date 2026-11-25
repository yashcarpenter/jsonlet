import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn, onToast, type ToastMsg } from '../lib/util'

/* ---------- Buttons ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' }

export function Button({ variant = 'secondary', size = 'md', className, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-45',
        size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]',
        variant === 'primary' && 'bg-accent text-white shadow-sm hover:brightness-110 dark:text-[#0b1020]',
        variant === 'secondary' && 'border border-line bg-surface text-ink hover:bg-sunken',
        variant === 'ghost' && 'text-muted hover:bg-sunken hover:text-ink',
        variant === 'danger' && 'border border-line bg-surface text-error hover:bg-error/10',
        className,
      )}
    />
  )
}

export function IconButton({ label, active, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      {...p}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-40',
        active && 'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent',
        className,
      )}
    >
      {children}
    </button>
  )
}

export const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="rounded border border-line bg-sunken px-1 font-mono text-[10px] leading-4 text-muted">{children}</kbd>
)

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; icon?: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-md border border-line bg-sunken p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn('inline-flex h-6 items-center gap-1 rounded px-2 text-[12px] font-medium transition-colors', value === o.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- Floating panel anchored to a rect ---------- */
export function FloatingPanel({ rect, onClose, children, width = 280, align = 'start', className }: { rect: DOMRect; onClose: () => void; children: ReactNode; width?: number; align?: 'start' | 'end'; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number } | null>(null)

  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 200
    const vw = window.innerWidth
    const vh = window.innerHeight
    const w = Math.min(width, vw - 16)
    let left = align === 'end' ? rect.right - w : rect.left
    left = Math.max(8, Math.min(left, vw - w - 8))
    let top = rect.bottom + 6
    if (top + h > vh - 8 && rect.top - h - 6 > 8) top = rect.top - h - 6
    top = Math.max(8, top)
    setPos({ top, left, maxH: vh - top - 8 })
  }, [rect, width, align, children])

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    const t = setTimeout(() => document.addEventListener('mousedown', down), 0)
    window.addEventListener('keydown', key, true)
    window.addEventListener('resize', onClose)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', down)
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: Math.min(width, window.innerWidth - 16), maxHeight: pos?.maxH }}
      className={cn('anim-pop fixed z-[60] flex flex-col overflow-hidden rounded-lg border border-line bg-surface text-[13px] shadow-xl shadow-black/10', className)}
    >
      {children}
    </div>,
    document.body,
  )
}

/** Trigger + popover. Children receive a close() callback. */
export function Popover({ trigger, children, width, align, className }: { trigger: (p: { onClick: () => void; open: boolean; ref: React.RefObject<HTMLButtonElement | null> }) => ReactNode; children: (close: () => void) => ReactNode; width?: number; align?: 'start' | 'end'; className?: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLButtonElement>(null)
  const close = () => setRect(null)
  return (
    <>
      {trigger({
        ref,
        open: !!rect,
        onClick: () => setRect((r) => (r ? null : ref.current!.getBoundingClientRect())),
      })}
      {rect && (
        <FloatingPanel rect={rect} onClose={close} width={width} align={align} className={className}>
          {children(close)}
        </FloatingPanel>
      )}
    </>
  )
}

/* ---------- Modal ---------- */
export function Modal({ title, onClose, children, width = 520 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [onClose])
  return createPortal(
    <div className="anim-fade fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[10vh] backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: width }} className="anim-pop w-full rounded-xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[14px] font-semibold">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/* ---------- Toasts ---------- */
export function Toaster() {
  const [items, setItems] = useState<ToastMsg[]>([])
  useEffect(
    () =>
      onToast((t) => {
        setItems((l) => [...l.slice(-2), t])
        setTimeout(() => setItems((l) => l.filter((x) => x.id !== t.id)), 2600)
      }),
    [],
  )
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-[90] flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map((t) => (
        <div key={t.id} className="anim-pop pointer-events-auto flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] shadow-lg">
          {t.tone === 'ok' ? <CheckCircle2 size={15} className="text-success" /> : t.tone === 'err' ? <AlertCircle size={15} className="text-error" /> : <Info size={15} className="text-accent" />}
          {t.text}
        </div>
      ))}
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-[12.5px]">
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cn('relative h-4.5 w-8 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line')}>
        <span className={cn('absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-3.5')} />
      </button>
    </label>
  )
}
