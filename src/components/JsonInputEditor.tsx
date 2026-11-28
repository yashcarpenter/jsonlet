import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { undo as cmUndo, redo as cmRedo, isolateHistory } from '@codemirror/commands'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'
import { EditorState, StateEffect, StateField } from '@codemirror/state'
import { foldedRanges, unfoldAll } from '@codemirror/language'
import { locatePath, type Segment } from '../lib/locate'
import { Wrench, ClipboardPaste, ClipboardCheck, Maximize2, Minimize2, Eraser, WandSparkles, Minimize, CheckCircle2, AlertCircle, FileJson } from 'lucide-react'
import { Button, IconButton, Popover } from './ui'
import { findJsonError, parseJsonLines, type JsonError } from '../lib/json'
import { SAMPLES } from '../lib/samples'
import { repairJson } from '../lib/repair'
import { autoFormatPaste, formatJsonText, minifyJsonText } from '../lib/format'
import { cn, copyText, formatBytes, lsGet, lsSet, MOD, toast } from '../lib/util'

/** Lets other components ask the editor to scroll to a place in the JSON. */
export type EditorApi = { revealPath: (path: Segment[]) => 'ok' | 'notfound' | 'empty'; undo: () => void; redo: () => void }

const setFlash = StateEffect.define<{ from: number; to: number } | null>()
const flashField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const e of tr.effects) {
      if (!e.is(setFlash)) continue
      if (!e.value) deco = Decoration.none
      else {
        const line = tr.state.doc.lineAt(Math.min(e.value.from, tr.state.doc.length))
        const to = Math.min(tr.state.doc.length, Math.max(e.value.from + 1, e.value.to))
        deco = Decoration.set([Decoration.line({ class: 'cm-flash-line' }).range(line.from), Decoration.mark({ class: 'cm-flash-key' }).range(e.value.from, to)], true)
      }
    }
    return deco
  },
  provide: (f) => EditorView.decorations.from(f),
})

/**
 * When valid JSON is pasted over the whole editor (an empty editor, or everything selected), insert it formatted.
 * It is done as two undo steps: paste the original, then format it. So one Undo gives back exactly what was copied.
 * Pastes into the middle of existing text, invalid JSON, JSON Lines and anything huge are left completely alone.
 */
function pasteFormatter(enabled: MutableRefObject<boolean>) {
  return EditorView.domEventHandlers({
    paste(event, view) {
      if (!enabled.current) return false
      const raw = event.clipboardData?.getData('text/plain')
      if (!raw) return false
      const sel = view.state.selection
      if (sel.ranges.length > 1) return false
      const len = view.state.doc.length
      const { from, to } = sel.main
      const replacesAll = len === 0 || (from === 0 && to === len) || (len < 10_000 && view.state.doc.toString().trim() === '')
      if (!replacesAll) return false
      const formatted = autoFormatPaste(raw)
      if (formatted === null) return false
      event.preventDefault()
      view.dispatch({ changes: { from: 0, to: len, insert: raw }, selection: { anchor: raw.length }, userEvent: 'input.paste' })
      // isolateHistory keeps this its own undo step. Without it the editor merges the two edits and one Undo would erase the whole paste.
      view.dispatch({ changes: { from: 0, to: raw.length, insert: formatted }, selection: { anchor: 0 }, annotations: isolateHistory.of('before'), effects: EditorView.scrollIntoView(0, { y: 'start' }) })
      toast(`Pasted JSON was formatted. ${MOD}+Z gives back the original.`, 'info')
      return true
    },
  })
}

export type Validation = { status: 'empty' | 'valid' | 'invalid'; error?: JsonError; lines: number; bytes: number; jsonl?: number }

const PLACEHOLDER = `{ "users": [ { "id": 1, "name": "John Doe", "email": "john@example.com", "role": "admin" } ] }`

