/** Register the status card, settings page and two-factor dialog. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { Notice } from './Notice.tsx'
import { Reading } from './Reading.tsx'
import { SettingsSection } from './SettingsSection.tsx'
import { StatusLink } from './StatusLink.tsx'
import { TwoFactorDialog } from './TwoFactorDialog.tsx'
import { createActions } from './actions.ts'
import type { AutomadFace } from './face.ts'
import { NS, en, zh } from './locale.ts'
import { installSettingsIcon } from './settings-icon.ts'
import { STATUS_PILL_READING } from './slots.ts'
import { AutomadStatusController } from './status.ts'
import { installStyles } from './styles.ts'
import iconSvg from '../../icon.svg'

/** Cordis plugin name; the Host half uses the same string. */
export const name = 'thu-automad'

/** Slot composition and the locale registry, both of which the Web shell owns. */
export const inject = ['slots', 'locale']

/**
 * Register the dictionaries, the stylesheet, the polling controller, and every
 * UI seat.
 * @param ctx - browser plugin context.
 */
export function apply(ctx: Context): void {
  const controller = new AutomadStatusController()
  const actions = createActions()
  const refresh = (): void => { void controller.poll() }
  const injected = (): AutomadFace => ({ hooks: { automadStatus: controller }, actions, refresh })

  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'thu-automad: dictionaries')
  ctx.effect(() => installStyles(), 'thu-automad: stylesheet')
  ctx.effect(
    () => installSettingsIcon([zh['settings.nav'], en['settings.nav']], iconSvg),
    'thu-automad: settings glyph',
  )
  ctx.effect(() => controller.start(), 'thu-automad: status polling')

  // Bound after the dictionaries are registered; the thunk below is re-read on
  // every projection, which is how the nav label follows a locale change.
  const t = ctx.locale.bind(NS)

  // Register the token reading inside the status card button.
  ctx.slots.inject(STATUS_PILL_READING, () => ctx.slots.register({
    name: STATUS_PILL_READING,
    locale: NS,
    inject: () => ({ hooks: { automadStatus: controller } }),
  }, Reading))

  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    id: 'thu-automad-status',
    order: 11,
    locale: NS,
    children: { [STATUS_PILL_READING]: { kind: 'single', scope: 'session' } },
    inject: () => ({ hooks: { automadStatus: controller } }),
  }, StatusLink))

  // Order 9 keeps the dialog under the notice in the overlay's own order; its
  // backdrop is what actually covers the frame.
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'thu-automad-two-factor',
    order: 9,
    locale: NS,
    inject: injected,
  }, TwoFactorDialog))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'thu-automad-notice',
    order: 10,
    locale: NS,
    inject: injected,
  }, Notice))

  // Register account and renewal controls as a settings page.
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'thu-automad',
    order: 20,
    label: () => t('settings.nav'),
    locale: NS,
    inject: injected,
  }, SettingsSection))
}
