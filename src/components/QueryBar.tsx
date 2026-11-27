import { useState } from 'react'
import { CornerDownLeft, History, Lightbulb, SquareTerminal, X } from 'lucide-react'
import { Button, IconButton, Kbd, Popover } from './ui'
import { queryJsonPath } from '../lib/jsonpath'
import { cn, lsGet, lsSet } from '../lib/util'

export type QuerySample = { base: string; arrayRoot: boolean; key: string; numKey?: string; numVal?: number }

type Props = { root: unknown; sample: QuerySample; active: boolean; onRun: (expr: string, data: unknown) => void; onClear: () => void }

const HIST = 'jx-query-history'
const loadHistory = (): string[] => {
  try {
    const v = JSON.parse(lsGet(HIST) || '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function QueryBar({ root, sample, active, onRun, onClear }: Props) {
  const [q, setQ] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [history, setHistory] = useState<string[]>(loadHistory)

  const run = (expr: string) => {
    try {
      const res = queryJsonPath(root, expr)
      const data = res.length === 1 && Array.isArray(res[0]) ? res[0] : res
      setErr(null)
      setCount(res.length)
      const next = [expr.trim(), ...history.filter((h) => h !== expr.trim())].slice(0, 8)
      setHistory(next)
      lsSet(HIST, JSON.stringify(next))
      onRun(expr.trim(), data)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Invalid query')
      setCount(null)
    }
  }

  const { base, key, numKey, numVal } = sample
  const examples: [string, string][] = sample.arrayRoot
    ? [
        [base, 'Everything in the array'],
        [`${base}[0]`, 'First record'],
        [`${base}[0:5]`, 'First five records'],
        [`${base}[-1]`, 'Last record'],
        [`${base}[*].${key}`, `Only the "${key}" field`],
        ...(numKey ? ([[`${base}[?(@.${numKey} > ${numVal ?? 0})]`, `Records where ${numKey} > ${numVal ?? 0}`]] as [string, string][]) : []),
        [`$..${key}`, `Every "${key}" anywhere`],
      ]
    : [
        ['$..*', 'Every value'],
        [`$..${key}`, `Every "${key}" anywhere`],
      ]

  return (
    <div className="border-b border-line bg-surface px-3 py-1.5 sm:px-4">
      <div className="flex items-center gap-2">
        <label className={cn('flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border bg-bg px-2.5 transition-colors focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/15', err ? 'border-error/60' : active ? 'border-accent/50' : 'border-line')}>
          <SquareTerminal size={14} className={cn('shrink-0', active ? 'text-accent' : 'text-muted')} />
          <input
            id="query-input"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setErr(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') run(q)
              if (e.key === 'Escape') (e.target as HTMLInputElement).blur()
            }}
            placeholder={`JSONPath query, e.g. ${sample.arrayRoot ? `${base}[*].${key}` : '$..*'}`}
            aria-label="JSONPath query"
            aria-invalid={!!err}
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent font-mono text-[12.5px] text-ink outline-none placeholder:text-muted"
          />
          {!q && (
            <span className="hidden shrink-0 items-center gap-1 text-muted sm:flex">
              <Kbd>/</Kbd>
            </span>
          )}
        </label>
        <Button size="sm" variant="primary" onClick={() => run(q)} disabled={!q.trim()} title="Run query (Enter)">
          <CornerDownLeft size={13} /> <span className="hidden sm:inline">Run</span>
        </Button>
        <Popover
          align="end"
          width={380}
          trigger={(p) => (
            <IconButton label="Query examples and history" active={p.open} {...p}>
              <Lightbulb size={15} />
            </IconButton>
          )}
        >
          {(close) => (
            <div className="max-h-[60vh] overflow-y-auto p-1">
              <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">Examples for this document</div>
              {examples.map(([expr, label]) => (
                <button
                  key={expr}
                  onClick={() => {
                    setQ(expr)
                    run(expr)
                    close()
                  }}
                  className="flex w-full flex-col rounded-md px-2.5 py-1.5 text-left hover:bg-sunken"
                >
                  <span className="truncate font-mono text-[12px]">{expr}</span>
                  <span className="text-[11.5px] text-muted">{label}</span>
                </button>
              ))}
              {history.length > 0 && (
                <>
                  <div className="mt-1 flex items-center gap-1.5 border-t border-line px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
                    <History size={11} /> Recent
                  </div>
                  {history.map((h) => (
                    <button
                      key={h}
                      onClick={() => {
                        setQ(h)
                        run(h)
                        close()
                      }}
                      className="block w-full truncate rounded-md px-2.5 py-1.5 text-left font-mono text-[12px] hover:bg-sunken"
                    >
                      {h}
                    </button>
                  ))}
                </>
              )}
              <p className="border-t border-line px-2.5 pt-2 pb-1.5 text-[11.5px] leading-snug text-muted">
                Supports <code className="font-mono">.key</code> <code className="font-mono">..deep</code> <code className="font-mono">[*]</code> <code className="font-mono">[0:5]</code> and filters like <code className="font-mono">[?(@.a &gt; 1 &amp;&amp; @.b == 'x')]</code>, plus <code className="font-mono">=~ /regex/</code> and <code className="font-mono">.length</code>.
              </p>
            </div>
          )}
        </Popover>
        {active && (
          <Button size="sm" variant="ghost" onClick={() => { setQ(''); setErr(null); setCount(null); onClear() }} title="Clear query and return to the default table">
            <X size={13} /> <span className="hidden sm:inline">Clear query</span>
          </Button>
        )}
      </div>
      {err && (
        <p role="alert" className="mt-1 text-[12px] text-error">
          {err}
        </p>
      )}
      {!err && active && count !== null && (
        <p className="mt-1 text-[12px] text-muted">
          <b className="font-medium text-ink">{count.toLocaleString()}</b> result{count === 1 ? '' : 's'} shown below.
        </p>
      )}
    </div>
  )
}
