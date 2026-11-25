import { cellText, isPlainObject, typeOf } from './json'

const mdCell = (v: unknown) => {
  const t = v === undefined ? '' : cellText(v)
  return (t.length > 120 ? t.slice(0, 117) + '...' : t).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

export function toMarkdown(keys: string[], rows: Record<string, unknown>[], cap = 1000): string {
  const head = `| ${keys.map(mdCell).join(' | ')} |`
  const sep = `| ${keys.map(() => '---').join(' | ')} |`
  const body = rows.slice(0, cap).map((r) => `| ${keys.map((k) => mdCell(r[k])).join(' | ')} |`)
  const note = rows.length > cap ? [`\n_Showing ${cap} of ${rows.length} rows._`] : []
  return [head, sep, ...body, ...note].join('\n')
}

const SAFE = /^[A-Za-z_$][\w$]*$/
const pascal = (s: string) =>
  s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('') || 'Field'

/** Infers TypeScript interfaces from a sample of records (up to 500). */
export function toTypeScript(records: unknown[], rootName = 'Item'): string {
  const defs = new Map<string, string>()

  const infer = (values: unknown[], name: string): string => {
    const prims = new Set<string>()
    const objs: Record<string, unknown>[] = []
    const arrs: unknown[] = []
    for (const v of values) {
      const t = typeOf(v)
      if (isPlainObject(v)) objs.push(v)
      else if (Array.isArray(v)) arrs.push(...v.slice(0, 500))
      else prims.add(t)
    }
    const hasArr = values.some(Array.isArray)
    const parts = [...prims]
    if (objs.length) {
      const keys: string[] = []
      for (const o of objs) for (const k of Object.keys(o)) if (!keys.includes(k)) keys.push(k)
      const lines = keys.map((k) => {
        const vals = objs.filter((o) => k in o).map((o) => o[k])
        return `  ${SAFE.test(k) ? k : JSON.stringify(k)}${vals.length < objs.length ? '?' : ''}: ${infer(vals, name + pascal(k))};`
      })
      const body = lines.length ? lines.join('\n') : '  [key: string]: unknown;'
      let final = name
      let n = 2
      while (defs.has(final) && defs.get(final) !== body) final = name + n++
      defs.set(final, body)
      parts.push(final)
    }
    if (hasArr) {
      const inner = arrs.length ? infer(arrs, name + 'Item') : 'unknown'
      parts.push(inner.includes(' | ') ? `(${inner})[]` : `${inner}[]`)
    }
    return parts.length ? parts.join(' | ') : 'unknown'
  }

  const root = infer(records.slice(0, 500), rootName)
  const out = [...defs.entries()].reverse().map(([n, b]) => `export interface ${n} {\n${b}\n}`)
  if (root !== rootName) out.unshift(`export type ${rootName} = ${root};`)
  return out.join('\n\n') + '\n'
}
