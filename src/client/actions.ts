/**
 * Write side of the browser half: the three POSTs the settings page and the
 * two-factor dialog make, plus the read that refreshes after them.
 *
 * Every call returns a value rather than throwing, because each has a defined
 * failure the caller renders. A network failure is `null`; a refusal keeps the
 * Host's stable code so the component picks localized copy instead of echoing a
 * diagnostic string.
 * @module dsh-thu-automad/client/actions
 */

import {
  RENEW_PATH, SETTINGS_PATH, TWO_FACTOR_PATH, routeOf,
} from '../protocol.ts'
import type {
  ActionOutcome, AuthSettingsRequest, SettingsOutcome, TwoFactorAnswer,
} from '../protocol.ts'

/** Outcome of one manual renewal trigger. */
export interface RenewTriggerOutcome {
  /** Whether a new token was written. */
  renewed: boolean
  /** Stable code describing a non-success, or null. */
  code: string | null
  /** Credential-free description of the attempt. */
  message: string | null
}

/** Everything a component may ask the Host to do. */
export interface AutomadActions {
  /**
   * Store or clear the student identity a renewal logs in with.
   * @param request - fields to write; an omitted field is left unchanged.
   * @returns the outcome, or null when the route was unreachable.
   */
  saveIdentity(request: AuthSettingsRequest): Promise<SettingsOutcome | null>
  /**
   * Answer the outstanding two-factor challenge.
   * @param answer - the method or code the user supplied.
   * @returns the outcome, or null when the route was unreachable.
   */
  answerTwoFactor(answer: TwoFactorAnswer): Promise<ActionOutcome | null>
  /**
   * Ask the Host to renew now.
   * @returns the attempt outcome, or null when the route was unreachable.
   */
  renewNow(): Promise<RenewTriggerOutcome | null>
}

/**
 * Build the action set over the Host routes.
 * @returns the callbacks the components use.
 */
export function createActions(): AutomadActions {
  return {
    saveIdentity: async request =>
      await post<SettingsOutcome>(SETTINGS_PATH, request),
    answerTwoFactor: async answer =>
      await post<ActionOutcome>(TWO_FACTOR_PATH, answer),
    renewNow: async () =>
      await post<RenewTriggerOutcome>(RENEW_PATH, {}),
  }
}

/** POST one JSON body and decode the reply, reporting an unreachable route as null. */
async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const response = await fetch(routeOf(path), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    if (!response.ok) {
      // A refusal body still carries the shape the caller renders when the Host
      // explained itself; only an unexplained status is treated as unreachable.
      const decoded: unknown = await response.json().catch(() => null)
      return typeof decoded === 'object' && decoded !== null ? decoded as T : null
    }
    return await response.json() as T
  } catch (_routeUnreachable) {
    return null
  }
}
