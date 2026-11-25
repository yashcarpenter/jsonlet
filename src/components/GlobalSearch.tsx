import { Search, X } from 'lucide-react'
import { Kbd } from './ui'
import { MOD } from '../lib/util'

type Props = { value: string; onChange: (v: string) => void; matches: number | null }

export function GlobalSearch({ value, onChange, matches }: Props) {
  return (
    <label className="flex h-8 w-full min-w-0 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-muted transition-colors focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/15 sm:w-72">
      <Search size={14} className="shrink-0" />
      <input
        id="global-search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.stopPropagation()
            onChange('')
          }
        }}
        placeholder="Search all visible columns"
        aria-label="Search all visible columns"
        className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
        autoComplete="off"
        spellCheck={false}
      />
      {value ? (
        <>
          {matches !== null && <span className="shrink-0 font-mono text-[11px]">{matches.toLocaleString()}</span>}
          <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="rounded p-0.5 hover:bg-sunken hover:text-ink">
            <X size={13} />
          </button>
        </>
      ) : (
        <span className="hidden items-center gap-0.5 sm:flex">
          <Kbd>{MOD}</Kbd>
          <Kbd>K</Kbd>
        </span>
      )}
    </label>
  )
}
