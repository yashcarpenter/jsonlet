import { Braces, Keyboard, Info, Moon, Sun, Trash2, FileCode2, Table2, BookOpen, GitCompare } from 'lucide-react'
import { Button, IconButton } from './ui'
import { cn } from '../lib/util'

export type ViewId = 'editor' | 'table' | 'diff' | 'docs'

type Props = {
  view: ViewId
  onView: (v: ViewId) => void
  hasData: boolean
  dark: boolean
  onToggleTheme: () => void
  onShortcuts: () => void
  onAbout: () => void
  onClear: () => void
}

export function TopNavigation({ view, onView, hasData, dark, onToggleTheme, onShortcuts, onAbout, onClear }: Props) {
  const tabs: { id: ViewId; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { id: 'editor', label: 'JSON Editor', icon: <FileCode2 size={14} /> },
    { id: 'table', label: 'Table View', icon: <Table2 size={14} />, disabled: !hasData },
    { id: 'diff', label: 'Compare', icon: <GitCompare size={14} /> },
    { id: 'docs', label: 'Documentation', icon: <BookOpen size={14} /> },
  ]
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 sm:px-4">
      <button onClick={() => onView(hasData ? 'table' : 'editor')} className="flex items-center gap-2 rounded-md pr-1" aria-label="Jsonlet home">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-white dark:text-[#0b1020]">
          <Braces size={15} strokeWidth={2.4} />
        </span>
        <span className="hidden text-[14px] font-semibold tracking-tight whitespace-nowrap sm:inline">Jsonlet</span>
        <span className="hidden rounded-full border border-line px-2 py-px text-[10.5px] font-medium text-muted md:inline">Free Developer Tool</span>
      </button>

      <nav className="ml-1 flex items-center gap-0.5 sm:ml-4" aria-label="Primary">
        {tabs.map((t) => (
          <button
            key={t.id}
            disabled={t.disabled}
            title={t.disabled ? 'Process some JSON first' : t.label}
            onClick={() => onView(t.id)}
            aria-current={view === t.id ? 'page' : undefined}
            className={cn(
              'relative inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors disabled:opacity-40',
              view === t.id ? 'text-ink' : 'text-muted hover:bg-sunken hover:text-ink',
            )}
          >
            {t.icon}
            <span className={cn(view === t.id ? '' : 'hidden', 'sm:inline')}>{t.label}</span>
            {view === t.id && <span className="absolute inset-x-2 -bottom-[7px] h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-0.5">
        <IconButton label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={onToggleTheme}>
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </IconButton>
        <IconButton label="Keyboard shortcuts" onClick={onShortcuts}>
          <Keyboard size={15} />
        </IconButton>
        <IconButton label="About" onClick={onAbout}>
          <Info size={15} />
        </IconButton>
        <Button variant="ghost" size="sm" onClick={onClear} className="ml-1" title="Clear all data">
          <Trash2 size={13} />
          <span className="hidden sm:inline">Clear Data</span>
        </Button>
      </div>
    </header>
  )
}
