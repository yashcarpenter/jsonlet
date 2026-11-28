import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Unplug } from 'lucide-react'
import { TopNavigation, type ViewId } from './components/TopNavigation'
import { EmptyState } from './components/EmptyState'
import { TableView, type Doc } from './components/TableView'
import { DocsView } from './components/DocsView'
import { DiffView, type DiffState } from './components/DiffView'
import { AboutModal, KeyboardShortcutsModal } from './components/KeyboardShortcutsModal'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ErrorState } from './components/ErrorState'
import { Button, Toaster } from './components/ui'
import type { Validation } from './components/JsonInputEditor'
import type { WorkspaceApi } from './components/TableWorkspace'
import { buildSchema, describeStructure, parseJson, type JsonError, type ParseResult } from './lib/json'
import { SAMPLES } from './lib/samples'
import { installHandoffServer, readHandoffId, receiveHandoff } from './lib/handoff'
import { claimTabId, deleteSession, loadSession, pruneSessions, saveSession } from './lib/persist'
import { autoFormatPaste } from './lib/format'
import { lsGet, lsSet, toast } from './lib/util'

const BIG_FILE = 2 * 1024 * 1024
const WARN_FILE = 30 * 1024 * 1024
const MAX_FILE = 250 * 1024 * 1024
const MAX_EDIT = 5 * 1024 * 1024
// Integers with 17+ digits can't be represented exactly by JavaScript numbers.
const BIG_INT = /[:[,\s]-?\d{17,}(?=[\s,\]}]|$)/

const makeDoc = (value: unknown, src: string, id: number, structure?: string): Doc => ({
  id,
  root: value,
  source: src,
  processedAt: Date.now(),
  schema: buildSchema(value),
  structure: structure ?? describeStructure(value),
})
const jsonlLabel = (value: unknown) => `JSON Lines · ${(value as unknown[]).length.toLocaleString()} records`

function validationFrom(text: string, r: ParseResult | null): Validation {
  const bytes = new Blob([text]).size
  const lines = text ? text.split('\n').length : 0
  if (!r) return { status: 'empty', lines, bytes }
  if (!r.ok) return { status: 'invalid', error: r.error, lines, bytes }
  return { status: 'valid', lines, bytes, jsonl: r.jsonl ? (r.value as unknown[]).length : undefined }
}

type IngestOpts = {
  structure?: string
  /** Update the open document in place (same document id) so the table view and the editor are NOT rebuilt. */
  keep?: boolean
  /** Switch to the table view afterwards. Defaults to true for new documents and false for in-place updates. */
  navigate?: boolean
}

