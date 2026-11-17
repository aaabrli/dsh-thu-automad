/** Connect the authentication callback to the two-factor dialog. */

import type { TwoFactorHandler, TwoFactorRequest, TwoFactorSelection } from './auth/chain.ts'
import type { TwoFactorAnswer, TwoFactorPrompt } from './protocol.ts'

/** One outstanding question and the promise waiting on it. */
interface Pending {
  /** Which answer the chain is waiting for. */
  stage: 'method' | 'code'
  /** Methods offered at the method stage; empty at the code stage. */
  methods: readonly string[]
  /** Masked phone number, when the chain reported one. */
  phone: string | null
  /** Method already chosen, at the code stage. */
  method: string | null
  /** Epoch milliseconds the question was raised. */
  askedAt: number
  /** Epoch milliseconds the question gives up. */
  expiresAt: number
  /** Settle the chain's promise. */
  settle: (answer: string | TwoFactorSelection) => void
  /** Timer that abandons the question. */
  timer: ReturnType<typeof setTimeout>
}

/** Six digits, which is the only code shape the school accepts. */
const CODE_PATTERN = /^\d{6}$/u

/** Why an answer was or was not accepted. */
export type AnswerOutcome =
  /** The outstanding question consumed it. */
  | 'accepted'
  /** Nothing was outstanding. */
  | 'none'
  /** The answer addressed a different stage. */
  | 'stale'
  /** The answer was malformed for its stage. */
  | 'invalid'

/** Park two-factor questions until a browser answers them. */
export class TwoFactorQueue {
  private pending: Pending | null = null
  private lastChallengeAt: number | null = null

  /**
   * @param timeoutMs - how long a question stays open before it is abandoned.
   * @param now - clock, injectable so a check can drive time directly.
   */
  constructor(private readonly timeoutMs: number, private readonly now: () => number = Date.now) {}

  /**
   * Build the callback the login chain asks.
   * @returns a handler that parks each question on this queue.
   */
  handler(): TwoFactorHandler {
    return async (request: TwoFactorRequest): Promise<string | TwoFactorSelection> => {
      if (this.pending !== null) {
        // Replace an outstanding question when the login starts a new one.
        throw new Error('thu-automad: a two-factor challenge is already outstanding')
      }
      return await new Promise<string | TwoFactorSelection>((resolve) => {
        const askedAt = this.now()
        const entry: Pending = {
          stage: request.stage,
          methods: request.stage === 'method' ? [...request.methods] : [],
          phone: typeof request.phone === 'string' ? request.phone : null,
          method: request.stage === 'code' ? request.method : null,
          askedAt,
          expiresAt: askedAt + this.timeoutMs,
          settle: (answer) => {
            clearTimeout(entry.timer)
            if (this.pending === entry) this.pending = null
            resolve(answer)
          },
          timer: setTimeout(() => { entry.settle('') }, this.timeoutMs),
        }
        this.lastChallengeAt = askedAt
        this.pending = entry
      })
    }
  }

  /**
   * Deliver one browser answer to the outstanding question.
   * @param answer - the answer the settings page or dialog posted.
   * @returns whether the question consumed it.
   */
  answer(answer: TwoFactorAnswer): AnswerOutcome {
    const pending = this.pending
    if (pending === null) return 'none'
    if (answer.stage === 'cancel') {
      pending.settle('')
      return 'accepted'
    }
    if (answer.stage !== pending.stage) return 'stale'
    if (answer.stage === 'method') {
      if (!pending.methods.includes(answer.method)) return 'invalid'
      this.lastChallengeAt = this.now()
      pending.settle({ method: answer.method, trustDevice: answer.trustDevice })
      return 'accepted'
    }
    if (!CODE_PATTERN.test(answer.code)) return 'invalid'
    pending.settle(answer.code)
    return 'accepted'
  }

  /** Abandon an outstanding question, if any. */
  cancel(): void {
    this.pending?.settle('')
  }

  /**
   * Read the outstanding question for publication.
   * @returns the prompt, or null when the chain is not waiting on a human.
   */
  snapshot(): TwoFactorPrompt | null {
    const pending = this.pending
    if (pending === null) return null
    return {
      stage: pending.stage,
      methods: pending.methods,
      phone: pending.phone,
      method: pending.method,
      askedAt: pending.askedAt,
      expiresAt: pending.expiresAt,
    }
  }

  /** Read the timestamp of the latest two-factor challenge. */
  challengeMark(): number | null {
    return this.lastChallengeAt
  }
}
