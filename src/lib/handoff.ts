/* Opening a nested table in a new browser tab, with no server involved.
 *
 * The original tab keeps the data in memory and opens  ?handoff=<id>  in a new tab. The new tab asks its
 * opener for the payload over postMessage (same origin, no size limit) and caches it in sessionStorage so
 * that reloading the new tab still works. */
import { toast } from './util'

export type Payload = { label: string; data: unknown }

const pending = new Map<string, Payload>()
const KEY = 'jsonlet:handoff:'

/* ---- Cmd/Ctrl+click detection ----
 * Many different buttons can open a table, so instead of threading the mouse event through every layer
 * we remember the modifier keys of the most recent click. */
let lastClick = { newTab: false, t: 0 }
if (typeof window !== 'undefined') {
  window.addEventListener(
    'click',
    (e) => {
      lastClick = { newTab: e.metaKey || e.ctrlKey, t: Date.now() }
    },
    true,
  )
}
export const newTabRequested = () => lastClick.newTab && Date.now() - lastClick.t < 600

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))

export function openInNewTab(label: string, data: unknown): boolean {
  const id = newId()
  pending.set(id, { label, data })
  const w = window.open(`${location.pathname}?handoff=${id}`, '_blank')
  if (!w) {
    pending.delete(id)
    toast('Your browser blocked the new tab. Allow pop-ups for this site and try again.', 'err')
    return false
  }
  return true
}

/** Call once in the tab that owns the data. Answers requests coming from tabs it opened. */
export function installHandoffServer(): () => void {
  const onMsg = (ev: MessageEvent) => {
    if (ev.origin !== location.origin) return
    const m = ev.data as { type?: string; id?: string } | null
    if (m?.type !== 'jsonlet-request' || !m.id) return
    const p = pending.get(m.id)
    ;(ev.source as Window | null)?.postMessage(p ? { type: 'jsonlet-payload', id: m.id, label: p.label, data: p.data } : { type: 'jsonlet-missing', id: m.id }, location.origin)
  }
  window.addEventListener('message', onMsg)
  return () => window.removeEventListener('message', onMsg)
}

export const readHandoffId = (): string | null => new URLSearchParams(location.search).get('handoff')

export function receiveHandoff(id: string, timeoutMs = 6000): Promise<Payload | null> {
  try {
    const cached = sessionStorage.getItem(KEY + id)
    if (cached) return Promise.resolve(JSON.parse(cached) as Payload)
  } catch {
    /* fall through to the opener */
  }
  return new Promise((resolve) => {
    const opener = window.opener as Window | null
    if (!opener || opener.closed) return resolve(null)
    const done = (p: Payload | null) => {
      window.removeEventListener('message', onMsg)
      clearTimeout(timer)
      resolve(p)
    }
    const onMsg = (ev: MessageEvent) => {
      if (ev.origin !== location.origin || ev.source !== opener) return
      const m = ev.data as { type?: string; id?: string; label?: string; data?: unknown } | null
      if (!m || m.id !== id) return
      if (m.type === 'jsonlet-payload') {
        const p = { label: m.label ?? 'table', data: m.data }
        try {
          sessionStorage.setItem(KEY + id, JSON.stringify(p))
        } catch {
          /* too big to cache; reloading will ask the opener again */
        }
        done(p)
      } else if (m.type === 'jsonlet-missing') done(null)
    }
    window.addEventListener('message', onMsg)
    const timer = setTimeout(() => done(null), timeoutMs)
    opener.postMessage({ type: 'jsonlet-request', id }, location.origin)
  })
}
