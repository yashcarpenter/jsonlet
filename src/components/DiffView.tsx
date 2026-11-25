import { useDeferredValue, useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { ArrowLeftRight, CheckCircle2, ClipboardPaste, Copy, FileInput, Search, Wand2, X } from 'lucide-react'
import { Button, IconButton } from './ui'
import { diffJson, type DiffEntry, type DiffKind } from '../lib/diff'
import { parseJson } from '../lib/json'
import { cn, copyText, toast } from '../lib/util'

export type DiffState = { a: string; b: string }
type Props = { state: DiffState; onChange: (s: DiffState) => void; currentText: string | null; dark: boolean }

const KIND: Record<DiffKind, { label: string; sign: string; cls: string }> = {
  added: { label: 'Added', sign: '+', cls: 'bg-success/10 text-success' },
  removed: { label: 'Removed', sign: '−', cls: 'bg-error/10 text-error' },
  changed: { label: 'Changed', sign: '~', cls: 'bg-warn/15 text-warn' },
}

const short = (v: unknown) => {
  const t = v === undefined ? '' : JSON.stringify(v)
  return t.length > 140 ? t.slice(0, 137) + '…' : t
}

function Side({ title, value, onChange, dark, currentText }: { title: string; value: string; onChange: (v: string) => void; dark: boolean; currentText: string | null }) {
  const dv = useDeferredValue(value)
  const res = useMemo(() => (dv.trim() ? parseJson(dv) : null), [dv])
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-sunken/60 px-2 py-1.5">
        <span className="mr-1 ml-1 text-[12px] font-semibold">{title}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            try {
              onChange(await navigator.clipboard.readText())
            } catch {
              toast('Clipboard access was blocked. Paste into the editor instead.', 'err')
            }
          }}
        >
          <ClipboardPaste size={13} /> Paste
        </Button>
        {currentText && (
          <Button size="sm" variant="ghost" onClick={() => onChange(currentText)} title="Use the document currently open in the table view">
            <FileInput size={13} /> Use current
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={!res?.ok}
          onClick={() => res?.ok && onChange(JSON.stringify(res.value, null, 2))}
          title="Pretty-print"
        >
          <Wand2 size={13} /> Format
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onChange('')} disabled={!value}>
          Clear
        </Button>
        <span className={cn('ml-auto pr-1 text-[12px]', !res ? 'text-muted' : res.ok ? 'text-success' : 'text-error')}>
          {!res ? 'Empty' : res.ok ? 'Valid' : `Line ${res.error.line}, col ${res.error.column}`}
        </span>
      </div>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={[json()]}
        theme={dark ? 'dark' : 'light'}
        height="280px"
        placeholder="Paste JSON here"
        basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: false }}
      />
      {res && !res.ok && <p className="border-t border-line bg-error/5 px-3 py-1.5 text-[12px] text-error">{res.error.message}</p>}
    </div>
  )
}

