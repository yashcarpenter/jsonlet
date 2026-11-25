import { useState, type ReactNode } from 'react'
import { ClipboardCopy, Download, FileSpreadsheet, FileJson, Table, FileCode2 } from 'lucide-react'
import { Button, Popover, Switch } from './ui'

type Props = {
  filteredCount: number
  selectedCount: number
  onCsv: (selectedOnly: boolean) => void
  onJson: (selectedOnly: boolean, minify: boolean) => void
  onCopy: (selectedOnly: boolean, minify: boolean) => void
  onMarkdown: () => void
  onTypeScript: () => void
}

export function ExportMenu({ filteredCount, selectedCount, onCsv, onJson, onCopy, onMarkdown, onTypeScript }: Props) {
  const [minify, setMinify] = useState(false)
  const Item = ({ icon, label, hint, disabled, onClick }: { icon: ReactNode; label: string; hint?: string; disabled?: boolean; onClick: () => void }) => (
    <button disabled={disabled} onClick={onClick} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left hover:bg-sunken disabled:opacity-40 disabled:hover:bg-transparent">
      <span className="text-muted">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </button>
  )
  return (
    <Popover
      align="end"
      width={290}
      trigger={(p) => (
        <Button size="sm" {...p} className={p.open ? 'bg-sunken' : ''}>
          <Download size={13} /> Export
        </Button>
      )}
    >
      {(close) => {
        const run = (fn: () => void) => () => {
          fn()
          close()
        }
        return (
          <div className="p-1">
            <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">Filtered results</div>
            <Item icon={<FileSpreadsheet size={14} />} label="Download CSV" hint={`${filteredCount.toLocaleString()} rows`} onClick={run(() => onCsv(false))} />
            <Item icon={<FileJson size={14} />} label="Download JSON" hint={`${filteredCount.toLocaleString()} rows`} onClick={run(() => onJson(false, minify))} />
            <Item icon={<ClipboardCopy size={14} />} label="Copy as JSON" onClick={run(() => onCopy(false, minify))} />
            <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">Selected rows</div>
            <Item icon={<FileSpreadsheet size={14} />} label="Download CSV" hint={`${selectedCount} selected`} disabled={!selectedCount} onClick={run(() => onCsv(true))} />
            <Item icon={<FileJson size={14} />} label="Download JSON" disabled={!selectedCount} onClick={run(() => onJson(true, minify))} />
            <Item icon={<ClipboardCopy size={14} />} label="Copy as JSON" disabled={!selectedCount} onClick={run(() => onCopy(true, minify))} />
            <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">Other formats</div>
            <Item icon={<Table size={14} />} label="Copy as Markdown table" onClick={run(onMarkdown)} />
            <Item icon={<FileCode2 size={14} />} label="Copy as TypeScript interfaces" onClick={run(onTypeScript)} />
            <div className="mt-1 border-t border-line px-2.5 py-2">
              <Switch checked={minify} onChange={setMinify} label="Minify JSON output" />
            </div>
          </div>
        )
      }}
    </Popover>
  )
}
