import { useDeferredValue, useEffect, useMemo, useState, type MutableRefObject } from 'react'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Copy, Filter as FilterIcon, FilterX, PanelRight, SearchX, Table2 } from 'lucide-react'
import { DataTable, type CellMenu, type Density, type OpenCell } from './DataTable'
import { TableToolbar } from './TableToolbar'
import { Button, FloatingPanel, IconButton } from './ui'
import { JsonTreeView } from './JsonTreeView'
import { compareValues, filterForValue, isFilterReady, matchesFilter, type FilterValue } from '../lib/filters'
import { toMarkdown, toTypeScript } from '../lib/convert'
import { cellText, isPlainObject, type Col, type Row, type TableModel } from '../lib/json'
import { copyText, download, toCsv, toast } from '../lib/util'

export type WorkspaceApi = { copySelected: () => void }

type Props = {
  model: TableModel
  fileBase: string
  flatten: boolean
  onFlatten: (v: boolean) => void
  inspectedId: number | null
  onInspect: (id: number | null) => void
  onOpenNested: (label: string, value: unknown) => void
  datasetLabel: string
  apiRef: MutableRefObject<WorkspaceApi | null>
}

const PAGE_SIZES = [10, 25, 50, 100]

export function TableWorkspace({ model, fileBase, flatten, onFlatten, inspectedId, onInspect, onOpenNested, datasetLabel, apiRef }: Props) {
  const [query, setQuery] = useState('')
  const dq = useDeferredValue(query)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 })
  const [cell, setCell] = useState<{ rect: DOMRect; value: unknown; colKey: string; row: number } | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; value: unknown; colKey: string; row: number } | null>(null)
  const [density, setDensity] = useState<Density>(() => {
    const v = localStorage.getItem('jx-density')
    return v === 'compact' || v === 'spacious' ? v : 'comfortable'
  })
  const cycleDensity = () => {
    const next: Density = density === 'comfortable' ? 'compact' : density === 'compact' ? 'spacious' : 'comfortable'
    setDensity(next)
    try {
      localStorage.setItem('jx-density', next)
    } catch {
      /* ignore */
    }
  }

  const colMap = useMemo(() => new Map(model.cols.map((c) => [c.key, c])), [model])

  /* Global search runs before the table so it only scans visible columns and drives highlighting. */
  const visibleKeys = useMemo(() => model.cols.filter((c) => columnVisibility[c.key] !== false).map((c) => c.key), [model, columnVisibility])
  const searched = useMemo(() => {
    const q = dq.trim().toLowerCase()
    if (!q) return model.rows
    return model.rows.filter((r) => visibleKeys.some((k) => cellText(r.flat[k]).toLowerCase().includes(q)))
  }, [model, dq, visibleKeys])

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      { id: '__select', size: 36, enableResizing: false, enableSorting: false, enableHiding: false },
      { id: '__row', size: 52, enableResizing: false, enableSorting: false, enableHiding: false },
      ...model.cols.map(
        (c: Col): ColumnDef<Row> => ({
          id: c.key,
          header: c.key,
          accessorFn: (r) => r.flat[c.key],
          size: c.width,
          minSize: 70,
          maxSize: 900,
          sortDescFirst: false,
          sortingFn: (a, b, id) => compareValues(a.getValue(id), b.getValue(id)),
          filterFn: (row, id, fv: FilterValue) => !isFilterReady(fv, c.type) || matchesFilter(row.getValue(id), fv, c.type),
        }),
      ),
    ],
    [model],
  )

  const table = useReactTable({
    data: searched,
    columns,
    state: { sorting, columnFilters, columnVisibility, rowSelection, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getRowId: (r) => String(r.i),
    columnResizeMode: 'onChange',
    enableMultiSort: true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const filteredRows = table.getPrePaginationRowModel().rows
  const filteredCount = filteredRows.length
  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k])
  const filterMap: Record<string, FilterValue> = Object.fromEntries(columnFilters.map((f) => [f.id, f.value as FilterValue]))
  const activeFilterCount = columnFilters.filter((f) => colMap.get(f.id) && isFilterReady(f.value as FilterValue, colMap.get(f.id)!.type)).length
  const hiddenMap = Object.fromEntries(Object.entries(columnVisibility).filter(([, v]) => v === false).map(([k]) => [k, true]))

  /* ---- exports ---- */
  const exportRows = (selectedOnly: boolean): Row[] => {
    const rows = filteredRows.map((r) => r.original)
    return selectedOnly ? model.rows.filter((r) => rowSelection[String(r.i)]) : rows
  }
  const keysForExport = () => model.cols.filter((c) => columnVisibility[c.key] !== false).map((c) => c.key)
  const jsonOf = (rows: Row[], minify: boolean) => JSON.stringify(rows.map((r) => r.orig), null, minify ? undefined : 2)

  const doCsv = (sel: boolean) => {
    const rows = exportRows(sel)
    download(`${fileBase}${sel ? '-selected' : '-filtered'}.csv`, toCsv(keysForExport(), rows.map((r) => r.flat)), 'text/csv;charset=utf-8')
    toast(`Exported ${rows.length.toLocaleString()} rows as CSV`)
  }
  const doJson = (sel: boolean, minify: boolean) => {
    const rows = exportRows(sel)
    download(`${fileBase}${sel ? '-selected' : '-filtered'}.json`, jsonOf(rows, minify), 'application/json')
    toast(`Exported ${rows.length.toLocaleString()} records as JSON`)
  }
  const doCopy = (sel: boolean, minify: boolean) => {
    const rows = exportRows(sel)
    copyText(jsonOf(rows, minify), `Copied ${rows.length.toLocaleString()} records`)
  }

  const setFilter = (key: string, v: FilterValue | undefined) => setColumnFilters((fs) => [...fs.filter((f) => f.id !== key), ...(v ? [{ id: key, value: v }] : [])])
  const filterByValue = (value: unknown, colKey: string, exclude: boolean) => {
    const col = colMap.get(colKey)
    const f = col ? filterForValue(value, col.type, exclude) : null
    if (!f) return toast(exclude ? 'Cannot exclude this kind of value' : 'Objects and arrays cannot be used as a filter', 'info')
    setFilter(colKey, f)
    toast(`${exclude ? 'Excluding' : 'Filtering'} ${colKey}`, 'info')
  }
  const doMarkdown = () => {
    const rows = exportRows(false)
    copyText(toMarkdown(keysForExport(), rows.map((r) => r.flat)), `Copied Markdown table (${Math.min(rows.length, 1000).toLocaleString()} rows)`)
  }
  const doTs = () => copyText(toTypeScript(model.rows.map((r) => r.orig)), 'TypeScript interfaces copied')

  useEffect(() => {
    apiRef.current = {
      copySelected: () => {
        if (selectedIds.length) doCopy(true, false)
        else if (inspectedId !== null) copyText(JSON.stringify(model.rows[inspectedId]?.orig, null, 2), 'Record copied')
        else toast('Select rows or open a record first', 'info')
      },
    }
    return () => {
      apiRef.current = null
    }
  })

  const clearFilters = () => {
    setQuery('')
    setColumnFilters([])
  }

  const onCellMenu: CellMenu = (x, y, value, colKey, row) => setMenu({ x, y, value, colKey, row })
  const onOpenCell: OpenCell = (rect, value, colKey, row) => setCell({ rect, value, colKey, row })

  const page = pagination.pageIndex
  const size = pagination.pageSize
  const pageCount = Math.max(1, table.getPageCount())
  const from = filteredCount === 0 ? 0 : page * size + 1
  const to = Math.min(filteredCount, (page + 1) * size)
  const noResults = filteredCount === 0 && model.rows.length > 0

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TableToolbar
        query={query}
        onQuery={setQuery}
        matches={dq === query ? searched.length : null}
        cols={model.cols}
        filters={filterMap}
        onSetFilter={setFilter}
        density={density}
        onCycleDensity={cycleDensity}
        sorts={sorting}
        onRemoveSort={(id) => setSorting((s) => s.filter((x) => x.id !== id))}
        onClearSorts={() => setSorting([])}
        onClearFilters={clearFilters}
        columnManager={{
          cols: model.cols,
          hidden: hiddenMap,
          onToggle: (k, v) => setColumnVisibility((s) => ({ ...s, [k]: v })),
          onSetAll: (v) => setColumnVisibility(Object.fromEntries(model.cols.map((c) => [c.key, v]))),
          onRestore: () => {
            setColumnVisibility({})
            table.resetColumnSizing()
            toast('Default columns restored', 'info')
          },
          flatten,
          onFlatten,
        }}
        exportMenu={{ filteredCount, selectedCount: selectedIds.length, onCsv: doCsv, onJson: doJson, onCopy: doCopy, onMarkdown: doMarkdown, onTypeScript: doTs }}
      />

      {model.notes.length > 0 && (
        <details className="group border-b border-line bg-accent-soft/40 px-3 py-1 text-[12px] text-muted sm:px-4">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 hover:text-ink">
            <Table2 size={12} className="text-accent" />
            <span>{model.notes[0]}</span>
            {model.notes.length > 1 && <span className="rounded bg-line px-1 text-[10.5px]">+{model.notes.length - 1}</span>}
          </summary>
          <ul className="mt-1 mb-1 ml-5 list-disc space-y-0.5">
            {model.notes.slice(1).map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      )}

      {noResults ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-surface p-8 text-center">
          <SearchX size={28} className="text-muted" />
          <h3 className="text-[14px] font-semibold">No records match</h3>
          <p className="max-w-sm text-muted">Nothing in {model.rows.length.toLocaleString()} records matches the current search and filters.</p>
          <Button onClick={clearFilters}>Clear filters</Button>
        </div>
      ) : (
        <DataTable table={table} cols={colMap} query={dq} inspectedId={inspectedId} onInspect={(id) => onInspect(inspectedId === id ? null : id)} onOpenCell={onOpenCell} onCellMenu={onCellMenu} onCellAlt={(v, k) => filterByValue(v, k, false)} density={density} />
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface px-3 py-1.5 text-[12px] text-muted sm:px-4">
        <span>
          Showing <b className="font-medium text-ink">{from.toLocaleString()}–{to.toLocaleString()}</b> of <b className="font-medium text-ink">{filteredCount.toLocaleString()}</b>
          {filteredCount !== model.rows.length && <> (filtered from {model.rows.length.toLocaleString()})</>}
        </span>
        {selectedIds.length > 0 && (
          <span className="flex items-center gap-1.5 text-accent">
            {selectedIds.length.toLocaleString()} selected
            <button className="underline-offset-2 hover:underline" onClick={() => setRowSelection({})}>
              clear
            </button>
          </span>
        )}
        {table.getIsAllPageRowsSelected() && filteredCount > table.getRowModel().rows.length && selectedIds.length < filteredCount && (
          <button className="text-accent hover:underline" onClick={() => setRowSelection(Object.fromEntries(filteredRows.map((r) => [r.id, true])))}>
            Select all {filteredCount.toLocaleString()} filtered rows
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <label className="mr-2 flex items-center gap-1.5">
            Rows
            <select
              value={size}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
              className="h-6 rounded border border-line bg-bg px-1 text-ink outline-none focus:border-accent/60"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <IconButton label="First page" onClick={() => table.setPageIndex(0)} disabled={page === 0}>
            <ChevronsLeft size={14} />
          </IconButton>
          <IconButton label="Previous page" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft size={14} />
          </IconButton>
          <span className="min-w-20 text-center tabular-nums">
            Page {page + 1} / {pageCount}
          </span>
          <IconButton label="Next page" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            <ChevronRight size={14} />
          </IconButton>
          <IconButton label="Last page" onClick={() => table.setPageIndex(pageCount - 1)} disabled={page >= pageCount - 1}>
            <ChevronsRight size={14} />
          </IconButton>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        {activeFilterCount} active filters, {filteredCount} rows
      </span>

      {menu && (
        <FloatingPanel rect={new DOMRect(menu.x, menu.y - 6, 1, 1)} onClose={() => setMenu(null)} width={236}>
          {(() => {
            const m = menu
            const col = colMap.get(m.colKey)
            const canFilter = !!col && filterForValue(m.value, col.type, false) !== null
            const canExclude = !!col && filterForValue(m.value, col.type, true) !== null
            const isNested = Array.isArray(m.value) || isPlainObject(m.value)
            const Item = ({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) => (
              <button
                disabled={disabled}
                onClick={() => {
                  setMenu(null)
                  onClick()
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left hover:bg-sunken disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <span className="text-muted">{icon}</span>
                {label}
              </button>
            )
            const rowObj = model.rows[m.row]
            return (
              <div className="p-1">
                <div className="truncate px-2.5 pt-1 pb-1.5 font-mono text-[11px] text-muted">
                  {m.colKey} · row {m.row + 1}
                </div>
                <Item icon={<Copy size={13} />} label="Copy cell value" onClick={() => copyText(m.value === undefined ? '' : typeof m.value === 'string' ? m.value : JSON.stringify(m.value, null, 2), 'Cell copied')} />
                <Item icon={<Copy size={13} />} label="Copy row as JSON" onClick={() => copyText(JSON.stringify(rowObj?.orig, null, 2), 'Row copied')} />
                <div className="my-1 h-px bg-line" />
                <Item icon={<FilterIcon size={13} />} label="Filter by this value" disabled={!canFilter} onClick={() => filterByValue(m.value, m.colKey, false)} />
                <Item icon={<FilterX size={13} />} label="Exclude this value" disabled={!canExclude} onClick={() => filterByValue(m.value, m.colKey, true)} />
                <div className="my-1 h-px bg-line" />
                <Item icon={<PanelRight size={13} />} label="Open in inspector" onClick={() => onInspect(m.row)} />
                {isNested && <Item icon={<Table2 size={13} />} label="Open as table" onClick={() => onOpenNested(`${datasetLabel}[${m.row}].${m.colKey}`, m.value)} />}
                <div className="px-2.5 pt-1.5 pb-1 text-[10.5px] text-muted">Tip: Alt+click a cell to filter by it.</div>
              </div>
            )
          })()}
        </FloatingPanel>
      )}

      {cell && (
        <FloatingPanel rect={cell.rect} onClose={() => setCell(null)} width={380}>
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] font-semibold">
              {cell.colKey} <span className="font-normal text-muted">· row {cell.row + 1}</span>
            </span>
            <IconButton label="Copy value" onClick={() => copyText(typeof cell.value === 'string' ? cell.value : JSON.stringify(cell.value, null, 2), 'Value copied')}>
              <Copy size={13} />
            </IconButton>
          </div>
          <div className="max-h-[50vh] overflow-auto p-2">
            {typeof cell.value === 'object' && cell.value !== null ? (
              <JsonTreeView value={cell.value} signal={{ n: 0, mode: null }} defaultDepth={2} rootLabel={cell.colKey} onOpenTable={(l, v) => { setCell(null); onOpenNested(`${datasetLabel}[${cell.row}].${l}`, v) }} />
            ) : (
              <pre className="p-1 font-mono text-[12px] leading-relaxed break-words whitespace-pre-wrap">{String(cell.value)}</pre>
            )}
          </div>
          {(Array.isArray(cell.value) || isPlainObject(cell.value)) && (
            <div className="flex justify-end border-t border-line p-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  onOpenNested(`${datasetLabel}[${cell.row}].${cell.colKey}`, cell.value)
                  setCell(null)
                }}
              >
                <Table2 size={13} /> Open as table
              </Button>
            </div>
          )}
        </FloatingPanel>
      )}
    </div>
  )
}
