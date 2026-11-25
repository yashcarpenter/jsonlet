import { useMemo } from 'react'
import { columnStats } from '../lib/stats'

const fmt = (n: number) => (Math.abs(n) >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(Math.round(n * 1000) / 1000))

export function ColumnStats({ getValues, onPick }: { getValues: () => unknown[]; onPick: (v: unknown) => void }) {
  const st = useMemo(() => columnStats(getValues()), [getValues])
  const Row = ({ k, v }: { k: string; v: string | number }) => (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-muted">{k}</span>
      <span className="font-mono tabular-nums">{v}</span>
    </div>
  )
  const maxBin = st.num ? Math.max(...st.num.bins, 1) : 1
  const maxTop = st.top[0]?.n ?? 1
  return (
    <div className="max-h-[60vh] space-y-3 overflow-y-auto p-3 text-[12px]">
      <div>
        <Row k="Rows in view" v={st.total.toLocaleString()} />
        <Row k="Distinct" v={`${st.distinct.toLocaleString()}${st.distinctCapped ? '+' : ''}`} />
        <Row k="Null" v={st.nulls.toLocaleString()} />
        <Row k="Missing" v={st.missing.toLocaleString()} />
      </div>
      {st.num && (
        <div>
          <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">Numbers</div>
          <Row k="Min / Max" v={`${fmt(st.num.min)} / ${fmt(st.num.max)}`} />
          <Row k="Mean" v={fmt(st.num.mean)} />
          <Row k="Median" v={fmt(st.num.median)} />
          <Row k="Sum" v={fmt(st.num.sum)} />
          <div className="mt-2 flex h-10 items-end gap-0.5" aria-label="Distribution">
            {st.num.bins.map((b, i) => (
              <div key={i} title={`${b} values`} className="flex-1 rounded-sm bg-accent/70" style={{ height: `${Math.max(b ? 8 : 2, (b / maxBin) * 100)}%` }} />
            ))}
          </div>
        </div>
      )}
      {st.str && <Row k="Length (min / max)" v={`${st.str.minLen} / ${st.str.maxLen}`} />}
      {st.date && <Row k="Range" v={`${st.date.min.slice(0, 10)} → ${st.date.max.slice(0, 10)}`} />}
      {st.bool && <Row k="True / False" v={`${st.bool.t} / ${st.bool.f}`} />}
      {st.top.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">Top values · click to filter</div>
          <ul className="space-y-0.5">
            {st.top.map((t) => (
              <li key={t.label}>
                <button onClick={() => onPick(t.value)} className="relative flex w-full items-center justify-between gap-2 overflow-hidden rounded px-1.5 py-1 text-left hover:bg-sunken">
                  <span className="absolute inset-y-0 left-0 bg-accent/10" style={{ width: `${(t.n / maxTop) * 100}%` }} />
                  <span className="relative truncate font-mono">{t.label || '(empty)'}</span>
                  <span className="relative shrink-0 text-muted">{t.n}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
