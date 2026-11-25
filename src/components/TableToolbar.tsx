import { useState, type ComponentProps } from 'react'
import { ArrowDown, ArrowUp, FilterX, ListFilter, X } from 'lucide-react'
import { Button, Popover } from './ui'
import { GlobalSearch } from './GlobalSearch'
import { ColumnManager } from './ColumnManager'
import { ColumnFilter } from './ColumnFilter'
import { ExportMenu } from './ExportMenu'
import { describeFilter, isFilterReady, type FilterValue } from '../lib/filters'
import type { Col } from '../lib/json'

type Props = {
  query: string
  onQuery: (v: string) => void
  matches: number | null
  cols: Col[]
  filters: Record<string, FilterValue>
  onSetFilter: (key: string, v: FilterValue | undefined) => void
  sorts: { id: string; desc: boolean }[]
  onRemoveSort: (id: string) => void
  onClearSorts: () => void
  onClearFilters: () => void
  columnManager: ComponentProps<typeof ColumnManager>
  exportMenu: ComponentProps<typeof ExportMenu>
}

function FilterMenu({ cols, filters, onSetFilter }: Pick<Props, 'cols' | 'filters' | 'onSetFilter'>) {
  const [adding, setAdding] = useState<string>('')
  const byKey = new Map(cols.map((c) => [c.key, c]))
  const active = Object.entries(filters).filter(([k, f]) => byKey.has(k) && isFilterReady(f, byKey.get(k)!.type))
  const target = byKey.get(adding)
  return (
    <Popover
      width={300}
      trigger={(p) => (
        <Button size="sm" {...p} className={p.open ? 'bg-sunken' : ''}>
          <ListFilter size={13} /> Filters
          {active.length > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] text-white dark:text-[#0b1020]">{active.length}</span>}
        </Button>
      )}
    >
      {(close) => (
        <div className="max-h-[70vh] overflow-y-auto">
          <div className="p-3">
            <div className="mb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">Add a filter</div>
            <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Column to filter" className="h-8 w-full rounded-md border border-line bg-bg px-2 text-[13px] outline-none focus:border-accent/60">
              <option value="">Choose a column…</option>
              {cols.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.key} ({c.type})
                </option>
              ))}
            </select>
          </div>
          {target && (
            <div className="border-t border-line">
              <ColumnFilter col={target} value={filters[target.key]} onChange={(v) => onSetFilter(target.key, v)} onClose={() => setAdding('')} />
            </div>
          )}
          <div className="border-t border-line p-3">
            <div className="mb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">Active ({active.length})</div>
            {active.length === 0 ? (
              <p className="text-muted">No filters yet. You can also use the funnel icon in any column header.</p>
            ) : (
              <ul className="space-y-1">
                {active.map(([k, f]) => (
                  <li key={k} className="flex items-center gap-2 rounded-md bg-sunken px-2 py-1">
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-mono font-medium">{k}</span> <span className="text-muted">{describeFilter(f, byKey.get(k)!.type)}</span>
                    </span>
                    <button aria-label={`Remove filter on ${k}`} onClick={() => onSetFilter(k, undefined)} className="rounded p-0.5 text-muted hover:text-error">
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex justify-end border-t border-line p-2">
            <Button size="sm" variant="ghost" onClick={close}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Popover>
  )
}

export function TableToolbar(p: Props) {
  const byKey = new Map(p.cols.map((c) => [c.key, c]))
  const active = Object.entries(p.filters).filter(([k, f]) => byKey.has(k) && isFilterReady(f, byKey.get(k)!.type))
  const total = active.length + (p.query ? 1 : 0)

  return (
    <div className="border-b border-line bg-surface px-3 py-2 sm:px-4">
      <div className="flex flex-wrap items-center gap-2">
        <GlobalSearch value={p.query} onChange={p.onQuery} matches={p.matches} />
        <FilterMenu cols={p.cols} filters={p.filters} onSetFilter={p.onSetFilter} />
        <ColumnManager {...p.columnManager} />
        {total > 0 && (
          <Button size="sm" variant="ghost" onClick={p.onClearFilters}>
            <FilterX size={13} /> Clear filters <span className="text-muted">({total})</span>
          </Button>
        )}
        <div className="ml-auto">
          <ExportMenu {...p.exportMenu} />
        </div>
      </div>

      {(active.length > 0 || p.sorts.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Active filters and sorting">
          {active.map(([k, f]) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent-soft py-0.5 pr-1 pl-2 text-[12px] text-accent">
              <span className="font-mono font-medium">{k}</span>
              <span className="opacity-80">{describeFilter(f, byKey.get(k)!.type)}</span>
              <button aria-label={`Remove filter on ${k}`} onClick={() => p.onSetFilter(k, undefined)} className="rounded p-0.5 hover:bg-accent/15">
                <X size={12} />
              </button>
            </span>
          ))}
          {p.sorts.map((s, i) => (
            <span key={s.id} className="inline-flex items-center gap-1 rounded-md border border-line bg-sunken py-0.5 pr-1 pl-2 text-[12px]">
              {s.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
              <span className="font-mono font-medium">{s.id}</span>
              {p.sorts.length > 1 && <span className="text-muted">#{i + 1}</span>}
              <button aria-label={`Remove sort on ${s.id}`} onClick={() => p.onRemoveSort(s.id)} className="rounded p-0.5 text-muted hover:bg-line hover:text-ink">
                <X size={12} />
              </button>
            </span>
          ))}
          {p.sorts.length > 1 && (
            <button onClick={p.onClearSorts} className="text-[12px] text-muted hover:text-ink hover:underline">
              Clear sorting
            </button>
          )}
        </div>
      )}
    </div>
  )
}
