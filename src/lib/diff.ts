import { isPlainObject, typeOf } from './json'

export type DiffKind = 'added' | 'removed' | 'changed'
export type DiffEntry = { path: string; kind: DiffKind; before?: unknown; after?: unknown; typeChange?: boolean }
export type DiffResult = { entries: DiffEntry[]; truncated: boolean }

const SIMPLE_KEY = /^[A-Za-z_$][\w$]*$/
const keyPath = (p: string, k: string) => (SIMPLE_KEY.test(k) ? `${p}.${k}` : `${p}['${k.replace(/'/g, "\\'")}']`)

/** Structural diff. Arrays are compared by index, or matched by `arrayKey` when every item has it. */
export function diffJson(a: unknown, b: unknown, opts: { arrayKey?: string; max?: number } = {}): DiffResult {
  const max = opts.max ?? 5000
  const key = opts.arrayKey?.trim()
  const entries: DiffEntry[] = []
  let truncated = false
  const add = (e: DiffEntry) => {
    if (entries.length >= max) truncated = true
    else entries.push(e)
  }

  const walk = (x: unknown, y: unknown, path: string) => {
    if (truncated) return
    if (isPlainObject(x) && isPlainObject(y)) {
      for (const k of Object.keys(x)) {
        if (!(k in y)) add({ path: keyPath(path, k), kind: 'removed', before: x[k] })
        else walk(x[k], y[k], keyPath(path, k))
      }
      for (const k of Object.keys(y)) if (!(k in x)) add({ path: keyPath(path, k), kind: 'added', after: y[k] })
      return
    }
    if (Array.isArray(x) && Array.isArray(y)) {
      const keyed = key && [...x, ...y].every((it) => isPlainObject(it) && it[key] !== undefined && typeof it[key] !== 'object')
      if (keyed) {
        const mb = new Map(y.map((it) => [String((it as Record<string, unknown>)[key!]), it]))
        const seen = new Set<string>()
        for (const it of x) {
          const id = String((it as Record<string, unknown>)[key!])
          const p = `${path}[${key}=${id}]`
          seen.add(id)
          if (mb.has(id)) walk(it, mb.get(id), p)
          else add({ path: p, kind: 'removed', before: it })
        }
        for (const [id, it] of mb) if (!seen.has(id)) add({ path: `${path}[${key}=${id}]`, kind: 'added', after: it })
        return
      }
      const n = Math.max(x.length, y.length)
      for (let i = 0; i < n; i++) {
        if (i >= x.length) add({ path: `${path}[${i}]`, kind: 'added', after: y[i] })
        else if (i >= y.length) add({ path: `${path}[${i}]`, kind: 'removed', before: x[i] })
        else walk(x[i], y[i], `${path}[${i}]`)
      }
      return
    }
    if (x === y) return
    add({ path, kind: 'changed', before: x, after: y, typeChange: typeOf(x) !== typeOf(y) })
  }
  walk(a, b, '$')
  return { entries, truncated }
}
