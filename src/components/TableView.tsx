import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
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
import { JsonInputEditor, type EditorApi, type Validation } from './JsonInputEditor'
import { buildTable, findBestArrayPath, getAtPath, isPlainObject, pathLabel, resolvePath, rowRef, type Row, type SchemaNode, type TableModel } from '../lib/json'
import { toast, cn, copyText, download, lsGet, lsSet, MOD, safeName } from '../lib/util'
import { newTabRequested, openInNewTab } from '../lib/handoff'
import { buildPathIndex, pathOf, type PathIndex, type Segment } from '../lib/locate'
import { queryJsonPath } from '../lib/jsonpath'
import { NestedContext, type NestedCtx } from './nestedContext'

export type Doc = { id: number; root: unknown; source: string; processedAt: number; schema: SchemaNode; structure: string }
/**
 * A dataset remembers HOW to find its data in the document, not the data itself, so that when the JSON is
 * edited the table can follow along instead of showing stale values or being rebuilt from scratch.
 */
type Dataset = { label: string; resolve: (root: unknown) => unknown; auto?: boolean; query?: boolean }
type Resolved = { label: string; data: unknown; query: boolean }

const resolveDataset = (d: Dataset, root: unknown): Resolved => {
  if (d.auto) {
    const p = findBestArrayPath(root) ?? []
    return { label: pathLabel(p), data: getAtPath(root, p), query: false }
  }
  let data: unknown
  try {
    data = d.resolve(root)
  } catch {
    data = undefined
  }
  return { label: d.label, data, query: !!d.query }
}

const runQuery = (root: unknown, expr: string): unknown[] => {
  try {
    const res = queryJsonPath(root, expr)
    return res.length === 1 && Array.isArray(res[0]) ? (res[0] as unknown[]) : res
  } catch {
    return []
  }
}

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
  live: boolean
  pending: boolean
  onToggleLive: (v: boolean) => void
  processing: boolean
  onProcess: () => void
  onLoadSample: (id: string) => void
}

const initial = (root: unknown): { stack: Dataset[]; key: string } => ({
  stack: [{ label: '$', auto: true, resolve: () => undefined }],
  key: pathKey(findBestArrayPath(root) ?? []),
})

