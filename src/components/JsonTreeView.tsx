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
  segs: (string | number)[]
  onKeyClick?: (segs: (string | number)[]) => void
}

const Node = memo(function Node({ k, v, depth, signal, defaultDepth, onOpenTable, path, segs, onKeyClick }: NodeProps) {
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
        {onKeyClick ? (
          <button onClick={() => onKeyClick(segs)} title="Show in the editor" className={cn('rounded hover:bg-accent-soft hover:underline', typeof k === 'number' ? 'text-muted' : 'text-tok-key')}>
            {typeof k === 'number' ? k : `"${k}"`}
          </button>
        ) : (
          <span className={cn(typeof k === 'number' ? 'text-muted' : 'text-tok-key')}>{typeof k === 'number' ? k : `"${k}"`}</span>
        )}
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
            <button title="Open as table (Cmd/Ctrl+click: new tab)" aria-label="Open as table" onClick={() => onOpenTable!(path, v)} className="rounded p-1 text-muted hover:bg-line hover:text-ink">
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
            <Node key={ck} k={ck} v={cv} depth={depth + 1} signal={signal} defaultDepth={defaultDepth} onOpenTable={onOpenTable} path={`${path}${typeof ck === 'number' ? `[${ck}]` : `.${ck}`}`} segs={[...segs, ck]} onKeyClick={onKeyClick} />
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

export function JsonTreeView({ value, signal, defaultDepth = 1, rootLabel = '$', onOpenTable, onKeyClick }: { value: unknown; signal: ExpandSignal; defaultDepth?: number; rootLabel?: string; onOpenTable?: (label: string, v: unknown) => void; onKeyClick?: (segs: (string | number)[]) => void }) {
  return (
    <div className="font-mono text-[12px]">
      <Node k={null} v={value} depth={0} signal={signal} defaultDepth={defaultDepth} onOpenTable={onOpenTable} path={rootLabel} segs={[]} onKeyClick={onKeyClick} />
    </div>
  )
}

/* ---------- Highlighted raw JSON (keys are clickable) ---------- */
type Container = { t: 'o'; key: string } | { t: 'a'; idx: number }

export const JsonCode = memo(function JsonCode({ text, onKeyClick }: { text: string; onKeyClick?: (segs: (string | number)[]) => void }) {
  const out: ReactNode[] = []
  const stack: Container[] = []
  let plain = ''
  const flush = () => {
    if (plain) out.push(plain)
    plain = ''
  }
  const segsOf = (upTo: number) => stack.slice(0, upTo).map((c) => (c.t === 'o' ? c.key : c.idx))
  let i = 0
  const n = text.length
  while (i < n) {
    const c = text[i]
    if (c === '"') {
      let j = i + 1
      while (j < n && text[j] !== '"') j += text[j] === '\\' ? 2 : 1
      const raw = text.slice(i, j + 1)
      let k = j + 1
      while (k < n && /\s/.test(text[k])) k++
      const top = stack[stack.length - 1]
      if (text[k] === ':' && top?.t === 'o') {
        let key = raw.slice(1, -1)
        try {
          key = JSON.parse(raw) as string
        } catch {
          /* keep raw */
        }
        top.key = key
        flush()
        const segs = segsOf(stack.length)
        out.push(
          onKeyClick ? (
            <button key={i} onClick={() => onKeyClick(segs)} title="Show in the editor" className="rounded text-tok-key hover:bg-accent-soft hover:underline">
              {raw}
            </button>
          ) : (
            <span key={i} className="text-tok-key">
              {raw}
            </span>
          ),
        )
      } else {
        flush()
        out.push(
          <span key={i} className="text-tok-str">
            {raw}
          </span>,
        )
      }
      i = j + 1
      continue
    }
    if (c === '{') stack.push({ t: 'o', key: '' })
    else if (c === '[') stack.push({ t: 'a', idx: 0 })
    else if (c === '}' || c === ']') stack.pop()
    else if (c === ',') {
      const top = stack[stack.length - 1]
      if (top?.t === 'a') top.idx++
    } else if (/[-\d]/.test(c)) {
      const m = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i, i + 40))
      if (m) {
        flush()
        out.push(
          <span key={i} className="text-tok-num">
            {m[0]}
          </span>,
        )
        i += m[0].length
        continue
      }
    } else if (c === 't' || c === 'f' || c === 'n') {
      const m = /^(true|false|null)/.exec(text.slice(i, i + 5))
      if (m) {
        flush()
        out.push(
          <span key={i} className={m[0] === 'null' ? 'text-tok-null italic' : 'text-tok-bool'}>
            {m[0]}
          </span>,
        )
        i += m[0].length
        continue
      }
    }
    plain += c
    i++
  }
  flush()
  return <pre className="font-mono text-[12px] leading-[1.6] break-words whitespace-pre-wrap text-ink">{out}</pre>
})
