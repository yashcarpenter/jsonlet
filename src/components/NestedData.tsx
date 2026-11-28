import { useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Table2, X } from 'lucide-react'
import { Cell, isNestedValue, type OpenCell } from './Cells'
import { IconButton } from './ui'
import { TableWorkspace } from './TableWorkspace'
import { NestedContext } from './nestedContext'
import { buildTable, isPlainObject } from '../lib/json'
import { safeName } from '../lib/util'

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

/**
 * A table nested inside another table's row. It is the SAME table component as the main one (sorting, filters,
 * search, column controls, paging, export, further nesting, record inspector), just in a compact form.
 */
function NestedTable({ value, label, onOpenTable }: DataProps) {
  const ctx = useContext(NestedContext)
  const [flatten, setFlatten] = useState(true)
  const model = useMemo(() => buildTable(value, flatten), [value, flatten])
  return (
    <TableWorkspace
      key={flatten ? 'flat' : 'raw'}
      compact
      defaultPageSize={10}
      model={model}
      fileBase={`${ctx?.fileBase ?? 'data'}-${safeName(label)}`}
      flatten={flatten}
      onFlatten={setFlatten}
      isInspected={(r) => !!ctx && ctx.isInspected(r, model.kind)}
      onInspect={(r) => ctx?.onInspectRow(r, model.kind)}
      onOpenNested={onOpenTable}
      datasetLabel={label}
    />
  )
}

function NestedObject({ value, label, onOpenCell, onOpenTable }: DataProps) {
  const ctx = useContext(NestedContext)
  const { open, toggle } = useOpenSet()
  const obj = value as Record<string, unknown>
  return (
    <dl className="w-max min-w-[320px] rounded-md border border-line bg-surface text-[12px]">
      {Object.keys(obj).map((k) => {
        const v = obj[k]
        const nested = isNestedValue(v)
        return (
          <div key={k} className="border-b border-line last:border-b-0">
            <div className="grid grid-cols-[minmax(80px,200px)_1fr] items-center gap-2 px-2 py-1">
              <dt className="truncate" title={ctx ? `${k} (click to show in the editor)` : k}>
                {ctx ? (
                  <button onClick={() => ctx.revealKey(value, k)} className="max-w-full truncate rounded font-mono text-[11.5px] text-muted hover:bg-accent-soft hover:text-accent hover:underline">
                    {k}
                  </button>
                ) : (
                  <span className="font-mono text-[11.5px] text-muted">{k}</span>
                )}
              </dt>
              <dd data-col={k} className="min-w-0 overflow-hidden">
                <Cell value={v} q="" onOpen={onOpenCell} colKey={k} rowIndex={0} expanded={open.has(k)} onToggle={nested ? () => toggle(k) : undefined} />
              </dd>
            </div>
            {nested && open.has(k) && (
              <div className="py-2">
                <Anchored colKey={k}>
                  <NestedSection title={k} value={v} label={`${label}.${k}`} onClose={() => toggle(k)} onOpenCell={onOpenCell} onOpenTable={onOpenTable} />
                </Anchored>
              </div>
            )}
          </div>
        )
      })}
    </dl>
  )
}
