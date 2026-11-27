/* Core JSON logic: validation, parsing, structure detection, flattening. Pure and local. */

export type JsonError = { message: string; pos: number; line: number; column: number }

export function posToLineCol(text: string, pos: number) {
  let line = 1
  let last = -1
  for (let i = text.indexOf('\n'); i !== -1 && i < pos; i = text.indexOf('\n', i + 1)) {
    line++
    last = i
  }
  return { line, column: pos - last }
}

/** Small strict JSON validator that reports a precise position (browser messages are inconsistent). */
export function findJsonError(input: string): JsonError | null {
  const s = stripBom(input)
  let i = 0
  const n = s.length
  const fail = (message: string, pos = i): never => {
    throw { message, pos: Math.min(pos, n) }
  }
  const eof = () => i >= n
  const ws = () => {
    while (i < n) {
      const c = s.charCodeAt(i)
      if (c === 32 || c === 10 || c === 13 || c === 9) i++
      else break
    }
  }
  const str = () => {
    const start = i
    i++
    while (i < n) {
      const c = s.charCodeAt(i)
      if (c === 34) {
        i++
        return
      }
      if (c < 32) fail('Control character in string (use \\n instead of a raw line break)')
      if (c === 92) {
        const e = s[i + 1]
        if (e === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(s.slice(i + 2, i + 6))) fail('Invalid unicode escape', i)
          i += 6
        } else if (e && '"\\/bfnrt'.includes(e)) i += 2
        else fail('Invalid escape sequence', i)
      } else i++
    }
    fail('Unterminated string', start)
  }
  const num = /-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/y
  const value = (depth: number): void => {
    if (depth > 4000) fail('Nesting is too deep')
    ws()
    if (eof()) fail('Unexpected end of JSON input')
    const c = s[i]
    if (c === '{') {
      i++
      ws()
      if (s[i] === '}') return void i++
      for (;;) {
        ws()
        if (eof()) fail('Unexpected end of JSON input')
        if (s[i] === '}') fail('Trailing comma is not allowed')
        if (s[i] === "'") fail('Strings must use double quotes')
        if (s[i] !== '"') fail('Expected a property name in double quotes')
        str()
        ws()
        if (s[i] !== ':') fail("Expected ':' after property name")
        i++
        value(depth + 1)
        ws()
        if (s[i] === ',') {
          i++
          continue
        }
        if (s[i] === '}') return void i++
        fail(eof() ? 'Unexpected end of JSON input' : "Expected ',' or '}' after property value")
      }
    }
    if (c === '[') {
      i++
      ws()
      if (s[i] === ']') return void i++
      for (;;) {
        ws()
        if (s[i] === ']') fail('Trailing comma is not allowed')
        value(depth + 1)
        ws()
        if (s[i] === ',') {
          i++
          continue
        }
        if (s[i] === ']') return void i++
        fail(eof() ? 'Unexpected end of JSON input' : "Expected ',' or ']' after array element")
      }
    }
    if (c === '"') return str()
    if (c === "'") fail('Strings must use double quotes')
    for (const lit of ['true', 'false', 'null']) {
      if (s.startsWith(lit, i)) return void (i += lit.length)
    }
    num.lastIndex = i
    const m = num.exec(s)
    if (m) return void (i += m[0].length)
    fail(`Unexpected token '${c}'`)
  }
  try {
    value(0)
    ws()
    if (!eof()) fail('Unexpected content after end of JSON')
    return null
  } catch (e) {
    if (e instanceof RangeError) return { message: 'Nesting is too deep', pos: 0, line: 1, column: 1 }
    const { message, pos } = e as { message: string; pos: number }
    return { message, pos, ...posToLineCol(s, pos) }
  }
}

export type ParseResult = { ok: true; value: unknown; jsonl?: boolean } | { ok: false; error: JsonError }

export const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s)

/** NDJSON / JSON Lines: every non-empty line is its own JSON value. Returns null if it isn't. */
export function parseJsonLines(text: string): unknown[] | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return null
  const out: unknown[] = []
  for (const l of lines) {
    try {
      out.push(JSON.parse(l))
    } catch {
      return null
    }
  }
  return out
}

