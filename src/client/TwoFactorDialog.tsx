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

import { memo, useEffect, useRef, useState } from 'react'
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
import { Badge } from './visuals.tsx'

/** Id the footer's submit button addresses, so it submits the body's form. */
const FORM_ID = 'thu-automad-two-factor-form'
const METHOD_LABEL_ID = 'thu-automad-two-factor-method-label'
const CODE_ID = 'thu-automad-two-factor-code'
const ERROR_ID = 'thu-automad-two-factor-error'

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
  const codeInput = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    if (stage === 'code' && !busy) codeInput.current?.focus()
  }, [stage, busy])

  if (prompt === null) return null

  const choosingMethod = prompt.stage === 'method'
  const canSubmit = !busy && (choosingMethod ? prompt.methods.includes(method) : code.length === 6)
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const outcome = choosingMethod
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

  return (
    <Modal
      open
      className={css.factorModal}
      onClose={cancel}
      title={t('twoFactor.title')}
      closeLabel={t('twoFactor.cancel')}
      description={t('twoFactor.intro')}
      footer={(
        <div className={css.factorActions}>
          <Button size="sm" onClick={cancel} disabled={busy}>{t('twoFactor.cancel')}</Button>
          <Button size="sm" variant="primary" type="submit" form={FORM_ID} disabled={!canSubmit}>
            {choosingMethod ? t('twoFactor.continue') : t('twoFactor.code.submit')}
          </Button>
        </div>
      )}
    >
      <form className={css.factor} id={FORM_ID} onSubmit={(event) => { void submit(event) }}>
        <div className={css.factorHead}>
          {choosingMethod
            ? <span className={css.fieldLabel} id={METHOD_LABEL_ID}>{t('twoFactor.method.legend')}</span>
            : <label className={css.fieldLabel} htmlFor={CODE_ID}>{t('twoFactor.code.legend')}</label>}
          {remaining === null ? null : <Badge tone="warn" text={t('settings.overview.remaining', { remaining })} />}
        </div>
        {choosingMethod ? (
          <>
            <fieldset className={css.factorChoices} aria-labelledby={METHOD_LABEL_ID} disabled={busy}>
              {prompt.methods.map((candidate, index) => (
                <label className={css.factorOption} key={candidate}>
                  <input
                    type="radio"
                    name="thu-automad-two-factor-method"
                    value={candidate}
                    data-modal-autofocus={index === 0 ? true : undefined}
                    checked={method === candidate}
                    onChange={() => { setMethod(candidate) }}
                  />
                  {methodLabel(candidate, prompt.phone, t)}
                </label>
              ))}
            </fieldset>
            <Checkbox
              checked={trustDevice}
              disabled={busy}
              onChange={setTrustDevice}
              label={t('twoFactor.trust')}
            />
          </>
        ) : (
          <Input
            className={`${css.fieldInput} ${css.factorCode}`}
            id={CODE_ID}
            ref={codeInput}
            data-modal-autofocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder={t('twoFactor.code.placeholder')}
            value={code}
            disabled={busy}
            aria-invalid={error !== null}
            aria-describedby={error === null ? undefined : ERROR_ID}
            onChange={(event) => { setCode(event.target.value.replace(/\D/gu, '')) }}
          />
        )}
        {error === null ? null : <p className={css.error} id={ERROR_ID} role="alert">{error}</p>}
      </form>
    </Modal>
  )
})

/** Turn one refusal from the answer route into copy the user can act on. */
function stageError(error: string | undefined, prompt: TwoFactorPrompt, t: TranslateNS<typeof NS>): string {
  if (prompt.stage === 'code' && error !== undefined && error.includes('valid')) return t('twoFactor.error.invalidCode')
  return t('twoFactor.error.rejected')
}
