import { findJsonError } from './json'

/** Fixes common near-JSON: comments, single quotes, unquoted keys, trailing commas, Python/JS literals. */
export function repairJson(input: string): { text: string; valid: boolean } {
  const s = input.replace(/^\uFEFF/, '')
  let out = ''
  let i = 0
  const n = s.length
  while (i < n) {
    const c = s[i]
    if (c === '"') {
      let j = i + 1
      while (j < n && s[j] !== '"') j += s[j] === '\\' ? 2 : 1
      out += s.slice(i, j + 1)
      i = j + 1
    } else if (c === "'") {
      let j = i + 1
      let body = ''
      while (j < n && s[j] !== "'") {
        if (s[j] === '\\' && j + 1 < n) {
          body += s[j + 1] === "'" ? "'" : s[j] + s[j + 1]
          j += 2
        } else {
          body += s[j] === '"' ? '\\"' : s[j]
          j++
        }
      }
      out += `"${body}"`
      i = j + 1
    } else if (c === '/' && s[i + 1] === '/') {
      while (i < n && s[i] !== '\n') i++
    } else if (c === '/' && s[i + 1] === '*') {
      const e = s.indexOf('*/', i + 2)
      i = e === -1 ? n : e + 2
    } else if (c === '#') {
      while (i < n && s[i] !== '\n') i++
    } else if (/[A-Za-z_$]/.test(c)) {
      let j = i
      while (j < n && /[\w$]/.test(s[j])) j++
      const word = s.slice(i, j)
      let k = j
      while (k < n && /\s/.test(s[k])) k++
      if (s[k] === ':') out += `"${word}"`
      else {
        const map: Record<string, string> = { True: 'true', False: 'false', None: 'null', undefined: 'null', NaN: 'null', Infinity: 'null' }
        out += map[word] ?? word
      }
      i = j
    } else {
      out += c
      i++
    }
  }
  // Remove trailing commas (string-aware).
  let res = ''
  for (let p = 0; p < out.length; p++) {
    const c = out[p]
    if (c === '"') {
      let q = p + 1
      while (q < out.length && out[q] !== '"') q += out[q] === '\\' ? 2 : 1
      res += out.slice(p, q + 1)
      p = q
    } else if (c === ',') {
      let q = p + 1
      while (q < out.length && /\s/.test(out[q])) q++
      if (out[q] !== ']' && out[q] !== '}') res += c
    } else res += c
  }
  return { text: res, valid: findJsonError(res) === null }
}
