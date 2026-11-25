import { useEffect, useMemo, useState, type MutableRefObject } from 'react'
import { ChevronsDownUp, ChevronsUpDown, Copy, ListTree, PanelLeftClose, Play, Loader2 } from 'lucide-react'
import { JsonToolbar } from './JsonToolbar'
import { DataSummary } from './DataSummary'
import { JsonStructureSidebar, pathKey } from './JsonStructureSidebar'
import { TableWorkspace, type WorkspaceApi } from './TableWorkspace'
import { RowInspector } from './RowInspector'
import { JsonTreeView, type ExpandSignal } from './JsonTreeView'
import { ErrorState } from './ErrorState'
import { QueryBar, type QuerySample } from './QueryBar'
import { Button, IconButton } from './ui'
import { JsonInputEditor, type Validation } from './JsonInputEditor'
import { buildTable, findBestArrayPath, getAtPath, isPlainObject, pathLabel, resolvePath, type SchemaNode } from '../lib/json'
import { cn, copyText, download, MOD } from '../lib/util'

export type Doc = { id: number; root: unknown; source: string; processedAt: number; schema: SchemaNode; structure: string }
type Dataset = { label: string; data: unknown; query?: boolean }

type Props = {
  doc: Doc
  apiRef: MutableRefObject<WorkspaceApi | null>
  onEdit: () => void
  onReplace: () => void
  text: string
  onTextChange: (v: string) => void
  validation: Validation
  dark: boolean
  dirty: boolean
  processing: boolean
  onProcess: () => void
  onLoadSample: (id: string) => void
}

const initial = (root: unknown): { stack: Dataset[]; key: string } => {
  const path = findBestArrayPath(root) ?? []
  return { stack: [{ label: pathLabel(path), data: getAtPath(root, path) }], key: pathKey(path) }
}

