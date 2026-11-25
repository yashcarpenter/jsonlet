import { memo, useEffect, useState, type ReactNode } from 'react'
import { ChevronRight, Copy, Table2 } from 'lucide-react'
import { copyText, cn } from '../lib/util'
import { isPlainObject, typeOf } from '../lib/json'

export type ExpandSignal = { n: number; mode: 'expand' | 'collapse' | null }

const CHUNK = 100

function Primitive({ v }: { v: unknown }) {
  const t = typeOf(v)
  if (t === 'string') return <span className="break-all text-tok-str">"{v as string}"</span>
  if (t === 'number') return <span className="text-tok-num">{String(v)}</span>
  if (t === 'boolean') return <span className="text-tok-bool">{String(v)}</span>
  return <span className="text-tok-null italic">null</span>
}

type NodeProps = {
  k: string | number | null
  v: unknown
  depth: number
  signal: ExpandSignal
  defaultDepth: number
  onOpenTable?: (label: string, v: unknown) => void
  path: string
}

const Node = memo(function Node({ k, v, depth, signal, defaultDepth, onOpenTable, path }: NodeProps) {
  const isArr = Array.isArray(v)
  const isObj = isPlainObject(v)
  const branch = isArr || isObj
  const [open, setOpen] = useState(depth < defaultDepth)
  const [shown, setShown] = useState(CHUNK)

  useEffect(() => {
    if (signal.mode === 'expand') setOpen(true)
    else if (signal.mode === 'collapse') setOpen(depth === 0 ? true : false)
  }, [signal, depth])

  const entries: [string | number, unknown][] = isArr ? (v as unknown[]).map((x, i) => [i, x]) : isObj ? Object.entries(v as object) : []
  const count = entries.length
  const canTable = onOpenTable && isArr && count > 0

  const keyEl: ReactNode =
    k === null ? null : (
      <>
        <span className={cn(typeof k === 'number' ? 'text-muted' : 'text-tok-key')}>{typeof k === 'number' ? k : `"${k}"`}</span>
        <span className="text-muted">: </span>
      </>
    )

  return (
    <div>
      <div className="group flex min-h-[22px] items-start gap-0.5 rounded px-1 hover:bg-sunken" style={{ paddingLeft: depth * 14 + 4 }}>
        {branch && count > 0 ? (
          <button onClick={() => setOpen(!open)} aria-label={open ? 'Collapse' : 'Expand'} aria-expanded={open} className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted hover:text-ink">
            <ChevronRight size={12} className={cn('transition-transform', open && 'rotate-90')} />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <div className="min-w-0 flex-1 leading-[22px]">
          {keyEl}
          {branch ? (
            <span className="text-muted">
              {isArr ? '[' : '{'}
              {(!open || count === 0) && (
                <>
                  {count > 0 && (
                    <button onClick={() => setOpen(true)} className="mx-1 rounded bg-sunken px-1 text-[11px] hover:text-ink">
                      {count} {isArr ? (count === 1 ? 'item' : 'items') : count === 1 ? 'key' : 'keys'}
                    </button>
                  )}
                  {isArr ? ']' : '}'}
                </>
              )}
            </span>
          ) : (
            <Primitive v={v} />
          )}
        </div>
        <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {canTable && (
            <button title="Open as table" aria-label="Open as table" onClick={() => onOpenTable!(path, v)} className="rounded p-1 text-muted hover:bg-line hover:text-ink">
              <Table2 size={12} />
            </button>
          )}
          <button
            title="Copy value"
            aria-label="Copy value"
            onClick={() => copyText(branch ? JSON.stringify(v, null, 2) : typeof v === 'string' ? v : String(v), 'Value copied')}
            className="rounded p-1 text-muted hover:bg-line hover:text-ink"
          >
            <Copy size={12} />
          </button>
        </span>
      </div>
      {branch && open && count > 0 && (
        <>
          {entries.slice(0, shown).map(([ck, cv]) => (
            <Node key={ck} k={ck} v={cv} depth={depth + 1} signal={signal} defaultDepth={defaultDepth} onOpenTable={onOpenTable} path={`${path}${typeof ck === 'number' ? `[${ck}]` : `.${ck}`}`} />
          ))}
          {count > shown && (
            <button onClick={() => setShown(shown + CHUNK)} className="ml-8 my-0.5 rounded px-1.5 py-0.5 text-[11px] text-accent hover:bg-accent-soft" style={{ marginLeft: (depth + 1) * 14 + 22 }}>
              Show {Math.min(CHUNK, count - shown)} more of {count - shown} remaining
            </button>
          )}
          <div className="leading-[20px] text-muted" style={{ paddingLeft: depth * 14 + 4 + 18 }}>
            {isArr ? ']' : '}'}
          </div>
        </>
      )}
    </div>
  )
})

export function JsonTreeView({ value, signal, defaultDepth = 1, rootLabel = '$', onOpenTable }: { value: unknown; signal: ExpandSignal; defaultDepth?: number; rootLabel?: string; onOpenTable?: (label: string, v: unknown) => void }) {
  return (
    <div className="font-mono text-[12px]">
      <Node k={null} v={value} depth={0} signal={signal} defaultDepth={defaultDepth} onOpenTable={onOpenTable} path={rootLabel} />
    </div>
  )
}

/* ---------- Highlighted raw JSON ---------- */
const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

export const JsonCode = memo(function JsonCode({ text }: { text: string }) {
  const out: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  TOKEN.lastIndex = 0
  while ((m = TOKEN.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const cls = m[1] ? (m[2] ? 'text-tok-key' : 'text-tok-str') : m[3] ? 'text-tok-bool' : m[0] === 'null' ? 'text-tok-null italic' : 'text-tok-num'
    out.push(
      <span key={m.index} className={cls}>
        {m[1] && m[2] ? m[1] : m[0]}
      </span>,
    )
    if (m[1] && m[2]) out.push(m[2])
    last = m.index + m[0].length
  }
  out.push(text.slice(last))
  return <pre className="font-mono text-[12px] leading-[1.6] break-words whitespace-pre-wrap text-ink">{out}</pre>
})
