import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { Wrench, ClipboardPaste, Maximize2, Minimize2, Eraser, WandSparkles, Minimize, CheckCircle2, AlertCircle, FileJson } from 'lucide-react'
import { Button, IconButton, Popover } from './ui'
import { findJsonError, parseJsonLines, type JsonError } from '../lib/json'
import { SAMPLES } from '../lib/samples'
import { repairJson } from '../lib/repair'
import { cn, copyText, formatBytes, toast } from '../lib/util'

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
}

export function JsonInputEditor({ value, onChange, validation, dark, expanded, onToggleExpand, onLoadSample, fill }: Props) {
  const extensions = useMemo(
    () => [json(), jsonLinter, lintGutter(), EditorState.tabSize.of(2), EditorView.contentAttributes.of({ 'aria-label': 'JSON input' })],
    [],
  )

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText()
      if (!t) return toast('Clipboard is empty', 'info')
      onChange(t)
    } catch {
      toast('Clipboard access was blocked. Paste with ' + (navigator.platform.includes('Mac') ? '⌘V' : 'Ctrl+V') + ' instead.', 'err')
    }
  }
  const format = (indent: number | undefined) => {
    try {
      onChange(JSON.stringify(JSON.parse(value), null, indent))
    } catch {
      toast('Fix the JSON errors first', 'err')
    }
  }

  const repair = () => {
    const r = repairJson(value)
    if (r.valid) {
      onChange(JSON.stringify(JSON.parse(r.text), null, 2))
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
        height={fill ? '100%' : expanded ? 'calc(100dvh - 330px)' : '300px'}
        minHeight="200px"
        className={fill ? 'h-full' : undefined}
        basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, autocompletion: false, searchKeymap: true }}
      />
      </div>

      <div
        className={cn(
          'flex min-h-8 items-center gap-2 border-t border-line px-3 py-1.5 text-[12px]',
          validation.status === 'invalid' ? 'bg-error/5' : '',
        )}
        role="status"
      >
        {validation.status === 'empty' && <span className="text-muted">Paste, type or drop JSON to begin.</span>}
        {validation.status === 'valid' && (
          <span className="flex items-center gap-1.5 text-success">
            <CheckCircle2 size={14} /> {validation.jsonl ? `Valid JSON Lines (${validation.jsonl.toLocaleString()} records)` : 'Valid JSON'}
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
      </div>
    </div>
  )
}
