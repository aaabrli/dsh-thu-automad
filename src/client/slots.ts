/**
 * The reading seat this plugin's status link declares inside itself.
 *
 * The link owns the pill chrome and the navigation, so whatever a deployment
 * wants shown inside it registers here instead of taking a second dock seat.
 * The declaration is what authorizes the render; a contributor only needs this
 * module's types, which is why the name and the {@link SlotMap} merge live
 * together in a module with no other imports.
 * @module dsh-thu-automad/client/slots
 */

import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** Reading seat inside the status link, rendered before the open icon. */
export const STATUS_PILL_READING = 'conversation.composer.statusPillReading'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** One reading inside the status link, rendered before the open icon. */
    'conversation.composer.statusPillReading': { kind: 'single'; scope: 'session' }
  }
}
