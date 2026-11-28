/* Local session persistence. Everything stays in this browser (IndexedDB); nothing is sent anywhere.
 *
 * Each browser tab gets its own record, keyed by a tab id kept in sessionStorage. That means:
 *   - reloading, or going Back out of the app and Forward again, restores the same tab's work;
 *   - two tabs never overwrite each other;
 *   - a brand new tab starts empty.
 * Records older than 7 days are deleted on startup. */

const DB_NAME = 'jsonlet'
const STORE = 'sessions'
const MAX_AGE_MS = 7 * 24 * 3600 * 1000
const MAX_CHARS = 80_000_000 // stay well inside browser storage quotas

export type SavedSession = {
  id: string
  updatedAt: number
  text: string
  /** The text the table was built from. Omitted (and flagged) when it equals `text`, to avoid storing it twice. */
  processedText: string
  processedSame: boolean
  source: string
  docSource: string
  view: string
  diffA: string
  diffB: string
}

/* ---------- IndexedDB plumbing ---------- */
let dbp: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is unavailable'))
      let req: IDBOpenDBRequest
      try {
        req = indexedDB.open(DB_NAME, 1)
      } catch (e) {
        return reject(e)
      }
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
      req.onblocked = () => reject(new Error('IndexedDB is blocked'))
    })
    dbp.catch(() => {
      dbp = null // allow a later retry
    })
  }
  return dbp
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(req.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

/** Returns false (never throws) when the data could not be stored. */
export async function saveSession(s: SavedSession): Promise<boolean> {
  if (s.text.length + s.processedText.length + s.diffA.length + s.diffB.length > MAX_CHARS) return false
  try {
    await withStore('readwrite', (st) => st.put(s))
    return true
  } catch {
    return false
  }
}

export async function loadSession(id: string): Promise<SavedSession | null> {
  const v = await withStore<SavedSession | undefined>('readonly', (st) => st.get(id))
  return v ?? null
}

export async function deleteSession(id: string): Promise<void> {
  try {
    await withStore('readwrite', (st) => st.delete(id))
  } catch {
    /* nothing to delete, or storage unavailable */
  }
}

/** Removes records that haven't been touched for a week. Uses a key-only cursor so large values aren't loaded. */
export async function pruneSessions(): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const range = IDBKeyRange.upperBound(Date.now() - MAX_AGE_MS)
      store.index('updatedAt').openKeyCursor(range).onsuccess = (e) => {
        const c = (e.target as IDBRequest<IDBCursor | null>).result
        if (!c) return
        store.delete(c.primaryKey)
        c.continue()
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    })
  } catch {
    /* ignore */
  }
}

/* ---------- tab identity ---------- */
const TAB_KEY = 'jx-tab'
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))

/** Holds a Web Lock for the life of the page. Resolves false if another live page already owns this id. */
function claimLock(id: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.locks) return Promise.resolve(true)
  return new Promise((resolve) => {
    navigator.locks
      .request(`jsonlet-tab-${id}`, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(false)
          return undefined
        }
        resolve(true)
        return new Promise<never>(() => {}) // never settles: the lock is released when the page goes away
      })
      .catch(() => resolve(true))
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let claimed: Promise<string> | null = null

/**
 * The id of this tab's session record. sessionStorage survives reloads and Back/Forward, but it is also
 * copied when a tab is duplicated, so a lock is used to make sure two live tabs never share one id.
 * Memoised so React StrictMode's double effect run can't make a page lock itself out.
 */
export function claimTabId(): Promise<string> {
  if (!claimed) {
    claimed = (async () => {
      let id: string | null = null
      try {
        id = sessionStorage.getItem(TAB_KEY)
      } catch {
        /* storage blocked: fall through to a fresh id */
      }
      if (id) {
        // After a reload the previous page may still be releasing its lock for a moment.
        for (let attempt = 0; attempt < 4; attempt++) {
          if (await claimLock(id)) return id
          await sleep(100)
        }
      }
      const fresh = newId()
      await claimLock(fresh)
      try {
        sessionStorage.setItem(TAB_KEY, fresh)
      } catch {
        /* ignore */
      }
      return fresh
    })()
  }
  return claimed
}
