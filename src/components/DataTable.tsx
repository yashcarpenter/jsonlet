import { memo } from 'react'
import { flexRender, type Header, type Table } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, Braces, Brackets, Calendar, Expand, Filter, Hash, Shuffle, ToggleLeft, Type } from 'lucide-react'
import { Popover } from './ui'
import { ColumnFilter } from './ColumnFilter'
import { cn, splitMatches } from '../lib/util'
import { filterForValue, isFilterReady, type FilterValue } from '../lib/filters'
import type { Col, ColType, Row } from '../lib/json'

export type OpenCell = (rect: DOMRect, value: unknown, colKey: string, rowIndex: number) => void
export type CellMenu = (x: number, y: number, value: unknown, colKey: string, rowIndex: number) => void
export type Density = 'compact' | 'comfortable' | 'spacious'
export const DENSITY_H: Record<Density, string> = { compact: 'h-6', comfortable: 'h-8', spacious: 'h-11' }

const TYPE_ICON: Record<ColType, React.ReactNode> = {
  string: <Type size={12} />,
  number: <Hash size={12} />,
  boolean: <ToggleLeft size={12} />,
  date: <Calendar size={12} />,
  object: <Braces size={12} />,
  array: <Brackets size={12} />,
  mixed: <Shuffle size={12} />,
}

function Hl({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  return (
    <>
      {splitMatches(text, q).map((p, i) => (p.hit ? <mark key={i} className="hl">{p.t}</mark> : <span key={i}>{p.t}</span>))}
    </>
  )
}

const summarize = (v: unknown): string => {
  if (Array.isArray(v)) {
    if (v.length === 0) return 'empty'
    if (v.every((x) => x === null || typeof x !== 'object')) return v.slice(0, 4).map(String).join(', ') + (v.length > 4 ? '…' : '')
    return `${v.length} ${v.length === 1 ? 'item' : 'items'}`
  }
  const keys = Object.keys(v as object)
  return keys.length ? keys.slice(0, 3).join(', ') + (keys.length > 3 ? '…' : '') : 'empty'
}

const Cell = memo(function Cell({ value, q, onOpen, colKey, rowIndex }: { value: unknown; q: string; onOpen: OpenCell; colKey: string; rowIndex: number }) {
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
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onOpen(e.currentTarget.getBoundingClientRect(), value, colKey, rowIndex)
      }}
      title={isArr ? `Array with ${n} item(s). Click to expand.` : `Object with ${n} key(s). Click to expand.`}
      className="flex max-w-full items-center gap-1 rounded border border-line bg-sunken/70 px-1.5 py-px text-[11.5px] hover:border-accent/50 hover:bg-accent-soft"
    >
      {isArr ? <Brackets size={11} className="shrink-0 text-tok-key" /> : <Braces size={11} className="shrink-0 text-tok-key" />}
      <span className="font-mono font-medium text-tok-key">{n}</span>
      <span className="truncate text-muted">{summarize(value)}</span>
    </button>
  )
})

