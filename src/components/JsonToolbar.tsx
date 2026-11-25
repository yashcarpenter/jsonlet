import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronRight, Clock, Copy, Download, FileJson, PanelLeftOpen, Pencil, RotateCcw, Table2, TreePine, Upload } from 'lucide-react'
import { Button, IconButton, Segmented } from './ui'
import { timeAgo } from '../lib/util'

type Props = {
  source: string
  structure: string
  records: number
  columns: number
  processedAt: number
  crumbs: string[]
  onCrumb: (i: number) => void
  mode: 'table' | 'tree'
  onMode: (m: 'table' | 'tree') => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onEdit: () => void
  onReplace: () => void
  onCopy: () => void
  onDownload: () => void
  onReset: () => void
}

export function JsonToolbar(p: Props) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="border-b border-line bg-surface px-3 py-2 sm:px-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {!p.sidebarOpen && (
          <IconButton label="Show JSON structure" onClick={p.onToggleSidebar}>
            <PanelLeftOpen size={16} />
          </IconButton>
        )}
        <div className="flex min-w-0 items-center gap-2">
          <FileJson size={16} className="shrink-0 text-accent" />
          <span className="truncate text-[14px] font-semibold">{p.source}</span>
          <span className="hidden items-center gap-1 rounded-full bg-success/10 px-2 py-px text-[11px] font-medium text-success sm:inline-flex">
            <CheckCircle2 size={11} /> Valid
          </span>
        </div>
        <div className="hidden items-center gap-3 text-[12px] text-muted lg:flex">
          <span>{p.structure}</span>
          <span className="h-3 w-px bg-line" />
          <span>
            <b className="font-medium text-ink">{p.records.toLocaleString()}</b> records
          </span>
          <span>
            <b className="font-medium text-ink">{p.columns}</b> columns
          </span>
          <span className="h-3 w-px bg-line" />
          <span className="flex items-center gap-1">
            <Clock size={12} /> Processed {timeAgo(p.processedAt)}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Segmented
            value={p.mode}
            onChange={p.onMode}
            options={[
              { id: 'table', label: 'Table', icon: <Table2 size={12} /> },
              { id: 'tree', label: 'Tree', icon: <TreePine size={12} /> },
            ]}
          />
          <span className="mx-1 hidden h-4 w-px bg-line sm:block" />
          <Button size="sm" variant="ghost" onClick={p.onEdit} title="Edit JSON">
            <Pencil size={13} />
            <span className="hidden xl:inline">Edit JSON</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={p.onReplace} title="Replace JSON from a file">
            <Upload size={13} />
            <span className="hidden xl:inline">Replace</span>
          </Button>
          <IconButton label="Copy JSON" onClick={p.onCopy}>
            <Copy size={14} />
          </IconButton>
          <IconButton label="Download JSON" onClick={p.onDownload}>
            <Download size={14} />
          </IconButton>
          <IconButton label="Reset workspace" onClick={p.onReset} className="hover:text-error">
            <RotateCcw size={14} />
          </IconButton>
        </div>
      </div>

      {p.crumbs.length > 1 && (
        <nav aria-label="Dataset path" className="mt-1.5 flex flex-wrap items-center gap-0.5 text-[12px]">
          {p.crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-0.5">
              {i > 0 && <ChevronRight size={12} className="text-muted" />}
              <button
                onClick={() => p.onCrumb(i)}
                disabled={i === p.crumbs.length - 1}
                className="max-w-[260px] truncate rounded px-1.5 py-0.5 font-mono text-muted hover:bg-sunken hover:text-ink disabled:font-semibold disabled:text-ink"
              >
                {c}
              </button>
            </span>
          ))}
        </nav>
      )}
    </div>
  )
}
