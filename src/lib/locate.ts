/* Maps a path inside the parsed document (["PAYIN", "debitEntry"], ["users", 3, "name"]) to a character
 * range in the original JSON text, so the editor can scroll to it. Works on the text exactly as written
 * (any formatting, any key order) and understands JSON Lines. */

export type Segment = string | number
export type Loc = { from: number; to: number }

/* ---------- path index: object reference -> its path in the document ---------- */
type Entry = { parent: object; key: Segment }
export type PathIndex = { root: unknown; map: WeakMap<object, Entry> }

export function buildPathIndex(root: unknown): PathIndex {
  const map = new WeakMap<object, Entry>()
  if (root !== null && typeof root === 'object') {
    const stack: object[] = [root]
    while (stack.length) {
      const o = stack.pop()!
      if (Array.isArray(o)) {
        for (let i = 0; i < o.length; i++) {
          const c = o[i]
          if (c !== null && typeof c === 'object') {
            map.set(c, { parent: o, key: i })
            stack.push(c)
          }
        }
      } else {
        for (const k in o as Record<string, unknown>) {
          const c = (o as Record<string, unknown>)[k]
          if (c !== null && typeof c === 'object') {
            map.set(c, { parent: o, key: k })
            stack.push(c)
          }
        }
      }
    }
  }
  return { root, map }
}

export function pathOf(idx: PathIndex, obj: unknown): Segment[] | null {
  if (obj === idx.root) return []
  if (obj === null || typeof obj !== 'object') return null
  const out: Segment[] = []
  let cur: object = obj
  while (cur !== idx.root) {
    const e = idx.map.get(cur)
    if (!e) return null
    out.push(e.key)
    cur = e.parent
  }
  return out.reverse()
}

/* ---------- text scanner ---------- */
const isWs = (c: number) => c === 32 || c === 10 || c === 13 || c === 9

function skipString(t: string, i: number): number {
  // t[i] is the opening quote; returns the index just after the closing quote
  for (let j = i + 1; j < t.length; j++) {
    const c = t.charCodeAt(j)
    if (c === 92) j++
    else if (c === 34) return j + 1
  }
  return t.length
}

function skipValue(t: string, i: number): number {
  const c = t[i]
  if (c === '"') return skipString(t, i)
  if (c === '{' || c === '[') {
    let depth = 0
    for (let j = i; j < t.length; j++) {
      const ch = t[j]
      if (ch === '"') j = skipString(t, j) - 1
      else if (ch === '{' || ch === '[') depth++
      else if (ch === '}' || ch === ']') {
        if (--depth === 0) return j + 1
      }
    }
    return t.length
  }
  let j = i
  while (j < t.length && !isWs(t.charCodeAt(j)) && t[j] !== ',' && t[j] !== '}' && t[j] !== ']') j++
  return j
}

function locateIn(t: string, start: number, path: Segment[]): Loc | null {
  let i = start
  const ws = () => {
    while (i < t.length && isWs(t.charCodeAt(i))) i++
  }
  ws()
  if (path.length === 0) return { from: i, to: Math.min(t.length, i + 1) }
  for (let s = 0; s < path.length; s++) {
    const seg = path[s]
    const last = s === path.length - 1
    ws()
    if (t[i] === '{') {
      i++
      let found = false
      for (;;) {
        ws()
        if (t[i] !== '"') return null
        const ks = i
        const ke = skipString(t, i)
        const raw = t.slice(ks + 1, ke - 1)
        const key = raw.includes('\\') ? (() => { try { return JSON.parse(t.slice(ks, ke)) as string } catch { return raw } })() : raw
        i = ke
        ws()
        if (t[i] !== ':') return null
        i++
        ws()
        if (key === String(seg)) {
          if (last) return { from: ks, to: ke }
          found = true
          break
        }
        i = skipValue(t, i)
        ws()
        if (t[i] === ',') i++
        else return null
      }
      if (!found) return null
    } else if (t[i] === '[') {
      i++
      let idx = 0
      let found = false
      for (;;) {
        ws()
        if (t[i] === ']' || i >= t.length) return null
        if (idx === seg) {
          if (last) return { from: i, to: Math.min(t.length, i + 1) }
          found = true
          break
        }
        i = skipValue(t, i)
        ws()
        if (t[i] === ',') {
          i++
          idx++
        } else return null
      }
      if (!found) return null
    } else return null
  }
  return null
}

export function locatePath(text: string, path: Segment[]): Loc | null {
  const start = text.charCodeAt(0) === 0xfeff ? 1 : 0
  let i = start
  while (i < text.length && isWs(text.charCodeAt(i))) i++
  // JSON Lines: a complete first value followed by more content means one document per line.
  const firstEnd = skipValue(text, i)
  let rest = firstEnd
  while (rest < text.length && isWs(text.charCodeAt(rest))) rest++
  if (rest < text.length && typeof path[0] === 'number') {
    const n = path[0]
    let seen = 0
    let pos = 0
    for (const line of text.split('\n')) {
      if (line.trim() !== '') {
        if (seen === n) return locateIn(text, pos, path.slice(1))
        seen++
      }
      pos += line.length + 1
    }
    return null
  }
  return locateIn(text, start, path)
}
