import { memo } from 'react'
import { Braces, Brackets, ChevronDown, Expand } from 'lucide-react'
import { cn, splitMatches } from '../lib/util'

export type OpenCell = (rect: DOMRect, value: unknown, colKey: string, rowIndex: number) => void

export function Hl({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  return (
    <>
      {splitMatches(text, q).map((p, i) => (p.hit ? <mark key={i} className="hl">{p.t}</mark> : <span key={i}>{p.t}</span>))}
    </>
  )
}

export const summarize = (v: unknown): string => {
  if (Array.isArray(v)) {
    if (v.length === 0) return ''
    if (v.every((x) => x === null || typeof x !== 'object')) return v.slice(0, 4).map(String).join(', ') + (v.length > 4 ? '…' : '')
    const first = v[0]
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      const keys = Object.keys(first)
      return keys.slice(0, 3).join(', ') + (keys.length > 3 ? '…' : '')
    }
    return v.length === 1 ? 'item' : 'items'
  }
  const keys = Object.keys(v as object)
  return keys.length ? keys.slice(0, 3).join(', ') + (keys.length > 3 ? '…' : '') : ''
}

export const isNestedValue = (v: unknown): boolean =>
  v !== null && typeof v === 'object' && (Array.isArray(v) ? v.length > 0 : Object.keys(v as object).length > 0)

type CellProps = {
  value: unknown
  q: string
  onOpen: OpenCell
  colKey: string
  rowIndex: number
  expanded?: boolean
  onToggle?: () => void
}

export const Cell = memo(function Cell({ value, q, onOpen, colKey, rowIndex, expanded, onToggle }: CellProps) {
  if (value === undefined) return <span className="text-muted/50" title="Property missing in this record">—</span>
  if (value === null) return <span className="text-tok-null italic">null</span>
  if (typeof value === 'boolean')
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-1.5 py-px text-[11.5px] font-medium', value ? 'bg-success/10 text-success' : 'bg-sunken text-muted')}>
        <span className={cn('h-1.5 w-1.5 rounded-full', value ? 'bg-success' : 'bg-muted/60')} />
        {String(value)}
      </span>
    )
  if (typeof value === 'number') return <span className="font-mono text-tok-num tabular-nums"><Hl text={String(value)} q={q} /></span>
  if (typeof value === 'string') {
    if (value === '') return <span className="text-muted/60 italic">empty</span>
    const long = value.length > 48
    return (
      <span className="flex items-center gap-1">
        <span className="truncate" title={long ? undefined : value}>
          <Hl text={long && !q ? value.slice(0, 200) : value.length > 400 ? value.slice(0, 400) : value} q={q} />
        </span>
        {long && (
          <button
            aria-label="Inspect full value"
            title="Inspect full value"
            onClick={(e) => {
              e.stopPropagation()
              onOpen(e.currentTarget.getBoundingClientRect(), value, colKey, rowIndex)
            }}
            className="shrink-0 rounded p-0.5 text-muted hover:bg-sunken hover:text-ink"
          >
            <Expand size={11} />
          </button>
        )}
      </span>
    )
  }
  const isArr = Array.isArray(value)
  const n = isArr ? (value as unknown[]).length : Object.keys(value as object).length
  const sum = summarize(value)
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        if (onToggle) onToggle()
        else onOpen(e.currentTarget.getBoundingClientRect(), value, colKey, rowIndex)
      }}
      aria-expanded={onToggle ? !!expanded : undefined}
      title={`${isArr ? `Array with ${n} item(s)` : `Object with ${n} key(s)`}. Click to ${expanded ? 'collapse' : 'expand'} here.`}
      className={cn(
        'flex max-w-full items-center gap-1 rounded border px-1.5 py-px text-[11.5px] transition-colors',
        expanded ? 'border-accent/60 bg-accent-soft' : 'border-line bg-sunken/70 hover:border-accent/50 hover:bg-accent-soft',
      )}
    >
      {expanded ? <ChevronDown size={11} className="shrink-0 text-accent" /> : isArr ? <Brackets size={11} className="shrink-0 text-tok-key" /> : <Braces size={11} className="shrink-0 text-tok-key" />}
      <span className="font-mono font-medium text-tok-key">{n}</span>
      {sum && <span className="truncate text-muted">{sum}</span>}
    </button>
  )
})
