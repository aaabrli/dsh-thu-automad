/**
 * The inject face every occupant of this plugin's slots receives.
 *
 * Declared once because the overlay hosts two occupants and the settings page a
 * third, and all of them read the same controller and post through the same
 * action set. A component destructures only the members it uses; the face is
 * one object rather than three so a registration cannot half-provide it.
 * @module dsh-thu-automad/client/face
 */

import type { AutomadActions } from './actions.ts'
import type { AutomadStatusSource } from './status.ts'

/** Values the plugin body hands every component it registers. */
export interface AutomadFace {
  /** Reactive facts the renderer binds to `useAutomadStatus`. */
  hooks: { automadStatus: AutomadStatusSource }
  /** Callbacks the components post through. */
  actions: AutomadActions
  /** Read the status route again immediately, rather than waiting out the poll. */
  refresh: () => void
}