function HeaderCell({ h, filter, col }: { h: Header<Row, unknown>; filter: FilterValue | undefined; col: Col | undefined }) {
  const c = h.column
  const sorted = c.getIsSorted()
  const sortIdx = c.getSortIndex()
  const multi = h.getContext().table.getState().sorting.length > 1
  const active = col ? isFilterReady(filter, col.type) : false
  const right = col?.type === 'number'
  return (
    <>
      <div className={cn('flex h-full items-center gap-1 px-2', right && 'flex-row-reverse')}>
        <button
          onClick={c.getToggleSortingHandler()}
          title={`Sort by ${c.id} (Shift+click to add to sort)`}
          className={cn('flex min-w-0 flex-1 items-center gap-1.5 text-left font-semibold', right && 'flex-row-reverse text-right')}
        >
          <span className="shrink-0 text-muted">{col ? TYPE_ICON[col.type] : null}</span>
          <span className="truncate font-mono text-[12px]">{flexRender(c.columnDef.header, h.getContext())}</span>
          {sorted && (
            <span className="flex shrink-0 items-center text-accent">
              {sorted === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              {multi && <span className="text-[10px] font-bold">{sortIdx + 1}</span>}
            </span>
          )}
        </button>
        {col && (
          <Popover
            width={264}
            align={right ? 'start' : 'end'}
            trigger={(p) => (
              <button {...p} aria-label={`Filter ${c.id}`} title={`Filter ${c.id}`} className={cn('shrink-0 rounded p-1 transition-opacity hover:bg-line', active ? 'bg-accent-soft text-accent opacity-100' : 'text-muted opacity-0 group-hover/th:opacity-100 focus-visible:opacity-100', p.open && 'opacity-100')}>
                <Filter size={11} fill={active ? 'currentColor' : 'none'} />
              </button>
            )}
          >
            {(close) => (
              <ColumnFilter
                col={col}
                value={filter}
                onChange={(v) => c.setFilterValue(v)}
                onClose={close}
                getValues={() => h.getContext().table.getPrePaginationRowModel().rows.map((r) => r.getValue(c.id))}
                onPickValue={(v) => {
                  const f = filterForValue(v, col.type, false)
                  if (f) c.setFilterValue(f)
                }}
              />
            )}
          </Popover>
        )}
      </div>
      {c.getCanResize() && (
        <div
          onMouseDown={h.getResizeHandler()}
          onTouchStart={h.getResizeHandler()}
          onDoubleClick={() => c.resetSize()}
          role="separator"
          aria-label={`Resize ${c.id}`}
          className={cn('absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-accent/60', c.getIsResizing() && 'bg-accent')}
        />
      )}
    </>
  )
}

type Props = {
  table: Table<Row>
  cols: Map<string, Col>
  query: string
  inspectedId: number | null
  onInspect: (id: number) => void
  onOpenCell: OpenCell
  onCellMenu: CellMenu
  onCellAlt: (value: unknown, colKey: string) => void
  density: Density
}

export function DataTable({ table, cols, query, inspectedId, onInspect, onOpenCell, onCellMenu, onCellAlt, density }: Props) {
  const q = query.trim()
  const filters = table.getState().columnFilters
  const filterFor = (id: string) => filters.find((f) => f.id === id)?.value as FilterValue | undefined
  const rows = table.getRowModel().rows

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-surface" role="region" aria-label="Data table" tabIndex={-1}>
      <table className="border-separate border-spacing-0 text-[12.5px]" style={{ width: table.getTotalSize(), tableLayout: 'fixed' }}>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const isSel = h.column.id === '__select'
                const isIdx = h.column.id === '__row'
                return (
                  <th
                    key={h.id}
                    scope="col"
                    style={{ width: h.getSize(), left: isSel ? 0 : isIdx ? 36 : undefined }}
                    className={cn(
                      'group/th relative sticky top-0 h-8 border-r border-b border-line bg-sunken text-left text-ink',
                      (isSel || isIdx) && 'left-0 z-30',
                      !isSel && !isIdx && 'z-20',
                    )}
                  >
                    {isSel ? (
                      <div className="flex h-full items-center justify-center">
                        <input
                          type="checkbox"
                          aria-label="Select all rows on this page"
                          className="accent-[var(--c-accent)]"
                          checked={table.getIsAllPageRowsSelected()}
                          ref={(el) => {
                            if (el) el.indeterminate = table.getIsSomePageRowsSelected()
                          }}
                          onChange={table.getToggleAllPageRowsSelectedHandler()}
                        />
                      </div>
                    ) : isIdx ? (
                      <div className="px-2 text-center font-mono text-[11px] text-muted">#</div>
                    ) : (
                      <HeaderCell h={h} filter={filterFor(h.column.id)} col={cols.get(h.column.id)} />
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.map((row) => {
            const inspected = inspectedId === row.original.i
            const selected = row.getIsSelected()
            const bg = inspected ? 'bg-accent-soft' : selected ? 'bg-accent-soft/50' : 'bg-surface'
            return (
              <tr
                key={row.id}
                tabIndex={0}
                aria-selected={inspected}
                onClick={() => onInspect(row.original.i)}
                onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onInspect(row.original.i)}
                className="group/row cursor-pointer"
              >
                {row.getVisibleCells().map((cell) => {
                  const id = cell.column.id
                  const isSel = id === '__select'
                  const isIdx = id === '__row'
                  const col = cols.get(id)
                  return (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize(), left: isSel ? 0 : isIdx ? 36 : undefined }}
                      onContextMenu={
                        isSel || isIdx
                          ? undefined
                          : (e) => {
                              e.preventDefault()
                              onCellMenu(e.clientX, e.clientY, cell.getValue(), id, row.original.i)
                            }
                      }
                      onClickCapture={
                        isSel || isIdx
                          ? undefined
                          : (e) => {
                              if (e.altKey) {
                                e.stopPropagation()
                                e.preventDefault()
                                onCellAlt(cell.getValue(), id)
                              }
                            }
                      }
                      className={cn(
                        DENSITY_H[density],
                        'overflow-hidden border-r border-b border-line px-2 whitespace-nowrap group-hover/row:bg-sunken',
                        bg,
                        (isSel || isIdx) && 'sticky z-10',
                        isSel && 'px-0',
                        col?.type === 'number' && 'text-right',
                      )}
                    >
                      {isSel ? (
                        <div className="flex h-full items-center justify-center" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" aria-label={`Select row ${row.original.i + 1}`} className="accent-[var(--c-accent)]" checked={selected} onChange={row.getToggleSelectedHandler()} />
                        </div>
                      ) : isIdx ? (
                        <span className="block text-center font-mono text-[11px] text-muted">{row.original.i + 1}</span>
                      ) : (
                        <Cell value={cell.getValue()} q={q} onOpen={onOpenCell} colKey={id} rowIndex={row.original.i} />
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
