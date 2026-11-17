/** Settings, renewal and two-factor requests to the plugin host. */

import {
  PROBE_PATH, RENEW_PATH, SETTINGS_PATH, TRANSPORT_CONTROL_PATH, TWO_FACTOR_PATH, routeOf,
} from '../protocol.ts'
import type {
  ActionOutcome, AuthSettingsRequest, ProbeOutcome, SettingsOutcome, TransportControlOutcome,
  TransportControlRequest, TwoFactorAnswer,
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
  /**
   * Re-probe the network and return the transport facts.
   * @returns the probe outcome, or null when the route was unreachable.
   */
  probeTransport(): Promise<ProbeOutcome | null>
  /**
   * Turn admission control off, or reset a queue that is stuck.
   * @param request - `queue` toggles waiting, `reset` clears every slot.
   * @returns the transport facts after the change, or null when unreachable.
   */
  controlTransport(request: TransportControlRequest): Promise<TransportControlOutcome | null>
}

/**
 * Build the action set over the Host routes.
 * @returns the callbacks the components use.
 */
export function createActions(): AutomadActions {
  return {
    saveIdentity: request => post<SettingsOutcome>(SETTINGS_PATH, request),
    answerTwoFactor: answer => post<ActionOutcome>(TWO_FACTOR_PATH, answer),
    renewNow: () => post<RenewTriggerOutcome>(RENEW_PATH, {}),
    probeTransport: () => post<ProbeOutcome>(PROBE_PATH, {}),
    controlTransport: request => post<TransportControlOutcome>(TRANSPORT_CONTROL_PATH, request),
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
    const decoded: unknown = await response.json()
    return typeof decoded === 'object' && decoded !== null ? decoded as T : null
  } catch (_routeUnreachable) {
    return null
  }
}
