/** Declare the reading slot inside the status card button. */

import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** Reading seat inside the status link, rendered before the open icon. */
export const STATUS_PILL_READING = 'conversation.composer.statusPillReading'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** One reading inside the status link, rendered before the open icon. */
    'conversation.composer.statusPillReading': { kind: 'single'; scope: 'session' }
  }
}