export function parseJson(raw: string): ParseResult {
  const text = stripBom(raw)
  if (!text.trim()) return { ok: false, error: { message: 'Nothing to parse. Paste some JSON first.', pos: 0, line: 1, column: 1 } }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    const lines = parseJsonLines(text)
    if (lines) return { ok: true, value: lines, jsonl: true }
    const error = findJsonError(text) ?? { message: 'Invalid JSON', pos: 0, line: 1, column: 1 }
    return { ok: false, error }
  }
}

/* ---------- Types ---------- */

export type JType = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array'

export const typeOf = (v: unknown): JType =>
  v === null ? 'null' : Array.isArray(v) ? 'array' : (typeof v as 'string' | 'number' | 'boolean' | 'object')

export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export type ColType = 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'mixed'

const DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/

/* ---------- Document stats ---------- */

export type DocStats = { objects: number; arrays: number; nodes: number; maxDepth: number }

export function documentStats(root: unknown): DocStats {
  const st: DocStats = { objects: 0, arrays: 0, nodes: 0, maxDepth: 0 }
  const stack: [unknown, number][] = [[root, 0]]
  while (stack.length) {
    const [v, d] = stack.pop()!
    st.nodes++
    if (d > st.maxDepth) st.maxDepth = d
    if (Array.isArray(v)) {
      st.arrays++
      for (let k = 0; k < v.length; k++) stack.push([v[k], d + 1])
    } else if (isPlainObject(v)) {
      if (d > 0) st.objects++
      for (const k in v) stack.push([v[k], d + 1])
    }
  }
  return st
}

export function describeStructure(root: unknown): string {
  if (Array.isArray(root)) {
    if (root.length === 0) return 'Empty array'
    const kinds = new Set(root.slice(0, 200).map(typeOf))
    if (kinds.size === 1) return kinds.has('object') ? 'Array of objects' : kinds.has('array') ? 'Array of arrays' : `Array of ${[...kinds][0]}s`
    return 'Mixed array'
  }
  if (isPlainObject(root)) {
    const keys = Object.keys(root)
    if (keys.length === 0) return 'Empty object'
    if (isKeyedMap(root)) return 'Keyed map of objects'
    return findBestArrayPath(root) ? 'Object with records' : 'Object'
  }
  return `Primitive (${typeOf(root)})`
}

/** An object whose values are all objects, such as { PAYIN: {...}, PAYOUT: {...} }. */
export const isKeyedMap = (v: unknown): boolean => {
  if (!isPlainObject(v)) return false
  const vals = Object.values(v)
  return vals.length >= 2 && vals.every(isPlainObject)
}

/** Look for the largest array of objects reachable through plain objects only. */
export function findBestArrayPath(root: unknown): (string | number)[] | null {
  if (Array.isArray(root)) return isPlainObject(root[0]) ? [] : null
  // A keyed map is already a table (one row per key). Don't dive into an arbitrary nested array.
  if (isKeyedMap(root)) return []
  let best: { path: string[]; len: number } | null = null
  const walk = (v: unknown, path: string[]) => {
    if (path.length > 4 || !isPlainObject(v)) return
    for (const k of Object.keys(v)) {
      const c = v[k]
      if (Array.isArray(c) && c.length && isPlainObject(c[0])) {
        if (!best || c.length > best.len) best = { path: [...path, k], len: c.length }
      } else walk(c, [...path, k])
    }
  }
  walk(root, [])
  return best ? (best as { path: string[] }).path : null
}

export const getAtPath = (root: unknown, path: (string | number)[]): unknown => {
  let cur: unknown = root
  for (const seg of path) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string | number, unknown>)[seg]
  }
  return cur
}

/** Resolve a path that may contain '*' wildcards (all items of an array). */
export function resolvePath(root: unknown, path: (string | number)[]): unknown {
  let values: unknown[] = [root]
  let wild = false
  for (const seg of path) {
    if (seg === '*') {
      wild = true
      values = values.flatMap((v) => (Array.isArray(v) ? v : []))
    } else {
      values = values.map((v) => (v != null && typeof v === 'object' ? (v as Record<string, unknown>)[seg] : undefined)).filter((v) => v !== undefined)
    }
  }
  if (!wild) return values[0]
  return values.flatMap((v) => (Array.isArray(v) ? v : [v]))
}

