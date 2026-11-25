import { cellText } from './json'

export type ColStats = {
  total: number
  missing: number
  nulls: number
  distinct: number
  distinctCapped: boolean
  top: { label: string; value: unknown; n: number }[]
  num?: { min: number; max: number; mean: number; median: number; sum: number; bins: number[] }
  str?: { minLen: number; maxLen: number }
  date?: { min: string; max: string }
  bool?: { t: number; f: number }
}

const CAP = 50_000

export function columnStats(values: unknown[]): ColStats {
  const counts = new Map<string, { value: unknown; n: number }>()
  const nums: number[] = []
  const dates: string[] = []
  let missing = 0
  let nulls = 0
  let minLen = Infinity
  let maxLen = 0
  let t = 0
  let f = 0
  let capped = false
  let strings = 0
  for (const v of values) {
    if (v === undefined) {
      missing++
      continue
    }
    if (v === null) nulls++
    else if (typeof v === 'number') nums.push(v)
    else if (typeof v === 'boolean') v ? t++ : f++
    else if (typeof v === 'string') {
      strings++
      minLen = Math.min(minLen, v.length)
      maxLen = Math.max(maxLen, v.length)
      if (/^\d{4}-\d{2}-\d{2}/.test(v)) dates.push(v)
    }
    const k = cellText(v)
    const e = counts.get(k)
    if (e) e.n++
    else if (counts.size < CAP) counts.set(k, { value: v, n: 1 })
    else capped = true
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 6)
    .map(([label, e]) => ({ label, value: e.value, n: e.n }))
  const st: ColStats = { total: values.length, missing, nulls, distinct: counts.size, distinctCapped: capped, top }
  if (nums.length) {
    const sorted = [...nums].sort((a, b) => a - b)
    const min = sorted[0]
    const max = sorted[sorted.length - 1]
    const sum = nums.reduce((a, b) => a + b, 0)
    const mid = Math.floor(sorted.length / 2)
    const bins = new Array(10).fill(0) as number[]
    for (const x of nums) bins[max === min ? 0 : Math.min(9, Math.floor(((x - min) / (max - min)) * 10))]++
    st.num = { min, max, sum, mean: sum / nums.length, median: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2, bins }
  }
  if (strings) st.str = { minLen, maxLen }
  if (dates.length >= strings * 0.9 && dates.length) {
    const d = [...dates].sort()
    st.date = { min: d[0], max: d[d.length - 1] }
  }
  if (t + f) st.bool = { t, f }
  return st
}
