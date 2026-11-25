import type { ColType } from './json'
import { cellText } from './json'

export type FilterValue = { op: string; a: string; b?: string }

export type OpDef = { id: string; label: string; inputs: 0 | 1 | 2 }

const empty: OpDef[] = [
  { id: 'isEmpty', label: 'is empty', inputs: 0 },
  { id: 'notEmpty', label: 'is not empty', inputs: 0 },
]

export const OPS: Record<'text' | 'number' | 'date' | 'boolean', OpDef[]> = {
  text: [
    { id: 'contains', label: 'contains', inputs: 1 },
    { id: 'notContains', label: 'does not contain', inputs: 1 },
    { id: 'equals', label: 'equals', inputs: 1 },
    { id: 'startsWith', label: 'starts with', inputs: 1 },
    { id: 'endsWith', label: 'ends with', inputs: 1 },
    ...empty,
  ],
  number: [
    { id: 'eq', label: '= equals', inputs: 1 },
    { id: 'neq', label: '≠ not equal', inputs: 1 },
    { id: 'gt', label: '> greater than', inputs: 1 },
    { id: 'gte', label: '≥ at least', inputs: 1 },
    { id: 'lt', label: '< less than', inputs: 1 },
    { id: 'lte', label: '≤ at most', inputs: 1 },
    { id: 'between', label: 'between', inputs: 2 },
    ...empty,
  ],
  date: [
    { id: 'on', label: 'on', inputs: 1 },
    { id: 'before', label: 'before', inputs: 1 },
    { id: 'after', label: 'after', inputs: 1 },
    { id: 'between', label: 'between', inputs: 2 },
    ...empty,
  ],
  boolean: [
    { id: 'true', label: 'is true', inputs: 0 },
    { id: 'false', label: 'is false', inputs: 0 },
    ...empty,
  ],
}

export const familyOf = (t: ColType): keyof typeof OPS =>
  t === 'number' ? 'number' : t === 'date' ? 'date' : t === 'boolean' ? 'boolean' : 'text'

export const isEmptyValue = (v: unknown) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0)

export function isFilterReady(f: FilterValue | undefined, type: ColType): boolean {
  if (!f) return false
  const def = OPS[familyOf(type)].find((o) => o.id === f.op)
  if (!def) return false
  if (def.inputs === 0) return true
  if (def.inputs === 1) return f.a.trim() !== ''
  return f.a.trim() !== '' || (f.b ?? '').trim() !== ''
}

const day = (v: unknown) => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN
  return t
}
const dayStart = (s: string) => Date.parse(s.length <= 10 ? s + 'T00:00:00' : s)

export function matchesFilter(v: unknown, f: FilterValue, type: ColType): boolean {
  const fam = familyOf(type)
  if (f.op === 'isEmpty') return isEmptyValue(v)
  if (f.op === 'notEmpty') return !isEmptyValue(v)
  if (fam === 'boolean') return f.op === 'true' ? v === true : v === false
  if (fam === 'number') {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
    if (Number.isNaN(n)) return f.op === 'neq'
    const a = Number(f.a)
    const b = f.b?.trim() ? Number(f.b) : NaN
    switch (f.op) {
      case 'eq': return n === a
      case 'neq': return n !== a
      case 'gt': return n > a
      case 'gte': return n >= a
      case 'lt': return n < a
      case 'lte': return n <= a
      case 'between': return (f.a.trim() === '' || n >= a) && (Number.isNaN(b) || n <= b)
    }
    return true
  }
  if (fam === 'date') {
    const t = day(v)
    if (Number.isNaN(t)) return false
    const a = dayStart(f.a)
    const aEnd = a + 86400000
    switch (f.op) {
      case 'on': return t >= a && t < aEnd
      case 'before': return t < a
      case 'after': return t >= aEnd
      case 'between': {
        const b = f.b?.trim() ? dayStart(f.b) + 86400000 : Infinity
        return (f.a.trim() === '' || t >= a) && t < b
      }
    }
    return true
  }
  const text = cellText(v).toLowerCase()
  const q = f.a.toLowerCase()
  switch (f.op) {
    case 'contains': return text.includes(q)
    case 'notContains': return !text.includes(q)
    case 'equals': return text === q
    case 'startsWith': return text.startsWith(q)
    case 'endsWith': return text.endsWith(q)
  }
  return true
}

export function describeFilter(f: FilterValue, type: ColType): string {
  const def = OPS[familyOf(type)].find((o) => o.id === f.op)
  const label = def?.label.replace(/^[=≠><≥≤] /, '') ?? f.op
  if (!def || def.inputs === 0) return label
  if (def.inputs === 2) return `${label} ${f.a || '…'} and ${f.b || '…'}`
  return `${label} ${f.a}`
}

/** Comparator that is safe for mixed types. Nulls and missing values sort last when ascending. */
export function compareValues(a: unknown, b: unknown): number {
  const rank = (v: unknown) => (v === undefined ? 5 : v === null ? 4 : typeof v === 'number' ? 1 : typeof v === 'string' ? 2 : typeof v === 'boolean' ? 0 : 3)
  const ra = rank(a)
  const rb = rank(b)
  if (ra !== rb) return ra - rb
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  if (ra === 3) return cellText(a).localeCompare(cellText(b))
  return 0
}
