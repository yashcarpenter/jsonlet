import { Modal, Kbd } from './ui'
import { MOD } from '../lib/util'

const GROUPS: { title: string; items: [string[], string][] }[] = [
  {
    title: 'General',
    items: [
      [[MOD, 'K'], 'Focus global search'],
      [[MOD, 'Enter'], 'Process JSON'],
      [[MOD, 'Shift', 'C'], 'Copy selected JSON'],
      [['Esc'], 'Close panels, menus and dialogs'],
      [['/'], 'Focus the JSONPath query bar'],
      [['?'], 'Show this help'],
    ],
  },
  {
    title: 'Table',
    items: [
      [['Click header'], 'Sort (asc → desc → off)'],
      [['Shift', 'Click header'], 'Add column to multi-sort'],
      [['Click row'], 'Open row inspector'],
      [['Alt', 'Click cell'], 'Filter column by that value'],
      [[MOD, 'Click Open as table'], 'Open that table in a new tab'],
      [['Right-click cell'], 'Cell menu (copy, filter, exclude)'],
      [['Drag header edge'], 'Resize column'],
    ],
  },
]

export function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} width={460}>
      <div className="space-y-5">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">{g.title}</h3>
            <ul className="divide-y divide-line">
              {g.items.map(([keys, label]) => (
                <li key={label} className="flex items-center justify-between py-2">
                  <span>{label}</span>
                  <span className="flex items-center gap-1">
                    {keys.map((k, i) => (
                      <Kbd key={i}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  )
}

export function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About Jsonlet" onClose={onClose} width={440}>
      <div className="space-y-3 text-[13px] leading-relaxed text-muted">
        <p>
          <span className="font-medium text-ink">Jsonlet</span> turns raw JSON into an interactive table you can search, filter, sort, inspect and export.
        </p>
        <p>Everything runs in your browser. There is no backend, no account and no network request: your data never leaves this tab.</p>
        <p>Built with React, TypeScript, Vite, Tailwind CSS, TanStack Table, CodeMirror and PapaParse.</p>
      </div>
    </Modal>
  )
}