export function DiffView({ state, onChange, currentText, dark }: Props) {
  const [arrayKey, setArrayKey] = useState('')
  const [kinds, setKinds] = useState<Record<DiffKind, boolean>>({ added: true, removed: true, changed: true })
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(200)
  const da = useDeferredValue(state.a)
  const db = useDeferredValue(state.b)
  const dkey = useDeferredValue(arrayKey)

  const result = useMemo(() => {
    if (!da.trim() || !db.trim()) return { status: 'waiting' as const }
    const ra = parseJson(da)
    const rb = parseJson(db)
    if (!ra.ok || !rb.ok) return { status: 'invalid' as const }
    return { status: 'ok' as const, ...diffJson(ra.value, rb.value, { arrayKey: dkey }) }
  }, [da, db, dkey])

  const counts = useMemo(() => {
    const c: Record<DiffKind, number> = { added: 0, removed: 0, changed: 0 }
    if (result.status === 'ok') for (const e of result.entries) c[e.kind]++
    return c
  }, [result])

  const shown: DiffEntry[] = useMemo(() => {
    if (result.status !== 'ok') return []
    const needle = q.trim().toLowerCase()
    return result.entries.filter((e) => kinds[e.kind] && (!needle || e.path.toLowerCase().includes(needle)))
  }, [result, kinds, q])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight">Compare JSON</h1>
            <p className="text-muted">Paste two documents to see exactly what was added, removed or changed. Key order is ignored.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-[12px] text-muted">
              Match array items by key
              <input
                value={arrayKey}
                onChange={(e) => setArrayKey(e.target.value)}
                placeholder="e.g. id"
                aria-label="Array match key"
                className="h-8 w-24 rounded-md border border-line bg-surface px-2 font-mono text-[12.5px] text-ink outline-none focus:border-accent/60"
              />
            </label>
            <Button onClick={() => onChange({ a: state.b, b: state.a })} title="Swap A and B">
              <ArrowLeftRight size={14} /> Swap
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Side title="A · Original" value={state.a} onChange={(a) => onChange({ ...state, a })} dark={dark} currentText={currentText} />
          <Side title="B · Changed" value={state.b} onChange={(b) => onChange({ ...state, b })} dark={dark} currentText={currentText} />
        </div>

        <section className="rounded-xl border border-line bg-surface" aria-label="Differences">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
            <h2 className="mr-2 text-[13px] font-semibold">Differences</h2>
            {(Object.keys(KIND) as DiffKind[]).map((k) => (
              <button
                key={k}
                onClick={() => setKinds((s) => ({ ...s, [k]: !s[k] }))}
                aria-pressed={kinds[k]}
                className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-opacity', kinds[k] ? `border-transparent ${KIND[k].cls}` : 'border-line text-muted opacity-60')}
              >
                {KIND[k].sign} {counts[k].toLocaleString()} {KIND[k].label.toLowerCase()}
              </button>
            ))}
            <label className="ml-auto flex h-8 items-center gap-1.5 rounded-md border border-line bg-bg px-2 text-muted focus-within:border-accent/60">
              <Search size={13} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by path" aria-label="Filter differences by path" className="w-40 bg-transparent text-[12.5px] text-ink outline-none" />
              {q && (
                <button aria-label="Clear" onClick={() => setQ('')}>
                  <X size={12} />
                </button>
              )}
            </label>
            <IconButton label="Copy differences as JSON" disabled={result.status !== 'ok' || !shown.length} onClick={() => copyText(JSON.stringify(shown, null, 2), `Copied ${shown.length} differences`)}>
              <Copy size={14} />
            </IconButton>
          </div>

          {result.status === 'waiting' && <p className="p-6 text-center text-muted">Add JSON to both sides to compare.</p>}
          {result.status === 'invalid' && <p className="p-6 text-center text-error">Fix the JSON errors above to compare.</p>}
          {result.status === 'ok' && result.entries.length === 0 && (
            <p className="flex items-center justify-center gap-2 p-6 text-success">
              <CheckCircle2 size={16} /> The two documents are identical.
            </p>
          )}
          {result.status === 'ok' && result.entries.length > 0 && (
            <>
              {shown.length === 0 && <p className="p-6 text-center text-muted">No differences match the current filters.</p>}
              <ul className="divide-y divide-line">
                {shown.slice(0, limit).map((e, i) => (
                  <li key={e.path + i} className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 px-3 py-2 sm:grid-cols-[auto_minmax(0,2fr)_minmax(0,3fr)]">
                    <span className={cn('mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded font-mono text-[12px] font-bold', KIND[e.kind].cls)} title={KIND[e.kind].label}>
                      {KIND[e.kind].sign}
                    </span>
                    <span className="min-w-0 font-mono text-[12px] break-all">
                      {e.path}
                      {e.typeChange && <span className="ml-2 rounded bg-sunken px-1 text-[10.5px] text-muted">type changed</span>}
                    </span>
                    <div className="col-span-2 min-w-0 font-mono text-[12px] sm:col-span-1">
                      {e.kind !== 'added' && <span className={cn('break-all', e.kind === 'removed' ? 'text-error' : 'text-muted line-through decoration-error/60')}>{short(e.before)}</span>}
                      {e.kind === 'changed' && <span className="mx-2 text-muted">→</span>}
                      {e.kind !== 'removed' && <span className="break-all text-success">{short(e.after)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
              {shown.length > limit && (
                <div className="border-t border-line p-2 text-center">
                  <Button size="sm" onClick={() => setLimit((l) => l + 300)}>
                    Show more ({(shown.length - limit).toLocaleString()} remaining)
                  </Button>
                </div>
              )}
              {result.truncated && <p className="border-t border-line bg-warn/10 px-3 py-2 text-[12px] text-warn">Stopped after 5,000 differences. The documents differ a lot, so consider comparing smaller pieces.</p>}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
