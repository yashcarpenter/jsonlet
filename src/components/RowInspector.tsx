import { useState } from 'react'
import { ChevronDown, ChevronUp, Copy, ChevronsDownUp, ChevronsUpDown, X } from 'lucide-react'
import { IconButton, Segmented } from './ui'
import { JsonCode, JsonTreeView, type ExpandSignal } from './JsonTreeView'
import { copyText } from '../lib/util'
import { isPlainObject, type Row } from '../lib/json'

type Props = {
  row: Row
  position: number
  total: number
  onClose: () => void
  onPrev: (() => void) | null
  onNext: (() => void) | null
  onOpenNested: (label: string, v: unknown) => void
  datasetLabel: string
}

const idHint = (orig: unknown): string | null => {
  if (!isPlainObject(orig)) return null
  for (const k of ['id', '_id', 'uuid', 'key', 'sku', 'name']) {
    const v = orig[k]
    if (typeof v === 'string' || typeof v === 'number') return `${k}: ${v}`
  }
  return null
}

export function RowInspector({ row, position, total, onClose, onPrev, onNext, onOpenNested, datasetLabel }: Props) {
  const [mode, setMode] = useState<'tree' | 'json'>('tree')
  const [signal, setSignal] = useState<ExpandSignal>({ n: 0, mode: null })
  const hint = idHint(row.orig)
  const text = JSON.stringify(row.orig, null, 2)

  return (
    <>
      <div className="anim-fade fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={onClose} />
      <aside className="anim-right fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-2xl sm:w-[420px] lg:static lg:z-auto lg:w-[400px] lg:shrink-0 lg:shadow-none" aria-label="Row inspector">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[13px] font-semibold">Record #{row.i + 1}</h2>
            <p className="truncate font-mono text-[11px] text-muted">{hint ?? `${position} of ${total.toLocaleString()} in view`}</p>
          </div>
          <IconButton label="Previous record" onClick={onPrev ?? undefined} disabled={!onPrev}>
            <ChevronUp size={15} />
          </IconButton>
          <IconButton label="Next record" onClick={onNext ?? undefined} disabled={!onNext}>
            <ChevronDown size={15} />
          </IconButton>
          <IconButton label="Close inspector" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>
        <div className="flex items-center gap-1 border-b border-line px-3 py-1.5">
          <Segmented value={mode} onChange={setMode} options={[{ id: 'tree', label: 'Tree' }, { id: 'json', label: 'JSON' }]} />
          <div className="ml-auto flex items-center gap-0.5">
            {mode === 'tree' && (
              <>
                <IconButton label="Expand all" onClick={() => setSignal((s) => ({ n: s.n + 1, mode: 'expand' }))}>
                  <ChevronsUpDown size={14} />
                </IconButton>
                <IconButton label="Collapse all" onClick={() => setSignal((s) => ({ n: s.n + 1, mode: 'collapse' }))}>
                  <ChevronsDownUp size={14} />
                </IconButton>
              </>
            )}
            <IconButton label="Copy complete object" onClick={() => copyText(text, 'Record copied')}>
              <Copy size={14} />
            </IconButton>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {mode === 'tree' ? (
            <JsonTreeView key={row.i} value={row.orig} signal={signal} defaultDepth={2} rootLabel={`${datasetLabel}[${row.i}]`} onOpenTable={onOpenNested} />
          ) : (
            <div className="p-1.5">
              <JsonCode text={text} />
            </div>
          )}
        </div>
        <p className="border-t border-line px-3 py-1.5 text-[11px] text-muted">Hover a value to copy it. Arrays can be opened as their own table.</p>
      </aside>
    </>
  )
}
