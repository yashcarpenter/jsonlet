import { createContext } from 'react'
import type { Row, TableModel } from '../lib/json'

/**
 * Lets tables nested inside other tables (at any depth) talk to the page-level features, such as the record
 * inspector and the editor on the left, without threading props through every level.
 */
export type NestedCtx = {
  /** A row of a nested table was clicked (null = close). Opens the record in the inspector and shows it in the editor. */
  onInspectRow: (row: Row | null, kind: TableModel['kind']) => void
  isInspected: (row: Row, kind: TableModel['kind']) => boolean
  /** Scroll the editor to `key` inside `parent`, which must be an object or array that lives in the document. */
  revealKey: (parent: unknown, key: string | number) => void
  fileBase: string
}

export const NestedContext = createContext<NestedCtx | null>(null)
