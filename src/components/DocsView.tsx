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

        <Section title="Nested data">
          <p>Nested objects are flattened with dot notation, such as <Code>address.city</Code>. You can turn flattening off under Columns. Arrays are never flattened or dropped. They appear as chips you can expand, and any array can be opened as its own table. The breadcrumb above the table takes you back.</p>
          <p>Fields inside arrays in the sidebar use <Code>[*]</Code>, such as <Code>users[*].orders</Code>. That opens every item from every parent as a single table.</p>
        </Section>

        <Section title="Searching, filtering, sorting">
          <p>Global search scans visible columns only and highlights matches. Column filters adapt to the column type: text, number, date or boolean. Filters on different columns combine. Click a header to sort, and hold Shift to sort by more than one column.</p>
        </Section>

        <Section title="JSONPath queries">
          <p>The query bar above the table runs a JSONPath expression against the whole document and shows the result as a table. Press <Kbd>/</Kbd> to focus it. Examples: <Code>$.users[*].name</Code>, <Code>$..city</Code>, <Code>$.users[0:5]</Code>, <Code>$.users[?(@.age &gt; 30 &amp;&amp; @.role == 'admin')]</Code>.</p>
          <p>Filters support <Code>==</Code> <Code>!=</Code> <Code>&lt;</Code> <Code>&lt;=</Code> <Code>&gt;</Code> <Code>&gt;=</Code> <Code>=~ /regex/i</Code>, <Code>&amp;&amp;</Code>, <Code>||</Code>, <Code>!</Code> and <Code>.length</Code>. Use Clear query to return to the default table.</p>
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
          <p>Everything happens locally in your browser. There are no network requests and nothing is stored apart from your theme choice.</p>
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
