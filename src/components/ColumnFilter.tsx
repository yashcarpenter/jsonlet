import { Button } from './ui'
import { OPS, familyOf, type FilterValue } from '../lib/filters'
import type { Col } from '../lib/json'

type Props = { col: Col; value: FilterValue | undefined; onChange: (v: FilterValue | undefined) => void; onClose: () => void }

const field = 'h-8 w-full rounded-md border border-line bg-bg px-2 text-[13px] text-ink outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/15'

export function ColumnFilter({ col, value, onChange, onClose }: Props) {
  const fam = familyOf(col.type)
  const ops = OPS[fam]
  const cur = value ?? { op: ops[0].id, a: '', b: '' }
  const def = ops.find((o) => o.id === cur.op) ?? ops[0]
  const inputType = fam === 'number' ? 'number' : fam === 'date' ? 'date' : 'text'
  const set = (patch: Partial<FilterValue>) => onChange({ ...cur, ...patch })

  return (
    <div className="p-3" onKeyDown={(e) => e.key === 'Enter' && onClose()}>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="truncate font-mono text-[12px] font-semibold">{col.key}</span>
        <span className="text-[11px] text-muted">{col.type}</span>
      </div>
      <div className="space-y-2">
        <select
          className={field}
          value={cur.op}
          aria-label="Filter operator"
          onChange={(e) => {
            const next = ops.find((o) => o.id === e.target.value)!
            onChange({ op: next.id, a: cur.a, b: cur.b })
            void next
          }}
        >
          {ops.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        {def.inputs >= 1 && <input autoFocus className={field} type={inputType} value={cur.a} onChange={(e) => set({ a: e.target.value })} placeholder={def.inputs === 2 ? 'From' : 'Value'} aria-label="Filter value" />}
        {def.inputs === 2 && <input className={field} type={inputType} value={cur.b ?? ''} onChange={(e) => set({ b: e.target.value })} placeholder="To" aria-label="Filter upper value" />}
      </div>
      {col.type === 'mixed' && <p className="mt-2 text-[11px] text-muted">This column has mixed types, so text matching is used.</p>}
      <div className="mt-3 flex justify-between">
        <Button size="sm" variant="ghost" onClick={() => onChange(undefined)} disabled={!value}>
          Clear
        </Button>
        <Button size="sm" variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )
}