export function TableView({ doc, apiRef, onEdit, onReplace, text, onTextChange, validation, dark, dirty, processing, onProcess, onLoadSample }: Props) {
  const [tab, setTab] = useState<'editor' | 'structure'>('editor')
  const [panelW, setPanelW] = useState(() => {
    const v = Number(localStorage.getItem('jx-editor-w'))
    return v >= 320 ? v : 480
  })
  const clampW = (w: number) => Math.round(Math.max(320, Math.min(w, 1000, window.innerWidth - 420)))
  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startW = panelW
    let w = startW
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    const move = (ev: PointerEvent) => {
      w = clampW(startW + ev.clientX - startX)
      setPanelW(w)
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      try {
        localStorage.setItem('jx-editor-w', String(w))
      } catch {
        /* ignore */
      }
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }
  const [{ stack, key: activeKey }, setNav] = useState(() => initial(doc.root))
  const [mode, setMode] = useState<'table' | 'tree'>('table')
  const [flatten, setFlatten] = useState(true)
  const [inspectedId, setInspectedId] = useState<number | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024)
  const [wsKey, setWsKey] = useState(0)
  const [signal, setSignal] = useState<ExpandSignal>({ n: 0, mode: null })

  const sample = useMemo<QuerySample>(() => {
    const p = findBestArrayPath(doc.root) ?? []
    const arr = getAtPath(doc.root, p)
    const first = Array.isArray(arr) && isPlainObject(arr[0]) ? arr[0] : null
    const keys = first ? Object.keys(first) : []
    const numKey = first ? keys.find((k) => typeof first[k] === 'number') : undefined
    return { base: p.length ? '$.' + p.join('.') : '$', arrayRoot: Array.isArray(arr), key: keys[0] ?? 'id', numKey, numVal: numKey && first ? (first[numKey] as number) : undefined }
  }, [doc])

  const current = stack[stack.length - 1]
  const model = useMemo(() => buildTable(current.data, flatten), [current, flatten])
  const fileBase = doc.source.replace(/\.json$/i, '') || 'data'
  const row = inspectedId !== null ? model.rows[inspectedId] : undefined

  const go = (next: Dataset[], key?: string) => {
    setNav((n) => ({ stack: next, key: key ?? n.key }))
    setInspectedId(null)
    setWsKey((k) => k + 1)
  }
  const openNested = (label: string, value: unknown) => go([...stack, { label, data: value }])
  const reset = () => {
    const i = initial(doc.root)
    setNav(i)
    setFlatten(true)
    setMode('table')
    setInspectedId(null)
    setWsKey((k) => k + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (inspectedId !== null) setInspectedId(null)
      else if (sidebarOpen && window.innerWidth < 1024) setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inspectedId, sidebarOpen])

  const crumbs = stack.map((s, i) => (i === 0 ? s.label : s.label.startsWith(stack[i - 1].label) ? s.label.slice(stack[i - 1].label.length).replace(/^\./, '') : s.label))
  const isEmptyArray = Array.isArray(current.data) && current.data.length === 0

  const selectNode = (n: SchemaNode) => {
    const data = resolvePath(doc.root, n.path)
    go([{ label: pathLabel(n.path), data }], pathKey(n.path))
    if (window.innerWidth < 1024) setSidebarOpen(false)
  }

  let body
  if (current.data === undefined) {
    body = <ErrorState title="Nothing at this path" message="The selected path does not exist in the JSON." />
  } else if (isEmptyArray) {
    body = (
      <ErrorState
        title={current.query ? 'The query matched nothing' : 'This array is empty'}
        message={current.query ? 'No values matched this JSONPath expression. Check the path, or press the lightbulb for examples that fit this document.' : 'There are no records to show as a table. You can still look at it in tree view or pick another node from the structure sidebar.'}
      >
        <Button onClick={() => setMode('tree')}>
          <ListTree size={14} /> Show tree
        </Button>
        {stack.length > 1 && <Button onClick={() => go(stack.slice(0, -1))}>Go back</Button>}
      </ErrorState>
    )
  } else if (mode === 'tree') {
    body = (
      <div className="flex min-h-0 flex-1 flex-col bg-surface">
        <div className="flex items-center gap-1 border-b border-line px-3 py-1.5 sm:px-4">
          <span className="text-[12px] text-muted">Tree view of <span className="font-mono text-ink">{current.label}</span></span>
          <div className="ml-auto flex items-center gap-0.5">
            <IconButton label="Expand all" onClick={() => setSignal((s) => ({ n: s.n + 1, mode: 'expand' }))}>
              <ChevronsUpDown size={14} />
            </IconButton>
            <IconButton label="Collapse all" onClick={() => setSignal((s) => ({ n: s.n + 1, mode: 'collapse' }))}>
              <ChevronsDownUp size={14} />
            </IconButton>
            <IconButton label="Copy this JSON" onClick={() => copyText(JSON.stringify(current.data, null, 2), 'JSON copied')}>
              <Copy size={14} />
            </IconButton>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3 sm:px-4">
          <JsonTreeView value={current.data} signal={signal} defaultDepth={2} rootLabel={current.label} onOpenTable={openNested} />
        </div>
      </div>
    )
  } else {
    body = (
      <>
        <DataSummary model={model} />
        <TableWorkspace
          key={wsKey + (flatten ? 'f' : 'n')}
          model={model}
          fileBase={fileBase}
          flatten={flatten}
          onFlatten={setFlatten}
          inspectedId={inspectedId}
          onInspect={setInspectedId}
          onOpenNested={openNested}
          datasetLabel={current.label}
          apiRef={apiRef}
        />
      </>
    )
  }

  return (
    <div className="flex h-full min-h-0">
      {sidebarOpen && (
        <>
          <div className="anim-fade fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
          <div className={cn('anim-left fixed inset-y-0 left-0 z-40 flex h-full max-w-[92vw] flex-col border-r border-line bg-surface lg:relative lg:z-auto lg:max-w-none lg:shrink-0', tab === 'structure' && 'w-72')} style={tab === 'editor' ? { width: clampW(panelW) } : undefined}>
            <div className="flex h-10 shrink-0 items-center gap-1 border-b border-line px-2">
              {(['editor', 'structure'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  className={cn('relative h-7 rounded-md px-2.5 text-[11px] font-semibold tracking-wide uppercase transition-colors', tab === t ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-sunken hover:text-ink')}
                >
                  {t === 'editor' ? 'JSON Editor' : 'JSON Structure'}
                  {t === 'editor' && dirty && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-warn" title="Unprocessed changes" />}
                </button>
              ))}
              <IconButton label="Hide panel" onClick={() => setSidebarOpen(false)} className="ml-auto">
                <PanelLeftClose size={15} />
              </IconButton>
            </div>
            {tab === 'editor' ? (
              <>
                <div className="min-h-0 flex-1">
                  <JsonInputEditor value={text} onChange={onTextChange} validation={validation} dark={dark} expanded={false} onToggleExpand={() => {}} onLoadSample={onLoadSample} fill />
                </div>
                <button
                  onClick={onProcess}
                  disabled={processing || validation.status !== 'valid'}
                  aria-label="Update table"
                  title={validation.status === 'invalid' ? 'Fix the JSON errors first' : `Update table (${MOD}+Enter)`}
                  className={cn(
                    'absolute top-1/2 right-0 z-50 flex -translate-y-1/2 translate-x-1/2 flex-col items-center gap-2.5 rounded-full border border-line bg-accent px-2 py-6 text-[12px] font-medium text-white shadow-lg transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted disabled:shadow-sm dark:text-[#0b1020] disabled:dark:text-muted',
                    dirty && validation.status === 'valid' && 'ring-4 ring-warn/30',
                  )}
                >
                  {processing ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} fill="currentColor" />}
                  {dirty && <span className="h-2 w-2 rounded-full bg-warn" />}
                </button>
              </>
            ) : (
              <div className="min-h-0 flex-1">
                <JsonStructureSidebar schema={doc.schema} activeKey={activeKey} onSelect={selectNode} />
              </div>
            )}
            {tab === 'editor' && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize editor panel"
                title="Drag to resize. Double-click to reset."
                onPointerDown={startResize}
                onDoubleClick={() => {
                  setPanelW(480)
                  localStorage.setItem('jx-editor-w', '480')
                }}
                className="absolute inset-y-0 right-0 z-40 w-1.5 translate-x-1/2 cursor-col-resize touch-none transition-colors hover:bg-accent/50 active:bg-accent"
              />
            )}
          </div>
        </>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <JsonToolbar
          source={doc.source}
          structure={doc.structure}
          records={model.rows.length}
          columns={model.cols.length}
          processedAt={doc.processedAt}
          crumbs={crumbs}
          onCrumb={(i) => go(stack.slice(0, i + 1))}
          mode={mode}
          onMode={setMode}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(true)}
          onEdit={() => {
            onEdit()
            setTab('editor')
            setSidebarOpen(true)
          }}
          onReplace={onReplace}
          onCopy={() => copyText(JSON.stringify(doc.root, null, 2), 'Full JSON copied')}
          onDownload={() => download(`${fileBase}.json`, JSON.stringify(doc.root, null, 2), 'application/json')}
          onReset={reset}
        />
        <QueryBar
          root={doc.root}
          sample={sample}
          active={!!stack[0].query}
          onRun={(expr, data) => go([{ label: expr, data, query: true }], '')}
          onClear={() => {
            const i = initial(doc.root)
            go(i.stack, i.key)
          }}
        />
        {body}
      </div>
      {row && mode === 'table' && (
        <RowInspector
          row={row}
          position={row.i + 1}
          total={model.rows.length}
          datasetLabel={current.label}
          onClose={() => setInspectedId(null)}
          onPrev={row.i > 0 ? () => setInspectedId(row.i - 1) : null}
          onNext={row.i < model.rows.length - 1 ? () => setInspectedId(row.i + 1) : null}
          onOpenNested={openNested}
        />
      )}
    </div>
  )
}
