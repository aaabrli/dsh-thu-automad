/**
 * Browser half of the Tsinghua MadModel automation plugin.
 *
 * It owns one polling controller and publishes it through four slot
 * registrations: a reading inside the status link the plugin itself declares, a
 * notice in the shell overlay, the two-factor dialog, and the credentials page
 * under Settings. All of them read the same source through the framework's
 * bound selector hook, so no component contains subscription machinery.
 *
 * The plugin talks to the Host only through its own exact routes, and writes
 * the student identity through the settings page's form. Nothing here can read
 * a stored secret: the Host never publishes one.
 * @module dsh-thu-automad/client
 */

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
import { STATUS_PILL_READING } from './slots.ts'
import { AutomadStatusController } from './status.ts'
import { installStyles } from './styles.ts'

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
  ctx.effect(() => controller.start(), 'thu-automad: status polling')

  // Bound after the dictionaries are registered; the thunk below is re-read on
  // every projection, which is how the nav label follows a locale change.
  const t = ctx.locale.bind(NS)

  // The status link owns the pill and the navigation; this half contributes the
  // reading rendered inside it, so the seat stays a real extension point a
  // deployment can register into instead of taking a second dock seat.
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

  // A whole page rather than a General row: two credential fields, the renewal
  // status they feed, and the manual trigger all belong to one subject.
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'thu-automad',
    order: 20,
    label: () => t('settings.nav'),
    locale: NS,
    inject: injected,
  }, SettingsSection))
}
