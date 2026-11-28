import { Kbd } from './ui'
import { MOD } from '../lib/util'

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-t border-line py-5 first:border-0 first:pt-0">
    <h2 className="mb-2 text-[14px] font-semibold">{title}</h2>
    <div className="space-y-2 text-[13px] leading-relaxed text-muted">{children}</div>
  </section>
)

const Code = ({ children }: { children: React.ReactNode }) => <code className="rounded bg-sunken px-1 py-px font-mono text-[12px] text-ink">{children}</code>

export function DocsView() {
  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="mb-1 text-[24px] font-semibold tracking-tight">Documentation</h1>
        <p className="mb-6 text-muted">A quick guide to how Jsonlet reads your data.</p>

        <Section title="How structure is detected">
          <p>If the root is an array of objects, each object becomes a row. If the root is an object, Jsonlet opens the largest array of objects it can find (for example <Code>data</Code> in an API envelope). Pick any other node from the structure sidebar to open it instead.</p>
          <p>An object whose values are all objects (a keyed map) becomes one row per key, with the key in a <Code>_key</Code> column. Arrays of plain values appear in a single <Code>value</Code> column.</p>
        </Section>

        <Section title="Live updates and undo">
          <p>Once a table is open, the JSON editor on the left is live: the table updates a moment after you stop typing, and it keeps your sort, filters, hidden columns, expanded rows and open nested tables. Query results and nested tables follow your edits too. While the JSON is invalid (for example half-typed), the table keeps showing your last valid JSON and the editor shows the error with its line and column.</p>
          <p>Undo and redo work as usual: <Kbd>{MOD}</Kbd><Kbd>Z</Kbd> and <Kbd>{MOD}</Kbd><Kbd>Shift</Kbd><Kbd>Z</Kbd>. They also work when keyboard focus is somewhere else, such as on the table. Turn Live off with the switch above the editor if you prefer to apply edits yourself with the Update button or <Kbd>{MOD}</Kbd><Kbd>Enter</Kbd>. Your choice is remembered.</p>
        </Section>

        <Section title="Input formats">
          <p>Paste valid JSON over an empty editor, or over everything you have selected, and it is formatted automatically. The first Undo (<Kbd>{MOD}</Kbd><Kbd>Z</Kbd>) gives back exactly what you copied. Formatting only changes whitespace, so numbers such as <Code>12345678901234567890</Code>, <Code>1.0</Code> and <Code>1e3</Code> stay as written. Pasting into the middle of existing text, invalid JSON and JSON Lines are never touched. Turn this off with the clipboard-check button in the editor toolbar.</p>
          <p>Jsonlet accepts standard JSON, JSON Lines / NDJSON (one value per line, each line becomes a record), files with a byte-order mark, and arrays of arrays (columns are named <Code>[0]</Code>, <Code>[1]</Code>, …). If the JSON is invalid, press Repair to fix comments, single quotes, unquoted keys, trailing commas and Python literals.</p>
          <p>Very wide data (over 200 columns) starts with the first 150 columns visible. Use Columns to show the rest. Integers above 9,007,199,254,740,991 can lose precision because JavaScript numbers cannot hold them exactly.</p>
        </Section>

        <Section title="Nested data">
          <p>Nested objects are flattened with dot notation, such as <Code>address.city</Code>. You can turn flattening off under Columns. Arrays are never flattened or dropped. They appear as chips. Click a chip, or the arrow at the start of a row, to expand it in place as a nested table under that row. The row count of the main table never changes, and you can keep expanding inside the nested tables. A nested table is the same table as the main one, just smaller: it has its own sorting, filters, search, column controls, paging and export, and clicking one of its rows opens that record in the inspector and shows it in the editor, at any depth. Its sort, filters and search are kept while you edit the JSON, and reset when you collapse it. The double arrow in the header expands or collapses every row on the page. Any nested block can still be opened as its own full table. The breadcrumb above the table takes you back.</p>
          <p>Fields inside arrays in the sidebar use <Code>[*]</Code>, such as <Code>users[*].orders</Code>. That opens every item from every parent as a single table.</p>
        </Section>

        <Section title="Searching, filtering, sorting">
          <p>Global search scans visible columns only and highlights matches. Column filters adapt to the column type: text, number, date or boolean. Filters on different columns combine. Click a header to sort, and hold Shift to sort by more than one column.</p>
        </Section>

        <Section title="JSONPath queries">
          <p>The query bar above the table runs a JSONPath expression against the whole document and shows the result as a table. Press <Kbd>/</Kbd> to focus it. Examples: <Code>$.users[*].name</Code>, <Code>$..city</Code>, <Code>$.users[0:5]</Code>, <Code>$.users[?(@.age &gt; 30 &amp;&amp; @.role == 'admin')]</Code>.</p>
          <p>Filters support <Code>==</Code> <Code>!=</Code> <Code>&lt;</Code> <Code>&lt;=</Code> <Code>&gt;</Code> <Code>&gt;=</Code> <Code>=~ /regex/i</Code>, <Code>&amp;&amp;</Code>, <Code>||</Code>, <Code>!</Code> and <Code>.length</Code>. Use Clear query to return to the default table.</p>
        </Section>

        <Section title="Jumping to a key in the editor">
          <p>Click a row and the editor on the left scrolls to that record and briefly highlights it. In a keyed map such as <Code>{'{ "PAYIN": {…} }'}</Code> it lands on the key itself. The right-hand panel opens on its JSON view, and every key in it (JSON or Tree) is clickable to jump to that exact key in the editor. This uses the editor's current text, so if you have edited it without pressing Update table, a key that no longer exists can't be found.</p>
        </Section>

        <Section title="Cell shortcuts and statistics">
          <p>Right-click any cell for a menu with copy, filter by this value and exclude this value. Alt+click a cell to filter by it instantly. Open a column's filter menu and switch to Stats to see min, max, mean, median, a distribution and the most common values. Click a common value to filter by it.</p>
        </Section>

        <Section title="Comparing documents">
          <p>The Compare tab diffs two JSON documents and lists every added, removed and changed value by path. Arrays are compared by position unless you give a key such as <Code>id</Code>, in which case items are matched by that key.</p>
        </Section>

        <Section title="Exporting">
          <p>Export uses the current filtered and sorted rows, or only the selected rows. CSV contains the visible columns, and nested values are written as JSON text. JSON export writes the original, unflattened records. You can also copy the filtered rows as a Markdown table, or infer TypeScript interfaces from the data.</p>
        </Section>

        <Section title="Privacy">
          <p>Everything happens locally in your browser. There are no network requests and nothing is ever sent to a server.</p>
          <p>So that a reload or the browser's Back and Forward buttons don't lose your work, Jsonlet saves a draft of your JSON in this browser (IndexedDB), separately for each tab. It is restored automatically when you return. Clear Data removes it immediately, and drafts untouched for 7 days are deleted. On a shared computer, use Clear Data when you are done.</p>
        </Section>

        <Section title="Shortcuts">
          <p className="flex flex-wrap items-center gap-1.5">
            <Kbd>{MOD}</Kbd><Kbd>K</Kbd> search · <Kbd>{MOD}</Kbd><Kbd>↵</Kbd> process JSON · <Kbd>{MOD}</Kbd><Kbd>Shift</Kbd><Kbd>C</Kbd> copy selected · <Kbd>Esc</Kbd> close · <Kbd>?</Kbd> help
          </p>
        </Section>
      </article>
    </div>
  )
}