export const pathLabel = (path: (string | number)[]) =>
  path.length === 0 ? '$' : path.map((p) => (p === '*' ? '[*]' : String(p))).join('.').replace(/\.\[\*\]/g, '[*]')

/* ---------- Schema (for structure navigator) ---------- */

export type SchemaNode = {
  key: string
  path: (string | number)[]
  types: Set<JType>
  count: number
  children: Map<string, SchemaNode>
}

const mkNode = (key: string, path: (string | number)[]): SchemaNode => ({ key, path, types: new Set(), count: 0, children: new Map() })

export function buildSchema(root: unknown): SchemaNode {
  const top = mkNode('$', [])
  let budget = 60000
  const add = (node: SchemaNode, v: unknown, depth: number) => {
    if (budget-- <= 0) return
    node.count++
    const t = typeOf(v)
    node.types.add(t)
    if (depth > 12) return
    if (t === 'object') {
      for (const [k, c] of Object.entries(v as Record<string, unknown>)) {
        let child = node.children.get(k)
        if (!child) node.children.set(k, (child = mkNode(k, [...node.path, k])))
        add(child, c, depth + 1)
      }
    } else if (t === 'array') {
      for (const item of (v as unknown[]).slice(0, 500)) {
        if (isPlainObject(item)) {
          for (const [k, c] of Object.entries(item)) {
            let child = node.children.get(k)
            if (!child) node.children.set(k, (child = mkNode(k, [...node.path, '*', k])))
            add(child, c, depth + 1)
          }
        } else if (Array.isArray(item)) {
          // nested array of arrays: record a single synthetic child
          let child = node.children.get('[]')
          if (!child) node.children.set('[]', (child = mkNode('[]', [...node.path, '*'])))
          add(child, item, depth + 1)
        }
      }
    }
  }
  add(top, root, 0)
  return top
}

export const typeLabel = (t: JType) => t[0].toUpperCase() + t.slice(1)

/* ---------- Table model ---------- */

export type Row = { i: number; orig: unknown; flat: Record<string, unknown> }
export type Col = {
  key: string
  type: ColType
  width: number
  counts: Partial<Record<JType, number>>
  missing: number
}
export type TableModel = {
  rows: Row[]
  cols: Col[]
  kind: 'array' | 'object' | 'keyed' | 'primitive'
  notes: string[]
  nestedObjectCount: number
  arrayFieldCount: number
  typeSummary: Record<string, number>
}

const MAX_FLATTEN_DEPTH = 4

