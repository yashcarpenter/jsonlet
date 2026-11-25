import type { TableModel } from '../lib/json'

const dot: Record<string, string> = {
  string: 'bg-tok-str',
  number: 'bg-tok-num',
  boolean: 'bg-tok-bool',
  date: 'bg-accent',
  object: 'bg-tok-key',
  array: 'bg-tok-key',
  mixed: 'bg-muted',
}

export function DataSummary({ model }: { model: TableModel }) {
  const stat = (label: string, value: number) => (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-[13px] font-semibold tabular-nums">{value.toLocaleString()}</span>
      <span className="text-muted">{label}</span>
    </div>
  )
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line bg-bg px-3 py-1.5 text-[12px] sm:px-4" aria-label="Data summary">
      {stat('Total Records', model.rows.length)}
      {stat('Total Columns', model.cols.length)}
      {stat('Nested Objects', model.nestedObjectCount)}
      {stat('Array Fields', model.arrayFieldCount)}
      <div className="flex items-center gap-2">
        <span className="text-muted">Data Types</span>
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(model.typeSummary).map(([t, n]) => (
            <span key={t} className="flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${dot[t] ?? 'bg-muted'}`} />
              <span>{t}</span>
              <span className="font-mono text-muted">{n}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
