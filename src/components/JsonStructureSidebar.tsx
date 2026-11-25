import { useMemo, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { cn } from '../lib/util'
import { pathLabel, typeLabel, type SchemaNode } from '../lib/json'

type Props = { schema: SchemaNode; activeKey: string; onSelect: (n: SchemaNode) => void }

export const pathKey = (p: (string | number)[]) => JSON.stringify(p)

const typeText = (n: SchemaNode) => [...n.types].filter((t) => t !== 'null').map(typeLabel).join(' | ') || 'Null'

function matches(n: SchemaNode, q: string): boolean {
  if (n.key.toLowerCase().includes(q)) return true
  for (const c of n.children.values()) if (matches(c, q)) return true
  return false
}

function Row({ node, depth, activeKey, onSelect, q }: { node: SchemaNode; depth: number; activeKey: string; onSelect: (n: SchemaNode) => void; q: string }) {
  const [open, setOpen] = useState(depth < 1)
  const kids = useMemo(() => [...node.children.values()].filter((c) => !q || matches(c, q)), [node, q])
  const expanded = q ? true : open
  const active = pathKey(node.path) === activeKey
  const nullable = node.types.has('null')
  return (
    <li>
      <div
        className={cn('group flex h-7 cursor-pointer items-center gap-1 rounded-md pr-1.5 hover:bg-sunken', active && 'bg-accent-soft text-accent hover:bg-accent-soft')}
        style={{ paddingLeft: depth * 12 + 4 }}
        onClick={() => onSelect(node)}
        role="treeitem"
        aria-selected={active}
        aria-expanded={kids.length ? expanded : undefined}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSelect(node)
          if (e.key === 'ArrowRight') setOpen(true)
          if (e.key === 'ArrowLeft') setOpen(false)
        }}
      >
        {kids.length ? (
          <button
            aria-label={expanded ? 'Collapse' : 'Expand'}
            onClick={(e) => {
              e.stopPropagation()
              setOpen(!open)
            }}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted hover:text-ink"
          >
            <ChevronRight size={12} className={cn('transition-transform', expanded && 'rotate-90')} />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span className="truncate font-mono text-[12px]">{node.key}</span>
        <span className="ml-auto shrink-0 pl-2 text-[10.5px] text-muted">
          {typeText(node)}
          {nullable && node.types.size > 1 ? '?' : ''}
        </span>
      </div>
      {kids.length > 0 && expanded && (
        <ul role="group">
          {kids.map((c) => (
            <Row key={c.key} node={c} depth={depth + 1} activeKey={activeKey} onSelect={onSelect} q={q} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function JsonStructureSidebar({ schema, activeKey, onSelect }: Props) {
  const [q, setQ] = useState('')
  return (
    <aside className="flex h-full w-full flex-col bg-surface" aria-label="JSON structure">
      <div className="border-b border-line p-2">
        <label className="flex h-7 items-center gap-1.5 rounded-md border border-line bg-bg px-2 text-muted focus-within:border-accent/60">
          <Search size={13} />
          <input value={q} onChange={(e) => setQ(e.target.value.toLowerCase())} placeholder="Find a field" className="w-full bg-transparent text-[12px] text-ink outline-none placeholder:text-muted" aria-label="Find a field" />
        </label>
      </div>
      <ul role="tree" className="min-h-0 flex-1 overflow-y-auto p-1.5">
        <Row node={schema} depth={0} activeKey={activeKey} onSelect={onSelect} q={q} />
      </ul>
      <p className="border-t border-line px-3 py-2 text-[11px] leading-snug text-muted">
        Select any node to open it as a table. Fields inside arrays ({pathLabel(['a', '*', 'b'])}) combine every item.
      </p>
    </aside>
  )
}