export function buildTable(data: unknown, flattenOn: boolean): TableModel {
  const notes: string[] = []
  let kind: TableModel['kind'] = 'array'
  let records: unknown[]
  let origs: unknown[]
  let keyCol = false

  if (Array.isArray(data)) {
    records = data
    origs = data
  } else if (isPlainObject(data)) {
    if (isKeyedMap(data)) {
      kind = 'keyed'
      keyCol = true
      records = Object.entries(data).map(([k, v]) => ({ _key: k, ...(v as object) }))
      origs = Object.entries(data).map(([k, v]) => ({ [k]: v }))
      notes.push('This object maps keys to records. Each key became a row, and the key is shown in the "_key" column.')
    } else {
      kind = 'object'
      records = [data]
      origs = [data]
      notes.push('Single object shown as one row. Use the structure sidebar to open an array inside it as a table.')
    }
  } else {
    kind = 'primitive'
    records = [data]
    origs = [data]
  }
  void keyCol

  const isMatrix = records.length > 0 && records.every((r) => Array.isArray(r) && r.every((x) => x === null || typeof x !== 'object'))
  if (isMatrix) notes.push('Each row is an array, so columns are named by position: [0], [1], …')
  let primitiveRows = 0
  const colMap = new Map<string, { counts: Partial<Record<JType, number>>; dates: number; strings: number; maxLen: number; present: number }>()
  const flattenedParents = new Set<string>()
  const rows: Row[] = new Array(records.length)

  for (let idx = 0; idx < records.length; idx++) {
    const rec = records[idx]
    const flat: Record<string, unknown> = Object.create(null)
    if (isPlainObject(rec)) {
      const put = (raw: string, v: unknown) => {
        // Empty and prototype-like keys would break column ids, so give them safe display names.
        const key = raw === '' ? '(empty key)' : raw === '__proto__' ? '[__proto__]' : raw
        let k = key
        let n = 2
        while (k in flat) k = `${key} (${n++})`
        flat[k] = v
      }
      const walk = (obj: Record<string, unknown>, prefix: string, depth: number) => {
        for (const k in obj) {
          const v = obj[k]
          const key = prefix ? `${prefix}.${k}` : k
          if (flattenOn && isPlainObject(v) && depth < MAX_FLATTEN_DEPTH && Object.keys(v).length > 0) {
            flattenedParents.add(key)
            walk(v, key, depth + 1)
          } else put(key, v)
        }
      }
      walk(rec, '', 0)
    } else if (isMatrix) {
      const arr = rec as unknown[]
      for (let c = 0; c < arr.length && c < 200; c++) flat[`[${c}]`] = arr[c]
    } else {
      primitiveRows++
      flat['value'] = rec
    }
    for (const k in flat) {
      const v = flat[k]
      let info = colMap.get(k)
      if (!info) colMap.set(k, (info = { counts: {}, dates: 0, strings: 0, maxLen: 0, present: 0 }))
      const t = typeOf(v)
      info.counts[t] = (info.counts[t] ?? 0) + 1
      info.present++
      if (idx < 200) {
        if (t === 'string') {
          info.strings++
          if (DATE_RE.test(v as string)) info.dates++
          info.maxLen = Math.max(info.maxLen, Math.min((v as string).length, 60))
        } else if (t === 'number') info.maxLen = Math.max(info.maxLen, String(v).length)
      }
    }
    rows[idx] = { i: idx, orig: origs[idx], flat }
  }

  if (primitiveRows > 0) notes.push(primitiveRows === records.length ? 'Items are not objects, so they are shown in a single "value" column.' : `${primitiveRows} item(s) are not objects and appear in the "value" column.`)
  if (flattenedParents.size) notes.push(`Nested objects were flattened using dot notation (${flattenedParents.size} group${flattenedParents.size > 1 ? 's' : ''}). Arrays stay intact and can be opened as their own tables.`)

  const cols: Col[] = []
  const typeSummary: Record<string, number> = {}
  let arrayFieldCount = 0
  let objectCols = 0
  for (const [key, info] of colMap) {
    const present = Object.keys(info.counts).filter((t) => t !== 'null') as JType[]
    let type: ColType
    if (present.length === 0) type = 'string'
    else if (present.length > 1) type = 'mixed'
    else {
      const t = present[0]
      type = t === 'string' ? (info.dates >= Math.min(info.strings, 200) * 0.9 && info.dates > 0 ? 'date' : 'string') : (t as ColType)
    }
    if (info.counts.array) arrayFieldCount++
    if (info.counts.object) objectCols++
    typeSummary[type] = (typeSummary[type] ?? 0) + 1
    const headW = key.length * 7.4 + 64
    const bodyW = type === 'object' || type === 'array' ? 150 : type === 'boolean' ? 90 : info.maxLen * 7.2 + 36
    cols.push({
      key,
      type,
      counts: info.counts,
      missing: records.length - info.present,
      width: Math.round(Math.max(90, Math.min(360, Math.max(headW, bodyW)))),
    })
  }
  return {
    rows,
    cols,
    kind,
    notes,
    nestedObjectCount: flattenedParents.size + objectCols,
    arrayFieldCount,
    typeSummary,
  }
}

export const previewOf = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.length}]`
  if (isPlainObject(v)) return `{${Object.keys(v).length}}`
  return String(v)
}

export function cellText(v: unknown): string {
  if (v === undefined) return ''
  if (v === null) return 'null'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** A readable path for one row, e.g. $.users[3] or, for keyed maps, $.PAYIN. */
export const rowRef = (label: string, kind: TableModel['kind'], row: Row): string =>
  kind === 'keyed' && typeof row.flat['_key'] === 'string' ? `${label}.${row.flat['_key']}` : `${label}[${row.i}]`
