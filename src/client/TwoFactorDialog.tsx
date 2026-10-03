/**
 * The two-factor dialog a renewal raises when the school does not trust this
 * device yet.
 *
 * This is the one place the plugin asks a human for input, and it exists
 * because a background login has nobody to answer the chain's callback. The
 * Host parks the question and publishes it; this component renders it and posts
 * the answer back. The two stages are separate round trips on purpose: the
 * school decides which methods are available only after the password step, and
 * the code is requested from the chosen method, so the second stage cannot be
 * predicted from the first.
 *
 * It is a `ui-primitives` `Modal`, so Escape, the mask click, focus return, and
 * the top-layer coordination with menus are the shell's shared behavior rather
 * than a second implementation. Dismissing it is a cancellation, not a silent
 * close: leaving the question unanswered would hold the renewal open until its
 * timeout.
 * @module dsh-thu-automad/client/TwoFactorDialog
 */

import { memo, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Button, Checkbox, Input, Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  InjectFace, PropsLocale, PropsRuntime, TranslateNS,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { TwoFactorPrompt } from '../protocol.ts'
import type { AutomadFace } from './face.ts'
import { NS } from './locale.ts'
import { css } from './styles.ts'
import { useCountdown } from './use-countdown.ts'

/** Id the footer's submit button addresses, so it submits the body's form. */
const FORM_ID = 'thu-automad-two-factor-form'

/** Full props of the overlay occupant. */
export type TwoFactorProps =
  & PropsRuntime<'shell.overlay'>
  & PropsLocale<typeof NS>
  & InjectFace<AutomadFace>

/** Localized label for one verification method. */
function methodLabel(method: string, phone: string | null, t: TranslateNS<typeof NS>): string {
  switch (method) {
    case 'wechat': return t('twoFactor.method.wechat')
    case 'mobile': return t('twoFactor.method.mobile', { phone: phone ?? '' })
    case 'totp': return t('twoFactor.method.totp')
    default: return method
  }
}

/**
 * Modal asking for one two-factor answer.
 * @param props - framework hooks, injected status source and actions, and locale seat.
 * @returns the modal, or null while no challenge is outstanding.
 */
export const TwoFactorDialog = memo(function TwoFactorDialog({
  useAutomadStatus, actions, refresh, t,
}: TwoFactorProps) {
  const { status } = useAutomadStatus(value => value)
  const prompt = status?.twoFactor ?? null
  const remaining = useCountdown(prompt?.expiresAt ?? null)
  const [method, setMethod] = useState('')
  const [trustDevice, setTrustDevice] = useState(true)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stage = prompt?.stage ?? null
  const offered = prompt?.methods.join(',') ?? ''

  // A new stage or a new set of offered methods is a new question: keeping the
  // previous answer would post a method the school never offered this time.
  // Keyed on the joined names rather than the array, because every poll decodes
  // a fresh array and would otherwise reset the form every few seconds.
  useEffect(() => {
    setError(null)
    setCode('')
    setMethod(offered === '' ? '' : offered.split(',')[0] as string)
  }, [stage, offered])

  if (prompt === null) return null

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const outcome = prompt.stage === 'method'
        ? await actions.answerTwoFactor({ stage: 'method', method, trustDevice })
        : await actions.answerTwoFactor({ stage: 'code', code })
      if (outcome === null) setError(t('twoFactor.error.unreachable'))
      else if (!outcome.ok) setError(stageError(outcome.error, prompt, t))
      else refresh()
    } finally {
      setBusy(false)
    }
  }

  const cancel = (): void => {
    if (busy) return
    void (async () => {
      setBusy(true)
      try {
        await actions.answerTwoFactor({ stage: 'cancel' })
        refresh()
      } finally {
        setBusy(false)
      }
    })()
  }

  const canSubmit = !busy && (prompt.stage === 'method' ? method !== '' : code.length === 6)
  return (
    <Modal
      open
      onClose={cancel}
      title={t('twoFactor.title')}
      closeLabel={t('twoFactor.cancel')}
      description={t('twoFactor.intro')}
      footer={(
        <>
          <Button onClick={cancel} disabled={busy}>{t('twoFactor.cancel')}</Button>
          <Button variant="primary" type="submit" form={FORM_ID} disabled={!canSubmit}>
            {prompt.stage === 'method' ? t('twoFactor.continue') : t('twoFactor.code.submit')}
          </Button>
        </>
      )}
    >
      {remaining === null ? null : <p className={css.note}>{t('twoFactor.expires', { remaining })}</p>}
      <form className={css.form} id={FORM_ID} onSubmit={(event) => { void submit(event) }}>
        {prompt.stage === 'method' ? (
          <>
            <fieldset className={css.fieldset}>
              <legend className={css.legend}>{t('twoFactor.method.legend')}</legend>
              {prompt.methods.map(candidate => (
                <label className={css.option} key={candidate}>
                  <input
                    type="radio"
                    name="thu-automad-two-factor-method"
                    value={candidate}
                    checked={method === candidate}
                    onChange={() => { setMethod(candidate) }}
                  />
                  {methodLabel(candidate, prompt.phone, t)}
                </label>
              ))}
            </fieldset>
            <Checkbox
              checked={trustDevice}
              onChange={setTrustDevice}
              label={t('twoFactor.trust')}
            />
          </>
        ) : (
          <label className={css.fieldset} htmlFor="thu-automad-two-factor-code">
            <span className={css.legend}>{t('twoFactor.code.legend')}</span>
            <Input
              id="thu-automad-two-factor-code"
              data-modal-autofocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder={t('twoFactor.code.placeholder')}
              value={code}
              onChange={(event) => { setCode(event.target.value.replace(/\D/gu, '')) }}
            />
          </label>
        )}
      </form>
      {error === null ? null : <p className={css.error} role="alert">{error}</p>}
    </Modal>
  )
})

/** Turn one refusal from the answer route into copy the user can act on. */
function stageError(error: string | undefined, prompt: TwoFactorPrompt, t: TranslateNS<typeof NS>): string {
  if (prompt.stage === 'code' && error !== undefined && error.includes('valid')) return t('twoFactor.error.invalidCode')
  return t('twoFactor.error.rejected')
}
