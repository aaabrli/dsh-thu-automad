/**
 * Localized copy for the renewal's failure codes.
 *
 * The status document carries a stable code plus whatever diagnostic the Host
 * captured; both the settings page and the composer popover have to turn that
 * into one sentence, and they must not disagree. The mapping lives here so the
 * two surfaces share it instead of drifting.
 * @module dsh-thu-automad/client/renew-copy
 */

import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { NS } from './locale.ts'

/**
 * Localized reason for one failure code, or null when no code covers it.
 * @param code - stable code the Host reported.
 * @param diagnostic - the Host's own message, when it sent one.
 * @param t - bound locale seat.
 * @returns the localized reason, or null to fall back to the Host's message.
 */
export function renewFailureText(
  code: string,
  diagnostic: string | null,
  t: TranslateNS<typeof NS>,
): string | null {
  let reason: string
  switch (code) {
    case 'CANCELLED': return t('settings.renew.result.cancelled')
    case 'CANDIDATE_EXPIRED': return t('settings.renew.result.candidateExpired')
    case 'INPUT_CHANGED': return t('settings.renew.result.inputsChanged')
    case 'VERIFICATION_PENDING': reason = t('settings.renew.result.verificationPending'); break
    case 'NO_CREDENTIALS': return t('settings.renew.result.noCredentials')
    case 'NO_PROGRESS': return t('settings.renew.result.noProgress')
    case 'WRITE_REFUSED': return t('settings.renew.result.writeRefused')
    case 'TOKEN_REJECTED': reason = t('settings.renew.result.rejected'); break
    case 'PROBE_RATE_LIMITED': reason = t('settings.renew.result.rateLimited'); break
    case 'PROBE_SESSION_LOST': reason = t('settings.renew.result.sessionLost'); break
    case 'PROBE_UNREACHABLE': reason = t('settings.renew.result.probeUnreachable'); break
    case 'PROBE_UNAVAILABLE': reason = t('settings.renew.result.probeUnavailable'); break
    case 'PROBE_UNEXPECTED': reason = t('settings.renew.result.probeUnexpected'); break
    case 'JUST_RENEWED': return t('settings.renew.result.renewed')
    default:
      return code.startsWith('TWO_FACTOR_') || code === 'BAD_CREDENTIALS'
        ? t('settings.renew.result.needsHuman')
        : null
  }
  return diagnostic?.startsWith('HTTP ') === true && diagnostic.includes(' · ')
    ? t('settings.renew.result.probeDetail', { reason, detail: diagnostic })
    : reason
}
