/* Whitespace-only JSON formatting.
 *
 * JSON.stringify(JSON.parse(text)) is NOT safe for display: it rounds integers above 2^53
 * (12345678901234567890 becomes 12345678901234567000) and rewrites 1.0, 1e3 and 0.10 as 1, 1000 and 0.1.
 * These functions only add or remove whitespace between tokens, so every string, number and key is kept
 * exactly as written. Input must already be valid JSON. */
import { findJsonError, stripBom } from './json'

const isWs = (c: number) => c === 32 || c === 10 || c === 13 || c === 9

function skipString(t: string, i: number): number {
  for (let j = i + 1; j < t.length; j++) {
    const c = t.charCodeAt(j)
    if (c === 92) j++
    else if (c === 34) return j + 1
  }
  return t.length
}

export function formatJsonText(text: string, indent = 2): string {
  const unit = ' '.repeat(indent)
  const n = text.length
  const out: string[] = []
  let depth = 0
  let i = 0
  const line = () => '\n' + unit.repeat(depth)
  while (i < n) {
    const c = text[i]
    const code = text.charCodeAt(i)
    if (isWs(code)) {
      i++
    } else if (c === '"') {
      const j = skipString(text, i)
      out.push(text.slice(i, j))
      i = j
    } else if (c === '{' || c === '[') {
      let k = i + 1
      while (k < n && isWs(text.charCodeAt(k))) k++
      if (text[k] === (c === '{' ? '}' : ']')) {
        out.push(c + text[k]) // empty containers stay on one line
        i = k + 1
      } else {
        depth++
        out.push(c + line())
        i++
      }
    } else if (c === '}' || c === ']') {
      depth = Math.max(0, depth - 1)
      out.push(line() + c)
      i++
    } else if (c === ',') {
      out.push(',' + line())
      i++
    } else if (c === ':') {
      out.push(': ')
      i++
    } else {
      // number, true, false or null: copied verbatim
      let j = i
      while (j < n) {
        const d = text.charCodeAt(j)
        if (isWs(d) || d === 44 || d === 58 || d === 93 || d === 125) break
        j++
      }
      if (j === i) j = i + 1 // never stall on an unexpected character
      out.push(text.slice(i, j))
      i = j
    }
  }
  return out.join('')
}

export function minifyJsonText(text: string): string {
  const n = text.length
  const out: string[] = []
  let i = 0
  while (i < n) {
    const code = text.charCodeAt(i)
    if (isWs(code)) {
      i++
    } else if (code === 34) {
      const j = skipString(text, i)
      out.push(text.slice(i, j))
      i = j
    } else {
      let j = i + 1
      while (j < n && !isWs(text.charCodeAt(j)) && text.charCodeAt(j) !== 34) j++
      out.push(text.slice(i, j))
      i = j
    }
  }
  return out.join('')
}

const MAX_AUTOFORMAT = 8_000_000

/**
 * What to insert when `pasted` lands in an editor: the formatted text if it is one valid JSON document that
 * formatting would actually change, otherwise null (leave the paste alone). JSON Lines, invalid JSON, bare
 * primitives and very large pastes are never touched.
 */
export function autoFormatPaste(pasted: string): string | null {
  if (pasted.length > MAX_AUTOFORMAT) return null
  const t = stripBom(pasted).trim()
  const first = t[0]
  if (first !== '{' && first !== '[') return null
  if (findJsonError(t) !== null) return null
  const formatted = formatJsonText(t)
  return formatted === pasted ? null : formatted
}
