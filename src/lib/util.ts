import Papa from 'papaparse'
import { cellText } from './json'

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/* ---------- toast (tiny pub/sub) ---------- */
type ToastMsg = { id: number; text: string; tone: 'ok' | 'err' | 'info' }
let toastId = 0
const listeners = new Set<(t: ToastMsg) => void>()
export const onToast = (fn: (t: ToastMsg) => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}
export const toast = (text: string, tone: ToastMsg['tone'] = 'ok') => listeners.forEach((l) => l({ id: ++toastId, text, tone }))
export type { ToastMsg }

/* ---------- clipboard & files ---------- */
export async function copyText(text: string, label = 'Copied to clipboard') {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  toast(label)
}

export function download(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const toCsv = (keys: string[], rows: Record<string, unknown>[]) =>
  Papa.unparse(
    {
      fields: keys,
      data: rows.map((r) => keys.map((k) => (r[k] === undefined ? '' : typeof r[k] === 'object' && r[k] !== null ? JSON.stringify(r[k]) : r[k] === null ? '' : r[k]))),
    },
    { newline: '\n' },
  )

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`)

export const timeAgo = (t: number, now = Date.now()) => {
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return new Date(t).toLocaleTimeString()
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
export const MOD = isMac ? '⌘' : 'Ctrl'

/* ---------- highlight helpers ---------- */
export function splitMatches(text: string, q: string): { t: string; hit: boolean }[] {
  if (!q) return [{ t: text, hit: false }]
  const out: { t: string; hit: boolean }[] = []
  const lower = text.toLowerCase()
  const lq = q.toLowerCase()
  let from = 0
  for (let at = lower.indexOf(lq); at !== -1; at = lower.indexOf(lq, from)) {
    if (at > from) out.push({ t: text.slice(from, at), hit: false })
    out.push({ t: text.slice(at, at + q.length), hit: true })
    from = at + q.length
  }
  if (from < text.length) out.push({ t: text.slice(from), hit: false })
  return out
}

export const stringifyCell = cellText
