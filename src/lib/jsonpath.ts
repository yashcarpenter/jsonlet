/* A small, dependency-free JSONPath engine (no eval).
 * Supports: $  .key  ..key  ['a','b']  [0]  [-1]  [*]  .*  [1:5:2]  [?(@.x > 1 && @.y == 'a')]
 * Filter operands: @.path, $.path, 'str', 12, true/false/null, /regex/i. Operators: == != < <= > >= =~ && || !
 * Special: .length works on arrays and strings. */
import { isPlainObject } from './json'

type Seg =
  | { t: 'child'; name: string }
  | { t: 'index'; i: number }
  | { t: 'wild' }
  | { t: 'desc' }
  | { t: 'slice'; a?: number; b?: number; step: number }
  | { t: 'union'; items: (string | number)[] }
  | { t: 'filter'; test: (item: unknown, root: unknown) => boolean }

export class JsonPathError extends Error {}

const NAME = /[^\s.[\]=!<>&|(),'"]+/y
const MAX_RESULTS = 200_000

function skipQuoted(s: string, i: number): number {
  const q = s[i]
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\') j++
    else if (s[j] === q) return j + 1
  }
  throw new JsonPathError('Unterminated string in expression')
}

function matchBracket(s: string, i: number): number {
  let depth = 0
  for (let j = i; j < s.length; j++) {
    const c = s[j]
    if (c === '"' || c === "'") j = skipQuoted(s, j) - 1
    else if (c === '[') depth++
    else if (c === ']' && --depth === 0) return j
  }
  throw new JsonPathError('Missing closing "]"')
}

const unquote = (s: string) => s.slice(1, -1).replace(/\\(.)/g, '$1')

function splitTopLevel(s: string): string[] {
  const out: string[] = []
  let last = 0
  for (let j = 0; j < s.length; j++) {
    if (s[j] === '"' || s[j] === "'") j = skipQuoted(s, j) - 1
    else if (s[j] === ',') {
      out.push(s.slice(last, j))
      last = j + 1
    }
  }
  out.push(s.slice(last))
  return out.map((x) => x.trim())
}

function readName(s: string, i: number): { name: string; end: number } {
  NAME.lastIndex = i
  const m = NAME.exec(s)
  if (!m) throw new JsonPathError(`Expected a property name at position ${i}`)
  return { name: m[0], end: i + m[0].length }
}

