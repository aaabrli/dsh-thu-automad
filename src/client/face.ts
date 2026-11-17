/** Shared status and actions injected into the plugin UI. */

import type { AutomadActions } from './actions.ts'
import type { AutomadStatusSource } from './status.ts'

/** Values the plugin body hands every component it registers. */
export interface AutomadFace {
  /** Reactive facts the renderer binds to `useAutomadStatus`. */
  hooks: { automadStatus: AutomadStatusSource }
  /** Callbacks the components post through. */
  actions: AutomadActions
  /** Refresh host status immediately. */
  refresh: () => void
}
