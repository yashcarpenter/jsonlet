import { useRef, useState } from 'react'
import { Play, Sparkles, UploadCloud, ShieldCheck, Loader2, ArrowRight } from 'lucide-react'
import { JsonInputEditor, type Validation } from './JsonInputEditor'
import { Button, Kbd } from './ui'
import { cn, MOD } from '../lib/util'

type Props = {
  hasData: boolean
  dirty: boolean
  text: string
  onChange: (v: string) => void
  validation: Validation
  dark: boolean
  processing: boolean
  onProcess: () => void
  onSample: () => void
  onLoadSample: (id: string) => void
  onFile: (f: FileList | null) => void
  onDropText: (t: string) => void
  onBack: () => void
}

export function EmptyState({ hasData, dirty, text, onChange, validation, dark, processing, onProcess, onSample, onLoadSample, onFile, onDropText, onBack }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [drag, setDrag] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className="relative h-full overflow-y-auto"
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        if (e.dataTransfer.files.length) onFile(e.dataTransfer.files)
        else onDropText(e.dataTransfer.getData('text/plain'))
      }}
    >
      <div className={cn('mx-auto w-full px-4 pb-10 sm:px-6', expanded ? 'max-w-6xl pt-5' : 'max-w-4xl pt-8 sm:pt-14')}>
        {!expanded && (
          <div className="mb-6 text-center sm:mb-8">
            <h1 className="text-[26px] font-semibold tracking-tight sm:text-[30px]">{hasData ? 'Edit your JSON' : 'Explore your JSON data.'}</h1>
            <p className="mx-auto mt-2 max-w-xl text-[14px] text-muted">
              {hasData ? 'Changes are applied to the table when you process them. Your current table stays untouched until then.' : 'Paste your JSON and instantly turn it into an interactive table.'}
            </p>
          </div>
        )}

        <JsonInputEditor value={text} onChange={onChange} validation={validation} dark={dark} expanded={expanded} onToggleExpand={() => setExpanded((e) => !e)} onLoadSample={onLoadSample} />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={onProcess} disabled={processing || validation.status === 'empty'} className="h-9 px-4">
            {processing ? <Loader2 size={15} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
            {processing ? 'Processing…' : hasData ? 'Update table' : 'Explore JSON'}
            <span className="ml-1 hidden items-center gap-0.5 sm:inline-flex">
              <Kbd>{MOD}</Kbd>
              <Kbd>↵</Kbd>
            </span>
          </Button>
          <Button onClick={onSample} className="h-9" disabled={processing}>
            <Sparkles size={14} /> Load Sample JSON
          </Button>
          {hasData && (
            <Button variant="ghost" onClick={onBack} className="h-9">
              Back to table <ArrowRight size={14} />
            </Button>
          )}
          {hasData && dirty && <span className="text-[12px] text-warn">Unprocessed changes</span>}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
          <button
            onClick={() => fileRef.current?.click()}
            className={cn(
              'flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-left transition-colors hover:border-accent/60 hover:bg-accent-soft/60',
              drag ? 'border-accent bg-accent-soft' : 'border-line bg-surface/60',
            )}
          >
            <UploadCloud size={20} className="shrink-0 text-accent" />
            <span>
              <span className="block text-[13px] font-medium">Drop a .json file here, or browse</span>
              <span className="block text-[12px] text-muted">The file is read locally by your browser.</span>
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.jsonl,.ndjson,application/json,text/plain"
            hidden
            onChange={(e) => {
              onFile(e.target.files)
              e.target.value = ''
            }}
          />
          <div className="flex flex-col justify-center gap-1 rounded-xl border border-line bg-surface/60 px-4 py-3 text-[12px] text-muted">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-ink">Supports</span>
              {['Arrays', 'Objects', 'Nested', '.json', '.jsonl'].map((t) => (
                <span key={t} className="rounded border border-line bg-sunken px-1.5 py-px font-mono text-[11px]">
                  {t}
                </span>
              ))}
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-success" /> 100% local. Nothing is uploaded.
            </span>
          </div>
        </div>
      </div>

      {drag && (
        <div className="anim-fade pointer-events-none absolute inset-3 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-accent-soft/80 text-[15px] font-medium text-accent">
          Drop JSON file to load it
        </div>
      )}
    </div>
  )
}
