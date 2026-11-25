import { useState } from 'react'
import { Columns3, Search } from 'lucide-react'
import { Button, Popover, Switch } from './ui'
import type { Col } from '../lib/json'

type Props = {
  cols: Col[]
  hidden: Record<string, boolean>
  onToggle: (key: string, visible: boolean) => void
  onSetAll: (visible: boolean) => void
  onRestore: () => void
  flatten: boolean
  onFlatten: (v: boolean) => void
}

export function ColumnManager({ cols, hidden, onToggle, onSetAll, onRestore, flatten, onFlatten }: Props) {
  const [q, setQ] = useState('')
  const hiddenCount = cols.filter((c) => hidden[c.key]).length
  const list = cols.filter((c) => c.key.toLowerCase().includes(q.toLowerCase()))
  return (
    <Popover
      width={280}
      trigger={(p) => (
        <Button size="sm" {...p} className={p.open ? 'bg-sunken' : ''}>
          <Columns3 size={13} /> Columns
          {hiddenCount > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] text-white dark:text-[#0b1020]">{cols.length - hiddenCount}/{cols.length}</span>}
        </Button>
      )}
    >
      {() => (
        <div className="flex max-h-[min(460px,70vh)] flex-col">
          <div className="border-b border-line p-2">
            <label className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-bg px-2 text-muted focus-within:border-accent/60">
              <Search size={13} />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find column" aria-label="Find column" className="w-full bg-transparent text-[13px] text-ink outline-none" />
            </label>
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 text-[12px]">
            <button className="text-accent hover:underline" onClick={() => onSetAll(true)}>Show all</button>
            <button className="text-muted hover:text-ink hover:underline" onClick={() => onSetAll(false)}>Hide all</button>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto px-1 pb-1">
            {list.map((c) => (
              <li key={c.key}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sunken">
                  <input type="checkbox" className="accent-[var(--c-accent)]" checked={!hidden[c.key]} onChange={(e) => onToggle(c.key, e.target.checked)} />
                  <span className="truncate font-mono text-[12px]">{c.key}</span>
                  <span className="ml-auto text-[10.5px] text-muted">{c.type}</span>
                </label>
              </li>
            ))}
            {list.length === 0 && <li className="px-2 py-3 text-center text-muted">No matching columns</li>}
          </ul>
          <div className="space-y-2 border-t border-line p-3">
            <Switch checked={flatten} onChange={onFlatten} label="Flatten nested objects (a.b)" />
            <Button size="sm" variant="secondary" className="w-full" onClick={onRestore}>
              Restore default columns
            </Button>
          </div>
        </div>
      )}
    </Popover>
  )
}