function parseBracket(c: string): Seg {
  c = c.trim()
  if (c === '*') return { t: 'wild' }
  if (c.startsWith('?')) return { t: 'filter', test: compileFilter(c.slice(1).trim()) }
  if (/^-?\d+$/.test(c)) return { t: 'index', i: Number(c) }
  const sl = /^(-?\d*):(-?\d*)(?::(-?\d*))?$/.exec(c)
  if (sl) return { t: 'slice', a: sl[1] === '' ? undefined : Number(sl[1]), b: sl[2] === '' ? undefined : Number(sl[2]), step: sl[3] ? Number(sl[3]) || 1 : 1 }
  const items = splitTopLevel(c).map((p) => {
    if (/^(['"]).*\1$/.test(p)) return unquote(p)
    if (/^-?\d+$/.test(p)) return Number(p)
    throw new JsonPathError(`Unsupported bracket expression [${c}]`)
  })
  return items.length === 1 && typeof items[0] === 'string' ? { t: 'child', name: items[0] } : { t: 'union', items }
}

function parseSegments(s: string, i: number): { segs: Seg[]; end: number } {
  const segs: Seg[] = []
  while (i < s.length) {
    if (s[i] === '.') {
      if (s[i + 1] === '.') {
        segs.push({ t: 'desc' })
        i += 2
        if (s[i] === '[') continue
        if (s[i] === '*') {
          segs.push({ t: 'wild' })
          i++
          continue
        }
        const r = readName(s, i)
        segs.push({ t: 'child', name: r.name })
        i = r.end
        continue
      }
      i++
      if (s[i] === '*') {
        segs.push({ t: 'wild' })
        i++
        continue
      }
      const r = readName(s, i)
      segs.push({ t: 'child', name: r.name })
      i = r.end
    } else if (s[i] === '[') {
      const e = matchBracket(s, i)
      segs.push(parseBracket(s.slice(i + 1, e)))
      i = e + 1
    } else break
  }
  return { segs, end: i }
}

const childrenOf = (n: unknown): unknown[] => (Array.isArray(n) ? n : isPlainObject(n) ? Object.values(n) : [])

function descendants(n: unknown, out: unknown[]) {
  const stack: unknown[] = [n]
  while (stack.length) {
    const cur = stack.pop()!
    out.push(cur)
    const kids = childrenOf(cur)
    for (let k = kids.length - 1; k >= 0; k--) stack.push(kids[k])
    if (out.length > MAX_RESULTS) throw new JsonPathError('Too many matches. Narrow the query.')
  }
}

function applySeg(nodes: unknown[], seg: Seg, root: unknown): unknown[] {
  const out: unknown[] = []
  const pushChild = (n: unknown, name: string) => {
    if (isPlainObject(n)) {
      if (Object.prototype.hasOwnProperty.call(n, name)) out.push(n[name])
      else if (name === 'length') return
    } else if (name === 'length' && (Array.isArray(n) || typeof n === 'string')) out.push(n.length)
  }
  const pushIndex = (n: unknown, i: number) => {
    if (!Array.isArray(n)) return
    const k = i < 0 ? n.length + i : i
    if (k >= 0 && k < n.length) out.push(n[k])
  }
  for (const n of nodes) {
    switch (seg.t) {
      case 'child':
        pushChild(n, seg.name)
        break
      case 'index':
        pushIndex(n, seg.i)
        break
      case 'wild':
        out.push(...childrenOf(n))
        break
      case 'desc':
        descendants(n, out)
        break
      case 'slice': {
        if (!Array.isArray(n)) break
        const len = n.length
        const norm = (v: number | undefined, d: number) => (v === undefined ? d : v < 0 ? Math.max(0, len + v) : Math.min(v, len))
        const a = norm(seg.a, 0)
        const b = norm(seg.b, len)
        for (let k = a; k < b; k += seg.step) out.push(n[k])
        break
      }
      case 'union':
        for (const it of seg.items) typeof it === 'string' ? pushChild(n, it) : pushIndex(n, it)
        break
      case 'filter':
        for (const c of childrenOf(n)) if (seg.test(c, root)) out.push(c)
        break
    }
    if (out.length > MAX_RESULTS) throw new JsonPathError('Too many matches. Narrow the query.')
  }
  return out
}

function evalSegs(start: unknown, segs: Seg[], root: unknown): unknown[] {
  let nodes = [start]
  for (const s of segs) nodes = applySeg(nodes, s, root)
  return nodes
}

/* ---------- filter expressions ---------- */
type Ev = (item: unknown, root: unknown) => unknown

function compileFilter(src: string): (item: unknown, root: unknown) => boolean {
  let i = 0
  const ws = () => {
    while (i < src.length && /\s/.test(src[i])) i++
  }
  const eat = (t: string) => {
    ws()
    if (src.startsWith(t, i)) {
      i += t.length
      return true
    }
    return false
  }
  const exists = (v: unknown) => v !== undefined && v !== null && v !== false

  const operand = (): Ev => {
    ws()
    const c = src[i]
    if (c === '@' || c === '$') {
      i++
      const { segs, end } = parseSegments(src, i)
      i = end
      const abs = c === '$'
      return (item, root) => evalSegs(abs ? root : item, segs, root)[0]
    }
    if (c === '"' || c === "'") {
      const e = skipQuoted(src, i)
      const str = unquote(src.slice(i, e))
      i = e
      return () => str
    }
    if (c === '/') {
      let j = i + 1
      while (j < src.length && src[j] !== '/') j += src[j] === '\\' ? 2 : 1
      const body = src.slice(i + 1, j)
      const fl = /^[a-z]*/.exec(src.slice(j + 1))![0]
      i = j + 1 + fl.length
      let re: RegExp
      try {
        re = new RegExp(body, fl)
      } catch {
        throw new JsonPathError('Invalid regular expression')
      }
      return () => re
    }
    if (c === '(') {
      i++
      const e = orExpr()
      if (!eat(')')) throw new JsonPathError('Missing ")" in filter')
      return e
    }
    const num = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i))
    if (num) {
      i += num[0].length
      const n = Number(num[0])
      return () => n
    }
    for (const [w, v] of [['true', true], ['false', false], ['null', null]] as const) {
      if (src.startsWith(w, i)) {
        i += w.length
        return () => v
      }
    }
    throw new JsonPathError(`Unexpected "${src[i] ?? 'end'}" in filter`)
  }

  const cmp = (): Ev => {
    ws()
    if (src[i] === '!' && src[i + 1] !== '=') {
      i++
      const e = cmp()
      return (a, b) => !exists(e(a, b))
    }
    const l = operand()
    ws()
    for (const op of ['===', '==', '!=', '<=', '>=', '=~', '<', '>']) {
      if (src.startsWith(op, i)) {
        i += op.length
        const r = operand()
        return (a, b) => {
          const lv = l(a, b)
          const rv = r(a, b)
          switch (op) {
            case '==':
            case '===': return lv === rv
            case '!=': return lv !== rv
            case '=~': {
              if (typeof lv !== 'string' && typeof lv !== 'number') return false
              const re = rv instanceof RegExp ? rv : typeof rv === 'string' ? new RegExp(rv) : null
              return re ? re.test(String(lv)) : false
            }
            default: {
              const ok = (typeof lv === 'number' && typeof rv === 'number') || (typeof lv === 'string' && typeof rv === 'string')
              if (!ok) return false
              const x = lv as number
              const y = rv as number
              return op === '<' ? x < y : op === '<=' ? x <= y : op === '>' ? x > y : x >= y
            }
          }
        }
      }
    }
    return (a, b) => exists(l(a, b))
  }
  const andExpr = (): Ev => {
    let l = cmp()
    while (eat('&&')) {
      const L = l
      const R = cmp()
      l = (a, b) => exists(L(a, b)) && exists(R(a, b))
    }
    return l
  }
  const orExpr = (): Ev => {
    let l = andExpr()
    while (eat('||')) {
      const L = l
      const R = andExpr()
      l = (a, b) => exists(L(a, b)) || exists(R(a, b))
    }
    return l
  }
  const root = orExpr()
  ws()
  if (i < src.length) throw new JsonPathError(`Unexpected "${src[i]}" in filter`)
  return (item, r) => exists(root(item, r))
}

export function queryJsonPath(root: unknown, expr: string): unknown[] {
  let s = expr.trim()
  if (!s) throw new JsonPathError('Enter a JSONPath expression, for example $.users[*].name')
  if (s[0] !== '$') s = s[0] === '.' || s[0] === '[' ? '$' + s : '$.' + s
  const { segs, end } = parseSegments(s, 1)
  if (end < s.length) throw new JsonPathError(`Unexpected "${s[end]}" at position ${end}`)
  return evalSegs(root, segs, root)
}
