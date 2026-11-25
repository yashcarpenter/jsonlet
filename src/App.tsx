import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { TopNavigation, type ViewId } from './components/TopNavigation'
import { EmptyState } from './components/EmptyState'
import { TableView, type Doc } from './components/TableView'
import { DocsView } from './components/DocsView'
import { AboutModal, KeyboardShortcutsModal } from './components/KeyboardShortcutsModal'
import { Toaster } from './components/ui'
import type { Validation } from './components/JsonInputEditor'
import type { WorkspaceApi } from './components/TableWorkspace'
import { buildSchema, describeStructure, parseJson, type JsonError } from './lib/json'
import { SAMPLES } from './lib/samples'
import { toast } from './lib/util'

const BIG_FILE = 2 * 1024 * 1024
const MAX_EDIT = 5 * 1024 * 1024

function computeValidation(text: string): Validation {
  const bytes = new Blob([text]).size
  const lines = text ? text.split('\n').length : 0
  if (!text.trim()) return { status: 'empty', lines, bytes }
  const r = parseJson(text)
  return r.ok ? { status: 'valid', lines, bytes } : { status: 'invalid', error: r.error, lines, bytes }
}

export default function App() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [view, setView] = useState<ViewId>('editor')
  const [text, setText] = useState('')
  const [processedText, setProcessedText] = useState('')
  const [source, setSource] = useState('untitled.json')
  const [doc, setDoc] = useState<Doc | null>(null)
  const [processing, setProcessing] = useState(false)
  const [validation, setValidation] = useState<Validation>({ status: 'empty', lines: 0, bytes: 0 })
  const [modal, setModal] = useState<'shortcuts' | 'about' | null>(null)
  const apiRef = useRef<WorkspaceApi | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const docId = useRef(0)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('jx-theme', dark ? 'dark' : 'light')
    } catch {
      /* storage unavailable */
    }
  }, [dark])

  // Debounced live validation. Large inputs get a longer delay so typing stays smooth.
  useEffect(() => {
    const t = setTimeout(() => setValidation(computeValidation(text)), text.length > 500_000 ? 700 : 250)
    return () => clearTimeout(t)
  }, [text])

  const run = useCallback((t: string, src: string) => {
    setProcessing(true)
    // Yield to the browser so the spinner can paint before parsing large payloads.
    setTimeout(() => {
      const r = parseJson(t)
      if (!r.ok) {
        const e: JsonError = r.error
        setValidation({ status: 'invalid', error: e, lines: t.split('\n').length, bytes: new Blob([t]).size })
        toast(`Invalid JSON: ${e.message} (line ${e.line}, col ${e.column})`, 'err')
        setView('editor')
      } else {
        setDoc({ id: ++docId.current, root: r.value, source: src, processedAt: Date.now(), schema: buildSchema(r.value), structure: describeStructure(r.value) })
        setProcessedText(t)
        setView('table')
      }
      setProcessing(false)
    }, 40)
  }, [])

  const stateRef = useRef({ text, source, view, doc, processedText, processing })
  stateRef.current = { text, source, view, doc, processedText, processing }

  const processCurrent = useCallback(() => {
    const s = stateRef.current
    if (s.processing) return
    if (!s.text.trim()) return toast('Paste some JSON first', 'info')
    run(s.text, s.source)
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

  const loadFile = async (f: File) => {
    if (!/\.(json|txt)$/i.test(f.name) && f.type && !f.type.includes('json') && !f.type.includes('text')) return toast('Please choose a .json file', 'err')
    const t = await f.text()
    setSource(f.name)
    if (f.size > BIG_FILE) {
      setText('')
      toast(`Large file (${(f.size / 1048576).toFixed(1)} MB). Editor preview skipped to keep things fast.`, 'info')
    } else setText(t)
    run(t, f.name)
  }

  const clearAll = () => {
    if ((doc || text) && !window.confirm('Clear all data? The current JSON and table will be removed.')) return
    setText('')
    setProcessedText('')
    setDoc(null)
    setSource('untitled.json')
    setView('editor')
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

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const s = stateRef.current
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (!s.doc) return
        setView('table')
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
      } else if (e.key === '?' && !mod) {
        const t = e.target as HTMLElement
        if (t.closest('input, textarea, select, .cm-editor, [contenteditable]')) return
        setModal('shortcuts')
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [processCurrent])

  const dirty = !!doc && text !== '' && text !== processedText
  const showTable = view === 'table' && doc

  return (
    <div className="flex h-full flex-col">
      <TopNavigation
        view={view}
        onView={setView}
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
        ) : showTable ? (
          <TableView
            key={doc.id}
            doc={doc}
            apiRef={apiRef}
            onEdit={editJson}
            onReplace={() => fileRef.current?.click()}
            text={text}
            onTextChange={setText}
            validation={validation}
            dark={dark}
            dirty={dirty}
            processing={processing}
            onProcess={processCurrent}
            onLoadSample={loadSample}
          />
        ) : (
          <EmptyState
            hasData={!!doc}
            dirty={dirty}
            text={text}
            onChange={setText}
            validation={validation}
            dark={dark}
            processing={processing}
            onProcess={processCurrent}
            onSample={exploreSample}
            onLoadSample={loadSample}
            onFile={loadFile}
            onBack={() => setView('table')}
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
        accept=".json,application/json,text/plain"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) loadFile(f)
          e.target.value = ''
        }}
      />
      {modal === 'shortcuts' && <KeyboardShortcutsModal onClose={() => setModal(null)} />}
      {modal === 'about' && <AboutModal onClose={() => setModal(null)} />}
      <Toaster />
    </div>
  )
}