const jsonLinter = linter(
  (view): Diagnostic[] => {
    const text = view.state.doc.toString()
    if (!text.trim()) return []
    try {
      JSON.parse(text)
      return []
    } catch {
      if (parseJsonLines(text)) return []
      const e = findJsonError(text)
      if (!e) return []
      const from = Math.min(e.pos, text.length)
      return [{ from: Math.min(from, Math.max(0, text.length - 1)), to: Math.min(from + 1, text.length), severity: 'error', message: e.message }]
    }
  },
  { delay: 600 },
)

type Props = {
  value: string
  onChange: (v: string) => void
  validation: Validation
  dark: boolean
  expanded: boolean
  onToggleExpand: () => void
  onLoadSample: (id: string) => void
  fill?: boolean
  apiRef?: MutableRefObject<EditorApi | null>
  /** Short note shown in the status bar, e.g. whether the table is following the editor. */
  hint?: string
}

export function JsonInputEditor({ value, onChange, validation, dark, expanded, onToggleExpand, onLoadSample, fill, apiRef, hint }: Props) {
  /* Auto-format on paste. Kept in a ref so the editor extension below never has to be rebuilt. */
  const [autoFmt, setAutoFmt] = useState(() => lsGet('jx-autoformat') !== '0')
  const autoRef = useRef(autoFmt)
  autoRef.current = autoFmt

  const extensions = useMemo(
    () => [json(), jsonLinter, lintGutter(), EditorState.tabSize.of(2), flashField, pasteFormatter(autoRef), EditorView.contentAttributes.of({ 'aria-label': 'JSON input' })],
    [],
  )

  useEffect(
    () => () => {
      if (apiRef) apiRef.current = null
    },
    [apiRef],
  )

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText()
      if (!t) return toast('Clipboard is empty', 'info')
      const formatted = autoFmt ? autoFormatPaste(t) : null
      onChange(formatted ?? t)
      if (formatted !== null) toast(`Pasted JSON was formatted. ${MOD}+Z gives back the original.`, 'info')
    } catch {
      toast('Clipboard access was blocked. Paste with ' + (navigator.platform.includes('Mac') ? '⌘V' : 'Ctrl+V') + ' instead.', 'err')
    }
  }
  const format = (indent: number | undefined) => {
    if (findJsonError(value) !== null) return toast('Fix the JSON errors first', 'err')
    // Whitespace only, so big integers and numbers like 1.0 or 1e3 are kept exactly as written.
    onChange(indent === undefined ? minifyJsonText(value) : formatJsonText(value, indent))
  }

  const repair = () => {
    const r = repairJson(value)
    if (r.valid) {
      onChange(formatJsonText(r.text))
      toast('JSON repaired and formatted')
    } else toast('Could not repair automatically. Check the error marker for the remaining problem.', 'err')
  }

  return (
    <div className={cn('overflow-hidden bg-surface', fill ? 'flex h-full flex-col' : 'rounded-xl border border-line shadow-sm focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/15')}>
      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-sunken/60 px-2 py-1.5">
        <span className="mr-1 ml-1 hidden items-center gap-1.5 text-[12px] font-medium text-muted sm:flex">
          <FileJson size={14} /> JSON
        </span>
        <Button size="sm" variant="ghost" onClick={paste}>
          <ClipboardPaste size={13} /> Paste
        </Button>
        <IconButton
          label={`Auto-format pasted JSON: ${autoFmt ? 'on' : 'off'}`}
          active={autoFmt}
          onClick={() => {
            const next = !autoFmt
            setAutoFmt(next)
            lsSet('jx-autoformat', next ? '1' : '0')
            toast(next ? 'Pasted JSON will be formatted automatically.' : 'Pasted JSON will be left exactly as copied.', 'info')
          }}
        >
          <ClipboardCheck size={14} />
        </IconButton>
        <Button size="sm" variant="ghost" onClick={() => format(2)} disabled={validation.status !== 'valid' || !!validation.jsonl} title="Pretty-print JSON">
          <WandSparkles size={13} /> <span className="hidden sm:inline">Format</span>
        </Button>
        <Button size="sm" variant="ghost" onClick={() => format(undefined)} disabled={validation.status !== 'valid' || !!validation.jsonl} title="Minify JSON">
          <Minimize size={13} /> <span className="hidden sm:inline">Minify</span>
        </Button>
        {validation.status === 'invalid' && (
          <Button size="sm" variant="ghost" onClick={repair} title="Fix comments, single quotes, unquoted keys, trailing commas and Python literals" className="text-warn">
            <Wrench size={13} /> Repair
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => copyText(value, 'JSON copied')} disabled={!value}>
          Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onChange('')} disabled={!value}>
          <Eraser size={13} /> <span className="hidden sm:inline">Clear</span>
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Popover
            align="end"
            width={300}
            trigger={(p) => (
              <Button size="sm" variant="secondary" {...p}>
                Samples
              </Button>
            )}
          >
            {(close) => (
              <div className="p-1">
                {SAMPLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      onLoadSample(s.id)
                      close()
                    }}
                    className="flex w-full flex-col rounded-md px-2.5 py-2 text-left hover:bg-sunken"
                  >
                    <span className="font-medium">{s.label}</span>
                    <span className="text-[11.5px] text-muted">{s.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </Popover>
          {!fill && (
            <IconButton label={expanded ? 'Collapse editor' : 'Expand editor'} onClick={onToggleExpand}>
              {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </IconButton>
          )}
        </div>
      </div>

      <div className={cn(fill && 'min-h-0 flex-1 overflow-hidden')}>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        theme={dark ? 'dark' : 'light'}
        placeholder={PLACEHOLDER}
        onCreateEditor={(view) => {
          if (!apiRef) return
          let timer: ReturnType<typeof setTimeout> | undefined
          apiRef.current = {
            undo: () => void cmUndo(view),
            redo: () => void cmRedo(view),
            revealPath(path) {
              const text = view.state.doc.toString()
              if (!text.trim()) return 'empty'
              const loc = locatePath(text, path)
              if (!loc) return 'notfound'
              if (foldedRanges(view.state).size > 0) unfoldAll(view)
              view.dispatch({
                selection: { anchor: loc.from },
                effects: [EditorView.scrollIntoView(loc.from, { y: 'center' }), setFlash.of(loc)],
              })
              clearTimeout(timer)
              timer = setTimeout(() => view.dispatch({ effects: setFlash.of(null) }), 2200)
              return 'ok'
            },
          }
        }}
        height={fill ? '100%' : expanded ? 'calc(100dvh - 330px)' : '300px'}
        minHeight="200px"
        className={fill ? 'h-full' : undefined}
        basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, autocompletion: false, searchKeymap: true }}
      />
      </div>

      <div
        className={cn(
          'flex min-h-8 flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-line px-3 py-1.5 text-[12px]',
          validation.status === 'invalid' ? 'bg-error/5' : '',
        )}
        role="status"
      >
        {validation.status === 'empty' && <span className="text-muted">Paste, type or drop JSON to begin.</span>}
        {validation.status === 'valid' && (
          <span className="flex items-center gap-1.5 text-success">
            <CheckCircle2 size={14} /> {validation.jsonl ? `Valid JSON Lines (${validation.jsonl.toLocaleString()} records)` : 'Valid JSON'}
            {hint && <span className="text-muted">· {hint}</span>}
          </span>
        )}
        {validation.status === 'invalid' && validation.error && (
          <span className="flex min-w-0 items-center gap-1.5 text-error">
            <AlertCircle size={14} className="shrink-0" />
            <span className="truncate">
              {validation.error.message} <span className="font-mono opacity-80">(line {validation.error.line}, col {validation.error.column})</span>
            </span>
          </span>
        )}
        <span className="ml-auto shrink-0 font-mono text-muted">
          {validation.lines.toLocaleString()} lines · {formatBytes(validation.bytes)}
        </span>
        {validation.status === 'invalid' && hint && <span className="order-last basis-full pl-5 text-[11.5px] text-muted">{hint}</span>}
      </div>
    </div>
  )
}
