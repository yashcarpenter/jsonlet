import { Fragment } from 'react'
import { flexRender, type Header, type Table } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, Braces, Brackets, Calendar, ChevronRight, ChevronsUpDown, Filter, Hash, Shuffle, ToggleLeft, Type } from 'lucide-react'
import { Cell, type OpenCell } from './Cells'
import { Anchored, NestedSection } from './NestedData'
import { Popover } from './ui'
import { ColumnFilter } from './ColumnFilter'
import { cn } from '../lib/util'
import { filterForValue, isFilterReady, type FilterValue } from '../lib/filters'
import type { Col, ColType, Row } from '../lib/json'

export type { OpenCell }
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
  isInspected: (row: Row) => boolean
  onInspect: (row: Row) => void
  /** Used for sub-tables nested inside another table: limits the height and lets the page scroll horizontally. */
  compact?: boolean
  onOpenCell: OpenCell
  onCellMenu: CellMenu
  onCellAlt: (value: unknown, colKey: string) => void
  density: Density
  expanded: Set<string>
  nestedKeys: (row: Row) => string[]
  onToggleCell: (rowIndex: number, colKey: string) => void
  onToggleRow: (rowIndex: number) => void
  onToggleAll: () => void
  onOpenTable: (label: string, value: unknown) => void
  rowLabel: (rowIndex: number) => string
}

export function DataTable({ table, cols, query, isInspected, onInspect, compact, onOpenCell, onCellMenu, onCellAlt, density, expanded, nestedKeys, onToggleCell, onToggleRow, onToggleAll, onOpenTable, rowLabel }: Props) {
  const q = query.trim()
  const filters = table.getState().columnFilters
  const filterFor = (id: string) => filters.find((f) => f.id === id)?.value as FilterValue | undefined
  const rows = table.getRowModel().rows

  return (
    <div className={compact ? 'max-h-[360px] overflow-auto bg-surface' : 'min-h-0 flex-1 overflow-auto bg-surface'} role="region" aria-label="Data table" tabIndex={-1}>
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
                      <button onClick={onToggleAll} title="Expand or collapse all nested data on this page" aria-label="Expand or collapse all nested data on this page" className="flex h-full w-full items-center justify-center gap-0.5 text-muted hover:text-ink">
                        <ChevronsUpDown size={12} />
                        <span className="font-mono text-[11px]">#</span>
                      </button>
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
            const inspected = isInspected(row.original)
            const selected = row.getIsSelected()
            const bg = inspected ? 'bg-accent-soft' : selected ? 'bg-accent-soft/50' : 'bg-surface'
            const ri = row.original.i
            const nKeys = nestedKeys(row.original)
            const openKeys = nKeys.filter((k) => expanded.has(`${ri}::${k}`))
            return (
              <Fragment key={row.id}>
              <tr
                tabIndex={0}
                aria-selected={inspected}
                onClick={() => onInspect(row.original)}
                onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onInspect(row.original)}
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
                      data-col={id}
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
                        <span className="flex items-center justify-center gap-0.5">
                          {nKeys.length > 0 ? (
                            <button
                              aria-label={openKeys.length ? `Collapse nested data of row ${ri + 1}` : `Expand nested data of row ${ri + 1}`}
                              aria-expanded={openKeys.length > 0}
                              title={openKeys.length ? 'Collapse nested data' : 'Expand nested data'}
                              onClick={(e) => {
                                e.stopPropagation()
                                onToggleRow(ri)
                              }}
                              className="rounded p-0.5 text-muted hover:bg-line hover:text-ink"
                            >
                              <ChevronRight size={13} className={cn('transition-transform', openKeys.length > 0 && 'rotate-90 text-accent')} />
                            </button>
                          ) : (
                            <span className="w-[18px]" />
                          )}
                          <span className="font-mono text-[11px] text-muted">{ri + 1}</span>
                        </span>
                      ) : (
                        <Cell
                          value={cell.getValue()}
                          q={q}
                          onOpen={onOpenCell}
                          colKey={id}
                          rowIndex={ri}
                          expanded={expanded.has(`${ri}::${id}`)}
                          onToggle={typeof cell.getValue() === 'object' && cell.getValue() !== null ? () => onToggleCell(ri, id) : undefined}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
              {openKeys.length > 0 && (
                <tr>
                  <td colSpan={row.getVisibleCells().length} className="border-b border-line bg-sunken/30 p-0">
                    <div className="space-y-3 py-3">
                      {openKeys.map((k) => (
                        <Anchored key={k} colKey={k}>
                          <NestedSection
                            title={k}
                            value={row.original.flat[k]}
                            label={`${rowLabel(ri)}.${k}`}
                            onClose={() => onToggleCell(ri, k)}
                            onOpenCell={onOpenCell}
                            onOpenTable={onOpenTable}
                          />
                        </Anchored>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