export function TableView({ doc, apiRef, onEdit, onReplace, text, onTextChange, validation, dark, dirty, live, pending, onToggleLive, processing, onProcess, onLoadSample }: Props) {
  const [tab, setTab] = useState<'editor' | 'structure'>('editor')
  const [panelW, setPanelW] = useState(() => {
    const v = Number(lsGet('jx-editor-w'))
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
      lsSet('jx-editor-w', String(w))
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }
  const [{ stack, key: activeKey }, setNav] = useState(() => initial(doc.root))
  const [mode, setMode] = useState<'table' | 'tree'>('table')
  const [flatten, setFlatten] = useState(true)
  const [inspectedId, setInspectedId] = useState<number | null>(null)
  /** A record opened from a table nested inside another table. Tracked by its position in the document, so it
      stays correct when the JSON is edited and does not depend on any row number. */
  const [docInspect, setDocInspect] = useState<{ path: Segment[]; keyed: boolean } | null>(null)
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

  /* ---- sync with the JSON editor on the left ---- */
  const editorApi = useRef<EditorApi | null>(null)
  const pathIdx = useRef<PathIndex | null>(null)
  const [revealReq, setRevealReq] = useState<{ path: Segment[]; n: number } | null>(null)
  const revealN = useRef(0)

  // Re-resolved whenever the JSON changes, so live edits flow into the table without rebuilding the view.
  const resolved = useMemo(() => stack.map((d) => resolveDataset(d, doc.root)), [stack, doc.root])
  const current = resolved[resolved.length - 1]
  const model = useMemo(() => buildTable(current.data, flatten), [current.data, flatten])
  const fileBase = safeName(doc.source.replace(/\.json$/i, ''))
  const row = inspectedId !== null ? model.rows[inspectedId] : undefined

  const getIdx = (): PathIndex => {
    if (!pathIdx.current || pathIdx.current.root !== doc.root) pathIdx.current = buildPathIndex(doc.root)
    return pathIdx.current
  }

  /** Where a table row lives inside the original document, as a path of keys and indexes. */
  const rowDocPath = (r: Row): Segment[] | null => {
    const idx = getIdx()
    let ref: unknown = r.orig
    if (model.kind === 'keyed' && isPlainObject(r.orig)) ref = Object.values(r.orig)[0]
    if (ref !== null && typeof ref === 'object') return pathOf(idx, ref)
    const base = Array.isArray(current.data) ? pathOf(idx, current.data) : null
    return base ? [...base, r.i] : null
  }
  /** Keyed rows are wrapped as { KEY: value }, so paths inside the wrapper start one level higher. */
  const recordBase = (r: Row): Segment[] | null => {
    const p = rowDocPath(r)
    return p && model.kind === 'keyed' ? p.slice(0, -1) : p
  }

  /** Position in the document of a row from ANY table (main or nested), found from the row's own object. */
  const docPathOfRow = (r: Row, kind: TableModel['kind']): Segment[] | null => {
    let ref: unknown = r.orig
    if (kind === 'keyed' && isPlainObject(r.orig)) ref = Object.values(r.orig)[0]
    return ref !== null && typeof ref === 'object' ? pathOf(getIdx(), ref) : null
  }
  const samePath = (a: Segment[] | null, b: Segment[] | null) => !!a && !!b && a.length === b.length && a.every((x, i) => x === b[i])
  const docLabel = (path: Segment[]) => '$' + path.map((p) => (typeof p === 'number' ? `[${p}]` : /^[A-Za-z_$][\w$]*$/.test(p) ? `.${p}` : `['${p}']`)).join('')

  const requestReveal = (path: Segment[] | null) => {
    if (!path || window.innerWidth < 1024) return // on small screens the editor is a drawer; don't cover the table
    setTab('editor')
    setSidebarOpen(true)
    setRevealReq({ path, n: ++revealN.current })
  }
  // Wait until the editor exists (it mounts only on the Editor tab), then scroll to the request.
  useEffect(() => {
    if (!revealReq) return
    let tries = 0
    const attempt = () => {
      const api = editorApi.current
      if (api) {
        const res = api.revealPath(revealReq.path)
        if (res === 'notfound') toast('Could not find that key in the editor. The text may have been edited since the table was built.', 'info')
        setRevealReq(null)
      } else if (++tries < 10) timer = setTimeout(attempt, 60)
      else setRevealReq(null)
    }
    let timer = setTimeout(attempt, 0)
    return () => clearTimeout(timer)
  }, [revealReq])

  const openDoc = (path: Segment[], keyed: boolean) => {
    setInspectedId(null)
    setDocInspect({ path, keyed })
    requestReveal(path)
  }

  /** The record behind the inspector when it was opened from a nested table, re-read from the live document. */
  const docRec = useMemo(() => {
    if (!docInspect) return null
    const value = getAtPath(doc.root, docInspect.path)
    if (value === undefined) return null
    const last = docInspect.path[docInspect.path.length - 1]
    const parentPath = docInspect.path.slice(0, -1)
    const parent = getAtPath(doc.root, parentPath)
    const siblings: Segment[] = Array.isArray(parent) ? parent.map((_, i) => i) : isPlainObject(parent) ? Object.keys(parent) : []
    return {
      orig: docInspect.keyed ? { [String(last)]: value } : value,
      last,
      parentPath,
      siblings,
      at: Math.max(0, siblings.indexOf(last)),
      base: docInspect.keyed ? parentPath : docInspect.path,
    }
  }, [docInspect, doc.root])
  // The record was deleted by an edit: close the inspector instead of leaving it blank.
  useEffect(() => {
    if (docInspect && !docRec) setDocInspect(null)
  }, [docInspect, docRec])

  const nestedCtx: NestedCtx = {
    onInspectRow: (r, kind) => {
      if (!r) return setDocInspect(null)
      const path = docPathOfRow(r, kind)
      if (!path || path.length === 0) return toast('This row is not a separate record in the JSON, so there is nothing to inspect.', 'info')
      openDoc(path, kind === 'keyed')
    },
    isInspected: (r, kind) => !!docInspect && samePath(docPathOfRow(r, kind), docInspect.path),
    revealKey: (parent, key) => {
      const p = parent !== null && typeof parent === 'object' ? pathOf(getIdx(), parent) : null
      requestReveal(p ? [...p, key] : null)
    },
    fileBase,
  }

  const inspectRow = (id: number | null) => {
    setDocInspect(null)
    setInspectedId(id)
    if (id !== null && model.rows[id]) requestReveal(rowDocPath(model.rows[id]))
  }

  const go = (next: Dataset[], key?: string) => {
    setNav((n) => ({ stack: next, key: key ?? n.key }))
    setInspectedId(null)
    setDocInspect(null)
    setWsKey((k) => k + 1)
  }
  // Cmd/Ctrl+click on any "Open as table" control opens the table in a new browser tab instead.
  const openNested = (label: string, value: unknown) => {
    if (newTabRequested()) {
      if (openInNewTab(label, value)) toast('Opened in a new tab', 'info')
      return
    }
    // Remember where this value lives in the document so the nested table keeps following live edits.
    const p = value !== null && typeof value === 'object' ? pathOf(getIdx(), value) : null
    go([...stack, { label, resolve: p ? (r) => getAtPath(r, p) : () => value }])
  }
  const reset = () => {
    const i = initial(doc.root)
    setNav(i)
    setFlatten(true)
    setMode('table')
    setInspectedId(null)
    setDocInspect(null)
    setWsKey((k) => k + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (inspectedId !== null) setInspectedId(null)
      else if (docInspect) setDocInspect(null)
      else if (sidebarOpen && window.innerWidth < 1024) setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inspectedId, docInspect, sidebarOpen])

  const editorHint =
    validation.status === 'invalid'
      ? live
        ? 'The table keeps showing your last valid JSON'
        : undefined
      : live
        ? pending
          ? 'updating table…'
          : 'table is live'
        : dirty
          ? `press Update or ${MOD}+Enter`
          : undefined

  /* Cmd/Ctrl+Z (and Shift+Z / Ctrl+Y) undo the JSON edits even when keyboard focus has moved
     elsewhere, e.g. onto a table row or a button, where it would otherwise do nothing. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.defaultPrevented) return
      const k = e.key.toLowerCase()
      const wantsRedo = (k === 'z' && e.shiftKey) || (k === 'y' && !e.metaKey)
      const wantsUndo = k === 'z' && !e.shiftKey
      if (!wantsUndo && !wantsRedo) return
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"], .cm-editor')) return // those have their own undo
      const api = editorApi.current
      if (!api) return
      e.preventDefault()
      wantsRedo ? api.redo() : api.undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const crumbs = resolved.map((s, i) => (i === 0 ? s.label : s.label.startsWith(resolved[i - 1].label) ? s.label.slice(resolved[i - 1].label.length).replace(/^\./, '') : s.label))
  const isEmptyArray = Array.isArray(current.data) && current.data.length === 0
  const isEmptyObject = isPlainObject(current.data) && Object.keys(current.data).length === 0

  const selectNode = (n: SchemaNode) => {
    const path = n.path
    go([{ label: pathLabel(path), resolve: (r) => resolvePath(r, path) }], pathKey(path))
    if (window.innerWidth < 1024) setSidebarOpen(false)
  }

  let body
  if (current.data === undefined) {
    body = (
      <ErrorState title="Nothing at this path" message="This part of the JSON no longer exists, most likely because it was edited or removed.">
        <Button onClick={reset}>Back to the default view</Button>
        {stack.length > 1 && <Button onClick={() => go(stack.slice(0, -1))}>Go back</Button>}
      </ErrorState>
    )
  } else if (isEmptyObject) {
    body = (
      <ErrorState title="This object is empty" message="It has no keys, so there is nothing to show as a table. Pick another node from the structure sidebar, or edit the JSON.">
        <Button onClick={() => setMode('tree')}>
          <ListTree size={14} /> Show tree
        </Button>
        {stack.length > 1 && <Button onClick={() => go(stack.slice(0, -1))}>Go back</Button>}
      </ErrorState>
    )
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
          isInspected={(r) => inspectedId !== null && r.i === inspectedId}
          onInspect={(r) => inspectRow(r ? r.i : null)}
          onOpenNested={openNested}
          datasetLabel={current.label}
          apiRef={apiRef}
        />
      </>
    )
  }

  return (
    <NestedContext.Provider value={nestedCtx}>
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
                  {t === 'editor' && dirty && !live && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-warn" title="Unprocessed changes" />}
                </button>
              ))}
              <button
                role="switch"
                aria-checked={live}
                onClick={() => onToggleLive(!live)}
                title={live ? 'Live: the table updates as you edit. Click to turn off.' : `Live is off: update the table with the button or ${MOD}+Enter. Click to turn on.`}
                className="ml-auto inline-flex h-6 items-center gap-1.5 rounded-md px-1.5 text-[11px] font-medium text-muted hover:bg-sunken hover:text-ink"
              >
                <span className={cn('relative h-3.5 w-6 rounded-full transition-colors', live ? 'bg-accent' : 'bg-line')}>
                  <span className={cn('absolute top-0.5 left-0.5 h-2.5 w-2.5 rounded-full bg-white shadow transition-transform', live && 'translate-x-2.5')} />
                </span>
                Live
                {live && pending && <Loader2 size={11} className="animate-spin text-accent" aria-label="Updating" />}
              </button>
              <IconButton label="Hide panel" onClick={() => setSidebarOpen(false)}>
                <PanelLeftClose size={15} />
              </IconButton>
            </div>
            {tab === 'editor' ? (
              <>
                <div className="min-h-0 flex-1">
                  <JsonInputEditor value={text} onChange={onTextChange} validation={validation} dark={dark} expanded={false} onToggleExpand={() => {}} onLoadSample={onLoadSample} fill apiRef={editorApi} hint={editorHint} />
                </div>
                {!live && (
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
                )}
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
                  lsSet('jx-editor-w', '480')
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
          count={stack[0].query && Array.isArray(current.data) ? current.data.length : null}
          onRun={(expr) => go([{ label: expr, query: true, resolve: (r) => runQuery(r, expr) }], '')}
          onClear={() => {
            const i = initial(doc.root)
            go(i.stack, i.key)
          }}
        />
        {body}
      </div>
      {row && mode === 'table' ? (
        <RowInspector
          row={row}
          position={row.i + 1}
          total={model.rows.length}
          rowLabel={rowRef(current.label, model.kind, row)}
          onClose={() => setInspectedId(null)}
          onPrev={row.i > 0 ? () => inspectRow(row.i - 1) : null}
          onNext={row.i < model.rows.length - 1 ? () => inspectRow(row.i + 1) : null}
          onOpenNested={openNested}
          onKeyClick={(rel) => {
            const base = recordBase(row)
            requestReveal(base ? [...base, ...rel] : null)
          }}
        />
      ) : docRec && docInspect && mode === 'table' ? (
        <RowInspector
          row={{ i: typeof docRec.last === 'number' ? docRec.last : docRec.at, orig: docRec.orig, flat: {} }}
          position={docRec.at + 1}
          total={docRec.siblings.length}
          title={typeof docRec.last === 'number' ? undefined : String(docRec.last)}
          inView={false}
          rowLabel={docLabel(docInspect.path)}
          onClose={() => setDocInspect(null)}
          onPrev={docRec.at > 0 ? () => openDoc([...docRec.parentPath, docRec.siblings[docRec.at - 1]], docInspect.keyed) : null}
          onNext={docRec.at < docRec.siblings.length - 1 ? () => openDoc([...docRec.parentPath, docRec.siblings[docRec.at + 1]], docInspect.keyed) : null}
          onOpenNested={openNested}
          onKeyClick={(rel) => requestReveal([...docRec.base, ...rel])}
        />
      ) : null}
    </div>
    </NestedContext.Provider>
  )
}