export default function App() {
  const handoffId = useRef(readHandoffId()).current
  const [handoff, setHandoff] = useState<'idle' | 'loading' | 'failed'>(handoffId ? 'loading' : 'idle')
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [view, setView] = useState<ViewId>('editor')
  const [text, setText] = useState('')
  const [processedText, setProcessedText] = useState('')
  const [source, setSource] = useState('untitled.json')
  const [doc, setDoc] = useState<Doc | null>(null)
  const [processing, setProcessing] = useState(false)
  const [validation, setValidation] = useState<Validation>({ status: 'empty', lines: 0, bytes: 0 })
  const [diff, setDiff] = useState<DiffState>({ a: '', b: '' })
  const [modal, setModal] = useState<'shortcuts' | 'about' | null>(null)
  const [liveOn, setLiveOn] = useState(() => lsGet('jx-live') !== '0')
  const [restoring, setRestoring] = useState(!handoffId)
  const [persistFailed, setPersistFailed] = useState(false)
  const tabIdRef = useRef<string | null>(null)
  const apiRef = useRef<WorkspaceApi | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const docId = useRef(0)

  /* Views are browser history entries, so Back/Forward move between Editor, Table, Compare and Docs
     instead of leaving the app. */
  const go = useCallback((v: ViewId) => {
    setView(v)
    if ((history.state as { jxView?: string } | null)?.jxView !== v) history.pushState({ jxView: v }, '')
  }, [])

  useEffect(() => {
    if (!(history.state as { jxView?: string } | null)?.jxView) history.replaceState({ jxView: 'editor' }, '')
    const onPop = (e: PopStateEvent) => {
      const v = (e.state as { jxView?: ViewId } | null)?.jxView
      if (!v) return
      setView(v === 'table' && !stateRef.current.doc ? 'editor' : v)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    lsSet('jx-theme', dark ? 'dark' : 'light')
  }, [dark])

  // Lets tabs we open (Cmd/Ctrl+click on "Open as table") fetch their data from this one.
  useEffect(() => installHandoffServer(), [])

  useEffect(() => {
    document.title = doc ? `${doc.source} · Jsonlet` : 'Jsonlet'
  }, [doc])

  const stateRef = useRef({ text, source, view, doc, processedText, processing, diff, liveOn })
  stateRef.current = { text, source, view, doc, processedText, processing, diff, liveOn }

  const ingest = useCallback(
    (value: unknown, src: string, t: string, o: IngestOpts = {}) => {
      const prev = stateRef.current.doc
      if (o.keep && prev) {
        // Same id => TableView (and the editor inside it) stays mounted, keeping undo history, cursor, filters and sort.
        setDoc({ ...prev, root: value, source: src, processedAt: Date.now(), schema: buildSchema(value), structure: o.structure ?? describeStructure(value) })
      } else {
        setDoc(makeDoc(value, src, ++docId.current, o.structure))
      }
      setProcessedText(t)
      if (o.navigate ?? !o.keep) go('table')
    },
    [go],
  )

  const run = useCallback(
    (t: string, src: string, o: { keep?: boolean; navigate?: boolean } = {}) => {
      setProcessing(true)
      // Yield to the browser so the spinner can paint before parsing large payloads.
      setTimeout(() => {
        try {
          const r = parseJson(t)
          if (!r.ok) {
            const e: JsonError = r.error
            setValidation({ status: 'invalid', error: e, lines: t.split('\n').length, bytes: new Blob([t]).size })
            toast(`Invalid JSON: ${e.message} (line ${e.line}, col ${e.column})`, 'err')
            if (!o.keep) go('editor')
            return
          }
          ingest(r.value, src, t, { structure: r.jsonl ? jsonlLabel(r.value) : undefined, keep: o.keep, navigate: o.navigate })
          if (r.jsonl && !o.keep) toast('Detected JSON Lines. Each line became a record.', 'info')
          if (BIG_INT.test(t)) toast('This JSON has integers above 9,007,199,254,740,991. JavaScript may round them in the table. Your original text is unchanged.', 'info')
        } catch (e) {
          toast(`Could not process this JSON: ${e instanceof Error ? e.message : 'unknown error'}`, 'err')
        } finally {
          setProcessing(false)
        }
      }, 40)
    },
    [ingest, go],
  )

  /* ---- real-time compile ----
     Validates the editor after a short pause and, if the JSON is valid and a table is open, updates that table in
     place. Invalid or half-typed JSON never touches the table: it keeps showing the last valid document. */
  useEffect(() => {
    const delay = text.length > 2_000_000 ? 1200 : text.length > 500_000 ? 700 : text.length > 100_000 ? 400 : 250
    const t = setTimeout(() => {
      const r = text.trim() ? parseJson(text) : null
      setValidation(validationFrom(text, r))
      const s = stateRef.current
      if (r && r.ok && s.liveOn && s.doc && !s.processing && text !== s.processedText) {
        ingest(r.value, s.source, text, { structure: r.jsonl ? jsonlLabel(r.value) : undefined, keep: true, navigate: false })
      }
    }, delay)
    return () => clearTimeout(t)
  }, [text, ingest])

  // Turning Live on applies any edits that were waiting.
  useEffect(() => {
    if (!liveOn) return
    const s = stateRef.current
    if (!s.doc || !s.text.trim() || s.text === s.processedText) return
    const r = parseJson(s.text)
    if (r.ok) ingest(r.value, s.source, s.text, { structure: r.jsonl ? jsonlLabel(r.value) : undefined, keep: true, navigate: false })
  }, [liveOn, ingest])

  const toggleLive = (v: boolean) => {
    setLiveOn(v)
    lsSet('jx-live', v ? '1' : '0')
    toast(v ? 'Live updates on. The table follows your edits.' : `Live updates off. Use Update table or ${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter.`, 'info')
  }

  // A tab opened from another tab's "Open as table" receives its data here.
  useEffect(() => {
    if (!handoffId) return
    let alive = true
    receiveHandoff(handoffId).then((p) => {
      if (!alive) return
      if (!p) return setHandoff('failed')
      const pretty = JSON.stringify(p.data, null, 2) ?? ''
      setSource(`${p.label}`)
      setText(pretty.length < BIG_FILE ? pretty : '')
      ingest(p.data, p.label, pretty.length < BIG_FILE ? pretty : '')
      setHandoff('idle')
    })
    return () => {
      alive = false
    }
  }, [handoffId, ingest])


  /* ---- restore the previous session of this tab ---- */
  useEffect(() => {
    if (handoffId) return
    let alive = true
    ;(async () => {
      try {
        const id = await claimTabId()
        tabIdRef.current = id
        void pruneSessions()
        const s = await loadSession(id)
        if (!alive) return
        if (s && (s.text || s.processedText || s.processedSame || s.diffA || s.diffB)) {
          const processed = s.processedSame ? s.text : s.processedText
          let restoredDoc = false
          if (processed) {
            const r = parseJson(processed)
            if (r.ok) {
              setDoc(makeDoc(r.value, s.docSource || s.source, ++docId.current, r.jsonl ? jsonlLabel(r.value) : undefined))
              setProcessedText(processed)
              restoredDoc = true
            }
          }
          setText(s.text)
          setSource(s.source)
          setDiff({ a: s.diffA, b: s.diffB })
          let v = ((history.state as { jxView?: ViewId } | null)?.jxView ?? s.view ?? 'editor') as ViewId
          if (v === 'table' && !restoredDoc) v = 'editor'
          setView(v)
          history.replaceState({ jxView: v }, '')
          toast('Restored your previous session', 'info')
        }
      } catch {
        if (alive) setPersistFailed(true) // storage unavailable: the app still works, it just can't remember
      } finally {
        if (alive) setRestoring(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [handoffId])

  /* ---- autosave ---- */
  const persistNow = useCallback(() => {
    const id = tabIdRef.current
    if (!id) return
    const st = stateRef.current
    if (!st.text && !st.processedText && !st.diff.a && !st.diff.b) {
      void deleteSession(id)
      return
    }
    const same = st.processedText !== '' && st.processedText === st.text
    void saveSession({
      id,
      updatedAt: Date.now(),
      text: st.text,
      processedText: same ? '' : st.processedText,
      processedSame: same,
      source: st.source,
      docSource: st.doc?.source ?? st.source,
      view: st.view,
      diffA: st.diff.a,
      diffB: st.diff.b,
    }).then((ok) => setPersistFailed((f) => (f === !ok ? f : !ok)))
  }, [])

  useEffect(() => {
    if (restoring || handoffId) return
    const t = setTimeout(persistNow, 400)
    return () => clearTimeout(t)
  }, [text, processedText, source, view, diff, doc, restoring, handoffId, persistNow])

  // Write immediately when the tab is hidden or being left, so the last keystrokes aren't lost.
  useEffect(() => {
    if (restoring || handoffId) return
    const onVis = () => document.visibilityState === 'hidden' && persistNow()
    window.addEventListener('pagehide', persistNow)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('pagehide', persistNow)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [restoring, handoffId, persistNow])

  const processCurrent = useCallback(() => {
    const s = stateRef.current
    if (s.processing) return
    if (!s.text.trim()) return toast('Paste some JSON first', 'info')
    // Explicit update: keep the open table (and editor history) if there is one, and show the table.
    run(s.text, s.source, { keep: !!s.doc, navigate: true })
  }, [run])

  const loadSample = (id: string) => {
    const s = SAMPLES.find((x) => x.id === id)!
    setText(JSON.stringify(s.make(), null, 2))
    setSource(s.file)
  }
  const exploreSample = () => {
    const s = SAMPLES[0]
    const t = JSON.stringify(s.make(), null, 2)
    setText(t)
    setSource(s.file)
    run(t, s.file)
  }

  const loadFiles = async (files: FileList | File[] | null) => {
    const list = files ? [...files] : []
    if (!list.length) return
    const f = list[0]
    if (list.length > 1) toast(`Loaded "${f.name}". Only one file can be opened at a time.`, 'info')
    if (f.size === 0) return toast(f.type === '' && !f.name.includes('.') ? 'That looks like a folder or an empty file. Choose a JSON file.' : `"${f.name}" is empty.`, 'err')
    if (f.size > MAX_FILE) return toast(`"${f.name}" is ${(f.size / 1048576).toFixed(0)} MB. That is too large to process in a browser tab.`, 'err')
    if (f.size > WARN_FILE) toast(`Large file (${(f.size / 1048576).toFixed(0)} MB). This can take a while and use a lot of memory.`, 'info')
    setProcessing(true)
    let t: string
    try {
      t = await f.text()
    } catch {
      setProcessing(false)
      return toast(`Could not read "${f.name}".`, 'err')
    }
    if (t.includes('\u0000')) {
      setProcessing(false)
      return toast(`"${f.name}" looks like a binary file, not JSON.`, 'err')
    }
    setSource(f.name)
    if (f.size > BIG_FILE) {
      setText('')
      toast(`Large file (${(f.size / 1048576).toFixed(1)} MB). Editor preview skipped to keep things fast.`, 'info')
    } else setText(t)
    run(t, f.name)
  }

  const dropText = (t: string) => {
    if (!t.trim()) return
    const formatted = lsGet('jx-autoformat') !== '0' ? autoFormatPaste(t) : null
    setText(formatted ?? t)
    setSource('pasted.json')
    toast(formatted ? 'Dropped JSON was formatted and loaded into the editor' : 'Dropped text loaded into the editor', 'info')
  }

  const clearAll = () => {
    if ((doc || text) && !window.confirm('Clear all data? The current JSON and table will be removed.')) return
    setText('')
    setProcessedText('')
    setDoc(null)
    setSource('untitled.json')
    setDiff({ a: '', b: '' })
    go('editor')
    if (tabIdRef.current) void deleteSession(tabIdRef.current)
    toast('Workspace cleared', 'info')
  }

  const editJson = () => {
    if (!text && doc) {
      const pretty = JSON.stringify(doc.root, null, 2)
      if (pretty.length > MAX_EDIT) return toast('This document is too large to edit in the browser editor. Use Replace JSON instead.', 'err')
      setText(pretty)
      setProcessedText(pretty)
    }
  }

  const dirty = !!doc && text !== '' && text !== processedText

  // Work is autosaved, so a warning is only needed when saving is impossible (e.g. storage blocked).
  const hasContent = text.trim() !== '' || (diff.a.trim() !== '' && diff.b.trim() !== '')
  useEffect(() => {
    if (!persistFailed || !hasContent) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [persistFailed, hasContent])

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const s = stateRef.current
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (!s.doc) return
        go('table')
        setTimeout(() => {
          const el = document.getElementById('global-search') as HTMLInputElement | null
          el?.focus()
          el?.select()
        }, 30)
      } else if (mod && e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        processCurrent()
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'c') {
        if (s.view !== 'table') return
        e.preventDefault()
        apiRef.current?.copySelected()
      } else if (e.key === '/' && !mod && s.doc) {
        const t = e.target as HTMLElement
        if (t.closest('input, textarea, select, .cm-editor, [contenteditable]')) return
        e.preventDefault()
        go('table')
        setTimeout(() => (document.getElementById('query-input') as HTMLInputElement | null)?.focus(), 30)
      } else if (e.key === '?' && !mod) {
        const t = e.target as HTMLElement
        if (t.closest('input, textarea, select, .cm-editor, [contenteditable]')) return
        setModal('shortcuts')
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [processCurrent, go])

  const showTable = view === 'table' && doc

  if (restoring) {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <div role="status" className="flex items-center gap-2 text-muted">
          <Loader2 size={16} className="animate-spin text-accent" /> Restoring your workspace…
        </div>
      </div>
    )
  }

  if (handoff !== 'idle') {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        {handoff === 'loading' ? (
          <div role="status" className="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 shadow-lg">
            <Loader2 size={16} className="animate-spin text-accent" /> Opening table in a new tab…
          </div>
        ) : (
          <div className="w-full max-w-lg">
            <ErrorState
              icon={<Unplug size={20} />}
              title="This table can't be restored"
              message="It was opened from another Jsonlet tab that has since been closed or reloaded, and nothing is stored on a server. Go back to the original tab and open it again."
            >
              <Button variant="primary" onClick={() => location.assign(location.pathname)}>
                Start a new workspace
              </Button>
            </ErrorState>
          </div>
        )}
        <Toaster />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <TopNavigation
        view={view}
        onView={go}
        hasData={!!doc}
        dark={dark}
        onToggleTheme={() => setDark((d) => !d)}
        onShortcuts={() => setModal('shortcuts')}
        onAbout={() => setModal('about')}
        onClear={clearAll}
      />
      <main className="relative min-h-0 flex-1">
        {view === 'docs' ? (
          <DocsView />
        ) : view === 'diff' ? (
          <ErrorBoundary scope="Compare" onReset={() => go('editor')}>
            <DiffView state={diff} onChange={setDiff} currentText={doc ? text || JSON.stringify(doc.root, null, 2) : null} dark={dark} />
          </ErrorBoundary>
        ) : showTable ? (
          <ErrorBoundary scope="the table view" key={doc.id} onReset={() => go('editor')}>
            <TableView
              doc={doc}
              apiRef={apiRef}
              onEdit={editJson}
              onReplace={() => fileRef.current?.click()}
              text={text}
              onTextChange={setText}
              validation={validation}
              dark={dark}
              dirty={dirty}
              live={liveOn}
              pending={liveOn && dirty && validation.status !== 'invalid'}
              onToggleLive={toggleLive}
              processing={processing}
              onProcess={processCurrent}
              onLoadSample={loadSample}
            />
          </ErrorBoundary>
        ) : (
          <EmptyState
            hasData={!!doc}
            dirty={dirty && !liveOn}
            text={text}
            onChange={setText}
            validation={validation}
            dark={dark}
            processing={processing}
            onProcess={processCurrent}
            onSample={exploreSample}
            onLoadSample={loadSample}
            onFile={loadFiles}
            onDropText={dropText}
            onBack={() => go('table')}
          />
        )}
        {processing && (
          <div className="anim-fade absolute inset-0 z-50 flex items-center justify-center bg-bg/60 backdrop-blur-[1px]" role="status">
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 shadow-lg">
              <Loader2 size={16} className="animate-spin text-accent" /> Processing JSON…
            </div>
          </div>
        )}
      </main>
      <input
        ref={fileRef}
        type="file"
        accept=".json,.jsonl,.ndjson,application/json,text/plain"
        hidden
        onChange={(e) => {
          loadFiles(e.target.files)
          e.target.value = ''
        }}
      />
      {modal === 'shortcuts' && <KeyboardShortcutsModal onClose={() => setModal(null)} />}
      {modal === 'about' && <AboutModal onClose={() => setModal(null)} />}
      <Toaster />
    </div>
  )
}
