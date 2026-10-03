/**
 * Composer dock pill: one link to this plugin's status route.
 *
 * The whole pill is the anchor — its chrome, the reading contributed into
 * {@link STATUS_PILL_READING}, and the open icon — so the click target is
 * everything the user sees and one element carries both the reading and the
 * destination. The reading stays a separate registration; the anchor owns only
 * the navigation: the browser keeps the new tab, its focus behavior, and the
 * page's own authentication.
 * @module dsh-thu-automad/client/StatusLink
 */

import { memo } from 'react'
import { IconRightUpOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { STATUS_ROUTE } from '../protocol.ts'
import { NS } from './locale.ts'
import { STATUS_PILL_READING } from './slots.ts'
import { css } from './styles.ts'

/** Full props of the composer dock occupant. */
export type StatusLinkProps =
  & PropsRuntime<'conversation.composer.dock'>
  & PropsRenderSlots<typeof STATUS_PILL_READING>
  & PropsLocale<typeof NS>

/**
 * Composer dock link opening the plugin's status route in a new tab.
 * @param props - framework hooks, the reading seat, and the locale seat.
 * @returns the dock link.
 */
export const StatusLink = memo(function StatusLink({ renderSlot, t }: StatusLinkProps) {
  return (
    <a
      className={css.link}
      href={STATUS_ROUTE}
      target="_blank"
      rel="noopener noreferrer"
      title={t('link.title')}
    >
      {renderSlot(STATUS_PILL_READING, {})}
      {/* Names the link on its own when no reading is registered or none has
          arrived yet; a rendered reading is announced first, as link content. */}
      <span className={css.hidden}>{t('link.label')}</span>
      <IconRightUpOutlineRegular className={css.linkIcon} size={12} />
    </a>
  )
})
