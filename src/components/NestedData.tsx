import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Table2, X } from 'lucide-react'
import { Cell, isNestedValue, type OpenCell } from './Cells'
import { IconButton } from './ui'
import { buildTable, isPlainObject } from '../lib/json'
import { cn } from '../lib/util'

type Common = { onOpenCell: OpenCell; onOpenTable: (label: string, v: unknown) => void }
type DataProps = Common & { value: unknown; label: string }

const countText = (v: unknown) =>
  Array.isArray(v) ? `${v.length.toLocaleString()} ${v.length === 1 ? 'item' : 'items'}` : isPlainObject(v) ? `${Object.keys(v).length} ${Object.keys(v).length === 1 ? 'key' : 'keys'}` : ''

/**
 * Positions its children so they start at the same x as the parent cell (data-col="colKey")
 * of the row just above. Works for table rows (host is a <td>) and for key/value lists (host is a <div>).
 */
export function Anchored({ colKey, children }: { colKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [left, setLeft] = useState(0)
  useLayoutEffect(() => {
    const wrap = ref.current?.parentElement
    if (!wrap) return
    const td = wrap.closest('td')
    const rowEl = td ? td.parentElement?.previousElementSibling : wrap.parentElement?.previousElementSibling
    const anchor = rowEl?.querySelector<HTMLElement>(`[data-col="${CSS.escape(colKey)}"]`)
    if (!anchor) return
    const next = Math.max(0, Math.round(anchor.getBoundingClientRect().left - wrap.getBoundingClientRect().left))
    setLeft((l) => (l === next ? l : next))
  })
  // The outer zero-width box keeps this block out of the parent's column sizing.
  // The content keeps its natural width and simply extends to the right (the table scrolls).
  return (
    <div style={{ width: 0 }}>
      <div
        ref={ref}
        style={{ marginLeft: left, width: 'max-content', minWidth: 320 }}
        className="rounded-l-sm border-l-2 border-accent/70 bg-sunken/70 py-2 pr-3 pl-3 shadow-sm"
      >
        {children}
      </div>
    </div>
  )
}

/** A titled block used for every expanded cell: header with actions, then the nested data. */
export function NestedSection({ title, value, label, onClose, onOpenCell, onOpenTable }: DataProps & { title: string; onClose: () => void }) {
  return (
    <section aria-label={`Nested data: ${title}`}>
      <div className="mb-1 flex items-center gap-2 text-[11.5px]">
        <span className="font-mono font-semibold">{title}</span>
        <span className="text-muted">{countText(value)}</span>
        <span className="ml-auto flex items-center gap-0.5">
          <button onClick={() => onOpenTable(label, value)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted hover:bg-line hover:text-ink" title="Open this as a full table (Cmd/Ctrl+click: new tab)">
            <Table2 size={12} /> Open as table
          </button>
          <IconButton label={`Collapse ${title}`} onClick={onClose} className="h-5 w-5">
            <X size={12} />
          </IconButton>
        </span>
      </div>
      <NestedData value={value} label={label} onOpenCell={onOpenCell} onOpenTable={onOpenTable} />
    </section>
  )
}

export function NestedData(props: DataProps) {
  const { value } = props
  if (Array.isArray(value)) {
    if (value.length === 0) return <p className="rounded-md border border-dashed border-line px-3 py-2 text-muted">Empty array</p>
    if (value.every((v) => v === null || typeof v !== 'object')) return <PrimitiveList items={value} />
    return <NestedTable {...props} />
  }
  if (isPlainObject(value)) return <NestedObject {...props} />
  return (
    <div className="px-1 py-1">
      <Cell value={value} q="" onOpen={props.onOpenCell} colKey={props.label} rowIndex={0} />
    </div>
  )
}

function PrimitiveList({ items }: { items: unknown[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.slice(0, 200).map((v, i) => (
        <span key={i} className="max-w-full truncate rounded border border-line bg-surface px-1.5 py-px font-mono text-[11.5px]">
          {v === null ? <i className="text-tok-null">null</i> : typeof v === 'string' ? v : String(v)}
        </span>
      ))}
      {items.length > 200 && <span className="px-1 text-muted">+{items.length - 200} more</span>}
    </div>
  )
}

function useOpenSet() {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (k: string) =>
    setOpen((s) => {
      const n = new Set(s)
      n.has(k) ? n.delete(k) : n.add(k)
      return n
    })
  return { open, toggle }
}

function NestedTable({ value, label, onOpenCell, onOpenTable }: DataProps) {
  const model = useMemo(() => buildTable(value, true), [value])
  const { open, toggle } = useOpenSet()
  const [shown, setShown] = useState(50)
  const colCount = model.cols.length + 1

  return (
    <div className="w-max min-w-full rounded-md border border-line bg-surface">
      <table className="border-separate border-spacing-0 text-[12px]" style={{ minWidth: '100%' }}>
        <thead>
          <tr>
            <th className="h-7 w-10 border-r border-b border-line bg-sunken px-2 text-center font-mono text-[11px] font-normal text-muted">#</th>
            {model.cols.map((c) => (
              <th key={c.key} className={cn('h-7 border-r border-b border-line bg-sunken px-2 font-mono text-[11.5px] font-semibold whitespace-nowrap', c.type === 'number' ? 'text-right' : 'text-left')}>
                {c.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.rows.slice(0, shown).map((r) => {
            const openKeys = model.cols.filter((c) => open.has(`${r.i}::${c.key}`) && isNestedValue(r.flat[c.key]))
            return (
              <FragmentRows key={r.i}>
                <tr className="hover:bg-sunken">
                  <td className="h-7 border-r border-b border-line px-2 text-center font-mono text-[11px] text-muted">{r.i + 1}</td>
                  {model.cols.map((c) => {
                    const v = r.flat[c.key]
                    const k = `${r.i}::${c.key}`
                    return (
                      <td key={c.key} data-col={c.key} className={cn('h-7 max-w-[320px] overflow-hidden border-r border-b border-line px-2 whitespace-nowrap', c.type === 'number' && 'text-right')}>
                        <Cell value={v} q="" onOpen={onOpenCell} colKey={c.key} rowIndex={r.i} expanded={open.has(k)} onToggle={isNestedValue(v) ? () => toggle(k) : undefined} />
                      </td>
                    )
                  })}
                </tr>
                {openKeys.length > 0 && (
                  <tr>
                    <td colSpan={colCount} className="border-b border-line bg-sunken/50 p-0">
                      <div className="space-y-2 py-2">
                        {openKeys.map((c) => (
                          <Anchored key={c.key} colKey={c.key}>
                            <NestedSection title={c.key} value={r.flat[c.key]} label={`${label}[${r.i}].${c.key}`} onClose={() => toggle(`${r.i}::${c.key}`)} onOpenCell={onOpenCell} onOpenTable={onOpenTable} />
                          </Anchored>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </FragmentRows>
            )
          })}
        </tbody>
      </table>
      {model.rows.length > shown && (
        <button onClick={() => setShown((n) => n + 100)} className="w-full border-t border-line py-1.5 text-[12px] text-accent hover:bg-accent-soft">
          Show {Math.min(100, model.rows.length - shown)} more ({(model.rows.length - shown).toLocaleString()} remaining)
        </button>
      )}
    </div>
  )
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function NestedObject({ value, label, onOpenCell, onOpenTable }: DataProps) {
  const model = useMemo(() => buildTable(value, true), [value])
  const { open, toggle } = useOpenSet()
  const flat = model.rows[0]?.flat ?? {}
  return (
    <dl className="w-max min-w-[320px] rounded-md border border-line bg-surface text-[12px]">
      {model.cols.map((c) => {
        const v = flat[c.key]
        const nested = isNestedValue(v)
        return (
          <div key={c.key} className="border-b border-line last:border-b-0">
            <div className="grid grid-cols-[minmax(80px,200px)_1fr] items-center gap-2 px-2 py-1">
              <dt className="truncate font-mono text-[11.5px] text-muted" title={c.key}>
                {c.key}
              </dt>
              <dd data-col={c.key} className="min-w-0 overflow-hidden">
                <Cell value={v} q="" onOpen={onOpenCell} colKey={c.key} rowIndex={0} expanded={open.has(c.key)} onToggle={nested ? () => toggle(c.key) : undefined} />
              </dd>
            </div>
            {nested && open.has(c.key) && (
              <div className="py-2">
                <Anchored colKey={c.key}>
                  <NestedSection title={c.key} value={v} label={`${label}.${c.key}`} onClose={() => toggle(c.key)} onOpenCell={onOpenCell} onOpenTable={onOpenTable} />
                </Anchored>
              </div>
            )}
          </div>
        )
      })}
    </dl>
  )
}
